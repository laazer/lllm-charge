import sqlite3 from 'sqlite3'
import path from 'path'
import { promises as fs } from 'fs'
import BaseService from './base-service.mjs'

/**
 * CodeGraph Database Service - Reads the .codegraph/codegraph.db SQLite database
 * directly for symbol search, relationship queries, and impact analysis.
 *
 * Actual schema (from codegraph init):
 *   nodes: id, kind, name, qualified_name, file_path, language, start_line, end_line,
 *          start_column, end_column, docstring, signature, visibility, is_exported, ...
 *   edges: id, source, target, kind, metadata, line, col, provenance
 */
export class CodeGraphDatabaseService extends BaseService {
  constructor(projectRoot = process.cwd()) {
    super()
    this.projectRoot = projectRoot
    this.dbPath = path.join(projectRoot, '.codegraph', 'codegraph.db')
    this.db = null
  }

  async setup() {
    try {
      await fs.access(this.dbPath)
    } catch {
      console.warn(`⚠️ CodeGraph database not found at ${this.dbPath}`)
      return
    }

    this.db = await this.openDatabase(this.dbPath)
    console.log(`🔍 CodeGraph database opened: ${this.dbPath}`)
  }

  async teardown() {
    if (this.db) {
      await new Promise((resolve, reject) => {
        this.db.close((err) => err ? reject(err) : resolve())
      })
      this.db = null
    }
  }

  openDatabase(dbPath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) reject(err)
        else resolve(db)
      })
    })
  }

  runSelect(query, params = []) {
    if (!this.db) return Promise.resolve([])
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  runSelectOne(query, params = []) {
    if (!this.db) return Promise.resolve(null)
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err)
        else resolve(row || null)
      })
    })
  }

  /**
   * Get overall status: file count, node count, edge count, grouped by kind.
   */
  async getStatus() {
    if (!this.db) return this.getEmptyStatus()

    const [nodeCount, edgeCount, nodesByKind, edgesByKind, fileCount] = await Promise.all([
      this.runSelectOne('SELECT COUNT(*) as count FROM nodes'),
      this.runSelectOne('SELECT COUNT(*) as count FROM edges'),
      this.runSelect('SELECT kind, COUNT(*) as count FROM nodes GROUP BY kind ORDER BY count DESC'),
      this.runSelect('SELECT kind, COUNT(*) as count FROM edges GROUP BY kind ORDER BY count DESC'),
      this.runSelectOne("SELECT COUNT(DISTINCT file_path) as count FROM nodes WHERE kind != 'file'"),
    ])

    return {
      totalNodes: nodeCount?.count || 0,
      totalEdges: edgeCount?.count || 0,
      filesIndexed: fileCount?.count || 0,
      nodesByKind: this.arrayToRecord(nodesByKind),
      edgesByKind: this.arrayToRecord(edgesByKind),
      isAvailable: true,
      dbPath: this.dbPath,
    }
  }

  /**
   * Search symbols by name using LIKE. Returns results with normalized field names.
   */
  async searchSymbols(query, kind = null, limit = 30) {
    if (!this.db || !query) return []

    const isWildcard = query === '*'
    const searchTerm = isWildcard ? '%' : `%${query}%`
    let sql, params

    if (kind && kind !== 'all') {
      sql = isWildcard
        ? `SELECT id, name, kind, file_path, start_line, start_column, end_line, end_column, signature, docstring
           FROM nodes WHERE kind = ? ORDER BY name LIMIT ?`
        : `SELECT id, name, kind, file_path, start_line, start_column, end_line, end_column, signature, docstring
           FROM nodes WHERE (name LIKE ? OR signature LIKE ?) AND kind = ?
           ORDER BY name LIMIT ?`
      params = isWildcard ? [kind, limit] : [searchTerm, searchTerm, kind, limit]
    } else {
      sql = isWildcard
        ? `SELECT id, name, kind, file_path, start_line, start_column, end_line, end_column, signature, docstring
           FROM nodes ORDER BY name LIMIT ?`
        : `SELECT id, name, kind, file_path, start_line, start_column, end_line, end_column, signature, docstring
           FROM nodes WHERE name LIKE ? OR signature LIKE ?
           ORDER BY name LIMIT ?`
      params = isWildcard ? [limit] : [searchTerm, searchTerm, limit]
    }

    const rows = await this.runSelect(sql, params)
    return rows.map(this.normalizeNodeRow)
  }

  /**
   * Get a single symbol by its ID.
   */
  async getSymbolById(id) {
    if (!this.db) return null
    const row = await this.runSelectOne(
      'SELECT id, name, kind, file_path, start_line, start_column, end_line, end_column, signature, docstring FROM nodes WHERE id = ?',
      [id]
    )
    return row ? this.normalizeNodeRow(row) : null
  }

  /**
   * Get symbols that call the given symbol (incoming calls).
   */
  async getCallers(symbolId) {
    if (!this.db) return []
    const rows = await this.runSelect(
      `SELECT n.id, n.name, n.kind, n.file_path, n.start_line, n.signature, e.kind as edgeKind
       FROM edges e JOIN nodes n ON e.source = n.id
       WHERE e.target = ? AND e.kind = 'calls'
       ORDER BY n.name`,
      [symbolId]
    )
    return rows.map(this.normalizeNodeRow)
  }

  /**
   * Get symbols that the given symbol calls (outgoing calls).
   */
  async getCallees(symbolId) {
    if (!this.db) return []
    const rows = await this.runSelect(
      `SELECT n.id, n.name, n.kind, n.file_path, n.start_line, n.signature, e.kind as edgeKind
       FROM edges e JOIN nodes n ON e.target = n.id
       WHERE e.source = ? AND e.kind = 'calls'
       ORDER BY n.name`,
      [symbolId]
    )
    return rows.map(this.normalizeNodeRow)
  }

  /**
   * Get all relationships for a symbol (both directions, all edge kinds).
   */
  async getRelationships(symbolId) {
    if (!this.db) return { incoming: [], outgoing: [] }

    const [incoming, outgoing] = await Promise.all([
      this.runSelect(
        `SELECT n.id, n.name, n.kind as nodeKind, n.file_path, n.start_line, e.kind as edgeKind
         FROM edges e JOIN nodes n ON e.source = n.id
         WHERE e.target = ?
         ORDER BY e.kind, n.name`,
        [symbolId]
      ),
      this.runSelect(
        `SELECT n.id, n.name, n.kind as nodeKind, n.file_path, n.start_line, e.kind as edgeKind
         FROM edges e JOIN nodes n ON e.target = n.id
         WHERE e.source = ?
         ORDER BY e.kind, n.name`,
        [symbolId]
      ),
    ])

    return {
      incoming: incoming.map(this.normalizeNodeRow),
      outgoing: outgoing.map(this.normalizeNodeRow),
    }
  }

  /**
   * BFS-based impact analysis: finds all symbols reachable from the given symbol.
   */
  async getImpact(symbolId, maxDepth = 3) {
    if (!this.db) return { affected: [], totalAffected: 0, maxDepthReached: false, analyzedDepth: 0 }

    const visited = new Set()
    const affected = []
    let currentLevel = [symbolId]
    let depth = 0

    while (currentLevel.length > 0 && depth < maxDepth) {
      depth++
      const nextLevel = []

      for (const nodeId of currentLevel) {
        if (visited.has(nodeId)) continue
        visited.add(nodeId)

        const dependents = await this.runSelect(
          `SELECT DISTINCT e.source as id, n.name, n.kind, n.file_path, n.start_line, e.kind as edgeKind
           FROM edges e JOIN nodes n ON e.source = n.id
           WHERE e.target = ? AND e.source != ?`,
          [nodeId, symbolId]
        )

        for (const dep of dependents) {
          if (!visited.has(dep.id)) {
            affected.push({ ...this.normalizeNodeRow(dep), depth })
            nextLevel.push(dep.id)
          }
        }
      }

      currentLevel = nextLevel
    }

    return {
      affected,
      totalAffected: affected.length,
      maxDepthReached: currentLevel.length > 0,
      analyzedDepth: depth,
    }
  }

  /**
   * Normalize a node row from the database to use consistent API field names.
   * Maps file_path -> file, start_line -> line, start_column -> column.
   */
  normalizeNodeRow(row) {
    if (!row) return row
    return {
      ...row,
      file: row.file_path || row.file,
      line: row.start_line || row.line,
      column: row.start_column || row.column,
    }
  }

  /**
   * Switch to a different project's CodeGraph database.
   * @param {string} projectRoot - Absolute path to the project directory
   */
  async switchProject(projectRoot) {
    await this.teardown()
    this.projectRoot = projectRoot
    this.dbPath = path.join(projectRoot, '.codegraph', 'codegraph.db')
    await this.setup()
    return this.getStatus()
  }

  /**
   * Close and reopen the database to pick up changes from a re-index.
   */
  async refresh() {
    await this.teardown()
    await this.setup()
    return this.getStatus()
  }

  getEmptyStatus() {
    return {
      totalNodes: 0,
      totalEdges: 0,
      filesIndexed: 0,
      nodesByKind: {},
      edgesByKind: {},
      isAvailable: false,
      dbPath: this.dbPath,
    }
  }

  arrayToRecord(rows) {
    const record = {}
    for (const row of rows) {
      record[row.kind] = row.count
    }
    return record
  }
}

export default CodeGraphDatabaseService
