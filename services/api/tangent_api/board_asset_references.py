import json
import os
import re
from pathlib import Path
from typing import Any, Callable

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext

ASSET_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def collect_board_asset_ids(document: Any) -> set[str]:
    asset_ids: set[str] = set()
    _collect_asset_ids(document, [], asset_ids)
    return asset_ids


def assert_no_postgres_foreign_asset_refs(
    document: Any,
    context: ApiRequestContext,
    connect_to_postgres: Callable[[], Any],
) -> None:
    asset_ids = sorted(collect_board_asset_ids(document))
    if not asset_ids:
        return
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, workspace_id
                FROM tangent_assets
                WHERE id = ANY(%s) AND workspace_id <> %s
                LIMIT 1
                """,
                (asset_ids, context.workspace_id),
            )
            row = cursor.fetchone()
    if row:
        raise HTTPException(status_code=422, detail=f"Board references Asset {row[0]} from another workspace.")


def assert_no_local_foreign_asset_refs(document: Any, context: ApiRequestContext) -> None:
    asset_ids = collect_board_asset_ids(document)
    if not asset_ids:
        return
    for asset_id, workspace_id in _read_local_asset_workspaces(asset_ids).items():
        if workspace_id != context.workspace_id:
            raise HTTPException(status_code=422, detail=f"Board references Asset {asset_id} from another workspace.")


def _collect_asset_ids(value: Any, path: list[str], asset_ids: set[str]) -> None:
    if isinstance(value, list):
        for index, item in enumerate(value):
            _collect_asset_ids(item, [*path, str(index)], asset_ids)
        return
    if not isinstance(value, dict):
        return

    if len(path) >= 2 and path[-2] == "assets":
        _add_asset_id(value.get("id"), asset_ids)

    for key, item in value.items():
        if key in {"assetId", "asset_id"}:
            _add_asset_id(item, asset_ids)
        elif key in {"assetIds", "asset_ids", "inputAssetIds", "outputAssetIds"} and isinstance(item, list):
            for asset_id in item:
                _add_asset_id(asset_id, asset_ids)
        _collect_asset_ids(item, [*path, str(key)], asset_ids)


def _add_asset_id(value: Any, asset_ids: set[str]) -> None:
    if not isinstance(value, str):
        return
    normalized = value.strip()
    if normalized and ASSET_ID_PATTERN.match(normalized) and ".." not in normalized:
        asset_ids.add(normalized)


def _read_local_asset_workspaces(asset_ids: set[str]) -> dict[str, str]:
    asset_root = Path(os.getenv("TANGENT_ASSET_STORAGE_DIR", ".tangent-assets")) / "assets"
    workspaces: dict[str, str] = {}
    for asset_id in asset_ids:
        metadata_path = asset_root / asset_id / "metadata.json"
        if not metadata_path.exists():
            continue
        try:
            payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        workspace_id = payload.get("workspaceId")
        if isinstance(workspace_id, str):
            workspaces[asset_id] = workspace_id
    return workspaces
