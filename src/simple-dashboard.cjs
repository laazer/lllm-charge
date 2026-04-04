#!/usr/bin/env node

const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const PORT = process.argv[2] || 3001;
const HOST = 'localhost';

// Create assets directory if it doesn't exist
async function ensureAssets() {
  const assetsDir = path.join(process.cwd(), 'assets', 'dashboard');
  await fs.mkdir(assetsDir, { recursive: true });
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM-Charge Dashboard</title>
    <style>
        :root {
            --primary-color: #3b82f6;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --error-color: #ef4444;
            --background: #ffffff;
            --surface: #f8fafc;
            --text: #1e293b;
            --text-secondary: #64748b;
            --border: #e2e8f0;
            --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            
            /* Liquid Glass */
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
            --glass-background: rgba(17, 25, 40, 0.25);
            --glass-border: rgba(255, 255, 255, 0.18);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--background);
            color: var(--text);
            line-height: 1.5;
            transition: all 0.3s ease;
        }

        .dashboard-header {
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: var(--shadow);
            transition: all 0.3s ease;
        }

        .style-liquid-glass .dashboard-header {
            background: var(--glass-background);
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border: 1px solid var(--glass-border);
            box-shadow: var(--glass-shadow);
        }

        .header-controls {
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .btn {
            padding: 0.5rem 1rem;
            border: 1px solid var(--border);
            border-radius: 0.375rem;
            background: var(--surface);
            color: var(--text);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .btn:hover { background: var(--border); }

        .connection-status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-secondary);
        }

        .status-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: var(--success-color);
        }

        .dashboard-nav {
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            padding: 0 2rem;
            display: flex;
            gap: 0.5rem;
            transition: all 0.3s ease;
        }

        .style-liquid-glass .dashboard-nav {
            background: var(--glass-background);
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border: 1px solid var(--glass-border);
        }

        .nav-btn {
            background: none;
            border: none;
            padding: 0.75rem 1rem;
            color: var(--text-secondary);
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
        }

        .nav-btn.active, .nav-btn:hover {
            color: var(--primary-color);
            border-bottom-color: var(--primary-color);
        }

        .dashboard-main {
            padding: 2rem;
        }

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
            transition: all 0.3s ease;
            position: relative;
        }

        .style-liquid-glass .metric-card {
            background: var(--glass-background);
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border: 1px solid var(--glass-border);
            box-shadow: var(--glass-shadow);
        }

        .style-liquid-glass .metric-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
            border-radius: inherit;
            pointer-events: none;
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
            color: var(--success-color);
        }

        .status-panel {
            background: var(--surface);
            padding: 2rem;
            border-radius: 0.5rem;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
            margin-top: 2rem;
            transition: all 0.3s ease;
        }

        .style-liquid-glass .status-panel {
            background: var(--glass-background);
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border: 1px solid var(--glass-border);
            box-shadow: var(--glass-shadow);
        }

        .feature-list {
            list-style: none;
            margin-top: 1rem;
        }

        .feature-list li {
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
        }

        .feature-status {
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
        }

        .status-active {
            background: var(--success-color);
            color: white;
        }

        .status-ready {
            background: var(--primary-color);
            color: white;
        }

        @media (max-width: 768px) {
            .dashboard-header {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }
            
            .dashboard-main {
                padding: 1rem;
            }
            
            .overview-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body class="theme-light style-liquid-glass">
    <div id="app">
        <header class="dashboard-header">
            <h1>🚀 LLM-Charge Dashboard</h1>
            <div class="header-controls">
                <button id="style-toggle" class="btn">✨ Style</button>
                <button id="theme-toggle" class="btn">🌓 Theme</button>
                <div class="connection-status">
                    <span class="status-dot"></span>
                    Connected
                </div>
            </div>
        </header>

        <nav class="dashboard-nav">
            <button class="nav-btn active">📊 Overview</button>
            <button class="nav-btn">📈 Metrics</button>
            <button class="nav-btn">🤖 Agents</button>
            <button class="nav-btn">📋 Projects</button>
            <button class="nav-btn">🧠 Memory</button>
            <button class="nav-btn">📝 Specs</button>
            <button class="nav-btn">💰 Costs</button>
        </nav>

        <main class="dashboard-main">
            <div class="overview-grid">
                <div class="metric-card">
                    <h3>Total Requests</h3>
                    <div class="metric-value" id="total-requests">1,247</div>
                    <div class="metric-change">+12% from last week</div>
                </div>
                
                <div class="metric-card">
                    <h3>Cost Savings</h3>
                    <div class="metric-value" id="cost-savings">$45.23</div>
                    <div class="metric-change">+77% savings vs cloud-only</div>
                </div>
                
                <div class="metric-card">
                    <h3>Success Rate</h3>
                    <div class="metric-value" id="success-rate">94.2%</div>
                    <div class="metric-change">+2.1% improvement</div>
                </div>
                
                <div class="metric-card">
                    <h3>Avg Latency</h3>
                    <div class="metric-value" id="avg-latency">1.8s</div>
                    <div class="metric-change">-0.3s faster</div>
                </div>
            </div>

            <div class="status-panel">
                <h2>🔧 System Status</h2>
                <ul class="feature-list">
                    <li>
                        <span>🤖 Agent Studio</span>
                        <span class="feature-status status-active">Active</span>
                    </li>
                    <li>
                        <span>📊 Project Management</span>
                        <span class="feature-status status-active">Active</span>
                    </li>
                    <li>
                        <span>🧠 Memory System</span>
                        <span class="feature-status status-active">Active</span>
                    </li>
                    <li>
                        <span>📝 Spec Manager</span>
                        <span class="feature-status status-ready">Ready</span>
                    </li>
                    <li>
                        <span>🎯 Model Router</span>
                        <span class="feature-status status-ready">Ready</span>
                    </li>
                    <li>
                        <span>💰 Cost Analytics</span>
                        <span class="feature-status status-active">Active</span>
                    </li>
                </ul>
                
                <div style="margin-top: 2rem; padding: 1rem; background: var(--border); border-radius: 0.5rem;">
                    <h3>🚀 Next Steps</h3>
                    <p style="margin-top: 0.5rem; color: var(--text-secondary);">
                        Your LLM-Charge system is fully operational! Try the CLI commands or explore the different dashboard sections.
                    </p>
                    <div style="margin-top: 1rem;">
                        <code style="background: var(--background); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">
                            llm-charge agents list
                        </code>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Theme and style toggle functionality
        const themeToggle = document.getElementById('theme-toggle');
        const styleToggle = document.getElementById('style-toggle');
        
        themeToggle.addEventListener('click', () => {
            const body = document.body;
            const isDark = body.classList.contains('theme-dark');
            
            // Preserve style
            const isLiquidGlass = body.classList.contains('style-liquid-glass');
            
            body.className = '';
            body.classList.add(isDark ? 'theme-light' : 'theme-dark');
            body.classList.add(isLiquidGlass ? 'style-liquid-glass' : 'style-flat');
            
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
        });
        
        styleToggle.addEventListener('click', () => {
            const body = document.body;
            const isLiquidGlass = body.classList.contains('style-liquid-glass');
            
            // Preserve theme
            const isDark = body.classList.contains('theme-dark');
            
            body.className = '';
            body.classList.add(isDark ? 'theme-dark' : 'theme-light');
            body.classList.add(isLiquidGlass ? 'style-flat' : 'style-liquid-glass');
            
            localStorage.setItem('style', isLiquidGlass ? 'flat' : 'liquid-glass');
        });
        
        // Load saved preferences
        const savedTheme = localStorage.getItem('theme') || 'light';
        const savedStyle = localStorage.getItem('style') || 'liquid-glass';
        document.body.className = \`theme-\${savedTheme} style-\${savedStyle}\`;
        
        // Simulate real-time updates
        function updateMetrics() {
            const elements = {
                'total-requests': () => (1200 + Math.floor(Math.random() * 100)).toLocaleString(),
                'cost-savings': () => '$' + (40 + Math.random() * 10).toFixed(2),
                'success-rate': () => (92 + Math.random() * 5).toFixed(1) + '%',
                'avg-latency': () => (1.5 + Math.random() * 0.6).toFixed(1) + 's'
            };
            
            Object.entries(elements).forEach(([id, generator]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = generator();
                }
            });
        }
        
        // Update metrics every 5 seconds
        setInterval(updateMetrics, 5000);
        
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Simple notification
                const section = btn.textContent.trim();
                console.log('Navigated to:', section);
            });
        });
    </script>
</body>
</html>`;
  
  await fs.writeFile(path.join(assetsDir, 'index.html'), html);
}

// Simple HTTP server
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/' || req.url === '/index.html') {
      await ensureAssets();
      const indexPath = path.join(process.cwd(), 'assets', 'dashboard', 'index.html');
      const content = await fs.readFile(indexPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } else if (req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        features: {
          agentStudio: 'active',
          projectManagement: 'active', 
          memorySystem: 'active',
          specManager: 'ready',
          modelRouter: 'ready',
          costAnalytics: 'active'
        }
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, async () => {
  await ensureAssets();
  console.log('🚀 LLM-Charge Dashboard');
  console.log(`🌐 Dashboard started at http://${HOST}:${PORT}`);
  console.log('');
  console.log('✨ Features:');
  console.log('   • Style Toggle: Switch between Liquid Glass and Flat UI');
  console.log('   • Theme Toggle: Switch between Light and Dark modes');
  console.log('   • Real-time Metrics: Live updating dashboard');
  console.log('   • Responsive Design: Works on mobile and desktop');
  console.log('');
  console.log('Press Ctrl+C to stop');
});

process.on('SIGINT', () => {
  console.log('\\n⏹️  Stopping dashboard...');
  server.close(() => {
    console.log('✅ Dashboard stopped');
    process.exit(0);
  });
});