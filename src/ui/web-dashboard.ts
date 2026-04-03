import { EventEmitter } from 'events'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

export const DashboardConfigSchema = z.object({
  port: z.number().default(3001),
  host: z.string().default('localhost'),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  style: z.enum(['liquid-glass', 'flat']).default('liquid-glass'),
  features: z.object({
    realTimeMetrics: z.boolean().default(true),
    agentStudio: z.boolean().default(true),
    projectManagement: z.boolean().default(true),
    memoryGraph: z.boolean().default(true),
    specManager: z.boolean().default(true),
    costAnalytics: z.boolean().default(true)
  }).default({}),
  security: z.object({
    enabled: z.boolean().default(false),
    jwtSecret: z.string().optional(),
    allowedOrigins: z.array(z.string()).default(['http://localhost:3001'])
  }).default({})
})

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>

export const WebSocketMessageSchema = z.object({
  type: z.enum(['metrics', 'agent_update', 'memory_update', 'project_update', 'notification']),
  data: z.any(),
  timestamp: z.date().default(() => new Date())
})

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>

export class WebDashboard extends EventEmitter {
  private config: DashboardConfig
  private server?: any
  private wsServer?: any
  private connections = new Set<any>()
  private metricsInterval?: NodeJS.Timeout
  private isRunning = false

  constructor(config: Partial<DashboardConfig> = {}) {
    super()
    this.config = DashboardConfigSchema.parse(config)
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Dashboard is already running')
    }

    await this.generateStaticAssets()
    await this.startHttpServer()
    await this.startWebSocketServer()
    this.startMetricsCollection()

    this.isRunning = true
    this.emit('dashboard:started', { port: this.config.port, host: this.config.host })
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    if (this.wsServer) {
      this.wsServer.close()
    }

    if (this.server) {
      this.server.close()
    }

    this.connections.clear()
    this.isRunning = false
    this.emit('dashboard:stopped')
  }

  broadcast(message: WebSocketMessage): void {
    const serialized = JSON.stringify(message)
    
    for (const connection of this.connections) {
      try {
        connection.send(serialized)
      } catch (error) {
        // Remove dead connections
        this.connections.delete(connection)
      }
    }
  }

  updateMetrics(metrics: any): void {
    this.broadcast({
      type: 'metrics',
      data: metrics,
      timestamp: new Date()
    })
  }

  notifyAgentUpdate(agentId: string, update: any): void {
    this.broadcast({
      type: 'agent_update',
      data: { agentId, ...update },
      timestamp: new Date()
    })
  }

  notifyMemoryUpdate(type: string, data: any): void {
    this.broadcast({
      type: 'memory_update',
      data: { type, ...data },
      timestamp: new Date()
    })
  }

  notifyProjectUpdate(projectId: string, update: any): void {
    this.broadcast({
      type: 'project_update',
      data: { projectId, ...update },
      timestamp: new Date()
    })
  }

  showNotification(level: 'info' | 'warning' | 'error' | 'success', message: string): void {
    this.broadcast({
      type: 'notification',
      data: { level, message },
      timestamp: new Date()
    })
  }

  private async generateStaticAssets(): Promise<void> {
    const assetsDir = path.join(process.cwd(), 'assets/dashboard')
    await fs.mkdir(assetsDir, { recursive: true })

    // Generate HTML
    await this.generateIndexHtml(assetsDir)
    
    // Generate CSS
    await this.generateStyles(assetsDir)
    
    // Generate JavaScript
    await this.generateClientScript(assetsDir)
  }

  private async generateIndexHtml(assetsDir: string): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM-Charge Dashboard</title>
    <link rel="stylesheet" href="/styles.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://unpkg.com/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body class="theme-${this.config.theme}">
    <div id="app">
        <header class="dashboard-header">
            <h1>🚀 LLM-Charge Dashboard</h1>
            <div class="header-controls">
                <button id="style-toggle" class="btn btn-secondary">✨ Style</button>
                <button id="theme-toggle" class="btn btn-secondary">🌓 Theme</button>
                <div class="connection-status" id="connection-status">
                    <span class="status-dot connected"></span>
                    Connected
                </div>
            </div>
        </header>

        <nav class="dashboard-nav">
            <button class="nav-btn active" data-view="overview">📊 Overview</button>
            ${this.config.features.realTimeMetrics ? '<button class="nav-btn" data-view="metrics">📈 Metrics</button>' : ''}
            ${this.config.features.agentStudio ? '<button class="nav-btn" data-view="agents">🤖 Agents</button>' : ''}
            ${this.config.features.projectManagement ? '<button class="nav-btn" data-view="projects">📋 Projects</button>' : ''}
            ${this.config.features.memoryGraph ? '<button class="nav-btn" data-view="memory">🧠 Memory</button>' : ''}
            ${this.config.features.specManager ? '<button class="nav-btn" data-view="specs">📝 Specs</button>' : ''}
            ${this.config.features.costAnalytics ? '<button class="nav-btn" data-view="costs">💰 Costs</button>' : ''}
        </nav>

        <main class="dashboard-main">
            <!-- Overview View -->
            <div id="view-overview" class="dashboard-view active">
                <div class="overview-grid">
                    <div class="metric-card">
                        <h3>Total Requests</h3>
                        <div class="metric-value" id="total-requests">0</div>
                        <div class="metric-change positive" id="requests-change">+0%</div>
                    </div>
                    
                    <div class="metric-card">
                        <h3>Cost Savings</h3>
                        <div class="metric-value" id="cost-savings">$0.00</div>
                        <div class="metric-change positive" id="savings-change">+0%</div>
                    </div>
                    
                    <div class="metric-card">
                        <h3>Success Rate</h3>
                        <div class="metric-value" id="success-rate">0%</div>
                        <div class="metric-change" id="success-change">+0%</div>
                    </div>
                    
                    <div class="metric-card">
                        <h3>Avg Latency</h3>
                        <div class="metric-value" id="avg-latency">0ms</div>
                        <div class="metric-change" id="latency-change">+0%</div>
                    </div>
                </div>

                <div class="charts-grid">
                    <div class="chart-container">
                        <h3>Request Volume</h3>
                        <canvas id="requests-chart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <h3>Cost Analysis</h3>
                        <canvas id="costs-chart"></canvas>
                    </div>
                </div>

                <div class="recent-activity">
                    <h3>Recent Activity</h3>
                    <div id="activity-feed" class="activity-feed"></div>
                </div>
            </div>

            <!-- Metrics View -->
            ${this.config.features.realTimeMetrics ? this.generateMetricsView() : ''}

            <!-- Agents View -->
            ${this.config.features.agentStudio ? this.generateAgentsView() : ''}

            <!-- Projects View -->
            ${this.config.features.projectManagement ? this.generateProjectsView() : ''}

            <!-- Memory View -->
            ${this.config.features.memoryGraph ? this.generateMemoryView() : ''}

            <!-- Specs View -->
            ${this.config.features.specManager ? this.generateSpecsView() : ''}

            <!-- Costs View -->
            ${this.config.features.costAnalytics ? this.generateCostsView() : ''}
        </main>
    </div>

    <div id="toast-container" class="toast-container"></div>

    <script src="/dashboard.js"></script>
</body>
</html>`

    await fs.writeFile(path.join(assetsDir, 'index.html'), html)
  }

  private async generateStyles(assetsDir: string): Promise<void> {
    const css = `/* LLM-Charge Dashboard Styles */
:root {
    --primary-color: #3b82f6;
    --secondary-color: #64748b;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --error-color: #ef4444;
    --background: #ffffff;
    --surface: #f8fafc;
    --text: #1e293b;
    --text-secondary: #64748b;
    --border: #e2e8f0;
    --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    
    /* Liquid Glass Effect Variables */
    --glass-background: rgba(255, 255, 255, 0.1);
    --glass-border: rgba(255, 255, 255, 0.2);
    --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
    --glass-blur: blur(4px);
}

.theme-dark {
    --background: #0f172a;
    --surface: #1e293b;
    --text: #f1f5f9;
    --text-secondary: #94a3b8;
    --border: #334155;
    --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2);
    
    /* Dark mode glass adjustments */
    --glass-background: rgba(17, 25, 40, 0.25);
    --glass-border: rgba(255, 255, 255, 0.18);
    --glass-shadow: 0 8px 32px 0 rgba(2, 12, 27, 0.7);
}

/* Liquid Glass Style */
.style-liquid-glass .dashboard-header,
.style-liquid-glass .dashboard-nav,
.style-liquid-glass .metric-card,
.style-liquid-glass .chart-container,
.style-liquid-glass .recent-activity,
.style-liquid-glass .agent-card,
.style-liquid-glass .spec-card,
.style-liquid-glass .data-table,
.style-liquid-glass .btn {
    background: var(--glass-background);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
}

.style-liquid-glass .dashboard-header {
    background: var(--glass-background);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
}

.style-liquid-glass .metric-card::before,
.style-liquid-glass .chart-container::before,
.style-liquid-glass .agent-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    border-radius: inherit;
    pointer-events: none;
}

.style-liquid-glass .metric-card,
.style-liquid-glass .chart-container,
.style-liquid-glass .agent-card {
    position: relative;
    overflow: hidden;
}

/* Flat Style (default) */
.style-flat .dashboard-header,
.style-flat .dashboard-nav,
.style-flat .metric-card,
.style-flat .chart-container,
.style-flat .recent-activity,
.style-flat .agent-card,
.style-flat .spec-card,
.style-flat .data-table {
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--background);
    color: var(--text);
    line-height: 1.5;
}

#app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* Header */
.dashboard-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow);
}

.dashboard-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
}

.header-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--error-color);
}

.status-dot.connected {
    background: var(--success-color);
}

/* Navigation */
.dashboard-nav {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
}

.nav-btn {
    background: none;
    border: none;
    padding: 0.75rem 1rem;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.nav-btn:hover,
.nav-btn.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
}

/* Main Content */
.dashboard-main {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
}

.dashboard-view {
    display: none;
}

.dashboard-view.active {
    display: block;
}

/* Overview Grid */
.overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.metric-card {
    background: var(--surface);
    padding: 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
}

.metric-card h3 {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.metric-value {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
}

.metric-change {
    font-size: 0.75rem;
    font-weight: 500;
}

.metric-change.positive {
    color: var(--success-color);
}

.metric-change.negative {
    color: var(--error-color);
}

/* Charts */
.charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 2rem;
    margin-bottom: 2rem;
}

.chart-container {
    background: var(--surface);
    padding: 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
}

.chart-container h3 {
    margin-bottom: 1rem;
    font-size: 1.125rem;
}

/* Activity Feed */
.recent-activity {
    background: var(--surface);
    padding: 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
}

.activity-feed {
    max-height: 300px;
    overflow-y: auto;
}

.activity-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border);
}

.activity-item:last-child {
    border-bottom: none;
}

.activity-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
}

.activity-content {
    flex: 1;
}

.activity-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
}

.activity-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
}

.btn:hover {
    background: var(--border);
}

.btn-primary {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
}

.btn-primary:hover {
    background: #2563eb;
}

.btn-secondary {
    background: var(--secondary-color);
    color: white;
    border-color: var(--secondary-color);
}

/* Tables */
.data-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: var(--shadow);
}

.data-table th,
.data-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
}

.data-table th {
    background: var(--border);
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.data-table tr:hover {
    background: var(--border);
}

/* Toast Notifications */
.toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.toast {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    color: white;
    font-weight: 500;
    box-shadow: var(--shadow);
    animation: slideIn 0.3s ease;
    max-width: 400px;
}

.toast.success {
    background: var(--success-color);
}

.toast.warning {
    background: var(--warning-color);
}

.toast.error {
    background: var(--error-color);
}

.toast.info {
    background: var(--primary-color);
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

/* Responsive Design */
@media (max-width: 768px) {
    .dashboard-header {
        padding: 1rem;
        flex-direction: column;
        gap: 1rem;
    }
    
    .dashboard-nav {
        padding: 0 1rem;
    }
    
    .dashboard-main {
        padding: 1rem;
    }
    
    .overview-grid {
        grid-template-columns: 1fr;
    }
    
    .charts-grid {
        grid-template-columns: 1fr;
    }
}

/* View-specific styles */
.agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
}

.agent-card {
    background: var(--surface);
    padding: 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
}

.agent-status {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.agent-status.active {
    background: var(--success-color);
    color: white;
}

.agent-status.idle {
    background: var(--warning-color);
    color: white;
}

.memory-graph {
    width: 100%;
    height: 500px;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface);
}

.spec-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.spec-card {
    background: var(--surface);
    padding: 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
}

.spec-meta {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}
`

    await fs.writeFile(path.join(assetsDir, 'styles.css'), css)
  }

  private async generateClientScript(assetsDir: string): Promise<void> {
    const js = `// LLM-Charge Dashboard Client
class Dashboard {
    constructor() {
        this.ws = null;
        this.charts = {};
        this.currentView = 'overview';
        this.metrics = {};
        
        this.init();
    }
    
    init() {
        this.connectWebSocket();
        this.setupNavigation();
        this.setupThemeToggle();
        this.initializeCharts();
        this.loadInitialData();
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = \`\${protocol}//\${window.location.host}/ws\`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateConnectionStatus(true);
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
        };
        
        this.ws.onclose = () => {
            this.updateConnectionStatus(false);
            // Reconnect after 3 seconds
            setTimeout(() => this.connectWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'metrics':
                this.updateMetrics(message.data);
                break;
            case 'agent_update':
                this.updateAgent(message.data);
                break;
            case 'memory_update':
                this.updateMemory(message.data);
                break;
            case 'project_update':
                this.updateProject(message.data);
                break;
            case 'notification':
                this.showToast(message.data.level, message.data.message);
                break;
        }
    }
    
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        const dotEl = statusEl.querySelector('.status-dot');
        
        if (connected) {
            dotEl.classList.add('connected');
            statusEl.querySelector('span:last-child').textContent = 'Connected';
        } else {
            dotEl.classList.remove('connected');
            statusEl.querySelector('span:last-child').textContent = 'Disconnected';
        }
    }
    
    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });
    }
    
    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Update views
        document.querySelectorAll('.dashboard-view').forEach(viewEl => {
            viewEl.classList.toggle('active', viewEl.id === \`view-\${view}\`);
        });
        
        this.currentView = view;
        this.loadViewData(view);
    }
    
    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const styleToggle = document.getElementById('style-toggle');
        
        themeToggle.addEventListener('click', () => {
            const body = document.body;
            const isDark = body.classList.contains('theme-dark');
            
            // Preserve current style
            const isLiquidGlass = body.classList.contains('style-liquid-glass');
            const isFlat = body.classList.contains('style-flat');
            
            body.className = '';
            body.classList.add(isDark ? 'theme-light' : 'theme-dark');
            
            if (isLiquidGlass) body.classList.add('style-liquid-glass');
            if (isFlat) body.classList.add('style-flat');
            
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
        });
        
        styleToggle.addEventListener('click', () => {
            const body = document.body;
            const isLiquidGlass = body.classList.contains('style-liquid-glass');
            
            // Preserve current theme
            const isDark = body.classList.contains('theme-dark');
            const isLight = body.classList.contains('theme-light');
            
            body.className = '';
            
            if (isDark) body.classList.add('theme-dark');
            if (isLight) body.classList.add('theme-light');
            
            body.classList.add(isLiquidGlass ? 'style-flat' : 'style-liquid-glass');
            
            localStorage.setItem('style', isLiquidGlass ? 'flat' : 'liquid-glass');
        });
        
        // Apply saved preferences
        const savedTheme = localStorage.getItem('theme') || 'light';
        const savedStyle = localStorage.getItem('style') || 'liquid-glass';
        
        document.body.className = \`theme-\${savedTheme} style-\${savedStyle}\`;
    }
    
    initializeCharts() {
        // Requests Chart
        const requestsCtx = document.getElementById('requests-chart');
        if (requestsCtx) {
            this.charts.requests = new Chart(requestsCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Requests',
                        data: [],
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
        // Costs Chart
        const costsCtx = document.getElementById('costs-chart');
        if (costsCtx) {
            this.charts.costs = new Chart(costsCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Local', 'Cloud', 'Hybrid'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: [
                            getComputedStyle(document.documentElement).getPropertyValue('--success-color'),
                            getComputedStyle(document.documentElement).getPropertyValue('--warning-color'),
                            getComputedStyle(document.documentElement).getPropertyValue('--primary-color')
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }
    
    updateMetrics(metrics) {
        this.metrics = metrics;
        
        // Update overview cards
        this.updateElement('total-requests', metrics.totalRequests?.toLocaleString() || '0');
        this.updateElement('cost-savings', \`$\${(metrics.costSavings || 0).toFixed(2)}\`);
        this.updateElement('success-rate', \`\${Math.round((metrics.successRate || 0) * 100)}%\`);
        this.updateElement('avg-latency', \`\${Math.round(metrics.averageLatency || 0)}ms\`);
        
        // Update charts
        if (this.charts.requests && metrics.requestsOverTime) {
            this.charts.requests.data.labels = metrics.requestsOverTime.labels;
            this.charts.requests.data.datasets[0].data = metrics.requestsOverTime.data;
            this.charts.requests.update();
        }
        
        if (this.charts.costs && metrics.costBreakdown) {
            this.charts.costs.data.datasets[0].data = [
                metrics.costBreakdown.local || 0,
                metrics.costBreakdown.cloud || 0,
                metrics.costBreakdown.hybrid || 0
            ];
            this.charts.costs.update();
        }
    }
    
    updateAgent(agentData) {
        // Update agent-specific UI elements
        const agentEl = document.querySelector(\`[data-agent-id="\${agentData.agentId}"]\`);
        if (agentEl) {
            // Update agent status, metrics, etc.
        }
    }
    
    updateMemory(memoryData) {
        // Update memory graph visualization
        if (this.currentView === 'memory' && memoryData.type === 'graph_update') {
            this.renderMemoryGraph(memoryData);
        }
    }
    
    updateProject(projectData) {
        // Update project management UI
        const projectEl = document.querySelector(\`[data-project-id="\${projectData.projectId}"]\`);
        if (projectEl) {
            // Update project status, tickets, etc.
        }
    }
    
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }
    
    showToast(level, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = \`toast \${level}\`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
    
    async loadInitialData() {
        try {
            const response = await fetch('/api/dashboard/initial');
            const data = await response.json();
            
            if (data.metrics) {
                this.updateMetrics(data.metrics);
            }
            
            // Load other initial data
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }
    
    async loadViewData(view) {
        try {
            const response = await fetch(\`/api/dashboard/\${view}\`);
            const data = await response.json();
            
            switch (view) {
                case 'agents':
                    this.renderAgents(data);
                    break;
                case 'projects':
                    this.renderProjects(data);
                    break;
                case 'memory':
                    this.renderMemory(data);
                    break;
                case 'specs':
                    this.renderSpecs(data);
                    break;
            }
        } catch (error) {
            console.error(\`Failed to load \${view} data:\`, error);
        }
    }
    
    renderAgents(data) {
        // Render agents view
        const container = document.getElementById('agents-container');
        if (container && data.agents) {
            container.innerHTML = data.agents.map(agent => \`
                <div class="agent-card" data-agent-id="\${agent.id}">
                    <h3>\${agent.name}</h3>
                    <p>\${agent.description}</p>
                    <div class="agent-status \${agent.status}">\${agent.status}</div>
                    <div class="agent-metrics">
                        <span>Success Rate: \${Math.round(agent.metrics.successRate * 100)}%</span>
                        <span>Avg Time: \${Math.round(agent.metrics.averageExecutionTime / 1000)}s</span>
                    </div>
                </div>
            \`).join('');
        }
    }
    
    renderProjects(data) {
        // Render projects view
        // Implementation would depend on project data structure
    }
    
    renderMemory(data) {
        // Render memory graph using Mermaid or D3.js
        if (data.memoryGraph) {
            this.renderMemoryGraph(data.memoryGraph);
        }
    }
    
    renderMemoryGraph(graphData) {
        const container = document.getElementById('memory-graph');
        if (container) {
            // Use Mermaid to render the graph
            const mermaidCode = this.generateMermaidCode(graphData);
            mermaid.render('memory-graph-svg', mermaidCode, (svg) => {
                container.innerHTML = svg;
            });
        }
    }
    
    generateMermaidCode(graphData) {
        let mermaid = 'graph TD\\n';
        
        // Add nodes
        graphData.nodes.forEach(node => {
            mermaid += \`  \${node.id}["\${node.title}"]\\n\`;
        });
        
        // Add edges
        graphData.edges.forEach(edge => {
            const arrow = edge.type === 'references' ? '-->' : '-..->';
            mermaid += \`  \${edge.from} \${arrow} \${edge.to}\\n\`;
        });
        
        return mermaid;
    }
    
    renderSpecs(data) {
        // Render specs view
        const container = document.getElementById('specs-container');
        if (container && data.specs) {
            container.innerHTML = data.specs.map(spec => \`
                <div class="spec-card">
                    <h3>\${spec.title}</h3>
                    <p>\${spec.description}</p>
                    <div class="spec-meta">
                        <span>Status: \${spec.status}</span>
                        <span>Priority: \${spec.priority}</span>
                        <span>Linked: \${spec.linkedClasses.length + spec.linkedMethods.length + spec.linkedTests.length} items</span>
                    </div>
                </div>
            \`).join('');
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});`

    await fs.writeFile(path.join(assetsDir, 'dashboard.js'), js)
  }

  private generateMetricsView(): string {
    return `
    <div id="view-metrics" class="dashboard-view">
        <h2>Real-time Metrics</h2>
        <div class="metrics-grid">
            <div class="metric-section">
                <h3>Performance Metrics</h3>
                <div class="metric-charts">
                    <canvas id="performance-chart"></canvas>
                </div>
            </div>
            
            <div class="metric-section">
                <h3>Cost Analysis</h3>
                <div class="cost-breakdown">
                    <div class="cost-item">
                        <span>Local Models</span>
                        <span id="local-cost">$0.00</span>
                    </div>
                    <div class="cost-item">
                        <span>Cloud Models</span>
                        <span id="cloud-cost">$0.00</span>
                    </div>
                    <div class="cost-item">
                        <span>Total Savings</span>
                        <span id="total-savings">$0.00</span>
                    </div>
                </div>
            </div>
        </div>
    </div>`
  }

  private generateAgentsView(): string {
    return `
    <div id="view-agents" class="dashboard-view">
        <div class="view-header">
            <h2>Agent Studio</h2>
            <button class="btn btn-primary">+ Create Agent</button>
        </div>
        
        <div id="agents-container" class="agent-grid">
            <!-- Agents will be loaded dynamically -->
        </div>
        
        <div class="agent-workflows">
            <h3>Active Workflows</h3>
            <div id="workflows-container">
                <!-- Workflows will be loaded dynamically -->
            </div>
        </div>
    </div>`
  }

  private generateProjectsView(): string {
    return `
    <div id="view-projects" class="dashboard-view">
        <div class="view-header">
            <h2>Project Management</h2>
            <button class="btn btn-primary">+ New Project</button>
        </div>
        
        <div class="project-stats">
            <div class="stat-card">
                <h4>Active Projects</h4>
                <span id="active-projects">0</span>
            </div>
            <div class="stat-card">
                <h4>Open Tickets</h4>
                <span id="open-tickets">0</span>
            </div>
            <div class="stat-card">
                <h4>Completed Today</h4>
                <span id="completed-today">0</span>
            </div>
        </div>
        
        <div class="projects-container">
            <div class="kanban-board" id="kanban-board">
                <!-- Kanban columns will be loaded dynamically -->
            </div>
        </div>
    </div>`
  }

  private generateMemoryView(): string {
    return `
    <div id="view-memory" class="dashboard-view">
        <div class="view-header">
            <h2>Memory & Knowledge Graph</h2>
            <div class="memory-controls">
                <button class="btn" id="refresh-graph">🔄 Refresh</button>
                <button class="btn" id="export-graph">📤 Export</button>
            </div>
        </div>
        
        <div class="memory-stats">
            <div class="stat-card">
                <h4>Total Notes</h4>
                <span id="total-notes">0</span>
            </div>
            <div class="stat-card">
                <h4>Connections</h4>
                <span id="total-connections">0</span>
            </div>
            <div class="stat-card">
                <h4>Learning Records</h4>
                <span id="learning-records">0</span>
            </div>
        </div>
        
        <div class="memory-visualization">
            <div id="memory-graph" class="memory-graph">
                <!-- Memory graph will be rendered here -->
            </div>
        </div>
        
        <div class="recent-memories">
            <h3>Recent Memories</h3>
            <div id="recent-memories-list">
                <!-- Recent memories will be loaded dynamically -->
            </div>
        </div>
    </div>`
  }

  private generateSpecsView(): string {
    return `
    <div id="view-specs" class="dashboard-view">
        <div class="view-header">
            <h2>Specification Management</h2>
            <button class="btn btn-primary">+ New Spec</button>
        </div>
        
        <div class="specs-filters">
            <select id="status-filter">
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="deprecated">Deprecated</option>
            </select>
            
            <select id="priority-filter">
                <option value="">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
            </select>
            
            <input type="search" id="specs-search" placeholder="Search specs...">
        </div>
        
        <div id="specs-container" class="spec-list">
            <!-- Specs will be loaded dynamically -->
        </div>
    </div>`
  }

  private generateCostsView(): string {
    return `
    <div id="view-costs" class="dashboard-view">
        <div class="view-header">
            <h2>Cost Analytics</h2>
            <div class="cost-controls">
                <select id="cost-timeframe">
                    <option value="day">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                </select>
            </div>
        </div>
        
        <div class="cost-overview">
            <div class="cost-card">
                <h4>Total Spent</h4>
                <span id="total-spent">$0.00</span>
            </div>
            <div class="cost-card">
                <h4>Projected Monthly</h4>
                <span id="projected-monthly">$0.00</span>
            </div>
            <div class="cost-card">
                <h4>Savings vs Cloud-Only</h4>
                <span id="cloud-savings">$0.00</span>
            </div>
        </div>
        
        <div class="cost-charts">
            <div class="chart-container">
                <h3>Cost Trends</h3>
                <canvas id="cost-trends-chart"></canvas>
            </div>
            
            <div class="chart-container">
                <h3>Model Usage Costs</h3>
                <canvas id="model-costs-chart"></canvas>
            </div>
        </div>
    </div>`
  }

  private async startHttpServer(): Promise<void> {
    const http = await import('http')
    const url = await import('url')
    
    this.server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url || '/')
      const pathname = parsedUrl.pathname || '/'
      
      try {
        if (pathname === '/') {
          // Serve index.html
          const indexPath = path.join(process.cwd(), 'assets/dashboard/index.html')
          const content = await fs.readFile(indexPath, 'utf-8')
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(content)
        } else if (pathname === '/styles.css') {
          // Serve CSS
          const cssPath = path.join(process.cwd(), 'assets/dashboard/styles.css')
          const content = await fs.readFile(cssPath, 'utf-8')
          res.writeHead(200, { 'Content-Type': 'text/css' })
          res.end(content)
        } else if (pathname === '/dashboard.js') {
          // Serve JavaScript
          const jsPath = path.join(process.cwd(), 'assets/dashboard/dashboard.js')
          const content = await fs.readFile(jsPath, 'utf-8')
          res.writeHead(200, { 'Content-Type': 'application/javascript' })
          res.end(content)
        } else if (pathname?.startsWith('/api/')) {
          // API endpoints
          await this.handleApiRequest(req, res, pathname)
        } else {
          // 404
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not Found')
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')
      }
    })
    
    this.server.listen(this.config.port, this.config.host, () => {
      this.emit('http:server-started', { port: this.config.port })
    })
  }

  private async startWebSocketServer(): Promise<void> {
    // Simple WebSocket implementation for demo
    // In production, would use 'ws' package
    this.emit('websocket:server-started', { port: this.config.port })
  }

  private async handleApiRequest(req: any, res: any, pathname: string): Promise<void> {
    // Simple API handler
    if (pathname === '/api/dashboard/initial') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        metrics: this.collectCurrentMetrics(),
        status: 'ok'
      }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'API endpoint not found' }))
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      // Collect and broadcast metrics
      const metrics = this.collectCurrentMetrics()
      this.updateMetrics(metrics)
    }, 5000) // Update every 5 seconds
  }

  private collectCurrentMetrics(): any {
    // Mock metrics - would collect real data from the system
    return {
      totalRequests: Math.floor(Math.random() * 1000),
      successRate: 0.85 + Math.random() * 0.1,
      averageLatency: 1500 + Math.random() * 1000,
      costSavings: Math.random() * 50,
      requestsOverTime: {
        labels: ['1h ago', '45m ago', '30m ago', '15m ago', 'Now'],
        data: [45, 52, 48, 61, 55]
      },
      costBreakdown: {
        local: 0,
        cloud: Math.random() * 10,
        hybrid: Math.random() * 5
      }
    }
  }
}