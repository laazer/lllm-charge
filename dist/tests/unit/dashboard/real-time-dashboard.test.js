import { jest } from '@jest/globals';
import { RealTimeDashboard } from '../../../src/dashboard/real-time-dashboard.js';
// Mock WebSocket
const mockWebSocket = {
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
};
jest.mock('ws', () => ({
    WebSocketServer: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        clients: new Set([mockWebSocket]),
        close: jest.fn()
    })),
    WebSocket: jest.fn().mockImplementation(() => mockWebSocket)
}));
// Mock HTTP server for dashboard
jest.mock('http', () => ({
    createServer: jest.fn(() => ({
        listen: jest.fn(),
        close: jest.fn(),
        on: jest.fn()
    }))
}));
// Mock filesystem for widget persistence
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn()
}));
describe('RealTimeDashboard', () => {
    let dashboard;
    beforeEach(() => {
        const config = {
            port: 3001,
            wsPort: 3002,
            updateInterval: 1000,
            retentionPeriod: 86400000, // 24 hours
            enableAlerts: true,
            enableExports: true
        };
        dashboard = new RealTimeDashboard(config);
    });
    afterEach(async () => {
        dashboard.removeAllListeners();
        await dashboard.shutdown();
    });
    describe('Dashboard Initialization', () => {
        test('should initialize dashboard with default configuration', async () => {
            await dashboard.start();
            const config = dashboard.getConfiguration();
            expect(config.port).toBe(3001);
            expect(config.wsPort).toBe(3002);
            expect(config.updateInterval).toBe(1000);
            expect(config.enableAlerts).toBe(true);
        });
        test('should start HTTP server and WebSocket server', async () => {
            await dashboard.start();
            expect(dashboard.isRunning()).toBe(true);
            expect(dashboard.getConnectionCount()).toBeGreaterThanOrEqual(0);
        });
        test('should load saved widgets on startup', async () => {
            const fs = await import('fs/promises');
            const mockWidgets = [
                {
                    id: 'cost-widget',
                    type: 'cost-chart',
                    title: 'Cost Overview',
                    position: { x: 0, y: 0, width: 6, height: 4 },
                    config: { timeframe: '24h', showPredictions: true }
                }
            ];
            fs.readFile.mockResolvedValue(JSON.stringify(mockWidgets));
            await dashboard.start();
            const widgets = await dashboard.getWidgets();
            expect(widgets).toHaveLength(1);
            expect(widgets[0].id).toBe('cost-widget');
        });
    });
    describe('Real-Time Metrics', () => {
        beforeEach(async () => {
            await dashboard.start();
        });
        test('should collect and broadcast metrics snapshot', async () => {
            const metricsPromise = new Promise((resolve) => {
                dashboard.on('metrics-updated', resolve);
            });
            // Trigger metrics collection
            await dashboard.collectMetrics();
            const metrics = await metricsPromise;
            expect(metrics).toBeDefined();
            expect(metrics).toEqual(expect.objectContaining({
                timestamp: expect.any(Date),
                costs: expect.any(Object),
                performance: expect.any(Object),
                usage: expect.any(Object)
            }));
        });
        test('should track cost metrics over time', async () => {
            // Simulate cost data
            await dashboard.recordCostEvent('llm-call', 0.05, 'claude-3');
            await dashboard.recordCostEvent('llm-call', 0.03, 'gpt-3.5');
            await dashboard.recordCostEvent('llm-call', 0.08, 'gpt-4');
            const costMetrics = await dashboard.getCostAnalysis('1h');
            expect(costMetrics.totalCost).toBe(0.16);
            expect(costMetrics.breakdown.length).toBeGreaterThan(0);
            expect(costMetrics.breakdown[0]).toEqual(expect.objectContaining({
                provider: expect.any(String),
                model: expect.any(String),
                cost: expect.any(Number),
                calls: expect.any(Number)
            }));
        });
        test('should track performance metrics', async () => {
            // Record performance data
            await dashboard.recordPerformanceMetric('response-time', 245, { provider: 'local' });
            await dashboard.recordPerformanceMetric('response-time', 890, { provider: 'openai' });
            await dashboard.recordPerformanceMetric('tokens-per-second', 50, { model: 'llama2' });
            const perfMetrics = await dashboard.getPerformanceMetrics('1h');
            expect(perfMetrics.averageResponseTime).toBeGreaterThan(0);
            expect(perfMetrics.throughput).toBeGreaterThan(0);
            expect(perfMetrics.providerBreakdown).toBeDefined();
        });
        test('should track usage patterns', async () => {
            // Record usage events
            await dashboard.recordUsageEvent('task-completion', { taskType: 'code-review' });
            await dashboard.recordUsageEvent('task-completion', { taskType: 'text-generation' });
            await dashboard.recordUsageEvent('error', { errorType: 'timeout' });
            const usageMetrics = await dashboard.getUsageMetrics('1h');
            expect(usageMetrics.totalTasks).toBe(2);
            expect(usageMetrics.errorRate).toBeGreaterThan(0);
            expect(usageMetrics.taskBreakdown).toBeDefined();
        });
        test('should broadcast updates to connected clients', async () => {
            const ws = mockWebSocket;
            dashboard.subscribeToUpdates(ws);
            await dashboard.recordCostEvent('test-call', 0.01, 'test-model');
            expect(ws.send).toHaveBeenCalled();
            const sentData = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sentData.type).toBe('metrics-update');
            expect(sentData.data).toBeDefined();
        });
    });
    describe('Dashboard Widgets', () => {
        beforeEach(async () => {
            await dashboard.start();
        });
        test('should create and manage widgets', async () => {
            const widget = {
                id: 'test-widget',
                type: 'line-chart',
                title: 'Response Time Trend',
                position: { x: 0, y: 0, width: 8, height: 6 },
                config: {
                    metric: 'response-time',
                    timeframe: '1h',
                    refreshInterval: 30000
                }
            };
            await dashboard.createWidget(widget);
            const widgets = await dashboard.getWidgets();
            expect(widgets).toHaveLength(1);
            expect(widgets[0].id).toBe('test-widget');
        });
        test('should update widget configuration', async () => {
            const widget = {
                id: 'update-widget',
                type: 'bar-chart',
                title: 'Cost by Provider',
                position: { x: 0, y: 0, width: 6, height: 4 },
                config: { timeframe: '24h' }
            };
            await dashboard.createWidget(widget);
            const updatedConfig = {
                ...widget.config,
                timeframe: '7d',
                showPercentages: true
            };
            await dashboard.updateWidget('update-widget', { config: updatedConfig });
            const widgets = await dashboard.getWidgets();
            const updatedWidget = widgets.find(w => w.id === 'update-widget');
            expect(updatedWidget?.config.timeframe).toBe('7d');
            expect(updatedWidget?.config.showPercentages).toBe(true);
        });
        test('should delete widgets', async () => {
            const widget = {
                id: 'delete-widget',
                type: 'gauge',
                title: 'Current Load',
                position: { x: 0, y: 0, width: 4, height: 4 },
                config: {}
            };
            await dashboard.createWidget(widget);
            expect((await dashboard.getWidgets())).toHaveLength(1);
            await dashboard.deleteWidget('delete-widget');
            expect((await dashboard.getWidgets())).toHaveLength(0);
        });
        test('should get widget data for different chart types', async () => {
            await dashboard.createWidget({
                id: 'cost-chart',
                type: 'line-chart',
                title: 'Cost Trend',
                position: { x: 0, y: 0, width: 8, height: 6 },
                config: { metric: 'cost', timeframe: '1h' }
            });
            // Generate some cost data
            for (let i = 0; i < 10; i++) {
                await dashboard.recordCostEvent('test-call', 0.01 * (i + 1), 'test-model');
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            const widgetData = await dashboard.getWidgetData('cost-chart');
            expect(widgetData).toBeDefined();
            expect(widgetData.labels).toBeDefined();
            expect(widgetData.datasets).toBeDefined();
            expect(Array.isArray(widgetData.datasets)).toBe(true);
        });
    });
    describe('Alert System', () => {
        beforeEach(async () => {
            await dashboard.start();
        });
        test('should create and manage alerts', async () => {
            const alert = {
                name: 'High Cost Alert',
                description: 'Alert when hourly cost exceeds threshold',
                condition: {
                    metric: 'hourly-cost',
                    operator: 'greater-than',
                    threshold: 10.0,
                    timeWindow: 3600000 // 1 hour
                },
                severity: 'warning',
                enabled: true,
                notificationChannels: ['email', 'webhook']
            };
            const createdAlert = await dashboard.createAlert(alert);
            expect(createdAlert.id).toBeDefined();
            expect(createdAlert.name).toBe('High Cost Alert');
            expect(createdAlert.enabled).toBe(true);
            const alerts = await dashboard.getAlerts();
            expect(alerts).toHaveLength(1);
        });
        test('should trigger alerts based on conditions', async () => {
            const alertPromise = new Promise((resolve) => {
                dashboard.on('alert-triggered', resolve);
            });
            const alert = {
                name: 'Response Time Alert',
                description: 'Alert when response time is too high',
                condition: {
                    metric: 'response-time',
                    operator: 'greater-than',
                    threshold: 5000, // 5 seconds
                    timeWindow: 60000 // 1 minute
                },
                severity: 'critical',
                enabled: true
            };
            await dashboard.createAlert(alert);
            // Trigger the alert condition
            await dashboard.recordPerformanceMetric('response-time', 6000);
            const triggeredAlert = await alertPromise;
            expect(triggeredAlert).toEqual(expect.objectContaining({
                alertName: 'Response Time Alert',
                severity: 'critical',
                value: 6000,
                threshold: 5000
            }));
        });
        test('should acknowledge and resolve alerts', async () => {
            const alert = {
                name: 'Test Alert',
                description: 'Test alert for acknowledgment',
                condition: {
                    metric: 'test-metric',
                    operator: 'equals',
                    threshold: 1
                },
                severity: 'info',
                enabled: true
            };
            const createdAlert = await dashboard.createAlert(alert);
            // Trigger alert
            await dashboard.recordMetric('test-metric', 1);
            // Wait for alert to be processed
            await new Promise(resolve => setTimeout(resolve, 100));
            await dashboard.acknowledgeAlert(createdAlert.id, 'Test acknowledgment');
            const alerts = await dashboard.getAlerts();
            const acknowledgedAlert = alerts.find(a => a.id === createdAlert.id);
            expect(acknowledgedAlert?.acknowledged).toBe(true);
        });
        test('should handle different alert conditions', async () => {
            const conditions = [
                { metric: 'cost', operator: 'greater-than', threshold: 5.0 },
                { metric: 'error-rate', operator: 'greater-than-equal', threshold: 0.05 },
                { metric: 'success-rate', operator: 'less-than', threshold: 0.95 },
                { metric: 'active-connections', operator: 'equals', threshold: 0 }
            ];
            for (const [index, condition] of conditions.entries()) {
                await dashboard.createAlert({
                    name: `Test Alert ${index}`,
                    description: `Test alert for ${condition.operator}`,
                    condition,
                    severity: 'info',
                    enabled: true
                });
            }
            const alerts = await dashboard.getAlerts();
            expect(alerts).toHaveLength(4);
            // Test each condition type
            await dashboard.recordCostEvent('test', 6.0, 'test'); // Should trigger first alert
            await dashboard.recordMetric('error-rate', 0.06); // Should trigger second alert
            await dashboard.recordMetric('success-rate', 0.9); // Should trigger third alert
            await dashboard.recordMetric('active-connections', 0); // Should trigger fourth alert
            // Allow time for alert processing
            await new Promise(resolve => setTimeout(resolve, 200));
            const triggeredAlerts = await dashboard.getTriggeredAlerts();
            expect(triggeredAlerts.length).toBeGreaterThan(0);
        });
    });
    describe('Cost Analysis', () => {
        beforeEach(async () => {
            await dashboard.start();
            // Generate sample cost data
            const providers = ['openai', 'anthropic', 'local'];
            const models = ['gpt-3.5', 'gpt-4', 'claude-3', 'llama2'];
            for (let i = 0; i < 20; i++) {
                const provider = providers[i % providers.length];
                const model = models[i % models.length];
                const cost = Math.random() * 0.1;
                await dashboard.recordCostEvent('llm-call', cost, model, provider);
            }
        });
        test('should provide cost breakdown by provider', async () => {
            const analysis = await dashboard.getCostAnalysis('24h');
            expect(analysis.breakdown).toBeDefined();
            expect(analysis.breakdown.length).toBeGreaterThan(0);
            const hasOpenAI = analysis.breakdown.some(item => item.provider === 'openai');
            const hasAnthropic = analysis.breakdown.some(item => item.provider === 'anthropic');
            expect(hasOpenAI || hasAnthropic).toBe(true);
        });
        test('should calculate cost predictions', async () => {
            const analysis = await dashboard.getCostAnalysis('24h');
            expect(analysis.predictions).toBeDefined();
            expect(analysis.predictions.nextHour).toBeGreaterThanOrEqual(0);
            expect(analysis.predictions.nextDay).toBeGreaterThanOrEqual(0);
            expect(analysis.predictions.nextWeek).toBeGreaterThanOrEqual(0);
        });
        test('should identify cost optimization opportunities', async () => {
            const analysis = await dashboard.getCostAnalysis('24h');
            expect(analysis.optimizations).toBeDefined();
            expect(Array.isArray(analysis.optimizations)).toBe(true);
            if (analysis.optimizations.length > 0) {
                const optimization = analysis.optimizations[0];
                expect(optimization.type).toBeDefined();
                expect(optimization.description).toBeDefined();
                expect(optimization.potentialSaving).toBeGreaterThanOrEqual(0);
            }
        });
        test('should track cost trends', async () => {
            const analysis = await dashboard.getCostAnalysis('24h');
            expect(analysis.trends).toBeDefined();
            expect(analysis.trends.hourlyChange).toBeDefined();
            expect(analysis.trends.dailyChange).toBeDefined();
            expect(typeof analysis.trends.direction).toBe('string');
        });
    });
    describe('Performance Monitoring', () => {
        beforeEach(async () => {
            await dashboard.start();
            // Generate performance data
            const metrics = ['response-time', 'tokens-per-second', 'queue-length', 'cpu-usage'];
            for (let i = 0; i < 30; i++) {
                for (const metric of metrics) {
                    const value = Math.random() * 100;
                    await dashboard.recordPerformanceMetric(metric, value);
                }
            }
        });
        test('should calculate performance statistics', async () => {
            const metrics = await dashboard.getPerformanceMetrics('1h');
            expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
            expect(metrics.p95ResponseTime).toBeGreaterThanOrEqual(metrics.averageResponseTime);
            expect(metrics.throughput).toBeGreaterThanOrEqual(0);
            expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
        });
        test('should track performance trends', async () => {
            const metrics = await dashboard.getPerformanceMetrics('1h');
            expect(metrics.trends).toBeDefined();
            expect(metrics.trends.responseTimeChange).toBeDefined();
            expect(metrics.trends.throughputChange).toBeDefined();
            expect(typeof metrics.trends.direction).toBe('string');
        });
        test('should identify performance bottlenecks', async () => {
            const metrics = await dashboard.getPerformanceMetrics('1h');
            expect(metrics.bottlenecks).toBeDefined();
            expect(Array.isArray(metrics.bottlenecks)).toBe(true);
        });
        test('should provide performance recommendations', async () => {
            const metrics = await dashboard.getPerformanceMetrics('1h');
            expect(metrics.recommendations).toBeDefined();
            expect(Array.isArray(metrics.recommendations)).toBe(true);
        });
    });
    describe('Data Export and Import', () => {
        beforeEach(async () => {
            await dashboard.start();
        });
        test('should export dashboard configuration', async () => {
            // Create some widgets and alerts
            await dashboard.createWidget({
                id: 'export-widget',
                type: 'line-chart',
                title: 'Export Test Widget',
                position: { x: 0, y: 0, width: 6, height: 4 },
                config: { metric: 'cost' }
            });
            await dashboard.createAlert({
                name: 'Export Test Alert',
                description: 'Test alert for export',
                condition: { metric: 'cost', operator: 'greater-than', threshold: 1.0 },
                severity: 'info',
                enabled: true
            });
            const exportData = await dashboard.exportConfiguration();
            expect(exportData.widgets).toHaveLength(1);
            expect(exportData.alerts).toHaveLength(1);
            expect(exportData.config).toBeDefined();
            expect(exportData.exportedAt).toBeInstanceOf(Date);
        });
        test('should import dashboard configuration', async () => {
            const importData = {
                widgets: [{
                        id: 'import-widget',
                        type: 'gauge',
                        title: 'Import Test Widget',
                        position: { x: 0, y: 0, width: 4, height: 4 },
                        config: { metric: 'performance' }
                    }],
                alerts: [{
                        name: 'Import Test Alert',
                        description: 'Imported alert',
                        condition: { metric: 'errors', operator: 'greater-than', threshold: 5 },
                        severity: 'warning',
                        enabled: true
                    }],
                config: {
                    updateInterval: 2000,
                    retentionPeriod: 172800000
                }
            };
            await dashboard.importConfiguration(importData);
            const widgets = await dashboard.getWidgets();
            const alerts = await dashboard.getAlerts();
            expect(widgets).toHaveLength(1);
            expect(widgets[0].id).toBe('import-widget');
            expect(alerts).toHaveLength(1);
            expect(alerts[0].name).toBe('Import Test Alert');
        });
        test('should export metrics data in different formats', async () => {
            // Generate some metrics data
            for (let i = 0; i < 10; i++) {
                await dashboard.recordCostEvent('export-test', 0.05, 'test-model');
            }
            const csvData = await dashboard.exportMetrics('csv', '1h');
            const jsonData = await dashboard.exportMetrics('json', '1h');
            expect(typeof csvData).toBe('string');
            expect(csvData).toContain('timestamp');
            expect(csvData).toContain('cost');
            expect(typeof jsonData).toBe('string');
            const parsedJson = JSON.parse(jsonData);
            expect(Array.isArray(parsedJson)).toBe(true);
        });
    });
    describe('WebSocket Communication', () => {
        beforeEach(async () => {
            await dashboard.start();
        });
        test('should handle WebSocket connections', async () => {
            const ws = mockWebSocket;
            dashboard.subscribeToUpdates(ws);
            expect(dashboard.getConnectionCount()).toBeGreaterThan(0);
        });
        test('should broadcast real-time updates', async () => {
            const ws = mockWebSocket;
            dashboard.subscribeToUpdates(ws);
            await dashboard.recordCostEvent('broadcast-test', 0.1, 'test-model');
            expect(ws.send).toHaveBeenCalled();
            const message = JSON.parse(ws.send.mock.calls[0][0]);
            expect(message.type).toBe('metrics-update');
        });
        test('should handle client subscriptions', async () => {
            const ws = mockWebSocket;
            dashboard.subscribeToUpdates(ws);
            // Send subscription message
            dashboard.handleClientMessage(ws, JSON.stringify({
                type: 'subscribe',
                channels: ['cost-updates', 'performance-updates']
            }));
            await dashboard.recordCostEvent('subscription-test', 0.05, 'test-model');
            expect(ws.send).toHaveBeenCalled();
        });
        test('should handle WebSocket disconnections', async () => {
            const ws = mockWebSocket;
            dashboard.subscribeToUpdates(ws);
            const initialCount = dashboard.getConnectionCount();
            dashboard.handleClientDisconnect(ws);
            expect(dashboard.getConnectionCount()).toBe(initialCount - 1);
        });
    });
    describe('Data Retention and Cleanup', () => {
        beforeEach(async () => {
            await dashboard.start();
        });
        test('should clean up old metrics data', async () => {
            // Create old data
            const oldTimestamp = new Date(Date.now() - 2 * 86400000); // 2 days ago
            await dashboard.recordCostEventWithTimestamp('old-test', 0.1, 'old-model', oldTimestamp);
            // Create recent data
            await dashboard.recordCostEvent('recent-test', 0.05, 'recent-model');
            await dashboard.cleanupOldData();
            const metrics = await dashboard.getCostAnalysis('24h');
            // Old data should be cleaned up based on retention policy
            expect(metrics.totalCost).toBeGreaterThan(0); // Recent data should remain
        });
        test('should maintain data within retention period', async () => {
            const retentionPeriod = dashboard.getConfiguration().retentionPeriod;
            expect(retentionPeriod).toBe(86400000); // 24 hours
            const dataAge = await dashboard.getOldestDataAge();
            expect(dataAge).toBeLessThanOrEqual(retentionPeriod);
        });
    });
});
