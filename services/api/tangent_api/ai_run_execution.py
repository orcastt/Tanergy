from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from tangent_api.ai_provider_costs import resolve_run_settlement
from tangent_api.ai_provider_execution import run_ai_provider_execution
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
from tangent_api.credit_ledger import settle_usage_charge_to_account
from tangent_api.request_context import ApiRequestContext

MAX_AI_RUN_TEXT_OUTPUT_CHARS = 12_000


@dataclass(frozen=True)
class AiRunFinalizationResult:
    attempts: list[AiProviderAttemptResult]
    run: AiRunRecord


def finalize_mock_run(
    run: AiRunRecord,
    payload: AiRunRequest,
    context: ApiRequestContext,
    should_charge_mock_ai_run: bool,
) -> AiRunFinalizationResult:
    charge = run.charge
    execution = run_ai_provider_execution(run, payload, context)
    if execution.status != "succeeded":
        return AiRunFinalizationResult(
            attempts=execution.attempts,
            run=run.model_copy(
                update={
                    "cost_hint": mock_cost_hint(charge, run.estimated_credits, "failed", should_charge_mock_ai_run),
                    "error": execution.error_message,
                    "latency_ms": execution.latency_ms,
                    "output_asset_ids": execution.output_asset_ids,
                    "provider": execution.provider,
                    "provider_cost": execution.provider_cost,
                    "provider_currency": execution.provider_currency,
                    "route_id": execution.route_id,
                    "route_key": execution.route_key,
                    "status": execution.status,
                    "text_output": _limit_text_output(execution.text_output),
                }
            ),
        )

    settlement = resolve_run_settlement(
        run,
        payload,
        output_count=len(execution.output_asset_ids),
        provider_cost=execution.provider_cost,
        provider_currency=execution.provider_currency,
    )
    update = {
        "cost_hint": mock_cost_hint(charge, settlement.cost_credits, "succeeded", should_charge_mock_ai_run),
        "cost_credits": settlement.cost_credits,
        "latency_ms": execution.latency_ms,
        "output_asset_ids": execution.output_asset_ids,
        "provider": execution.provider,
        "provider_cost": settlement.provider_cost,
        "provider_currency": settlement.provider_currency,
        "route_id": execution.route_id,
        "route_key": execution.route_key,
        "status": "succeeded",
        "text_output": _limit_text_output(execution.text_output),
    }
    if should_charge_mock_ai_run:
        try:
            settle_usage_charge_to_account(
                account_id=run.charged_account_id,
                actor_user_id=context.user_id,
                workspace_id=context.workspace_id,
                credits=settlement.cost_credits,
                run_id=run.run_id,
                metadata={
                    "isMockRun": True,
                    "modelId": run.model_id,
                    "nodeId": payload.node_id,
                    "runType": payload.run_type,
                },
            )
            charge = charge_with_preflight_status(charge, "settled")
            update["charge"] = charge
            update["charged_account_id"] = charge.charged_account_id
            update["cost_credits"] = settlement.cost_credits
            update["cost_hint"] = mock_cost_hint(charge, settlement.cost_credits, "succeeded", should_charge_mock_ai_run)
        except HTTPException as exc:
            if exc.status_code != 402:
                raise
            return AiRunFinalizationResult(
                attempts=execution.attempts,
                run=run.model_copy(
                    update={
                        "cost_hint": mock_cost_hint(charge, run.estimated_credits, "failed", should_charge_mock_ai_run),
                        "error": str(exc.detail),
                        "latency_ms": 0,
                        "output_asset_ids": [],
                        "status": "failed",
                        "text_output": None,
                    }
                ),
            )
    return AiRunFinalizationResult(attempts=execution.attempts, run=run.model_copy(update=update))


def mock_cost_hint(
    charge: AiRunChargeSummary,
    cost_credits: float,
    status: str,
    should_charge_mock_ai_run: bool,
) -> str:
    if status == "queued":
        return f"Mock AI run queued · {charge.payer_label}"
    if status == "running":
        return f"Mock AI run running · {charge.payer_label}"
    if status == "canceled":
        return f"Mock AI run canceled · {charge.payer_label}"
    if status == "failed":
        return f"Mock AI run failed · {charge.payer_label}"
    if not should_charge_mock_ai_run:
        return f"Mock AI run · {charge.payer_label}"
    return f"Mock AI run · charged {cost_credits:g} credits · {charge.payer_label}"


def charge_with_preflight_status(charge: AiRunChargeSummary, status: str) -> AiRunChargeSummary:
    return AiRunChargeSummary(
        chargedAccountId=charge.charged_account_id,
        chargedScope=charge.charged_scope,
        entitlementSource=charge.entitlement_source,
        payerLabel=charge.payer_label,
        planKey=charge.plan_key,
        preflightStatus=status,
        workspaceKind=charge.workspace_kind,
        workspaceSeatId=charge.workspace_seat_id,
    )


def _limit_text_output(value: Optional[str]) -> Optional[str]:
    if value is None or len(value) <= MAX_AI_RUN_TEXT_OUTPUT_CHARS:
        return value
    return value[:MAX_AI_RUN_TEXT_OUTPUT_CHARS]
