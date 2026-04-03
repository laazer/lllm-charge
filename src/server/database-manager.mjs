import sqlite3 from 'sqlite3'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class DatabaseManager {
  constructor(dbPath = './data/llm-charge.db') {
    this.dbPath = dbPath
    this.db = null
    this.isReady = false
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath)
      await fs.mkdir(dataDir, { recursive: true })

      // Open database connection
      this.db = new sqlite3.Database(this.dbPath)
      
      // Initialize tables
      await this.createTables()
      
      this.isReady = true
      console.log('✅ Database initialized at:', this.dbPath)
      
      return true
    } catch (error) {
      console.error('❌ Database initialization failed:', error)
      return false
    }
  }

  async createTables() {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        lead TEXT,
        type TEXT DEFAULT 'software',
        codeGraphPath TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT -- JSON data for additional fields
      )`,
      
      `CREATE TABLE IF NOT EXISTS specs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'draft',
        priority TEXT DEFAULT 'medium',
        projectId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT, -- JSON data for linkedClasses, methods, tests, tags, etc.
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        primaryRole TEXT,
        projectId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT, -- JSON data for capabilities and other fields
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        projectId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT, -- JSON data for linkedFiles, linkedNotes, tags
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        projectId TEXT,
        filePath TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT, -- JSON data for checkpoint details
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'draft',
        projectId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT, -- JSON workflow data
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS request_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT,
        method TEXT,
        responseTime INTEGER,
        statusCode INTEGER,
        success BOOLEAN,
        costSaved REAL DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS project_analysis (
        projectId TEXT PRIMARY KEY,
        lastAnalyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
        analysisData TEXT, -- JSON analysis results
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )`
    ]

    for (const query of tableQueries) {
      await this.run(query)
    }
  }

  // Helper method to promisify database operations
  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(error) {
        if (error) reject(error)
        else resolve({ id: this.lastID, changes: this.changes })
      })
    })
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (error, row) => {
        if (error) reject(error)
        else resolve(row)
      })
    })
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (error, rows) => {
        if (error) reject(error)
        else resolve(rows || [])
      })
    })
  }

  // Project operations
  async createProject(project) {
    const { id, key, name, description, lead, type, codeGraphPath, ...additionalData } = project
    
    const result = await this.run(
      `INSERT INTO projects (id, key, name, description, lead, type, codeGraphPath, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, key, name, description, lead, type || 'software', codeGraphPath, JSON.stringify(additionalData)]
    )
    
    return this.getProject(id)
  }

  async getProject(id) {
    const row = await this.get('SELECT * FROM projects WHERE id = ?', [id])
    return row ? this.deserializeProject(row) : null
  }

  async getAllProjects() {
    const rows = await this.all('SELECT * FROM projects ORDER BY updatedAt DESC')
    return rows.map(row => this.deserializeProject(row))
  }

  async updateProject(id, updates) {
    const { key, name, description, lead, type, codeGraphPath, ...additionalData } = updates
    
    await this.run(
      `UPDATE projects 
       SET key = ?, name = ?, description = ?, lead = ?, type = ?, codeGraphPath = ?, 
           data = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [key, name, description, lead, type, codeGraphPath, JSON.stringify(additionalData), id]
    )
    
    return this.getProject(id)
  }

  async deleteProject(id) {
    const result = await this.run('DELETE FROM projects WHERE id = ?', [id])
    return result.changes > 0
  }

  deserializeProject(row) {
    const { data, ...baseFields } = row
    const additionalData = data ? JSON.parse(data) : {}
    return { ...baseFields, ...additionalData }
  }

  // Spec operations
  async createSpec(spec) {
    const { id, title, description, status, priority, projectId, ...additionalData } = spec
    
    await this.run(
      `INSERT INTO specs (id, title, description, status, priority, projectId, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, status || 'draft', priority || 'medium', projectId, JSON.stringify(additionalData)]
    )
    
    return this.getSpec(id)
  }

  async getSpec(id) {
    const row = await this.get('SELECT * FROM specs WHERE id = ?', [id])
    return row ? this.deserializeSpec(row) : null
  }

  async getAllSpecs() {
    const rows = await this.all('SELECT * FROM specs ORDER BY updatedAt DESC')
    return rows.map(row => this.deserializeSpec(row))
  }

  async updateSpec(id, updates) {
    const { title, description, status, priority, projectId, ...additionalData } = updates
    
    await this.run(
      `UPDATE specs 
       SET title = ?, description = ?, status = ?, priority = ?, projectId = ?, 
           data = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, description, status, priority, projectId, JSON.stringify(additionalData), id]
    )
    
    return this.getSpec(id)
  }

  async deleteSpec(id) {
    const result = await this.run('DELETE FROM specs WHERE id = ?', [id])
    return result.changes > 0
  }

  deserializeSpec(row) {
    const { data, ...baseFields } = row
    const additionalData = data ? JSON.parse(data) : {}
    return { ...baseFields, ...additionalData }
  }

  // Agent operations
  async createAgent(agent) {
    const { id, name, description, primaryRole, projectId, ...additionalData } = agent
    
    await this.run(
      `INSERT INTO agents (id, name, description, primaryRole, projectId, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, description, primaryRole, projectId, JSON.stringify(additionalData)]
    )
    
    return this.getAgent(id)
  }

  async getAgent(id) {
    const row = await this.get('SELECT * FROM agents WHERE id = ?', [id])
    return row ? this.deserializeAgent(row) : null
  }

  async getAllAgents() {
    const rows = await this.all('SELECT * FROM agents ORDER BY updatedAt DESC')
    return rows.map(row => this.deserializeAgent(row))
  }

  async updateAgent(id, updates) {
    const { name, description, primaryRole, projectId, ...additionalData } = updates
    
    await this.run(
      `UPDATE agents 
       SET name = ?, description = ?, primaryRole = ?, projectId = ?, 
           data = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description, primaryRole, projectId, JSON.stringify(additionalData), id]
    )
    
    return this.getAgent(id)
  }

  async deleteAgent(id) {
    const result = await this.run('DELETE FROM agents WHERE id = ?', [id])
    return result.changes > 0
  }

  deserializeAgent(row) {
    const { data, ...baseFields } = row
    const additionalData = data ? JSON.parse(data) : {}
    return { ...baseFields, ...additionalData }
  }

  // Note operations  
  async createNote(note) {
    const { id, title, content, projectId, ...additionalData } = note
    
    await this.run(
      `INSERT INTO notes (id, title, content, projectId, data)
       VALUES (?, ?, ?, ?, ?)`,
      [id, title, content, projectId, JSON.stringify(additionalData)]
    )
    
    return this.getNote(id)
  }

  async getNote(id) {
    const row = await this.get('SELECT * FROM notes WHERE id = ?', [id])
    return row ? this.deserializeNote(row) : null
  }

  async getAllNotes() {
    const rows = await this.all('SELECT * FROM notes ORDER BY updatedAt DESC')
    return rows.map(row => this.deserializeNote(row))
  }

  async updateNote(id, updates) {
    const { title, content, projectId, ...additionalData } = updates
    
    await this.run(
      `UPDATE notes 
       SET title = ?, content = ?, projectId = ?, 
           data = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, content, projectId, JSON.stringify(additionalData), id]
    )
    
    return this.getNote(id)
  }

  async deleteNote(id) {
    const result = await this.run('DELETE FROM notes WHERE id = ?', [id])
    return result.changes > 0
  }

  deserializeNote(row) {
    const { data, ...baseFields } = row
    const additionalData = data ? JSON.parse(data) : {}
    return { ...baseFields, ...additionalData }
  }

  // Request metrics operations
  async logRequest(endpoint, method, responseTime, statusCode, success, costSaved = 0) {
    await this.run(
      `INSERT INTO request_metrics (endpoint, method, responseTime, statusCode, success, costSaved)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [endpoint, method, responseTime, statusCode, success, costSaved]
    )
  }

  async getRequestMetrics(since = null) {
    let query = 'SELECT * FROM request_metrics'
    let params = []
    
    if (since) {
      query += ' WHERE timestamp >= ?'
      params.push(since)
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 1000'
    
    return this.all(query, params)
  }

  async getRequestStats() {
    const stats = await this.get(`
      SELECT 
        COUNT(*) as totalRequests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successfulRequests,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failedRequests,
        AVG(responseTime) as avgResponseTime,
        SUM(costSaved) as totalCostSaved
      FROM request_metrics
    `)
    
    return stats || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      totalCostSaved: 0
    }
  }

  // Project analysis operations
  async saveProjectAnalysis(projectId, analysisData) {
    await this.run(
      `INSERT OR REPLACE INTO project_analysis (projectId, analysisData)
       VALUES (?, ?)`,
      [projectId, JSON.stringify(analysisData)]
    )
  }

  async getProjectAnalysis(projectId) {
    const row = await this.get('SELECT * FROM project_analysis WHERE projectId = ?', [projectId])
    return row ? { ...row, analysisData: JSON.parse(row.analysisData) } : null
  }

  // Checkpoint operations
  async createCheckpoint(checkpoint) {
    const { id, title, description, projectId, filePath, ...additionalData } = checkpoint
    const result = await this.run(
      `INSERT INTO checkpoints (id, title, description, projectId, filePath, data, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, projectId || null, filePath || null, JSON.stringify(additionalData), new Date().toISOString()]
    )
    return this.getCheckpoint(id)
  }

  async getCheckpoint(id) {
    const row = await this.get('SELECT * FROM checkpoints WHERE id = ?', [id])
    return row ? this.deserializeCheckpoint(row) : null
  }

  async getAllCheckpoints() {
    const rows = await this.all('SELECT * FROM checkpoints ORDER BY createdAt DESC')
    return rows.map(row => this.deserializeCheckpoint(row))
  }

  async updateCheckpoint(id, updates) {
    const { title, description, projectId, filePath, ...additionalData } = updates
    
    await this.run(
      `UPDATE checkpoints 
       SET title = ?, description = ?, projectId = ?, filePath = ?, data = ?
       WHERE id = ?`,
      [title, description, projectId, filePath, JSON.stringify(additionalData), id]
    )
    
    return this.getCheckpoint(id)
  }

  async deleteCheckpoint(id) {
    await this.run('DELETE FROM checkpoints WHERE id = ?', [id])
    return true
  }

  deserializeCheckpoint(row) {
    if (!row) return null
    const data = JSON.parse(row.data || '{}')
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      projectId: row.projectId,
      filePath: row.filePath,
      createdAt: row.createdAt,
      ...data
    }
  }

  // Project-scoped query methods
  async getProjectSpecs(projectId) {
    const rows = await this.all('SELECT * FROM specs WHERE projectId = ? ORDER BY updatedAt DESC', [projectId])
    return rows.map(row => this.deserializeSpec(row))
  }

  async getProjectAgents(projectId) {
    const rows = await this.all('SELECT * FROM agents WHERE projectId = ? ORDER BY updatedAt DESC', [projectId])
    return rows.map(row => this.deserializeAgent(row))
  }

  async getProjectNotes(projectId) {
    const rows = await this.all('SELECT * FROM notes WHERE projectId = ? ORDER BY updatedAt DESC', [projectId])
    return rows.map(row => this.deserializeNote(row))
  }

  async getProjectCheckpoints(projectId) {
    const rows = await this.all('SELECT * FROM checkpoints WHERE projectId = ? ORDER BY createdAt DESC', [projectId])
    return rows.map(row => this.deserializeCheckpoint(row))
  }

  // Workflow operations
  async createWorkflow(workflow) {
    const { id, title, description, status, projectId, ...additionalData } = workflow
    
    await this.run(
      `INSERT INTO workflows (id, title, description, status, projectId, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, title, description, status || 'draft', projectId, JSON.stringify(additionalData)]
    )
    
    return this.getWorkflow(id)
  }

  async getWorkflow(id) {
    const row = await this.get('SELECT * FROM workflows WHERE id = ?', [id])
    return row ? this.deserializeWorkflow(row) : null
  }

  async getAllWorkflows() {
    const rows = await this.all('SELECT * FROM workflows ORDER BY updatedAt DESC')
    return rows.map(row => this.deserializeWorkflow(row))
  }

  async updateWorkflow(id, updates) {
    const { title, description, status, projectId, ...additionalData } = updates
    
    await this.run(
      `UPDATE workflows 
       SET title = ?, description = ?, status = ?, projectId = ?, 
           data = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, description, status, projectId, JSON.stringify(additionalData), id]
    )
    
    return this.getWorkflow(id)
  }

  async deleteWorkflow(id) {
    const result = await this.run('DELETE FROM workflows WHERE id = ?', [id])
    return result.changes > 0
  }

  async getProjectWorkflows(projectId) {
    const rows = await this.all('SELECT * FROM workflows WHERE projectId = ? ORDER BY updatedAt DESC', [projectId])
    return rows.map(row => this.deserializeWorkflow(row))
  }

  deserializeWorkflow(row) {
    const { data, ...baseFields } = row
    const additionalData = data ? JSON.parse(data) : {}
    return { ...baseFields, ...additionalData }
  }

  async close() {
    if (this.db) {
      await new Promise((resolve, reject) => {
        this.db.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
      this.db = null
      this.isReady = false
    }
  }
}

export default DatabaseManager