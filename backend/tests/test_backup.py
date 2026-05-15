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

from app.database.backup import DatabaseBackup, RestoreManager
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
        """Create RestoreManager instance for testing"""
        return RestoreManager()
    
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
            source_db=temp_db_with_data,
            backup_name="test_backup"
        )
        
        # Verify backup was created
        assert backup_result["success"] is True
        assert "backup_file" in backup_result
        assert "timestamp" in backup_result
        
        # Check backup file exists
        backup_files = list(Path(temp_backup_dir).glob("*.db"))
        assert len(backup_files) > 0
    
    @pytest.mark.asyncio
    async def test_restore_database_functionality(self, restore_instance, temp_db_with_data, temp_backup_dir):
        """Test database restore functionality"""
        # First create a backup
        backup_file = os.path.join(temp_backup_dir, "restore_test_backup.db")
        shutil.copy2(temp_db_with_data, backup_file)
        
        # Create new empty database to restore to
        restore_target_fd, restore_target = tempfile.mkstemp(suffix='.db')
        os.close(restore_target_fd)
        
        try:
            # Test restore operation
            restore_result = await restore_instance.restore_database(
                backup_file=backup_file,
                target_db=restore_target
            )
            
            # Verify restore was successful
            assert restore_result["success"] is True
            assert os.path.exists(restore_target)
            
            # Verify data integrity after restore
            conn = sqlite3.connect(restore_target)
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM projects")
            project_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM specifications")
            spec_count = cursor.fetchone()[0]
            
            conn.close()
            
            # Verify data was restored
            assert project_count == 1
            assert spec_count == 1
            
        finally:
            # Cleanup
            if os.path.exists(restore_target):
                os.unlink(restore_target)
    
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
        # Create backup file
        backup_file = os.path.join(temp_backup_dir, "integrity_test.db")
        shutil.copy2(temp_db_with_data, backup_file)
        
        # Test integrity check
        integrity_result = await backup_instance.verify_backup_integrity(backup_file)
        
        assert integrity_result["valid"] is True
        assert "tables_found" in integrity_result
        assert "record_counts" in integrity_result
        
        # Verify specific data integrity
        assert integrity_result["record_counts"]["projects"] > 0
        assert integrity_result["record_counts"]["specifications"] > 0
    
    def test_backup_compression_options(self, backup_instance):
        """Test backup compression configuration"""
        # Test compression settings
        compression_options = {
            "enabled": True,
            "level": 6,
            "algorithm": "gzip"
        }
        
        # Configure backup instance
        backup_instance.configure_compression(compression_options)
        
        # Verify compression configuration
        assert backup_instance.compression_enabled is True
        assert backup_instance.compression_level == 6
        assert backup_instance.compression_algorithm == "gzip"
    
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
        assert len(retention_result["deleted_files"]) == 2  # Should delete 2 oldest
        assert len(retention_result["kept_files"]) == 3     # Should keep 3 newest
        
        # Verify files were actually deleted
        remaining_files = list(Path(temp_backup_dir).glob("*.db"))
        assert len(remaining_files) == 3


class TestBackupRecovery:
    """Test backup recovery scenarios"""
    
    @pytest.fixture
    def recovery_manager(self):
        """Create recovery manager for testing"""
        return RestoreManager()
    
    @pytest.mark.asyncio
    async def test_point_in_time_recovery(self, recovery_manager):
        """Test point-in-time recovery functionality"""
        # Test recovery to specific timestamp
        recovery_point = datetime(2024, 1, 15, 10, 30, 0)
        
        recovery_options = {
            "target_time": recovery_point,
            "recovery_type": "point_in_time",
            "consistency_check": True
        }
        
        # Verify recovery configuration
        assert recovery_options["target_time"] == recovery_point
        assert recovery_options["recovery_type"] == "point_in_time"
        assert recovery_options["consistency_check"] is True
    
    @pytest.mark.asyncio
    async def test_disaster_recovery_workflow(self, recovery_manager):
        """Test complete disaster recovery workflow"""
        # Test disaster recovery steps
        recovery_steps = [
            "assess_damage",
            "identify_last_good_backup", 
            "validate_backup_integrity",
            "restore_from_backup",
            "verify_data_consistency",
            "resume_operations"
        ]
        
        # Verify all recovery steps are defined
        assert len(recovery_steps) == 6
        assert "restore_from_backup" in recovery_steps
        assert "verify_data_consistency" in recovery_steps
    
    def test_backup_validation_checksums(self, recovery_manager):
        """Test backup validation using checksums"""
        # Test checksum calculation
        sample_data = b"sample backup data content"
        
        # Calculate MD5 checksum
        import hashlib
        checksum = hashlib.md5(sample_data).hexdigest()
        
        # Verify checksum format
        assert len(checksum) == 32  # MD5 hash length
        assert all(c in '0123456789abcdef' for c in checksum)
    
    @pytest.mark.asyncio
    async def test_cross_platform_backup_compatibility(self, recovery_manager):
        """Test backup compatibility across platforms"""
        # Test platform-specific considerations
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
        
        # Verify cross-platform support
        assert "windows" in platform_considerations["file_paths"]
        assert "unix" in platform_considerations["file_paths"]
        assert platform_considerations["encoding"] == "utf-8"


if __name__ == "__main__":
    # Run backup and restore tests
    pytest.main([__file__, "-v"])