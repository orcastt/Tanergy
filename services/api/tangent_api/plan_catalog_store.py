import json
from typing import Any, Optional, Sequence

from fastapi import HTTPException

from tangent_api.plan_catalog_defaults import DEFAULT_PLAN_ORDER
from tangent_api.plan_catalog_schemas import PlanCatalogRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

_PLAN_ORDER_CASE_SQL = "\n".join(
    f"        WHEN '{plan_key}' THEN {index}"
    for index, plan_key in enumerate(DEFAULT_PLAN_ORDER)
)

_PLAN_CATALOG_SELECT = f"""
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
{_PLAN_ORDER_CASE_SQL}
        ELSE 99
    END,
    plan_key ASC
"""

_PLAN_CATALOG_UPSERT = """
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
"""


def apply_plan_catalog_overlay(
    catalog: dict[str, dict[str, Any]],
    *,
    db_connect=connect_to_postgres,
) -> dict[str, dict[str, Any]]:
    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(_PLAN_CATALOG_SELECT)
            for row in cursor.fetchall():
                plan_key = str(row[0])
                base = catalog.get(plan_key, {"plan_key": plan_key})
                base.update(_plan_dict_from_row(row, base))
                catalog[plan_key] = base
    return catalog


def save_plan_catalog_entry(
    plan_key: str,
    patch: dict[str, Any],
    current: dict[str, Any],
    *,
    db_connect=connect_to_postgres,
    require_database_url_fn=require_database_url,
) -> PlanCatalogRecord:
    require_database_url_fn()
    next_plan = {**current, **patch}
    seat_min = to_optional_int(next_plan.get("seat_min"))
    seat_max = to_optional_int(next_plan.get("seat_max"))
    if seat_min is not None and seat_max is not None and seat_min > seat_max:
        raise HTTPException(status_code=400, detail="Seat min cannot exceed seat max.")
    metadata = next_plan.get("metadata") if isinstance(next_plan.get("metadata"), dict) else {}
    row: Optional[Sequence[Any]] = None
    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                _PLAN_CATALOG_UPSERT,
                (
                    plan_key,
                    next_plan["plan_family"],
                    next_plan["name"],
                    next_plan["billing_period"],
                    int(next_plan.get("included_credits") or 0),
                    to_optional_int(next_plan.get("monthly_price_usd")),
                    to_optional_int(next_plan.get("annual_price_usd")),
                    next_plan.get("seat_range"),
                    seat_min,
                    seat_max,
                    to_optional_int(next_plan.get("board_limit")),
                    to_optional_int(next_plan.get("page_limit")),
                    int(next_plan.get("registration_credits") or 0),
                    to_optional_int(next_plan.get("group_workspace_limit")),
                    to_optional_int(next_plan.get("group_member_limit")),
                    json.dumps(metadata),
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    if not row:
        raise HTTPException(status_code=500, detail="Plan update failed.")
    return _plan_record_from_row(row, plan_key)


def to_optional_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    return int(value)


def _plan_dict_from_row(
    row: Sequence[Any],
    base: dict[str, Any],
) -> dict[str, Any]:
    return {
        "annual_price_usd": to_optional_int(row[6]),
        "billing_period": str(row[3] or base.get("billing_period") or "monthly_or_annual"),
        "board_limit": to_optional_int(row[10]),
        "created_at": _to_optional_str(row[16]),
        "group_member_limit": to_optional_int(row[14]),
        "group_workspace_limit": to_optional_int(row[13]),
        "included_credits": int(row[4] or 0),
        "metadata": dict(row[15] or {}),
        "monthly_price_usd": to_optional_int(row[5]),
        "name": str(row[2] or base.get("name") or row[0]),
        "page_limit": to_optional_int(row[11]),
        "plan_family": str(row[1] or base.get("plan_family") or "free"),
        "plan_key": str(row[0]),
        "registration_credits": int(row[12] or 0),
        "seat_max": to_optional_int(row[9]),
        "seat_min": to_optional_int(row[8]),
        "seat_range": _to_optional_str(row[7]),
        "updated_at": _to_optional_str(row[17]),
    }


def _plan_record_from_row(row: Sequence[Any], plan_key: str) -> PlanCatalogRecord:
    return PlanCatalogRecord(
        annualPriceUsd=to_optional_int(row[6]),
        billingPeriod=str(row[3] or "monthly_or_annual"),
        boardLimit=to_optional_int(row[10]),
        createdAt=_to_optional_str(row[16]),
        groupMemberLimit=to_optional_int(row[14]),
        groupWorkspaceLimit=to_optional_int(row[13]),
        includedCredits=int(row[4] or 0),
        metadata=dict(row[15] or {}),
        monthlyPriceUsd=to_optional_int(row[5]),
        name=str(row[2] or plan_key),
        pageLimit=to_optional_int(row[11]),
        planFamily=str(row[1] or "free"),
        planKey=plan_key,
        registrationCredits=int(row[12] or 0),
        seatMax=to_optional_int(row[9]),
        seatMin=to_optional_int(row[8]),
        seatRange=_to_optional_str(row[7]),
        updatedAt=_to_optional_str(row[17]),
    )


def _to_optional_str(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    return str(value)
