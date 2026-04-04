// Hybrid reasoning system combining local and API models with intelligent routing
// FEATURE: Smart reasoning orchestration for cost-optimized LLM usage
import { CommonCommandHandler } from '@/utils/common-commands';
export class HybridReasoning {
    intelligence;
    rlmEngine;
    router;
    skillProvider;
    commandHandler;
    constructor(intelligence, rlmEngine, router, skillProvider) {
        this.intelligence = intelligence;
        this.rlmEngine = rlmEngine;
        this.router = router;
        this.skillProvider = skillProvider;
        this.commandHandler = new CommonCommandHandler();
    }
    async processQuery(request, cwd) {
        const startTime = Date.now();
        // First, check if this is a simple command that can be handled directly
        const commandResult = await this.commandHandler.handleCommand(request.query, cwd);
        if (commandResult) {
            return {
                answer: commandResult.output,
                modelUsed: 'built-in-command',
                isLocal: true,
                cost: 0,
                tokensUsed: 0,
                stepsExecuted: 1,
                confidence: commandResult.success ? 1.0 : 0.5,
                executionTimeMs: Date.now() - startTime,
                skillsUsed: [],
            };
        }
        // Step 1: Build rich context using unified intelligence
        const contextPackage = await this.buildIntelligentContext(request);
        // Step 1.5: Enrich context with skills
        const skillUsageSummaries = await this.enrichContextWithSkills(request.query, contextPackage);
        // Step 2: Determine reasoning strategy (skills may influence this)
        const strategy = this.selectReasoningStrategy(request, contextPackage);
        // Step 3: Execute reasoning
        let response;
        switch (strategy.type) {
            case 'direct-local':
                response = await this.executeDirectLocal(request, contextPackage);
                break;
            case 'recursive-local':
                response = await this.executeRecursiveLocal(request, contextPackage);
                break;
            case 'hybrid':
                response = await this.executeHybrid(request, contextPackage);
                break;
            case 'api-fallback':
                response = await this.executeAPIFallback(request, contextPackage);
                break;
            default:
                throw new Error(`Unknown strategy: ${strategy.type}`);
        }
        // Step 4: Update memory with learnings
        await this.updateMemoryGraph(request, response);
        response.context = contextPackage;
        response.executionTimeMs = Date.now() - startTime;
        response.skillsUsed = skillUsageSummaries;
        response.cost += skillUsageSummaries.reduce((sum, s) => sum + s.cost, 0);
        return response;
    }
    async buildIntelligentContext(request) {
        const maxTokens = request.contextTokens || 3000;
        return this.intelligence.buildContextPackage(request.query, maxTokens);
    }
    selectReasoningStrategy(request, context) {
        // If a skill provided a high-confidence direct answer, use the cheapest strategy
        const hasDirectAnswer = context.skillEnrichments?.some(enrichment => enrichment.resultType === 'direct-answer' && enrichment.confidence >= 0.8);
        if (hasDirectAnswer) {
            return {
                type: 'direct-local',
                confidence: 0.95,
                reason: 'High-confidence skill provided a direct answer',
            };
        }
        const complexity = request.complexity || this.assessComplexity(request.query, context);
        const requiresReasoning = request.requiresReasoning ?? this.needsReasoning(request.query);
        const contextSize = context.estimatedTokens;
        // Simple queries with good context -> Direct local
        if (complexity === 'simple' && contextSize < 2000 && !requiresReasoning) {
            return {
                type: 'direct-local',
                confidence: 0.9,
                reason: 'Simple query with adequate context'
            };
        }
        // Complex queries that benefit from step-by-step reasoning -> Recursive local
        if (complexity !== 'simple' && requiresReasoning && request.preferLocal !== false) {
            return {
                type: 'recursive-local',
                confidence: 0.8,
                reason: 'Complex query requiring recursive reasoning'
            };
        }
        // Mixed complexity -> Hybrid approach
        if (complexity === 'medium' && contextSize > 1500) {
            return {
                type: 'hybrid',
                confidence: 0.7,
                reason: 'Medium complexity query with substantial context'
            };
        }
        // Fallback to API for very complex or critical queries
        return {
            type: 'api-fallback',
            confidence: 0.6,
            reason: 'High complexity or insufficient local confidence'
        };
    }
    async executeDirectLocal(request, context) {
        const llmRequest = {
            prompt: this.buildEnhancedPrompt(request.query, context),
            maxTokens: 1000,
            temperature: 0.3,
            preferLocal: true
        };
        const llmResponse = await this.router.processRequest(llmRequest);
        return {
            answer: llmResponse.content,
            modelUsed: llmResponse.model,
            isLocal: llmResponse.isLocal,
            cost: llmResponse.cost || 0,
            tokensUsed: llmResponse.tokens.total,
            stepsExecuted: 1,
            confidence: 0.85
        };
    }
    async executeRecursiveLocal(request, context) {
        const contextText = this.formatContextForRLM(context);
        const sessionId = await this.rlmEngine.startReasoningSession(request.query, contextText);
        const session = await this.rlmEngine.getSession(sessionId);
        if (!session) {
            throw new Error('Failed to start RLM session');
        }
        return {
            answer: session.result || 'No result available',
            reasoning: session,
            modelUsed: 'local-rlm',
            isLocal: true,
            cost: 0,
            tokensUsed: this.estimateRLMTokens(session),
            stepsExecuted: session.iterations.length,
            confidence: 0.8
        };
    }
    async executeHybrid(request, context) {
        // Use local model for initial analysis, API for final synthesis
        const initialRequest = {
            prompt: `Analyze this query and context, identify key points and potential approaches:\n\nQuery: ${request.query}\n\nContext: ${this.formatContextForPrompt(context)}`,
            maxTokens: 800,
            temperature: 0.2,
            preferLocal: true
        };
        const initialResponse = await this.router.processRequest(initialRequest);
        const finalRequest = {
            prompt: `Based on this analysis, provide a comprehensive answer:\n\nOriginal Query: ${request.query}\n\nAnalysis: ${initialResponse.content}`,
            maxTokens: 1200,
            temperature: 0.3,
            preferLocal: false
        };
        const finalResponse = await this.router.processRequest(finalRequest);
        return {
            answer: finalResponse.content,
            modelUsed: `${initialResponse.model} + ${finalResponse.model}`,
            isLocal: false,
            cost: (initialResponse.cost || 0) + (finalResponse.cost || 0),
            tokensUsed: initialResponse.tokens.total + finalResponse.tokens.total,
            stepsExecuted: 2,
            confidence: 0.9
        };
    }
    async executeAPIFallback(request, context) {
        const llmRequest = {
            prompt: this.buildEnhancedPrompt(request.query, context),
            maxTokens: 2000,
            temperature: 0.2,
            preferLocal: false
        };
        const llmResponse = await this.router.processRequest(llmRequest);
        return {
            answer: llmResponse.content,
            modelUsed: llmResponse.model,
            isLocal: false,
            cost: llmResponse.cost || 0,
            tokensUsed: llmResponse.tokens.total,
            stepsExecuted: 1,
            confidence: 0.95
        };
    }
    buildEnhancedPrompt(query, context) {
        const sections = [];
        if (context.relevantFiles.length > 0) {
            sections.push(`Relevant Files:\n${context.relevantFiles.join('\n')}`);
        }
        if (context.codeSymbols.length > 0) {
            const symbols = context.codeSymbols.slice(0, 10).map(s => `- ${s.name} (${s.kind}) in ${s.file}:${s.line}${s.signature ? `\n  ${s.signature}` : ''}`).join('\n');
            sections.push(`Key Code Symbols:\n${symbols}`);
        }
        if (context.semanticMatches.length > 0) {
            const matches = context.semanticMatches.slice(0, 5).map(m => `- ${m.content} (similarity: ${m.similarity.toFixed(2)})`).join('\n');
            sections.push(`Semantic Matches:\n${matches}`);
        }
        if (context.memoryNodes.length > 0) {
            const memories = context.memoryNodes.slice(0, 3).map(n => `- ${n.type}: ${n.content.slice(0, 200)}...`).join('\n');
            sections.push(`Related Knowledge:\n${memories}`);
        }
        if (context.skillEnrichments && context.skillEnrichments.length > 0) {
            const skillContext = context.skillEnrichments.map(enrichment => `- [${enrichment.skillName}] (confidence: ${enrichment.confidence.toFixed(2)}): ${enrichment.content.slice(0, 500)}`).join('\n');
            sections.push(`Skill-Provided Context:\n${skillContext}`);
        }
        const contextText = sections.length > 0 ? sections.join('\n\n') : 'No specific context available.';
        return `Context:\n${contextText}\n\nQuery: ${query}\n\nPlease provide a comprehensive answer based on the context provided.`;
    }
    formatContextForRLM(context) {
        return `
Project Context:
- Files: ${context.relevantFiles.join(', ')}
- Symbols: ${context.codeSymbols.length} code symbols found
- Memory: ${context.memoryNodes.length} related concepts
- Semantic matches: ${context.semanticMatches.length} relevant matches

Use this context to understand the codebase structure and relationships when answering the query.
`;
    }
    formatContextForPrompt(context) {
        return [
            `Files: ${context.relevantFiles.slice(0, 5).join(', ')}`,
            `Symbols: ${context.codeSymbols.slice(0, 3).map(s => s.name).join(', ')}`,
            `Memory: ${context.memoryNodes.slice(0, 2).map(n => n.content.slice(0, 100)).join('; ')}`
        ].join('\n');
    }
    assessComplexity(query, context) {
        let score = 0;
        // Query complexity indicators
        const complexWords = ['analyze', 'compare', 'design', 'implement', 'refactor', 'optimize', 'debug', 'explain why'];
        score += complexWords.filter(word => query.toLowerCase().includes(word)).length;
        // Context complexity
        score += Math.min(context.codeSymbols.length / 10, 2);
        score += Math.min(context.relevantFiles.length / 5, 2);
        score += Math.min(context.relationships.length / 15, 1);
        if (score < 2)
            return 'simple';
        if (score < 5)
            return 'medium';
        return 'complex';
    }
    needsReasoning(query) {
        const reasoningIndicators = [
            'why', 'how', 'what if', 'compare', 'analyze', 'explain',
            'step by step', 'process', 'algorithm', 'solve', 'debug'
        ];
        return reasoningIndicators.some(indicator => query.toLowerCase().includes(indicator));
    }
    estimateRLMTokens(session) {
        return session.iterations.reduce((total, iter) => total + this.estimateTokens(iter.prompt) + this.estimateTokens(iter.response), 0);
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    async enrichContextWithSkills(query, contextPackage) {
        if (!this.skillProvider)
            return [];
        try {
            const enrichments = await this.skillProvider.enrichQuery(query, contextPackage);
            const relevantEnrichments = enrichments.filter(enrichment => enrichment.confidence >= 0.3);
            contextPackage.skillEnrichments = relevantEnrichments.map(enrichment => ({
                skillId: enrichment.skillId,
                skillName: enrichment.skillName,
                content: enrichment.content,
                resultType: enrichment.resultType,
                confidence: enrichment.confidence,
            }));
            const additionalTokens = relevantEnrichments.reduce((sum, enrichment) => sum + Math.ceil(enrichment.content.length / 4), 0);
            contextPackage.estimatedTokens += additionalTokens;
            return relevantEnrichments.map(enrichment => ({
                skillId: enrichment.skillId,
                skillName: enrichment.skillName,
                executionTimeMs: enrichment.executionTimeMs,
                resultType: enrichment.resultType,
                cost: enrichment.cost,
            }));
        }
        catch (error) {
            console.warn('Skill enrichment failed, continuing without skills:', error);
            return [];
        }
    }
    async updateMemoryGraph(request, response) {
        const memoryId = `query_${Date.now()}`;
        const content = `Query: ${request.query}\nAnswer: ${response.answer.slice(0, 500)}`;
        await this.intelligence.updateMemory(memoryId, content, {
            type: 'reasoning_result',
            complexity: request.complexity,
            cost: response.cost,
            confidence: response.confidence,
            modelUsed: response.modelUsed
        });
    }
}
