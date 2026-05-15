# Automatic Task Pickup Skill for LLM-Charge

## Purpose
This Claude skill automatically analyzes the LLM-Charge project's ticket backlog, identifies the optimal next task based on dependencies and priorities, and provides structured guidance for task execution.

## Capabilities
- Scan and analyze tickets in `./tickets/backlog/`
- Evaluate task dependencies and blocking relationships
- Score and rank tasks by priority, complexity, and readiness
- Provide detailed task breakdown and implementation guidance
- Track project state and suggest workflow optimizations

## Skill Activation
When you say: "**pick next task**" or "**analyze backlog**" or "**what should I work on**"

## Implementation

### Phase 1: Backlog Analysis
1. **Ticket Discovery**: Scan all markdown files in tickets/backlog
2. **Metadata Extraction**: Parse priority, type, epic, dependencies
3. **Status Assessment**: Check current progress and blocking factors
4. **Technology Analysis**: Identify required skills and tech stack

### Phase 2: Dependency Mapping
1. **Build Dependency Graph**: Map inter-task dependencies
2. **Identify Ready Tasks**: Find tasks with satisfied dependencies
3. **Critical Path Analysis**: Determine tasks that unblock others
4. **Bottleneck Detection**: Identify potential workflow blockers

### Phase 3: Task Scoring
1. **Priority Weighting**: Critical=100, High=75, Medium=50, Low=25
2. **Dependency Readiness**: Bonus for tasks with completed dependencies
3. **Epic Focus**: Bonus for Python Migration and other key epics
4. **Complexity Matching**: Match task complexity to available capacity
5. **Skill Alignment**: Consider available expertise and technologies

### Phase 4: Recommendation
1. **Top Task Selection**: Choose highest-scoring available task
2. **Implementation Breakdown**: Provide detailed task analysis
3. **Next Actions**: List specific steps to begin work
4. **Risk Assessment**: Identify potential challenges and mitigation

## LLM-Charge Project Context

### Current Epic Focus
- **Python Migration**: Converting Node.js backend to FastAPI
- **Database Architecture**: SQLAlchemy models and migration
- **Testing Framework**: Comprehensive test coverage improvement
- **Performance Optimization**: Real-time features and monitoring

### Task Types
- **Architecture**: System design and structural changes
- **Database**: Data models, migrations, and access layers
- **API**: Endpoint development and integration
- **Frontend**: React components and UI improvements
- **Testing**: Test coverage and quality assurance
- **Security**: Security policies and validation
- **Documentation**: Technical documentation and guides

### Technology Stack Considerations
- **Backend**: TypeScript/Node.js → Python/FastAPI migration
- **Database**: SQLite with better-sqlite3 → SQLAlchemy
- **Frontend**: React 19 with TypeScript (established)
- **Testing**: Jest → Jest + pytest hybrid approach
- **WebSockets**: Existing real-time architecture
- **MCP**: Model Context Protocol integration

## Usage Examples

### Example 1: Next Task Selection
```
Human: pick next task

Claude: [Task Pickup Skill Activated]
📋 ANALYZING BACKLOG: Found 8 tickets in Python Migration epic...

🎯 RECOMMENDED TASK: PY-001 - Python Backend Architecture Foundation
   Priority: Critical | Type: Architecture | Epic: Python Migration
   Dependencies: None (ready to start)
   Estimated Effort: 3-4 days
   
📊 REASONING:
   • Highest priority task with no blocking dependencies
   • Foundation task that unblocks 6 other tickets
   • Aligns with FastAPI expertise and architecture focus
   
📋 IMPLEMENTATION BREAKDOWN:
   1. Set up FastAPI application structure
   2. Configure SQLAlchemy database integration  
   3. Implement basic API routing framework
   4. Create development environment setup
   
🚀 NEXT ACTIONS:
   • Review FastAPI documentation and best practices
   • Set up Python virtual environment
   • Install FastAPI, SQLAlchemy, and development dependencies
   • Create basic application structure
```

### Example 2: Backlog Analysis
```
Human: analyze backlog

Claude: [Task Pickup Skill Activated]
📊 BACKLOG ANALYSIS COMPLETE

🎯 EPIC BREAKDOWN:
   Python Migration: 8 tasks (1 ready, 7 blocked)
   Testing Framework: 3 tasks (2 ready, 1 blocked)
   Performance: 2 tasks (0 ready, 2 blocked)

🚧 CRITICAL PATH:
   PY-001 → PY-002 → [PY-003, PY-006, PY-007] → [PY-004, PY-005, PY-008]
   
⚠️ BLOCKERS:
   • All advanced Python tasks blocked by PY-001 foundation
   • Database tasks (PY-002) critical for unblocking API work
   • Testing migration depends on backend architecture decisions
   
💡 RECOMMENDATIONS:
   1. Focus on PY-001 to unblock maximum work
   2. Prioritize PY-002 immediately after PY-001
   3. Consider parallel work on testing framework improvements
```

## Quality Assurance
- Validates ticket format and metadata completeness
- Checks for dependency cycles and impossible requirements
- Considers current project capacity and resource constraints
- Integrates with existing development workflow
- Maintains awareness of ongoing work and recent completions

## Integration Points
- **TDD Skill**: Coordinates with TDD development for implementation
- **Project State**: Tracks completed, in-progress, and blocked tasks
- **Skill System**: Considers available development capabilities
- **Documentation**: Updates project status and progress tracking