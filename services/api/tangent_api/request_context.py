import os
import re
from typing import Optional

from fastapi import Header, HTTPException, Request, WebSocket
from pydantic import BaseModel, Field

from tangent_api.auth_provider import verify_bearer_token
from tangent_api.auth_request_metadata import extract_request_ip, normalize_last_ip_address
from tangent_api.auth_sessions import resolve_local_auth_session
from tangent_api.workspace_roles import preserve_workspace_role

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


class ApiWorkspaceContext(BaseModel):
    board_count: int
    workspace_id: str
    workspace_kind: str = "solo_workspace"
    workspace_name: str
    workspace_plan_key: Optional[str] = None
    workspace_role: str


class ApiRequestContext(BaseModel):
    auth_mode: str
    is_dev_fallback: bool
    user_avatar_initials: str
    user_display_name: str
    user_email: str
    user_email_verified: bool
    user_id: str
    user_profile_completed: bool = True
    workspace_board_count: int
    workspace_id: str
    workspace_kind: str = "solo_workspace"
    workspace_memberships: list[ApiWorkspaceContext] = Field(default_factory=list)
    workspace_name: str
    workspace_plan_key: Optional[str] = None
    workspace_role: str


async def get_request_context(
    request: Request,
    x_tangent_user_id: Optional[str] = Header(default=None),
    x_tangent_workspace_id: Optional[str] = Header(default=None),
    x_tangent_workspace_kind: Optional[str] = Header(default=None),
    x_tangent_workspace_name: Optional[str] = Header(default=None),
    x_tangent_workspace_role: Optional[str] = Header(default=None),
    x_tangent_plan_key: Optional[str] = Header(default=None),
) -> ApiRequestContext:
    require_auth = _requires_api_auth()
    token = _extract_request_token(request)

    if token:
        return await resolve_authenticated_request_context(
            token,
            request_ip=extract_request_ip(request),
            requested_workspace_id=_normalize_optional_context_id(x_tangent_workspace_id, "workspace id"),
        )

    if require_auth:
        raise HTTPException(status_code=401, detail="Missing bearer auth token.")

    has_explicit_context = bool(x_tangent_user_id and x_tangent_workspace_id)
    workspace_id = _normalize_context_id(
        x_tangent_workspace_id
        or os.getenv("TANGENT_DEV_WORKSPACE_ID")
        or "dev-workspace",
        "workspace id",
    )
    workspace_kind = _normalize_workspace_kind(
        x_tangent_workspace_kind
        or os.getenv("TANGENT_DEV_WORKSPACE_KIND")
        or "solo_workspace"
    )
    workspace_role = _normalize_workspace_role(
        x_tangent_workspace_role
        or os.getenv("TANGENT_DEV_WORKSPACE_ROLE")
        or "owner"
    )
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
        user_profile_completed=True,
        workspace_board_count=0,
        workspace_id=workspace_id,
        workspace_kind=workspace_kind,
        workspace_memberships=[
            ApiWorkspaceContext(
                board_count=0,
                workspace_id=workspace_id,
                workspace_kind=workspace_kind,
                workspace_name=_normalize_workspace_name(
                    x_tangent_workspace_name
                    or os.getenv("TANGENT_DEV_WORKSPACE_NAME")
                    or "Personal workspace"
                ),
                workspace_plan_key=_normalize_workspace_plan_key(
                    x_tangent_plan_key or os.getenv("TANGENT_DEV_WORKSPACE_PLAN_KEY"),
                    workspace_kind,
                ),
                workspace_role=workspace_role,
            )
        ],
        workspace_name=_normalize_workspace_name(
            x_tangent_workspace_name
            or os.getenv("TANGENT_DEV_WORKSPACE_NAME")
            or "Personal workspace"
        ),
        workspace_plan_key=_normalize_workspace_plan_key(
            x_tangent_plan_key or os.getenv("TANGENT_DEV_WORKSPACE_PLAN_KEY"),
            workspace_kind,
        ),
        workspace_role=workspace_role,
    )


async def get_websocket_context(websocket: WebSocket) -> ApiRequestContext:
    require_auth = _requires_api_auth()
    token = _extract_connection_token(
        authorization_header=websocket.headers.get("authorization"),
        session_cookie=websocket.cookies.get("__session"),
        query_token=websocket.query_params.get("token"),
    )

    if token:
        return await resolve_authenticated_request_context(
            token,
            request_ip=_extract_websocket_ip(websocket),
            requested_workspace_id=_normalize_optional_context_id(websocket.query_params.get("workspaceId"), "workspace id"),
        )

    if require_auth:
        raise HTTPException(status_code=401, detail="Missing bearer auth token.")

    has_explicit_context = bool(websocket.query_params.get("userId") and websocket.query_params.get("workspaceId"))
    workspace_id = _normalize_context_id(
        websocket.query_params.get("workspaceId")
        or os.getenv("TANGENT_DEV_WORKSPACE_ID")
        or "dev-workspace",
        "workspace id",
    )
    workspace_kind = _normalize_workspace_kind(
        websocket.query_params.get("workspaceKind")
        or os.getenv("TANGENT_DEV_WORKSPACE_KIND")
        or "solo_workspace"
    )
    workspace_role = _normalize_workspace_role(
        websocket.query_params.get("workspaceRole")
        or os.getenv("TANGENT_DEV_WORKSPACE_ROLE")
        or "owner"
    )
    workspace_name = _normalize_workspace_name(
        websocket.query_params.get("workspaceName")
        or os.getenv("TANGENT_DEV_WORKSPACE_NAME")
        or "Personal workspace"
    )
    workspace_plan_key = _normalize_workspace_plan_key(
        websocket.query_params.get("planKey") or os.getenv("TANGENT_DEV_WORKSPACE_PLAN_KEY"),
        workspace_kind,
    )
    return ApiRequestContext(
        auth_mode="dev",
        is_dev_fallback=not has_explicit_context,
        user_avatar_initials="DU",
        user_display_name="Dev User",
        user_email="dev@tangent.local",
        user_email_verified=False,
        user_id=_normalize_context_id(
            websocket.query_params.get("userId") or os.getenv("TANGENT_DEV_USER_ID") or "dev-user",
            "user id",
        ),
        user_profile_completed=True,
        workspace_board_count=0,
        workspace_id=workspace_id,
        workspace_kind=workspace_kind,
        workspace_memberships=[
            ApiWorkspaceContext(
                board_count=0,
                workspace_id=workspace_id,
                workspace_kind=workspace_kind,
                workspace_name=workspace_name,
                workspace_plan_key=workspace_plan_key,
                workspace_role=workspace_role,
            )
        ],
        workspace_name=workspace_name,
        workspace_plan_key=workspace_plan_key,
        workspace_role=workspace_role,
    )


async def resolve_authenticated_request_context(
    token: str,
    requested_workspace_id: Optional[str] = None,
    request_ip: Optional[str] = None,
) -> ApiRequestContext:
    identity = await verify_bearer_token(token)
    session = resolve_local_auth_session(
        identity,
        requested_workspace_id=requested_workspace_id,
        request_ip=request_ip,
    )
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials=session.avatar_initials,
        user_display_name=session.display_name,
        user_email=session.email,
        user_email_verified=session.email_verified,
        user_id=_normalize_context_id(session.user_id, "user id"),
        user_profile_completed=session.profile_completed,
        workspace_board_count=session.board_count,
        workspace_id=_normalize_context_id(session.workspace_id, "workspace id"),
        workspace_kind=_normalize_workspace_kind(session.workspace_kind),
        workspace_memberships=[
            ApiWorkspaceContext(
                board_count=workspace.board_count,
                workspace_id=_normalize_context_id(workspace.workspace_id, "workspace id"),
                workspace_kind=_normalize_workspace_kind(workspace.workspace_kind),
                workspace_name=workspace.workspace_name,
                workspace_plan_key=_normalize_workspace_plan_key(workspace.workspace_plan_key, workspace.workspace_kind)
                if workspace.workspace_plan_key
                else None,
                workspace_role=_normalize_workspace_role(workspace.workspace_role),
            )
            for workspace in session.workspaces
        ],
        workspace_name=session.workspace_name,
        workspace_plan_key=_normalize_workspace_plan_key(session.workspace_plan_key, session.workspace_kind)
        if session.workspace_plan_key
        else None,
        workspace_role=session.workspace_role,
    )


def _extract_request_token(request: Request) -> Optional[str]:
    return _extract_connection_token(
        authorization_header=request.headers.get("authorization"),
        session_cookie=request.cookies.get("__session"),
        query_token=None,
    )


def _requires_api_auth() -> bool:
    if os.getenv("TANGENT_REQUIRE_API_AUTH") == "1":
        return True
    return any(
        os.getenv(name, "").strip().lower() in {"prod", "production"}
        for name in ("TANGENT_ENV", "ENVIRONMENT", "APP_ENV", "PYTHON_ENV")
    )


def _extract_connection_token(
    authorization_header: Optional[str],
    session_cookie: Optional[str],
    query_token: Optional[str],
) -> Optional[str]:
    if authorization_header:
        scheme, _, token = authorization_header.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise HTTPException(status_code=401, detail="Malformed bearer auth header.")
        return token.strip()

    if isinstance(session_cookie, str) and session_cookie.strip():
        return session_cookie.strip()
    if isinstance(query_token, str) and query_token.strip():
        return query_token.strip()
    return None


def _extract_websocket_ip(websocket: WebSocket) -> Optional[str]:
    for header_name in ("x-forwarded-for", "x-real-ip"):
        raw_value = websocket.headers.get(header_name)
        if not raw_value:
            continue
        candidate = raw_value.split(",")[0].strip()
        normalized = normalize_last_ip_address(candidate)
        if normalized:
            return normalized
    client = getattr(websocket, "client", None)
    return normalize_last_ip_address(getattr(client, "host", None))


def _normalize_context_id(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed or not ID_PATTERN.match(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return trimmed


def _normalize_optional_context_id(value: Optional[str], label: str) -> Optional[str]:
    if value is None or not value.strip():
        return None
    return _normalize_context_id(value, label)


def _normalize_workspace_kind(value: str) -> str:
    normalized = value.strip()
    allowed = {"solo_workspace", "group_workspace", "team_workspace", "enterprise_workspace"}
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail="Invalid workspace kind.")
    return normalized


def _normalize_workspace_role(value: str) -> str:
    try:
        return preserve_workspace_role(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace role.")



def _normalize_workspace_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        return "Personal workspace"
    return normalized[:120]


def _normalize_workspace_plan_key(value: Optional[str], workspace_kind: str) -> Optional[str]:
    if value is None or not value.strip():
        return None
    normalized = value.strip()
    allowed_by_kind = {
        "solo_workspace": {"free_canvas", "collaborate_start", "collaborate_plus"},
        "group_workspace": {"free_canvas", "collaborate_start", "collaborate_plus"},
        "team_workspace": {"team_start", "team_growth"},
        "enterprise_workspace": {"enterprise"},
    }
    if normalized not in allowed_by_kind.get(workspace_kind, set()):
        raise HTTPException(status_code=400, detail="Invalid workspace plan key.")
    return normalized
