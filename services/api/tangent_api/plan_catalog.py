import json
import os
import time
from copy import deepcopy
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.plan_catalog_schemas import PlanCatalogRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

DEFAULT_PLAN_ORDER = [
    "free_canvas",
    "collaborate_start",
    "collaborate_plus",
    "team_start",
    "team_growth",
    "enterprise",
]

DEFAULT_PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "free_canvas": {
        "annual_price_usd": 0,
        "billing_period": "none",
        "board_limit": 1,
        "group_member_limit": 0,
        "group_workspace_limit": 0,
        "included_credits": 0,
        "metadata": {},
        "monthly_price_usd": 0,
        "name": "Free Canvas",
        "page_limit": 3,
        "plan_family": "free",
        "plan_key": "free_canvas",
        "registration_credits": 50,
        "seat_max": 1,
        "seat_min": 1,
        "seat_range": None,
    },
    "collaborate_start": {
        "annual_price_usd": 15,
        "billing_period": "monthly_or_annual",
        "board_limit": None,
        "group_member_limit": 15,
        "group_workspace_limit": 10,
        "included_credits": 1500,
        "metadata": {},
        "monthly_price_usd": 18,
        "name": "Collaborate Start",
        "page_limit": None,
        "plan_family": "collaborate",
        "plan_key": "collaborate_start",
        "registration_credits": 0,
        "seat_max": 1,
        "seat_min": 1,
        "seat_range": "1+ users",
    },
    "collaborate_plus": {
        "annual_price_usd": 20,
        "billing_period": "monthly_or_annual",
        "board_limit": None,
        "group_member_limit": 15,
        "group_workspace_limit": 20,
        "included_credits": 2000,
        "metadata": {},
        "monthly_price_usd": 25,
        "name": "Collaborate Plus",
        "page_limit": None,
        "plan_family": "collaborate",
        "plan_key": "collaborate_plus",
        "registration_credits": 0,
        "seat_max": 1,
        "seat_min": 1,
        "seat_range": "1+ users",
    },
    "team_start": {
        "annual_price_usd": 20,
        "billing_period": "monthly_or_annual",
        "board_limit": None,
        "group_member_limit": 0,
        "group_workspace_limit": 0,
        "included_credits": 2500,
        "metadata": {},
        "monthly_price_usd": 25,
        "name": "Team Start",
        "page_limit": None,
        "plan_family": "team",
        "plan_key": "team_start",
        "registration_credits": 0,
        "seat_max": 15,
        "seat_min": 1,
        "seat_range": "1-15 seats",
    },
    "team_growth": {
        "annual_price_usd": 40,
        "billing_period": "monthly_or_annual",
        "board_limit": None,
        "group_member_limit": 0,
        "group_workspace_limit": 0,
        "included_credits": 5500,
        "metadata": {},
        "monthly_price_usd": 45,
        "name": "Team Growth",
        "page_limit": None,
        "plan_family": "team",
        "plan_key": "team_growth",
        "registration_credits": 0,
        "seat_max": 15,
        "seat_min": 1,
        "seat_range": "1-15 seats",
    },
    "enterprise": {
        "annual_price_usd": None,
        "billing_period": "contract",
        "board_limit": None,
        "group_member_limit": None,
        "group_workspace_limit": None,
        "included_credits": 0,
        "metadata": {},
        "monthly_price_usd": None,
        "name": "Enterprise",
        "page_limit": None,
        "plan_family": "enterprise",
        "plan_key": "enterprise",
        "registration_credits": 0,
        "seat_max": None,
        "seat_min": None,
        "seat_range": "custom",
    },
}

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
    catalog = deepcopy(DEFAULT_PLAN_CATALOG)
    if os.getenv("DATABASE_URL"):
        try:
            with connect_to_postgres() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT
                            plan_key,
                            plan_family,
                            name,
                            billing_period,
                            included_credits,
                            monthly_price_usd,
                            annual_price_usd,
                            seat_range,
                            seat_min,
                            seat_max,
                            board_limit,
                            page_limit,
                            registration_credits,
                            group_workspace_limit,
                            group_member_limit,
                            metadata,
                            created_at,
                            updated_at
                        FROM tangent_plan_catalog
                        ORDER BY
                            CASE plan_key
                                WHEN 'free_canvas' THEN 0
                                WHEN 'collaborate_start' THEN 1
                                WHEN 'collaborate_plus' THEN 2
                                WHEN 'team_start' THEN 3
                                WHEN 'team_growth' THEN 4
                                WHEN 'enterprise' THEN 5
                                ELSE 99
                            END,
                            plan_key ASC
                        """
                    )
                    for row in cursor.fetchall():
                        plan_key = str(row[0])
                        base = catalog.get(plan_key, {"plan_key": plan_key})
                        base.update(
                            {
                                "annual_price_usd": _to_optional_int(row[6]),
                                "billing_period": str(row[3] or base.get("billing_period") or "monthly_or_annual"),
                                "board_limit": _to_optional_int(row[10]),
                                "created_at": _to_optional_str(row[16]),
                                "group_member_limit": _to_optional_int(row[14]),
                                "group_workspace_limit": _to_optional_int(row[13]),
                                "included_credits": int(row[4] or 0),
                                "metadata": dict(row[15] or {}),
                                "monthly_price_usd": _to_optional_int(row[5]),
                                "name": str(row[2] or base.get("name") or plan_key),
                                "page_limit": _to_optional_int(row[11]),
                                "plan_family": str(row[1] or base.get("plan_family") or "free"),
                                "plan_key": plan_key,
                                "registration_credits": int(row[12] or 0),
                                "seat_max": _to_optional_int(row[9]),
                                "seat_min": _to_optional_int(row[8]),
                                "seat_range": _to_optional_str(row[7]),
                                "updated_at": _to_optional_str(row[17]),
                            }
                        )
                        catalog[plan_key] = base
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
    require_database_url()
    current = load_plan_spec(normalized_plan_key)
    next_plan = {**current, **patch}
    seat_min = _to_optional_int(next_plan.get("seat_min"))
    seat_max = _to_optional_int(next_plan.get("seat_max"))
    if seat_min is not None and seat_max is not None and seat_min > seat_max:
        raise HTTPException(status_code=400, detail="Seat min cannot exceed seat max.")
    metadata = next_plan.get("metadata") if isinstance(next_plan.get("metadata"), dict) else {}
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tangent_plan_catalog (
                    plan_key,
                    plan_family,
                    name,
                    billing_period,
                    included_credits,
                    monthly_price_usd,
                    annual_price_usd,
                    seat_range,
                    seat_min,
                    seat_max,
                    board_limit,
                    page_limit,
                    registration_credits,
                    group_workspace_limit,
                    group_member_limit,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (plan_key) DO UPDATE SET
                    plan_family = EXCLUDED.plan_family,
                    name = EXCLUDED.name,
                    billing_period = EXCLUDED.billing_period,
                    included_credits = EXCLUDED.included_credits,
                    monthly_price_usd = EXCLUDED.monthly_price_usd,
                    annual_price_usd = EXCLUDED.annual_price_usd,
                    seat_range = EXCLUDED.seat_range,
                    seat_min = EXCLUDED.seat_min,
                    seat_max = EXCLUDED.seat_max,
                    board_limit = EXCLUDED.board_limit,
                    page_limit = EXCLUDED.page_limit,
                    registration_credits = EXCLUDED.registration_credits,
                    group_workspace_limit = EXCLUDED.group_workspace_limit,
                    group_member_limit = EXCLUDED.group_member_limit,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
                RETURNING
                    plan_key,
                    plan_family,
                    name,
                    billing_period,
                    included_credits,
                    monthly_price_usd,
                    annual_price_usd,
                    seat_range,
                    seat_min,
                    seat_max,
                    board_limit,
                    page_limit,
                    registration_credits,
                    group_workspace_limit,
                    group_member_limit,
                    metadata,
                    created_at,
                    updated_at
                """,
                (
                    normalized_plan_key,
                    next_plan["plan_family"],
                    next_plan["name"],
                    next_plan["billing_period"],
                    int(next_plan.get("included_credits") or 0),
                    _to_optional_int(next_plan.get("monthly_price_usd")),
                    _to_optional_int(next_plan.get("annual_price_usd")),
                    next_plan.get("seat_range"),
                    seat_min,
                    seat_max,
                    _to_optional_int(next_plan.get("board_limit")),
                    _to_optional_int(next_plan.get("page_limit")),
                    int(next_plan.get("registration_credits") or 0),
                    _to_optional_int(next_plan.get("group_workspace_limit")),
                    _to_optional_int(next_plan.get("group_member_limit")),
                    json.dumps(metadata),
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    clear_plan_catalog_cache()
    if not row:
        raise HTTPException(status_code=500, detail="Plan update failed.")
    return PlanCatalogRecord(
        annualPriceUsd=_to_optional_int(row[6]),
        billingPeriod=str(row[3] or "monthly_or_annual"),
        boardLimit=_to_optional_int(row[10]),
        createdAt=_to_optional_str(row[16]),
        groupMemberLimit=_to_optional_int(row[14]),
        groupWorkspaceLimit=_to_optional_int(row[13]),
        includedCredits=int(row[4] or 0),
        metadata=dict(row[15] or {}),
        monthlyPriceUsd=_to_optional_int(row[5]),
        name=str(row[2] or normalized_plan_key),
        pageLimit=_to_optional_int(row[11]),
        planFamily=str(row[1] or "free"),
        planKey=normalized_plan_key,
        registrationCredits=int(row[12] or 0),
        seatMax=_to_optional_int(row[9]),
        seatMin=_to_optional_int(row[8]),
        seatRange=_to_optional_str(row[7]),
        updatedAt=_to_optional_str(row[17]),
    )


def included_credits_for_plan(plan_key: str) -> int:
    return int(load_plan_spec(plan_key).get("included_credits") or 0)


def monthly_price_usd_for_plan(plan_key: str) -> Optional[int]:
    return _to_optional_int(load_plan_spec(plan_key).get("monthly_price_usd"))


def annual_price_usd_for_plan(plan_key: str) -> Optional[int]:
    return _to_optional_int(load_plan_spec(plan_key).get("annual_price_usd"))


def board_limit_for_plan(plan_key: str) -> Optional[int]:
    return _to_optional_int(load_plan_spec(plan_key).get("board_limit"))


def page_limit_for_plan(plan_key: str) -> Optional[int]:
    return _to_optional_int(load_plan_spec(plan_key).get("page_limit"))


def registration_credits_for_plan(plan_key: str) -> int:
    return int(load_plan_spec(plan_key).get("registration_credits") or 0)


def group_workspace_limit_for_plan(plan_key: str) -> int:
    return int(load_plan_spec(plan_key).get("group_workspace_limit") or 0)


def group_member_limit_for_plan(plan_key: str) -> int:
    return int(load_plan_spec(plan_key).get("group_member_limit") or 0)


def seat_max_for_plan(plan_key: str) -> int:
    return int(load_plan_spec(plan_key).get("seat_max") or 0)


def seat_min_for_plan(plan_key: str) -> int:
    return int(load_plan_spec(plan_key).get("seat_min") or 0)


def _to_optional_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    return int(value)


def _to_optional_str(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    return str(value)
