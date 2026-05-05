import os
import re
from typing import Optional

from fastapi import Header, HTTPException, Request
from pydantic import BaseModel

from tangent_api.auth_provider import verify_bearer_token
from tangent_api.auth_sessions import resolve_local_auth_session

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


class ApiRequestContext(BaseModel):
    auth_mode: str
    is_dev_fallback: bool
    user_avatar_initials: str
    user_display_name: str
    user_email: str
    user_email_verified: bool
    user_id: str
    workspace_board_count: int
    workspace_id: str
    workspace_name: str
    workspace_role: str


async def get_request_context(
    request: Request,
    x_tangent_user_id: Optional[str] = Header(default=None),
    x_tangent_workspace_id: Optional[str] = Header(default=None),
) -> ApiRequestContext:
    require_auth = os.getenv("TANGENT_REQUIRE_API_AUTH") == "1"
    token = _extract_request_token(request)

    if token:
        return await resolve_authenticated_request_context(token)

    if require_auth:
        raise HTTPException(status_code=401, detail="Missing bearer auth token.")

    has_explicit_context = bool(x_tangent_user_id and x_tangent_workspace_id)
    return ApiRequestContext(
        auth_mode="dev",
        is_dev_fallback=not has_explicit_context,
        user_avatar_initials="DU",
        user_display_name="Dev User",
        user_email="dev@tangent.local",
        user_email_verified=False,
        user_id=_normalize_context_id(
            x_tangent_user_id or os.getenv("TANGENT_DEV_USER_ID") or "dev-user",
            "user id",
        ),
        workspace_board_count=0,
        workspace_id=_normalize_context_id(
            x_tangent_workspace_id
            or os.getenv("TANGENT_DEV_WORKSPACE_ID")
            or "dev-workspace",
            "workspace id",
        ),
        workspace_name="Personal workspace",
        workspace_role="owner",
    )


async def resolve_authenticated_request_context(token: str) -> ApiRequestContext:
    identity = await verify_bearer_token(token)
    session = resolve_local_auth_session(identity)
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials=session.avatar_initials,
        user_display_name=session.display_name,
        user_email=session.email,
        user_email_verified=session.email_verified,
        user_id=_normalize_context_id(session.user_id, "user id"),
        workspace_board_count=session.board_count,
        workspace_id=_normalize_context_id(session.workspace_id, "workspace id"),
        workspace_name=session.workspace_name,
        workspace_role=session.workspace_role,
    )


def _extract_request_token(request: Request) -> Optional[str]:
    authorization = request.headers.get("authorization")
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise HTTPException(status_code=401, detail="Malformed bearer auth header.")
        return token.strip()

    session_cookie = request.cookies.get("__session")
    if isinstance(session_cookie, str) and session_cookie.strip():
        return session_cookie.strip()
    return None


def _normalize_context_id(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed or not ID_PATTERN.match(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return trimmed
