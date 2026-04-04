"""SQLite-backed asset catalog for tracking generated 3D assets."""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class Asset:
    """A cataloged 3D asset."""

    id: Optional[int] = None
    name: str = ""
    category: str = "uncategorized"
    tags: list[str] = field(default_factory=list)
    file_path: str = ""
    thumbnail_path: str = ""
    vertex_count: int = 0
    face_count: int = 0
    created_at: float = 0.0
    parameters: dict = field(default_factory=dict)
    format: str = ""
    file_size_bytes: int = 0

    def __post_init__(self) -> None:
        if self.created_at == 0.0:
            self.created_at = time.time()


class AssetDatabase:
    """SQLite-backed asset catalog."""

    def __init__(self, db_path: str = "./data/assets.db") -> None:
        self.db_path = db_path
        self._connection: Optional[sqlite3.Connection] = None

    def initialize_database(self, db_path: Optional[str] = None) -> None:
        """Create tables if they don't exist."""
        if db_path:
            self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = self._get_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT DEFAULT 'uncategorized',
                tags TEXT DEFAULT '[]',
                file_path TEXT,
                thumbnail_path TEXT,
                vertex_count INTEGER DEFAULT 0,
                face_count INTEGER DEFAULT 0,
                created_at REAL,
                parameters TEXT DEFAULT '{}',
                format TEXT DEFAULT '',
                file_size_bytes INTEGER DEFAULT 0
            )
        """)
        conn.commit()

    def _get_connection(self) -> sqlite3.Connection:
        if self._connection is None:
            self._connection = sqlite3.connect(self.db_path)
            self._connection.row_factory = sqlite3.Row
        return self._connection

    def close(self) -> None:
        if self._connection:
            self._connection.close()
            self._connection = None

    def add_asset(self, asset: Asset) -> int:
        """Insert an asset and return its ID."""
        conn = self._get_connection()
        cursor = conn.execute(
            """INSERT INTO assets (name, category, tags, file_path, thumbnail_path,
               vertex_count, face_count, created_at, parameters, format, file_size_bytes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                asset.name, asset.category, json.dumps(asset.tags),
                asset.file_path, asset.thumbnail_path,
                asset.vertex_count, asset.face_count, asset.created_at,
                json.dumps(asset.parameters), asset.format, asset.file_size_bytes,
            ),
        )
        conn.commit()
        asset.id = cursor.lastrowid
        return asset.id  # type: ignore[return-value]

    def get_asset(self, asset_id: int) -> Optional[Asset]:
        """Retrieve an asset by ID."""
        conn = self._get_connection()
        row = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
        if not row:
            return None
        return self._row_to_asset(row)

    def search_assets(
        self,
        query: str = "",
        category: str = "",
        tags: list[str] | None = None,
        min_vertices: int = 0,
        max_vertices: int = 0,
    ) -> list[Asset]:
        """Search assets with filters."""
        conn = self._get_connection()
        conditions: list[str] = []
        params: list[Any] = []

        if query:
            conditions.append("(name LIKE ? OR category LIKE ?)")
            params.extend([f"%{query}%", f"%{query}%"])
        if category:
            conditions.append("category = ?")
            params.append(category)
        if min_vertices > 0:
            conditions.append("vertex_count >= ?")
            params.append(min_vertices)
        if max_vertices > 0:
            conditions.append("vertex_count <= ?")
            params.append(max_vertices)

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        sql = f"SELECT * FROM assets WHERE {where_clause} ORDER BY created_at DESC"
        rows = conn.execute(sql, params).fetchall()

        results = [self._row_to_asset(row) for row in rows]

        if tags:
            results = [a for a in results if any(t in a.tags for t in tags)]

        return results

    def update_asset(self, asset_id: int, updates: dict) -> None:
        """Update specific fields of an asset."""
        conn = self._get_connection()
        set_clauses: list[str] = []
        params: list[Any] = []

        for key, value in updates.items():
            if key in ("tags", "parameters"):
                value = json.dumps(value)
            set_clauses.append(f"{key} = ?")
            params.append(value)

        params.append(asset_id)
        sql = f"UPDATE assets SET {', '.join(set_clauses)} WHERE id = ?"
        conn.execute(sql, params)
        conn.commit()

    def delete_asset(self, asset_id: int) -> None:
        """Delete an asset by ID."""
        conn = self._get_connection()
        conn.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
        conn.commit()

    def list_categories(self) -> list[str]:
        """Get all unique categories."""
        conn = self._get_connection()
        rows = conn.execute("SELECT DISTINCT category FROM assets ORDER BY category").fetchall()
        return [row["category"] for row in rows]

    def list_tags(self) -> list[str]:
        """Get all unique tags across all assets."""
        conn = self._get_connection()
        rows = conn.execute("SELECT tags FROM assets").fetchall()
        all_tags: set[str] = set()
        for row in rows:
            try:
                tags = json.loads(row["tags"])
                all_tags.update(tags)
            except json.JSONDecodeError:
                pass
        return sorted(all_tags)

    def get_statistics(self) -> dict:
        """Get catalog statistics."""
        conn = self._get_connection()
        total = conn.execute("SELECT COUNT(*) as count FROM assets").fetchone()["count"]
        categories = conn.execute(
            "SELECT category, COUNT(*) as count FROM assets GROUP BY category"
        ).fetchall()
        total_size = conn.execute(
            "SELECT COALESCE(SUM(file_size_bytes), 0) as total FROM assets"
        ).fetchone()["total"]

        return {
            "total_assets": total,
            "by_category": {row["category"]: row["count"] for row in categories},
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
        }

    def generate_thumbnail(
        self,
        obj: Any,
        output_path: str,
        resolution: int = 256,
    ) -> str:
        """Render a thumbnail for an asset (requires bpy)."""
        try:
            import bpy as _bpy
        except ImportError:
            logger.warning("bpy not available for thumbnail generation")
            return ""

        scene = _bpy.context.scene
        scene.render.resolution_x = resolution
        scene.render.resolution_y = resolution
        scene.render.filepath = output_path
        _bpy.ops.render.render(write_still=True)
        return output_path

    def import_asset(
        self,
        file_path: str,
        name: str,
        category: str = "imported",
        tags: list[str] | None = None,
    ) -> int:
        """Import an external file and catalog it."""
        path = Path(file_path)
        asset = Asset(
            name=name,
            category=category,
            tags=tags or [],
            file_path=str(path.resolve()),
            format=path.suffix.lstrip("."),
            file_size_bytes=path.stat().st_size if path.exists() else 0,
        )
        return self.add_asset(asset)

    def export_catalog(self, output_path: str, format: str = "json") -> str:
        """Export the catalog as JSON or CSV."""
        assets = self.search_assets()
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        if format == "csv":
            import csv
            with open(output_file, "w", newline="", encoding="utf-8") as csv_file:
                writer = csv.writer(csv_file)
                writer.writerow(["id", "name", "category", "tags", "file_path", "vertex_count", "face_count", "format", "file_size_bytes"])
                for asset in assets:
                    writer.writerow([
                        asset.id, asset.name, asset.category, ",".join(asset.tags),
                        asset.file_path, asset.vertex_count, asset.face_count,
                        asset.format, asset.file_size_bytes,
                    ])
        else:
            data = [asdict(a) for a in assets]
            with open(output_file, "w", encoding="utf-8") as json_file:
                json.dump(data, json_file, indent=2)

        logger.info("Exported catalog to %s", output_path)
        return str(output_file)

    def _row_to_asset(self, row: sqlite3.Row) -> Asset:
        return Asset(
            id=row["id"],
            name=row["name"],
            category=row["category"],
            tags=json.loads(row["tags"]) if row["tags"] else [],
            file_path=row["file_path"] or "",
            thumbnail_path=row["thumbnail_path"] or "",
            vertex_count=row["vertex_count"],
            face_count=row["face_count"],
            created_at=row["created_at"] or 0.0,
            parameters=json.loads(row["parameters"]) if row["parameters"] else {},
            format=row["format"] or "",
            file_size_bytes=row["file_size_bytes"],
        )
