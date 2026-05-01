import os
import re
from typing import Optional

from fastapi import Header, HTTPException
from pydantic import BaseModel

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


class ApiRequestContext(BaseModel):
    is_dev_fallback: bool
    user_id: str
    workspace_id: str


def get_request_context(
    x_tangent_user_id: Optional[str] = Header(default=None),
    x_tangent_workspace_id: Optional[str] = Header(default=None),
) -> ApiRequestContext:
    has_explicit_context = bool(x_tangent_user_id and x_tangent_workspace_id)
    if os.getenv("TANGENT_REQUIRE_API_AUTH") == "1" and not has_explicit_context:
        raise HTTPException(status_code=401, detail="Missing authenticated API context.")

    return ApiRequestContext(
        is_dev_fallback=not has_explicit_context,
        user_id=_normalize_context_id(
            x_tangent_user_id or os.getenv("TANGENT_DEV_USER_ID") or "dev-user",
            "user id",
        ),
        workspace_id=_normalize_context_id(
            x_tangent_workspace_id
            or os.getenv("TANGENT_DEV_WORKSPACE_ID")
            or "dev-workspace",
            "workspace id",
        ),
    )


def _normalize_context_id(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed or not ID_PATTERN.match(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return trimmed
