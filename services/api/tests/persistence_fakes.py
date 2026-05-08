import json
from datetime import datetime, timezone
from io import BytesIO


class FakeS3NotFound(Exception):
    response = {
        "Error": {"Code": "NoSuchKey"},
        "ResponseMetadata": {"HTTPStatusCode": 404},
    }


class FakeS3Client:
    def __init__(self):
        self.objects = {}

    def put_object(self, Body, Bucket, ContentType, Key):
        self.objects[(Bucket, Key)] = {"Body": Body, "ContentType": ContentType}

    def get_object(self, Bucket, Key):
        stored = self.objects.get((Bucket, Key))
        if not stored:
            raise FakeS3NotFound()
        return {"Body": BytesIO(stored["Body"]), "ContentType": stored["ContentType"]}


class FakePostgresCursor:
    def __init__(self, database):
        self.database = database
        self.rowcount = 0
        self.row = None
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        self.rowcount = 0
        self.row = None
        self.rows = []
        if normalized.startswith("INSERT INTO tangent_boards"):
            key = (params[1], params[0])
            self.database.boards[key] = params
        elif normalized.startswith("INSERT INTO tangent_admin_audit_logs"):
            self.database.admin_audit_logs.append(
                {
                    "id": params[0],
                    "actor_user_id": params[1],
                    "target_user_id": params[2],
                    "workspace_id": params[3],
                    "action": params[4],
                    "created_at": f"2026-05-05T00:20:{len(self.database.admin_audit_logs):02d}Z",
                    "metadata": json.loads(params[5]) if isinstance(params[5], str) else params[5],
                }
            )
        elif normalized.startswith("INSERT INTO tangent_admin_roles"):
            existing_index = next(
                (
                    index for index, row in enumerate(self.database.admin_roles)
                    if row["user_id"] == params[0] and row["role"] == params[1]
                ),
                None,
            )
            next_row = {
                "user_id": params[0],
                "role": params[1],
                "permissions": json.loads(params[2]) if isinstance(params[2], str) else params[2],
                "note": params[3],
                "granted_by": params[4],
                "created_at": (
                    self.database.admin_roles[existing_index]["created_at"]
                    if existing_index is not None
                    else f"2026-05-05T00:10:{len(self.database.admin_roles):02d}Z"
                ),
                "revoked_at": None,
            }
            if existing_index is None:
                self.database.admin_roles.append(next_row)
            else:
                self.database.admin_roles[existing_index] = next_row
        elif normalized.startswith("INSERT INTO tangent_credit_ledger"):
            metadata = json.loads(params[8]) if isinstance(params[8], str) else params[8]
            row = {
                "account_id": params[1],
                "actor_user_id": params[3],
                "created_at": f"2026-05-06T00:30:{len(self.database.credit_ledger):02d}Z",
                "credits_delta": params[6],
                "id": params[0],
                "metadata": metadata or {},
                "reason": params[7],
                "source_id": params[5],
                "source_type": params[4],
                "workspace_id": params[2],
            }
            self.database.credit_ledger.append(row)
            self.row = _credit_ledger_tuple(row)
        elif normalized.startswith("INSERT INTO tangent_payments"):
            metadata = json.loads(params[7]) if isinstance(params[7], str) else params[7]
            row = {
                "account_id": params[1],
                "amount_cents": params[3],
                "checkout_session_id": params[5],
                "created_at": f"2026-05-06T00:25:{len(self.database.payments):02d}Z",
                "currency": params[4],
                "id": params[0],
                "kind": params[6],
                "metadata": metadata or {},
                "provider": params[2],
                "provider_payment_id": None,
                "status": "pending",
            }
            self.database.payments.append(row)
            self.row = _payment_tuple(row)
        elif normalized.startswith("INSERT INTO tangent_workspaces"):
            if len(params) == 5:
                workspace_id, name, owner_id, kind, billing_owner_user_id = params
            else:
                workspace_id, name, owner_id, billing_owner_user_id = params
                kind = "team_workspace"
            existing = next((row for row in self.database.workspaces if row["id"] == workspace_id), None)
            next_row = {
                "billing_owner_user_id": billing_owner_user_id,
                "created_at": f"2026-05-08T00:10:{len(self.database.workspaces):02d}Z",
                "id": workspace_id,
                "kind": kind,
                "name": name,
                "owner_id": owner_id,
                "slug": None,
                "status": "active",
            }
            if existing:
                existing.update(next_row)
            else:
                self.database.workspaces.append(next_row)
        elif normalized.startswith("INSERT INTO tangent_workspace_members"):
            if len(params) == 5:
                workspace_id, user_id, role, display_name, invited_by = params
            else:
                workspace_id, user_id, display_name = params
                role = "owner"
                invited_by = None
            existing = _find_workspace_member(self.database, workspace_id, user_id)
            next_row = {
                "display_name": display_name,
                "invited_by": invited_by,
                "joined_at": f"2026-05-08T00:15:{len(self.database.workspace_members):02d}Z",
                "role": role,
                "user_id": user_id,
                "workspace_id": workspace_id,
            }
            if existing:
                existing.update(next_row)
            else:
                self.database.workspace_members.append(next_row)
        elif normalized.startswith("INSERT INTO tangent_workspace_invitations"):
            metadata = json.loads(params[8]) if isinstance(params[8], str) else params[8]
            row = {
                "accepted_at": None,
                "accepted_by": None,
                "created_at": f"2026-05-08T00:20:{len(self.database.workspace_invitations):02d}Z",
                "email": params[2],
                "expires_at": params[5],
                "id": params[0],
                "invited_by": params[4],
                "metadata": metadata or {},
                "revoked_at": None,
                "role": params[3],
                "target_user_id": params[7],
                "token_hash": params[6],
                "workspace_id": params[1],
            }
            self.database.workspace_invitations.append(row)
            self.row = _workspace_invitation_tuple(row)
        elif normalized.startswith("INSERT INTO tangent_ai_runs"):
            row = {
                "id": params[0],
                "workspace_id": params[1],
                "created_by": params[2],
                "board_id": params[3],
                "node_id": params[4],
                "run_type": params[5],
                "model_id": params[6],
                "provider": params[7],
                "status": params[8],
                "input_asset_ids": json.loads(params[9]) if isinstance(params[9], str) else params[9],
                "output_asset_ids": json.loads(params[10]) if isinstance(params[10], str) else params[10],
                "params": json.loads(params[11]) if isinstance(params[11], str) else params[11],
                "prompt_preview": params[12],
                "cost_credits": params[13],
                "latency_ms": params[14],
                "error_code": params[15],
                "error_message": params[16],
                "workspace_kind": params[17],
                "workspace_seat_id": params[18],
                "charged_account_id": params[19],
                "charged_scope": params[20],
                "entitlement_source": params[21],
                "credits_charged": params[22],
                "credits_refunded": params[23],
                "provider_cost": params[24],
                "provider_currency": params[25],
                "estimated_credits": params[26],
                "pricing_rule_id": params[27],
                "route_id": params[28],
                "route_key": params[29],
                "selected_tier_key": params[30],
                "preflight_status": params[31],
                "created_at": params[32],
                "updated_at": params[33],
            }
            self.database.ai_runs[row["id"]] = row
        elif normalized.startswith("INSERT INTO tangent_ai_api_calls"):
            next_row = {
                "id": params[0],
                "workspace_id": params[1],
                "user_id": params[2],
                "run_id": params[3],
                "board_id": params[4],
                "node_id": params[5],
                "model_id": params[6],
                "provider": params[7],
                "route_key": params[8],
                "route_id": params[9],
                "pricing_rule_id": params[10],
                "status": params[11],
                "latency_ms": params[12],
                "credits_charged": params[13],
                "credits_refunded": params[14],
                "provider_cost": params[15],
                "provider_currency": params[16],
                "error_code": params[17],
                "created_at": params[18],
            }
            existing_index = next((index for index, row in enumerate(self.database.ai_api_calls) if row["id"] == params[0]), None)
            if existing_index is None:
                self.database.ai_api_calls.append(next_row)
            else:
                self.database.ai_api_calls[existing_index] = next_row
        elif normalized.startswith("INSERT INTO tangent_api_cost_ledger"):
            row = {
                "ai_call_id": params[3],
                "amount_usd": params[5],
                "created_at": f"2026-05-06T00:40:{len(self.database.api_cost_ledger):02d}Z",
                "credits_charged": params[6],
                "id": params[0],
                "provider": params[4],
                "provider_cost": params[7],
                "provider_currency": params[8],
                "settlement_kind": params[9],
                "user_id": params[2],
                "workspace_id": params[1],
            }
            existing_index = next((index for index, value in enumerate(self.database.api_cost_ledger) if value["id"] == params[0]), None)
            if existing_index is None:
                self.database.api_cost_ledger.append(row)
            else:
                self.database.api_cost_ledger[existing_index] = row
        elif normalized.startswith("INSERT INTO tangent_ai_control_plane_versions"):
            snapshot = json.loads(params[5]) if isinstance(params[5], str) else params[5]
            row = {
                "action": params[4],
                "actor_user_id": params[7],
                "created_at": f"2026-05-06T00:45:{len(self.database.ai_control_plane_versions):02d}Z",
                "id": params[0],
                "note": params[6],
                "published_at": f"2026-05-06T00:45:{len(self.database.ai_control_plane_versions):02d}Z",
                "resource_id": params[2],
                "resource_type": params[1],
                "snapshot": snapshot or {},
                "version_number": params[3],
                "workspace_id": params[8],
            }
            self.database.ai_control_plane_versions.append(row)
            self.row = _ai_control_plane_version_tuple(row)
        elif normalized.startswith("SELECT id, workspace_id, owner_id, title, document") and "FROM tangent_board_share_links sl JOIN tangent_boards b" in normalized:
            share_id = params[0]
            matches = [
                row for row in self.database.board_share_links
                if (
                    row["share_id"] == share_id
                    and row["revoked_at"] is None
                    and _share_link_is_active(row)
                )
            ]
            matches.sort(key=lambda row: row["created_at"], reverse=True)
            if matches:
                share_link = matches[0]
                self.row = self.database.boards.get((share_link["workspace_id"], share_link["board_id"]))
        elif normalized.startswith("SELECT id, workspace_id, owner_id, title, document") and "ORDER BY saved_at DESC" in normalized:
            workspace_id = params[0]
            self.rows = [row for (workspace, _board_id), row in self.database.boards.items() if workspace == workspace_id]
            self.rows.sort(key=lambda row: row[12], reverse=True)
        elif normalized.startswith("SELECT id, workspace_id, owner_id, title, document"):
            self.row = self.database.boards.get((params[0], params[1]))
        elif normalized.startswith(
            "SELECT id, board_id, charged_account_id, charged_scope, cost_credits, workspace_kind, workspace_seat_id, entitlement_source, input_asset_ids, latency_ms, model_id, node_id, output_asset_ids, provider, run_type, status, prompt_preview, created_at, pricing_rule_id, route_id, route_key, estimated_credits, selected_tier_key, preflight_status, params, error_message, provider_cost, provider_currency FROM tangent_ai_runs"
        ):
            run = self.database.ai_runs.get(params[0])
            if run:
                self.row = (
                    run["id"],
                    run.get("board_id"),
                    run.get("charged_account_id"),
                    run.get("charged_scope"),
                    run.get("cost_credits", 0),
                    run.get("workspace_kind", "solo_workspace"),
                    run.get("workspace_seat_id"),
                    run.get("entitlement_source", "personal_topup_or_free"),
                    run.get("input_asset_ids", []),
                    run.get("latency_ms", 0),
                    run.get("model_id"),
                    run.get("node_id"),
                    run.get("output_asset_ids", []),
                    run.get("provider"),
                    run.get("run_type"),
                    run.get("status"),
                    run.get("prompt_preview"),
                    run.get("created_at", "1970-01-01T00:00:00Z"),
                    run.get("pricing_rule_id"),
                    run.get("route_id"),
                    run.get("route_key"),
                    run.get("estimated_credits", 0),
                    run.get("selected_tier_key"),
                    run.get("preflight_status", "mock_contract_only"),
                    run.get("params", {}),
                    run.get("error_message"),
                    run.get("provider_cost"),
                    run.get("provider_currency"),
                )
        elif normalized.startswith("SELECT workspace_id, created_by, workspace_kind FROM tangent_ai_runs"):
            run = self.database.ai_runs.get(params[0])
            if run:
                self.row = (
                    run.get("workspace_id"),
                    run.get("created_by"),
                    run.get("workspace_kind", "solo_workspace"),
                )
        elif normalized.startswith(
            "SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint, estimated_latency, enabled, is_default, provider_key, default_tier_key FROM tangent_model_registry"
        ):
            rows = [
                (
                    row["model_key"],
                    row["display_name"],
                    row.get("capability", "image_generation"),
                    row.get("capabilities", []),
                    row.get("parameter_schema", {}),
                    row.get("cost_hint", ""),
                    row.get("estimated_latency", ""),
                    row.get("enabled", True),
                    row.get("is_default", False),
                    row.get("provider_key"),
                    row.get("default_tier_key"),
                )
                for row in self.database.model_registry
            ]
            rows.sort(key=lambda row: (not bool(row[8]), str(row[1]).lower()))
            self.rows = rows
        elif normalized.startswith(
            "SELECT id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled FROM tangent_model_parameter_tiers"
        ):
            rows = [
                (
                    row["id"],
                    row["model_key"],
                    row["tier_key"],
                    row["public_label"],
                    row.get("parameter_key", "resolution"),
                    row.get("provider_params", {}),
                    row.get("sort_order", 0),
                    row.get("enabled", True),
                )
                for row in self.database.model_parameter_tiers
            ]
            rows.sort(key=lambda row: (row[1], row[6], str(row[3]).lower()))
            self.rows = rows
        elif normalized.startswith(
            "SELECT id, model_key, provider_key, provider_model, route_key, priority, weight, health_status, timeout_ms, retry_policy, enabled, created_at, updated_at FROM tangent_model_provider_routes"
        ):
            rows = [
                (
                    row["id"],
                    row["model_key"],
                    row.get("provider_key", row.get("provider")),
                    row.get("provider_model", row.get("model_key")),
                    row.get("route_key", row["id"]),
                    row.get("priority", 100),
                    row.get("weight", 100),
                    row.get("health_status", "unknown"),
                    row.get("timeout_ms", 60000),
                    row.get("retry_policy", {}),
                    row.get("enabled", True),
                    row.get("created_at", "2026-05-06T00:00:00Z"),
                    row.get("updated_at", row.get("created_at", "2026-05-06T00:00:00Z")),
                )
                for row in self.database.model_provider_routes
            ]
            rows.sort(key=lambda row: (row[1], row[5], -int(row[6]), str(row[12])))
            self.rows = rows
        elif normalized.startswith(
            "SELECT id, model_key, tier_key, billing_unit, estimated_credits, min_credits, credit_multiplier, provider_cost_formula, status, effective_from, effective_to, created_at, updated_at FROM tangent_model_pricing_rules"
        ):
            rows = [
                (
                    row["id"],
                    row["model_key"],
                    row.get("tier_key"),
                    row.get("billing_unit", "per_image"),
                    row.get("estimated_credits", 0),
                    row.get("min_credits", 0),
                    row.get("credit_multiplier", 1),
                    row.get("provider_cost_formula", {}),
                    row.get("status", "draft"),
                    row.get("effective_from", "2026-05-06T00:00:00Z"),
                    row.get("effective_to"),
                    row.get("created_at", "2026-05-06T00:00:00Z"),
                    row.get("updated_at", row.get("created_at", "2026-05-06T00:00:00Z")),
                )
                for row in self.database.model_pricing_rules
            ]
            rows.sort(key=lambda row: (row[1], str(row[9]), str(row[11])), reverse=True)
            self.rows = rows
        elif normalized.startswith("UPDATE tangent_model_registry SET is_default = FALSE"):
            model_key = params[0]
            for row in self.database.model_registry:
                if row["model_key"] != model_key and row.get("is_default"):
                    row["is_default"] = False
                    row["updated_at"] = "2026-05-06T04:00:00Z"
        elif normalized.startswith("UPDATE tangent_model_registry SET"):
            model_key = params[-1]
            target = next((row for row in self.database.model_registry if row["model_key"] == model_key), None)
            if target:
                assignments = normalized.partition("SET ")[2].partition(" WHERE model_key")[0]
                values = list(params[:-1])
                for assignment in [item.strip() for item in assignments.split(",")]:
                    if assignment == "updated_at = NOW()":
                        target["updated_at"] = "2026-05-06T04:00:01Z"
                        continue
                    column, _, expression = assignment.partition(" = ")
                    value = values.pop(0)
                    key = column.strip()
                    target[key] = json.loads(value) if isinstance(value, str) and "::jsonb" in expression else value
                target.setdefault("created_at", "2026-05-06T00:00:00Z")
                target.setdefault("updated_at", "2026-05-06T04:00:01Z")
                self.row = (
                    target["model_key"],
                    target["display_name"],
                    target.get("capability", "image_generation"),
                    target.get("capabilities", []),
                    target.get("parameter_schema", {}),
                    target.get("cost_hint", ""),
                    target.get("estimated_latency", ""),
                    target.get("enabled", True),
                    target.get("is_default", False),
                    target.get("provider_key"),
                    target.get("default_tier_key"),
                    target.get("default_pricing_rule_id"),
                    target.get("created_at"),
                    target.get("updated_at"),
                )
        elif normalized.startswith("UPDATE tangent_model_provider_routes SET"):
            route_id = params[-1]
            target = next((row for row in self.database.model_provider_routes if row["id"] == route_id), None)
            if target:
                assignments = normalized.partition("SET ")[2].partition(" WHERE id")[0]
                values = list(params[:-1])
                for assignment in [item.strip() for item in assignments.split(",")]:
                    if assignment == "updated_at = NOW()":
                        target["updated_at"] = "2026-05-06T04:00:02Z"
                        continue
                    column, _, expression = assignment.partition(" = ")
                    value = values.pop(0)
                    key = column.strip()
                    target[key] = json.loads(value) if isinstance(value, str) and "::jsonb" in expression else value
                target.setdefault("created_at", "2026-05-06T00:00:00Z")
                target.setdefault("updated_at", "2026-05-06T04:00:02Z")
                self.row = (
                    target["id"],
                    target["model_key"],
                    target.get("provider_key", target.get("provider")),
                    target.get("provider_model", target.get("model_key")),
                    target.get("route_key", target["id"]),
                    target.get("priority", 100),
                    target.get("weight", 100),
                    target.get("health_status", "unknown"),
                    target.get("timeout_ms", 60000),
                    target.get("retry_policy", {}),
                    target.get("enabled", True),
                    target.get("created_at"),
                    target.get("updated_at"),
                )
        elif normalized.startswith("UPDATE tangent_model_pricing_rules SET status = CASE WHEN id = %s THEN 'active' ELSE 'retired' END"):
            rule_id, model_key, tier_key = params
            for row in self.database.model_pricing_rules:
                if row["model_key"] == model_key and (row.get("tier_key") or "") == (tier_key or "") and row.get("status") in {"draft", "active"}:
                    row["status"] = "active" if row["id"] == rule_id else "retired"
                    row["updated_at"] = "2026-05-06T04:00:04Z"
        elif normalized.startswith("UPDATE tangent_model_pricing_rules SET"):
            rule_id = params[-1]
            target = next((row for row in self.database.model_pricing_rules if row["id"] == rule_id), None)
            if target:
                assignments = normalized.partition("SET ")[2].partition(" WHERE id")[0]
                values = list(params[:-1])
                for assignment in [item.strip() for item in assignments.split(",")]:
                    if assignment == "updated_at = NOW()":
                        target["updated_at"] = "2026-05-06T04:00:03Z"
                        continue
                    column, _, expression = assignment.partition(" = ")
                    value = values.pop(0)
                    key = column.strip()
                    target[key] = json.loads(value) if isinstance(value, str) and "::jsonb" in expression else value
                target.setdefault("created_at", "2026-05-06T00:00:00Z")
                target.setdefault("updated_at", "2026-05-06T04:00:03Z")
                self.row = (
                    target["id"],
                    target["model_key"],
                    target.get("tier_key"),
                    target.get("billing_unit", "per_image"),
                    target.get("estimated_credits", 0),
                    target.get("min_credits", 0),
                    target.get("credit_multiplier", 1),
                    target.get("provider_cost_formula", {}),
                    target.get("status", "draft"),
                    target.get("effective_from", "2026-05-06T00:00:00Z"),
                    target.get("effective_to"),
                    target.get("created_at"),
                    target.get("updated_at"),
                )
        elif normalized.startswith("SELECT COALESCE(MAX(version_number), 0) FROM tangent_ai_control_plane_versions"):
            resource_type, resource_id = params
            versions = [
                row["version_number"]
                for row in self.database.ai_control_plane_versions
                if row["resource_type"] == resource_type and row["resource_id"] == resource_id
            ]
            self.row = (max(versions) if versions else 0,)
        elif normalized.startswith("SELECT snapshot FROM tangent_ai_control_plane_versions"):
            version_id, resource_type, resource_id = params
            row = next(
                (
                    value for value in self.database.ai_control_plane_versions
                    if value["id"] == version_id and value["resource_type"] == resource_type and value["resource_id"] == resource_id
                ),
                None,
            )
            if row:
                self.row = (row.get("snapshot", {}),)
        elif normalized.startswith("SELECT id, resource_type, resource_id, version_number, action, snapshot, note, actor_user_id, workspace_id, published_at, created_at FROM tangent_ai_control_plane_versions"):
            resource_type, resource_id, limit = params
            rows = [
                _ai_control_plane_version_tuple(row)
                for row in self.database.ai_control_plane_versions
                if row["resource_type"] == resource_type and row["resource_id"] == resource_id
            ]
            rows.sort(key=lambda row: (row[3], row[10]), reverse=True)
            self.rows = rows[:limit]
        elif normalized.startswith(
            "SELECT id, workspace_id, created_by, board_id, node_id, run_type, model_id, provider, status, input_asset_ids, output_asset_ids, prompt_preview, estimated_credits, cost_credits, charged_account_id, charged_scope, pricing_rule_id, route_id, route_key, selected_tier_key, preflight_status, latency_ms, error_message, created_at, updated_at, provider_cost, provider_currency FROM tangent_ai_runs"
        ):
            rows = [
                (
                    row["id"],
                    row.get("workspace_id"),
                    row.get("created_by"),
                    row.get("board_id"),
                    row.get("node_id"),
                    row.get("run_type"),
                    row.get("model_id"),
                    row.get("provider"),
                    row.get("status"),
                    row.get("input_asset_ids", []),
                    row.get("output_asset_ids", []),
                    row.get("prompt_preview"),
                    row.get("estimated_credits", 0),
                    row.get("cost_credits", 0),
                    row.get("charged_account_id"),
                    row.get("charged_scope"),
                    row.get("pricing_rule_id"),
                    row.get("route_id"),
                    row.get("route_key"),
                    row.get("selected_tier_key"),
                    row.get("preflight_status"),
                    row.get("latency_ms", 0),
                    row.get("error_message"),
                    row.get("created_at", "1970-01-01T00:00:00Z"),
                    row.get("updated_at", row.get("created_at", "1970-01-01T00:00:00Z")),
                    row.get("provider_cost"),
                    row.get("provider_currency"),
                )
                for row in self.database.ai_runs.values()
            ]
            rows.sort(key=lambda row: row[23], reverse=True)
            self.rows = rows
        elif normalized.startswith(
            "SELECT id, workspace_id, user_id, run_id, board_id, node_id, model_id, provider, route_key, route_id, pricing_rule_id, status, latency_ms, credits_charged, credits_refunded, provider_cost, provider_currency, error_code, created_at FROM tangent_ai_api_calls"
        ):
            rows = [
                (
                    row["id"],
                    row.get("workspace_id"),
                    row.get("user_id"),
                    row.get("run_id"),
                    row.get("board_id"),
                    row.get("node_id"),
                    row.get("model_id"),
                    row.get("provider"),
                    row.get("route_key"),
                    row.get("route_id"),
                    row.get("pricing_rule_id"),
                    row.get("status"),
                    row.get("latency_ms", 0),
                    row.get("credits_charged", 0),
                    row.get("credits_refunded", 0),
                    row.get("provider_cost"),
                    row.get("provider_currency"),
                    row.get("error_code"),
                    row.get("created_at", "1970-01-01T00:00:00Z"),
                )
                for row in self.database.ai_api_calls
            ]
            rows.sort(key=lambda row: row[18], reverse=True)
            self.rows = rows
        elif normalized.startswith("UPDATE tangent_boards SET title"):
            key = (params[9], params[10])
            row = self.database.boards.get(key)
            if row:
                self.database.boards[key] = (
                    row[0],
                    row[1],
                    row[2],
                    params[0],
                    row[4],
                    row[5],
                    row[6],
                    row[7],
                    params[1],
                    params[2],
                    params[3],
                    row[11],
                    params[8],
                    row[13],
                    params[4],
                    params[5],
                    params[6],
                    params[7],
                )
        elif normalized.startswith("UPDATE tangent_boards SET last_opened_at"):
            key = (params[1], params[2])
            row = self.database.boards.get(key)
            if row:
                self.database.boards[key] = (
                    row[0],
                    row[1],
                    row[2],
                    row[3],
                    row[4],
                    row[5],
                    row[6],
                    row[7],
                    row[8],
                    row[9],
                    row[10],
                    params[0],
                    row[12],
                    row[13],
                    row[14],
                    row[15],
                    row[16],
                    row[17],
                )
        elif normalized.startswith("DELETE FROM tangent_boards"):
            self.database.boards.pop((params[0], params[1]), None)
            self.database.board_members = {
                key: row for key, row in self.database.board_members.items()
                if key[0] != params[0] or key[1] != params[1]
            }
            self.database.board_share_links = [
                row for row in self.database.board_share_links
                if row["workspace_id"] != params[0] or row["board_id"] != params[1]
            ]
        elif normalized.startswith("INSERT INTO tangent_board_snapshots"):
            key = (params[1], params[2], params[0])
            self.database.snapshots[key] = params
        elif normalized.startswith("INSERT INTO tangent_board_members"):
            key = (params[0], params[1], params[2])
            existing = self.database.board_members.get(key)
            if existing and "DO UPDATE SET role = EXCLUDED.role" in normalized:
                self.database.board_members[key] = (
                    existing[0],
                    existing[1],
                    existing[2],
                    params[3],
                    existing[4],
                    existing[5],
                )
            elif existing:
                self.database.board_members[key] = existing
            else:
                joined_at = f"2026-05-05T00:00:{len(self.database.board_members):02d}Z"
                invited_by = params[4] if len(params) > 4 else None
                self.database.board_members[key] = (
                    params[0],
                    params[1],
                    params[2],
                    params[3],
                    invited_by,
                    joined_at,
                )
        elif normalized.startswith(
            "SELECT bm.user_id, bm.role, COALESCE(wm.display_name, u.display_name, u.email), u.email, bm.invited_by, bm.joined_at, COALESCE(wm.role, 'member') FROM tangent_board_members bm"
        ):
            workspace_id, board_id = params[0], params[1]
            rows = []
            for key, row in self.database.board_members.items():
                if key[0] != workspace_id or key[1] != board_id:
                    continue
                user = _find_user(self.database, row[2])
                workspace_member = _find_workspace_member(self.database, workspace_id, row[2])
                display_name = (
                    (workspace_member or {}).get("display_name")
                    or (user or {}).get("display_name")
                    or (user or {}).get("email")
                )
                rows.append(
                    (
                        row[2],
                        row[3],
                        display_name,
                        (user or {}).get("email"),
                        row[4],
                        row[5],
                        (workspace_member or {}).get("role", "member"),
                    )
                )
            rows.sort(key=lambda row: row[5])
            self.rows = rows
        elif normalized.startswith("SELECT user_id, role, display_name, invited_by, joined_at FROM tangent_board_members"):
            workspace_id, board_id = params[0], params[1]
            rows = [
                (row[2], row[3], None, row[4], row[5])
                for key, row in self.database.board_members.items()
                if key[0] == workspace_id and key[1] == board_id
            ]
            rows.sort(key=lambda row: row[4])
            self.rows = rows
        elif normalized.startswith("SELECT role FROM tangent_board_members"):
            workspace_id, board_id, user_id = params
            row = self.database.board_members.get((workspace_id, board_id, user_id))
            if row:
                self.row = (row[3],)
        elif normalized.startswith("SELECT board_id, role FROM tangent_board_members"):
            workspace_id, user_id = params
            rows = [
                (row[1], row[3])
                for key, row in self.database.board_members.items()
                if key[0] == workspace_id and key[2] == user_id
            ]
            rows.sort(key=lambda row: row[0])
            self.rows = rows
        elif normalized.startswith(
            "SELECT bm.user_id, bm.role, COALESCE(%s, wm.display_name, u.display_name, u.email), u.email, bm.invited_by, bm.joined_at, COALESCE(wm.role, 'member') FROM tangent_board_members bm"
        ):
            display_name, workspace_id, board_id, user_id = params
            row = self.database.board_members.get((workspace_id, board_id, user_id))
            if row:
                user = _find_user(self.database, row[2])
                workspace_member = _find_workspace_member(self.database, workspace_id, row[2])
                resolved_name = (
                    display_name
                    or (workspace_member or {}).get("display_name")
                    or (user or {}).get("display_name")
                    or (user or {}).get("email")
                )
                self.row = (
                    row[2],
                    row[3],
                    resolved_name,
                    (user or {}).get("email"),
                    row[4],
                    row[5],
                    (workspace_member or {}).get("role", "member"),
                )
        elif normalized.startswith("SELECT user_id, role, %s AS display_name, invited_by, joined_at FROM tangent_board_members"):
            display_name, workspace_id, board_id, user_id = params
            row = self.database.board_members.get((workspace_id, board_id, user_id))
            if row:
                self.row = (row[2], row[3], display_name, row[4], row[5])
        elif normalized.startswith(
            "SELECT wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email), wm.role, bm.role FROM tangent_workspace_members wm"
        ):
            board_id, workspace_id, like_query, _display_like_query, _user_like_query = params
            needle = str(like_query).strip("%").lower()
            rows = []
            for workspace_member in self.database.workspace_members:
                if workspace_member["workspace_id"] != workspace_id:
                    continue
                user = _find_user(self.database, workspace_member["user_id"])
                email = (user or {}).get("email", f"{workspace_member['user_id']}@example.com")
                display_name = workspace_member.get("display_name") or (user or {}).get("display_name") or email
                haystack = " ".join([workspace_member["user_id"], email, display_name]).lower()
                if needle not in haystack:
                    continue
                board_member = self.database.board_members.get((workspace_id, board_id, workspace_member["user_id"]))
                rows.append(
                    (
                        workspace_member["user_id"],
                        email,
                        display_name,
                        workspace_member.get("role", "member"),
                        board_member[3] if board_member else None,
                    )
                )
            rows.sort(key=lambda row: (0 if row[4] is None else 1, (row[2] or row[1]).lower()))
            self.rows = rows[:12]
        elif normalized.startswith(
            "SELECT wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email), wm.role, wm.joined_at, wm.invited_by FROM tangent_workspace_members wm"
        ) and "AND wm.user_id = %s" in normalized:
            workspace_id, user_id = params[0], params[1]
            workspace_member = _find_workspace_member(self.database, workspace_id, user_id)
            if workspace_member:
                user = _find_user(self.database, user_id)
                email = (user or {}).get("email", f"{user_id}@example.com")
                display_name = workspace_member.get("display_name") or (user or {}).get("display_name") or email
                self.row = (
                    user_id,
                    email,
                    display_name,
                    workspace_member.get("role", "member"),
                    workspace_member.get("joined_at", "2026-05-06T00:00:00Z"),
                    workspace_member.get("invited_by"),
                )
        elif normalized.startswith(
            "SELECT wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email), wm.role, wm.joined_at, wm.invited_by FROM tangent_workspace_members wm"
        ):
            workspace_id = params[0]
            rows = []
            for workspace_member in self.database.workspace_members:
                if workspace_member["workspace_id"] != workspace_id:
                    continue
                user = _find_user(self.database, workspace_member["user_id"])
                email = (user or {}).get("email", f"{workspace_member['user_id']}@example.com")
                display_name = workspace_member.get("display_name") or (user or {}).get("display_name") or email
                rows.append(
                    (
                        workspace_member["user_id"],
                        email,
                        display_name,
                        workspace_member.get("role", "member"),
                        workspace_member.get("joined_at", "2026-05-06T00:00:00Z"),
                        workspace_member.get("invited_by"),
                    )
                )
            rows.sort(key=lambda row: (_workspace_role_rank(row[3]), row[4]))
            self.rows = rows
        elif normalized.startswith(
            "SELECT wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email), wm.role FROM tangent_workspace_members wm"
        ):
            workspace_id, email = params
            lowered_email = str(email).lower()
            for workspace_member in self.database.workspace_members:
                if workspace_member["workspace_id"] != workspace_id:
                    continue
                user = _find_user(self.database, workspace_member["user_id"])
                user_email = (user or {}).get("email", f"{workspace_member['user_id']}@example.com").lower()
                if user_email != lowered_email:
                    continue
                display_name = workspace_member.get("display_name") or (user or {}).get("display_name") or user_email
                self.row = (
                    workspace_member["user_id"],
                    user_email,
                    display_name,
                    workspace_member.get("role", "member"),
                )
                break
        elif normalized.startswith("UPDATE tangent_workspace_members SET role = %s"):
            role, workspace_id, user_id = params
            workspace_member = _find_workspace_member(self.database, workspace_id, user_id)
            if workspace_member:
                workspace_member["role"] = role
        elif normalized.startswith("DELETE FROM tangent_board_members"):
            self.database.board_members.pop((params[0], params[1], params[2]), None)
        elif normalized.startswith("INSERT INTO tangent_board_share_links"):
            self.database.board_share_links.append(
                {
                    "id": params[0],
                    "workspace_id": params[1],
                    "board_id": params[2],
                    "share_id": params[3],
                    "access_role": params[4],
                    "created_by": params[5],
                    "expires_at": params[6],
                    "created_at": f"2026-05-05T02:00:{len(self.database.board_share_links):02d}Z",
                    "revoked_at": None,
                }
            )
            self.rowcount = 1
        elif normalized.startswith(
            "SELECT id, workspace_id, board_id, share_id, access_role, created_by, expires_at, created_at FROM tangent_board_share_links"
        ):
            workspace_id, board_id = params
            matches = [
                row for row in self.database.board_share_links
                if (
                    row["workspace_id"] == workspace_id
                    and row["board_id"] == board_id
                    and row["revoked_at"] is None
                    and _share_link_is_active(row)
                )
            ]
            matches.sort(key=lambda row: row["created_at"], reverse=True)
            if matches:
                row = matches[0]
                self.row = (
                    row["id"],
                    row["workspace_id"],
                    row["board_id"],
                    row["share_id"],
                    row["access_role"],
                    row["created_by"],
                    row["expires_at"],
                    row["created_at"],
                )
        elif normalized.startswith("UPDATE tangent_board_share_links SET access_role = %s, expires_at = %s WHERE id = %s"):
            access_role, expires_at, share_link_id = params
            for row in self.database.board_share_links:
                if row["id"] == share_link_id:
                    row["access_role"] = access_role
                    row["expires_at"] = expires_at
                    self.rowcount = 1
                    break
        elif normalized.startswith("UPDATE tangent_board_share_links SET access_role = %s WHERE id = %s"):
            access_role, share_link_id = params
            for row in self.database.board_share_links:
                if row["id"] == share_link_id:
                    row["access_role"] = access_role
                    self.rowcount = 1
                    break
        elif normalized.startswith("UPDATE tangent_board_share_links SET revoked_at = NOW()"):
            workspace_id, board_id, share_id = params
            updated = 0
            for row in self.database.board_share_links:
                if (
                    row["workspace_id"] == workspace_id
                    and row["board_id"] == board_id
                    and row["share_id"] == share_id
                    and row["revoked_at"] is None
                ):
                    row["revoked_at"] = "2026-05-05T03:00:00Z"
                    updated += 1
            self.rowcount = updated
        elif normalized.startswith(
            "SELECT sl.share_id, sl.workspace_id, sl.board_id, b.title, sl.access_role FROM tangent_board_share_links sl"
        ):
            share_id = params[0]
            matches = [
                row for row in self.database.board_share_links
                if (
                    row["share_id"] == share_id
                    and row["revoked_at"] is None
                    and _share_link_is_active(row)
                )
            ]
            matches.sort(key=lambda row: row["created_at"], reverse=True)
            if matches:
                row = matches[0]
                board = self.database.boards.get((row["workspace_id"], row["board_id"]))
                title = board[3] if board else row["board_id"]
                self.row = (
                    row["share_id"],
                    row["workspace_id"],
                    row["board_id"],
                    title,
                    row["access_role"],
                )
        elif normalized.startswith("SELECT id, workspace_id, board_id, created_by") and "AND id = %s" in normalized:
            self.row = self.database.snapshots.get((params[0], params[1], params[2]))
        elif normalized.startswith("SELECT id, workspace_id, board_id, created_by"):
            workspace_id, board_id = params
            self.rows = [
                row for (workspace, board, _snapshot_id), row in self.database.snapshots.items()
                if workspace == workspace_id and board == board_id
            ]
            self.rows.sort(key=lambda row: row[14], reverse=True)
        elif normalized.startswith("DELETE FROM tangent_board_snapshots WHERE workspace_id = %s AND board_id = %s") and len(params) == 2:
            workspace_id, board_id = params
            before = len(self.database.snapshots)
            self.database.snapshots = {
                key: row for key, row in self.database.snapshots.items()
                if key[0] != workspace_id or key[1] != board_id
            }
            self.rowcount = before - len(self.database.snapshots)
        elif normalized.startswith("DELETE FROM tangent_board_snapshots"):
            workspace_id, board_id = params[0], params[1]
            limit = params[4] if len(params) > 4 else 10
            rows = [
                row for key, row in self.database.snapshots.items()
                if key[0] == workspace_id and key[1] == board_id
            ]
            buckets = {
                "autosave": [row for row in rows if row[11] in {"autosave", "auto_interval"}],
                "user": [row for row in rows if row[11] not in {"autosave", "auto_interval"}],
            }
            for bucket_rows in buckets.values():
                bucket_rows.sort(key=lambda row: row[14], reverse=True)
                for row in bucket_rows[limit:]:
                    self.database.snapshots.pop((row[1], row[2], row[0]), None)
        elif normalized.startswith("INSERT INTO tangent_assets"):
            key = (params[1], params[0])
            self.database.assets[key] = params
        elif normalized.startswith("INSERT INTO tangent_credit_accounts"):
            if len(params) == 2:
                account_id, owner_id = params
                if "VALUES (%s, 'workspace', %s, 'team_wallet', 'active')" in normalized:
                    owner_type = "workspace"
                    account_kind = "team_wallet"
                else:
                    owner_type = "user"
                    account_kind = "personal_wallet"
            elif len(params) == 4:
                account_id, owner_type, owner_id, account_kind = params
            else:
                account_id, owner_type, owner_id = params
                account_kind = "team_wallet" if owner_type == "workspace" else "personal_wallet"
            existing = next(
                (
                    row for row in self.database.credit_accounts
                    if row["owner_type"] == owner_type and row["owner_id"] == owner_id
                ),
                None,
            )
            if existing:
                existing["id"] = existing.get("id", account_id)
                existing["status"] = "active"
                existing["account_kind"] = account_kind
                self.row = (existing["id"],)
            else:
                self.database.credit_accounts.append(
                    {
                        "account_kind": account_kind,
                        "id": account_id,
                        "owner_id": owner_id,
                        "owner_type": owner_type,
                        "status": "active",
                    }
                )
                self.row = (account_id,)
        elif normalized.startswith("SELECT id, workspace_id FROM tangent_assets WHERE id = ANY"):
            asset_ids, workspace_id = params
            asset_id_set = set(asset_ids)
            for asset_workspace_id, asset_id in self.database.assets:
                if asset_id in asset_id_set and asset_workspace_id != workspace_id:
                    self.row = (asset_id, asset_workspace_id)
                    break
        elif normalized.startswith("SELECT id, workspace_id, user_id, plan_key, status, included_credits"):
            workspace_id = params[0]
            rows = [
                _seat_assignment_tuple(row)
                for row in self.database.workspace_seat_assignments
                if row["workspace_id"] == workspace_id and row.get("status", "active") != "revoked"
            ]
            rows.sort(key=lambda row: row[0], reverse=True)
            self.rows = rows
        elif normalized.startswith("SELECT COUNT(*) FROM tangent_workspace_seat_assignments"):
            workspace_id = params[0]
            if len(params) == 2:
                user_id = params[1]
                self.row = (
                    sum(
                        1
                        for row in self.database.workspace_seat_assignments
                        if (
                            row["workspace_id"] == workspace_id
                            and row.get("status", "active") == "active"
                            and row["user_id"] != user_id
                        )
                    ),
                )
                return
            plan_key, user_id = params[1], params[2]
            self.row = (
                sum(
                    1
                    for row in self.database.workspace_seat_assignments
                    if (
                        row["workspace_id"] == workspace_id
                        and row["plan_key"] == plan_key
                        and row.get("status", "active") == "active"
                        and row["user_id"] != user_id
                    )
                ),
            )
        elif normalized.startswith("SELECT id, plan_key, included_credits FROM tangent_workspace_seat_assignments"):
            workspace_id, user_id = params
            matches = [
                row for row in self.database.workspace_seat_assignments
                if (
                    row["workspace_id"] == workspace_id
                    and row["user_id"] == user_id
                    and row.get("status", "active") == "active"
                )
            ]
            if matches:
                matches.sort(key=lambda row: row.get("updated_at", ""), reverse=True)
                row = matches[0]
                self.row = (row["id"], row["plan_key"], row.get("included_credits", 0))
        elif normalized.startswith("SELECT 1 FROM tangent_workspace_members"):
            workspace_id, user_id = params
            member = _find_workspace_member(self.database, workspace_id, user_id)
            if member and member.get("role") in {"admin", "editor", "guest", "member", "owner", "viewer"}:
                self.row = (1,)
        elif normalized.startswith("SELECT role FROM tangent_workspace_members"):
            workspace_id, user_id = params
            member = _find_workspace_member(self.database, workspace_id, user_id)
            if member:
                self.row = (member.get("role"),)
        elif normalized.startswith("INSERT INTO tangent_workspace_seat_assignments"):
            if len(params) == 6:
                seat_id, workspace_id, user_id, plan_key, included_credits, assigned_by = params
                current_period_start = None
                current_period_end = None
                should_return = False
            else:
                (
                    seat_id,
                    workspace_id,
                    user_id,
                    plan_key,
                    included_credits,
                    current_period_start,
                    current_period_end,
                    assigned_by,
                ) = params
                should_return = True
            existing = next(
                (
                    row for row in self.database.workspace_seat_assignments
                    if (
                        row["workspace_id"] == workspace_id
                        and row["user_id"] == user_id
                        and row["plan_key"] == plan_key
                    )
                ),
                None,
            )
            next_row = {
                "assigned_by": assigned_by,
                "current_period_end": current_period_end,
                "current_period_start": current_period_start,
                "id": existing["id"] if existing else seat_id,
                "included_credits": included_credits,
                "plan_key": plan_key,
                "status": "active",
                "updated_at": f"2026-05-06T00:30:{len(self.database.workspace_seat_assignments):02d}Z",
                "user_id": user_id,
                "workspace_id": workspace_id,
            }
            if existing:
                existing.update(next_row)
                if should_return:
                    self.row = _seat_assignment_tuple(existing)
            else:
                self.database.workspace_seat_assignments.append(next_row)
                if should_return:
                    self.row = _seat_assignment_tuple(next_row)
        elif normalized.startswith("UPDATE tangent_workspace_seat_assignments SET status = 'revoked'"):
            workspace_id, user_id = params[0], params[1]
            excluded_plan_key = params[2] if len(params) > 2 else None
            for row in self.database.workspace_seat_assignments:
                if (
                    row["workspace_id"] == workspace_id
                    and row["user_id"] == user_id
                    and row.get("status") != "revoked"
                    and (excluded_plan_key is None or row["plan_key"] != excluded_plan_key)
                ):
                    row["status"] = "revoked"
                    self.rowcount += 1
        elif normalized.startswith("DELETE FROM tangent_workspace_members"):
            workspace_id, user_id = params
            before = len(self.database.workspace_members)
            self.database.workspace_members = [
                row for row in self.database.workspace_members
                if row["workspace_id"] != workspace_id or row["user_id"] != user_id
            ]
            self.rowcount = before - len(self.database.workspace_members)
        elif normalized.startswith("SELECT amount_cents, metadata FROM tangent_payments"):
            account_id = params[0]
            rows = [
                (row["amount_cents"], row.get("metadata", {}))
                for row in self.database.payments
                if (
                    row["account_id"] == account_id
                    and row.get("kind") == "seat_purchase"
                    and row.get("status") == "succeeded"
                )
            ]
            self.rows = rows
        elif normalized.startswith("SELECT COALESCE(kind, 'solo_workspace') FROM tangent_workspaces"):
            workspace_id = params[0]
            row = next((row for row in self.database.workspaces if row["id"] == workspace_id), None)
            if row:
                self.row = (row.get("kind", "solo_workspace"),)
        elif normalized.startswith("SELECT plan_key, seat_capacity FROM tangent_subscriptions"):
            workspace_id = params[0]
            matches = [
                row for row in self.database.subscriptions
                if (
                    row.get("owner_type") == "workspace"
                    and row.get("owner_id") == workspace_id
                    and row.get("plan_family") == "team"
                    and row.get("status", "active") in {"active", "trialing"}
                )
            ]
            matches.sort(key=lambda row: row.get("updated_at", ""), reverse=True)
            if matches:
                row = matches[0]
                self.row = (row.get("plan_key"), row.get("seat_capacity", 0))
        elif normalized.startswith("SELECT ca.id, s.plan_key FROM tangent_credit_accounts ca JOIN tangent_subscriptions s"):
            owner_type, owner_id = params
            accounts = [
                row for row in self.database.credit_accounts
                if (
                    row["owner_type"] == owner_type
                    and row["owner_id"] == owner_id
                    and row.get("status", "active") == "active"
                )
            ]
            account_ids = {row["id"] for row in accounts}
            matches = [
                row for row in self.database.subscriptions
                if row["account_id"] in account_ids and row.get("status", "active") in {"active", "trialing"}
            ]
            if matches:
                matches.sort(key=lambda row: row.get("updated_at", ""), reverse=True)
                self.row = (matches[0]["account_id"], matches[0]["plan_key"])
        elif normalized.startswith("SELECT id, workspace_id, email, role, invited_by, accepted_by, expires_at, accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata FROM tangent_workspace_invitations WHERE token_hash = %s"):
            token_hash = params[0]
            row = next(
                (
                    row for row in self.database.workspace_invitations
                    if (
                        row.get("token_hash") == token_hash
                        and row.get("accepted_at") is None
                        and row.get("revoked_at") is None
                        and _invite_is_active(row)
                    )
                ),
                None,
            )
            if row:
                self.row = _workspace_invitation_tuple(row)
        elif normalized.startswith("SELECT id, workspace_id, email, role, invited_by, accepted_by, expires_at, accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata FROM tangent_workspace_invitations WHERE workspace_id = %s"):
            workspace_id = params[0]
            rows = [
                _workspace_invitation_tuple(row)
                for row in self.database.workspace_invitations
                if row["workspace_id"] == workspace_id
            ]
            rows.sort(key=lambda row: row[9], reverse=True)
            self.rows = rows
        elif normalized.startswith("SELECT id FROM tangent_subscriptions"):
            account_id = params[0]
            matches = [
                row for row in self.database.subscriptions
                if row["account_id"] == account_id and row.get("status", "active") in {"active", "trialing"}
            ]
            matches.sort(key=lambda row: row.get("updated_at", ""), reverse=True)
            if matches:
                self.row = (matches[0]["id"],)
        elif normalized.startswith("SELECT id FROM tangent_credit_accounts WHERE owner_type = %s"):
            owner_type, owner_id = params[0], params[1]
            account_kind = params[2] if len(params) > 2 else None
            row = next(
                (
                    row for row in self.database.credit_accounts
                    if (
                        row["owner_type"] == owner_type
                        and row["owner_id"] == owner_id
                        and (account_kind is None or row.get("account_kind") in {account_kind, None})
                        and row.get("status", "active") == "active"
                    )
                ),
                None,
            )
            if row:
                self.row = (row["id"],)
        elif normalized.startswith("SELECT id, account_id, provider, provider_payment_id, amount_cents, currency, status, created_at, checkout_session_id, kind, metadata FROM tangent_payments WHERE id = %s"):
            payment = next((row for row in self.database.payments if row["id"] == params[0]), None)
            if payment:
                self.row = _payment_tuple(payment)
        elif normalized.startswith("SELECT id, account_id, provider, provider_payment_id, amount_cents, currency, status, created_at, checkout_session_id, kind, metadata FROM tangent_payments WHERE account_id = %s"):
            account_id, limit = params
            rows = [_payment_tuple(row) for row in self.database.payments if row["account_id"] == account_id]
            rows.sort(key=lambda row: row[7], reverse=True)
            self.rows = rows[:limit]
        elif normalized.startswith("UPDATE tangent_payments SET status = 'succeeded'"):
            provider_payment_id, payment_id = params
            payment = next((row for row in self.database.payments if row["id"] == payment_id), None)
            if payment:
                payment["status"] = "succeeded"
                payment["provider_payment_id"] = provider_payment_id
                self.row = _payment_tuple(payment)
        elif normalized.startswith("UPDATE tangent_payments SET account_id = %s"):
            account_id, metadata, payment_id = params
            payment = next((row for row in self.database.payments if row["id"] == payment_id), None)
            if payment:
                payment["account_id"] = account_id
                payment["metadata"] = json.loads(metadata) if isinstance(metadata, str) else metadata
                self.row = _payment_tuple(payment)
        elif normalized.startswith("UPDATE tangent_workspace_invitations SET accepted_by = %s"):
            accepted_by, invitation_id = params
            row = next((row for row in self.database.workspace_invitations if row["id"] == invitation_id), None)
            if row:
                row["accepted_by"] = accepted_by
                row["accepted_at"] = "2026-05-08T00:25:00Z"
                self.row = _workspace_invitation_tuple(row)
        elif normalized.startswith("UPDATE tangent_workspace_invitations SET revoked_at = NOW()"):
            invitation_id, workspace_id = params
            row = next(
                (
                    row for row in self.database.workspace_invitations
                    if (
                        row["id"] == invitation_id
                        and row["workspace_id"] == workspace_id
                        and row.get("accepted_at") is None
                        and row.get("revoked_at") is None
                    )
                ),
                None,
            )
            if row:
                row["revoked_at"] = "2026-05-08T00:26:00Z"
                self.row = _workspace_invitation_tuple(row)
        elif normalized.startswith("INSERT INTO tangent_subscriptions"):
            if len(params) == 9:
                row = {
                    "account_id": params[1],
                    "current_period_end": params[8],
                    "current_period_start": "2026-05-06T00:50:00Z",
                    "id": params[0],
                    "owner_id": params[2],
                    "owner_type": "workspace",
                    "plan_family": "team",
                    "plan_key": params[6],
                    "provider": params[4],
                    "provider_subscription_id": params[5],
                    "seat_capacity": params[7],
                    "status": "active",
                    "updated_at": "2026-05-06T00:50:00Z",
                    "workspace_id": params[3],
                }
            elif len(params) == 7:
                row = {
                    "account_id": params[1],
                    "current_period_end": params[6],
                    "current_period_start": "2026-05-06T00:50:00Z",
                    "id": params[0],
                    "owner_id": params[2],
                    "owner_type": "user",
                    "plan_family": "collaborate",
                    "plan_key": params[5],
                    "provider": params[3],
                    "provider_subscription_id": params[4],
                    "seat_capacity": 1,
                    "status": "active",
                    "updated_at": "2026-05-06T00:50:00Z",
                    "workspace_id": None,
                }
            else:
                row = {
                    "account_id": params[1],
                    "current_period_end": params[5] if len(params) == 6 else params[6],
                    "id": params[0],
                    "plan_key": params[4] if len(params) == 6 else params[4],
                    "provider": params[2],
                    "provider_subscription_id": params[3],
                    "status": "active" if len(params) == 6 else params[5],
                    "updated_at": "2026-05-06T00:50:00Z",
                }
            self.database.subscriptions.append(row)
        elif normalized.startswith("UPDATE tangent_subscriptions SET plan_key = %s"):
            if len(params) == 8:
                plan_key, owner_id, workspace_id, provider, provider_subscription_id, seat_capacity, current_period_end, subscription_id = params
            elif len(params) == 6:
                plan_key, owner_id, provider, provider_subscription_id, current_period_end, subscription_id = params
                workspace_id = None
                seat_capacity = 1
            else:
                plan_key, provider, provider_subscription_id, current_period_end, subscription_id = params
                owner_id = None
                workspace_id = None
                seat_capacity = None
            row = next((value for value in self.database.subscriptions if value["id"] == subscription_id), None)
            if row:
                row["plan_key"] = plan_key
                if owner_id is not None:
                    row["owner_id"] = owner_id
                    row["owner_type"] = "workspace" if workspace_id is not None else "user"
                    row["plan_family"] = "team" if workspace_id is not None else "collaborate"
                    row["workspace_id"] = workspace_id
                    row["seat_capacity"] = max(int(row.get("seat_capacity") or 0), int(seat_capacity or 0))
                row["provider"] = provider
                row["provider_subscription_id"] = provider_subscription_id
                row["status"] = "active"
                row["current_period_end"] = current_period_end
                row["updated_at"] = "2026-05-06T00:51:00Z"
        elif normalized.startswith("SELECT COALESCE(SUM(credits_delta), 0) FROM tangent_credit_ledger"):
            account_id = params[0]
            self.row = (
                sum(float(row.get("credits_delta", 0)) for row in self.database.credit_ledger if row["account_id"] == account_id),
            )
        elif normalized.startswith("SELECT reason, COALESCE(SUM(credits_delta), 0) FROM tangent_credit_ledger"):
            account_id = params[0]
            totals = {}
            for row in self.database.credit_ledger:
                if row["account_id"] != account_id:
                    continue
                totals.setdefault(row["reason"], 0.0)
                totals[row["reason"]] += float(row.get("credits_delta", 0))
            self.rows = [(reason, value) for reason, value in totals.items()]
        elif normalized.startswith("SELECT actor_user_id, COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0) FROM tangent_credit_ledger"):
            workspace_id = params[0]
            totals = {}
            for row in self.database.credit_ledger:
                if row.get("workspace_id") != workspace_id or not row.get("actor_user_id"):
                    continue
                totals.setdefault(row["actor_user_id"], 0.0)
                delta = float(row.get("credits_delta", 0))
                if delta < 0:
                    totals[row["actor_user_id"]] += -delta
            self.rows = [(user_id, value) for user_id, value in totals.items()]
        elif normalized.startswith("SELECT id, account_id, workspace_id, actor_user_id, source_type, source_id"):
            filters = {
                "account_id": params[0],
                "actor_user_id": None,
                "reason": None,
                "source_id": None,
                "source_type": None,
                "workspace_id": None,
            }
            param_index = 1
            if "actor_user_id = %s" in normalized:
                filters["actor_user_id"] = params[param_index]
                param_index += 1
            if "reason = %s" in normalized:
                filters["reason"] = params[param_index]
                param_index += 1
            if "source_id = %s" in normalized:
                filters["source_id"] = params[param_index]
                param_index += 1
            if "source_type = %s" in normalized:
                filters["source_type"] = params[param_index]
                param_index += 1
            if "workspace_id = %s" in normalized:
                filters["workspace_id"] = params[param_index]
                param_index += 1
            limit = params[param_index]
            rows = []
            for row in self.database.credit_ledger:
                if row["account_id"] != filters["account_id"]:
                    continue
                if filters["actor_user_id"] and row.get("actor_user_id") != filters["actor_user_id"]:
                    continue
                if filters["reason"] and row.get("reason") != filters["reason"]:
                    continue
                if filters["source_id"] and row.get("source_id") != filters["source_id"]:
                    continue
                if filters["source_type"] and row.get("source_type") != filters["source_type"]:
                    continue
                if filters["workspace_id"] and row.get("workspace_id") != filters["workspace_id"]:
                    continue
                rows.append(_credit_ledger_tuple(row))
            rows.sort(key=lambda row: row[9], reverse=True)
            self.rows = rows[:limit]
        elif normalized.startswith("SELECT role, permissions, note, granted_by, created_at FROM tangent_admin_roles"):
            user_id = params[0]
            rows = [
                (row["role"], row["permissions"], row["note"], row["granted_by"], row["created_at"])
                for row in self.database.admin_roles
                if row["user_id"] == user_id and row["revoked_at"] is None
            ]
            rows.sort(key=lambda row: row[4])
            self.rows = rows
        elif normalized.startswith("SELECT COUNT(*) FROM tangent_admin_roles WHERE role = %s AND revoked_at IS NULL"):
            role = params[0]
            self.row = (sum(1 for row in self.database.admin_roles if row["role"] == role and row["revoked_at"] is None),)
        elif normalized.startswith("SELECT COUNT(*) FROM tangent_users WHERE status <> 'deleted'"):
            self.row = (sum(1 for row in self.database.users if row.get("status") != "deleted"),)
        elif normalized.startswith("SELECT COUNT(*) FROM tangent_workspaces WHERE status <> 'deleted'"):
            self.row = (sum(1 for row in self.database.workspaces if row.get("status") != "deleted"),)
        elif normalized.startswith("SELECT COUNT(*) FROM tangent_boards WHERE deleted_at IS NULL"):
            self.row = (len(self.database.boards),)
        elif normalized.startswith("SELECT COUNT(DISTINCT user_id) FROM tangent_admin_roles WHERE revoked_at IS NULL"):
            self.row = (len({row["user_id"] for row in self.database.admin_roles if row["revoked_at"] is None}),)
        elif normalized.startswith("SELECT 1 FROM tangent_users WHERE id = %s"):
            user_id = params[0]
            self.row = (1,) if any(row["id"] == user_id for row in self.database.users) else None
        elif normalized.startswith("SELECT id, email, display_name, status, locale, created_at, last_login_at FROM tangent_users"):
            limit = params[0]
            rows = [
                (
                    row["id"],
                    row["email"],
                    row.get("display_name"),
                    row.get("status", "active"),
                    row.get("locale", "en"),
                    row["created_at"],
                    row.get("last_login_at"),
                )
                for row in self.database.users
            ]
            rows.sort(key=lambda row: row[5], reverse=True)
            self.rows = rows[:limit]
        elif normalized.startswith("SELECT id, name, owner_id, status, created_at"):
            limit = params[0]
            rows = [
                (
                    row["id"],
                    row.get("name"),
                    row.get("owner_id"),
                    row.get("status", "active"),
                    row.get("created_at"),
                    row.get("kind", "solo_workspace"),
                )
                for row in self.database.workspaces
                if row.get("status") != "deleted"
            ]
            rows.sort(key=lambda row: row[4] or "", reverse=True)
            self.rows = rows[:limit]
        elif normalized.startswith(
            "SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint, estimated_latency, enabled, is_default, provider_key, default_tier_key, default_pricing_rule_id FROM tangent_model_registry"
        ):
            model_key = params[0]
            row = next((value for value in self.database.model_registry if value["model_key"] == model_key), None)
            if row:
                self.row = (
                    row["model_key"],
                    row["display_name"],
                    row.get("capability", "image_generation"),
                    row.get("capabilities", []),
                    row.get("parameter_schema", {}),
                    row.get("cost_hint", ""),
                    row.get("estimated_latency", ""),
                    row.get("enabled", True),
                    row.get("is_default", False),
                    row.get("provider_key"),
                    row.get("default_tier_key"),
                    row.get("default_pricing_rule_id"),
                )
        elif normalized.startswith(
            "SELECT id, model_key, provider_key, provider_model, route_key, priority, weight, health_status, timeout_ms, retry_policy, enabled FROM tangent_model_provider_routes"
        ):
            route_id = params[0]
            row = next((value for value in self.database.model_provider_routes if value["id"] == route_id), None)
            if row:
                self.row = (
                    row["id"],
                    row["model_key"],
                    row.get("provider_key", row.get("provider")),
                    row.get("provider_model", row.get("model_key")),
                    row.get("route_key", row["id"]),
                    row.get("priority", 100),
                    row.get("weight", 100),
                    row.get("health_status", "unknown"),
                    row.get("timeout_ms", 60000),
                    row.get("retry_policy", {}),
                    row.get("enabled", True),
                )
        elif normalized.startswith(
            "SELECT id, model_key, tier_key, billing_unit, estimated_credits, min_credits, credit_multiplier, provider_cost_formula, status, effective_from, effective_to FROM tangent_model_pricing_rules"
        ):
            rule_id = params[0]
            row = next((value for value in self.database.model_pricing_rules if value["id"] == rule_id), None)
            if row:
                self.row = (
                    row["id"],
                    row["model_key"],
                    row.get("tier_key"),
                    row.get("billing_unit", "per_image"),
                    row.get("estimated_credits", 0),
                    row.get("min_credits", 0),
                    row.get("credit_multiplier", 1),
                    row.get("provider_cost_formula", {}),
                    row.get("status", "draft"),
                    row.get("effective_from", "2026-05-06T00:00:00Z"),
                    row.get("effective_to"),
                )
        elif normalized.startswith(
            "SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint, estimated_latency, enabled, is_default, provider_key, default_tier_key, default_pricing_rule_id, created_at, updated_at FROM tangent_model_registry"
        ):
            rows = [
                (
                    row["model_key"],
                    row["display_name"],
                    row.get("capability", "image_generation"),
                    row.get("capabilities", []),
                    row.get("parameter_schema", {}),
                    row.get("cost_hint", ""),
                    row.get("estimated_latency", ""),
                    row.get("enabled", True),
                    row.get("is_default", False),
                    row.get("provider_key"),
                    row.get("default_tier_key"),
                    row.get("default_pricing_rule_id"),
                    row.get("created_at", "2026-05-06T00:00:00Z"),
                    row.get("updated_at", row.get("created_at", "2026-05-06T00:00:00Z")),
                )
                for row in self.database.model_registry
            ]
            rows.sort(key=lambda row: (str(row[13]), str(row[0])), reverse=True)
            self.rows = rows
        elif normalized.startswith("SELECT id, workspace_id, owner_id, title, visibility, saved_at FROM tangent_boards"):
            limit = params[0]
            rows = []
            for row in self.database.boards.values():
                rows.append(
                    (
                        row[0],
                        row[1],
                        row[2] if len(row) > 2 else None,
                        row[3] if len(row) > 3 else row[0],
                        row[16] if len(row) > 16 else "private",
                        row[12] if len(row) > 12 else "1970-01-01T00:00:00Z",
                    )
                )
            rows.sort(key=lambda row: row[5], reverse=True)
            self.rows = rows[:limit]
        elif normalized.startswith(
            "SELECT id, actor_user_id, target_user_id, workspace_id, action, metadata, created_at FROM tangent_admin_audit_logs"
        ):
            filters = {
                "action": None,
                "actor_user_id": None,
                "target_user_id": None,
            }
            param_index = 0
            if "action = %s" in normalized:
                filters["action"] = params[param_index]
                param_index += 1
            if "actor_user_id = %s" in normalized:
                filters["actor_user_id"] = params[param_index]
                param_index += 1
            if "target_user_id = %s" in normalized:
                filters["target_user_id"] = params[param_index]
                param_index += 1
            limit = params[param_index]
            rows = []
            for row in self.database.admin_audit_logs:
                if filters["action"] and row.get("action") != filters["action"]:
                    continue
                if filters["actor_user_id"] and row.get("actor_user_id") != filters["actor_user_id"]:
                    continue
                if filters["target_user_id"] and row.get("target_user_id") != filters["target_user_id"]:
                    continue
                rows.append(
                    (
                        row.get("id"),
                        row.get("actor_user_id"),
                        row.get("target_user_id"),
                        row.get("workspace_id"),
                        row.get("action"),
                        row.get("metadata", {}),
                        row.get("created_at", "1970-01-01T00:00:00Z"),
                    )
                )
            rows.sort(key=lambda row: row[6], reverse=True)
            self.rows = rows[:limit]
        elif normalized.startswith("UPDATE tangent_admin_roles SET revoked_at = NOW()"):
            user_id, role = params
            for row in self.database.admin_roles:
                if row["user_id"] == user_id and row["role"] == role and row["revoked_at"] is None:
                    row["revoked_at"] = "2026-05-05T01:00:00Z"
        elif normalized.startswith("SELECT id, workspace_id, created_by"):
            self.row = self.database.assets.get((params[0], params[1]))

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class FakePostgresConnection:
    def __init__(self, database):
        self.database = database
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return FakePostgresCursor(self.database)

    def commit(self):
        self.commits += 1


class FakePostgresDatabase:
    def __init__(self):
        self.admin_audit_logs = []
        self.admin_roles = []
        self.ai_control_plane_versions = []
        self.ai_api_calls = []
        self.api_cost_ledger = []
        self.ai_runs = {}
        self.assets = {}
        self.board_members = {}
        self.board_share_links = []
        self.boards = {}
        self.credit_accounts = []
        self.credit_ledger = []
        self.model_parameter_tiers = []
        self.model_pricing_rules = []
        self.model_provider_routes = []
        self.model_registry = []
        self.payments = []
        self.snapshots = {}
        self.subscriptions = []
        self.users = []
        self.workspaces = []
        self.workspace_invitations = []
        self.workspace_members = []
        self.workspace_seat_assignments = []

    def connect(self):
        return FakePostgresConnection(self)


def _find_user(database, user_id):
    return next((row for row in database.users if row["id"] == user_id), None)


def _find_workspace_member(database, workspace_id, user_id):
    return next(
        (
            row for row in database.workspace_members
            if row["workspace_id"] == workspace_id and row["user_id"] == user_id
        ),
        None,
    )


def _workspace_role_rank(role):
    if role == "owner":
        return 0
    if role == "admin":
        return 1
    if role == "member":
        return 2
    return 3


def _share_link_is_active(row):
    expires_at = row.get("expires_at")
    if not expires_at:
        return True
    if hasattr(expires_at, "isoformat"):
        parsed = expires_at
    else:
        try:
            parsed = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        except ValueError:
            return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed > datetime.now(timezone.utc)


def _invite_is_active(row):
    expires_at = row.get("expires_at")
    if not expires_at:
        return True
    if hasattr(expires_at, "isoformat"):
        parsed = expires_at
    else:
        try:
            parsed = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        except ValueError:
            return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed > datetime.now(timezone.utc)


def _seat_assignment_tuple(row):
    return (
        row["id"],
        row["workspace_id"],
        row["user_id"],
        row["plan_key"],
        row.get("status", "active"),
        row.get("included_credits", 0),
        row.get("current_period_start"),
        row.get("current_period_end"),
        row.get("assigned_by"),
    )


def _credit_ledger_tuple(row):
    return (
        row["id"],
        row["account_id"],
        row.get("workspace_id"),
        row.get("actor_user_id"),
        row["source_type"],
        row.get("source_id"),
        row.get("credits_delta", 0),
        row["reason"],
        row.get("metadata", {}),
        row.get("created_at", "1970-01-01T00:00:00Z"),
    )


def _payment_tuple(row):
    return (
        row["id"],
        row.get("account_id"),
        row.get("provider", "manual_test"),
        row.get("provider_payment_id"),
        row.get("amount_cents", 0),
        row.get("currency", "usd"),
        row.get("status", "pending"),
        row.get("created_at", "1970-01-01T00:00:00Z"),
        row.get("checkout_session_id"),
        row.get("kind", "topup"),
        row.get("metadata", {}),
    )


def _workspace_invitation_tuple(row):
    return (
        row["id"],
        row["workspace_id"],
        row.get("email"),
        row["role"],
        row.get("invited_by"),
        row.get("accepted_by"),
        row.get("expires_at"),
        row.get("accepted_at"),
        row.get("revoked_at"),
        row.get("created_at", "1970-01-01T00:00:00Z"),
        row.get("token_hash"),
        row.get("target_user_id"),
        row.get("metadata", {}),
    )


def _ai_control_plane_version_tuple(row):
    return (
        row["id"],
        row["resource_type"],
        row["resource_id"],
        row["version_number"],
        row["action"],
        row.get("snapshot", {}),
        row.get("note"),
        row.get("actor_user_id"),
        row.get("workspace_id"),
        row.get("published_at"),
        row.get("created_at", "1970-01-01T00:00:00Z"),
    )
