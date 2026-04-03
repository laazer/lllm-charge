import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { mkdir } from 'fs/promises';

export interface FlowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  data: any; // Node-specific configuration
  parameters?: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: any;
}

export interface FlowRecord {
  id: string;
  name: string;
  description?: string;
  type: 'workflow' | 'agent_flow' | 'data_pipeline' | 'automation';
  category: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  settings: {
    autoStart: boolean;
    retryPolicy: {
      enabled: boolean;
      maxRetries: number;
      retryDelay: number;
    };
    errorHandling: 'stop' | 'continue' | 'retry';
    timeout: number;
    concurrency: number;
  };
  triggers: {
    type: 'manual' | 'schedule' | 'webhook' | 'event';
    config: any;
  }[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  tags: string[];
  metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastExecuted?: string;
    totalCost: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface FlowExecution {
  id: string;
  flowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  triggeredBy: string;
  input?: any;
  output?: any;
  error?: string;
  stepResults: Record<string, any>; // Results from each node execution
  cost: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    tokens: number;
    apiCalls: number;
  };
}

export class FlowDatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  
  constructor() {
    // Use environment variable or default path
    this.dbPath = process.env.FLOWS_DATABASE_PATH || './data/flows.db';
  }

  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    await mkdir(dir, { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Failed to connect to flows database:', err);
          reject(err);
          return;
        }
        
        console.log('✅ Connected to independent flows database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createFlowsTable = `
      CREATE TABLE IF NOT EXISTS flows (
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
      )
    `;

    const createFlowExecutionsTable = `
      CREATE TABLE IF NOT EXISTS flow_executions (
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
      )
    `;

    const createFlowTemplatesTable = `
      CREATE TABLE IF NOT EXISTS flow_templates (
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
      )
    `;

    const createFlowVersionsTable = `
      CREATE TABLE IF NOT EXISTS flow_versions (
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
      )
    `;

    const createFlowSchedulesTable = `
      CREATE TABLE IF NOT EXISTS flow_schedules (
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
      )
    `;

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(createFlowsTable);
        this.db!.run(createFlowExecutionsTable);
        this.db!.run(createFlowTemplatesTable);
        this.db!.run(createFlowVersionsTable);
        this.db!.run(createFlowSchedulesTable, (err) => {
          if (err) {
            console.error('Failed to create flow tables:', err);
            reject(err);
          } else {
            console.log('✅ Flow database tables created successfully');
            resolve();
          }
        });
      });
    });
  }

  async createFlow(flow: Omit<FlowRecord, 'createdAt' | 'updatedAt'>): Promise<FlowRecord> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const flowWithTimestamps = {
      ...flow,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO flows (id, name, description, type, category, nodes, edges, settings, triggers, status, version, tags, metrics, createdAt, updatedAt, createdBy, lastModifiedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        flow.id,
        flow.name,
        flow.description,
        flow.type,
        flow.category,
        JSON.stringify(flow.nodes),
        JSON.stringify(flow.edges),
        JSON.stringify(flow.settings),
        JSON.stringify(flow.triggers),
        flow.status,
        flow.version,
        JSON.stringify(flow.tags),
        JSON.stringify(flow.metrics),
        flowWithTimestamps.createdAt,
        flowWithTimestamps.updatedAt,
        flow.createdBy,
        flow.lastModifiedBy
      );

      stmt.finalize((err) => {
        if (err) {
          console.error('Failed to create flow:', err);
          reject(err);
        } else {
          console.log(`✅ Flow created: ${flow.name} (${flow.id})`);
          resolve(flowWithTimestamps);
        }
      });
    });
  }

  async getFlow(id: string): Promise<FlowRecord | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM flows WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) {
            console.error('Failed to get flow:', err);
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          resolve({
            ...row,
            nodes: JSON.parse(row.nodes),
            edges: JSON.parse(row.edges),
            settings: JSON.parse(row.settings),
            triggers: JSON.parse(row.triggers),
            tags: JSON.parse(row.tags),
            metrics: JSON.parse(row.metrics)
          });
        }
      );
    });
  }

  async getAllFlows(): Promise<FlowRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM flows ORDER BY updatedAt DESC',
        (err, rows: any[]) => {
          if (err) {
            console.error('Failed to get all flows:', err);
            reject(err);
            return;
          }

          const flows = rows.map(row => ({
            ...row,
            nodes: JSON.parse(row.nodes),
            edges: JSON.parse(row.edges),
            settings: JSON.parse(row.settings || '{}'),
            triggers: JSON.parse(row.triggers || '[]'),
            tags: JSON.parse(row.tags || '[]'),
            metrics: JSON.parse(row.metrics || '{}')
          }));

          resolve(flows);
        }
      );
    });
  }

  async getFlowsByType(type: FlowRecord['type']): Promise<FlowRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM flows WHERE type = ? ORDER BY updatedAt DESC',
        [type],
        (err, rows: any[]) => {
          if (err) {
            console.error('Failed to get flows by type:', err);
            reject(err);
            return;
          }

          const flows = rows.map(row => ({
            ...row,
            nodes: JSON.parse(row.nodes),
            edges: JSON.parse(row.edges),
            settings: JSON.parse(row.settings || '{}'),
            triggers: JSON.parse(row.triggers || '[]'),
            tags: JSON.parse(row.tags || '[]'),
            metrics: JSON.parse(row.metrics || '{}')
          }));

          resolve(flows);
        }
      );
    });
  }

  async updateFlow(id: string, updates: Partial<FlowRecord>): Promise<void> {
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
        `UPDATE flows SET ${updateFields.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            console.error('Failed to update flow:', err);
            reject(err);
          } else {
            console.log(`✅ Flow updated: ${id}`);
            resolve();
          }
        }
      );
    });
  }

  async deleteFlow(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        'DELETE FROM flows WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            console.error('Failed to delete flow:', err);
            reject(err);
          } else {
            console.log(`✅ Flow deleted: ${id}`);
            resolve();
          }
        }
      );
    });
  }

  async createExecution(execution: Omit<FlowExecution, 'startedAt'>): Promise<FlowExecution> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const executionWithTimestamp = {
      ...execution,
      startedAt: now
    };

    return new Promise((resolve, reject) => {
      const stmt = this.db!.prepare(`
        INSERT INTO flow_executions (id, flowId, status, startedAt, triggeredBy, input, stepResults, cost, resourceUsage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        execution.id,
        execution.flowId,
        execution.status,
        executionWithTimestamp.startedAt,
        execution.triggeredBy,
        JSON.stringify(execution.input),
        JSON.stringify(execution.stepResults),
        execution.cost,
        JSON.stringify(execution.resourceUsage)
      );

      stmt.finalize((err) => {
        if (err) {
          console.error('Failed to create flow execution:', err);
          reject(err);
        } else {
          console.log(`✅ Flow execution created: ${execution.id}`);
          resolve(executionWithTimestamp);
        }
      });
    });
  }

  async getFlowStats(): Promise<{
    total: number;
    active: number;
    draft: number;
    paused: number;
    archived: number;
    byType: Record<string, number>;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        let stats = {
          total: 0,
          active: 0,
          draft: 0,
          paused: 0,
          archived: 0,
          byType: {} as Record<string, number>,
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          avgExecutionTime: 0
        };

        // Get basic counts
        this.db!.get('SELECT COUNT(*) as count FROM flows', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.total = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM flows WHERE status = "active"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.active = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM flows WHERE status = "draft"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.draft = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM flows WHERE status = "paused"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.paused = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM flows WHERE status = "archived"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.archived = row.count;
        });

        // Get type distribution
        this.db!.all('SELECT type, COUNT(*) as count FROM flows GROUP BY type', (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }
          rows.forEach(row => {
            stats.byType[row.type] = row.count;
          });
        });

        // Get execution stats
        this.db!.get('SELECT COUNT(*) as count FROM flow_executions', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.totalExecutions = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM flow_executions WHERE status = "completed"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.successfulExecutions = row.count;
        });

        this.db!.get('SELECT COUNT(*) as count FROM flow_executions WHERE status = "failed"', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.failedExecutions = row.count;
        });

        this.db!.get('SELECT AVG(duration) as avgDuration FROM flow_executions WHERE duration IS NOT NULL', (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          stats.avgExecutionTime = row.avgDuration || 0;

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
          console.error('Error closing flows database:', err);
        } else {
          console.log('✅ Flows database connection closed');
        }
        resolve();
      });
    });
  }
}