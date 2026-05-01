import os

from fastapi import APIRouter, Depends

from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import AuthSession, AuthSessionResponse, AuthUser, AuthWorkspace

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/session", response_model=AuthSessionResponse)
def get_session(
    context: ApiRequestContext = Depends(get_request_context),
) -> AuthSessionResponse:
    workspace = AuthWorkspace(
        boardCount=0,
        id=context.workspace_id,
        name="Personal workspace",
        role="owner",
    )
    session = AuthSession(
        activeWorkspace=workspace,
        authMode="required" if os.getenv("TANGENT_REQUIRE_API_AUTH") == "1" else "dev",
        isDevFallback=context.is_dev_fallback,
        user=AuthUser(
            avatarInitials="DU",
            displayName="Dev User",
            email="dev@tangent.local",
            emailVerified=False,
            id=context.user_id,
        ),
        workspaces=[workspace],
    )
    return AuthSessionResponse(ok=True, session=session)
