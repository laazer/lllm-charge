"""
Tests for DatabaseBackup aligned with the real implementation.
"""
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from app.database.backup import DatabaseBackup, RestoreManager


@pytest.fixture
def isolated_backup_env():
    """Temp dirs and empty SQLite files at configured paths."""
    root = tempfile.mkdtemp()
    data_dir = Path(root) / "data"
    data_dir.mkdir(parents=True)
    backup_dir = Path(root) / "backups"
    backup_dir.mkdir()

    main_path = data_dir / "llm-charge.db"
    agents_path = data_dir / "agents.db"
    flows_path = data_dir / "flows.db"
    for p in (main_path, agents_path, flows_path):
        Path(p).write_bytes(b"")

    import sqlite3

    for p in (main_path, agents_path, flows_path):
        conn = sqlite3.connect(str(p))
        conn.execute("CREATE TABLE IF NOT EXISTS _t (x INTEGER)")
        conn.commit()
        conn.close()

    yield {
        "root": root,
        "data_dir": data_dir,
        "backup_dir": backup_dir,
        "paths": {
            "main": str(main_path),
            "agents": str(agents_path),
            "flows": str(flows_path),
        },
    }
    shutil.rmtree(root, ignore_errors=True)


@pytest.mark.asyncio
async def test_backup_database_creates_files_and_metadata(isolated_backup_env):
    env = isolated_backup_env
    b = DatabaseBackup(backup_dir=str(env["backup_dir"]))
    b.db_paths = {
        "main": env["paths"]["main"],
        "agents": env["paths"]["agents"],
        "flows": env["paths"]["flows"],
    }
    result = await b.backup_database(
        database_names=["main", "agents"], compress=False, notes="unit test"
    )
    assert result["success"] is True
    assert result["backup_id"]
    assert len(result["backup_files"]) == 2
    assert (env["backup_dir"] / "backup_metadata.json").is_file()


@pytest.mark.asyncio
async def test_list_backups_after_backup(isolated_backup_env):
    env = isolated_backup_env
    b = DatabaseBackup(backup_dir=str(env["backup_dir"]))
    b.db_paths = {
        "main": env["paths"]["main"],
        "agents": env["paths"]["agents"],
        "flows": env["paths"]["flows"],
    }
    await b.backup_database(database_names=["main"], compress=False)
    listed = await b.list_backups(limit=5)
    assert len(listed) >= 1
    assert listed[0]["backup_id"]


@pytest.mark.asyncio
async def test_verify_backup_unknown_id_reports_failure():
    b = DatabaseBackup(backup_dir=tempfile.mkdtemp())
    try:
        out = await b.verify_backup("nonexistent-backup-id")
        assert out["success"] is False
        assert out["errors"]
    finally:
        shutil.rmtree(b.backup_dir, ignore_errors=True)


def test_restore_manager_is_database_backup_subclass():
    assert issubclass(RestoreManager, DatabaseBackup)
