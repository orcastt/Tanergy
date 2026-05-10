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

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        self.row = None
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
                    "current_period_end": params[13],
                    "current_period_start": params[12],
                    "id": params[0],
                    "owner_id": params[3],
                    "owner_type": params[2],
                    "pause_reason": None,
                    "paused_at": None,
                    "paused_by": None,
                    "plan_family": params[5],
                    "plan_key": params[9],
                    "seat_capacity": params[11],
                    "status": params[10],
                    "workspace_id": params[4],
                }
            )
        elif normalized.startswith("INSERT INTO tangent_credit_ledger ("):
            self.database.credit_ledger.append(
                {
                    "account_id": params[1],
                    "credits_delta": params[6],
                    "id": params[0],
                    "reason": params[7],
                    "workspace_id": params[2],
                }
            )
        elif normalized.startswith("SELECT COALESCE(SUM(credits_delta), 0) FROM tangent_credit_ledger WHERE account_id = %s"):
            balance = sum(row["credits_delta"] for row in self.database.credit_ledger if row["account_id"] == params[0])
            self.row = (balance,)
        elif normalized.startswith("INSERT INTO tangent_admin_audit_logs ("):
            self.database.admin_audit_logs.append({"action": params[4], "id": params[0], "metadata": params[5]})
        elif normalized.startswith("UPDATE tangent_subscriptions SET status = 'canceled', current_period_end = NOW(), updated_at = NOW() WHERE id = %s"):
            row = self.database.subscription_by_id(params[0])
            row["status"] = "canceled"
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


class PlanOperationDatabase:
    def __init__(self, subscriptions):
        self.admin_audit_logs = []
        self.credit_ledger = []
        self.subscriptions = subscriptions
        self.users = {"user_member", "user_admin"}
        self.workspaces = {"workspace_team": {"kind": "team_workspace"}}

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
