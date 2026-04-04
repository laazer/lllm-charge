#!/usr/bin/env node
/**
 * Simple test server for the LLM-Charge dashboard
 * Tests the cleaned up dashboard without debug styling
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3002;
const HOST = 'localhost';

// MIME types for different file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

// Mock data for testing
const mockData = {
    metrics: {
        totalRequests: 2847,
        costSavings: '$127.50',
        successRate: '98.5%',
        avgLatency: '2.3s',
        specsCount: 24,
        agentsCount: 7
    },
    specs: [
        {
            id: 'spec1',
            title: 'Dashboard Cleanup Complete',
            description: 'Removed all debug styling and fixed layout issues',
            status: 'completed',
            priority: 'high',
            tags: ['layout', 'cleanup', 'debugging']
        },
        {
            id: 'spec2', 
            title: 'Navigation System',
            description: 'Implemented section switching and improved UX',
            status: 'active',
            priority: 'medium',
            tags: ['navigation', 'ux', 'sections']
        }
    ],
    projects: [
        {
            id: 'project1',
            name: 'LLM-Charge Dashboard',
            description: 'Main dashboard project with modular architecture',
            type: 'web-app',
            status: 'active'
        }
    ],
    agents: [
        {
            id: 'agent1',
            name: 'Dashboard Manager',
            description: 'Manages dashboard functionality and UI',
            role: 'ui-manager',
            status: 'active',
            capabilities: {
                reasoning: 0.8,
                creativity: 0.6,
                technical: 0.9,
                communication: 0.7
            }
        }
    ],
    memory: [
        {
            id: 'note1',
            title: 'Layout Issues Fixed',
            content: 'Successfully cleaned up all debug styling and improved dashboard layout',
            tags: ['cleanup', 'success']
        }
    ]
};

function serveFile(filePath, res) {
    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const pathname = url.pathname;

    console.log(`${req.method} ${pathname}`);

    // Handle API endpoints
    if (pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        
        if (pathname === '/api/metrics') {
            res.end(JSON.stringify({ success: true, data: mockData.metrics }));
        } else if (pathname === '/api/specs') {
            res.end(JSON.stringify({ success: true, data: mockData.specs }));
        } else if (pathname === '/api/projects') {
            res.end(JSON.stringify({ success: true, data: mockData.projects }));
        } else if (pathname === '/api/agents') {
            res.end(JSON.stringify({ success: true, data: mockData.agents }));
        } else if (pathname === '/api/memory/notes') {
            res.end(JSON.stringify({ success: true, data: mockData.memory }));
        } else if (pathname === '/api/workflows') {
            res.end(JSON.stringify({ success: true, data: [] }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'API endpoint not found' }));
        }
        return;
    }

    // Handle static files
    let filePath;
    
    if (pathname === '/' || pathname === '/dashboard') {
        filePath = path.join(__dirname, 'src', 'dashboard', 'dashboard.html');
    } else if (pathname.startsWith('/js/')) {
        // Mock the JavaScript modules that don't exist yet
        const jsContent = `
console.log('Mock JavaScript module: ${pathname}');

// Mock LLMChargeDashboard class
export class LLMChargeDashboard {
    constructor() {
        console.log('LLMChargeDashboard initialized');
    }
    
    init() {
        console.log('Dashboard init called');
        this.loadInitialData();
    }
    
    async loadInitialData() {
        console.log('Loading initial dashboard data...');
        try {
            const metricsRes = await fetch('/api/metrics');
            const metrics = await metricsRes.json();
            if (metrics.success) {
                this.updateMetrics(metrics.data);
            }
        } catch (error) {
            console.error('Failed to load metrics:', error);
        }
    }
    
    updateMetrics(data) {
        document.getElementById('total-requests').textContent = data.totalRequests || '0';
        document.getElementById('cost-savings').textContent = data.costSavings || '$0';
        document.getElementById('success-rate').textContent = data.successRate || '0%';
        document.getElementById('avg-latency').textContent = data.avgLatency || '0s';
        document.getElementById('specs-count').textContent = data.specsCount || '0';
        document.getElementById('agents-count').textContent = data.agentsCount || '0';
    }
    
    async loadSpecs() {
        console.log('Loading specs...');
        try {
            const response = await fetch('/api/specs');
            const result = await response.json();
            if (result.success) {
                this.renderSpecs(result.data);
            }
        } catch (error) {
            console.error('Failed to load specs:', error);
        }
    }
    
    renderSpecs(specs) {
        const container = document.getElementById('specs-content');
        if (!container) return;
        
        if (specs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No specifications found</p>';
            return;
        }
        
        container.innerHTML = specs.map(spec => \`
            <div class="data-item" data-type="spec">
                <h4>\${spec.title}</h4>
                <p>\${spec.description}</p>
                <div class="data-item-meta">
                    \${spec.tags.map(tag => \`<span class="data-tag">\${tag}</span>\`).join('')}
                    <span class="data-priority priority-\${spec.priority}">\${spec.priority}</span>
                </div>
            </div>
        \`).join('');
    }
    
    async loadProjects() {
        console.log('Loading projects...');
        const container = document.getElementById('projects-content');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Loading projects...</p>';
        }
    }
    
    async loadAgents() {
        console.log('Loading agents...');
        const container = document.getElementById('agents-content');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Loading agents...</p>';
        }
    }
    
    async loadNotes() {
        console.log('Loading memory notes...');
        const container = document.getElementById('memory-content');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Loading memory notes...</p>';
        }
    }
    
    async loadWorkflows() {
        console.log('Loading workflows...');
        const container = document.getElementById('workflows-content');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No workflows found</p>';
        }
    }
}

// Mock other modules
export class ModalManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        console.log('ModalManager initialized');
    }
    
    showNotification(message, type = 'info') {
        console.log('Notification [' + type + ']: ' + message);
        
        // Create a simple notification element
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 500; z-index: 10000; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
        
        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, 3000);
    }
}

export class GraphViewers {
    constructor(dashboard, modalManager) {
        this.dashboard = dashboard;
        this.modalManager = modalManager;
        console.log('GraphViewers initialized');
    }
}

export class MCPToolsManager {
    constructor(dashboard, modalManager) {
        this.dashboard = dashboard;
        this.modalManager = modalManager;
        console.log('MCPToolsManager initialized');
    }
}

export const DashboardUtils = {
    parseDocumentFile: () => console.log('parseDocumentFile called'),
    extractFieldsFromDocument: () => console.log('extractFieldsFromDocument called'),
    fillFormFields: () => console.log('fillFormFields called'),
    
    showNotification(message, type = 'info') {
        console.log('Utils Notification [' + type + ']: ' + message);
        
        // Create a simple notification element
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 500; z-index: 10000; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
        
        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444', 
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, 3000);
    }
};
        `;
        
        res.setHeader('Content-Type', 'application/javascript');
        res.end(jsContent);
        return;
    } else {
        // Try to serve the requested file
        filePath = path.join(__dirname, 'src', 'dashboard', pathname);
    }

    // Check if file exists and serve it
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`<h1>404 - File Not Found</h1><p>Requested: ${pathname}</p><p>Tried: ${filePath}</p>`);
        } else {
            serveFile(filePath, res);
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`🚀 Dashboard Test Server running at http://${HOST}:${PORT}`);
    console.log(`📊 Dashboard available at: http://${HOST}:${PORT}/`);
    console.log(`📋 Mock API endpoints available:
    - GET /api/metrics
    - GET /api/specs  
    - GET /api/projects
    - GET /api/agents
    - GET /api/memory/notes
    - GET /api/workflows`);
    console.log(`\n🎯 Test the cleaned up dashboard layout!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down dashboard test server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});