# 🚀 LLM-Charge: Supercharged Local LLM Platform

LLM-Charge is a comprehensive platform that supercharges local LLMs through intelligent hybrid routing, cost optimization, and advanced automation. Built using concepts and inspiration from multiple open-source projects, it provides a unified solution for cost optimization while maintaining high-quality AI interactions. *Cost reduction varies based on usage patterns and local model capabilities.*

## ✨ Features

### 🎯 Core Capabilities
- **Hybrid Routing**: Intelligent routing between local and cloud LLMs based on cost, performance, and complexity
- **Cost Optimization**: Real-time cost tracking with predictive analytics and optimization recommendations
- **Local LLM Support**: Full integration with Ollama, LM Studio, vLLM, and other local providers
- **Cloud Fallback**: Seamless fallback to OpenAI, Anthropic, and other cloud providers when needed

### 🧠 Advanced Intelligence
- **Multi-Modal Analysis (In Development)**: Image analysis, diagram generation, and screenshot understanding capabilities *under active development*
- **Smart Documentation**: Auto-downloading and caching of technical documentation with DevDocs integration
- **Semantic Code Understanding**: Deep code analysis powered by [CodeGraph](https://github.com/codegraph-dev/codegraph) integration and memory graph concepts
- **Hybrid Reasoning**: Combines local and cloud models for optimal reasoning with cost optimization

### 🤖 Automation & Orchestration
- **Workflow Engine**: Visual workflow editor inspired by [n8n](https://github.com/n8n-io/n8n) with drag-and-drop interface
- **Agent Management**: [OpenClaw](https://github.com/openclaw/openclaw)-inspired agent spawning and lifecycle management
- **Skill System**: Modular, sandboxed skill execution with security policies
- **Command Recognition**: 50+ common command patterns with intelligent caching

### 📊 Monitoring & Analytics
- **Real-Time Dashboard**: Live cost metrics, performance monitoring, and optimization insights
- **Distributed Network**: Share model resources across multiple nodes with load balancing
- **Health Monitoring**: Circuit breakers, graceful degradation, and automatic recovery
- **Comprehensive Logging**: Detailed audit trails and performance analytics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- TypeScript 5.0+
- At least one local LLM provider (Ollama recommended)
- Optional: API keys for cloud providers

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd lllm-charge

# Install dependencies
npm install

# The postinstall script will automatically load default agents, skills, and specs
```

### Basic Configuration

The system comes with sensible defaults. Create a `.env` file if you need custom configuration:

```env
# Local LLM Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
LM_STUDIO_PORT=1234

# Cloud Provider APIs (Optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Database Paths
MAIN_DATABASE_PATH=./data/llm-charge.db
AGENTS_DATABASE_PATH=./data/agents.db
FLOWS_DATABASE_PATH=./data/flows.db

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Development Startup (Recommended)

```bash
# Start both backend and React frontend simultaneously
npm run dev:full

# Or start individually:
# Backend with comprehensive MCP integration
npm run dev:server:comprehensive

# React frontend (in separate terminal)
npm run dev:react
```

**Access Points:**
- 🌐 **React Dashboard**: http://localhost:3000
- 🔧 **Backend API**: http://localhost:3001
- 🔌 **WebSocket**: ws://localhost:3001

### Production Startup

```bash
# Build for production
npm run build:production

# Start production server
npm start

# Or use Docker
docker-compose -f docker-compose.production.yml up
```

### System Health Check

After startup, verify the system is working:

```bash
# Check API endpoints
curl http://localhost:3001/api/projects
curl http://localhost:3001/api/specs

# Test hybrid reasoning
curl -X POST http://localhost:3001/mcp/call/hybrid_reasoning \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello world", "complexity": "simple", "preferLocal": true}'

# Test DevDocs integration
curl -X POST http://localhost:3001/api/devdocs/search \
  -H "Content-Type: application/json" \
  -d '{"query": "async await", "language": "javascript"}'
```

### Available NPM Scripts

```bash
# Development
npm run dev:full              # Start backend + React (recommended)
npm run dev:server:comprehensive  # Backend only (comprehensive features)
npm run dev:react             # React frontend only

# Building
npm run build                 # Build backend
npm run build:react           # Build React frontend
npm run build:production      # Build both for production

# Testing
npm run test                  # Run all tests
npm run test:react            # React-specific tests
npm run test:integration      # Integration tests

# Utilities
npm run zip                   # Create clean release zip
npm run setup                 # Load default agents/skills
npm run lint                  # Run linting
npm run typecheck             # TypeScript validation
```

## 📖 Usage Examples

### Command Recognition & Caching

```bash
# These commands are automatically recognized and cached
llm-charge "commit and push my changes"
llm-charge "install dependencies and run tests"  
llm-charge "create a new React component for user authentication"
```

### Hybrid Reasoning (Verified Working)

```javascript
// MCP Tool Call - Hybrid Reasoning
const response = await fetch('/mcp/call/hybrid_reasoning', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Explain TypeScript benefits',
    complexity: 'simple',
    preferLocal: true
  })
})
const result = await response.json()
```

### DevDocs Integration (Verified Working)

```javascript
// API Client Method for offline documentation search
const docs = await fetch('/api/devdocs/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'async await',
    language: 'javascript'
  })
})
const documentation = await docs.json()
```

### Project Management (Verified Working)

```javascript
// CRUD Operations with API Client
const projects = await fetch('/api/projects').then(r => r.json())
const agents = await fetch('/api/agents').then(r => r.json())
const specs = await fetch('/api/specs').then(r => r.json())
const workflows = await fetch('/api/workflows').then(r => r.json())
```

### Multi-Modal Analysis (In Development)

*Multi-modal intelligence features are under active development. Current working features include hybrid reasoning, DevDocs integration, and project management APIs. Full multi-modal API documentation will be provided when implementation is complete.*

### Workflow Management (Verified Working)

```javascript
// Create workflow via API
const workflow = await fetch('/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Code Review Assistant',
    description: 'Automated code review and approval process',
    status: 'active',
    priority: 'high',
    nodes: [
      { id: 'trigger-pr', type: 'trigger', name: 'PR Created' },
      { id: 'analyze-code', type: 'agent', name: 'Analyze Code' },
      { id: 'generate-review', type: 'agent', name: 'Generate Review' },
      { id: 'post-comment', type: 'output', name: 'Post Comment' }
    ],
    edges: [
      { id: 'trigger-to-analyze', source: 'trigger-pr', target: 'analyze-code' },
      { id: 'analyze-to-review', source: 'analyze-code', target: 'generate-review' },
      { id: 'review-to-post', source: 'generate-review', target: 'post-comment' }
    ]
  })
})
const createdWorkflow = await workflow.json()
```

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Dashboard     │    │   Hybrid Router  │    │  Local Models   │
│   (Real-time)   │◄──►│   (Cost Opt.)    │◄──►│  (Ollama/LMS)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Agent Manager  │    │ Workflow Engine  │    │  Cloud APIs     │
│  (OpenClaw)     │    │    (n8n-like)    │    │ (OpenAI/Claude) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Skill System   │    │ Multi-Modal AI   │    │ Distributed Net │
│  (Sandboxed)    │    │ (Vision/Diag.)   │    │ (Load Balance)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Components

- **Hybrid Router**: Intelligent routing between local/cloud based on cost, performance, complexity
- **Cost Tracker**: Real-time cost monitoring with predictive analytics and optimization
- **Workflow Engine**: Visual workflow automation with LLM-specific node types
- **Agent Manager**: Spawn and manage AI agents with security policies and resource limits
- **Multi-Modal Intelligence**: Image analysis, diagram generation, screenshot understanding
- **Distributed Network**: Share model resources across multiple nodes with load balancing
- **Smart Docs Cache**: Auto-download and cache technical documentation with 365-day retention

## 🔧 Configuration

### Router Configuration

```javascript
// config/router.json
{
  "providers": {
    "local": {
      "ollama": {
        "endpoint": "http://localhost:11434",
        "models": ["llama2", "codellama", "mistral"],
        "costPerToken": 0,
        "maxConcurrency": 4
      },
      "lm-studio": {
        "endpoint": "http://localhost:1234",
        "models": ["local-model"],
        "costPerToken": 0,
        "maxConcurrency": 2
      }
    },
    "cloud": {
      "openai": {
        "endpoint": "https://api.openai.com/v1",
        "models": ["gpt-3.5-turbo", "gpt-4"],
        "costPerToken": 0.002,
        "rateLimit": 3000
      },
      "anthropic": {
        "endpoint": "https://api.anthropic.com/v1",
        "models": ["claude-3-haiku", "claude-3-sonnet"],
        "costPerToken": 0.00025,
        "rateLimit": 4000
      }
    }
  },
  "routing": {
    "defaultStrategy": "cost-optimized",
    "costThreshold": 0.10,
    "qualityThreshold": 0.85,
    "timeoutMs": 30000,
    "retryAttempts": 3
  }
}
```

### Agent Configuration

```javascript
// config/agents.json
{
  "maxConcurrentAgents": 10,
  "defaultTimeout": 300000,
  "securityPolicy": {
    "allowedOperations": ["read", "analyze", "generate"],
    "blockedOperations": ["write", "execute", "network"],
    "sandboxed": true,
    "maxMemory": "512MB",
    "maxCpuTime": 60000
  },
  "agentTypes": {
    "code-reviewer": {
      "capabilities": ["static-analysis", "security-scan"],
      "tools": ["eslint", "sonarjs", "semgrep"]
    },
    "document-analyst": {
      "capabilities": ["text-analysis", "summarization"],
      "tools": ["pdf-parser", "markdown-processor"]
    }
  }
}
```

## ⚡ Zero-Cost Common Commands

LLM-Charge includes 50+ built-in commands that execute instantly without using any LLM tokens or making API calls:

### Git Operations
```
"commit and push for me"
"git add all"  
"create branch feature-login"
"git status"
"git pull"
```

### Build Systems & Tools
```
"make build"
"task test" 
"gotask clean"
"npx prettier --write ."
"npx tsc --noEmit"
```

### Package Management
```
"npm install"
"build for me"
"run tests"
"start dev server for me"
```

### GitHub & AWS CLI
```
"gh pr list"
"gh issue create"
"gh status"
"aws s3 ls"
"aws lambda list-functions"
```

**Cost Comparison:**
- **Without LLM-Charge**: Any CLI task → API call → $0.002-0.015 per command
- **With LLM-Charge**: Built-in handler → Direct execution → $0.00
- **Coverage**: 50+ patterns across git, npm, make, AWS CLI, bash utilities

## 🧪 Testing

The project includes comprehensive test suite (current coverage: ~0%, target: 85%):

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance

# Run with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e
```

### Test Categories

- **Unit Tests**: Core logic and component testing (20 test files)
- **Integration Tests**: Cross-component interaction testing  
- **Performance Tests**: Load testing and scalability
- **End-to-End Tests**: Full system integration testing
- **Type Validation**: TypeScript type safety and validation
- **Coverage Testing**: Comprehensive code coverage analysis

## 📊 Performance

### Benchmarks

| Metric | Target | Current Status |
|--------|--------|--------|
| Hybrid Reasoning Response | < 3.0s | *Testing required* |
| Local LLM Integration | Working | ✅ *Verified with LM Studio/Ollama* |
| DevDocs Search | < 1.0s | ✅ *Verified - Instant offline search* |
| API Endpoints | Working | ✅ *All CRUD operations functional* |
| WebSocket Real-time | Working | ✅ *Live metrics streaming verified* |

*Performance benchmarks are based on verified functionality. Detailed metrics collection is in progress.*

### Optimization Features

- **Request Queuing**: Handle high load with configurable concurrency limits
- **Connection Pooling**: Reuse connections to reduce latency
- **Circuit Breakers**: Prevent cascade failures with automatic recovery
- **Caching**: Intelligent caching of responses and documentation
- **Load Balancing**: Distribute requests across multiple nodes

## 📋 Implementation Status

### ✅ Fully Implemented
- Hybrid reasoning with local/cloud routing
- DevDocs integration for offline documentation  
- Basic workflow engine and agent management
- Real-time dashboard with WebSocket communication
- Cost tracking and optimization features
- Independent database architecture
- React frontend with modern component system
- FastAPI backend with comprehensive API endpoints

### 🔄 In Active Development
- Complete multi-modal intelligence system
- Advanced agent security sandboxing
- Memory graph with semantic clustering
- Performance optimization and benchmarking
- Comprehensive test suite completion
- Visual workflow editor enhancements

### 📋 Planned Features  
- Advanced model fine-tuning recommendations
- Multi-project workspace support
- Plugin system for custom intelligence modules
- Enterprise deployment features
- Advanced caching with similarity matching
- IDE integrations beyond Claude Code

*This status is updated regularly to reflect current development progress.*

## 🔒 Security

### Security Features

- **Sandboxed Execution**: All agents and skills run in isolated environments
- **Security Policies**: Fine-grained access control and resource limits
- **Input Validation**: Comprehensive validation of all user inputs
- **Audit Logging**: Complete audit trails for security compliance
- **Encrypted Storage**: All sensitive data encrypted at rest
- **Network Security**: TLS encryption for all network communications

### Security Policies

```javascript
const securityPolicy = {
  allowedOperations: ['read', 'analyze'],
  blockedOperations: ['write', 'execute', 'network'],
  allowedPaths: ['/workspace'],
  blockedPaths: ['/system', '/etc'],
  networkAccess: false,
  maxMemory: '512MB',
  maxCpuTime: 60000,
  sandboxed: true
}
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t llm-charge .

# Run with Docker Compose
docker-compose up -d

# Scale services
docker-compose scale worker=3
```

### Production Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  llm-charge:
    build: .
    ports:
      - "3001:3001"
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

## 📊 Cost Reduction Examples

### Cost Optimization Potential

| Feature | Description | Estimated Impact |
|---------|-------------|------------------|
| **Local LLM Integration** | Route requests to free local models | **Up to 100% cost reduction** for compatible tasks |
| **DevDocs Caching** | Offline documentation reduces lookup API calls | **Eliminates documentation query costs** |
| **Hybrid Routing** | Intelligent cloud/local routing based on complexity | **Varies by usage pattern** |
| **Command Caching** | 50+ built-in commands execute without API calls | **$0.00 for recognized patterns** |

### Real-World Verification Commands

```bash
# Test hybrid reasoning (uses local when possible)
curl -X POST http://localhost:3001/mcp/call/hybrid_reasoning \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Simple task", "complexity": "simple", "preferLocal": true}'

# Test DevDocs search (completely offline)
curl -X POST http://localhost:3001/api/devdocs/search \
  -H "Content-Type: application/json" \
  -d '{"query": "javascript", "language": "javascript"}'

# Check system status
curl http://localhost:3001/api/projects
```

*Cost savings vary significantly based on usage patterns, local model capabilities, and task complexity. The platform's value is in providing the infrastructure for optimization rather than guaranteeing specific savings percentages.*

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Code Style

- TypeScript with strict type checking
- ESLint + Prettier for code formatting
- Jest for testing (current coverage: ~0%, improving to 85%)
- Conventional commits for commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔧 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if ports are available
lsof -ti:3001  # Backend port
lsof -ti:3000  # Frontend port

# Kill processes if needed
kill $(lsof -ti:3001)

# Restart with fresh logs
npm run dev:full
```

#### Database Issues
```bash
# Reset databases (will lose data)
rm -rf data/*.db

# Restart to recreate with defaults
npm run dev:server:comprehensive
```

#### Missing Local LLM Provider
- **Ollama**: Install from [ollama.com](https://ollama.com)
- **LM Studio**: Download from [lmstudio.ai](https://lmstudio.ai)
- The system will show provider status in logs and continue with available providers

#### React Build Issues
```bash
# Clear build cache
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build:production
```

#### WebSocket Connection Issues
- Check if backend server is running on port 3001
- Verify no firewall is blocking WebSocket connections
- Check browser console for WebSocket errors

### System Status Verification

After startup, you should see:
```
✅ Main database initialized
✅ Independent agent database initialized  
✅ Independent flow database initialized
✅ lm-studio is healthy (Xms) - N models available
🌐 Server started at http://localhost:3001
```

### Performance Tuning

For better performance:
```env
# Add to .env file
NODE_ENV=production
ENABLE_CACHING=true
MAX_CONCURRENT_REQUESTS=10
```

### Logs and Debugging

Check logs in:
- Console output from `npm run dev:full`
- Network tab in browser dev tools
- Backend API responses: `curl -v http://localhost:3001/api/projects`

## 🙏 Acknowledgments

This project builds upon the excellent work of several open-source projects:

### 🔗 Integrated Projects

- **[n8n](https://github.com/n8n-io/n8n)** - Fair-code workflow automation platform that inspired our visual workflow engine
- **[OpenClaw](https://github.com/openclaw/openclaw)** - AI agent management system that influenced our agent architecture
- **[CodeGraph](https://github.com/codegraph-dev/codegraph)** - Semantic code analysis engine for faster, smarter code exploration
- **[ContextPlus](https://github.com/contextplus/contextplus)** - Memory graph and semantic intelligence concepts
- **[RLM](https://github.com/rlm-dev/rlm)** - Recursive reasoning and model routing patterns
- **[DevDocs](https://github.com/freeCodeCamp/devdocs)** - Documentation browser that inspired our smart caching system
- **[GPT4All](https://github.com/nomic-ai/gpt4all)** - Local LLM ecosystem that influenced our model integration

### 🛠️ Technology Stack

- **[Ollama](https://github.com/ollama/ollama)** - Local LLM serving platform
- **[LM Studio](https://lmstudio.ai/)** - Desktop LLM application
- **[vLLM](https://github.com/vllm-project/vllm)** - High-performance LLM inference engine
- **[TypeScript](https://github.com/microsoft/TypeScript)** - Typed JavaScript for robust development
- **[Jest](https://github.com/jestjs/jest)** - Comprehensive testing framework
- **[Sharp](https://github.com/lovell/sharp)** - High-performance image processing
- **[Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)** - 2D graphics for diagram generation

### 🌟 Special Thanks

- The AI/ML open-source community for building the foundational tools
- All contributors to the integrated projects for their innovative work
- The local LLM community for pushing the boundaries of what's possible

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/lllm-charge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/lllm-charge/discussions)

---

**Built with ❤️ by the LLM-Charge community**

*Supercharge your local LLMs and reduce your API costs today!*