"""
Database backup and restore functionality
"""
import asyncio
import sqlite3
import os
import shutil
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
from dataclasses import dataclass, asdict
import gzip
import subprocess


@dataclass
class BackupMetadata:
    """Metadata for database backups"""
    backup_id: str
    timestamp: datetime
    databases: List[str]
    total_size: int
    compressed: bool
    checksum: str
    migration_version: Optional[str] = None
    notes: Optional[str] = None


class DatabaseBackup:
    """Comprehensive database backup and restore system"""
    
    def __init__(self, backup_dir: str = "data/backups"):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        self.db_paths = {
            "main": "data/llm-charge.db",
            "agents": "data/agents.db",
            "flows": "data/flows.db"
        }
        
        self.metadata_file = self.backup_dir / "backup_metadata.json"
        
    async def backup_database(
        self,
        database_names: Optional[List[str]] = None,
        compress: bool = True,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create comprehensive backup of specified databases
        
        Args:
            database_names: List of database names to backup (None for all)
            compress: Whether to compress backup files
            notes: Optional notes about the backup
            
        Returns:
            Dictionary with backup results
        """
        results = {
            "success": False,
            "backup_id": None,
            "timestamp": datetime.utcnow(),
            "backup_files": [],
            "total_size": 0,
            "errors": []
        }
        
        try:
            # Generate unique backup ID
            backup_id = self._generate_backup_id()
            results["backup_id"] = backup_id
            
            # Determine which databases to backup
            if database_names is None:
                database_names = list(self.db_paths.keys())
            
            backup_files = []
            total_size = 0
            
            # Backup each database
            for db_name in database_names:
                if db_name not in self.db_paths:
                    results["errors"].append(f"Unknown database: {db_name}")
                    continue
                
                db_path = self.db_paths[db_name]
                if not os.path.exists(db_path):
                    results["errors"].append(f"Database file not found: {db_path}")
                    continue
                
                # Create backup for this database
                backup_info = await self._backup_single_database(
                    db_name, db_path, backup_id, compress
                )
                
                if backup_info["success"]:
                    backup_files.append(backup_info["backup_path"])
                    total_size += backup_info["file_size"]
                    print(f"✅ Backed up {db_name}: {backup_info['backup_path']}")
                else:
                    results["errors"].extend(backup_info["errors"])
            
            results["backup_files"] = backup_files
            results["total_size"] = total_size
            results["success"] = len(backup_files) > 0
            
            # Create metadata
            if results["success"]:
                metadata = BackupMetadata(
                    backup_id=backup_id,
                    timestamp=results["timestamp"],
                    databases=database_names,
                    total_size=total_size,
                    compressed=compress,
                    checksum=self._calculate_backup_checksum(backup_files),
                    notes=notes
                )
                await self._save_backup_metadata(metadata)
                print(f"✅ Backup completed: {backup_id} ({total_size} bytes)")
            
            return results
            
        except Exception as e:
            error_msg = f"Backup failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            return results
    
    async def restore_database(
        self,
        backup_id: str,
        database_names: Optional[List[str]] = None,
        verify_integrity: bool = True
    ) -> Dict[str, Any]:
        """
        Restore databases from backup
        
        Args:
            backup_id: Backup identifier to restore from
            database_names: Specific databases to restore (None for all)
            verify_integrity: Whether to verify integrity after restore
            
        Returns:
            Dictionary with restore results
        """
        results = {
            "success": False,
            "backup_id": backup_id,
            "restored_databases": [],
            "errors": []
        }
        
        try:
            # Load backup metadata
            metadata = await self._load_backup_metadata(backup_id)
            if not metadata:
                results["errors"].append(f"Backup metadata not found for ID: {backup_id}")
                return results
            
            # Determine which databases to restore
            if database_names is None:
                database_names = metadata.databases
            
            restored_databases = []
            
            # Restore each database
            for db_name in database_names:
                if db_name not in metadata.databases:
                    results["errors"].append(f"Database {db_name} not in backup {backup_id}")
                    continue
                
                restore_info = await self._restore_single_database(
                    db_name, backup_id, metadata.compressed
                )
                
                if restore_info["success"]:
                    restored_databases.append(db_name)
                    print(f"✅ Restored {db_name} from backup {backup_id}")
                    
                    # Verify integrity if requested
                    if verify_integrity:
                        integrity_ok = await self._verify_database_integrity(self.db_paths[db_name])
                        if not integrity_ok:
                            results["errors"].append(f"Integrity check failed for {db_name}")
                else:
                    results["errors"].extend(restore_info["errors"])
            
            results["restored_databases"] = restored_databases
            results["success"] = len(restored_databases) > 0
            
            return results
            
        except Exception as e:
            error_msg = f"Restore failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            return results
    
    async def list_backups(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        List available backups with metadata
        
        Args:
            limit: Maximum number of backups to return
            
        Returns:
            List of backup information dictionaries
        """
        backups = []
        
        try:
            metadata_list = await self._load_all_backup_metadata()
            
            # Sort by timestamp (newest first)
            metadata_list.sort(key=lambda x: x.timestamp, reverse=True)
            
            # Convert to dict format and apply limit
            for metadata in metadata_list[:limit]:
                backup_info = asdict(metadata)
                backup_info["timestamp"] = metadata.timestamp.isoformat()
                
                # Add file existence check
                backup_files = self._get_backup_files(metadata.backup_id)
                backup_info["files_exist"] = len(backup_files) > 0
                backup_info["file_count"] = len(backup_files)
                
                backups.append(backup_info)
            
        except Exception as e:
            print(f"❌ Failed to list backups: {e}")
        
        return backups
    
    async def cleanup_old_backups(
        self,
        keep_count: int = 10,
        keep_days: int = 30
    ) -> Dict[str, Any]:
        """
        Clean up old backup files
        
        Args:
            keep_count: Number of recent backups to keep
            keep_days: Number of days worth of backups to keep
            
        Returns:
            Dictionary with cleanup results
        """
        results = {
            "success": False,
            "deleted_backups": [],
            "kept_backups": [],
            "freed_space": 0,
            "errors": []
        }
        
        try:
            metadata_list = await self._load_all_backup_metadata()
            cutoff_date = datetime.utcnow() - timedelta(days=keep_days)
            
            # Sort by timestamp (newest first)
            metadata_list.sort(key=lambda x: x.timestamp, reverse=True)
            
            # Keep recent backups and those within time limit
            to_keep = []
            to_delete = []
            
            for i, metadata in enumerate(metadata_list):
                if i < keep_count or metadata.timestamp > cutoff_date:
                    to_keep.append(metadata)
                else:
                    to_delete.append(metadata)
            
            # Delete old backups
            freed_space = 0
            for metadata in to_delete:
                delete_info = await self._delete_backup(metadata.backup_id)
                if delete_info["success"]:
                    results["deleted_backups"].append(metadata.backup_id)
                    freed_space += delete_info.get("freed_space", 0)
                    print(f"🗑️ Deleted backup: {metadata.backup_id}")
                else:
                    results["errors"].extend(delete_info["errors"])
            
            results["kept_backups"] = [m.backup_id for m in to_keep]
            results["freed_space"] = freed_space
            results["success"] = True
            
            print(f"✅ Cleanup completed: kept {len(to_keep)}, deleted {len(to_delete)} backups")
            
        except Exception as e:
            error_msg = f"Cleanup failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
        
        return results
    
    async def verify_backup(self, backup_id: str) -> Dict[str, Any]:
        """
        Verify backup integrity and completeness
        
        Args:
            backup_id: Backup identifier to verify
            
        Returns:
            Dictionary with verification results
        """
        results = {
            "success": False,
            "backup_id": backup_id,
            "files_verified": [],
            "checksum_valid": False,
            "errors": []
        }
        
        try:
            # Load metadata
            metadata = await self._load_backup_metadata(backup_id)
            if not metadata:
                results["errors"].append(f"Backup metadata not found: {backup_id}")
                return results
            
            # Get backup files
            backup_files = self._get_backup_files(backup_id)
            
            # Verify files exist
            verified_files = []
            for file_path in backup_files:
                if os.path.exists(file_path):
                    verified_files.append(file_path)
                else:
                    results["errors"].append(f"Backup file missing: {file_path}")
            
            results["files_verified"] = verified_files
            
            # Verify checksum
            if verified_files:
                current_checksum = self._calculate_backup_checksum(verified_files)
                results["checksum_valid"] = current_checksum == metadata.checksum
                
                if not results["checksum_valid"]:
                    results["errors"].append("Checksum verification failed")
            
            results["success"] = (
                len(verified_files) == len(backup_files) and 
                results["checksum_valid"]
            )
            
        except Exception as e:
            error_msg = f"Verification failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
        
        return results
    
    async def _backup_single_database(
        self,
        db_name: str,
        db_path: str,
        backup_id: str,
        compress: bool
    ) -> Dict[str, Any]:
        """Backup a single database file"""
        results = {
            "success": False,
            "backup_path": None,
            "file_size": 0,
            "errors": []
        }
        
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            
            if compress:
                backup_filename = f"{db_name}_{backup_id}_{timestamp}.db.gz"
                backup_path = self.backup_dir / backup_filename
                
                # Compress database file
                with open(db_path, 'rb') as f_in:
                    with gzip.open(backup_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
            else:
                backup_filename = f"{db_name}_{backup_id}_{timestamp}.db"
                backup_path = self.backup_dir / backup_filename
                
                # Copy database file
                shutil.copy2(db_path, backup_path)
            
            results["backup_path"] = str(backup_path)
            results["file_size"] = os.path.getsize(backup_path)
            results["success"] = True
            
        except Exception as e:
            results["errors"].append(f"Failed to backup {db_name}: {e}")
        
        return results
    
    async def _restore_single_database(
        self,
        db_name: str,
        backup_id: str,
        compressed: bool
    ) -> Dict[str, Any]:
        """Restore a single database from backup"""
        results = {
            "success": False,
            "errors": []
        }
        
        try:
            # Find backup file
            backup_files = self._get_backup_files(backup_id)
            db_backup_file = None
            
            for backup_file in backup_files:
                if db_name in os.path.basename(backup_file):
                    db_backup_file = backup_file
                    break
            
            if not db_backup_file:
                results["errors"].append(f"Backup file not found for {db_name}")
                return results
            
            target_path = self.db_paths[db_name]
            
            # Remove existing database
            if os.path.exists(target_path):
                os.remove(target_path)
            
            # Restore database
            if compressed:
                with gzip.open(db_backup_file, 'rb') as f_in:
                    with open(target_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
            else:
                shutil.copy2(db_backup_file, target_path)
            
            results["success"] = True
            
        except Exception as e:
            results["errors"].append(f"Failed to restore {db_name}: {e}")
        
        return results
    
    async def _verify_database_integrity(self, db_path: str) -> bool:
        """Verify SQLite database integrity"""
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()
            conn.close()
            return result and result[0] == "ok"
        except Exception as e:
            print(f"❌ Integrity check failed for {db_path}: {e}")
            return False
    
    async def _save_backup_metadata(self, metadata: BackupMetadata):
        """Save backup metadata to file"""
        try:
            metadata_list = await self._load_all_backup_metadata()
            metadata_list.append(metadata)
            
            # Convert to serializable format
            serializable_data = []
            for m in metadata_list:
                data = asdict(m)
                data["timestamp"] = m.timestamp.isoformat()
                serializable_data.append(data)
            
            with open(self.metadata_file, 'w') as f:
                json.dump(serializable_data, f, indent=2)
                
        except Exception as e:
            print(f"❌ Failed to save backup metadata: {e}")
    
    async def _load_backup_metadata(self, backup_id: str) -> Optional[BackupMetadata]:
        """Load metadata for specific backup"""
        metadata_list = await self._load_all_backup_metadata()
        for metadata in metadata_list:
            if metadata.backup_id == backup_id:
                return metadata
        return None
    
    async def _load_all_backup_metadata(self) -> List[BackupMetadata]:
        """Load all backup metadata"""
        try:
            if not self.metadata_file.exists():
                return []
            
            with open(self.metadata_file, 'r') as f:
                data = json.load(f)
            
            metadata_list = []
            for item in data:
                item["timestamp"] = datetime.fromisoformat(item["timestamp"])
                metadata_list.append(BackupMetadata(**item))
            
            return metadata_list
            
        except Exception as e:
            print(f"❌ Failed to load backup metadata: {e}")
            return []
    
    async def _delete_backup(self, backup_id: str) -> Dict[str, Any]:
        """Delete backup and its metadata"""
        results = {
            "success": False,
            "freed_space": 0,
            "errors": []
        }
        
        try:
            # Get backup files
            backup_files = self._get_backup_files(backup_id)
            
            # Delete files and calculate freed space
            freed_space = 0
            for file_path in backup_files:
                if os.path.exists(file_path):
                    freed_space += os.path.getsize(file_path)
                    os.remove(file_path)
            
            # Remove from metadata
            metadata_list = await self._load_all_backup_metadata()
            metadata_list = [m for m in metadata_list if m.backup_id != backup_id]
            
            # Save updated metadata
            serializable_data = []
            for m in metadata_list:
                data = asdict(m)
                data["timestamp"] = m.timestamp.isoformat()
                serializable_data.append(data)
            
            with open(self.metadata_file, 'w') as f:
                json.dump(serializable_data, f, indent=2)
            
            results["freed_space"] = freed_space
            results["success"] = True
            
        except Exception as e:
            results["errors"].append(f"Failed to delete backup {backup_id}: {e}")
        
        return results
    
    def _get_backup_files(self, backup_id: str) -> List[str]:
        """Get list of backup files for given backup ID"""
        pattern = f"*_{backup_id}_*.db*"
        return [str(f) for f in self.backup_dir.glob(pattern)]
    
    def _generate_backup_id(self) -> str:
        """Generate unique backup identifier"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        hash_input = f"{timestamp}_{os.urandom(8).hex()}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:12]
    
    def _calculate_backup_checksum(self, file_paths: List[str]) -> str:
        """Calculate checksum for backup files"""
        hash_md5 = hashlib.md5()
        for file_path in sorted(file_paths):  # Sort for consistent hashing
            if os.path.exists(file_path):
                with open(file_path, 'rb') as f:
                    for chunk in iter(lambda: f.read(4096), b""):
                        hash_md5.update(chunk)
        return hash_md5.hexdigest()


class RestoreManager(DatabaseBackup):
    """Restore orchestration entrypoint (same implementation as DatabaseBackup)."""

    pass


# Convenience functions for direct usage
async def backup_all_databases(compress: bool = True, notes: Optional[str] = None) -> Dict[str, Any]:
    """Backup all databases - convenience function"""
    backup = DatabaseBackup()
    return await backup.backup_database(compress=compress, notes=notes)


async def restore_from_backup(backup_id: str, database_names: Optional[List[str]] = None) -> Dict[str, Any]:
    """Restore from backup - convenience function"""
    backup = DatabaseBackup()
    return await backup.restore_database(backup_id, database_names)


async def list_all_backups() -> List[Dict[str, Any]]:
    """List all backups - convenience function"""
    backup = DatabaseBackup()
    return await backup.list_backups()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database backup utility")
    parser.add_argument("--backup", nargs="*", help="Backup databases (specify names or leave empty for all)")
    parser.add_argument("--restore", help="Restore from backup ID")
    parser.add_argument("--list", action="store_true", help="List available backups")
    parser.add_argument("--verify", help="Verify backup integrity")
    parser.add_argument("--cleanup", nargs="?", const=10, type=int, help="Cleanup old backups (keep N recent)")
    parser.add_argument("--compress", action="store_true", default=True, help="Compress backups")
    parser.add_argument("--notes", help="Notes for backup")
    
    args = parser.parse_args()
    
    async def main():
        backup = DatabaseBackup()
        
        if args.backup is not None:
            db_names = args.backup if args.backup else None
            result = await backup.backup_database(db_names, args.compress, args.notes)
            print(f"Backup result: {result}")
        
        elif args.restore:
            result = await backup.restore_database(args.restore)
            print(f"Restore result: {result}")
        
        elif args.list:
            backups = await backup.list_backups()
            print(f"Available backups ({len(backups)}):")
            for b in backups:
                print(f"  {b['backup_id']}: {b['databases']} ({b['total_size']} bytes) - {b['timestamp']}")
        
        elif args.verify:
            result = await backup.verify_backup(args.verify)
            print(f"Verification result: {result}")
        
        elif args.cleanup is not None:
            result = await backup.cleanup_old_backups(keep_count=args.cleanup)
            print(f"Cleanup result: {result}")
        
        else:
            parser.print_help()
    
    asyncio.run(main())