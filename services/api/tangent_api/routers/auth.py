from fastapi import APIRouter, Depends, HTTPException

from tangent_api.auth_profile_store import update_auth_profile
from tangent_api.auth_schemas import (
    AuthProfileUpdateRequest,
    AuthProfileUpdateResponse,
    AuthSession,
    AuthSessionResponse,
    AuthUser,
    AuthWorkspace,
)
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
        planKey=context.workspace_plan_key,
        role=context.workspace_role,
    )
    workspaces = [
        AuthWorkspace(
            boardCount=item.board_count,
            id=item.workspace_id,
            kind=item.workspace_kind,
            name=item.workspace_name,
            planKey=item.workspace_plan_key,
            role=item.workspace_role,
        )
        for item in (context.workspace_memberships or [])
    ] or [workspace]
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
            profileCompleted=context.user_profile_completed,
        ),
        workspaces=workspaces,
    )
    return AuthSessionResponse(ok=True, session=session)


@router.patch("/profile", response_model=AuthProfileUpdateResponse)
def patch_profile(
    input_data: AuthProfileUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AuthProfileUpdateResponse:
    if context.auth_mode != "required" or context.is_dev_fallback:
        raise HTTPException(status_code=401, detail="Profile updates require an authenticated session.")
    profile = update_auth_profile(
        context.user_id,
        input_data.display_name,
    )
    return AuthProfileUpdateResponse(
        ok=True,
        user=AuthUser(
            avatarInitials=profile.avatar_initials,
            displayName=profile.display_name,
            email=profile.email,
            emailVerified=profile.email_verified,
            id=profile.user_id,
            profileCompleted=profile.profile_completed,
        ),
    )
