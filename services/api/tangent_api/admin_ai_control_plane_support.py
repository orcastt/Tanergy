import json
import os
from typing import Optional

from fastapi import HTTPException

from tangent_api.schemas import (
    AdminAiModelRecord,
    AdminAiPricingRuleRecord,
    AdminAiProviderRouteRecord,
)

ALLOWED_CAPABILITIES = {"image_generation", "image_edit", "image_analysis", "image_reference", "text"}
ALLOWED_HEALTH_STATUSES = {"healthy", "unknown", "degraded", "failed", "disabled"}
ALLOWED_PRICING_STATUSES = {"active", "draft", "retired"}
ALLOWED_BILLING_UNITS = {"per_image", "per_run", "per_output_token", "per_input_token", "blended"}
DEFAULT_ALLOWED_PROVIDER_KEYS = {"geekai"}


def row_to_admin_ai_model(row: tuple[object, ...]) -> AdminAiModelRecord:
    return AdminAiModelRecord(
        capabilities=list(row[3] or []),
        capability=str(row[2]),
        costHint=str(row[5] or ""),
        createdAt=to_iso(row[12]),
        defaultPricingRuleId=row[11],
        defaultTierKey=row[10],
        displayName=str(row[1]),
        enabled=bool(row[7]),
        estimatedLatency=str(row[6] or ""),
        isDefault=bool(row[8]),
        modelKey=str(row[0]),
        parameterSchema=row[4] or {},
        providerKey=row[9],
        updatedAt=to_iso(row[13]),
    )


def row_to_admin_ai_provider_route(row: tuple[object, ...]) -> AdminAiProviderRouteRecord:
    return AdminAiProviderRouteRecord(
        createdAt=to_iso(row[11]),
        enabled=bool(row[10]),
        healthStatus=str(row[7] or "unknown"),
        modelKey=str(row[1]),
        priority=int(row[5] or 0),
        providerKey=str(row[2]),
        providerModel=str(row[3]),
        retryPolicy=row[9] or {},
        routeId=str(row[0]),
        routeKey=str(row[4]),
        timeoutMs=int(row[8] or 60000),
        updatedAt=to_iso(row[12]),
        weight=int(row[6] or 0),
    )


def row_to_admin_ai_pricing_rule(row: tuple[object, ...]) -> AdminAiPricingRuleRecord:
    return AdminAiPricingRuleRecord(
        billingUnit=str(row[3]),
        createdAt=to_iso(row[11]),
        creditMultiplier=float(row[6] or 1),
        effectiveFrom=to_iso(row[9]),
        effectiveTo=to_iso(row[10]) if row[10] else None,
        estimatedCredits=float(row[4] or 0),
        id=str(row[0]),
        minCredits=float(row[5] or 0),
        modelKey=str(row[1]),
        providerCostFormula=row[7] or {},
        status=str(row[8]),
        tierKey=row[2],
        updatedAt=to_iso(row[12]),
    )


def to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def json_dump(value: object) -> str:
    return json.dumps({} if value is None else value)


def normalize_choice(value: Optional[str], allowed: set[str], error_detail: str) -> str:
    normalized = required_trimmed(value, error_detail)
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail=error_detail)
    return normalized


def normalize_capability_list(values: Optional[list[str]]) -> list[str]:
    normalized = [item.strip() for item in values or [] if item and item.strip()]
    if any(item not in ALLOWED_CAPABILITIES for item in normalized):
        raise HTTPException(status_code=400, detail="Invalid model capabilities.")
    return normalized


def normalize_optional_provider_key(value: Optional[str]) -> Optional[str]:
    normalized = optional_trimmed(value)
    if normalized is None:
        return None
    return normalize_choice(normalized, allowed_provider_keys(), "Provider key is not enabled for this deployment.")


def normalize_required_provider_key(value: Optional[str], error_detail: str) -> str:
    normalized = required_trimmed(value, error_detail)
    return normalize_choice(normalized, allowed_provider_keys(), "Provider key is not enabled for this deployment.")


def optional_trimmed(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def required_trimmed(value: Optional[str], error_detail: str) -> str:
    normalized = optional_trimmed(value)
    if not normalized:
        raise HTTPException(status_code=400, detail=error_detail)
    return normalized


def allowed_provider_keys() -> set[str]:
    configured = {
        value.strip()
        for value in os.getenv("TANGENT_AI_ALLOWED_PROVIDER_KEYS", "").split(",")
        if value.strip()
    }
    return configured or DEFAULT_ALLOWED_PROVIDER_KEYS
