// Local LLM router with intelligent API fallback and cost optimization  
// FEATURE: Smart routing between local models and API providers
import fetch from 'node-fetch';
export class LocalLLMRouter {
    localConfig;
    apiConfig;
    costMetrics;
    modelCapabilities;
    failureCount;
    constructor(localConfig, apiConfig) {
        this.localConfig = localConfig;
        this.apiConfig = apiConfig;
        this.costMetrics = {
            totalRequests: 0,
            localRequests: 0,
            apiRequests: 0,
            totalTokens: 0,
            localTokens: 0,
            apiTokens: 0,
            estimatedCost: 0,
            costSaved: 0,
            avgLatency: 0
        };
        this.modelCapabilities = new Map();
        this.failureCount = new Map();
        this.initializeModelCapabilities();
    }
    async processRequest(request) {
        const startTime = Date.now();
        const shouldUseLocal = this.shouldUseLocalModel(request);
        this.costMetrics.totalRequests++;
        let response;
        if (shouldUseLocal && request.preferLocal !== false) {
            try {
                response = await this.callLocalModel(request);
                this.costMetrics.localRequests++;
                this.costMetrics.localTokens += response.tokens.total;
                this.resetFailureCount('local');
            }
            catch (error) {
                console.warn('Local model failed, falling back to API:', error);
                this.incrementFailureCount('local');
                response = await this.callAPIModel(request);
                this.costMetrics.apiRequests++;
                this.costMetrics.apiTokens += response.tokens.total;
            }
        }
        else {
            response = await this.callAPIModel(request);
            this.costMetrics.apiRequests++;
            this.costMetrics.apiTokens += response.tokens.total;
        }
        const latency = Date.now() - startTime;
        response.latencyMs = latency;
        this.updateMetrics(response);
        return response;
    }
    shouldUseLocalModel(request) {
        const strategy = this.apiConfig.fallbackStrategy;
        if (strategy === 'local-first') {
            return this.isLocalModelHealthy() && this.canHandleRequest(request);
        }
        if (strategy === 'cost-optimized') {
            const hourlySpend = this.getHourlySpend();
            return hourlySpend > this.apiConfig.maxCostPerHour * 0.7;
        }
        if (strategy === 'hybrid') {
            return this.isSimpleRequest(request) && this.isLocalModelHealthy();
        }
        return true;
    }
    async callLocalModel(request) {
        const model = request.model || this.localConfig.models.primary;
        switch (this.localConfig.provider) {
            case 'ollama':
                return this.callOllama(request, model);
            case 'vllm':
                return this.callVLLM(request, model);
            case 'llamacpp':
                return this.callLlamaCpp(request, model);
            case 'lmstudio':
                return this.callLMStudio(request, model);
            default:
                // Default to LM Studio format
                return this.callLMStudio(request, model);
        }
    }
    async callOllama(request, model) {
        const url = `${this.localConfig.baseUrl}/api/generate`;
        const payload = {
            model,
            prompt: this.buildPrompt(request),
            options: {
                temperature: request.temperature || this.localConfig.temperature,
                num_predict: request.maxTokens || this.localConfig.maxTokens
            },
            stream: false
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: data.response,
            model,
            isLocal: true,
            tokens: {
                prompt: data.prompt_eval_count || this.estimateTokens(payload.prompt),
                completion: data.eval_count || this.estimateTokens(data.response),
                total: (data.prompt_eval_count || 0) + (data.eval_count || 0)
            },
            cost: 0,
            latencyMs: 0,
            metadata: {
                provider: 'ollama',
                evalDuration: data.eval_duration,
                loadDuration: data.load_duration
            }
        };
    }
    async callVLLM(request, model) {
        const url = `${this.localConfig.baseUrl}/v1/completions`;
        const payload = {
            model,
            prompt: this.buildPrompt(request),
            temperature: request.temperature || this.localConfig.temperature,
            max_tokens: request.maxTokens || this.localConfig.maxTokens,
            stream: false
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`vLLM request failed: ${response.statusText}`);
        }
        const data = await response.json();
        const choice = data.choices[0];
        return {
            content: choice.text,
            model,
            isLocal: true,
            tokens: {
                prompt: data.usage?.prompt_tokens || this.estimateTokens(payload.prompt),
                completion: data.usage?.completion_tokens || this.estimateTokens(choice.text),
                total: data.usage?.total_tokens || 0
            },
            cost: 0,
            latencyMs: 0,
            metadata: {
                provider: 'vllm',
                finishReason: choice.finish_reason
            }
        };
    }
    async callLlamaCpp(request, model) {
        // llama.cpp server uses OpenAI-compatible API format
        const url = `${this.localConfig.baseUrl}/v1/chat/completions`;
        const payload = {
            model,
            messages: [
                { role: 'user', content: this.buildPrompt(request) }
            ],
            temperature: request.temperature || this.localConfig.temperature,
            max_tokens: request.maxTokens || this.localConfig.maxTokens,
            stream: false
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`llama.cpp request failed: ${response.statusText}`);
        }
        const data = await response.json();
        const choice = data.choices[0];
        return {
            content: choice.message.content,
            model: data.model || model,
            isLocal: true,
            tokens: {
                prompt: data.usage?.prompt_tokens || this.estimateTokens(payload.messages[0].content),
                completion: data.usage?.completion_tokens || this.estimateTokens(choice.message.content),
                total: data.usage?.total_tokens || 0
            },
            cost: 0,
            latencyMs: 0,
            metadata: {
                provider: 'llamacpp',
                finishReason: choice.finish_reason
            }
        };
    }
    async callLMStudio(request, model) {
        // LM Studio uses OpenAI-compatible API format at default port 1234
        const url = `${this.localConfig.baseUrl}/v1/chat/completions`;
        const payload = {
            model,
            messages: [
                { role: 'user', content: this.buildPrompt(request) }
            ],
            temperature: request.temperature || this.localConfig.temperature,
            max_tokens: request.maxTokens || this.localConfig.maxTokens,
            stream: false
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`LM Studio request failed: ${response.statusText}`);
        }
        const data = await response.json();
        const choice = data.choices[0];
        return {
            content: choice.message.content,
            model: data.model || model,
            isLocal: true,
            tokens: {
                prompt: data.usage?.prompt_tokens || this.estimateTokens(payload.messages[0].content),
                completion: data.usage?.completion_tokens || this.estimateTokens(choice.message.content),
                total: data.usage?.total_tokens || 0
            },
            cost: 0,
            latencyMs: 0,
            metadata: {
                provider: 'lmstudio',
                finishReason: choice.finish_reason
            }
        };
    }
    async callAPIModel(request) {
        const providers = Object.keys(this.apiConfig.providers);
        for (const provider of providers) {
            try {
                return await this.callSpecificAPI(provider, request);
            }
            catch (error) {
                console.warn(`API provider ${provider} failed:`, error);
                continue;
            }
        }
        throw new Error('All API providers failed');
    }
    async callSpecificAPI(provider, request) {
        switch (provider) {
            case 'openai':
                return this.callOpenAI(request);
            case 'anthropic':
                return this.callAnthropic(request);
            case 'google':
                return this.callGoogle(request);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }
    async callOpenAI(request) {
        const config = this.apiConfig.providers.openai;
        const url = config.baseUrl || 'https://api.openai.com/v1/chat/completions';
        const payload = {
            model: request.model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: this.buildPrompt(request) }
            ],
            max_tokens: request.maxTokens,
            temperature: request.temperature
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`OpenAI API failed: ${response.statusText}`);
        }
        const data = await response.json();
        const choice = data.choices[0];
        return {
            content: choice.message.content,
            model: data.model,
            isLocal: false,
            tokens: {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens
            },
            cost: this.calculateOpenAICost(data.model, data.usage.total_tokens),
            latencyMs: 0
        };
    }
    async callAnthropic(request) {
        const config = this.apiConfig.providers.anthropic;
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: request.model || 'claude-3-haiku-20240307',
                max_tokens: request.maxTokens || 1000,
                messages: [{
                        role: 'user',
                        content: this.buildPrompt(request)
                    }]
            })
        });
        if (!response.ok) {
            throw new Error(`Anthropic API failed: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: data.content[0].text,
            model: data.model,
            isLocal: false,
            tokens: {
                prompt: data.usage.input_tokens,
                completion: data.usage.output_tokens,
                total: data.usage.input_tokens + data.usage.output_tokens
            },
            cost: this.calculateAnthropicCost(data.model, data.usage),
            latencyMs: 0
        };
    }
    async callGoogle(request) {
        // Implementation for Google AI API
        throw new Error('Google provider not implemented yet');
    }
    buildPrompt(request) {
        if (request.context) {
            return `Context:\n${request.context}\n\nQuery: ${request.prompt}`;
        }
        return request.prompt;
    }
    isLocalModelHealthy() {
        const localFailures = this.failureCount.get('local') || 0;
        return localFailures < 3;
    }
    canHandleRequest(request) {
        const model = request.model || this.localConfig.models.primary;
        const capabilities = this.modelCapabilities.get(model);
        if (!capabilities)
            return true;
        const promptTokens = this.estimateTokens(request.prompt);
        const maxTokens = request.maxTokens || 1000;
        return promptTokens + maxTokens <= capabilities.contextWindow;
    }
    isSimpleRequest(request) {
        const promptTokens = this.estimateTokens(request.prompt);
        const complexity = this.assessComplexity(request.prompt);
        return promptTokens < 2000 && complexity < 0.5;
    }
    assessComplexity(prompt) {
        const indicators = [
            'analyze', 'complex', 'detailed', 'comprehensive', 'elaborate',
            'compare', 'contrast', 'explain why', 'reasoning', 'logic'
        ];
        const matches = indicators.filter(word => prompt.toLowerCase().includes(word)).length;
        return Math.min(matches / indicators.length, 1.0);
    }
    getHourlySpend() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        // This would typically query a database of recent requests
        return this.costMetrics.estimatedCost; // Simplified
    }
    updateMetrics(response) {
        this.costMetrics.totalTokens += response.tokens.total;
        this.costMetrics.estimatedCost += response.cost || 0;
        if (response.isLocal) {
            const estimatedAPICost = this.estimateAPICost(response.tokens.total);
            this.costMetrics.costSaved += estimatedAPICost;
        }
        const totalLatency = this.costMetrics.avgLatency * (this.costMetrics.totalRequests - 1);
        this.costMetrics.avgLatency = (totalLatency + response.latencyMs) / this.costMetrics.totalRequests;
    }
    estimateAPICost(tokens) {
        return tokens * 0.0001; // $0.0001 per token estimate
    }
    calculateOpenAICost(model, tokens) {
        const rates = {
            'gpt-4o': 0.005,
            'gpt-4o-mini': 0.0015,
            'gpt-4-turbo': 0.01,
            'gpt-3.5-turbo': 0.001
        };
        return (rates[model] || rates['gpt-4o-mini']) * (tokens / 1000);
    }
    calculateAnthropicCost(model, usage) {
        const inputRate = model.includes('haiku') ? 0.00025 : 0.003;
        const outputRate = model.includes('haiku') ? 0.00125 : 0.015;
        return (usage.input_tokens * inputRate + usage.output_tokens * outputRate) / 1000;
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    incrementFailureCount(provider) {
        const current = this.failureCount.get(provider) || 0;
        this.failureCount.set(provider, current + 1);
    }
    resetFailureCount(provider) {
        this.failureCount.set(provider, 0);
    }
    initializeModelCapabilities() {
        this.modelCapabilities.set('llama3.2', {
            contextWindow: 8192,
            maxTokens: 4096,
            supportsCode: true,
            supportsReasoning: true
        });
        this.modelCapabilities.set('codellama', {
            contextWindow: 16384,
            maxTokens: 8192,
            supportsCode: true,
            supportsReasoning: false
        });
    }
    getCostMetrics() {
        return { ...this.costMetrics };
    }
}
