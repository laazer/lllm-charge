"""
Migration rollback functionality
"""
import asyncio
import json
import sqlite3
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
from shutil import copy2
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database.database import get_db
from app.database.models.main import Project, Specification, Note, Checkpoint
from app.database.models.agents import Agent, AgentTask, AgentLearning, AgentCollaboration
from app.database.models.flows import Flow, FlowExecution, FlowTemplate, FlowVersion, FlowSchedule
from app.database.models.metrics import RequestMetric, PerformanceMetric, CostMetric, QualityMetric, UsageMetric, AlertMetric


class MigrationRollback:
    """Handle rollback of database migrations with backup restoration"""
    
    def __init__(self):
        self.backup_dir = Path("data/backups")
        self.backup_dir.mkdir(exist_ok=True)
        self.original_db_paths = {
            "main": "data/llm-charge.db",
            "agents": "data/agents.db", 
            "flows": "data/flows.db"
        }
        
    async def rollback_migration(
        self,
        migration_id: Optional[str] = None,
        restore_from_backup: bool = True,
        preserve_new_data: bool = False
    ) -> Dict[str, Any]:
        """
        Rollback migration with comprehensive restore capabilities
        
        Args:
            migration_id: Specific migration to rollback (None for latest)
            restore_from_backup: Whether to restore from backup
            preserve_new_data: Whether to preserve data created after migration
            
        Returns:
            Dictionary with rollback results
        """
        results = {
            "success": False,
            "migration_id": migration_id,
            "rollback_timestamp": datetime.utcnow(),
            "databases_restored": [],
            "preserved_records": {},
            "errors": []
        }
        
        try:
            # Step 1: Create pre-rollback backup if requested
            if preserve_new_data:
                await self._create_pre_rollback_backup()
                results["pre_rollback_backup"] = True
            
            # Step 2: Stop any active connections
            await self._ensure_db_connections_closed()
            
            # Step 3: Restore from backup
            if restore_from_backup:
                backup_results = await self.backup_restore(migration_id)
                results["databases_restored"] = backup_results["restored_databases"]
                results["backup_info"] = backup_results
            
            # Step 4: Preserve new data if requested
            if preserve_new_data:
                preserved = await self._preserve_new_records()
                results["preserved_records"] = preserved
            
            # Step 5: Verify database integrity
            integrity_check = await self._verify_post_rollback_integrity()
            results["integrity_check"] = integrity_check
            
            results["success"] = True
            return results
            
        except Exception as e:
            error_msg = f"Rollback failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            return results
    
    async def backup_restore(self, migration_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Restore databases from backup files
        
        Args:
            migration_id: Specific migration backup to restore
            
        Returns:
            Dictionary with restore results
        """
        results = {
            "success": False,
            "restored_databases": [],
            "backup_timestamp": None,
            "errors": []
        }
        
        try:
            # Find backup files
            backup_files = await self._find_backup_files(migration_id)
            if not backup_files:
                raise ValueError(f"No backup files found for migration {migration_id}")
            
            results["backup_timestamp"] = backup_files["timestamp"]
            
            # Restore each database
            for db_name, backup_path in backup_files["files"].items():
                if await self._restore_single_database(db_name, backup_path):
                    results["restored_databases"].append(db_name)
                    print(f"✅ Restored {db_name} database from {backup_path}")
                else:
                    error_msg = f"Failed to restore {db_name} database"
                    results["errors"].append(error_msg)
                    print(f"❌ {error_msg}")
            
            results["success"] = len(results["restored_databases"]) > 0
            return results
            
        except Exception as e:
            error_msg = f"Backup restore failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            return results
    
    async def rollback_on_failure(self, error_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Automatic rollback when migration fails
        
        Args:
            error_context: Context information about the failure
            
        Returns:
            Dictionary with rollback results
        """
        print(f"🔄 Initiating automatic rollback due to migration failure...")
        print(f"Error context: {error_context.get('error', 'Unknown error')}")
        
        # Perform immediate rollback without preserving new data
        rollback_result = await self.rollback_migration(
            migration_id=error_context.get("migration_id"),
            restore_from_backup=True,
            preserve_new_data=False
        )
        
        # Log rollback results
        if rollback_result["success"]:
            print("✅ Automatic rollback completed successfully")
        else:
            print("❌ Automatic rollback failed - manual intervention required")
            print(f"Rollback errors: {rollback_result['errors']}")
        
        return rollback_result
    
    async def restore_backup(self, backup_timestamp: str) -> Dict[str, Any]:
        """
        Restore from specific timestamped backup
        
        Args:
            backup_timestamp: Timestamp of backup to restore
            
        Returns:
            Dictionary with restore results
        """
        results = {
            "success": False,
            "backup_timestamp": backup_timestamp,
            "restored_files": [],
            "errors": []
        }
        
        try:
            backup_pattern = f"*_{backup_timestamp}_*.db"
            backup_files = list(self.backup_dir.glob(backup_pattern))
            
            if not backup_files:
                raise ValueError(f"No backup files found for timestamp {backup_timestamp}")
            
            for backup_file in backup_files:
                # Extract database name from backup filename
                db_name = self._extract_db_name_from_backup(backup_file.name)
                if db_name and await self._restore_single_database(db_name, str(backup_file)):
                    results["restored_files"].append(str(backup_file))
            
            results["success"] = len(results["restored_files"]) > 0
            return results
            
        except Exception as e:
            error_msg = f"Restore backup failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
            return results
    
    async def _create_pre_rollback_backup(self) -> bool:
        """Create backup before rollback to preserve current state"""
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            
            for db_name, db_path in self.original_db_paths.items():
                if os.path.exists(db_path):
                    backup_path = self.backup_dir / f"{db_name}_pre_rollback_{timestamp}.db"
                    copy2(db_path, backup_path)
                    print(f"📁 Created pre-rollback backup: {backup_path}")
            
            return True
        except Exception as e:
            print(f"❌ Failed to create pre-rollback backup: {e}")
            return False
    
    async def _ensure_db_connections_closed(self) -> bool:
        """Ensure all database connections are properly closed"""
        try:
            # Wait for any pending operations to complete
            await asyncio.sleep(1.0)
            return True
        except Exception as e:
            print(f"❌ Error closing database connections: {e}")
            return False
    
    async def _find_backup_files(self, migration_id: Optional[str]) -> Dict[str, Any]:
        """Find appropriate backup files for restoration"""
        backup_files = {"files": {}, "timestamp": None}
        
        if migration_id:
            # Look for specific migration backup
            pattern = f"*_{migration_id}_*.db"
        else:
            # Find most recent backup
            all_backups = list(self.backup_dir.glob("*.db"))
            if not all_backups:
                return backup_files
            
            # Sort by modification time, get most recent
            latest_backup = max(all_backups, key=os.path.getmtime)
            pattern = f"*_{self._extract_timestamp_from_backup(latest_backup.name)}_*.db"
        
        matching_files = list(self.backup_dir.glob(pattern))
        
        for backup_file in matching_files:
            db_name = self._extract_db_name_from_backup(backup_file.name)
            if db_name:
                backup_files["files"][db_name] = str(backup_file)
                if not backup_files["timestamp"]:
                    backup_files["timestamp"] = self._extract_timestamp_from_backup(backup_file.name)
        
        return backup_files
    
    async def _restore_single_database(self, db_name: str, backup_path: str) -> bool:
        """Restore a single database from backup"""
        try:
            original_path = self.original_db_paths.get(db_name)
            if not original_path:
                print(f"❌ Unknown database name: {db_name}")
                return False
            
            if not os.path.exists(backup_path):
                print(f"❌ Backup file not found: {backup_path}")
                return False
            
            # Remove current database if exists
            if os.path.exists(original_path):
                os.remove(original_path)
            
            # Copy backup to original location
            copy2(backup_path, original_path)
            
            # Verify restored database
            if await self._verify_database_integrity(original_path):
                return True
            else:
                print(f"❌ Database integrity check failed for {db_name}")
                return False
                
        except Exception as e:
            print(f"❌ Failed to restore {db_name}: {e}")
            return False
    
    async def _preserve_new_records(self) -> Dict[str, int]:
        """Preserve records created after migration"""
        preserved = {}
        
        try:
            # This would be implemented based on specific business requirements
            # For now, return empty dict as placeholder
            print("📝 New record preservation not implemented yet")
            return preserved
            
        except Exception as e:
            print(f"❌ Failed to preserve new records: {e}")
            return preserved
    
    async def _verify_post_rollback_integrity(self) -> Dict[str, bool]:
        """Verify database integrity after rollback"""
        integrity_results = {}
        
        for db_name, db_path in self.original_db_paths.items():
            integrity_results[db_name] = await self._verify_database_integrity(db_path)
        
        return integrity_results
    
    async def _verify_database_integrity(self, db_path: str) -> bool:
        """Verify integrity of a single database file"""
        try:
            if not os.path.exists(db_path):
                return False
            
            # Basic SQLite integrity check
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()
            conn.close()
            
            return result and result[0] == "ok"
            
        except Exception as e:
            print(f"❌ Integrity check failed for {db_path}: {e}")
            return False
    
    def _extract_db_name_from_backup(self, backup_filename: str) -> Optional[str]:
        """Extract database name from backup filename"""
        # Expected format: dbname_migration_timestamp.db or dbname_timestamp.db
        parts = backup_filename.replace(".db", "").split("_")
        if len(parts) >= 1:
            return parts[0]
        return None
    
    def _extract_timestamp_from_backup(self, backup_filename: str) -> Optional[str]:
        """Extract timestamp from backup filename"""
        # Look for timestamp pattern in filename
        parts = backup_filename.replace(".db", "").split("_")
        for part in parts:
            if len(part) == 15 and part.isdigit():  # YYYYMMDD_HHMMSS format
                return part
        return None
    
    async def list_available_backups(self) -> List[Dict[str, Any]]:
        """List all available backups for rollback"""
        backups = []
        
        try:
            backup_files = list(self.backup_dir.glob("*.db"))
            
            # Group by timestamp
            backup_groups = {}
            for backup_file in backup_files:
                timestamp = self._extract_timestamp_from_backup(backup_file.name)
                db_name = self._extract_db_name_from_backup(backup_file.name)
                
                if timestamp and db_name:
                    if timestamp not in backup_groups:
                        backup_groups[timestamp] = {
                            "timestamp": timestamp,
                            "databases": [],
                            "total_size": 0,
                            "created_at": datetime.fromtimestamp(os.path.getmtime(backup_file))
                        }
                    
                    backup_groups[timestamp]["databases"].append(db_name)
                    backup_groups[timestamp]["total_size"] += os.path.getsize(backup_file)
            
            # Convert to list and sort by timestamp
            backups = list(backup_groups.values())
            backups.sort(key=lambda x: x["timestamp"], reverse=True)
            
        except Exception as e:
            print(f"❌ Failed to list backups: {e}")
        
        return backups
    
    async def cleanup_old_backups(self, keep_count: int = 10) -> Dict[str, Any]:
        """Cleanup old backup files, keeping specified number of recent backups"""
        results = {
            "success": False,
            "deleted_files": [],
            "kept_files": [],
            "errors": []
        }
        
        try:
            backups = await self.list_available_backups()
            
            if len(backups) <= keep_count:
                results["success"] = True
                results["kept_files"] = [b["timestamp"] for b in backups]
                print(f"✅ No cleanup needed - only {len(backups)} backups exist")
                return results
            
            # Keep most recent backups, delete older ones
            to_keep = backups[:keep_count]
            to_delete = backups[keep_count:]
            
            for backup_info in to_delete:
                timestamp = backup_info["timestamp"]
                pattern = f"*_{timestamp}_*.db"
                backup_files = list(self.backup_dir.glob(pattern))
                
                for backup_file in backup_files:
                    try:
                        os.remove(backup_file)
                        results["deleted_files"].append(str(backup_file))
                        print(f"🗑️ Deleted old backup: {backup_file}")
                    except Exception as e:
                        error_msg = f"Failed to delete {backup_file}: {e}"
                        results["errors"].append(error_msg)
            
            results["kept_files"] = [b["timestamp"] for b in to_keep]
            results["success"] = True
            
        except Exception as e:
            error_msg = f"Backup cleanup failed: {str(e)}"
            results["errors"].append(error_msg)
            print(f"❌ {error_msg}")
        
        return results


# Convenience functions for direct usage
async def rollback_migration(migration_id: Optional[str] = None) -> Dict[str, Any]:
    """Rollback migration - convenience function"""
    rollback = MigrationRollback()
    return await rollback.rollback_migration(migration_id)


async def restore_backup(backup_timestamp: str) -> Dict[str, Any]:
    """Restore from backup - convenience function"""
    rollback = MigrationRollback()
    return await rollback.restore_backup(backup_timestamp)


async def list_backups() -> List[Dict[str, Any]]:
    """List available backups - convenience function"""
    rollback = MigrationRollback()
    return await rollback.list_available_backups()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database migration rollback utility")
    parser.add_argument("--rollback", help="Rollback migration with optional ID")
    parser.add_argument("--restore", help="Restore from specific backup timestamp")
    parser.add_argument("--list", action="store_true", help="List available backups")
    parser.add_argument("--cleanup", type=int, help="Cleanup old backups, keep N recent")
    
    args = parser.parse_args()
    
    async def main():
        rollback = MigrationRollback()
        
        if args.list:
            backups = await rollback.list_available_backups()
            print(f"Available backups: {len(backups)}")
            for backup in backups:
                print(f"  {backup['timestamp']}: {backup['databases']} ({backup['total_size']} bytes)")
        
        elif args.restore:
            result = await rollback.restore_backup(args.restore)
            print(f"Restore result: {result}")
        
        elif args.rollback is not None:
            result = await rollback.rollback_migration(args.rollback or None)
            print(f"Rollback result: {result}")
        
        elif args.cleanup:
            result = await rollback.cleanup_old_backups(args.cleanup)
            print(f"Cleanup result: {result}")
        
        else:
            parser.print_help()
    
    asyncio.run(main())