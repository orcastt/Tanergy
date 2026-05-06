from fastapi import APIRouter, Depends

from tangent_api.auth_schemas import AuthSession, AuthSessionResponse, AuthUser, AuthWorkspace
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/session", response_model=AuthSessionResponse)
def get_session(
    context: ApiRequestContext = Depends(get_request_context),
) -> AuthSessionResponse:
    workspace = AuthWorkspace(
        boardCount=context.workspace_board_count,
        id=context.workspace_id,
        kind=context.workspace_kind,
        name=context.workspace_name,
        role=context.workspace_role,
    )
    session = AuthSession(
        activeWorkspace=workspace,
        authMode=context.auth_mode,
        isDevFallback=context.is_dev_fallback,
        user=AuthUser(
            avatarInitials=context.user_avatar_initials,
            displayName=context.user_display_name,
            email=context.user_email,
            emailVerified=context.user_email_verified,
            id=context.user_id,
        ),
        workspaces=[workspace],
    )
    return AuthSessionResponse(ok=True, session=session)
