# 🚀 How to Use DevDocs & Universal Language MCP Tools

## 📋 Quick Start Guide

### Method 1: Through Live LLM-Charge Server (Easiest)

Your LLM-Charge server is already running at `http://localhost:3001`. Let's add these tools to it:

#### Step 1: Initialize the Extensions
```bash
# Test the tools are working
node test-devdocs-integration.js

# Should output:
# ✅ DevDocs Ready: true
# ✅ Universal Languages Ready: true
# 🎉 DevDocs Integration Test Complete!
```

#### Step 2: Use Through MCP Server Endpoints
```bash
# Search for JavaScript symbols + documentation
curl -s -X POST http://localhost:3001/api/mcp/universal-search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication", "language": "javascript", "limit": 10}'

# Get documentation for a language
curl -s -X POST http://localhost:3001/api/mcp/get-docs \
  -H "Content-Type: application/json" \
  -d '{"language": "javascript", "docs": ["javascript", "nodejs"]}'

# Cross-language analysis with documentation context
curl -s -X POST http://localhost:3001/api/mcp/cross-language-analysis \
  -H "Content-Type: application/json" \
  -d '{"task": "implement user authentication system"}'
```

### Method 2: Direct Usage in Code

#### Basic Setup:
```typescript
import { DevDocsMCPExtension } from './src/setup/devdocs-mcp-extension.js'
import { UniversalLanguageMCPExtension } from './src/setup/universal-language-mcp-extension.js'

const projectRoot = process.cwd()
const devDocs = new DevDocsMCPExtension(projectRoot)
const universalLang = new UniversalLanguageMCPExtension(projectRoot)

// Initialize both extensions
await devDocs.initialize()
await universalLang.initialize()

// Connect them
await universalLang.setDevDocsExtension(devDocs)
```

#### Example Usage:
```typescript
// 1. Analyze your project across all languages
const architecture = await universalLang.getProjectArchitecture()
console.log('Languages detected:', architecture.languages)

// 2. Deep dive into a specific language
const pythonAnalysis = await universalLang.languageDeepDive('python')
console.log('Python symbols:', pythonAnalysis.symbols.length)
console.log('Documentation available:', pythonAnalysis.documentation?.available)

// 3. Search for code + documentation
const authSymbols = await universalLang.universalSymbolSearch('authentication', 'javascript', 'function', 10)
console.log('Found auth functions:', authSymbols.length)

// 4. Get task-specific context with documentation
const taskContext = await universalLang.crossLanguageAnalysis('implement OAuth login')
console.log('Relevant symbols:', taskContext.taskRelevantSymbols.length)
console.log('Documentation context:', taskContext.documentationContext?.relevantDocs.length)

// 5. Download documentation for offline use
const downloadResult = await devDocs.downloadDocumentation('python', ['python~3.12', 'django~5.0'])
console.log('Downloaded:', downloadResult.downloaded)

// 6. Search documentation offline
const docResults = await devDocs.searchDocumentation('python', 'authentication decorator', 5)
console.log('Documentation results:', docResults.length)
```

### Method 3: Through Claude Code MCP Integration

#### Step 1: Add to your `~/.claude/mcp_servers.json`:
```json
{
  "mcpServers": {
    "llm-charge-devdocs": {
      "command": "node",
      "args": ["src/mcp/devdocs-mcp-server.js"],
      "cwd": "/Users/jacob.brandt/workspace/lllm-charge"
    }
  }
}
```

#### Step 2: Use in Claude Code session:
```
You: "Analyze my project for authentication patterns and show relevant documentation"

Claude: I'll analyze your project using the Universal Language MCP tools with DevDocs integration.

[Uses mcp__llm_charge_devdocs__cross_language_analysis with task="authentication patterns"]
[Uses mcp__llm_charge_devdocs__search_documentation for relevant languages]

Results: Found 12 authentication-related symbols across Python, JavaScript, and Go...
```

## 🎯 Practical Examples

### Example 1: Learning a New Language
```typescript
// You want to learn Rust
const rustInfo = await universalLang.languageDeepDive('rust')

if (!rustInfo.documentation?.available) {
  // Download Rust documentation
  await devDocs.downloadDocumentation('rust', ['rust'])
}

// Get learning recommendations
const context = await universalLang.crossLanguageAnalysis('learn rust memory management')
console.log('Learning suggestions:', context.recommendations)
console.log('Documentation context:', context.documentationContext?.suggestions)
```

### Example 2: Code Migration Project
```typescript
// Migrating from JavaScript to TypeScript
const jsAnalysis = await universalLang.languageDeepDive('javascript')
const tsAnalysis = await universalLang.languageDeepDive('typescript')

console.log('JavaScript functions to migrate:', jsAnalysis.symbols.filter(s => s.type === 'function').length)
console.log('Existing TypeScript:', tsAnalysis.symbols.length)

// Get migration guidance from documentation
const migrationContext = await devDocs.buildDocumentationContext(
  'migrate JavaScript to TypeScript', 
  ['javascript', 'typescript'], 
  10
)
console.log('Migration documentation:', migrationContext.relevantDocs)
```

### Example 3: Full-Stack Architecture Review
```typescript
// Analyze entire project
const architecture = await universalLang.getProjectArchitecture()

console.log('Project complexity:', architecture.overallComplexity)
console.log('Languages used:', architecture.languages.map(l => l.name))
console.log('Build systems:', architecture.buildSystems)

// Get documentation for all languages
for (const lang of architecture.languages) {
  const available = await devDocs.getAvailableDocs(lang.name)
  if (available.length > 0) {
    console.log(`${lang.name} docs available:`, available.slice(0, 3).map(d => d.name))
  }
}
```

## 🛠️ Integration with Existing Tools

### Adding to Enhanced MCP Setup
```typescript
// In src/setup/enhanced-mcp-setup.ts
import { DevDocsMCPExtension } from './devdocs-mcp-extension.js'
import { UniversalLanguageMCPExtension } from './universal-language-mcp-extension.js'

export class EnhancedMCPSetup {
  private devDocs?: DevDocsMCPExtension
  private universalLang?: UniversalLanguageMCPExtension
  
  async setupDocumentationSupport(): Promise<void> {
    console.log('🔧 Setting up documentation support...')
    
    this.devDocs = new DevDocsMCPExtension(this.projectRoot)
    this.universalLang = new UniversalLanguageMCPExtension(this.projectRoot)
    
    await this.devDocs.initialize()
    await this.universalLang.initialize()
    await this.universalLang.setDevDocsExtension(this.devDocs)
    
    console.log('✅ Documentation support ready')
  }
  
  // Add MCP tool endpoints
  async registerMCPTools(): Promise<void> {
    this.mcpServer.register('universal_search', async (params) => {
      return await this.universalLang?.universalSymbolSearch(
        params.query, params.language, params.type, params.limit
      )
    })
    
    this.mcpServer.register('download_docs', async (params) => {
      return await this.devDocs?.downloadDocumentation(params.language, params.docs)
    })
    
    this.mcpServer.register('cross_language_analysis', async (params) => {
      return await this.universalLang?.crossLanguageAnalysis(params.task)
    })
  }
}
```

## 📚 Available MCP Tools Reference

### Universal Language Tools:
- `universalSymbolSearch(query, language?, type?, limit?)` - Search symbols across all languages
- `crossLanguageAnalysis(task)` - Analyze task across languages with documentation
- `languageDeepDive(language)` - Deep analysis of specific language with docs info
- `getProjectArchitecture()` - Overview of entire project with language distribution

### DevDocs Tools:
- `getAvailableDocs(language)` - List available documentation for language
- `downloadDocumentation(language, docs?)` - Download offline documentation
- `searchDocumentation(language, query, limit?)` - Search downloaded documentation
- `getDocumentationContent(language, path)` - Get specific documentation content
- `buildDocumentationContext(task, languages, maxResults?)` - Build context for tasks

## 🚀 Ready-to-Use Commands

Save these as scripts in your project:

```bash
# analyze-project.sh
#!/bin/bash
echo "🔍 Analyzing project..."
node -e "
import('./src/setup/universal-language-mcp-extension.js').then(async ({ UniversalLanguageMCPExtension }) => {
  const ext = new UniversalLanguageMCPExtension(process.cwd())
  await ext.initialize()
  const arch = await ext.getProjectArchitecture()
  console.log('Languages:', arch.languages.map(l => l.name).join(', '))
  console.log('Complexity:', arch.overallComplexity)
})
"

# download-docs.sh
#!/bin/bash
echo "📚 Downloading documentation for detected languages..."
node -e "
import('./src/setup/devdocs-mcp-extension.js').then(async ({ DevDocsMCPExtension }) => {
  const devDocs = new DevDocsMCPExtension(process.cwd())
  await devDocs.initialize()
  
  const languages = ['javascript', 'python', 'go'] // Add your languages
  for (const lang of languages) {
    const result = await devDocs.downloadDocumentation(lang)
    console.log(\`\${lang}: Downloaded \${result.downloaded.length} docs\`)
  }
})
"
```

## 💡 Pro Tips

1. **Start with Project Analysis**: Always run `getProjectArchitecture()` first to understand your codebase
2. **Download Docs Early**: Use `downloadDocumentation()` for your main languages to enable offline work
3. **Combine Tools**: Use `crossLanguageAnalysis()` for complex tasks that span multiple languages
4. **Cache Results**: The tools are optimized for performance but cache results when possible
5. **Language-Specific Deep Dives**: Use `languageDeepDive()` when working intensively with one language

---

**Ready to supercharge your development workflow!** 🚀

Choose the method that works best for your setup and start exploring your codebase with comprehensive documentation support.