from __future__ import annotations

PRODUCT_WORKSPACE_ROLES = frozenset({"owner", "admin", "editor", "viewer"})
LEGACY_WORKSPACE_ROLE_ALIASES = {
    "guest": "viewer",
    "member": "editor",
}
MANAGER_WORKSPACE_ROLES = frozenset({"owner", "admin"})
WRITER_WORKSPACE_ROLES = frozenset({"owner", "admin", "editor"})
READER_WORKSPACE_ROLES = frozenset({"owner", "admin", "editor", "viewer"})


def normalize_workspace_role(value: str) -> str:
    normalized = value.strip().lower()
    if normalized in PRODUCT_WORKSPACE_ROLES:
        return normalized
    alias = LEGACY_WORKSPACE_ROLE_ALIASES.get(normalized)
    if alias is not None:
        return alias
    raise ValueError("Invalid workspace role.")


def workspace_role_can_manage(value: str) -> bool:
    return normalize_workspace_role(value) in MANAGER_WORKSPACE_ROLES


def workspace_role_can_write(value: str) -> bool:
    return normalize_workspace_role(value) in WRITER_WORKSPACE_ROLES


def workspace_role_can_read(value: str) -> bool:
    return normalize_workspace_role(value) in READER_WORKSPACE_ROLES
