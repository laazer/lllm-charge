# 🛠️ LLM-Charge Skills Access Guide

This guide explains how to access and use the existing skills in the LLM-Charge platform.

## 📁 Available Skills

### 1. **TDD Development Skill** (`src/skills/tdd-development-skill.ts`)
**Purpose**: Implements Test-Driven Development methodology for systematic development

**Features**:
- Red-Green-Refactor TDD cycle automation
- Test scaffolding and template generation  
- Code coverage analysis and reporting
- Automated refactoring suggestions
- Quality gates enforcement

**Key Interfaces**:
```typescript
interface TDDCycleResult {
  phase: 'red' | 'green' | 'refactor';
  success: boolean;
  testResults: TestResults;
  codeChanges: string[];
  suggestions: string[];
  nextSteps: string[];
}
```

### 2. **Automatic Task Pickup Skill** (`src/skills/automatic-task-pickup-skill.ts`)
**Purpose**: Automatically discovers, prioritizes, and assigns tasks from tickets

**Features**:
- Automatic ticket discovery and parsing
- Dependency graph analysis  
- Priority-based task ranking
- Skill-based task assignment
- Progress tracking and reporting
- Integration with TDD development workflow

**Key Interfaces**:
```typescript
interface TaskPickupResult {
  selectedTask: TicketMetadata | null;
  reason: string;
  alternativeTasks: TicketMetadata[];
  blockedTasks: TicketMetadata[];
  recommendations: string[];
  nextActions: string[];
}
```

## 🚀 How to Access the Skills

### Method 1: Direct TypeScript Import
```typescript
// Import the skills directly in your code
import { TDDDevelopmentSkill } from './src/skills/tdd-development-skill';
import { AutomaticTaskPickupSkill } from './src/skills/automatic-task-pickup-skill';

// Use the skills
const tddSkill = new TDDDevelopmentSkill();
const taskSkill = new AutomaticTaskPickupSkill();
```

### Method 2: Through the Skill Engine
```typescript
// Use the skill engine framework
import { SkillEngine } from './src/skills/skill-engine';

const skillEngine = new SkillEngine();
await skillEngine.loadSkill('tdd-development-skill');
await skillEngine.loadSkill('automatic-task-pickup-skill');
```

### Method 3: Via LLM-Charge Server Integration
The skills can be accessed through the comprehensive working server:

```bash
# Start the server with skills support
npm run dev:server:comprehensive

# Access skills via API endpoints (if integrated)
curl -X POST http://localhost:3001/api/skills/tdd-development/execute
curl -X POST http://localhost:3001/api/skills/task-pickup/execute
```

### Method 4: Through MCP (Model Context Protocol)
If integrated with the MCP server, skills can be accessed via MCP tools:

```bash
# List available MCP tools (including skills)
curl http://localhost:3001/mcp/tools

# Execute skills via MCP interface
curl -X POST http://localhost:3001/mcp/call/execute_tdd_skill
curl -X POST http://localhost:3001/mcp/call/execute_task_pickup_skill
```

## 🔧 Skill Configuration

### TDD Development Skill Configuration
```typescript
const tddConfig: TDDConfiguration = {
  testFramework: 'jest',
  coverageThreshold: {
    statements: 80,
    branches: 70,
    functions: 80,
    lines: 80
  },
  testDirectory: './tests',
  sourceDirectory: './src',
  outputDirectory: './coverage',
  enforceQualityGates: true
};
```

### Automatic Task Pickup Configuration  
```typescript
const taskConfig = {
  ticketDirectory: './tickets/backlog',
  priorityWeights: {
    'Critical': 100,
    'High': 75,
    'Medium': 50,
    'Low': 25
  },
  skillMatching: {
    enabled: true,
    threshold: 0.7
  }
};
```

## 💡 Usage Examples

### Example 1: TDD Skill Usage
```typescript
import { TDDDevelopmentSkill } from './src/skills/tdd-development-skill';

const tddSkill = new TDDDevelopmentSkill();

// Start RED phase - create failing tests
const redResult = await tddSkill.executeRedPhase({
  feature: 'user authentication',
  testSpecs: [
    'should validate email format',
    'should hash passwords securely',
    'should generate JWT tokens'
  ]
});

// GREEN phase - minimal implementation
const greenResult = await tddSkill.executeGreenPhase(redResult);

// REFACTOR phase - improve code quality
const refactorResult = await tddSkill.executeRefactorPhase(greenResult);
```

### Example 2: Task Pickup Skill Usage  
```typescript
import { AutomaticTaskPickupSkill } from './src/skills/automatic-task-pickup-skill';

const taskSkill = new AutomaticTaskPickupSkill();

// Discover and prioritize tasks
const result = await taskSkill.pickupNextTask({
  projectContext: './tickets/backlog',
  skillCapabilities: ['TypeScript', 'React', 'FastAPI'],
  currentProgress: 'PY-001 completed'
});

console.log(`Selected task: ${result.selectedTask?.title}`);
console.log(`Reason: ${result.reason}`);
```

## 📊 Skill Status and Monitoring

### Check Skill Availability
```bash
# List all available skills
ls -la src/skills/

# Check skill dependencies
npm list | grep -E "(jest|typescript|fastapi)"

# Validate skill syntax
npx tsc --noEmit src/skills/tdd-development-skill.ts
npx tsc --noEmit src/skills/automatic-task-pickup-skill.ts
```

### Skill Execution Logs
Skills use the LLM-Charge logging system:
```typescript
import { get_logger } from './src/core/logging';
const logger = get_logger('skills');
```

## 🔐 Security Considerations

### Skill Sandboxing
The skills run within the LLM-Charge security framework:
```typescript
const securityPolicy = {
  sandboxed: true,
  allowedPaths: ['./src', './tests', './tickets'],
  blockedPaths: ['/system', '/etc'],
  networkAccess: false,
  maxMemory: '512MB'
};
```

### Permission Management
Skills require specific permissions:
- **TDD Skill**: File read/write in `src/` and `tests/` directories
- **Task Pickup Skill**: File read in `tickets/` directory, write access for status updates

## 🚧 Current Integration Status

### ✅ Available Features
- Complete TypeScript implementations
- Comprehensive interfaces and type definitions  
- Integration with LLM-Charge logging system
- Security policy support via skill engine

### 🔄 Planned Enhancements
- Direct MCP tool integration
- Web dashboard interface for skill management
- Real-time skill execution monitoring  
- Automatic skill discovery and loading

## 📚 Related Documentation

- **Skill Engine**: `src/skills/skill-engine.ts` - Core skill execution framework
- **Security Policies**: `docs/SECURITY.md` - Skill sandboxing and permissions
- **API Integration**: `docs/API.md` - REST endpoints for skill execution
- **Development Guide**: `CLAUDE.md` - Overall development guidelines

## 🛟 Troubleshooting

### Common Issues

1. **Skill Not Found Error**
   ```bash
   # Verify skill files exist
   ls src/skills/tdd-development-skill.ts
   ls src/skills/automatic-task-pickup-skill.ts
   ```

2. **TypeScript Compilation Errors**
   ```bash
   # Check for syntax errors
   npx tsc --noEmit src/skills/
   ```

3. **Permission Denied**
   ```bash
   # Check file permissions
   chmod +x src/skills/*.ts
   ```

4. **Missing Dependencies**
   ```bash
   # Install skill dependencies
   npm install
   ```

### Getting Help
- Check the LLM-Charge logs: `logs/llm-charge.log`
- Review skill documentation in source files
- Use the debugging interfaces in the skill engine
- Create issues in the project repository

---

**💡 Pro Tip**: The skills work best when used together - the Automatic Task Pickup skill can identify tasks that benefit from the TDD Development skill's systematic approach!