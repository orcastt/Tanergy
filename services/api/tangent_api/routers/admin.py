from fastapi import APIRouter

from tangent_api.routers.admin_ai_control_plane_router import (
    get_admin_ai_models,
    get_admin_ai_pricing_rules,
    get_admin_ai_provider_routes,
    patch_admin_ai_model,
    patch_admin_ai_pricing_rule,
    patch_admin_ai_provider_route,
    router as ai_control_plane_router,
)
from tangent_api.routers.admin_ai_runtime_router import (
    get_admin_ai_api_calls,
    get_admin_ai_runs,
    router as ai_runtime_router,
)
from tangent_api.routers.admin_ai_versions_router import (
    get_admin_ai_versions,
    publish_admin_ai_model,
    publish_admin_ai_pricing_rule,
    publish_admin_ai_provider_route,
    rollback_admin_ai_model,
    rollback_admin_ai_pricing_rule,
    rollback_admin_ai_provider_route,
    router as ai_versions_router,
)
from tangent_api.routers.admin_core_router import (
    get_admin_audit_logs,
    get_admin_boards,
    get_admin_me,
    get_admin_summary,
    get_admin_users,
    get_admin_workspaces,
    router as core_router,
)
from tangent_api.routers.admin_roles_router import (
    delete_admin_role,
    get_admin_roles_for_user,
    post_admin_role,
    router as roles_router,
)

__all__ = [
    "delete_admin_role",
    "get_admin_ai_api_calls",
    "get_admin_ai_models",
    "get_admin_ai_pricing_rules",
    "get_admin_ai_provider_routes",
    "get_admin_ai_runs",
    "get_admin_ai_versions",
    "get_admin_audit_logs",
    "get_admin_boards",
    "get_admin_me",
    "get_admin_roles_for_user",
    "get_admin_summary",
    "get_admin_users",
    "get_admin_workspaces",
    "patch_admin_ai_model",
    "patch_admin_ai_pricing_rule",
    "patch_admin_ai_provider_route",
    "post_admin_role",
    "publish_admin_ai_model",
    "publish_admin_ai_pricing_rule",
    "publish_admin_ai_provider_route",
    "rollback_admin_ai_model",
    "rollback_admin_ai_pricing_rule",
    "rollback_admin_ai_provider_route",
    "router",
]

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
router.include_router(core_router, tags=["admin"])
router.include_router(ai_control_plane_router, tags=["admin"])
router.include_router(ai_versions_router, tags=["admin"])
router.include_router(ai_runtime_router, tags=["admin"])
router.include_router(roles_router, tags=["admin"])
