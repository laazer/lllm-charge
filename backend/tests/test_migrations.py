"""
Smoke tests for JS → Python SQLite migration (MigrationRunner / DataMigrator).
"""
import asyncio
import shutil
import sqlite3
import tempfile
from pathlib import Path
from typing import Dict

import pytest

from app.database.migrations.migrate_from_js import MigrationRunner


def _create_test_source_databases(source_dbs: Dict[str, Path]) -> None:
    """Create minimal source DBs matching migrate_from_js expectations."""
    conn = sqlite3.connect(source_dbs["main"])
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            key TEXT,
            type TEXT,
            status TEXT,
            lead TEXT,
            agent_config TEXT,
            codegraph_path TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE specs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT,
            priority TEXT,
            tags TEXT,
            project_id TEXT,
            assigned_agent TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )
        """
    )
    cur.execute(
        """
        INSERT INTO projects VALUES (
            'main-1234567890123', 'Test Project', 'A test project', 'TEST',
            'software', 'active', 'test_lead', '{}', '/path/to/code',
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO specs VALUES (
            'spec-1234567890123', 'Test Spec', 'A test specification',
            'active', 'high', '["test"]', 'main-1234567890123', NULL,
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
        """
    )
    conn.commit()
    conn.close()

    conn = sqlite3.connect(source_dbs["agents"])
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            primary_role TEXT,
            capabilities TEXT,
            project_id TEXT,
            last_active DATETIME,
            created_at DATETIME,
            updated_at DATETIME
        )
        """
    )
    cur.execute(
        """
        INSERT INTO agents VALUES (
            'agent-1234567890123', 'Test Agent', 'A test agent', 'assistant',
            '{"reasoning": 0.9, "creativity": 0.8}', NULL,
            '2024-01-01 12:00:00', '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
        """
    )
    conn.commit()
    conn.close()

    conn = sqlite3.connect(source_dbs["flows"])
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE flows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT,
            status TEXT,
            nodes TEXT,
            edges TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )
        """
    )
    cur.execute(
        """
        INSERT INTO flows VALUES (
            'workflow-1234567890123', 'Test Workflow', 'A test workflow', 'workflow',
            'active', '[]', '[]',
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
        """
    )
    conn.commit()
    conn.close()


@pytest.fixture
def migration_temp_layout():
    temp_dir = tempfile.mkdtemp()
    try:
        source_main = Path(temp_dir) / "test_main.db"
        source_agents = Path(temp_dir) / "test_agents.db"
        source_flows = Path(temp_dir) / "test_flows.db"
        target_dir = Path(temp_dir) / "target"
        target_dir.mkdir()
        _create_test_source_databases(
            {"main": source_main, "agents": source_agents, "flows": source_flows}
        )
        yield {
            "main": source_main,
            "agents": source_agents,
            "flows": source_flows,
            "target_dir": target_dir,
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_migration_runner_writes_unified_sqlite_and_counts_rows(migration_temp_layout):
    layout = migration_temp_layout
    runner = MigrationRunner()
    result = asyncio.run(
        runner.run_full_migration(
            source_paths={
                "main_db": str(layout["main"]),
                "agents_db": str(layout["agents"]),
                "flows_db": str(layout["flows"]),
            },
            target_dir=str(layout["target_dir"]),
        )
    )
    assert result["success"] is True
    # main: 1 project + 1 spec (+ 0 notes); agents: 1; flows: 1
    assert result["total_migrated"] == 4
    assert "migration_id" in result

    migrated_db = layout["target_dir"] / "migrated.db"
    assert migrated_db.is_file()

    conn = sqlite3.connect(migrated_db)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM projects")
    assert cur.fetchone()[0] == 1
    cur.execute("SELECT COUNT(*) FROM specs")
    assert cur.fetchone()[0] == 1
    cur.execute("SELECT COUNT(*) FROM agents")
    assert cur.fetchone()[0] == 1
    cur.execute("SELECT COUNT(*) FROM flows")
    assert cur.fetchone()[0] == 1
    conn.close()
