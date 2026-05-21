from typing import Optional

from tangent_api.admin_ai_version_ops import (
    list_admin_ai_versions as _list_admin_ai_versions_impl,
    publish_admin_ai_version as _publish_admin_ai_version_impl,
    rollback_admin_ai_version as _rollback_admin_ai_version_impl,
)
from tangent_api.admin_ai_control_plane import connect_to_postgres
from tangent_api.admin_ai_control_plane_schemas import AdminAiControlPlaneVersionRecord
from tangent_api.storage.postgres_connection import require_database_url


def list_admin_ai_versions(resource_type: str, resource_id: str, limit: int) -> list[AdminAiControlPlaneVersionRecord]:
    return _list_admin_ai_versions_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        resource_type=resource_type,
        resource_id=resource_id,
        limit=limit,
    )


def publish_admin_ai_version(
    resource_type: str,
    resource_id: str,
    *,
    actor_user_id: str,
    workspace_id: str,
    note: Optional[str],
) -> AdminAiControlPlaneVersionRecord:
    return _publish_admin_ai_version_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        resource_type=resource_type,
        resource_id=resource_id,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        note=note,
    )


def rollback_admin_ai_version(
    resource_type: str,
    resource_id: str,
    version_id: str,
    *,
    actor_user_id: str,
    workspace_id: str,
    note: Optional[str],
) -> AdminAiControlPlaneVersionRecord:
    return _rollback_admin_ai_version_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        resource_type=resource_type,
        resource_id=resource_id,
        version_id=version_id,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        note=note,
    )
