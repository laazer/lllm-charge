import * as sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import { dirname } from 'path';
export class KnowledgeBase {
    db;
    dbPath;
    embeddingCache = new Map();
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = new sqlite3.Database(dbPath);
        this.initializeDatabase();
    }
    async initialize() {
        await this.ensureDirectoryExists(dirname(this.dbPath));
        this.initializeDatabase();
    }
    async ensureDirectoryExists(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
        }
        catch (error) {
            // Directory might already exist
        }
    }
    initializeDatabase() {
        const schema = `
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        signature TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        column INTEGER NOT NULL,
        metadata TEXT,
        embedding BLOB,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        confidence REAL NOT NULL,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (from_id) REFERENCES symbols(id),
        FOREIGN KEY (to_id) REFERENCES symbols(id)
      );

      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
      CREATE INDEX IF NOT EXISTS idx_relations_kind ON relations(kind);

      -- Full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
        id, name, signature, content='symbols', content_rowid='rowid'
      );

      -- Documentation storage table
      CREATE TABLE IF NOT EXISTS documentation_store (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT,
        embedding BLOB,
        created_at INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_doc_last_accessed ON documentation_store(last_accessed);
      CREATE INDEX IF NOT EXISTS idx_doc_type ON documentation_store(json_extract(metadata, '$.type'));
    `;
        this.db.exec(schema);
    }
    async storeSymbol(symbol) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO symbols 
        (id, name, kind, signature, file, line, column, metadata, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const embeddingBuffer = symbol.embedding ? Buffer.from(symbol.embedding.buffer) : null;
            stmt.run([
                symbol.id,
                symbol.name,
                symbol.kind,
                symbol.signature,
                symbol.location.file,
                symbol.location.line,
                symbol.location.column,
                JSON.stringify(symbol.metadata || {}),
                embeddingBuffer
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async storeRelation(relation) {
        return new Promise((resolve, reject) => {
            const relationId = `${relation.from}-${relation.to}-${relation.kind}`;
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO relations 
        (id, from_id, to_id, kind, confidence, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run([
                relationId,
                relation.from,
                relation.to,
                relation.kind,
                relation.confidence,
                JSON.stringify(relation.metadata || {})
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async findSymbols(query, limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
        SELECT * FROM symbols 
        WHERE name LIKE ? OR signature LIKE ?
        ORDER BY 
          CASE 
            WHEN name = ? THEN 1
            WHEN name LIKE ? THEN 2
            ELSE 3
          END,
          name
        LIMIT ?
      `;
            const searchPattern = `%${query}%`;
            const exactMatch = query;
            const prefixMatch = `${query}%`;
            this.db.all(sql, [searchPattern, searchPattern, exactMatch, prefixMatch, limit], (err, rows) => {
                if (err)
                    reject(err);
                else {
                    const symbols = rows.map(row => this.rowToSymbol(row));
                    resolve(symbols);
                }
            });
        });
    }
    async findSymbolById(id) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM symbols WHERE id = ?';
            this.db.get(sql, [id], (err, row) => {
                if (err)
                    reject(err);
                else if (row)
                    resolve(this.rowToSymbol(row));
                else
                    resolve(null);
            });
        });
    }
    async getRelatedSymbols(symbolId, maxDepth = 2) {
        const visited = new Set();
        const queue = [{ id: symbolId, depth: 0 }];
        const results = [];
        while (queue.length > 0) {
            const { id, depth } = queue.shift();
            if (visited.has(id) || depth > maxDepth)
                continue;
            visited.add(id);
            const symbol = await this.findSymbolById(id);
            if (symbol) {
                results.push(symbol);
            }
            if (depth < maxDepth) {
                const relations = await this.getSymbolRelations(id);
                for (const relation of relations) {
                    const relatedId = relation.from === id ? relation.to : relation.from;
                    if (!visited.has(relatedId)) {
                        queue.push({ id: relatedId, depth: depth + 1 });
                    }
                }
            }
        }
        return results.slice(1); // Remove the original symbol
    }
    async searchSimilar(query, options = {}) {
        const startTime = Date.now();
        try {
            const symbols = await this.findSymbols(query, options.maxResults || 20);
            const relations = [];
            // Get relations for found symbols
            for (const symbol of symbols.slice(0, 5)) { // Limit to first 5 for performance
                const symbolRelations = await this.getSymbolRelations(symbol.id);
                relations.push(...symbolRelations);
            }
            const executionTime = Date.now() - startTime;
            return {
                symbols,
                relations,
                confidence: symbols.length > 0 ? 0.8 : 0.1,
                executionTime
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                symbols: [],
                relations: [],
                confidence: 0,
                executionTime
            };
        }
    }
    async getStatistics() {
        const symbolCount = await this.getSymbolCount();
        const relationCount = await this.getRelationCount();
        return {
            symbolCount,
            relationCount,
            lastUpdated: new Date()
        };
    }
    async cleanup() {
        return new Promise((resolve) => {
            this.db.close(() => {
                resolve();
            });
        });
    }
    async getOrCreateEmbedding(text) {
        if (this.embeddingCache.has(text)) {
            return this.embeddingCache.get(text);
        }
        // Simple mock embedding - in production, use actual embedding model
        const embedding = new Float32Array(384);
        for (let i = 0; i < 384; i++) {
            embedding[i] = Math.random() - 0.5;
        }
        this.embeddingCache.set(text, embedding);
        return embedding;
    }
    // Methods needed by DocsIntelligence
    async store(id, content, metadata) {
        const embedding = await this.getOrCreateEmbedding(content);
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO documentation_store 
        (id, content, metadata, embedding, created_at, last_accessed) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run([
                id,
                content,
                JSON.stringify(metadata || {}),
                Buffer.from(embedding.buffer),
                Date.now(),
                Date.now()
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async searchSemantic(query, options) {
        const queryEmbedding = await this.getOrCreateEmbedding(query);
        const limit = options?.limit || 10;
        const threshold = options?.threshold || 0.7;
        return new Promise((resolve, reject) => {
            // Simplified semantic search - in production would use vector similarity
            const sql = `
        SELECT id, content, metadata, 
               (CASE WHEN content LIKE ? THEN 0.9 ELSE 0.5 END) as similarity
        FROM documentation_store 
        WHERE similarity >= ?
        ORDER BY similarity DESC 
        LIMIT ?
      `;
            this.db.all(sql, [`%${query}%`, threshold, limit], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(row => ({
                        id: row.id,
                        content: row.content,
                        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
                        similarity: row.similarity
                    })));
            });
        });
    }
    async updateLastAccessed(id) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE documentation_store SET last_accessed = ? WHERE id = ?';
            this.db.run(sql, [Date.now(), id], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async cleanupExpiredDocs(maxAgeMs = 365 * 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - maxAgeMs;
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM documentation_store WHERE last_accessed < ?';
            this.db.run(sql, [cutoff], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(this.changes || 0);
            });
        });
    }
    rowToSymbol(row) {
        const embedding = row.embedding ? new Float32Array(row.embedding.buffer) : undefined;
        return {
            id: row.id,
            name: row.name,
            kind: row.kind,
            signature: row.signature,
            location: {
                file: row.file,
                line: row.line,
                column: row.column
            },
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            embedding
        };
    }
    async getSymbolRelations(symbolId) {
        return new Promise((resolve, reject) => {
            const sql = `
        SELECT * FROM relations 
        WHERE from_id = ? OR to_id = ?
      `;
            this.db.all(sql, [symbolId, symbolId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(row => ({
                        from: row.from_id,
                        to: row.to_id,
                        kind: row.kind,
                        confidence: row.confidence,
                        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
                    })));
            });
        });
    }
    async getSymbolCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM symbols', (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row.count);
            });
        });
    }
    async getRelationCount() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM relations', (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row.count);
            });
        });
    }
}
