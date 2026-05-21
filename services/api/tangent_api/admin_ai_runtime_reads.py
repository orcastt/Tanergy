from typing import Optional

from tangent_api.admin_ai_runtime_schemas import AdminAiApiCallRecord, AdminAiRunRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def list_admin_ai_runs(
    limit: int,
    model_id: Optional[str] = None,
    provider: Optional[str] = None,
    route_id: Optional[str] = None,
    route_key: Optional[str] = None,
    run_type: Optional[str] = None,
    run_id: Optional[str] = None,
    pricing_rule_id: Optional[str] = None,
    preflight_status: Optional[str] = None,
    workspace_id: Optional[str] = None,
    board_id: Optional[str] = None,
    status: Optional[str] = None,
) -> list[AdminAiRunRecord]:
    require_database_url()
    conditions: list[str] = []
    params: list[object] = []
    _append_match(conditions, params, "id", run_id)
    _append_match(conditions, params, "model_id", model_id)
    _append_match(conditions, params, "provider", provider)
    if route_id:
        if route_key or provider:
            conditions.append("(route_id = %s OR (COALESCE(route_id, '') = '' AND (%s IS NULL OR route_key = %s) AND (%s IS NULL OR provider = %s)))")
            params.extend([route_id, route_key, route_key, provider, provider])
        else:
            conditions.append("route_id = %s")
            params.append(route_id)
    _append_match(conditions, params, "route_key", route_key)
    _append_match(conditions, params, "run_type", run_type)
    _append_match(conditions, params, "pricing_rule_id", pricing_rule_id)
    _append_match(conditions, params, "preflight_status", preflight_status)
    _append_match(conditions, params, "workspace_id", workspace_id)
    _append_match(conditions, params, "board_id", board_id)
    _append_match(conditions, params, "status", status)
    params.append(max(1, limit))
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ''
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT id, workspace_id, created_by, board_id, node_id, run_type, model_id, provider,
                       status, input_asset_ids, output_asset_ids, prompt_preview, estimated_credits,
                       cost_credits, charged_account_id, charged_scope, pricing_rule_id, route_id,
                       route_key, selected_tier_key, preflight_status, latency_ms, error_message,
                       created_at, updated_at, provider_cost, provider_currency
                FROM tangent_ai_runs
                {where_clause}
                ORDER BY created_at DESC
                LIMIT %s
                """,
                params,
            )
            rows = cursor.fetchall()
    records = [_row_to_admin_ai_run(row) for row in rows]
    return _filter_ai_runs(
        records,
        board_id=board_id,
        model_id=model_id,
        preflight_status=preflight_status,
        pricing_rule_id=pricing_rule_id,
        provider=provider,
        route_id=route_id,
        route_key=route_key,
        run_id=run_id,
        run_type=run_type,
        status=status,
        workspace_id=workspace_id,
    )[:limit]


def list_admin_ai_api_calls(
    limit: int,
    board_id: Optional[str] = None,
    error_code: Optional[str] = None,
    model_id: Optional[str] = None,
    provider: Optional[str] = None,
    pricing_rule_id: Optional[str] = None,
    route_id: Optional[str] = None,
    route_key: Optional[str] = None,
    run_id: Optional[str] = None,
    status: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> list[AdminAiApiCallRecord]:
    require_database_url()
    conditions: list[str] = []
    params: list[object] = []
    _append_match(conditions, params, "run_id", run_id)
    _append_match(conditions, params, "workspace_id", workspace_id)
    _append_match(conditions, params, "board_id", board_id)
    _append_match(conditions, params, "model_id", model_id)
    if route_id:
        if route_key or provider:
            conditions.append("(route_id = %s OR (COALESCE(route_id, '') = '' AND (%s IS NULL OR route_key = %s) AND (%s IS NULL OR provider = %s)))")
            params.extend([route_id, route_key, route_key, provider, provider])
        else:
            conditions.append("route_id = %s")
            params.append(route_id)
    _append_match(conditions, params, "provider", provider)
    _append_match(conditions, params, "route_key", route_key)
    _append_match(conditions, params, "pricing_rule_id", pricing_rule_id)
    _append_match(conditions, params, "error_code", error_code)
    _append_match(conditions, params, "status", status)
    params.append(max(1, limit))
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ''
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT id, workspace_id, user_id, run_id, board_id, node_id, model_id, provider,
                       route_key, route_id, pricing_rule_id, status, latency_ms, credits_charged,
                       credits_refunded, provider_cost, provider_currency, error_code, created_at
                FROM tangent_ai_api_calls
                {where_clause}
                ORDER BY created_at DESC
                LIMIT %s
                """,
                params,
            )
            rows = cursor.fetchall()
    records = [_row_to_admin_ai_api_call(row) for row in rows]
    return _filter_ai_api_calls(
        records,
        board_id=board_id,
        error_code=error_code,
        model_id=model_id,
        pricing_rule_id=pricing_rule_id,
        provider=provider,
        route_id=route_id,
        route_key=route_key,
        run_id=run_id,
        status=status,
        workspace_id=workspace_id,
    )[:limit]


def _row_to_admin_ai_run(row: tuple[object, ...]) -> AdminAiRunRecord:
    return AdminAiRunRecord(
        boardId=row[3],
        chargedAccountId=row[14],
        chargedScope=row[15],
        costCredits=float(row[13] or 0),
        createdAt=_to_iso(row[23]),
        errorMessage=row[22],
        estimatedCredits=float(row[12] or 0),
        id=str(row[0]),
        inputAssetIds=list(row[9] or []),
        latencyMs=int(row[21] or 0),
        modelId=str(row[6]),
        nodeId=row[4],
        outputAssetIds=list(row[10] or []),
        preflightStatus=row[20],
        pricingRuleId=row[16],
        promptPreview=row[11],
        provider=str(row[7]),
        providerCost=float(row[25]) if row[25] is not None else None,
        providerCurrency=row[26],
        routeId=row[17],
        routeKey=row[18],
        runType=str(row[5]),
        selectedTierKey=row[19],
        status=str(row[8]),
        updatedAt=_to_iso(row[24]),
        userId=row[2],
        workspaceId=row[1],
    )


def _row_to_admin_ai_api_call(row: tuple[object, ...]) -> AdminAiApiCallRecord:
    return AdminAiApiCallRecord(
        boardId=row[4],
        createdAt=_to_iso(row[18]),
        creditsCharged=float(row[13] or 0),
        creditsRefunded=float(row[14] or 0),
        errorCode=row[17],
        id=str(row[0]),
        latencyMs=int(row[12] or 0),
        modelId=str(row[6]),
        nodeId=row[5],
        pricingRuleId=row[10],
        provider=str(row[7]),
        providerCost=float(row[15]) if row[15] is not None else None,
        providerCurrency=row[16],
        routeId=row[9],
        routeKey=row[8],
        runId=str(row[3]),
        status=str(row[11]),
        userId=row[2],
        workspaceId=row[1],
    )


def _append_match(conditions: list[str], params: list[object], column: str, value: Optional[str]) -> None:
    if value is None:
        return
    conditions.append(f"{column} = %s")
    params.append(value)


def _filter_ai_runs(
    records: list[AdminAiRunRecord],
    *,
    board_id: Optional[str],
    model_id: Optional[str],
    preflight_status: Optional[str],
    pricing_rule_id: Optional[str],
    provider: Optional[str],
    route_id: Optional[str],
    route_key: Optional[str],
    run_id: Optional[str],
    run_type: Optional[str],
    status: Optional[str],
    workspace_id: Optional[str],
) -> list[AdminAiRunRecord]:
    if run_id:
        records = [record for record in records if record.id == run_id]
    if model_id:
        records = [record for record in records if record.model_id == model_id]
    if provider:
        records = [record for record in records if record.provider == provider]
    if route_id:
        records = [record for record in records if _matches_route(record.route_id, record.route_key, record.provider, route_id, route_key, provider)]
    if route_key:
        records = [record for record in records if record.route_key == route_key]
    if run_type:
        records = [record for record in records if record.run_type == run_type]
    if pricing_rule_id:
        records = [record for record in records if record.pricing_rule_id == pricing_rule_id]
    if preflight_status:
        records = [record for record in records if record.preflight_status == preflight_status]
    if workspace_id:
        records = [record for record in records if record.workspace_id == workspace_id]
    if board_id:
        records = [record for record in records if record.board_id == board_id]
    if status:
        records = [record for record in records if record.status == status]
    return records


def _filter_ai_api_calls(
    records: list[AdminAiApiCallRecord],
    *,
    board_id: Optional[str],
    error_code: Optional[str],
    model_id: Optional[str],
    pricing_rule_id: Optional[str],
    provider: Optional[str],
    route_id: Optional[str],
    route_key: Optional[str],
    run_id: Optional[str],
    status: Optional[str],
    workspace_id: Optional[str],
) -> list[AdminAiApiCallRecord]:
    if run_id:
        records = [record for record in records if record.run_id == run_id]
    if workspace_id:
        records = [record for record in records if record.workspace_id == workspace_id]
    if board_id:
        records = [record for record in records if record.board_id == board_id]
    if model_id:
        records = [record for record in records if record.model_id == model_id]
    if route_id:
        records = [record for record in records if _matches_route(record.route_id, record.route_key, record.provider, route_id, route_key, provider)]
    if provider:
        records = [record for record in records if record.provider == provider]
    if route_key:
        records = [record for record in records if record.route_key == route_key]
    if pricing_rule_id:
        records = [record for record in records if record.pricing_rule_id == pricing_rule_id]
    if error_code:
        records = [record for record in records if record.error_code == error_code]
    if status:
        records = [record for record in records if record.status == status]
    return records


def _matches_route(
    record_route_id: Optional[str],
    record_route_key: Optional[str],
    record_provider: str,
    route_id: str,
    route_key: Optional[str],
    provider: Optional[str],
) -> bool:
    return record_route_id == route_id or (
        record_route_id in (None, "")
        and (not route_key or record_route_key == route_key)
        and (not provider or record_provider == provider)
    )


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
