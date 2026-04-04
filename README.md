# LLM-Charge

A local LLM tooling platform with a backend API server, React dashboard, MCP server, hybrid routing, workflow automation, and agent management.

## What's in here

- **Backend server** (`src/server/comprehensive-working-server.mjs`) — HTTP API on port 3001, WebSocket, 30+ endpoints
- **React frontend** (`src/react/`) — dashboard built with React 19, TailwindCSS, Vite
- **MCP server** (`src/mcp/bridge.ts`) — stdio bridge so Claude Code and Cursor can use the running server's tools
- **Hybrid router** (`src/reasoning/`) — routes requests between local LLMs (Ollama, LM Studio) and cloud APIs
- **Workflow engine** (`src/workflows/`) — n8n-inspired workflow automation with visual editor
- **Agent system** (`src/agents/`) — spawn and manage agents with configurable security policies
- **Cron scheduler** (`src/core/cron-*.ts`) — job scheduling with a management UI
- **DevDocs integration** (`src/setup/devdocs-mcp-extension.ts`) — offline documentation search
- **Godot tools** (`src/mcp/godot-tools.ts`) — MCP tools for Godot/GDScript projects
- **Blender pipeline** (`blender_pipeline/`) — Python pipeline for 3D asset generation with LLM integration
- **Spec manager** (`src/specs/`) — track and manage project specs
- **SQLite databases** — separate DBs for agents, flows, and main data under `data/`

## Prerequisites

- Node.js 20+ (see `engines` in package.json)
- npm
- A local LLM provider (Ollama recommended) — optional, cloud providers work without it
- Python 3.11+ — only needed for the Blender pipeline

## Setup

```bash
git clone https://github.com/laazer/lllm-charge.git
cd lllm-charge
npm install
```

The `postinstall` script runs `npm run setup` which tries to connect to a running server to load default agents/skills. If no server is running it skips with a warning — that's fine.

## Running

### Development (hot reload)

```bash
# Backend + React frontend together
npm run dev:full

# Or separately:
npm run dev:server:comprehensive   # Backend on port 3001
npm run dev:react                  # React on port 3000 (proxies API to 3001)
```

### Stable local instance (for using while developing)

```bash
# Build then start — backend on 3001, React preview on 4000
npm run local:build

# Start without rebuilding
npm run local

# Stop
npm run local:stop

# Check status / tail logs
npm run local:status
npm run local:logs
```

### Access

| Service | URL |
|---------|-----|
| React dashboard (dev) | http://localhost:3000 |
| React dashboard (local deploy) | http://localhost:4000 |
| Backend API | http://localhost:3001 |
| Legacy HTML dashboard | http://localhost:3001/interactive-dashboard.html |
| Workflow editor | http://localhost:3001/workflow-editor.html |
| Agent studio | http://localhost:3001/agent-studio.html |

## MCP Server

The MCP bridge connects Claude Code and Cursor to the running backend's tools.

**Requires the backend to be running first** (`npm run local` or `npm run dev:server:comprehensive`).

Config is in `.mcp.json` (project-level, auto-detected by Claude Code). The command used:

```bash
sh -c "cd /path/to/lllm-charge && npx tsx src/mcp/bridge.ts"
```

If the backend isn't running, the bridge exits with a clear error rather than connecting silently broken.

## npm Scripts

```bash
# Development
npm run dev:full                    # Backend + React (recommended)
npm run dev:server:comprehensive    # Backend only
npm run dev:react                   # React only

# Local deploy (stable instance)
npm run local:build                 # Build + start
npm run local                       # Start (existing build)
npm run local:stop
npm run local:status
npm run local:logs

# Building
npm run build                       # Compile TypeScript backend
npm run build:react                 # Build React (output: dist/react/)
npm run build:production            # Both

# Testing
npm test
npm run test:unit
npm run test:integration
npm run test:react
npm run test:coverage

# Utilities
npm run setup                       # Load default agents/skills (server must be running)
npm run zip                         # Create timestamped release zip
npm run typecheck                   # TypeScript type checking (uses main tsconfig)
npm run lint
```

## Environment Variables

Create a `.env` file to override defaults:

```env
# Local LLM
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
LM_STUDIO_PORT=1234

# Cloud providers (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Databases (default: ./data/)
MAIN_DATABASE_PATH=./data/llm-charge.db
AGENTS_DATABASE_PATH=./data/agents.db
FLOWS_DATABASE_PATH=./data/flows.db

# Server
PORT=3001
NODE_ENV=development
```

## Configuration Files

- `config/router.json` — routing strategy, provider endpoints, cost thresholds
- `config/agents.json` — agent defaults, concurrency, security policies

## Troubleshooting

**Server won't start — port in use:**
```bash
lsof -ti:3001 | xargs kill
```

**Database issues — reset and recreate:**
```bash
rm -rf data/*.db
npm run dev:server:comprehensive
```

**React build issues:**
```bash
npm run clean
npm install
npm run build:production
```

**MCP bridge fails to connect:**
Make sure the backend is running first. The bridge checks `localhost:3001/mcp/status` on startup.

**Dependency or postinstall errors:**
```bash
npm install --ignore-scripts
```

## Project Structure

```
lllm-charge/
├── src/
│   ├── agents/          # Agent management
│   ├── cli/             # CLI entrypoint
│   ├── core/            # Types, knowledge base, cron scheduler
│   ├── dashboard/       # HTML dashboards + JS utilities
│   ├── database/        # SQLite database managers
│   ├── intelligence/    # Code analysis, docs intelligence
│   ├── mcp/             # MCP server, bridge, tools
│   ├── memory/          # Memory graph, checkpoints
│   ├── network/         # Distributed model network
│   ├── project-management/
│   ├── react/           # React frontend (built by Vite)
│   ├── react-tools/     # React scaffolding tools
│   ├── reasoning/       # Hybrid router, local LLM router, providers
│   ├── routing/         # Model router
│   ├── server/          # Backend HTTP server (comprehensive-working-server.mjs)
│   ├── setup/           # Default agent/skill loading, MCP extensions
│   ├── skills/          # Skill engine, devdocs, cron, spec cleanup
│   ├── specs/           # Spec manager
│   ├── ui/              # Web dashboard
│   ├── utils/           # Cost tracker, common commands
│   └── workflows/       # n8n-inspired workflow engine
├── blender_pipeline/    # Python 3D pipeline (separate from TS src)
├── scripts/             # Build, deploy, release scripts
├── tests/               # Jest test suites
├── config/              # JSON config files
├── docs/                # Documentation and audit files
└── .mcp.json            # MCP server config for Claude Code / Cursor
```
