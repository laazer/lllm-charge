"""Tests for export modules — asset database and version control."""

import json
from pathlib import Path

import pytest

from blender_pipeline.export.multi_format import ExportFormat, ExportPreset, BUILT_IN_PRESETS
from blender_pipeline.export.asset_database import AssetDatabase, Asset
from blender_pipeline.export.version_control import VersionController, AssetVersion


class TestExportFormat:
    def test_all_formats_exist(self) -> None:
        expected = ["GLTF", "GLB", "FBX", "OBJ", "USD", "USDC", "USDZ", "STL", "PLY", "ABC", "DAE"]
        for name in expected:
            assert hasattr(ExportFormat, name)

    def test_format_values(self) -> None:
        assert ExportFormat.GLB.value == "glb"
        assert ExportFormat.FBX.value == "fbx"


class TestExportPresets:
    def test_presets_exist(self) -> None:
        expected = ["web", "unity", "unreal", "godot", "3d_print", "archviz"]
        for name in expected:
            assert name in BUILT_IN_PRESETS

    def test_web_preset_uses_glb(self) -> None:
        assert BUILT_IN_PRESETS["web"].format == ExportFormat.GLB

    def test_unity_preset_uses_fbx(self) -> None:
        assert BUILT_IN_PRESETS["unity"].format == ExportFormat.FBX

    def test_3d_print_preset_uses_stl(self) -> None:
        assert BUILT_IN_PRESETS["3d_print"].format == ExportFormat.STL


class TestAssetDatabase:
    def test_initialize_and_add(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()

        asset = Asset(name="TestCube", category="primitives", tags=["test", "cube"])
        asset_id = db.add_asset(asset)
        assert asset_id > 0

        retrieved = db.get_asset(asset_id)
        assert retrieved is not None
        assert retrieved.name == "TestCube"
        assert "test" in retrieved.tags
        db.close()

    def test_search_by_category(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()

        db.add_asset(Asset(name="Sphere", category="primitives"))
        db.add_asset(Asset(name="Tree", category="vegetation"))
        db.add_asset(Asset(name="Cube", category="primitives"))

        results = db.search_assets(category="primitives")
        assert len(results) == 2
        db.close()

    def test_search_by_query(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()
        db.add_asset(Asset(name="RedSphere", category="objects"))
        db.add_asset(Asset(name="BlueCube", category="objects"))

        results = db.search_assets(query="Sphere")
        assert len(results) == 1
        assert results[0].name == "RedSphere"
        db.close()

    def test_update_asset(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()
        asset_id = db.add_asset(Asset(name="Original"))

        db.update_asset(asset_id, {"name": "Updated"})
        updated = db.get_asset(asset_id)
        assert updated.name == "Updated"
        db.close()

    def test_delete_asset(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()
        asset_id = db.add_asset(Asset(name="ToDelete"))

        db.delete_asset(asset_id)
        assert db.get_asset(asset_id) is None
        db.close()

    def test_list_categories(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()
        db.add_asset(Asset(name="A", category="cat1"))
        db.add_asset(Asset(name="B", category="cat2"))

        categories = db.list_categories()
        assert "cat1" in categories
        assert "cat2" in categories
        db.close()

    def test_get_statistics(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()
        db.add_asset(Asset(name="A", category="test", file_size_bytes=1000))
        db.add_asset(Asset(name="B", category="test", file_size_bytes=2000))

        stats = db.get_statistics()
        assert stats["total_assets"] == 2
        assert stats["total_size_bytes"] == 3000
        db.close()

    def test_export_catalog_json(self, tmp_dir: Path) -> None:
        db = AssetDatabase(str(tmp_dir / "test.db"))
        db.initialize_database()
        db.add_asset(Asset(name="ExportTest"))

        output = db.export_catalog(str(tmp_dir / "catalog.json"), format="json")
        assert Path(output).exists()

        with open(output) as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["name"] == "ExportTest"
        db.close()


class TestVersionController:
    def test_commit_and_checkout(self, tmp_dir: Path) -> None:
        vc = VersionController(str(tmp_dir / "versions"))
        vc.initialize()

        test_file = tmp_dir / "model.glb"
        test_file.write_text("fake model data")

        version = vc.commit("asset_1", str(test_file), {"scale": 1.0}, "Initial version")
        assert version == 1

        checkout_path = vc.checkout("asset_1", 1)
        assert Path(checkout_path).exists()
        vc.close()

    def test_version_history(self, tmp_dir: Path) -> None:
        vc = VersionController(str(tmp_dir / "versions"))
        vc.initialize()

        test_file = tmp_dir / "model.glb"
        test_file.write_text("v1 data")
        vc.commit("asset_1", str(test_file), {"scale": 1.0}, "v1")

        test_file.write_text("v2 data")
        vc.commit("asset_1", str(test_file), {"scale": 2.0}, "v2")

        history = vc.get_history("asset_1")
        assert len(history) == 2
        assert history[0].version == 2
        assert history[1].version == 1
        vc.close()

    def test_diff_versions(self, tmp_dir: Path) -> None:
        vc = VersionController(str(tmp_dir / "versions"))
        vc.initialize()

        test_file = tmp_dir / "model.glb"
        test_file.write_text("data")
        vc.commit("asset_1", str(test_file), {"scale": 1.0, "color": "red"}, "v1")
        vc.commit("asset_1", str(test_file), {"scale": 2.0, "color": "red", "new_key": True}, "v2")

        diff = vc.diff_versions("asset_1", 1, 2)
        assert "scale" in diff["changed"]
        assert diff["changed"]["scale"]["from"] == 1.0
        assert diff["changed"]["scale"]["to"] == 2.0
        assert "new_key" in diff["added"]
        assert "color" in diff["unchanged"]
        vc.close()

    def test_tag_version(self, tmp_dir: Path) -> None:
        vc = VersionController(str(tmp_dir / "versions"))
        vc.initialize()

        test_file = tmp_dir / "model.glb"
        test_file.write_text("data")
        vc.commit("asset_1", str(test_file), {}, "v1")
        vc.tag_version("asset_1", 1, "release")

        tagged = vc.get_tagged("asset_1", "release")
        assert tagged is not None
        assert tagged.version == 1
        vc.close()

    def test_prune_old_versions(self, tmp_dir: Path) -> None:
        vc = VersionController(str(tmp_dir / "versions"))
        vc.initialize()

        test_file = tmp_dir / "model.glb"
        test_file.write_text("data")
        for i in range(5):
            vc.commit("asset_1", str(test_file), {"v": i}, f"v{i+1}")

        deleted = vc.prune_old_versions("asset_1", keep_count=2)
        assert deleted == 3

        history = vc.get_history("asset_1")
        assert len(history) == 2
        vc.close()
