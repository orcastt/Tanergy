import json
import os
from typing import Any, Protocol

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetRecord
from tangent_api.storage.asset_store_common import assert_workspace_access, get_accessible_workspace_ids
from tangent_api.storage.postgres_asset_metadata_store import PostgresAssetMetadataStore


class AssetObjectMetadataStore(Protocol):
    def read_asset_metadata(self, asset_id: str, context: ApiRequestContext) -> bytes:
        raise NotImplementedError

    def write_asset_metadata(
        self,
        asset_id: str,
        context: ApiRequestContext,
        content: bytes,
    ) -> None:
        raise NotImplementedError


class ObjectStorageAssetMetadataAdapter:
    def __init__(self, object_store: AssetObjectMetadataStore) -> None:
        self.object_store = object_store

    def save_record(self, record: AssetRecord, context: ApiRequestContext) -> None:
        content = json.dumps(record.model_dump(by_alias=True), ensure_ascii=False, indent=2).encode(
            "utf-8"
        )
        self.object_store.write_asset_metadata(record.id, context, content)

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        last_not_found: HTTPException | None = None
        for workspace_id in get_accessible_workspace_ids(context):
            try:
                raw = self.object_store.read_asset_metadata(
                    asset_id,
                    context.model_copy(update={"workspace_id": workspace_id}),
                )
            except HTTPException as exc:
                if exc.status_code == 404:
                    last_not_found = exc
                    continue
                raise
            record = AssetRecord.model_validate(json.loads(raw.decode("utf-8")))
            assert_workspace_access(record, context)
            return record
        if last_not_found is not None:
            raise last_not_found
        raise HTTPException(status_code=404, detail="Asset not found in workspace.")


class PostgresAssetMetadataAdapter:
    def __init__(self) -> None:
        self.store = PostgresAssetMetadataStore()

    def save_record(self, record: AssetRecord, context: ApiRequestContext) -> None:
        _ = context
        self.store.save_record(record)

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        return self.store.get_record(asset_id, context)


def get_asset_metadata_adapter(object_store: AssetObjectMetadataStore) -> Any:
    driver = os.getenv("TANGENT_ASSET_METADATA_DRIVER", "object-storage")
    if driver == "object-storage":
        return ObjectStorageAssetMetadataAdapter(object_store)
    if driver == "postgres":
        return PostgresAssetMetadataAdapter()
    raise HTTPException(
        status_code=501,
        detail=(
            f'Unsupported asset metadata driver "{driver}". '
            "Supported drivers: object-storage, postgres."
        ),
    )
