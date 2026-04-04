// Intelligent Hybrid Router for Claude + Local Models
import { ClaudeProvider } from './providers/claude-provider';
import { LocalLLMRouter } from './local-llm-router';
export class HybridIntelligenceRouter {
    claudeProvider;
    localRouter;
    knowledgeBase;
    routingMetrics;
    learningData;
    constructor(claudeApiKey, localConfig, knowledgeBase) {
        this.claudeProvider = new ClaudeProvider(claudeApiKey);
        this.localRouter = new LocalLLMRouter(localConfig, {});
        this.knowledgeBase = knowledgeBase;
        this.routingMetrics = this.initializeMetrics();
        this.learningData = [];
    }
    async initialize() {
        await this.loadRoutingHistory();
    }
    async routeRequest(request) {
        const analysis = await this.analyzeRequest(request);
        const decision = await this.makeRoutingDecision(analysis, request);
        // Learn from this decision for future improvements
        this.recordRoutingDecision(request, decision, analysis);
        return decision;
    }
    async processRequest(request) {
        const choice = await this.routeRequest(request);
        const startTime = Date.now();
        try {
            let response;
            if (choice.provider === 'claude') {
                response = await this.claudeProvider.generateResponse({
                    prompt: request.query,
                    task: request.task,
                    context: request.context
                });
            }
            else {
                response = await this.localRouter.processRequest({
                    prompt: request.query,
                    context: request.context
                });
            }
            // Update metrics
            await this.updateMetrics(choice, response, Date.now() - startTime);
            return {
                ...response,
                routingDecision: choice
            };
        }
        catch (error) {
            // Handle fallback routing
            return await this.handleFailover(request, choice, error);
        }
    }
    async analyzeRequest(request) {
        const analysis = {
            complexity: await this.assessComplexity(request),
            domain: await this.identifyDomain(request),
            requiredCapabilities: await this.analyzeRequiredCapabilities(request),
            knowledgeAvailable: await this.checkKnowledgeAvailability(request),
            userPreferences: await this.getUserPreferences(request),
            contextSize: request.context?.length || 0,
            urgency: this.assessUrgency(request)
        };
        return analysis;
    }
    async makeRoutingDecision(analysis, request) {
        // Privacy first - sensitive data stays local
        if (request.privacy === 'sensitive') {
            return {
                provider: 'local',
                model: await this.selectOptimalLocalModel(analysis),
                reasoning: 'Privacy requirement: sensitive data must stay local',
                estimatedCost: 0,
                estimatedLatency: 500,
                confidence: 0.9
            };
        }
        // Speed priority - use local if possible
        if (request.priority === 'speed' && request.maxLatency && request.maxLatency < 1000) {
            if (analysis.knowledgeAvailable && analysis.complexity !== 'high') {
                return {
                    provider: 'local',
                    model: await this.selectFastLocalModel(),
                    reasoning: 'Speed priority: local model can handle this quickly',
                    estimatedCost: 0,
                    estimatedLatency: 300,
                    confidence: 0.85
                };
            }
        }
        // Cost priority - prefer local when quality is sufficient
        if (request.priority === 'cost') {
            const localCapability = await this.assessLocalCapability(analysis);
            if (localCapability > 0.7) {
                return {
                    provider: 'local',
                    model: await this.selectOptimalLocalModel(analysis),
                    reasoning: 'Cost priority: local model has sufficient capability',
                    estimatedCost: 0,
                    estimatedLatency: 400,
                    confidence: localCapability
                };
            }
        }
        // Quality priority or complex tasks - consider Claude
        if (request.priority === 'quality' || analysis.complexity === 'high') {
            const costEstimate = this.estimateClaudeCost(request);
            if (!request.maxCost || costEstimate <= request.maxCost) {
                return {
                    provider: 'claude',
                    reasoning: 'Quality priority: Claude excels at complex reasoning',
                    estimatedCost: costEstimate,
                    estimatedLatency: 2000,
                    confidence: 0.95
                };
            }
        }
        // Specific Claude strengths
        if (this.requiresClaudeSkills(analysis)) {
            return {
                provider: 'claude',
                reasoning: 'Task requires Claude-specific capabilities',
                estimatedCost: this.estimateClaudeCost(request),
                estimatedLatency: 2000,
                confidence: 0.9
            };
        }
        // Default to local with fallback
        return {
            provider: 'local',
            model: await this.selectOptimalLocalModel(analysis),
            reasoning: 'Default local processing with Claude fallback available',
            estimatedCost: 0,
            estimatedLatency: 500,
            confidence: 0.75
        };
    }
    async assessComplexity(request) {
        if (request.complexity)
            return request.complexity;
        const complexityIndicators = {
            high: [
                'analyze architecture', 'design system', 'multi-step reasoning',
                'complex algorithm', 'performance optimization', 'security analysis',
                'code review', 'architectural decision'
            ],
            medium: [
                'explain code', 'generate tests', 'refactor', 'debug',
                'write function', 'api design'
            ],
            low: [
                'simple question', 'format code', 'basic explanation',
                'quick fix', 'syntax help'
            ]
        };
        const query = request.query.toLowerCase();
        for (const [level, indicators] of Object.entries(complexityIndicators)) {
            if (indicators.some(indicator => query.includes(indicator))) {
                return level;
            }
        }
        // Use query length and structure as fallback
        if (request.query.length > 500 || request.query.split('?').length > 2) {
            return 'high';
        }
        else if (request.query.length > 100) {
            return 'medium';
        }
        else {
            return 'low';
        }
    }
    async identifyDomain(request) {
        const domainKeywords = {
            'web_development': ['react', 'html', 'css', 'javascript', 'frontend'],
            'backend': ['api', 'server', 'database', 'nodejs', 'express'],
            'mobile': ['ios', 'android', 'swift', 'kotlin', 'react native'],
            'data_science': ['python', 'pandas', 'machine learning', 'data analysis'],
            'devops': ['docker', 'kubernetes', 'deployment', 'ci/cd'],
            'security': ['authentication', 'encryption', 'vulnerability', 'security']
        };
        const query = request.query.toLowerCase();
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            if (keywords.some(keyword => query.includes(keyword))) {
                return domain;
            }
        }
        return 'general';
    }
    requiresClaudeSkills(analysis) {
        const claudeStrengths = [
            'complex_reasoning', 'ethical_considerations', 'creative_writing',
            'architectural_analysis', 'comprehensive_code_review',
            'multi_modal_analysis', 'safety_analysis'
        ];
        return analysis.requiredCapabilities.some(cap => claudeStrengths.includes(cap));
    }
    async handleFailover(request, originalChoice, error) {
        console.log(`Failover triggered: ${originalChoice.provider} failed with ${error.message}`);
        // Try alternative provider
        const fallbackChoice = originalChoice.provider === 'claude'
            ? {
                provider: 'local',
                model: await this.selectOptimalLocalModel(await this.analyzeRequest(request)),
                reasoning: 'Fallback to local due to Claude failure',
                estimatedCost: 0,
                estimatedLatency: 500,
                confidence: 0.6
            }
            : {
                provider: 'claude',
                reasoning: 'Fallback to Claude due to local failure',
                estimatedCost: this.estimateClaudeCost(request),
                estimatedLatency: 2000,
                confidence: 0.8
            };
        try {
            if (fallbackChoice.provider === 'claude') {
                return await this.claudeProvider.generateResponse({
                    prompt: request.query,
                    task: request.task,
                    context: request.context
                });
            }
            else {
                return await this.localRouter.processRequest({
                    prompt: request.query,
                    context: request.context
                });
            }
        }
        catch (fallbackError) {
            return {
                response: `Both providers failed. Original: ${error.message}, Fallback: ${fallbackError.message}`,
                provider: 'error',
                cost: 0,
                tokens: 0,
                executionTime: 0,
                isLocal: false,
                error: 'Total system failure'
            };
        }
    }
    // Learning and optimization methods
    recordRoutingDecision(request, choice, analysis) {
        this.learningData.push({
            timestamp: Date.now(),
            request,
            choice,
            analysis,
            outcome: null // Will be updated when response is evaluated
        });
        // Keep only recent decisions for learning
        if (this.learningData.length > 1000) {
            this.learningData = this.learningData.slice(-800);
        }
    }
    async getRoutingMetrics() {
        return this.routingMetrics;
    }
    async optimizeRouting() {
        const recentDecisions = this.learningData.slice(-100);
        const analysis = {
            accuracyByComplexity: this.analyzeAccuracyByComplexity(recentDecisions),
            costEfficiencyTrends: this.analyzeCostTrends(recentDecisions),
            latencyPatterns: this.analyzeLatencyPatterns(recentDecisions),
            userSatisfactionCorrelation: this.analyzeUserSatisfaction(recentDecisions)
        };
        const optimizations = {
            routingRuleAdjustments: this.suggestRoutingRules(analysis),
            modelSelectionImprovements: this.suggestModelOptimizations(analysis),
            costOptimizationOpportunities: this.identifyCostOptimizations(analysis)
        };
        return {
            currentPerformance: analysis,
            recommendedOptimizations: optimizations,
            estimatedImpact: this.estimateOptimizationImpact(optimizations)
        };
    }
    // Utility methods
    initializeMetrics() {
        return {
            totalRequests: 0,
            claudeRequests: 0,
            localRequests: 0,
            averageCost: 0,
            averageLatency: 0,
            costSavings: 0,
            successRate: 0,
            userSatisfaction: 0
        };
    }
    estimateClaudeCost(request) {
        const baseTokens = Math.ceil(request.query.length / 4);
        const contextTokens = Math.ceil((request.context?.length || 0) / 4);
        const estimatedOutputTokens = Math.min(baseTokens * 2, 1000);
        const inputCost = ((baseTokens + contextTokens) / 1000) * 0.003;
        const outputCost = (estimatedOutputTokens / 1000) * 0.015;
        return inputCost + outputCost;
    }
    // Placeholder methods for implementation
    async analyzeRequiredCapabilities(request) { return []; }
    async checkKnowledgeAvailability(request) { return true; }
    async getUserPreferences(request) { return {}; }
    assessUrgency(request) { return 'medium'; }
    async selectOptimalLocalModel(analysis) { return 'llama2'; }
    async selectFastLocalModel() { return 'llama2'; }
    async assessLocalCapability(analysis) { return 0.8; }
    async updateMetrics(choice, response, latency) { }
    async loadRoutingHistory() { }
    analyzeAccuracyByComplexity(decisions) { return {}; }
    analyzeCostTrends(decisions) { return {}; }
    analyzeLatencyPatterns(decisions) { return {}; }
    analyzeUserSatisfaction(decisions) { return {}; }
    suggestRoutingRules(analysis) { return {}; }
    suggestModelOptimizations(analysis) { return {}; }
    identifyCostOptimizations(analysis) { return {}; }
    estimateOptimizationImpact(optimizations) { return {}; }
}
