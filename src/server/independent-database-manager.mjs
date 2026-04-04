import sqlite3 from 'sqlite3'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Independent Database Manager - Uses separate databases for agents, flows, and projects
 * This follows the architecture specified in .env.production:
 * - AGENTS_DATABASE_PATH=./data/agents.db
 * - FLOWS_DATABASE_PATH=./data/flows.db  
 * - Main database for projects, specs, notes, checkpoints
 */
export class IndependentDatabaseManager {
  constructor() {
    // Main database for projects, specs, notes, checkpoints
    this.mainDbPath = process.env.DATABASE_PATH || './data/llm-charge.db'
    this.mainDb = null
    
    // Independent agent database  
    this.agentDbPath = process.env.AGENTS_DATABASE_PATH || './data/agents.db'
    this.agentDb = null
    
    // Independent flows database
    this.flowDbPath = process.env.FLOWS_DATABASE_PATH || './data/flows.db'
    this.flowDb = null
    
    this.isReady = false
  }

  async initialize() {
    try {
      console.log('🔄 Initializing independent database architecture...')
      
      // Initialize main database
      await this.initializeMainDatabase()
      
      // Initialize independent agent database
      await this.initializeAgentDatabase()
      
      // Initialize independent flows database  
      await this.initializeFlowDatabase()
      
      this.isReady = true
      console.log('✅ Independent database architecture initialized successfully')
      console.log(`   📊 Main DB: ${this.mainDbPath}`)
      console.log(`   🤖 Agent DB: ${this.agentDbPath}`)
      console.log(`   🔄 Flow DB: ${this.flowDbPath}`)
      
      return true
    } catch (error) {
      console.error('❌ Independent database initialization failed:', error)
      return false
    }
  }

  async initializeMainDatabase() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.mainDbPath)
    await fs.mkdir(dataDir, { recursive: true })

    // Open database connection
    this.mainDb = new sqlite3.Database(this.mainDbPath)
    
    // Initialize main database tables (projects, specs, notes, checkpoints)
    await this.createMainTables()
    await this.migrateSpecsTable()
    console.log('✅ Main database initialized')
  }

  async initializeAgentDatabase() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.agentDbPath)
    await fs.mkdir(dataDir, { recursive: true })

    // Open database connection
    this.agentDb = new sqlite3.Database(this.agentDbPath)
    
    // Initialize agent database tables
    await this.createAgentTables()
    console.log('✅ Independent agent database initialized')
  }

  async initializeFlowDatabase() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.flowDbPath)
    await fs.mkdir(dataDir, { recursive: true })

    // Open database connection
    this.flowDb = new sqlite3.Database(this.flowDbPath)
    
    // Initialize flow database tables
    await this.createFlowTables()
    console.log('✅ Independent flow database initialized')
  }

  async createMainTables() {
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
      
      `CREATE TABLE IF NOT EXISTS request_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        statusCode INTEGER,
        responseTime INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT -- JSON data for request details
      )`,

      `CREATE TABLE IF NOT EXISTS project_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projectId TEXT,
        analysisType TEXT,
        results TEXT, -- JSON analysis results
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES projects(id)
      )`,

      `CREATE TABLE IF NOT EXISTS reasoning_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        prompt TEXT,
        response TEXT,
        complexity TEXT,
        localAttempted INTEGER DEFAULT 0,
        localSuccess INTEGER DEFAULT 0,
        fallbackReason TEXT,
        provider TEXT,
        responseTime INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        tokensUsed INTEGER DEFAULT 0,
        data TEXT -- JSON for skillsUsed and other metadata
      )`,

      `CREATE TABLE IF NOT EXISTS buddies (
        id TEXT PRIMARY KEY,
        isActive INTEGER DEFAULT 1,
        projectId TEXT,
        conversationCount INTEGER DEFAULT 0,
        lastInteraction DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        config TEXT -- JSON: BuddyConfig (name, avatar, traits, expertise, etc.)
      )`,

      `CREATE TABLE IF NOT EXISTS buddy_messages (
        id TEXT PRIMARY KEY,
        buddyId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (buddyId) REFERENCES buddies(id) ON DELETE CASCADE
      )`
    ]

    for (const query of tableQueries) {
      await this.runQuery(this.mainDb, query)
    }
  }

  /**
   * Add type and parentId columns to specs table for tiered organization.
   * Safe to call multiple times — silently ignores if columns already exist.
   */
  async migrateSpecsTable() {
    const migrations = [
      "ALTER TABLE specs ADD COLUMN type TEXT DEFAULT 'spec'",
      "ALTER TABLE specs ADD COLUMN parentId TEXT",
    ]
    for (const sql of migrations) {
      try { await this.runQuery(this.mainDb, sql) } catch { /* column already exists */ }
    }
  }

  async createAgentTables() {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        primaryRole TEXT,
        capabilities TEXT, -- JSON
        type TEXT CHECK(type IN ('general', 'specialist', 'coordinator', 'executor')),
        model TEXT, -- JSON
        personality TEXT, -- JSON
        constraints TEXT, -- JSON
        metrics TEXT, -- JSON
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1,
        status TEXT CHECK(status IN ('active', 'inactive', 'learning', 'error')) DEFAULT 'active'
      )`,

      `CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        taskType TEXT NOT NULL,
        description TEXT,
        input TEXT, -- JSON
        output TEXT, -- JSON
        status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        startedAt DATETIME,
        completedAt DATETIME,
        executionTime INTEGER,
        cost REAL,
        errorMessage TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS agent_learning (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        context TEXT NOT NULL,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        feedback TEXT,
        success BOOLEAN,
        confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS agent_collaborations (
        id TEXT PRIMARY KEY,
        primaryAgentId TEXT NOT NULL,
        collaboratorAgentId TEXT NOT NULL,
        taskId TEXT,
        collaborationType TEXT CHECK(collaborationType IN ('delegation', 'consultation', 'coordination', 'knowledge_sharing')),
        success BOOLEAN,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (primaryAgentId) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (collaboratorAgentId) REFERENCES agents(id) ON DELETE CASCADE
      )`
    ]

    for (const query of tableQueries) {
      await this.runQuery(this.agentDb, query)
    }
  }

  async createFlowTables() {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT CHECK(type IN ('workflow', 'agent_flow', 'data_pipeline', 'automation')),
        category TEXT,
        nodes TEXT NOT NULL, -- JSON array of FlowNode
        edges TEXT NOT NULL, -- JSON array of FlowEdge
        settings TEXT, -- JSON FlowSettings
        triggers TEXT, -- JSON array of triggers
        status TEXT CHECK(status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
        version INTEGER DEFAULT 1,
        tags TEXT, -- JSON array of strings
        metrics TEXT, -- JSON FlowMetrics
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdBy TEXT,
        lastModifiedBy TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS flow_executions (
        id TEXT PRIMARY KEY,
        flowId TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
        startedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        completedAt DATETIME,
        duration INTEGER, -- milliseconds
        triggeredBy TEXT,
        input TEXT, -- JSON
        output TEXT, -- JSON  
        error TEXT,
        stepResults TEXT, -- JSON object with node results
        cost REAL DEFAULT 0,
        resourceUsage TEXT, -- JSON object with resource metrics
        FOREIGN KEY (flowId) REFERENCES flows(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS flow_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        templateData TEXT NOT NULL, -- JSON flow template
        tags TEXT, -- JSON array
        usageCount INTEGER DEFAULT 0,
        rating REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS flow_versions (
        id TEXT PRIMARY KEY,
        flowId TEXT NOT NULL,
        version INTEGER NOT NULL,
        name TEXT,
        description TEXT,
        nodes TEXT NOT NULL,
        edges TEXT NOT NULL,
        settings TEXT,
        changeLog TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdBy TEXT,
        FOREIGN KEY (flowId) REFERENCES flows(id) ON DELETE CASCADE,
        UNIQUE(flowId, version)
      )`,

      `CREATE TABLE IF NOT EXISTS flow_schedules (
        id TEXT PRIMARY KEY,
        flowId TEXT NOT NULL,
        name TEXT,
        cronExpression TEXT,
        timezone TEXT DEFAULT 'UTC',
        enabled BOOLEAN DEFAULT true,
        nextRun DATETIME,
        lastRun DATETIME,
        runCount INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flowId) REFERENCES flows(id) ON DELETE CASCADE
      )`
    ]

    for (const query of tableQueries) {
      await this.runQuery(this.flowDb, query)
    }
  }

  async runQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) {
          reject(err)
        } else {
          resolve(this)
        }
      })
    })
  }

  async runSelect(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  async runGet(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  // AGENTS API - Independent from projects
  async getAllAgents() {
    if (!this.agentDb) throw new Error('Agent database not initialized')
    
    const rows = await this.runSelect(this.agentDb, 'SELECT * FROM agents ORDER BY createdAt DESC')
    return rows.map(row => ({
      ...row,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : {},
      model: row.model ? JSON.parse(row.model) : {},
      personality: row.personality ? JSON.parse(row.personality) : {},
      constraints: row.constraints ? JSON.parse(row.constraints) : {},
      metrics: row.metrics ? JSON.parse(row.metrics) : {}
    }))
  }

  async getAgent(id) {
    if (!this.agentDb) throw new Error('Agent database not initialized')
    
    const rows = await this.runSelect(this.agentDb, 'SELECT * FROM agents WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) return null
    
    const row = rows[0]
    return {
      ...row,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : {},
      model: row.model ? JSON.parse(row.model) : {},
      personality: row.personality ? JSON.parse(row.personality) : {},
      constraints: row.constraints ? JSON.parse(row.constraints) : {},
      metrics: row.metrics ? JSON.parse(row.metrics) : {}
    }
  }

  async createAgent(agent) {
    if (!this.agentDb) throw new Error('Agent database not initialized')
    
    const query = `
      INSERT INTO agents (id, name, description, primaryRole, capabilities, type, model, personality, constraints, metrics, createdAt, updatedAt, version, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    const now = new Date().toISOString()
    const params = [
      agent.id,
      agent.name,
      agent.description,
      agent.primaryRole,
      JSON.stringify(agent.capabilities || {}),
      agent.type || 'general',
      JSON.stringify(agent.model || {}),
      JSON.stringify(agent.personality || {}),
      JSON.stringify(agent.constraints || {}),
      JSON.stringify(agent.metrics || {}),
      now,
      now,
      agent.version || 1,
      agent.status || 'active'
    ]

    await this.runQuery(this.agentDb, query, params)
    console.log(`✅ Independent agent created: ${agent.name}`)
    return { ...agent, createdAt: now, updatedAt: now }
  }

  async updateAgent(id, updates) {
    if (!this.agentDb) throw new Error('Agent database not initialized')
    
    const updateFields = []
    const values = []

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        updateFields.push(`${key} = ?`)
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value))
        } else {
          values.push(value)
        }
      }
    })

    updateFields.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)

    const query = `UPDATE agents SET ${updateFields.join(', ')} WHERE id = ?`
    await this.runQuery(this.agentDb, query, values)
    console.log(`✅ Independent agent updated: ${id}`)
    
    // Return the updated agent
    return await this.getAgent(id)
  }

  async deleteAgent(id) {
    if (!this.agentDb) throw new Error('Agent database not initialized')
    
    await this.runQuery(this.agentDb, 'DELETE FROM agents WHERE id = ?', [id])
    console.log(`✅ Independent agent deleted: ${id}`)
  }

  // FLOWS API - Independent from projects  
  async getAllFlows() {
    if (!this.flowDb) throw new Error('Flow database not initialized')
    
    const rows = await this.runSelect(this.flowDb, 'SELECT * FROM flows ORDER BY updatedAt DESC')
    return rows.map(row => ({
      ...row,
      nodes: row.nodes ? JSON.parse(row.nodes) : [],
      edges: row.edges ? JSON.parse(row.edges) : [],
      settings: row.settings ? JSON.parse(row.settings) : {},
      triggers: row.triggers ? JSON.parse(row.triggers) : [],
      tags: row.tags ? JSON.parse(row.tags) : [],
      metrics: row.metrics ? JSON.parse(row.metrics) : {}
    }))
  }

  async createFlow(flow) {
    if (!this.flowDb) throw new Error('Flow database not initialized')
    
    // Generate ID if not provided
    const flowId = flow.id || `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const query = `
      INSERT INTO flows (id, name, description, type, category, nodes, edges, settings, triggers, status, version, tags, metrics, createdAt, updatedAt, createdBy, lastModifiedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    const now = new Date().toISOString()
    const params = [
      flowId,
      flow.name,
      flow.description,
      flow.type,
      flow.category,
      JSON.stringify(flow.nodes || []),
      JSON.stringify(flow.edges || []),
      JSON.stringify(flow.settings || {}),
      JSON.stringify(flow.triggers || []),
      flow.status || 'draft',
      flow.version || 1,
      JSON.stringify(flow.tags || []),
      JSON.stringify(flow.metrics || {}),
      now,
      now,
      flow.createdBy,
      flow.lastModifiedBy
    ]

    await this.runQuery(this.flowDb, query, params)
    console.log(`✅ Independent flow created: ${flow.name}`)
    return { ...flow, id: flowId, createdAt: now, updatedAt: now }
  }

  // WORKFLOW COMPATIBILITY LAYER - Maps workflow API calls to flow database
  async getAllWorkflows() {
    return this.getAllFlows()
  }

  async getWorkflow(id) {
    if (!this.flowDb) throw new Error('Flow database not initialized')
    
    const row = await this.runGet(this.flowDb, 'SELECT * FROM flows WHERE id = ?', [id])
    if (!row) return null
    
    return {
      ...row,
      nodes: row.nodes ? JSON.parse(row.nodes) : [],
      edges: row.edges ? JSON.parse(row.edges) : [],
      settings: row.settings ? JSON.parse(row.settings) : {},
      triggers: row.triggers ? JSON.parse(row.triggers) : [],
      tags: row.tags ? JSON.parse(row.tags) : [],
      metrics: row.metrics ? JSON.parse(row.metrics) : {}
    }
  }

  async createWorkflow(workflow) {
    // Generate ID if not provided
    const workflowId = workflow.id || `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Map workflow data to flow structure
    const flow = {
      id: workflowId,
      name: workflow.title || workflow.name, // workflows have 'title', flows have 'name'
      description: workflow.description || '',
      type: 'workflow',
      category: 'automation',
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
      settings: workflow.settings || {},
      triggers: workflow.triggers || [],
      status: workflow.status || 'draft',
      version: workflow.version || 1,
      tags: workflow.tags || [],
      metrics: workflow.metrics || {},
      createdBy: workflow.createdBy || 'system',
      lastModifiedBy: workflow.lastModifiedBy || 'system'
    }
    
    return this.createFlow(flow)
  }

  async updateWorkflow(id, updates) {
    if (!this.flowDb) throw new Error('Flow database not initialized')
    
    const updateFields = []
    const values = []

    // Map workflow fields to flow fields
    const fieldMapping = {
      'title': 'name',
      'description': 'description',
      'status': 'status',
      'nodes': 'nodes',
      'edges': 'edges',
      'settings': 'settings',
      'triggers': 'triggers',
      'tags': 'tags',
      'metrics': 'metrics'
    }

    Object.entries(updates).forEach(([key, value]) => {
      const mappedKey = fieldMapping[key] || key
      if (mappedKey !== 'id' && mappedKey !== 'createdAt') {
        updateFields.push(`${mappedKey} = ?`)
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value))
        } else {
          values.push(value)
        }
      }
    })

    updateFields.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)

    const query = `UPDATE flows SET ${updateFields.join(', ')} WHERE id = ?`
    await this.runQuery(this.flowDb, query, values)
    console.log(`✅ Workflow updated: ${id}`)
  }

  async deleteWorkflow(id) {
    if (!this.flowDb) throw new Error('Flow database not initialized')
    
    await this.runQuery(this.flowDb, 'DELETE FROM flows WHERE id = ?', [id])
    console.log(`✅ Workflow deleted: ${id}`)
  }

  // PROJECT-DEPENDENT APIs - Main database
  async getAllProjects() {
    if (!this.mainDb) throw new Error('Main database not initialized')
    
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM projects ORDER BY createdAt DESC')
    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : {}
    }))
  }

  async getProject(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM projects WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) return null
    const row = rows[0]
    return { ...row, data: row.data ? JSON.parse(row.data) : {} }
  }

  async createProject(project) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    
    const query = `
      INSERT INTO projects (id, key, name, description, lead, type, codeGraphPath, createdAt, updatedAt, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    const now = new Date().toISOString()
    const params = [
      project.id,
      project.key,
      project.name,
      project.description,
      project.lead,
      project.type || 'software',
      project.codeGraphPath,
      now,
      now,
      JSON.stringify(project.data || {})
    ]

    await this.runQuery(this.mainDb, query, params)
    console.log(`✅ Project created: ${project.name}`)
    return { ...project, createdAt: now, updatedAt: now }
  }

  async updateProject(id, updates) {
    if (!this.mainDb) throw new Error('Main database not initialized')

    const allowedFields = ['key', 'name', 'description', 'lead', 'type', 'codeGraphPath']
    const updateClauses = []
    const values = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateClauses.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (updates.data !== undefined) {
      updateClauses.push('data = ?')
      values.push(JSON.stringify(updates.data))
    }

    if (updateClauses.length === 0) return await this.getProject(id)

    updateClauses.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)

    const query = `UPDATE projects SET ${updateClauses.join(', ')} WHERE id = ?`
    await this.runQuery(this.mainDb, query, values)
    console.log(`✅ Project updated: ${id}`)
    return await this.getProject(id)
  }

  async deleteProject(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    await this.runQuery(this.mainDb, 'DELETE FROM projects WHERE id = ?', [id])
    console.log(`✅ Project deleted: ${id}`)
  }

  /**
   * Deserialize a spec row from the database, extracting JSON data fields to top level.
   */
  deserializeSpecRow(row) {
    const parsedData = row.data ? JSON.parse(row.data) : {}
    return {
      ...row,
      tags: parsedData.tags || [],
      linkedSymbols: parsedData.linkedSymbols || [],
      linkedClasses: parsedData.linkedClasses || [],
      linkedMethods: parsedData.linkedMethods || [],
      linkedTests: parsedData.linkedTests || [],
      comments: parsedData.comments || [],
      assignedAgent: parsedData.assignedAgent || null,
      data: parsedData
    }
  }

  async getAllSpecs() {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM specs ORDER BY createdAt DESC')
    return rows.map(row => this.deserializeSpecRow(row))
  }

  async getSpec(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM specs WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) return null
    return this.deserializeSpecRow(rows[0])
  }

  async getProjectSpecs(projectId) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM specs WHERE projectId = ? ORDER BY createdAt DESC', [projectId])
    return rows.map(row => this.deserializeSpecRow(row))
  }

  async getChildSpecs(parentId) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM specs WHERE parentId = ? ORDER BY createdAt ASC', [parentId])
    return rows.map(row => this.deserializeSpecRow(row))
  }

  async createSpec(spec) {
    if (!this.mainDb) throw new Error('Main database not initialized')

    const query = `
      INSERT INTO specs (id, title, description, status, priority, projectId, type, parentId, createdAt, updatedAt, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    const now = new Date().toISOString()
    const params = [
      spec.id,
      spec.title,
      spec.description,
      spec.status || 'draft',
      spec.priority || 'medium',
      spec.projectId || null,
      spec.type || 'spec',
      spec.parentId || null,
      now,
      now,
      JSON.stringify(spec.data || {})
    ]

    await this.runQuery(this.mainDb, query, params)
    console.log(`✅ Spec created: ${spec.title}`)
    return { ...spec, createdAt: now, updatedAt: now }
  }

  async updateSpec(id, updates) {
    if (!this.mainDb) throw new Error('Main database not initialized')

    const allowedFields = ['title', 'description', 'status', 'priority', 'projectId', 'type', 'parentId']
    const updateClauses = []
    const values = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateClauses.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (updates.data !== undefined) {
      updateClauses.push('data = ?')
      values.push(JSON.stringify(updates.data))
    }

    const dataFields = ['tags', 'linkedSymbols', 'linkedClasses', 'linkedMethods',
                        'linkedTests', 'assignedAgent', 'comments']
    const hasDataUpdates = dataFields.some(field => updates[field] !== undefined)

    if (hasDataUpdates) {
      const existingSpec = await this.getSpec(id)
      if (!existingSpec) throw new Error(`Spec not found: ${id}`)

      const mergedData = { ...existingSpec.data }
      for (const field of dataFields) {
        if (updates[field] !== undefined) mergedData[field] = updates[field]
      }

      updateClauses.push('data = ?')
      values.push(JSON.stringify(mergedData))
    }

    if (updateClauses.length === 0) return await this.getSpec(id)

    updateClauses.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)

    const query = `UPDATE specs SET ${updateClauses.join(', ')} WHERE id = ?`
    await this.runQuery(this.mainDb, query, values)
    console.log(`✅ Spec updated: ${id}`)
    return await this.getSpec(id)
  }

  async deleteSpec(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    await this.runQuery(this.mainDb, 'DELETE FROM specs WHERE id = ?', [id])
    console.log(`✅ Spec deleted: ${id}`)
  }

  async getAllNotes() {
    if (!this.mainDb) throw new Error('Main database not initialized')
    
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM notes ORDER BY createdAt DESC')
    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : {}
    }))
  }

  async createNote(note) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    
    const query = `
      INSERT INTO notes (id, title, content, projectId, createdAt, updatedAt, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    
    const now = new Date().toISOString()
    const params = [
      note.id,
      note.title,
      note.content,
      note.projectId,
      now,
      now,
      JSON.stringify(note.data || {})
    ]

    await this.runQuery(this.mainDb, query, params)
    console.log(`✅ Note created: ${note.title}`)
    return { ...note, createdAt: now, updatedAt: now }
  }

  async getNote(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM notes WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) return null
    const row = rows[0]
    return { ...row, data: row.data ? JSON.parse(row.data) : {} }
  }

  async updateNote(id, updates) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const allowedFields = ['title', 'content', 'projectId']
    const updateClauses = []
    const values = []
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateClauses.push(`${key} = ?`)
        values.push(value)
      }
    }
    if (updates.data !== undefined) {
      updateClauses.push('data = ?')
      values.push(JSON.stringify(updates.data))
    }
    if (updateClauses.length === 0) return await this.getNote(id)
    updateClauses.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)
    await this.runQuery(this.mainDb, `UPDATE notes SET ${updateClauses.join(', ')} WHERE id = ?`, values)
    return await this.getNote(id)
  }

  async deleteNote(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    await this.runQuery(this.mainDb, 'DELETE FROM notes WHERE id = ?', [id])
    console.log(`✅ Note deleted: ${id}`)
  }

  async getAllCheckpoints() {
    if (!this.mainDb) throw new Error('Main database not initialized')
    
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM checkpoints ORDER BY createdAt DESC')
    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : {}
    }))
  }

  async createCheckpoint(checkpoint) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    
    const query = `
      INSERT INTO checkpoints (id, title, description, projectId, filePath, createdAt, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    
    const now = new Date().toISOString()
    const params = [
      checkpoint.id,
      checkpoint.title,
      checkpoint.description,
      checkpoint.projectId,
      checkpoint.filePath,
      now,
      JSON.stringify(checkpoint.data || {})
    ]

    await this.runQuery(this.mainDb, query, params)
    console.log(`✅ Checkpoint created: ${checkpoint.title}`)
    return { ...checkpoint, createdAt: now }
  }

  // REASONING LOGS API
  async addReasoningLog(logEntry) {
    if (!this.mainDb) throw new Error('Main database not initialized')

    const query = `
      INSERT INTO reasoning_logs (timestamp, prompt, response, complexity, localAttempted, localSuccess, fallbackReason, provider, responseTime, cost, tokensUsed, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const params = [
      logEntry.timestamp || new Date().toISOString(),
      logEntry.prompt || '',
      logEntry.response || '',
      logEntry.complexity || 'simple',
      logEntry.localAttempted ? 1 : 0,
      logEntry.localSuccess ? 1 : 0,
      logEntry.fallbackReason || null,
      logEntry.provider || 'unknown',
      logEntry.responseTime || 0,
      logEntry.cost || 0,
      logEntry.tokensUsed || 0,
      JSON.stringify({ skillsUsed: logEntry.skillsUsed || [], ...logEntry.metadata || {} }),
    ]

    await this.runQuery(this.mainDb, query, params)
  }

  async getReasoningLogs(limit = 100) {
    if (!this.mainDb) throw new Error('Main database not initialized')

    const rows = await this.runSelect(
      this.mainDb,
      'SELECT * FROM reasoning_logs ORDER BY timestamp DESC LIMIT ?',
      [limit]
    )
    return rows.map(row => ({
      ...row,
      localAttempted: !!row.localAttempted,
      localSuccess: !!row.localSuccess,
      skillsUsed: row.data ? (JSON.parse(row.data).skillsUsed || []) : [],
    }))
  }

  async getReasoningStats() {
    if (!this.mainDb) throw new Error('Main database not initialized')

    const totalResult = await this.runGet(this.mainDb, 'SELECT COUNT(*) as count FROM reasoning_logs')
    const localSuccessResult = await this.runGet(this.mainDb, 'SELECT COUNT(*) as count FROM reasoning_logs WHERE localSuccess = 1')
    const costResult = await this.runGet(this.mainDb, 'SELECT SUM(cost) as total, AVG(responseTime) as avgTime FROM reasoning_logs')

    const totalRequests = totalResult?.count || 0
    const localSuccesses = localSuccessResult?.count || 0
    const totalCost = costResult?.total || 0
    const avgResponseTime = Math.round(costResult?.avgTime || 0)

    const estimatedCloudCost = totalRequests * 0.02
    const totalSavings = Math.max(0, estimatedCloudCost - totalCost)
    const avgCostSavings = totalRequests > 0 ? (totalSavings / totalRequests * 100) : 0

    // Failure reasons
    const failureRows = await this.runSelect(
      this.mainDb,
      'SELECT fallbackReason, COUNT(*) as count FROM reasoning_logs WHERE fallbackReason IS NOT NULL GROUP BY fallbackReason'
    )
    const failureReasons = {}
    for (const row of failureRows) {
      failureReasons[row.fallbackReason] = row.count
    }

    // Provider usage
    const providerRows = await this.runSelect(
      this.mainDb,
      'SELECT provider, COUNT(*) as count FROM reasoning_logs GROUP BY provider'
    )
    const providerUsage = {}
    for (const row of providerRows) {
      providerUsage[row.provider] = row.count
    }

    return {
      totalRequests,
      localSuccessRate: totalRequests > 0 ? localSuccesses / totalRequests : 0,
      avgCostSavings,
      totalSavings,
      avgResponseTime,
      failureReasons,
      providerUsage,
      totalSkillInvocations: 0,
      skillUsageBreakdown: {},
    }
  }

  /**
   * Compute routing recommendations from historical reasoning data.
   * Returns success rates and avg response times per complexity level,
   * so the router can decide when local is good enough.
   */
  async getRoutingInsights() {
    if (!this.mainDb) return { byComplexity: {}, recommendation: 'preferLocal', sampleSize: 0 }

    const rows = await this.runSelect(this.mainDb, `
      SELECT
        complexity,
        COUNT(*) as total,
        SUM(CASE WHEN localSuccess = 1 THEN 1 ELSE 0 END) as localSuccesses,
        AVG(CASE WHEN localSuccess = 1 THEN responseTime END) as avgLocalTime,
        AVG(CASE WHEN localSuccess = 0 THEN responseTime END) as avgCloudTime,
        AVG(cost) as avgCost
      FROM reasoning_logs
      WHERE timestamp > datetime('now', '-7 days')
      GROUP BY complexity
    `)

    const byComplexity = {}
    let totalRequests = 0
    let totalLocalSuccesses = 0

    for (const row of rows) {
      totalRequests += row.total
      totalLocalSuccesses += row.localSuccesses
      byComplexity[row.complexity] = {
        total: row.total,
        localSuccessRate: row.total > 0 ? row.localSuccesses / row.total : 0,
        avgLocalTimeMs: Math.round(row.avgLocalTime || 0),
        avgCloudTimeMs: Math.round(row.avgCloudTime || 0),
        avgCost: row.avgCost || 0,
      }
    }

    const overallLocalRate = totalRequests > 0 ? totalLocalSuccesses / totalRequests : 0

    // Recommendation logic: if local succeeds >70% of the time, prefer it
    let recommendation = 'preferLocal'
    if (overallLocalRate < 0.3 && totalRequests > 10) {
      recommendation = 'preferCloud'
    } else if (overallLocalRate < 0.7 && totalRequests > 10) {
      recommendation = 'hybrid'
    }

    return { byComplexity, recommendation, sampleSize: totalRequests, overallLocalRate }
  }

  async getRequestStats() {
    try {
      // Get real request statistics from the database
      const totalQuery = `SELECT COUNT(*) as total FROM request_metrics`
      const successQuery = `SELECT COUNT(*) as successful FROM request_metrics WHERE statusCode >= 200 AND statusCode < 300`
      const avgTimeQuery = `SELECT AVG(responseTime) as avgTime FROM request_metrics WHERE responseTime IS NOT NULL`
      const lastRequestQuery = `SELECT * FROM request_metrics ORDER BY timestamp DESC LIMIT 1`

      const totalResult = await this.runGet(this.mainDb, totalQuery)
      const successResult = await this.runGet(this.mainDb, successQuery)
      const avgTimeResult = await this.runGet(this.mainDb, avgTimeQuery)
      const lastRequestResult = await this.runGet(this.mainDb, lastRequestQuery)

      const totalRequests = totalResult?.total || 0
      const successfulRequests = successResult?.successful || 0
      const failedRequests = totalRequests - successfulRequests
      const avgResponseTime = avgTimeResult?.avgTime || 0

      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        avgResponseTime: Math.round(avgResponseTime),
        lastRequest: lastRequestResult ? new Date(lastRequestResult.timestamp) : null
      }
    } catch (error) {
      console.warn('⚠️ Could not get request stats from database:', error)
      // Return zeros only as fallback when database query fails
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        lastRequest: null
      }
    }
  }

  // ========== BUDDY CRUD ==========

  async getAllBuddies(projectId = null) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const query = projectId
      ? 'SELECT * FROM buddies WHERE projectId = ? ORDER BY updatedAt DESC'
      : 'SELECT * FROM buddies ORDER BY updatedAt DESC'
    const params = projectId ? [projectId] : []
    const rows = await this.runSelect(this.mainDb, query, params)
    return rows.map(row => ({
      ...row,
      isActive: Boolean(row.isActive),
      config: row.config ? JSON.parse(row.config) : {}
    }))
  }

  async getBuddy(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(this.mainDb, 'SELECT * FROM buddies WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) return null
    const row = rows[0]
    return { ...row, isActive: Boolean(row.isActive), config: row.config ? JSON.parse(row.config) : {} }
  }

  async createBuddy(buddy) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const now = new Date().toISOString()
    const query = `
      INSERT INTO buddies (id, isActive, projectId, conversationCount, lastInteraction, createdAt, updatedAt, config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    const params = [
      buddy.id,
      buddy.isActive !== undefined ? (buddy.isActive ? 1 : 0) : 1,
      buddy.projectId || null,
      0,
      null,
      now,
      now,
      JSON.stringify(buddy.config || {})
    ]
    await this.runQuery(this.mainDb, query, params)
    console.log(`✅ Buddy created: ${buddy.config?.name || buddy.id}`)
    return await this.getBuddy(buddy.id)
  }

  async updateBuddy(id, updates) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const updateClauses = []
    const values = []

    if (updates.isActive !== undefined) {
      updateClauses.push('isActive = ?')
      values.push(updates.isActive ? 1 : 0)
    }
    if (updates.projectId !== undefined) {
      updateClauses.push('projectId = ?')
      values.push(updates.projectId)
    }
    if (updates.conversationCount !== undefined) {
      updateClauses.push('conversationCount = ?')
      values.push(updates.conversationCount)
    }
    if (updates.lastInteraction !== undefined) {
      updateClauses.push('lastInteraction = ?')
      values.push(updates.lastInteraction)
    }
    if (updates.config !== undefined) {
      updateClauses.push('config = ?')
      values.push(JSON.stringify(updates.config))
    }

    if (updateClauses.length === 0) return await this.getBuddy(id)

    updateClauses.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)

    const query = `UPDATE buddies SET ${updateClauses.join(', ')} WHERE id = ?`
    await this.runQuery(this.mainDb, query, values)
    console.log(`✅ Buddy updated: ${id}`)
    return await this.getBuddy(id)
  }

  async deleteBuddy(id) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    await this.runQuery(this.mainDb, 'DELETE FROM buddy_messages WHERE buddyId = ?', [id])
    await this.runQuery(this.mainDb, 'DELETE FROM buddies WHERE id = ?', [id])
    console.log(`✅ Buddy deleted: ${id}`)
  }

  async createBuddyMessage(message) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const now = new Date().toISOString()
    const messageId = message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const query = `
      INSERT INTO buddy_messages (id, buddyId, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    const params = [
      messageId,
      message.buddyId,
      message.role,
      message.content,
      now,
      message.metadata ? JSON.stringify(message.metadata) : null
    ]
    await this.runQuery(this.mainDb, query, params)

    // Update buddy's lastInteraction and conversationCount
    await this.runQuery(this.mainDb,
      'UPDATE buddies SET lastInteraction = ?, conversationCount = conversationCount + 1, updatedAt = ? WHERE id = ?',
      [now, now, message.buddyId]
    )

    return { id: messageId, ...message, timestamp: now }
  }

  async getBuddyMessages(buddyId, limit = 50) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    const rows = await this.runSelect(
      this.mainDb,
      'SELECT * FROM buddy_messages WHERE buddyId = ? ORDER BY timestamp ASC LIMIT ?',
      [buddyId, limit]
    )
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }))
  }

  async clearBuddyMessages(buddyId) {
    if (!this.mainDb) throw new Error('Main database not initialized')
    await this.runQuery(this.mainDb, 'DELETE FROM buddy_messages WHERE buddyId = ?', [buddyId])
    await this.runQuery(this.mainDb,
      'UPDATE buddies SET conversationCount = 0, updatedAt = ? WHERE id = ?',
      [new Date().toISOString(), buddyId]
    )
    console.log(`✅ Buddy messages cleared: ${buddyId}`)
  }

  async close() {
    const promises = []

    if (this.mainDb) {
      promises.push(new Promise(resolve => {
        this.mainDb.close(() => {
          console.log('✅ Main database closed')
          resolve()
        })
      }))
    }
    
    if (this.agentDb) {
      promises.push(new Promise(resolve => {
        this.agentDb.close(() => {
          console.log('✅ Agent database closed')
          resolve()
        })
      }))
    }
    
    if (this.flowDb) {
      promises.push(new Promise(resolve => {
        this.flowDb.close(() => {
          console.log('✅ Flow database closed')
          resolve()
        })
      }))
    }
    
    await Promise.all(promises)
    console.log('✅ All independent databases closed')
  }
}