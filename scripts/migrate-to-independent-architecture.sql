-- Migration Script: Remove Legacy Tables for Independent Architecture
-- CRITICAL-003: Database Architecture Chaos Resolution
-- 
-- This script removes legacy agents and workflows tables from the main database
-- since they now exist as independent databases (agents.db and flows.db)
-- 
-- Backup created: data/backups/llm-charge-backup-YYYYMMDD-HHMMSS.db
--
-- Architecture After Migration:
-- - Main DB (llm-charge.db): projects, specs, notes, checkpoints, request_metrics
-- - Agent DB (agents.db): agents, agent_tasks, agent_learning, agent_collaborations  
-- - Flow DB (flows.db): flows, flow_executions, flow_templates, flow_versions, flow_schedules

BEGIN TRANSACTION;

-- Remove legacy agents table (agents now in independent agents.db)
-- Note: 13 agents exist in main DB, 24 agents exist in independent DB
DROP TABLE IF EXISTS agents;
SELECT 'Legacy agents table removed - agents now managed in agents.db' AS status;

-- Remove legacy workflows table (workflows now in independent flows.db as flows)
-- Note: 3 workflows exist in main DB, 27 flows exist in independent DB 
DROP TABLE IF EXISTS workflows;
SELECT 'Legacy workflows table removed - workflows now managed in flows.db' AS status;

-- Verify the tables are gone
SELECT 'Remaining tables:' AS verification;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

COMMIT;

SELECT 'Migration complete - Independent architecture now clean' AS final_status;
SELECT 'Main DB now contains only: projects, specs, notes, checkpoints, etc.' AS architecture_status;
SELECT 'Agents managed independently in: agents.db' AS agents_status;
SELECT 'Workflows/Flows managed independently in: flows.db' AS flows_status;