from __future__ import annotations

import os


def security_persistence_enabled() -> bool:
    if os.getenv("TANGENT_SECURITY_PERSISTENCE_ENABLED", "1").strip().lower() in {"0", "false", "off", "no"}:
        return False
    return bool(os.getenv("DATABASE_URL", "").strip() or os.getenv("DATABASE_POOL_URL", "").strip())
