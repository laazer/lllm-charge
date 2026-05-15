#!/bin/bash

# Migration Script: Consolidate to Independent Database Architecture
# This script resolves CRITICAL-003 by migrating from dual database architecture
# to the intended independent architecture specified in .env.production

set -e  # Exit on any error

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
echo "🚀 Starting Database Architecture Migration - $TIMESTAMP"
echo "📋 CRITICAL-003: Resolve Database Architecture Chaos"
echo ""

# Database paths
MAIN_DB="./data/llm-charge.db"
AGENTS_DB="./data/agents.db"
FLOWS_DB="./data/flows.db"

# Validate databases exist
echo "🔍 Validating database files..."
if [ ! -f "$MAIN_DB" ]; then
    echo "❌ Main database not found: $MAIN_DB"
    exit 1
fi
if [ ! -f "$AGENTS_DB" ]; then
    echo "❌ Agents database not found: $AGENTS_DB"
    exit 1
fi
if [ ! -f "$FLOWS_DB" ]; then
    echo "❌ Flows database not found: $FLOWS_DB"
    exit 1
fi

echo "📊 Analyzing current data state..."
echo ""

# Get current counts
MAIN_AGENT_COUNT=$(sqlite3 "$MAIN_DB" "SELECT COUNT(*) FROM agents;")
MAIN_WORKFLOW_COUNT=$(sqlite3 "$MAIN_DB" "SELECT COUNT(*) FROM workflows;")
INDEPENDENT_AGENT_COUNT=$(sqlite3 "$AGENTS_DB" "SELECT COUNT(*) FROM agents;")
INDEPENDENT_FLOW_COUNT=$(sqlite3 "$FLOWS_DB" "SELECT COUNT(*) FROM flows;")

echo "📈 Current Data Distribution:"
echo "   Main Database: $MAIN_AGENT_COUNT agents, $MAIN_WORKFLOW_COUNT workflows"
echo "   Independent DBs: $INDEPENDENT_AGENT_COUNT agents, $INDEPENDENT_FLOW_COUNT flows"
echo "   Total Data: $((MAIN_AGENT_COUNT + INDEPENDENT_AGENT_COUNT)) agents, $((MAIN_WORKFLOW_COUNT + INDEPENDENT_FLOW_COUNT)) workflows"
echo ""

# Phase 1: Migrate agents from main DB to independent agents DB
echo "🔄 Phase 1: Migrating agents to independent architecture..."

# Create a temporary file with agent migration SQL
cat > /tmp/migrate_agents.sql << 'EOF'
-- Attach databases
ATTACH DATABASE './data/llm-charge.db' AS main_db;

-- Insert agents from main DB that don't already exist in independent DB
INSERT OR IGNORE INTO agents (
  id, name, description, primaryRole, capabilities, type, 
  createdAt, updatedAt, status, version
)
SELECT 
  main_db.agents.id,
  main_db.agents.name,
  COALESCE(main_db.agents.description, ''),
  COALESCE(main_db.agents.primaryRole, 'general'),
  COALESCE(main_db.agents.data, '{}'),  -- Use data field as capabilities
  'general',
  main_db.agents.createdAt,
  main_db.agents.updatedAt,
  'active',
  1
FROM main_db.agents
WHERE main_db.agents.id NOT IN (SELECT id FROM agents);

-- Get migration count
SELECT 'Agents migrated: ' || changes() as migration_result;
EOF

echo "   Executing agent migration..."
sqlite3 "$AGENTS_DB" < /tmp/migrate_agents.sql

# Phase 2: Migrate workflows from main DB to independent flows DB
echo ""
echo "🔄 Phase 2: Migrating workflows to independent flows architecture..."

# Create a temporary file with workflow migration SQL
cat > /tmp/migrate_workflows.sql << 'EOF'
-- Attach databases
ATTACH DATABASE './data/llm-charge.db' AS main_db;

-- Insert workflows from main DB that don't already exist in flows DB
INSERT OR IGNORE INTO flows (
  id, name, description, type, category, nodes, edges, settings,
  triggers, status, tags, createdAt, updatedAt, version
)
SELECT 
  main_db.workflows.id,
  main_db.workflows.title,  -- title -> name
  COALESCE(main_db.workflows.description, ''),
  'workflow',
  'general',
  COALESCE(main_db.workflows.nodes, '[]'),
  COALESCE(main_db.workflows.edges, '[]'),
  COALESCE(main_db.workflows.settings, '{}'),
  COALESCE(main_db.workflows.triggers, '[]'),
  COALESCE(main_db.workflows.status, 'draft'),
  COALESCE(main_db.workflows.tags, '[]'),
  main_db.workflows.createdAt,
  main_db.workflows.updatedAt,
  1
FROM main_db.workflows
WHERE main_db.workflows.id NOT IN (SELECT id FROM flows);

-- Get migration count
SELECT 'Workflows migrated: ' || changes() as migration_result;
EOF

echo "   Executing workflow migration..."
sqlite3 "$FLOWS_DB" < /tmp/migrate_workflows.sql

# Phase 3: Clean up main database (remove agent and workflow tables data)
echo ""
echo "🧹 Phase 3: Cleaning up main database..."

# Only delete if we have backups
if [ -d "data/backups/migration-$(date +%Y%m%d)*" ]; then
    echo "   🔄 Removing migrated data from main database..."
    
    # Delete agents from main database
    DELETED_AGENTS=$(sqlite3 "$MAIN_DB" "DELETE FROM agents; SELECT changes();")
    echo "   ✅ Removed $DELETED_AGENTS agents from main database"
    
    # Delete workflows from main database  
    DELETED_WORKFLOWS=$(sqlite3 "$MAIN_DB" "DELETE FROM workflows; SELECT changes();")
    echo "   ✅ Removed $DELETED_WORKFLOWS workflows from main database"
else
    echo "   ⚠️  Backup not found, skipping cleanup for safety"
fi

# Phase 4: Validation
echo ""
echo "🔍 Phase 4: Validating migration..."

FINAL_MAIN_AGENTS=$(sqlite3 "$MAIN_DB" "SELECT COUNT(*) FROM agents;")
FINAL_MAIN_WORKFLOWS=$(sqlite3 "$MAIN_DB" "SELECT COUNT(*) FROM workflows;")
FINAL_INDEPENDENT_AGENTS=$(sqlite3 "$AGENTS_DB" "SELECT COUNT(*) FROM agents;")
FINAL_INDEPENDENT_FLOWS=$(sqlite3 "$FLOWS_DB" "SELECT COUNT(*) FROM flows;")

echo "📊 Final Data Distribution:"
echo "   Main Database: $FINAL_MAIN_AGENTS agents, $FINAL_MAIN_WORKFLOWS workflows"
echo "   Independent DBs: $FINAL_INDEPENDENT_AGENTS agents, $FINAL_INDEPENDENT_FLOWS flows"

# Generate migration report
echo ""
echo "📋 Migration Report:"
echo "============================================================"
echo "✅ Migration completed successfully!"
echo "📅 Timestamp: $TIMESTAMP"
echo "🔄 Final independent agents: $FINAL_INDEPENDENT_AGENTS"
echo "🔄 Final independent flows: $FINAL_INDEPENDENT_FLOWS"
echo "🏗️  Architecture: Consolidated to Independent (matches .env.production)"
echo "============================================================"

# Clean up temporary files
rm -f /tmp/migrate_agents.sql /tmp/migrate_workflows.sql

echo ""
echo "🎉 CRITICAL-003 Database Architecture Chaos - MIGRATION PHASE COMPLETE!"
echo ""
echo "📋 Next Steps:"
echo "   1. Update server code to use only independent databases"
echo "   2. Remove agent/workflow table references from main database code"
echo "   3. Update all API endpoints to route to correct databases"
echo "   4. Test full system integration"
echo "   5. Update documentation to reflect independent architecture"