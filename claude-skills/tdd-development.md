# TDD Development Skill for LLM-Charge

## Purpose
This Claude skill enables Test-Driven Development workflows specifically for the LLM-Charge project, implementing the Red-Green-Refactor cycle with project-specific testing patterns and conventions.

## Capabilities
- Analyze current code structure and identify areas needing tests
- Generate failing tests (Red phase) for new features or bug fixes
- Guide implementation to make tests pass (Green phase)  
- Suggest refactoring opportunities while maintaining test coverage (Refactor phase)
- Integrate with Jest, TypeScript, and LLM-Charge specific patterns

## Skill Activation
When you say: "**use TDD skill**" or "**start TDD cycle**" or "**implement with TDD**"

## Implementation

### Red Phase: Create Failing Tests
1. **Analyze Requirements**: Parse the feature/bug description
2. **Identify Test Scenarios**: Break down into testable units
3. **Generate Test Structure**: Create test files following LLM-Charge conventions
4. **Write Failing Tests**: Implement comprehensive test cases that fail initially

### Green Phase: Make Tests Pass
1. **Minimal Implementation**: Write just enough code to pass tests
2. **Incremental Development**: Build functionality step by step
3. **Test Validation**: Ensure all tests pass without breaking existing ones
4. **Integration Checks**: Verify new code works with existing systems

### Refactor Phase: Improve Code Quality
1. **Code Analysis**: Identify opportunities for improvement
2. **Refactoring Suggestions**: Propose specific improvements
3. **Test Safety**: Ensure refactoring doesn't break functionality
4. **Documentation Updates**: Update comments and documentation

## LLM-Charge Specific Patterns

### Test File Conventions
- Unit tests: `tests/unit/**/*.test.ts`
- Integration tests: `tests/integration/**/*.test.ts`  
- Skills tests: `tests/unit/skills/**/*.test.ts`
- Agent tests: `tests/unit/agents/**/*.test.ts`

### Common Test Scenarios
- **Skills Testing**: Validate skill execution, security policies, sandboxing
- **Agent Testing**: Test agent lifecycle, communication, error handling
- **Database Testing**: SQLite operations, migrations, data integrity
- **API Testing**: FastAPI endpoints, request/response validation
- **WebSocket Testing**: Real-time features, connection management
- **MCP Testing**: Model Context Protocol tool execution

### Mocking Patterns
- External LLM provider calls
- Database operations for isolation
- WebSocket connections
- File system operations
- Network requests

## Usage Examples

### Example 1: New Feature Development
```
Human: use TDD skill to implement agent health monitoring

Claude: [TDD Skill Activated] 
🔴 RED PHASE: Creating failing tests for agent health monitoring...
[Creates test files and failing tests]

🟢 GREEN PHASE: Implementing minimal agent health monitoring...
[Implements basic functionality to pass tests]

🔵 REFACTOR PHASE: Improving code quality and adding error handling...
[Suggests and implements improvements]
```

### Example 2: Bug Fix with TDD
```
Human: start TDD cycle for fixing WebSocket connection drops

Claude: [TDD Skill Activated]
🔴 RED PHASE: Writing tests that reproduce WebSocket connection drop bug...
[Creates failing tests that demonstrate the issue]

🟢 GREEN PHASE: Fixing WebSocket reconnection logic...
[Implements fix to make tests pass]

🔵 REFACTOR PHASE: Improving connection reliability and adding monitoring...
[Refactors for better maintainability]
```

## Quality Gates
- All tests must pass before moving to next phase
- Code coverage should meet project standards (target: 85%)
- TypeScript compilation with no errors
- ESLint passes with project rules
- Integration tests validate real-world scenarios

## Integration with LLM-Charge Architecture
- Respects existing project structure and conventions
- Integrates with current testing framework (Jest)
- Follows TypeScript strict mode requirements
- Maintains compatibility with existing skills system
- Considers security policies and sandboxing requirements