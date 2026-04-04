// Unified MCP server exposing all LLM-Charge capabilities to AI assistants
// FEATURE: Model Context Protocol integration for seamless AI assistant usage
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { UnifiedIntelligence } from '@/intelligence/unified-intelligence';
import { DocsIntelligence } from '@/intelligence/docs-intelligence';
import { HybridReasoning } from '@/reasoning/hybrid-reasoning';
import { RLMEngine } from '@/reasoning/rlm-engine';
import { LocalLLMRouter } from '@/reasoning/local-llm-router';
import { MCPSkillEnrichmentAdapter } from '@/reasoning/mcp-skill-enrichment-adapter';
import { MCPClientManager, MCPSkillOrchestrator } from './client-tools';
import { CostTracker } from '@/utils/cost-tracker';
import { CommonCommandHandler } from '@/utils/common-commands';
import { KnowledgeBase } from '@/core/knowledge-base';
import { docsTools } from './docs-tools';
import { ReactDevTools } from '../react-tools';
export class LLMChargeServer {
    config;
    projectPath;
    server;
    intelligence;
    docsIntelligence;
    reasoning;
    costTracker;
    commandHandler;
    knowledgeBase;
    reactDevTools;
    initialized = false;
    constructor(config, projectPath) {
        this.config = config;
        this.projectPath = projectPath;
        this.server = new Server({
            name: 'llm-charge',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {},
                resources: {}
            }
        });
        this.setupToolHandlers();
    }
    async start() {
        if (!this.initialized) {
            await this.initialize();
        }
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('LLM-Charge MCP server started');
    }
    async initialize() {
        console.log('Initializing LLM-Charge server...');
        // Initialize shared knowledge base
        this.knowledgeBase = new KnowledgeBase(this.config.intelligence.knowledgeBase?.path || './knowledge.db');
        await this.knowledgeBase.initialize();
        // Initialize intelligence engines
        this.intelligence = new UnifiedIntelligence(this.config.intelligence);
        await this.intelligence.initialize(this.projectPath);
        // Initialize documentation intelligence
        this.docsIntelligence = new DocsIntelligence(this.projectPath, this.knowledgeBase);
        await this.docsIntelligence.initialize();
        // Initialize reasoning engines
        const rlmEngine = new RLMEngine(this.config.reasoning);
        await rlmEngine.initialize();
        const router = new LocalLLMRouter(this.config.local, this.config.api);
        // Initialize skill enrichment provider (optional, reasoning works without it)
        let skillProvider;
        try {
            const clientManager = new MCPClientManager({
                serverCommand: 'node',
                costTracking: true,
                validationLevel: 'basic',
                caching: { enabled: true, ttl: 300, maxSize: 100 },
            });
            const orchestrator = new MCPSkillOrchestrator(clientManager);
            skillProvider = new MCPSkillEnrichmentAdapter(orchestrator);
            console.log('Skill enrichment provider initialized');
        }
        catch (error) {
            console.warn('Skill enrichment not available, reasoning will proceed without skills:', error);
        }
        this.reasoning = new HybridReasoning(this.intelligence, rlmEngine, router, skillProvider);
        // Initialize cost tracking
        this.costTracker = new CostTracker(this.config.api);
        // Initialize common command handler
        this.commandHandler = new CommonCommandHandler();
        // Initialize React development tools
        this.reactDevTools = new ReactDevTools({
            projectPath: this.projectPath,
            defaultComponentPath: 'components',
            includeTestsByDefault: true,
            includeStorybookByDefault: false
        });
        this.initialized = true;
        console.log('LLM-Charge server initialized successfully');
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                // Intelligence Tools
                {
                    name: 'build_context_package',
                    description: 'Build comprehensive context package with code symbols, relationships, and semantic matches',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'The query to build context for' },
                            maxTokens: { type: 'number', description: 'Maximum tokens for context (default: 4000)' },
                            includeMemory: { type: 'boolean', description: 'Include memory graph results (default: true)' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_code_symbols',
                    description: 'Search for code symbols across the codebase using structural and semantic analysis',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query for code symbols' },
                            kind: { type: 'string', description: 'Filter by symbol kind (function, class, method, etc.)' },
                            limit: { type: 'number', description: 'Maximum results to return (default: 20)' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'get_context_tree',
                    description: 'Get hierarchical view of project structure with symbol information',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Specific path to focus on (optional)' },
                            maxDepth: { type: 'number', description: 'Maximum depth to traverse (default: 3)' }
                        }
                    }
                },
                {
                    name: 'get_file_skeleton',
                    description: 'Get function signatures and class definitions from a file without full content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            filePath: { type: 'string', description: 'Path to the file to analyze' }
                        },
                        required: ['filePath']
                    }
                },
                {
                    name: 'get_blast_radius',
                    description: 'Find all files and symbols that would be affected by changes to a symbol',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            symbolId: { type: 'string', description: 'ID of the symbol to analyze' },
                            depth: { type: 'number', description: 'Analysis depth (default: 2)' }
                        },
                        required: ['symbolId']
                    }
                },
                {
                    name: 'semantic_navigate',
                    description: 'Browse codebase by semantic similarity using clustering',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Semantic navigation query' }
                        },
                        required: ['query']
                    }
                },
                // Reasoning Tools  
                {
                    name: 'hybrid_reasoning',
                    description: 'Execute intelligent reasoning with automatic local/API routing for cost optimization',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'The query to reason about' },
                            complexity: { type: 'string', enum: ['simple', 'medium', 'complex'], description: 'Expected complexity level' },
                            requiresReasoning: { type: 'boolean', description: 'Whether step-by-step reasoning is needed' },
                            preferLocal: { type: 'boolean', description: 'Prefer local models when possible' },
                            maxSteps: { type: 'number', description: 'Maximum reasoning steps (default: 5)' },
                            contextTokens: { type: 'number', description: 'Max tokens for context (default: 3000)' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'start_rlm_session',
                    description: 'Start a recursive reasoning session for complex multi-step problems',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Complex query requiring recursive reasoning' },
                            environment: { type: 'string', enum: ['local', 'docker', 'modal', 'e2b'], description: 'Execution environment' },
                            maxDepth: { type: 'number', description: 'Maximum recursion depth' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'get_reasoning_session',
                    description: 'Get details and status of a reasoning session',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sessionId: { type: 'string', description: 'Session ID to retrieve' }
                        },
                        required: ['sessionId']
                    }
                },
                // Memory & Learning Tools
                {
                    name: 'update_memory',
                    description: 'Add or update a memory node in the knowledge graph',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            nodeId: { type: 'string', description: 'Unique ID for the memory node' },
                            content: { type: 'string', description: 'Content to store' },
                            type: { type: 'string', enum: ['concept', 'file', 'symbol', 'note'], description: 'Type of memory node' },
                            metadata: { type: 'object', description: 'Additional metadata' }
                        },
                        required: ['nodeId', 'content']
                    }
                },
                {
                    name: 'create_memory_relation',
                    description: 'Create a relationship between memory nodes',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            fromId: { type: 'string', description: 'Source node ID' },
                            toId: { type: 'string', description: 'Target node ID' },
                            relationType: { type: 'string', enum: ['relates_to', 'depends_on', 'implements', 'references', 'similar_to'], description: 'Type of relationship' },
                            strength: { type: 'number', description: 'Relationship strength (0-1, default: 1.0)' }
                        },
                        required: ['fromId', 'toId', 'relationType']
                    }
                },
                {
                    name: 'search_memory',
                    description: 'Search the memory graph with semantic matching and traversal',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' },
                            traverseDepth: { type: 'number', description: 'Graph traversal depth (default: 2)' },
                            limit: { type: 'number', description: 'Maximum results (default: 10)' }
                        },
                        required: ['query']
                    }
                },
                // Cost & Performance Tools
                {
                    name: 'get_cost_metrics',
                    description: 'Get detailed cost and performance metrics',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            timeframe: { type: 'string', enum: ['hour', 'day', 'week'], description: 'Time period for metrics (default: day)' }
                        }
                    }
                },
                {
                    name: 'optimize_local_usage',
                    description: 'Analyze and optimize local model usage patterns',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            analysisDepth: { type: 'string', enum: ['basic', 'detailed'], description: 'Analysis depth (default: basic)' }
                        }
                    }
                },
                // System Tools
                {
                    name: 'get_system_status',
                    description: 'Get overall system status and health',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                // Common Command Tools
                {
                    name: 'execute_common_command',
                    description: 'Execute common development commands without LLM overhead (git, npm, file ops, etc.)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            command: { type: 'string', description: 'Natural language command (e.g., "commit and push for me", "npm install")' },
                            workingDirectory: { type: 'string', description: 'Working directory (optional, defaults to project root)' }
                        },
                        required: ['command']
                    }
                },
                {
                    name: 'list_available_commands',
                    description: 'List all available built-in commands and their patterns',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                // Documentation Intelligence Tools
                {
                    name: 'search_developer_docs',
                    description: 'Search developer documentation using semantic search and DevDocs integration. Provides zero-cost lookups for API references, guides, and examples.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query for documentation (e.g., "React useState hook", "Python list comprehensions", "Docker compose examples")' },
                            docs: { type: 'array', items: { type: 'string' }, description: 'Specific documentation sets to search (e.g., ["react", "javascript", "typescript"])' },
                            limit: { type: 'number', description: 'Maximum number of results to return (default: 10)', default: 10 },
                            include_content: { type: 'boolean', description: 'Whether to include full content in results (default: false)', default: false },
                            similarity_threshold: { type: 'number', description: 'Minimum similarity score for semantic matches (0.0-1.0, default: 0.7)', default: 0.7 }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'install_developer_docs',
                    description: 'Install and index developer documentation locally. Downloads docs from DevDocs and stores them for offline semantic search.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            docs: { type: 'array', items: { type: 'string' }, description: 'Documentation sets to install (e.g., ["react", "javascript", "python", "docker"])' },
                            force_reindex: { type: 'boolean', description: 'Force re-indexing of already installed documentation', default: false }
                        },
                        required: ['docs']
                    }
                },
                {
                    name: 'list_available_docs',
                    description: 'List all available developer documentation that can be installed and searched.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            show_installed_only: { type: 'boolean', description: 'Show only installed documentation', default: false },
                            category: { type: 'string', enum: ['all', 'language', 'framework', 'tool', 'database', 'runtime'], description: 'Filter by documentation category', default: 'all' }
                        }
                    }
                },
                {
                    name: 'get_documentation_status',
                    description: 'Get detailed status of local documentation storage and search capabilities.',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'quick_doc_lookup',
                    description: 'Quick lookup for specific API methods, functions, or concepts. Optimized for fast, targeted documentation retrieval.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            api_or_concept: { type: 'string', description: 'Specific API method, function, or concept to look up (e.g., "Array.map", "useEffect", "git rebase")' },
                            language_or_tool: { type: 'string', description: 'Specific language or tool context (e.g., "javascript", "react", "git")' },
                            include_examples: { type: 'boolean', description: 'Include code examples in the response', default: true }
                        },
                        required: ['api_or_concept']
                    }
                },
                // React Development Tools
                {
                    name: 'scaffold_react_component',
                    description: 'Generate a new React component with TypeScript, tests, and optional Storybook files',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            componentName: { type: 'string', description: 'Name of the component (PascalCase, e.g., "UserProfile")' },
                            componentType: { type: 'string', enum: ['functional', 'page', 'layout', 'ui'], description: 'Type of component to generate', default: 'functional' },
                            includeTests: { type: 'boolean', description: 'Generate test file with React Testing Library', default: true },
                            includeStorybook: { type: 'boolean', description: 'Generate Storybook file (only for UI components)', default: false },
                            outputPath: { type: 'string', description: 'Custom output path relative to src/react/' },
                            propsInterface: { type: 'object', description: 'Custom props interface definition', additionalProperties: true }
                        },
                        required: ['componentName']
                    }
                },
                {
                    name: 'analyze_react_component',
                    description: 'Analyze React component for state patterns, performance issues, and optimization opportunities',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            componentPath: { type: 'string', description: 'Path to the React component file to analyze' }
                        },
                        required: ['componentPath']
                    }
                },
                {
                    name: 'analyze_react_project',
                    description: 'Analyze the entire React project for state management patterns and get health score',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'get_react_project_health',
                    description: 'Get overall React project health with performance metrics and recommendations',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'create_react_ui_component',
                    description: 'Quick helper to create a UI component with Storybook',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            componentName: { type: 'string', description: 'Name of the UI component (PascalCase)' },
                            includeStorybook: { type: 'boolean', description: 'Include Storybook file', default: true }
                        },
                        required: ['componentName']
                    }
                },
                {
                    name: 'create_react_page_component',
                    description: 'Quick helper to create a page component with routing',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            componentName: { type: 'string', description: 'Name of the page component (PascalCase)' }
                        },
                        required: ['componentName']
                    }
                }
            ]
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'build_context_package':
                        return await this.handleBuildContextPackage(args);
                    case 'search_code_symbols':
                        return await this.handleSearchCodeSymbols(args);
                    case 'get_context_tree':
                        return await this.handleGetContextTree(args);
                    case 'get_file_skeleton':
                        return await this.handleGetFileSkeleton(args);
                    case 'get_blast_radius':
                        return await this.handleGetBlastRadius(args);
                    case 'semantic_navigate':
                        return await this.handleSemanticNavigate(args);
                    case 'hybrid_reasoning':
                        return await this.handleHybridReasoning(args);
                    case 'start_rlm_session':
                        return await this.handleStartRLMSession(args);
                    case 'get_reasoning_session':
                        return await this.handleGetReasoningSession(args);
                    case 'update_memory':
                        return await this.handleUpdateMemory(args);
                    case 'create_memory_relation':
                        return await this.handleCreateMemoryRelation(args);
                    case 'search_memory':
                        return await this.handleSearchMemory(args);
                    case 'get_cost_metrics':
                        return await this.handleGetCostMetrics(args);
                    case 'optimize_local_usage':
                        return await this.handleOptimizeLocalUsage(args);
                    case 'get_system_status':
                        return await this.handleGetSystemStatus(args);
                    case 'execute_common_command':
                        return await this.handleExecuteCommonCommand(args);
                    case 'list_available_commands':
                        return await this.handleListAvailableCommands(args);
                    // Documentation Intelligence Tools
                    case 'search_developer_docs':
                        return await this.handleDocsTool('search_developer_docs', args);
                    case 'install_developer_docs':
                        return await this.handleDocsTool('install_developer_docs', args);
                    case 'list_available_docs':
                        return await this.handleDocsTool('list_available_docs', args);
                    case 'get_documentation_status':
                        return await this.handleDocsTool('get_documentation_status', args);
                    case 'quick_doc_lookup':
                        return await this.handleDocsTool('quick_doc_lookup', args);
                    // React Development Tools
                    case 'scaffold_react_component':
                        return await this.handleScaffoldReactComponent(args);
                    case 'analyze_react_component':
                        return await this.handleAnalyzeReactComponent(args);
                    case 'analyze_react_project':
                        return await this.handleAnalyzeReactProject(args);
                    case 'get_react_project_health':
                        return await this.handleGetReactProjectHealth(args);
                    case 'create_react_ui_component':
                        return await this.handleCreateReactUIComponent(args);
                    case 'create_react_page_component':
                        return await this.handleCreateReactPageComponent(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                return {
                    content: [{
                            type: 'text',
                            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
                        }],
                    isError: true
                };
            }
        });
    }
    async handleBuildContextPackage(args) {
        const contextPackage = await this.intelligence.buildContextPackage(args.query, args.maxTokens || 4000);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(contextPackage, null, 2)
                }]
        };
    }
    async handleSearchCodeSymbols(args) {
        const symbols = await this.intelligence.findRelevantSymbols(args.query);
        const filteredSymbols = args.kind
            ? symbols.filter(s => s.kind === args.kind)
            : symbols;
        const results = filteredSymbols.slice(0, args.limit || 20);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(results, null, 2)
                }]
        };
    }
    async handleGetContextTree(args) {
        const tree = await this.intelligence.getContextTree(args.path);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(tree, null, 2)
                }]
        };
    }
    async handleGetFileSkeleton(args) {
        const skeleton = await this.intelligence.getFileSkeleton(args.filePath);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(skeleton, null, 2)
                }]
        };
    }
    async handleGetBlastRadius(args) {
        const radius = await this.intelligence.getBlastRadius(args.symbolId);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(radius, null, 2)
                }]
        };
    }
    async handleSemanticNavigate(args) {
        // Implementation would use contextplus semantic navigation
        const navigation = { clusters: [], orphans: [] }; // Placeholder
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(navigation, null, 2)
                }]
        };
    }
    async handleHybridReasoning(args) {
        const request = {
            query: args.query,
            complexity: args.complexity,
            requiresReasoning: args.requiresReasoning,
            preferLocal: args.preferLocal,
            maxSteps: args.maxSteps,
            contextTokens: args.contextTokens
        };
        const response = await this.reasoning.processQuery(request);
        // Track costs
        this.costTracker.recordRequest({
            isLocal: response.isLocal,
            cost: response.cost,
            tokens: response.tokensUsed,
            model: response.modelUsed,
            latencyMs: response.executionTimeMs || 0
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(response, null, 2)
                }]
        };
    }
    async handleStartRLMSession(args) {
        // Implementation would start RLM session
        const sessionId = `session_${Date.now()}`;
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ sessionId }, null, 2)
                }]
        };
    }
    async handleGetReasoningSession(args) {
        // Implementation would retrieve session details
        const session = { id: args.sessionId, status: 'placeholder' };
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(session, null, 2)
                }]
        };
    }
    async handleUpdateMemory(args) {
        await this.intelligence.updateMemory(args.nodeId, args.content, { type: args.type, ...args.metadata });
        return {
            content: [{
                    type: 'text',
                    text: 'Memory updated successfully'
                }]
        };
    }
    async handleCreateMemoryRelation(args) {
        await this.intelligence.createMemoryRelation(args.fromId, args.toId, args.relationType, args.strength || 1.0);
        return {
            content: [{
                    type: 'text',
                    text: 'Memory relation created successfully'
                }]
        };
    }
    async handleSearchMemory(args) {
        const results = await this.intelligence.searchMemory(args.query);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(results.slice(0, args.limit || 10), null, 2)
                }]
        };
    }
    async handleGetCostMetrics(args) {
        const metrics = this.costTracker.getMetrics(args.timeframe || 'day');
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(metrics, null, 2)
                }]
        };
    }
    async handleOptimizeLocalUsage(args) {
        const optimization = this.costTracker.analyzeUsage(args.analysisDepth || 'basic');
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(optimization, null, 2)
                }]
        };
    }
    async handleGetSystemStatus(args) {
        const status = {
            initialized: this.initialized,
            projectPath: this.projectPath,
            intelligence: 'ready',
            reasoning: 'ready',
            costTracking: 'active',
            commonCommands: 'available',
            uptime: process.uptime()
        };
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(status, null, 2)
                }]
        };
    }
    async handleExecuteCommonCommand(args) {
        const command = args.command;
        const workingDirectory = args.workingDirectory || this.projectPath;
        try {
            const result = await this.commandHandler.handleCommand(command, workingDirectory);
            if (!result) {
                return {
                    content: [{
                            type: 'text',
                            text: `Command not recognized: "${command}"\n\nAvailable commands include:\n- git commit and push\n- npm install\n- build for me\n- list files\n- create file/directory\n- kill port 3000\n\nUse "list_available_commands" for full list.`
                        }]
                };
            }
            const response = {
                success: result.success,
                command: result.command,
                output: result.output,
                executionTime: `${result.executionTime}ms`,
                workingDirectory
            };
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(response, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
                    }],
                isError: true
            };
        }
    }
    async handleListAvailableCommands(args) {
        const commands = this.commandHandler.getAvailableCommands();
        const formattedCommands = commands.map(cmd => ({
            pattern: cmd.pattern,
            description: cmd.description,
            examples: cmd.examples
        }));
        const summary = `
# Available Built-in Commands

LLM-Charge includes ${commands.length} built-in command patterns that execute instantly without using any LLM tokens:

## Git Operations
- "commit and push for me"
- "git add all"
- "create branch feature-xyz"
- "git status"

## Package Management  
- "npm install"
- "build for me"
- "run tests"
- "start dev server"

## File Operations
- "list files"
- "create file test.js"
- "delete old-folder"

## System Utilities
- "kill port 3000"
- "what's running on port 8080"
- "show disk usage"
- "current directory"

## Docker & Environment
- "docker ps"
- "node version"
- "show environment"

These commands are processed locally with zero cost and sub-second execution time.
`;
        return {
            content: [{
                    type: 'text',
                    text: summary + '\n\nDetailed patterns:\n' + JSON.stringify(formattedCommands, null, 2)
                }]
        };
    }
    async handleDocsTool(toolName, args) {
        const context = {
            docsIntelligence: this.docsIntelligence,
            projectDir: this.projectPath
        };
        const tool = docsTools[toolName];
        if (!tool) {
            throw new Error(`Documentation tool not found: ${toolName}`);
        }
        const result = await tool.handler(args, context);
        return {
            content: [{
                    type: 'text',
                    text: result
                }]
        };
    }
    // React Development Tool Handlers
    async handleScaffoldReactComponent(args) {
        try {
            const result = await this.reactDevTools.createComponent(args);
            let responseText = `✅ React component "${args.componentName}" scaffolded successfully!\n\n`;
            responseText += `📁 Files created:\n`;
            result.files.forEach((file) => {
                responseText += `   - ${file}\n`;
            });
            if (result.errors && result.errors.length > 0) {
                responseText += `\n⚠️ Warnings:\n`;
                result.errors.forEach((error) => {
                    responseText += `   - ${error}\n`;
                });
            }
            return {
                content: [{
                        type: 'text',
                        text: responseText
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error scaffolding component: ${error instanceof Error ? error.message : String(error)}`
                    }],
                isError: true
            };
        }
    }
    async handleAnalyzeReactComponent(args) {
        try {
            const analysis = await this.reactDevTools.analyzeComponent(args.componentPath);
            let responseText = `🔍 React Component Analysis: ${args.componentPath}\n\n`;
            responseText += `📊 Scores:\n`;
            responseText += `   - Overall: ${analysis.score.overall}/100\n`;
            responseText += `   - State Management: ${analysis.score.stateManagement}/100\n`;
            responseText += `   - Performance: ${analysis.score.performance}/100\n`;
            responseText += `   - Maintainability: ${analysis.score.maintainability}/100\n\n`;
            if (analysis.statePatterns.length > 0) {
                responseText += `🎯 State Patterns Found:\n`;
                analysis.statePatterns.forEach((pattern) => {
                    responseText += `   - ${pattern.type}: ${pattern.name} (${pattern.complexity} complexity)\n`;
                });
                responseText += '\n';
            }
            if (analysis.rerenderRisks.length > 0) {
                responseText += `⚠️ Performance Risks:\n`;
                analysis.rerenderRisks.forEach((risk) => {
                    responseText += `   - ${risk.type} (${risk.risk} risk): ${risk.reason}\n`;
                });
                responseText += '\n';
            }
            if (analysis.optimizationSuggestions.length > 0) {
                responseText += `💡 Optimization Suggestions:\n`;
                analysis.optimizationSuggestions.forEach((suggestion) => {
                    responseText += `   - [${suggestion.priority}] ${suggestion.description}\n`;
                });
            }
            return {
                content: [{
                        type: 'text',
                        text: responseText
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error analyzing component: ${error instanceof Error ? error.message : String(error)}`
                    }],
                isError: true
            };
        }
    }
    async handleAnalyzeReactProject(args) {
        try {
            const analyses = await this.reactDevTools.analyzeProject();
            let responseText = `🔍 React Project Analysis\n\n`;
            responseText += `📊 Project Overview:\n`;
            responseText += `   - Total Components: ${analyses.length}\n`;
            if (analyses.length > 0) {
                const avgScore = analyses.reduce((sum, a) => sum + a.score.overall, 0) / analyses.length;
                responseText += `   - Average Score: ${Math.round(avgScore)}/100\n`;
                const highRisk = analyses.filter(a => a.score.overall < 60);
                if (highRisk.length > 0) {
                    responseText += `   - High Risk Components: ${highRisk.length}\n`;
                }
                responseText += `\n📋 Component Details:\n`;
                analyses.forEach((analysis) => {
                    const fileName = analysis.componentPath.split('/').pop() || 'Unknown';
                    responseText += `   - ${fileName}: ${analysis.score.overall}/100 (${analysis.optimizationSuggestions.length} suggestions)\n`;
                });
            }
            return {
                content: [{
                        type: 'text',
                        text: responseText
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error analyzing project: ${error instanceof Error ? error.message : String(error)}`
                    }],
                isError: true
            };
        }
    }
    async handleGetReactProjectHealth(args) {
        try {
            const health = await this.reactDevTools.getProjectHealth();
            let responseText = `🏥 React Project Health Report\n\n`;
            responseText += `📊 Overall Metrics:\n`;
            responseText += `   - Total Components: ${health.totalComponents}\n`;
            responseText += `   - Average Score: ${health.averageScore}/100\n`;
            responseText += `   - High Risk Components: ${health.highRiskComponents}\n`;
            responseText += `   - Optimization Opportunities: ${health.optimizationOpportunities}\n\n`;
            if (health.recommendations && health.recommendations.length > 0) {
                responseText += `💡 Project-Wide Recommendations:\n`;
                health.recommendations.forEach((rec) => {
                    responseText += `   - [${rec.priority}] ${rec.description}\n`;
                    responseText += `     Action: ${rec.action}\n`;
                });
            }
            return {
                content: [{
                        type: 'text',
                        text: responseText
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error getting project health: ${error instanceof Error ? error.message : String(error)}`
                    }],
                isError: true
            };
        }
    }
    async handleCreateReactUIComponent(args) {
        try {
            const result = await this.reactDevTools.createUIComponent(args.componentName, args.includeStorybook);
            let responseText = `✅ UI Component "${args.componentName}" created successfully!\n\n`;
            responseText += `📁 Files created:\n`;
            result.files.forEach((file) => {
                responseText += `   - ${file}\n`;
            });
            return {
                content: [{
                        type: 'text',
                        text: responseText
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error creating UI component: ${error instanceof Error ? error.message : String(error)}`
                    }],
                isError: true
            };
        }
    }
    async handleCreateReactPageComponent(args) {
        try {
            const result = await this.reactDevTools.createPageComponent(args.componentName);
            let responseText = `✅ Page Component "${args.componentName}" created successfully!\n\n`;
            responseText += `📁 Files created:\n`;
            result.files.forEach((file) => {
                responseText += `   - ${file}\n`;
            });
            return {
                content: [{
                        type: 'text',
                        text: responseText
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ Error creating page component: ${error instanceof Error ? error.message : String(error)}`
                    }],
                isError: true
            };
        }
    }
}
