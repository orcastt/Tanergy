import os
import time
from copy import deepcopy
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.plan_catalog_defaults import DEFAULT_PLAN_CATALOG, DEFAULT_PLAN_ORDER, copy_default_plan_catalog
from tangent_api.plan_catalog_schemas import PlanCatalogRecord
from tangent_api.plan_catalog_store import apply_plan_catalog_overlay, save_plan_catalog_entry, to_optional_int
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

_PLAN_CACHE_TTL_SECONDS = 5.0
_plan_catalog_cache: Optional[tuple[float, dict[str, dict[str, Any]]]] = None


def clear_plan_catalog_cache() -> None:
    global _plan_catalog_cache
    _plan_catalog_cache = None


def list_plan_catalog() -> list[PlanCatalogRecord]:
    catalog = load_plan_catalog()
    return [
        PlanCatalogRecord(**catalog[plan_key])
        for plan_key in DEFAULT_PLAN_ORDER
        if plan_key in catalog
    ]


def load_plan_catalog(*, force: bool = False) -> dict[str, dict[str, Any]]:
    global _plan_catalog_cache
    if not force and _plan_catalog_cache and _plan_catalog_cache[0] > time.time():
        return deepcopy(_plan_catalog_cache[1])
    catalog = copy_default_plan_catalog()
    if os.getenv("DATABASE_URL"):
        try:
            apply_plan_catalog_overlay(catalog, db_connect=connect_to_postgres)
        except Exception:
            pass
    _plan_catalog_cache = (time.time() + _PLAN_CACHE_TTL_SECONDS, deepcopy(catalog))
    return catalog


def load_plan_spec(plan_key: str) -> dict[str, Any]:
    catalog = load_plan_catalog()
    return catalog.get(plan_key, catalog["free_canvas"])


def update_plan_catalog_entry(plan_key: str, patch: dict[str, Any]) -> PlanCatalogRecord:
    normalized_plan_key = plan_key.strip()
    if normalized_plan_key not in DEFAULT_PLAN_CATALOG:
        raise HTTPException(status_code=404, detail="Plan not found.")
    plan = save_plan_catalog_entry(
        normalized_plan_key,
        patch,
        load_plan_spec(normalized_plan_key),
        db_connect=connect_to_postgres,
        require_database_url_fn=require_database_url,
    )
    clear_plan_catalog_cache()
    return plan


def included_credits_for_plan(plan_key: str) -> int:
    return _plan_int(plan_key, "included_credits")


def monthly_price_usd_for_plan(plan_key: str) -> Optional[int]:
    return to_optional_int(load_plan_spec(plan_key).get("monthly_price_usd"))


def annual_price_usd_for_plan(plan_key: str) -> Optional[int]:
    return to_optional_int(load_plan_spec(plan_key).get("annual_price_usd"))


def board_limit_for_plan(plan_key: str) -> Optional[int]:
    return to_optional_int(load_plan_spec(plan_key).get("board_limit"))


def page_limit_for_plan(plan_key: str) -> Optional[int]:
    return to_optional_int(load_plan_spec(plan_key).get("page_limit"))


def registration_credits_for_plan(plan_key: str) -> int:
    return _plan_int(plan_key, "registration_credits")


def group_workspace_limit_for_plan(plan_key: str) -> int:
    return _plan_int(plan_key, "group_workspace_limit")


def group_member_limit_for_plan(plan_key: str) -> int:
    return _plan_int(plan_key, "group_member_limit")


def seat_max_for_plan(plan_key: str) -> int:
    return _plan_int(plan_key, "seat_max")


def seat_min_for_plan(plan_key: str) -> int:
    return _plan_int(plan_key, "seat_min")


def _plan_int(plan_key: str, field: str) -> int:
    return int(load_plan_spec(plan_key).get(field) or 0)
