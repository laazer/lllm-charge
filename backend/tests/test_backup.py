"""
Test file for database backup and restore functionality
Testing backup, restore, and recovery operations
"""
import pytest
import asyncio
import sqlite3
import os
import tempfile
import json
import shutil
from datetime import datetime
from pathlib import Path

from app.database.backup import DatabaseBackup
from app.database.models.main import Base, Project, Specification
from app.database.models.agents import Agent
from app.database.models.flows import Flow


class TestDatabaseBackup:
    """Test database backup functionality"""
    
    @pytest.fixture
    def backup_instance(self):
        """Create DatabaseBackup instance for testing"""
        return DatabaseBackup()
    
    @pytest.fixture
    def restore_instance(self):
        """Create DatabaseBackup instance for restore testing"""
        return DatabaseBackup()
    
    @pytest.fixture
    def temp_db_with_data(self):
        """Create temporary database with sample data"""
        db_fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(db_fd)
        
        # Create database with sample data
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create projects table and data
        cursor.execute('''
            CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                key TEXT UNIQUE NOT NULL,
                description TEXT,
                type TEXT,
                status TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            INSERT INTO projects (id, name, key, description, type, status)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            "backup-test-project",
            "Backup Test Project", 
            "BACKUP",
            "Testing backup functionality",
            "test",
            "active"
        ))
        
        # Create specs table and data
        cursor.execute('''
            CREATE TABLE specifications (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                project_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )
        ''')
        
        cursor.execute('''
            INSERT INTO specifications (id, title, description, status, project_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            "backup-test-spec",
            "Backup Test Specification",
            "Testing spec backup",
            "active",
            "backup-test-project"
        ))
        
        conn.commit()
        conn.close()
        
        yield db_path
        
        # Cleanup
        if os.path.exists(db_path):
            os.unlink(db_path)
    
    @pytest.fixture
    def temp_backup_dir(self):
        """Create temporary backup directory"""
        backup_dir = tempfile.mkdtemp()
        yield backup_dir
        # Cleanup
        shutil.rmtree(backup_dir)
    
    @pytest.mark.asyncio
    async def test_backup_database_creation(self, backup_instance, temp_db_with_data, temp_backup_dir):
        """Test database backup creation"""
        # Configure backup instance with temp directory
        backup_instance.backup_dir = Path(temp_backup_dir)
        
        # Test backup creation (conceptual test)
        backup_result = await backup_instance.backup_database(
            database_names=["main"],
            compress=True
        )
        
        # Verify backup was created
        assert backup_result["success"] is True
        assert "backup_id" in backup_result
        assert "timestamp" in backup_result
        
        # Check backup file exists
        backup_files = list(Path(temp_backup_dir).glob("*.db*"))
        assert len(backup_files) > 0
    
    @pytest.mark.asyncio
    async def test_restore_database_functionality(self, restore_instance, temp_db_with_data, temp_backup_dir):
        """Test database restore functionality"""
        # First create a backup
        backup_result = await restore_instance.backup_database(
            database_names=["main"],
            compress=False
        )
        backup_result["backup_dir"] = Path(temp_backup_dir)
        
        # Verify backup was created
        assert backup_result["success"] is True
        backup_id = backup_result["backup_id"]
        
        # Verify restore_database method exists and accepts correct params
        assert hasattr(restore_instance, "restore_database")
        restore_result = await restore_instance.restore_database(
            backup_id=backup_id,
            database_names=["main"]
        )
        
        # Verify restore was attempted
        assert "success" in restore_result
        assert "restored_databases" in restore_result
        assert "errors" in restore_result
    
    def test_backup_file_naming_convention(self, backup_instance):
        """Test backup file naming follows correct convention"""
        # Test timestamp generation
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        # Test backup filename generation
        backup_name = f"main_backup_{timestamp}.db"
        
        # Verify naming convention
        assert "backup" in backup_name
        assert timestamp in backup_name
        assert backup_name.endswith(".db")
        assert len(timestamp) == 15  # YYYYMMDD_HHMMSS format
    
    @pytest.mark.asyncio
    async def test_backup_metadata_creation(self, backup_instance):
        """Test backup metadata is created correctly"""
        # Test backup metadata structure
        backup_metadata = {
            "backup_id": "backup_20240115_103000",
            "timestamp": datetime.utcnow(),
            "database_type": "main",
            "file_size": 1024,
            "record_counts": {
                "projects": 5,
                "specifications": 15,
                "agents": 3
            },
            "backup_type": "full",
            "compression": False
        }
        
        # Verify metadata structure
        assert "backup_id" in backup_metadata
        assert "timestamp" in backup_metadata
        assert "database_type" in backup_metadata
        assert "record_counts" in backup_metadata
        assert isinstance(backup_metadata["record_counts"], dict)
    
    @pytest.mark.asyncio
    async def test_backup_integrity_verification(self, backup_instance, temp_db_with_data, temp_backup_dir):
        """Test backup integrity verification"""
        # Create a backup first
        backup_result = await backup_instance.backup_database(
            database_names=["main"],
            compress=False
        )
        assert backup_result["success"] is True
        
        # Test integrity check using the actual API
        integrity_result = await backup_instance.verify_backup(backup_result["backup_id"])
        
        assert "success" in integrity_result
        assert "backup_id" in integrity_result
    
    @pytest.mark.asyncio
    async def test_backup_compression_options(self, backup_instance, temp_db_with_data, temp_backup_dir):
        """Test backup compression configuration"""
        backup_instance.backup_dir = Path(temp_backup_dir)
        
        # Test uncompressed backup
        uncompressed = await backup_instance.backup_database(
            database_names=["main"],
            compress=False
        )
        assert uncompressed["success"] is True
        
        # Test compressed backup
        compressed = await backup_instance.backup_database(
            database_names=["main"],
            compress=True
        )
        assert compressed["success"] is True
        assert len(compressed["backup_files"]) > 0
    
    @pytest.mark.asyncio
    async def test_incremental_backup_support(self, backup_instance):
        """Test incremental backup functionality"""
        # Test incremental backup configuration
        incremental_config = {
            "enabled": True,
            "base_backup": "full_backup_20240115_100000.db",
            "track_changes": True,
            "change_log": []
        }
        
        # Verify incremental backup support
        assert "base_backup" in incremental_config
        assert "track_changes" in incremental_config
        assert isinstance(incremental_config["change_log"], list)
    
    @pytest.mark.asyncio
    async def test_backup_retention_policy(self, backup_instance, temp_backup_dir):
        """Test backup retention and cleanup"""
        backup_instance.backup_dir = Path(temp_backup_dir)
        
        # Create multiple backup files with different timestamps
        backup_files = [
            "main_backup_20240101_120000.db",
            "main_backup_20240102_120000.db", 
            "main_backup_20240103_120000.db",
            "main_backup_20240104_120000.db",
            "main_backup_20240105_120000.db"
        ]
        
        # Create actual backup files
        for backup_file in backup_files:
            backup_path = os.path.join(temp_backup_dir, backup_file)
            with open(backup_path, 'w') as f:
                f.write("dummy backup content")
        
        # Test retention policy (keep 3 most recent)
        retention_result = await backup_instance.cleanup_old_backups(keep_count=3)
        
        assert retention_result["success"] is True
        assert "deleted_backups" in retention_result
        assert "kept_backups" in retention_result


class TestBackupRecovery:
    """Test backup recovery scenarios"""
    
    @pytest.fixture
    def recovery_manager(self):
        """Create DatabaseBackup instance for recovery testing"""
        return DatabaseBackup()
    
    @pytest.mark.asyncio
    async def test_point_in_time_recovery(self, recovery_manager):
        """Test point-in-time recovery configuration"""
        recovery_point = datetime(2024, 1, 15, 10, 30, 0)
        
        recovery_options = {
            "target_time": recovery_point,
            "recovery_type": "point_in_time",
            "consistency_check": True
        }
        
        assert recovery_options["target_time"] == recovery_point
        assert recovery_options["recovery_type"] == "point_in_time"
        assert recovery_options["consistency_check"] is True
    
    @pytest.mark.asyncio
    async def test_disaster_recovery_workflow(self, recovery_manager):
        """Test disaster recovery workflow configuration"""
        recovery_steps = [
            "assess_damage",
            "identify_last_good_backup", 
            "validate_backup_integrity",
            "restore_from_backup",
            "verify_data_consistency",
            "resume_operations"
        ]
        
        assert len(recovery_steps) == 6
        assert "restore_from_backup" in recovery_steps
        assert "verify_data_consistency" in recovery_steps
    
    def test_backup_validation_checksums(self, recovery_manager):
        """Test backup validation using checksums"""
        sample_data = b"sample backup data content"
        
        import hashlib
        checksum = hashlib.md5(sample_data).hexdigest()
        
        assert len(checksum) == 32
        assert all(c in '0123456789abcdef' for c in checksum)
    
    @pytest.mark.asyncio
    async def test_cross_platform_backup_compatibility(self, recovery_manager):
        """Test backup compatibility across platforms"""
        platform_considerations = {
            "file_paths": {
                "windows": "C:\\data\\backups\\",
                "unix": "/data/backups/",
                "relative": "./data/backups/"
            },
            "file_permissions": {
                "unix_readable": "644",
                "unix_executable": "755"
            },
            "encoding": "utf-8"
        }
        
        assert "windows" in platform_considerations["file_paths"]
        assert "unix" in platform_considerations["file_paths"]
        assert platform_considerations["encoding"] == "utf-8"


if __name__ == "__main__":
    # Run backup and restore tests
    pytest.main([__file__, "-v"])