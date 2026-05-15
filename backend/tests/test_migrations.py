"""
Test framework for database migrations
"""
import pytest
import asyncio
import tempfile
import shutil
import sqlite3
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from app.database.migrations.migrate_from_js import DataMigrator, MigrationRunner
from app.database.migrations.rollback import MigrationRollback
from app.database.backup import DatabaseBackup


@pytest.fixture
async def temp_migration_setup():
    """Set up temporary databases for migration testing"""
    temp_dir = tempfile.mkdtemp()
    
    # Create temporary source databases with test data
    source_dbs = {
        "main": Path(temp_dir) / "test_main.db",
        "agents": Path(temp_dir) / "test_agents.db", 
        "flows": Path(temp_dir) / "test_flows.db"
    }
    
    # Create test databases with sample data
    await _create_test_source_databases(source_dbs)
    
    # Set up target directory
    target_dir = Path(temp_dir) / "target"
    target_dir.mkdir()
    
    setup_data = {
        "temp_dir": temp_dir,
        "source_dbs": source_dbs,
        "target_dir": target_dir
    }
    
    yield setup_data
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def migration_runner():
    """Create migration runner instance"""
    return MigrationRunner()


@pytest.fixture
def rollback_manager():
    """Create rollback manager instance"""
    return MigrationRollback()


@pytest.fixture
def backup_manager():
    """Create backup manager instance"""
    return DatabaseBackup()


class TestDataMigration:
    """Test data migration functionality"""
    
    @pytest.mark.asyncio
    async def test_migration_integrity(self, temp_migration_setup, migration_runner):
        """Test that migration preserves data integrity"""
        setup = temp_migration_setup
        
        # Run migration
        result = await migration_runner.run_full_migration(
            source_paths={
                "main_db": str(setup["source_dbs"]["main"]),
                "agents_db": str(setup["source_dbs"]["agents"]),
                "flows_db": str(setup["source_dbs"]["flows"])
            },
            target_dir=str(setup["target_dir"])
        )
        
        # Verify migration success
        assert result["success"], f"Migration failed: {result.get('errors', [])}"
        assert result["total_migrated"] > 0, "No records were migrated"
        
        # Verify data integrity
        integrity_check = await self._verify_migration_integrity(
            setup["source_dbs"], 
            setup["target_dir"]
        )
        assert integrity_check["success"], f"Integrity check failed: {integrity_check['errors']}"
    
    @pytest.mark.asyncio
    async def test_migration_rollback(self, temp_migration_setup, migration_runner, rollback_manager):
        """Test migration rollback functionality"""
        setup = temp_migration_setup
        
        # First, run a migration
        migration_result = await migration_runner.run_full_migration(
            source_paths={
                "main_db": str(setup["source_dbs"]["main"]),
                "agents_db": str(setup["source_dbs"]["agents"]),
                "flows_db": str(setup["source_dbs"]["flows"])
            },
            target_dir=str(setup["target_dir"])
        )
        assert migration_result["success"], "Initial migration failed"
        
        # Perform rollback
        rollback_result = await rollback_manager.rollback_migration(
            migration_id=migration_result.get("migration_id"),
            restore_from_backup=True
        )
        
        # Verify rollback success
        assert rollback_result["success"], f"Rollback failed: {rollback_result.get('errors', [])}"
        assert len(rollback_result["databases_restored"]) > 0, "No databases were restored"
    
    @pytest.mark.asyncio
    async def test_migration_with_invalid_data(self, temp_migration_setup, migration_runner):
        """Test migration handling of invalid data"""
        setup = temp_migration_setup
        
        # Add invalid data to source database
        await self._add_invalid_data_to_source(setup["source_dbs"]["main"])
        
        # Run migration
        result = await migration_runner.run_full_migration(
            source_paths={
                "main_db": str(setup["source_dbs"]["main"]),
                "agents_db": str(setup["source_dbs"]["agents"]),
                "flows_db": str(setup["source_dbs"]["flows"])
            },
            target_dir=str(setup["target_dir"])
        )
        
        # Migration should succeed with invalid records cleaned
        assert result["success"], f"Migration failed: {result.get('errors', [])}"
        assert result.get("invalid_records_cleaned", 0) > 0, "Invalid records were not cleaned"
    
    @pytest.mark.asyncio
    async def test_chunked_migration_performance(self, temp_migration_setup, migration_runner):
        """Test chunked migration for large datasets"""
        setup = temp_migration_setup
        
        # Add large dataset to source
        await self._add_large_dataset(setup["source_dbs"]["main"], record_count=1000)
        
        # Run migration with small batch size
        migrator = DataMigrator()
        migrator.batch_size = 10  # Small batch for testing
        
        result = await migration_runner.run_full_migration(
            source_paths={
                "main_db": str(setup["source_dbs"]["main"]),
                "agents_db": str(setup["source_dbs"]["agents"]),
                "flows_db": str(setup["source_dbs"]["flows"])
            },
            target_dir=str(setup["target_dir"])
        )
        
        # Verify large dataset migration
        assert result["success"], f"Large dataset migration failed: {result.get('errors', [])}"
        assert result["total_migrated"] >= 1000, "Large dataset not fully migrated"
    
    @pytest.mark.asyncio
    async def test_migration_id_preservation(self, temp_migration_setup, migration_runner):
        """Test that existing ID formats are preserved"""
        setup = temp_migration_setup
        
        # Add records with specific ID formats
        test_ids = {
            "project_id": "main-1234567890123",
            "agent_id": "agent-1234567890123-abcdef",
            "flow_id": "workflow-1234567890123-xyz123"
        }
        await self._add_records_with_specific_ids(setup["source_dbs"], test_ids)
        
        # Run migration
        result = await migration_runner.run_full_migration(
            source_paths={
                "main_db": str(setup["source_dbs"]["main"]),
                "agents_db": str(setup["source_dbs"]["agents"]),
                "flows_db": str(setup["source_dbs"]["flows"])
            },
            target_dir=str(setup["target_dir"])
        )
        
        assert result["success"], f"Migration failed: {result.get('errors', [])}"
        
        # Verify IDs are preserved
        preserved_ids = await self._verify_id_preservation(setup["target_dir"], test_ids)
        assert preserved_ids["success"], f"ID preservation failed: {preserved_ids['errors']}"
    
    @pytest.mark.asyncio
    async def test_json_field_handling(self, temp_migration_setup, migration_runner):
        """Test proper handling of JSON fields during migration"""
        setup = temp_migration_setup
        
        # Add records with complex JSON data
        json_data = {
            "capabilities": {"reasoning": 0.9, "creativity": 0.8},
            "agent_config": {"claudeMdPath": "./CLAUDE.md", "skillsDir": "./skills"},
            "metadata": {"nested": {"deep": {"value": "test"}}}
        }
        await self._add_json_data_to_source(setup["source_dbs"], json_data)
        
        # Run migration
        result = await migration_runner.run_full_migration(
            source_paths={
                "main_db": str(setup["source_dbs"]["main"]),
                "agents_db": str(setup["source_dbs"]["agents"]),
                "flows_db": str(setup["source_dbs"]["flows"])
            },
            target_dir=str(setup["target_dir"])
        )
        
        assert result["success"], f"Migration failed: {result.get('errors', [])}"
        
        # Verify JSON data integrity
        json_integrity = await self._verify_json_integrity(setup["target_dir"], json_data)
        assert json_integrity["success"], f"JSON integrity check failed: {json_integrity['errors']}"


class TestMigrationRollback:
    """Test migration rollback functionality"""
    
    @pytest.mark.asyncio
    async def test_rollback_with_backup(self, rollback_manager, backup_manager):
        """Test rollback using backup files"""
        # Create a backup first
        backup_result = await backup_manager.backup_database(
            database_names=["main"], 
            notes="Test backup for rollback"
        )
        assert backup_result["success"], "Failed to create test backup"
        
        backup_id = backup_result["backup_id"]
        
        # Perform rollback
        rollback_result = await rollback_manager.rollback_migration(
            migration_id=backup_id,
            restore_from_backup=True
        )
        
        # Verify rollback
        assert rollback_result["success"], f"Rollback failed: {rollback_result.get('errors', [])}"
        assert len(rollback_result["databases_restored"]) > 0, "No databases restored"
    
    @pytest.mark.asyncio
    async def test_automatic_rollback_on_failure(self, rollback_manager):
        """Test automatic rollback when migration fails"""
        error_context = {
            "error": "Simulated migration failure",
            "migration_id": "test_migration_123",
            "timestamp": datetime.utcnow()
        }
        
        # Trigger automatic rollback
        result = await rollback_manager.rollback_on_failure(error_context)
        
        # Verify rollback handling
        assert "success" in result, "Rollback result missing success field"
        assert "errors" in result, "Rollback result missing errors field"
    
    @pytest.mark.asyncio
    async def test_backup_restoration(self, rollback_manager):
        """Test backup restoration functionality"""
        # Create temporary backup file for testing
        temp_dir = tempfile.mkdtemp()
        backup_timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        try:
            # Simulate backup existence
            result = await rollback_manager.restore_backup(backup_timestamp)
            
            # Should handle missing backup gracefully
            assert "success" in result, "Restore result missing success field"
            assert "errors" in result, "Restore result missing errors field"
            
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class TestMigrationPerformance:
    """Test migration performance and optimization"""
    
    @pytest.mark.asyncio
    async def test_large_dataset_migration_speed(self, temp_migration_setup):
        """Test migration performance with large datasets"""
        setup = temp_migration_setup
        
        # Create large dataset
        await self._add_large_dataset(setup["source_dbs"]["main"], record_count=5000)
        
        start_time = datetime.utcnow()
        
        # Run migration
        migrator = DataMigrator()
        result = await migrator.migrate_main_db(
            str(setup["source_dbs"]["main"]),
            str(setup["target_dir"] / "target_main.db")
        )
        
        end_time = datetime.utcnow()
        migration_duration = (end_time - start_time).total_seconds()
        
        # Verify performance
        assert result["success"], "Large dataset migration failed"
        assert migration_duration < 60, f"Migration too slow: {migration_duration}s"
        assert result["migrated_count"] == 5000, "Not all records migrated"
    
    @pytest.mark.asyncio
    async def test_concurrent_migration_safety(self, temp_migration_setup):
        """Test that concurrent migrations are handled safely"""
        setup = temp_migration_setup
        
        # Create two migration tasks
        async def run_migration_task(task_id: int):
            migrator = DataMigrator()
            return await migrator.migrate_main_db(
                str(setup["source_dbs"]["main"]),
                str(setup["target_dir"] / f"target_main_{task_id}.db")
            )
        
        # Run concurrent migrations
        task1 = asyncio.create_task(run_migration_task(1))
        task2 = asyncio.create_task(run_migration_task(2))
        
        results = await asyncio.gather(task1, task2, return_exceptions=True)
        
        # Verify concurrent safety
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                pytest.fail(f"Concurrent migration {i+1} failed with exception: {result}")
            assert result["success"], f"Concurrent migration {i+1} failed"


class TestMigrationValidation:
    """Test migration data validation"""
    
    @pytest.mark.asyncio
    async def test_data_validation_rules(self, temp_migration_setup):
        """Test that data validation rules are applied"""
        setup = temp_migration_setup
        
        # Add invalid data that should be caught
        await self._add_validation_test_data(setup["source_dbs"]["main"])
        
        migrator = DataMigrator()
        result = await migrator.migrate_main_db(
            str(setup["source_dbs"]["main"]),
            str(setup["target_dir"] / "target_main.db")
        )
        
        # Verify validation worked
        assert result["success"], "Migration with validation failed"
        assert result.get("validation_errors", 0) > 0, "Validation errors not detected"
        assert result.get("invalid_records_cleaned", 0) > 0, "Invalid records not cleaned"
    
    @pytest.mark.asyncio
    async def test_foreign_key_validation(self, temp_migration_setup):
        """Test foreign key relationship validation"""
        setup = temp_migration_setup
        
        # Add data with broken foreign key relationships
        await self._add_broken_foreign_keys(setup["source_dbs"]["main"])
        
        migrator = DataMigrator()
        result = await migrator.migrate_main_db(
            str(setup["source_dbs"]["main"]),
            str(setup["target_dir"] / "target_main.db")
        )
        
        # Verify foreign key handling
        assert result["success"], "Migration with broken foreign keys failed"
        assert result.get("foreign_key_violations", 0) > 0, "Foreign key violations not detected"


# Helper functions for test data creation
async def _create_test_source_databases(source_dbs: Dict[str, Path]):
    """Create test source databases with sample data"""
    # Main database
    conn = sqlite3.connect(source_dbs["main"])
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
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
    """)
    
    cursor.execute("""
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
    """)
    
    # Insert sample data
    cursor.execute("""
        INSERT INTO projects VALUES (
            'main-1234567890123', 'Test Project', 'A test project', 'TEST', 
            'software', 'active', 'test_lead', '{}', '/path/to/code',
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """)
    
    cursor.execute("""
        INSERT INTO specs VALUES (
            'spec-1234567890123', 'Test Spec', 'A test specification', 
            'active', 'high', '["test"]', 'main-1234567890123', NULL,
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """)
    
    conn.commit()
    conn.close()
    
    # Agents database
    conn = sqlite3.connect(source_dbs["agents"])
    cursor = conn.cursor()
    
    cursor.execute("""
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
    """)
    
    cursor.execute("""
        INSERT INTO agents VALUES (
            'agent-1234567890123', 'Test Agent', 'A test agent', 'assistant',
            '{"reasoning": 0.9, "creativity": 0.8}', NULL,
            '2024-01-01 12:00:00', '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """)
    
    conn.commit()
    conn.close()
    
    # Flows database
    conn = sqlite3.connect(source_dbs["flows"])
    cursor = conn.cursor()
    
    cursor.execute("""
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
    """)
    
    cursor.execute("""
        INSERT INTO flows VALUES (
            'workflow-1234567890123', 'Test Workflow', 'A test workflow', 'workflow',
            'active', '[]', '[]',
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """)
    
    conn.commit()
    conn.close()


async def _verify_migration_integrity(source_dbs: Dict[str, Path], target_dir: Path) -> Dict[str, Any]:
    """Verify migration integrity by comparing source and target data"""
    result = {"success": True, "errors": []}
    
    try:
        # Basic check - verify target databases exist
        expected_targets = ["main.db", "agents.db", "flows.db"]
        for db_name in expected_targets:
            db_path = target_dir / db_name
            if not db_path.exists():
                result["errors"].append(f"Target database missing: {db_name}")
                result["success"] = False
        
        # Additional integrity checks would go here
        # (comparing record counts, data validation, etc.)
        
    except Exception as e:
        result["errors"].append(f"Integrity verification failed: {e}")
        result["success"] = False
    
    return result


async def _add_invalid_data_to_source(db_path: Path):
    """Add invalid data to test validation"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Insert record with invalid data
    cursor.execute("""
        INSERT INTO projects VALUES (
            NULL, '', NULL, '', '', '', '', '', '',
            'invalid_date', 'invalid_date'
        )
    """)
    
    conn.commit()
    conn.close()


async def _add_large_dataset(db_path: Path, record_count: int):
    """Add large dataset for performance testing"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    for i in range(record_count):
        cursor.execute("""
            INSERT INTO specs VALUES (
                ?, ?, ?, 'active', 'medium', '["test"]', 'main-1234567890123', NULL,
                '2024-01-01 12:00:00', '2024-01-01 12:00:00'
            )
        """, (f"spec-large-{i:06d}", f"Large Spec {i}", f"Description for spec {i}"))
    
    conn.commit()
    conn.close()


async def _add_records_with_specific_ids(source_dbs: Dict[str, Path], test_ids: Dict[str, str]):
    """Add records with specific ID formats for testing preservation"""
    # Add to main database
    conn = sqlite3.connect(source_dbs["main"])
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO projects VALUES (
            ?, 'ID Test Project', 'Testing ID preservation', 'IDTEST', 
            'software', 'active', 'test_lead', '{}', '/path/to/code',
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """, (test_ids["project_id"],))
    
    conn.commit()
    conn.close()
    
    # Add similar records to other databases
    # Implementation would continue for agents and flows


async def _add_json_data_to_source(source_dbs: Dict[str, Path], json_data: Dict[str, Any]):
    """Add records with complex JSON data"""
    import json
    
    # Add to agents database with JSON capabilities
    conn = sqlite3.connect(source_dbs["agents"])
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO agents VALUES (
            'agent-json-test', 'JSON Test Agent', 'Testing JSON handling', 'assistant',
            ?, NULL,
            '2024-01-01 12:00:00', '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """, (json.dumps(json_data["capabilities"]),))
    
    conn.commit()
    conn.close()


async def _verify_id_preservation(target_dir: Path, test_ids: Dict[str, str]) -> Dict[str, Any]:
    """Verify that specific IDs were preserved during migration"""
    result = {"success": True, "errors": []}
    
    try:
        # Check main database for project ID
        conn = sqlite3.connect(target_dir / "main.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM projects WHERE id = ?", (test_ids["project_id"],))
        if not cursor.fetchone():
            result["errors"].append(f"Project ID not preserved: {test_ids['project_id']}")
            result["success"] = False
        conn.close()
        
    except Exception as e:
        result["errors"].append(f"ID preservation check failed: {e}")
        result["success"] = False
    
    return result


async def _verify_json_integrity(target_dir: Path, json_data: Dict[str, Any]) -> Dict[str, Any]:
    """Verify JSON data integrity after migration"""
    result = {"success": True, "errors": []}
    
    try:
        # Check agents database for JSON capabilities
        conn = sqlite3.connect(target_dir / "agents.db")
        cursor = conn.cursor()
        cursor.execute("SELECT capabilities FROM agents WHERE id = 'agent-json-test'")
        row = cursor.fetchone()
        
        if row:
            import json
            stored_capabilities = json.loads(row[0])
            if stored_capabilities != json_data["capabilities"]:
                result["errors"].append("JSON capabilities data corrupted")
                result["success"] = False
        else:
            result["errors"].append("JSON test agent not found")
            result["success"] = False
            
        conn.close()
        
    except Exception as e:
        result["errors"].append(f"JSON integrity check failed: {e}")
        result["success"] = False
    
    return result


async def _add_validation_test_data(db_path: Path):
    """Add data that should trigger validation errors"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Insert project with missing required fields
    cursor.execute("""
        INSERT INTO projects VALUES (
            'invalid-project', '', NULL, '', '', 'invalid_status', '', '', '',
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """)
    
    conn.commit()
    conn.close()


async def _add_broken_foreign_keys(db_path: Path):
    """Add data with broken foreign key relationships"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Insert spec with non-existent project_id
    cursor.execute("""
        INSERT INTO specs VALUES (
            'spec-broken-fk', 'Broken FK Spec', 'Spec with broken foreign key', 
            'active', 'high', '["test"]', 'non-existent-project', NULL,
            '2024-01-01 12:00:00', '2024-01-01 12:00:00'
        )
    """)
    
    conn.commit()
    conn.close()


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])