// Cost tracking and optimization analysis for LLM usage
// FEATURE: API cost monitoring and local model optimization recommendations
import * as fs from 'fs/promises';
import * as path from 'path';
export class CostTracker {
    apiConfig;
    events = [];
    persistPath;
    constructor(apiConfig) {
        this.apiConfig = apiConfig;
        this.persistPath = '.llm-charge/cost-tracking.json';
        this.loadHistoricalData();
    }
    recordRequest(event) {
        const costEvent = {
            ...event,
            timestamp: new Date(),
            success: true
        };
        this.events.push(costEvent);
        this.persistData();
        if (this.apiConfig.trackUsage) {
            this.checkCostThresholds(costEvent);
        }
    }
    recordFailure(isLocal, model, query) {
        const costEvent = {
            timestamp: new Date(),
            isLocal,
            cost: 0,
            tokens: 0,
            model,
            latencyMs: 0,
            query,
            success: false
        };
        this.events.push(costEvent);
        this.persistData();
    }
    getMetrics(timeframe = 'day') {
        const cutoff = this.getCutoffDate(timeframe);
        const relevantEvents = this.events.filter(e => e.timestamp >= cutoff && e.success);
        const totalRequests = relevantEvents.length;
        const localRequests = relevantEvents.filter(e => e.isLocal).length;
        const apiRequests = totalRequests - localRequests;
        const totalTokens = relevantEvents.reduce((sum, e) => sum + e.tokens, 0);
        const localTokens = relevantEvents.filter(e => e.isLocal).reduce((sum, e) => sum + e.tokens, 0);
        const apiTokens = totalTokens - localTokens;
        const estimatedCost = relevantEvents.reduce((sum, e) => sum + e.cost, 0);
        const costSaved = this.calculateSavedCosts(relevantEvents);
        const avgLatency = totalRequests > 0
            ? relevantEvents.reduce((sum, e) => sum + e.latencyMs, 0) / totalRequests
            : 0;
        return {
            totalRequests,
            localRequests,
            apiRequests,
            totalTokens,
            localTokens,
            apiTokens,
            estimatedCost,
            costSaved,
            avgLatency
        };
    }
    analyzeUsage(depth = 'basic') {
        const recentEvents = this.events.filter(e => e.timestamp >= this.getCutoffDate('week'));
        const localEvents = recentEvents.filter(e => e.isLocal && e.success);
        const localFailures = recentEvents.filter(e => e.isLocal && !e.success);
        const localSuccessRate = localEvents.length / (localEvents.length + localFailures.length);
        const totalSavings = this.calculateSavedCosts(recentEvents);
        const modelUsage = this.analyzeModelUsage(recentEvents);
        const recommendedModels = Object.entries(modelUsage)
            .filter(([model, stats]) => stats.successRate > 0.8 && stats.avgCost < 0.001)
            .map(([model]) => model)
            .slice(0, 3);
        const costTrends = {
            hourly: this.getCostTrends('hour', 24),
            daily: this.getCostTrends('day', 7)
        };
        const suggestions = this.generateSuggestions(recentEvents, localSuccessRate, totalSavings);
        return {
            totalSavings,
            localSuccessRate,
            recommendedModels,
            costTrends,
            suggestions
        };
    }
    getHourlyCost() {
        const oneHourAgo = this.getCutoffDate('hour');
        const recentEvents = this.events.filter(e => e.timestamp >= oneHourAgo && e.success);
        return recentEvents.reduce((sum, e) => sum + e.cost, 0);
    }
    calculateSavedCosts(events) {
        const localEvents = events.filter(e => e.isLocal && e.success);
        return localEvents.reduce((savings, event) => {
            const estimatedAPICost = this.estimateAPICost(event.tokens, 'gpt-4o-mini');
            return savings + estimatedAPICost;
        }, 0);
    }
    estimateAPICost(tokens, model) {
        const rates = {
            'gpt-4o': 0.005,
            'gpt-4o-mini': 0.0015,
            'claude-3-haiku': 0.00025,
            'claude-3-sonnet': 0.003
        };
        return (rates[model] || rates['gpt-4o-mini']) * (tokens / 1000);
    }
    analyzeModelUsage(events) {
        const modelStats = {};
        for (const event of events) {
            if (!modelStats[event.model]) {
                modelStats[event.model] = {
                    totalRequests: 0,
                    successfulRequests: 0,
                    totalCost: 0,
                    totalTokens: 0,
                    totalLatency: 0,
                    successRate: 0,
                    avgCost: 0,
                    avgLatency: 0
                };
            }
            const stats = modelStats[event.model];
            stats.totalRequests++;
            stats.totalCost += event.cost;
            stats.totalTokens += event.tokens;
            stats.totalLatency += event.latencyMs;
            if (event.success) {
                stats.successfulRequests++;
            }
        }
        // Calculate averages
        for (const stats of Object.values(modelStats)) {
            stats.successRate = stats.successfulRequests / stats.totalRequests;
            stats.avgCost = stats.totalCost / stats.totalRequests;
            stats.avgLatency = stats.totalLatency / stats.totalRequests;
        }
        return modelStats;
    }
    getCostTrends(period, count) {
        const trends = [];
        for (let i = count - 1; i >= 0; i--) {
            const cutoff = new Date();
            if (period === 'hour') {
                cutoff.setHours(cutoff.getHours() - i);
                cutoff.setMinutes(0, 0, 0);
            }
            else {
                cutoff.setDate(cutoff.getDate() - i);
                cutoff.setHours(0, 0, 0, 0);
            }
            const nextCutoff = new Date(cutoff);
            if (period === 'hour') {
                nextCutoff.setHours(nextCutoff.getHours() + 1);
            }
            else {
                nextCutoff.setDate(nextCutoff.getDate() + 1);
            }
            const periodEvents = this.events.filter(e => e.timestamp >= cutoff && e.timestamp < nextCutoff && e.success);
            const periodCost = periodEvents.reduce((sum, e) => sum + e.cost, 0);
            trends.push(periodCost);
        }
        return trends;
    }
    generateSuggestions(events, localSuccessRate, totalSavings) {
        const suggestions = [];
        if (localSuccessRate < 0.7) {
            suggestions.push('Consider upgrading local model hardware or switching to a more capable model');
        }
        if (totalSavings < 1.0) {
            suggestions.push('Local model usage is low - consider routing more simple queries locally');
        }
        const apiCost = events.filter(e => !e.isLocal).reduce((sum, e) => sum + e.cost, 0);
        if (apiCost > this.apiConfig.maxCostPerHour) {
            suggestions.push('API costs are high - consider increasing local model usage');
        }
        const complexQueries = events.filter(e => e.query && (e.query.includes('analyze') || e.query.includes('complex')));
        if (complexQueries.length > events.length * 0.3) {
            suggestions.push('Many complex queries detected - consider using RLM for step-by-step reasoning');
        }
        const slowQueries = events.filter(e => e.latencyMs > 10000);
        if (slowQueries.length > events.length * 0.1) {
            suggestions.push('Some queries are slow - consider caching frequent patterns');
        }
        return suggestions;
    }
    checkCostThresholds(event) {
        const hourlyCost = this.getHourlyCost();
        if (hourlyCost > this.apiConfig.maxCostPerHour) {
            console.warn(`Hourly cost threshold exceeded: $${hourlyCost.toFixed(4)}`);
            // Could trigger local-first mode or notifications
        }
    }
    getCutoffDate(timeframe) {
        const cutoff = new Date();
        switch (timeframe) {
            case 'hour':
                cutoff.setHours(cutoff.getHours() - 1);
                break;
            case 'day':
                cutoff.setDate(cutoff.getDate() - 1);
                break;
            case 'week':
                cutoff.setDate(cutoff.getDate() - 7);
                break;
        }
        return cutoff;
    }
    async persistData() {
        try {
            const dir = path.dirname(this.persistPath);
            await fs.mkdir(dir, { recursive: true });
            // Keep only last 10000 events to prevent unbounded growth
            const eventsToSave = this.events.slice(-10000);
            await fs.writeFile(this.persistPath, JSON.stringify(eventsToSave, null, 2));
        }
        catch (error) {
            console.warn('Failed to persist cost tracking data:', error);
        }
    }
    async loadHistoricalData() {
        try {
            const data = await fs.readFile(this.persistPath, 'utf-8');
            const events = JSON.parse(data);
            this.events = events.map((e) => ({
                ...e,
                timestamp: new Date(e.timestamp)
            }));
        }
        catch (error) {
            // No historical data available
            this.events = [];
        }
    }
}
