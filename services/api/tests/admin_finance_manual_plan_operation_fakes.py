class PlanOperationConnection:
    def __init__(self, database):
        self.database = database

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return PlanOperationCursor(self.database)

    def commit(self):
        return None


class PlanOperationCursor:
    def __init__(self, database):
        self.database = database
        self.row = None
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        self.row = None
        self.rows = []
        if normalized.startswith("SELECT 1 FROM tangent_users WHERE id = %s"):
            self.row = (1,) if params[0] in self.database.users else None
        elif normalized.startswith("SELECT kind FROM tangent_workspaces WHERE id = %s LIMIT 1"):
            workspace = self.database.workspaces.get(params[0])
            self.row = (workspace["kind"],) if workspace else None
        elif normalized.startswith("SELECT id, plan_key, status, seat_capacity, current_period_start, current_period_end FROM tangent_subscriptions WHERE id = %s"):
            row = self.database.subscription_by_id(params[0])
            if row and row["account_id"] == params[1] and row["plan_family"] == params[2]:
                self.row = subscription_context_tuple(row)
        elif normalized.startswith("SELECT id, plan_key, status, seat_capacity, current_period_start, current_period_end FROM tangent_subscriptions WHERE account_id = %s"):
            row = self.database.current_subscription(params[0], params[1])
            if row:
                self.row = subscription_context_tuple(row)
        elif normalized.startswith("UPDATE tangent_subscriptions SET plan_key = %s, provider = 'admin_manual'"):
            plan_key, provider_subscription_id, status, seat_capacity, period_start, period_end, subscription_id = params
            row = self.database.subscription_by_id(subscription_id)
            row["plan_key"] = plan_key
            row["provider_subscription_id"] = provider_subscription_id
            row["status"] = status
            row["seat_capacity"] = seat_capacity
            row["current_period_start"] = period_start
            row["current_period_end"] = period_end
            row["paused_at"] = None
            row["paused_by"] = None
            row["pause_reason"] = None
        elif normalized.startswith("INSERT INTO tangent_subscriptions ("):
            self.database.subscriptions.append(
                {
                    "account_id": params[1],
                    "current_period_end": params[11],
                    "current_period_start": params[10],
                    "id": params[0],
                    "owner_id": params[3],
                    "owner_type": params[2],
                    "pause_reason": None,
                    "paused_at": None,
                    "paused_by": None,
                    "plan_family": params[5],
                    "plan_key": params[7],
                    "seat_capacity": params[9],
                    "status": params[8],
                    "workspace_id": params[4],
                }
            )
        elif normalized.startswith("SELECT user_id FROM tangent_workspace_members WHERE workspace_id = %s"):
            workspace_id, limit = params
            role_rank = {"owner": 0, "admin": 1, "editor": 2, "viewer": 3, "member": 4, "guest": 5}
            rows = [
                row for row in self.database.workspace_members
                if row["workspace_id"] == workspace_id
                and row["role"] in {"owner", "admin", "editor", "viewer", "member", "guest"}
            ]
            rows.sort(key=lambda row: (role_rank.get(row["role"], 5), row["user_id"]))
            self.rows = [(row["user_id"],) for row in rows[:limit]]
        elif normalized.startswith("UPDATE tangent_workspace_seat_assignments SET status = 'revoked', updated_at = NOW() WHERE workspace_id = %s AND user_id = %s AND plan_key <> %s"):
            workspace_id, user_id, plan_key = params
            for row in self.database.workspace_seat_assignments:
                if row["workspace_id"] == workspace_id and row["user_id"] == user_id and row["plan_key"] != plan_key and row["status"] != "revoked":
                    row["status"] = "revoked"
        elif normalized.startswith("INSERT INTO tangent_workspace_seat_assignments"):
            seat_id, workspace_id, user_id, plan_key, included_credits, period_start, period_end, assigned_by = params
            existing = next((
                row for row in self.database.workspace_seat_assignments
                if row["workspace_id"] == workspace_id and row["user_id"] == user_id and row["plan_key"] == plan_key
            ), None)
            if existing:
                existing.update({
                    "assigned_by": assigned_by,
                    "current_period_end": period_end,
                    "current_period_start": period_start,
                    "included_credits": included_credits,
                    "status": "active",
                })
            else:
                self.database.workspace_seat_assignments.append({
                    "assigned_by": assigned_by,
                    "current_period_end": period_end,
                    "current_period_start": period_start,
                    "id": seat_id,
                    "included_credits": included_credits,
                    "plan_key": plan_key,
                    "status": "active",
                    "user_id": user_id,
                    "workspace_id": workspace_id,
                })
        elif normalized.startswith("UPDATE tangent_workspace_seat_assignments SET status = 'revoked', updated_at = NOW() WHERE workspace_id = %s AND status <> 'revoked' AND NOT"):
            workspace_id, assigned_user_ids = params
            assigned = set(assigned_user_ids)
            for row in self.database.workspace_seat_assignments:
                if row["workspace_id"] == workspace_id and row["status"] != "revoked" and row["user_id"] not in assigned:
                    row["status"] = "revoked"
        elif normalized.startswith("UPDATE tangent_workspace_seat_assignments SET status = 'revoked', updated_at = NOW() WHERE workspace_id = %s AND status <> 'revoked'"):
            workspace_id = params[0]
            for row in self.database.workspace_seat_assignments:
                if row["workspace_id"] == workspace_id and row["status"] != "revoked":
                    row["status"] = "revoked"
        elif normalized.startswith("INSERT INTO tangent_credit_ledger ("):
            self.database.credit_ledger.append(
                {
                    "account_id": params[1],
                    "credits_delta": params[6],
                    "id": params[0],
                    "source_id": params[5],
                    "source_type": params[4],
                    "reason": params[7],
                    "workspace_id": params[2],
                }
            )
        elif normalized.startswith("SELECT COALESCE(SUM(credits_delta), 0) FROM tangent_credit_ledger WHERE account_id = %s AND source_type = 'subscription'"):
            balance = sum(
                row["credits_delta"]
                for row in self.database.credit_ledger
                if row["account_id"] == params[0]
                and row.get("source_type") == "subscription"
                and row.get("source_id") == params[1]
                and row.get("reason") == "subscription_grant"
                and float(row.get("credits_delta", 0)) > 0
            )
            self.row = (balance,)
        elif normalized.startswith("SELECT COALESCE(SUM(credits_delta), 0) FROM tangent_credit_ledger WHERE account_id = %s"):
            balance = sum(row["credits_delta"] for row in self.database.credit_ledger if row["account_id"] == params[0])
            self.row = (balance,)
        elif normalized.startswith("INSERT INTO tangent_admin_audit_logs ("):
            self.database.admin_audit_logs.append({"action": params[4], "id": params[0], "metadata": params[5]})
        elif normalized.startswith("UPDATE tangent_workspaces SET status = 'deleted' WHERE id = ANY(%s)"):
            for workspace_id in params[0]:
                if workspace_id in self.database.workspaces:
                    self.database.workspaces[workspace_id]["status"] = "deleted"
        elif normalized.startswith("UPDATE tangent_boards SET deleted_at = COALESCE(deleted_at, NOW()) WHERE workspace_id = ANY(%s)"):
            for board in self.database.boards:
                if board["workspace_id"] in params[0] and board.get("deleted_at") is None:
                    board["deleted_at"] = "now"
        elif normalized.startswith("UPDATE tangent_board_share_links SET revoked_at = COALESCE(revoked_at, NOW()) WHERE workspace_id = ANY(%s)"):
            for row in self.database.board_share_links:
                if row["workspace_id"] in params[0] and row.get("revoked_at") is None:
                    row["revoked_at"] = "now"
        elif normalized.startswith("UPDATE tangent_board_collaboration_sessions SET disconnected_at = COALESCE(disconnected_at, NOW()) WHERE workspace_id = ANY(%s)"):
            for row in self.database.board_collaboration_sessions:
                if row["workspace_id"] in params[0] and row.get("disconnected_at") is None:
                    row["disconnected_at"] = "now"
        elif normalized.startswith("DELETE FROM tangent_board_members WHERE workspace_id = ANY(%s)"):
            workspace_ids = set(params[0])
            self.database.board_members = [
                row for row in self.database.board_members
                if row["workspace_id"] not in workspace_ids
            ]
        elif normalized.startswith("DELETE FROM tangent_board_snapshots WHERE workspace_id = ANY(%s)"):
            workspace_ids = set(params[0])
            self.database.board_snapshots = [
                row for row in self.database.board_snapshots
                if row["workspace_id"] not in workspace_ids
            ]
        elif normalized.startswith("DELETE FROM tangent_board_realtime_documents WHERE workspace_id = ANY(%s)"):
            workspace_ids = set(params[0])
            self.database.board_realtime_documents = [
                row for row in self.database.board_realtime_documents
                if row["workspace_id"] not in workspace_ids
            ]
        elif normalized.startswith("UPDATE tangent_subscriptions SET status = 'canceled', current_period_end = NOW(), updated_at = NOW() WHERE workspace_id = ANY(%s)"):
            for row in self.database.subscriptions:
                if row.get("workspace_id") in params[0] and row.get("status") in {"active", "trialing", "paused"}:
                    row["status"] = "canceled"
        elif normalized.startswith("UPDATE tangent_subscriptions SET status = 'canceled', current_period_end = NOW(), updated_at = NOW() WHERE id = %s"):
            row = self.database.subscription_by_id(params[0])
            row["status"] = "canceled"
        elif normalized.startswith("SELECT id FROM tangent_workspaces WHERE owner_id = %s AND kind = 'group_workspace'"):
            self.rows = [
                (workspace_id,)
                for workspace_id, workspace in self.database.workspaces.items()
                if workspace.get("owner_id") == params[0]
                and workspace.get("kind") == "group_workspace"
                and workspace.get("status", "active") != "deleted"
            ]
        elif normalized.startswith("SELECT id, owner_type, owner_id, workspace_id, plan_family, plan_key, status, current_period_end, paused_at, paused_by, pause_reason FROM tangent_subscriptions"):
            row = self.database.subscription_by_id(params[0])
            if row:
                self.row = (
                    row["id"],
                    row["owner_type"],
                    row["owner_id"],
                    row["workspace_id"],
                    row["plan_family"],
                    row["plan_key"],
                    row["status"],
                    row["current_period_end"],
                    row["paused_at"],
                    row["paused_by"],
                    row["pause_reason"],
                )
        elif normalized.startswith("SELECT COUNT(*) FROM tangent_subscriptions"):
            self.row = (0,)
        elif normalized.startswith("UPDATE tangent_subscriptions SET status = %s, paused_at = %s, paused_by = %s, pause_reason = %s, updated_at = NOW() WHERE id = %s"):
            status, paused_at, paused_by, pause_reason, subscription_id = params
            row = self.database.subscription_by_id(subscription_id)
            row["status"] = status
            row["paused_at"] = paused_at
            row["paused_by"] = paused_by
            row["pause_reason"] = pause_reason
        elif normalized.startswith("UPDATE tangent_subscriptions SET status = %s, current_period_end = %s, paused_at = NULL, paused_by = NULL, pause_reason = NULL, updated_at = NOW() WHERE id = %s"):
            status, current_period_end, subscription_id = params
            row = self.database.subscription_by_id(subscription_id)
            row["status"] = status
            row["current_period_end"] = current_period_end
            row["paused_at"] = None
            row["paused_by"] = None
            row["pause_reason"] = None
        else:
            raise AssertionError(f"Unhandled plan operation query: {normalized}")

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class PlanOperationDatabase:
    def __init__(self, subscriptions, boards=None, credit_ledger=None, workspaces=None):
        self.admin_audit_logs = []
        self.board_collaboration_sessions = []
        self.board_members = []
        self.board_realtime_documents = []
        self.board_share_links = []
        self.board_snapshots = []
        self.boards = boards or []
        self.credit_ledger = credit_ledger or []
        self.subscriptions = subscriptions
        self.users = {"user_member", "user_admin"}
        self.workspace_members = [
            {"role": "owner", "user_id": "user_member", "workspace_id": "workspace_team"},
            {"role": "editor", "user_id": "user_editor", "workspace_id": "workspace_team"},
        ]
        self.workspace_seat_assignments = []
        self.workspaces = workspaces or {
            "workspace_team": {
                "kind": "team_workspace",
                "owner_id": "user_member",
                "status": "active",
            }
        }

    def connect(self):
        return PlanOperationConnection(self)

    def subscription_by_id(self, subscription_id):
        return next((row for row in self.subscriptions if row["id"] == subscription_id), None)

    def current_subscription(self, account_id, plan_family):
        matches = [
            row
            for row in self.subscriptions
            if row["account_id"] == account_id and row["plan_family"] == plan_family and row["status"] in {"active", "trialing", "paused"}
        ]
        matches.sort(key=lambda row: {"active": 0, "trialing": 1, "paused": 2}.get(row["status"], 3))
        return matches[0] if matches else None


def install_plan_operation_db(monkeypatch, fake_db):
    monkeypatch.setattr("tangent_api.admin_finance_manual_plan_operations.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.admin_finance_manual_plan_operations.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr(
        "tangent_api.admin_finance_manual_plan_operations.ensure_credit_account",
        lambda cursor, owner_type, owner_id: f"credit_{owner_type}_{owner_id}",
    )
    monkeypatch.setattr("tangent_api.admin_finance_manual_plan_context.has_postgres_column", lambda *_args, **_kwargs: True)
    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_operator_subscription_writes.has_postgres_column", lambda *_args, **_kwargs: True)


def subscription_context_tuple(row):
    return (
        row["id"],
        row["plan_key"],
        row["status"],
        row["seat_capacity"],
        row["current_period_start"],
        row["current_period_end"],
    )
