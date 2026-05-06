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
                "error_code": params[16],
                "created_at": params[17],
            }
            existing_index = next((index for index, row in enumerate(self.database.ai_api_calls) if row["id"] == params[0]), None)
            if existing_index is None:
                self.database.ai_api_calls.append(next_row)
            else:
                self.database.ai_api_calls[existing_index] = next_row
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
            "SELECT id, board_id, charged_account_id, charged_scope, cost_credits, workspace_kind, workspace_seat_id, entitlement_source, input_asset_ids, latency_ms, model_id, node_id, output_asset_ids, provider, run_type, status, prompt_preview, created_at, pricing_rule_id, route_id, route_key, estimated_credits, selected_tier_key, preflight_status, params, error_message FROM tangent_ai_runs"
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
        elif normalized.startswith(
            "SELECT id, workspace_id, created_by, board_id, node_id, run_type, model_id, provider, status, input_asset_ids, output_asset_ids, prompt_preview, estimated_credits, cost_credits, charged_account_id, charged_scope, pricing_rule_id, route_id, route_key, selected_tier_key, preflight_status, latency_ms, error_message, created_at, updated_at FROM tangent_ai_runs"
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
                )
                for row in self.database.ai_runs.values()
            ]
            rows.sort(key=lambda row: row[23], reverse=True)
            self.rows = rows
        elif normalized.startswith(
            "SELECT id, workspace_id, user_id, run_id, board_id, node_id, model_id, provider, route_key, route_id, pricing_rule_id, status, latency_ms, credits_charged, credits_refunded, provider_cost, error_code, created_at FROM tangent_ai_api_calls"
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
                    row.get("error_code"),
                    row.get("created_at", "1970-01-01T00:00:00Z"),
                )
                for row in self.database.ai_api_calls
            ]
            rows.sort(key=lambda row: row[17], reverse=True)
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
            account_id, owner_id = params
            existing = next(
                (
                    row for row in self.database.credit_accounts
                    if row["owner_type"] == "user" and row["owner_id"] == owner_id
                ),
                None,
            )
            if existing:
                existing["id"] = existing.get("id", account_id)
                existing["status"] = "active"
                self.row = (existing["id"],)
            else:
                self.database.credit_accounts.append(
                    {
                        "id": account_id,
                        "owner_id": owner_id,
                        "owner_type": "user",
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
            if member and member.get("role") in {"admin", "member", "owner"}:
                self.row = (1,)
        elif normalized.startswith("INSERT INTO tangent_workspace_seat_assignments"):
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
                self.row = _seat_assignment_tuple(existing)
            else:
                self.database.workspace_seat_assignments.append(next_row)
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
        elif normalized.startswith("SELECT id FROM tangent_credit_accounts WHERE owner_type = %s"):
            owner_type, owner_id = params
            row = next(
                (
                    row for row in self.database.credit_accounts
                    if (
                        row["owner_type"] == owner_type
                        and row["owner_id"] == owner_id
                        and row.get("status", "active") == "active"
                    )
                ),
                None,
            )
            if row:
                self.row = (row["id"],)
        elif normalized.startswith("SELECT COALESCE(SUM(credits_delta), 0) FROM tangent_credit_ledger"):
            account_id = params[0]
            self.row = (
                sum(float(row.get("credits_delta", 0)) for row in self.database.credit_ledger if row["account_id"] == account_id),
            )
        elif normalized.startswith("SELECT id, account_id, workspace_id, actor_user_id, source_type, source_id"):
            account_id, limit = params
            rows = [
                _credit_ledger_tuple(row)
                for row in self.database.credit_ledger
                if row["account_id"] == account_id
            ]
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
        self.ai_api_calls = []
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
        self.snapshots = {}
        self.subscriptions = []
        self.users = []
        self.workspaces = []
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
