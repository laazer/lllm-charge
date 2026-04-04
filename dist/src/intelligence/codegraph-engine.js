// CodeGraph integration engine for structural code analysis
// FEATURE: Tree-sitter based code parsing and graph construction
import { Database } from 'sqlite3';
import Parser from 'web-tree-sitter';
export class CodeGraphEngine {
    config;
    db;
    parser;
    languages;
    projectPath;
    constructor(config) {
        this.config = config;
        this.languages = new Map();
    }
    async initialize(projectPath) {
        this.projectPath = projectPath;
        await this.initializeDatabase();
        await this.initializeParser();
        await this.indexProject();
    }
    async searchSymbols(query, limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
        SELECT * FROM nodes 
        WHERE name MATCH ? OR signature MATCH ?
        ORDER BY rank
        LIMIT ?
      `;
            this.db.all(sql, [`*${query}*`, `*${query}*`, limit], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(this.mapRowToSymbol));
            });
        });
    }
    async semanticSearch(query, limit = 20) {
        const embedding = await this.generateEmbedding(query);
        return new Promise((resolve, reject) => {
            const sql = `
        SELECT n.*, v.embedding,
               (1 - (v.embedding <-> ?)) as similarity
        FROM nodes n
        JOIN vectors v ON n.id = v.node_id
        ORDER BY similarity DESC
        LIMIT ?
      `;
            this.db.all(sql, [embedding, limit], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(row => ({
                        content: row.signature || row.name,
                        similarity: row.similarity,
                        source: 'codegraph',
                        metadata: {
                            file: row.file,
                            line: row.line,
                            kind: row.kind
                        }
                    })));
            });
        });
    }
    async getRelationships(symbolIds) {
        if (symbolIds.length === 0)
            return [];
        const placeholders = symbolIds.map(() => '?').join(',');
        const sql = `
      SELECT * FROM edges 
      WHERE from_id IN (${placeholders}) OR to_id IN (${placeholders})
    `;
        return new Promise((resolve, reject) => {
            this.db.all(sql, [...symbolIds, ...symbolIds], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(this.mapRowToRelation));
            });
        });
    }
    async getImpactRadius(symbolId, depth = 2) {
        const visited = new Set();
        const queue = [{ id: symbolId, depth: 0 }];
        const impactedSymbols = [];
        const impactedFiles = new Set();
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current.id) || current.depth >= depth)
                continue;
            visited.add(current.id);
            const symbol = await this.getSymbolById(current.id);
            if (symbol) {
                impactedSymbols.push(symbol);
                impactedFiles.add(symbol.file);
            }
            const relations = await this.getRelationships([current.id]);
            for (const rel of relations) {
                const nextId = rel.from === current.id ? rel.to : rel.from;
                if (!visited.has(nextId)) {
                    queue.push({ id: nextId, depth: current.depth + 1 });
                }
            }
        }
        return {
            files: Array.from(impactedFiles),
            symbols: impactedSymbols
        };
    }
    async getCallers(symbolId) {
        const sql = `
      SELECT n.* FROM nodes n
      JOIN edges e ON n.id = e.from_id
      WHERE e.to_id = ? AND e.kind = 'calls'
    `;
        return new Promise((resolve, reject) => {
            this.db.all(sql, [symbolId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(this.mapRowToSymbol));
            });
        });
    }
    async getCallees(symbolId) {
        const sql = `
      SELECT n.* FROM nodes n
      JOIN edges e ON n.id = e.to_id  
      WHERE e.from_id = ? AND e.kind = 'calls'
    `;
        return new Promise((resolve, reject) => {
            this.db.all(sql, [symbolId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(this.mapRowToSymbol));
            });
        });
    }
    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new Database(`${this.projectPath}/.llm-charge/codegraph.db`, (err) => {
                if (err)
                    reject(err);
                else {
                    this.createTables();
                    resolve();
                }
            });
        });
    }
    createTables() {
        const schema = `
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER,
        column INTEGER,
        end_line INTEGER,
        end_column INTEGER,
        signature TEXT,
        docstring TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_id) REFERENCES nodes(id),
        FOREIGN KEY (to_id) REFERENCES nodes(id)
      );

      CREATE TABLE IF NOT EXISTS vectors (
        node_id TEXT PRIMARY KEY,
        embedding BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(id)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
        id, name, signature, docstring, content=nodes
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind);
      CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file);
      CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);
      CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind);
    `;
        this.db.exec(schema);
    }
    async initializeParser() {
        await Parser.init();
        this.parser = new Parser();
    }
    async indexProject() {
        // Implementation would scan the project directory and extract symbols
        // This is a simplified version - full implementation would use tree-sitter
        console.log('Indexing project with CodeGraph engine...');
    }
    mapRowToSymbol(row) {
        return {
            id: row.id,
            name: row.name,
            kind: row.kind,
            file: row.file,
            line: row.line,
            column: row.column,
            endLine: row.end_line,
            endColumn: row.end_column,
            signature: row.signature,
            docstring: row.docstring
        };
    }
    mapRowToRelation(row) {
        return {
            from: row.from_id,
            to: row.to_id,
            kind: row.kind,
            confidence: row.confidence,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };
    }
    async getSymbolById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM nodes WHERE id = ?', [id], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row ? this.mapRowToSymbol(row) : null);
            });
        });
    }
    async generateEmbedding(text) {
        // Placeholder for embedding generation
        // Would use transformers.js or call to ollama
        return Buffer.from(new Float32Array(384));
    }
}
