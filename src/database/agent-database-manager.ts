import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { mkdir } from 'fs/promises';

export interface AgentRecord {
  id: string;
  name: string;
  description: string;
  primaryRole: string;
  capabilities: {
    reasoning: number;
    creativity: number;
    technical: number;
    communication: number;
  };
  type: 'general' | 'specialist' | 'coordinator' | 'executor';
  model: {
    provider: string;
    modelName: string;
    temperature: number;
    maxTokens?: number;
    systemPrompt: string;
  };
  personality: {
    traits: string[];
    communicationStyle: 'formal' | 'casual' | 'technical' | 'creative';
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    decisionMaking: 'analytical' | 'intuitive' | 'collaborative';
  };
  constraints: {
    maxConcurrentTasks: number;
    maxExecutionTime: number;
    allowedOperations: string[];
    blockedOperations: string[];
    resourceLimits: {
      maxMemory: string;
      maxCpuTime: number;
      maxApiCalls: number;
    };
  };
  metrics: {
    successRate: number;
    averageExecutionTime: number;
    totalTasks: number;
    costEfficiency: number;
    userSatisfaction: number;
  };
  createdAt: string;
  updatedAt: string;
  version: number;
  status: 'active' | 'inactive' | 'learning' | 'error';
}

export class AgentDatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  
  constructor() {
    // Use environment variable or default path
    this.dbPath = process.env.AGENTS_DATABASE_PATH || './data/agents.db';
  }

  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    await mkdir(dir, { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Failed to connect to agents database:', err);
          reject(err);
          return;
        }
        
        console.log('✅ Connected to independent agents database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createAgentsTable = `
      CREATE TABLE IF NOT EXISTS agents (
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
      )
    `;

    const createAgentTasksTable = `
      CREATE TABLE IF NOT EXISTS agent_tasks (
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
      )
    `;

    const createAgentLearningTable = `
      CREATE TABLE IF NOT EXISTS agent_learning (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        context TEXT NOT NULL, -- What was the situation/input
        action TEXT NOT NULL, -- What action was taken
        outcome TEXT NOT NULL, -- What was the result
        feedback TEXT, -- External feedback if any
        success BOOLEAN,
        confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE
      )
    `;

    const createAgentCollaborationsTable = `
      CREATE TABLE IF NOT EXISTS agent_collaborations (
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
      )
    `;

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(createAgentsTable);
        this.db!.run(createAgentTasksTable);
        this.db!.run(createAgentLearningTable);
        this.db!.run(createAgentCollaborationsTable, (err) => {
          if (err) {
            console.error('Failed to create agent tables:', err);
            reject(err);
          } else {
            console.log('✅ Agent database tables created successfully');
            resolve();
          }
        });
      });
    });
  }

  async createAgent(agent: Omit<AgentRecord, 'createdAt' | 'updatedAt'>): Promise<AgentRecord> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const agentWithTimestamps = {
      ...agent,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO agents (id, name, description, primaryRole, capabilities, type, model, personality, constraints, metrics, createdAt, updatedAt, version, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        agent.id,
        agent.name,
        agent.description,
        agent.primaryRole,
        JSON.stringify(agent.capabilities),
        agent.type,
        JSON.stringify(agent.model),
        JSON.stringify(agent.personality),
        JSON.stringify(agent.constraints),
        JSON.stringify(agent.metrics),
        agentWithTimestamps.createdAt,
        agentWithTimestamps.updatedAt,
        agent.version,
        agent.status
      );

      stmt.finalize((err) => {
        if (err) {
          console.error('Failed to create agent:', err);
          reject(err);
        } else {
          console.log(`✅ Agent created: ${agent.name} (${agent.id})`);
          resolve(agentWithTimestamps);
        }
      });
    });
  }

  async getAgent(id: string): Promise<AgentRecord | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM agents WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) {
            console.error('Failed to get agent:', err);
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          resolve({
            ...row,
            capabilities: JSON.parse(row.capabilities),
            model: JSON.parse(row.model),
            personality: JSON.parse(row.personality),
            constraints: JSON.parse(row.constraints),
            metrics: JSON.parse(row.metrics)
          });
        }
      );
    });
  }

  async getAllAgents(): Promise<AgentRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM agents ORDER BY createdAt DESC',
        (err, rows: any[]) => {
          if (err) {
            console.error('Failed to get all agents:', err);
            reject(err);
            return;
          }

          const agents = rows.map(row => ({
            ...row,
            capabilities: JSON.parse(row.capabilities),
            model: JSON.parse(row.model),
            personality: JSON.parse(row.personality),
            constraints: JSON.parse(row.constraints),
            metrics: JSON.parse(row.metrics)
          }));

          resolve(agents);
        }
      );
    });
  }

  async updateAgent(id: string, updates: Partial<AgentRecord>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const updateFields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        updateFields.push(`${key} = ?`);
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    });

    updateFields.push('updatedAt = ?');
    values.push(now, id);

    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE agents SET ${updateFields.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            console.error('Failed to update agent:', err);
            reject(err);
          } else {
            console.log(`✅ Agent updated: ${id}`);
            resolve();
          }
        }
      );
    });
  }

  async deleteAgent(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        'DELETE FROM agents WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            console.error('Failed to delete agent:', err);
            reject(err);
          } else {
            console.log(`✅ Agent deleted: ${id}`);
            resolve();
          }
        }
      );
    });
  }

  async getAgentsByType(type: AgentRecord['type']): Promise<AgentRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM agents WHERE type = ? ORDER BY createdAt DESC',
        [type],
        (err, rows: any[]) => {
          if (err) {
            console.error('Failed to get agents by type:', err);
            reject(err);
            return;
          }

          const agents = rows.map(row => ({
            ...row,
            capabilities: JSON.parse(row.capabilities),
            model: JSON.parse(row.model),
            personality: JSON.parse(row.personality),
            constraints: JSON.parse(row.constraints),
            metrics: JSON.parse(row.metrics)
          }));

          resolve(agents);
        }
      );
    });
  }

  async getAgentStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byType: Record<string, number>;
    avgSuccessRate: number;
    totalTasks: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        let stats = {
          total: 0,
          active: 0,
          inactive: 0,
          byType: {} as Record<string, number>,
          avgSuccessRate: 0,
          totalTasks: 0
        };

        // Get basic counts
        this.db!.get('SELECT COUNT(*) as count FROM agents', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.total = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM agents WHERE status = "active"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.active = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM agents WHERE status != "active"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.inactive = row.count;
        });

        // Get type distribution
        this.db!.all('SELECT type, COUNT(*) as count FROM agents GROUP BY type', (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          rows.forEach(row => {
            stats.byType[row.type] = row.count;
          });
        });

        // Get performance metrics
        this.db!.all('SELECT metrics FROM agents', (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          let totalSuccessRate = 0;
          let totalTaskCount = 0;

          rows.forEach(row => {
            const metrics = JSON.parse(row.metrics);
            totalSuccessRate += metrics.successRate || 0;
            totalTaskCount += metrics.totalTasks || 0;
          });

          stats.avgSuccessRate = rows.length > 0 ? totalSuccessRate / rows.length : 0;
          stats.totalTasks = totalTaskCount;

          resolve(stats);
        });
      });
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      this.db!.close((err) => {
        if (err) {
          console.error('Error closing agents database:', err);
        } else {
          console.log('✅ Agents database connection closed');
        }
        resolve();
      });
    });
  }
}