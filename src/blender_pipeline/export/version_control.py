"""File-based version control for 3D assets with SQLite metadata."""

from __future__ import annotations

import json
import logging
import shutil
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class AssetVersion:
    """A single version of an asset."""

    version: int = 0
    asset_id: str = ""
    file_path: str = ""
    parameters: dict = field(default_factory=dict)
    created_at: float = 0.0
    commit_message: str = ""
    parent_version: Optional[int] = None
    tags: list[str] = field(default_factory=list)


class VersionController:
    """File-based version control with SQLite metadata."""

    def __init__(self, storage_dir: str = "./data/versions") -> None:
        self.storage_dir = Path(storage_dir)
        self._db_path = self.storage_dir / "versions.db"
        self._connection: Optional[sqlite3.Connection] = None

    def initialize(self, storage_dir: Optional[str] = None) -> None:
        """Set up version storage directory and database."""
        if storage_dir:
            self.storage_dir = Path(storage_dir)
            self._db_path = self.storage_dir / "versions.db"

        self.storage_dir.mkdir(parents=True, exist_ok=True)
        conn = self._get_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version INTEGER NOT NULL,
                asset_id TEXT NOT NULL,
                file_path TEXT,
                parameters TEXT DEFAULT '{}',
                created_at REAL,
                commit_message TEXT DEFAULT '',
                parent_version INTEGER,
                tags TEXT DEFAULT '[]'
            )
        """)
        conn.commit()

    def _get_connection(self) -> sqlite3.Connection:
        if self._connection is None:
            self._connection = sqlite3.connect(str(self._db_path))
            self._connection.row_factory = sqlite3.Row
        return self._connection

    def close(self) -> None:
        if self._connection:
            self._connection.close()
            self._connection = None

    def commit(
        self,
        asset_id: str,
        file_path: str,
        parameters: dict | None = None,
        message: str = "",
    ) -> int:
        """Save a new version of an asset. Returns the version number."""
        conn = self._get_connection()
        current_max = conn.execute(
            "SELECT COALESCE(MAX(version), 0) as max_ver FROM versions WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()["max_ver"]

        new_version = current_max + 1
        parent_version = current_max if current_max > 0 else None

        version_dir = self.storage_dir / asset_id
        version_dir.mkdir(parents=True, exist_ok=True)

        source_path = Path(file_path)
        if source_path.exists():
            dest_filename = f"v{new_version}{source_path.suffix}"
            dest_path = version_dir / dest_filename
            shutil.copy2(str(source_path), str(dest_path))
            stored_path = str(dest_path)
        else:
            stored_path = file_path

        conn.execute(
            """INSERT INTO versions (version, asset_id, file_path, parameters, created_at, commit_message, parent_version, tags)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                new_version, asset_id, stored_path,
                json.dumps(parameters or {}), time.time(),
                message, parent_version, "[]",
            ),
        )
        conn.commit()
        logger.info("Committed %s v%d: %s", asset_id, new_version, message)
        return new_version

    def get_history(self, asset_id: str) -> list[AssetVersion]:
        """Get the full version history for an asset."""
        conn = self._get_connection()
        rows = conn.execute(
            "SELECT * FROM versions WHERE asset_id = ? ORDER BY version DESC",
            (asset_id,),
        ).fetchall()
        return [self._row_to_version(row) for row in rows]

    def checkout(self, asset_id: str, version: int) -> str:
        """Retrieve the file path for a specific version."""
        conn = self._get_connection()
        row = conn.execute(
            "SELECT * FROM versions WHERE asset_id = ? AND version = ?",
            (asset_id, version),
        ).fetchone()
        if not row:
            raise KeyError(f"Version {version} not found for asset '{asset_id}'")
        return row["file_path"]

    def diff_versions(
        self,
        asset_id: str,
        version_a: int,
        version_b: int,
    ) -> dict:
        """Compare parameters between two versions."""
        conn = self._get_connection()
        row_a = conn.execute(
            "SELECT parameters FROM versions WHERE asset_id = ? AND version = ?",
            (asset_id, version_a),
        ).fetchone()
        row_b = conn.execute(
            "SELECT parameters FROM versions WHERE asset_id = ? AND version = ?",
            (asset_id, version_b),
        ).fetchone()

        if not row_a or not row_b:
            raise KeyError(f"Could not find both versions ({version_a}, {version_b}) for '{asset_id}'")

        params_a = json.loads(row_a["parameters"])
        params_b = json.loads(row_b["parameters"])

        all_keys = set(params_a.keys()) | set(params_b.keys())
        diff: dict = {"added": {}, "removed": {}, "changed": {}, "unchanged": {}}

        for key in all_keys:
            in_a = key in params_a
            in_b = key in params_b
            if in_a and not in_b:
                diff["removed"][key] = params_a[key]
            elif in_b and not in_a:
                diff["added"][key] = params_b[key]
            elif params_a[key] != params_b[key]:
                diff["changed"][key] = {"from": params_a[key], "to": params_b[key]}
            else:
                diff["unchanged"][key] = params_a[key]

        return diff

    def tag_version(self, asset_id: str, version: int, tag_name: str) -> None:
        """Add a tag to a version."""
        conn = self._get_connection()
        row = conn.execute(
            "SELECT tags FROM versions WHERE asset_id = ? AND version = ?",
            (asset_id, version),
        ).fetchone()
        if not row:
            raise KeyError(f"Version {version} not found for '{asset_id}'")

        current_tags = json.loads(row["tags"])
        if tag_name not in current_tags:
            current_tags.append(tag_name)
        conn.execute(
            "UPDATE versions SET tags = ? WHERE asset_id = ? AND version = ?",
            (json.dumps(current_tags), asset_id, version),
        )
        conn.commit()

    def get_tagged(self, asset_id: str, tag_name: str) -> Optional[AssetVersion]:
        """Get the version with a specific tag."""
        conn = self._get_connection()
        rows = conn.execute(
            "SELECT * FROM versions WHERE asset_id = ? ORDER BY version DESC",
            (asset_id,),
        ).fetchall()
        for row in rows:
            tags = json.loads(row["tags"])
            if tag_name in tags:
                return self._row_to_version(row)
        return None

    def rollback(self, asset_id: str, version: int) -> str:
        """Set a previous version as the current version by re-committing it."""
        source_path = self.checkout(asset_id, version)
        conn = self._get_connection()
        row = conn.execute(
            "SELECT parameters FROM versions WHERE asset_id = ? AND version = ?",
            (asset_id, version),
        ).fetchone()
        params = json.loads(row["parameters"]) if row else {}
        new_version = self.commit(asset_id, source_path, params, f"Rollback to v{version}")
        logger.info("Rolled back %s to v%d (new version: v%d)", asset_id, version, new_version)
        return self.checkout(asset_id, new_version)

    def prune_old_versions(self, asset_id: str, keep_count: int = 5) -> int:
        """Delete old versions, keeping the most recent keep_count."""
        conn = self._get_connection()
        rows = conn.execute(
            "SELECT * FROM versions WHERE asset_id = ? ORDER BY version DESC",
            (asset_id,),
        ).fetchall()

        to_delete = rows[keep_count:]
        deleted_count = 0
        for row in to_delete:
            file_path = Path(row["file_path"])
            if file_path.exists():
                file_path.unlink()

            conn.execute(
                "DELETE FROM versions WHERE asset_id = ? AND version = ?",
                (asset_id, row["version"]),
            )
            deleted_count += 1

        conn.commit()
        logger.info("Pruned %d old versions for %s", deleted_count, asset_id)
        return deleted_count

    def _row_to_version(self, row: sqlite3.Row) -> AssetVersion:
        return AssetVersion(
            version=row["version"],
            asset_id=row["asset_id"],
            file_path=row["file_path"] or "",
            parameters=json.loads(row["parameters"]) if row["parameters"] else {},
            created_at=row["created_at"] or 0.0,
            commit_message=row["commit_message"] or "",
            parent_version=row["parent_version"],
            tags=json.loads(row["tags"]) if row["tags"] else [],
        )
