from fastapi import APIRouter, Depends

from tangent_api.admin_access import load_active_admin_roles
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import AdminMeResponse

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/me", response_model=AdminMeResponse)
def get_admin_me(
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminMeResponse:
    roles = load_active_admin_roles(context.user_id)
    return AdminMeResponse(
        canAccessAdmin=bool(roles),
        ok=True,
        roles=roles,
        userId=context.user_id,
    )
