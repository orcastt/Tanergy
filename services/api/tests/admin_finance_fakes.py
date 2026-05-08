class FinanceFakeCursor:
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
        params = params or ()
        self.row = None
        self.rows = []
        if normalized.startswith("SELECT status, COUNT(*), COALESCE(SUM(amount_cents), 0) FROM tangent_payments"):
            self.rows = _group_amount_counts(self.database.payments, "status")
        elif normalized.startswith("SELECT COALESCE(kind, 'unknown'), COUNT(*), COALESCE(SUM(amount_cents), 0) FROM tangent_payments"):
            self.rows = _group_amount_counts(self.database.payments, "kind")
        elif normalized.startswith("SELECT provider, COUNT(*), COALESCE(SUM(amount_cents), 0) FROM tangent_payments"):
            self.rows = _group_amount_counts(self.database.payments, "provider")
        elif normalized.startswith("SELECT owner_type, COALESCE(account_kind, 'personal_wallet'), status, COUNT(*) FROM tangent_credit_accounts"):
            self.rows = _account_counts(self.database.credit_accounts)
        elif normalized.startswith("SELECT COALESCE(SUM(credits_delta), 0), COALESCE(SUM(CASE WHEN credits_delta > 0"):
            balance = sum(float(row.get("credits_delta", 0)) for row in self.database.credit_ledger)
            granted = sum(max(float(row.get("credits_delta", 0)), 0) for row in self.database.credit_ledger)
            spent = sum(max(-float(row.get("credits_delta", 0)), 0) for row in self.database.credit_ledger)
            self.row = (balance, granted, spent)
        elif normalized.startswith("SELECT plan_family, status, COUNT(*), COALESCE(SUM(seat_capacity), 0) FROM tangent_subscriptions"):
            self.rows = _subscription_counts(self.database.subscriptions)
        elif normalized.startswith("SELECT p.id, p.account_id, ca.owner_type"):
            self.rows = _filter_payments(self.database, normalized, params)
        elif normalized.startswith("SELECT ca.id, ca.owner_type, ca.owner_id, COALESCE(ca.account_kind"):
            self.rows = _filter_wallets(self.database, normalized, params)
        elif normalized.startswith("SELECT l.id, l.account_id, ca.owner_type"):
            self.rows = _filter_ledger(self.database, normalized, params)
        elif normalized.startswith("SELECT id, account_id, owner_type, owner_id, workspace_id, plan_family, plan_key"):
            self.rows = _filter_subscriptions(self.database, normalized, params)
        elif normalized.startswith("SELECT wm.workspace_id, wm.user_id"):
            self.rows = _member_usage(self.database, params)

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class FinanceFakeConnection:
    def __init__(self, database):
        self.database = database

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return FinanceFakeCursor(self.database)


class FinanceFakeDatabase:
    def __init__(self):
        self.credit_accounts = []
        self.credit_ledger = []
        self.payments = []
        self.subscriptions = []
        self.users = []
        self.workspace_members = []

    def connect(self):
        return FinanceFakeConnection(self)


def _group_amount_counts(rows, key_name):
    counts = {}
    for row in rows:
        key = row.get(key_name) or "unknown"
        count, amount = counts.get(key, (0, 0))
        counts[key] = (count + 1, amount + int(row.get("amount_cents", 0) or 0))
    return [(key, value[0], value[1]) for key, value in sorted(counts.items())]


def _account_counts(accounts):
    counts = {}
    for row in accounts:
        key = (row.get("owner_type", "unknown"), row.get("account_kind", "personal_wallet"), row.get("status", "active"))
        counts[key] = counts.get(key, 0) + 1
    return [(*key, value) for key, value in sorted(counts.items())]


def _subscription_counts(subscriptions):
    counts = {}
    for row in subscriptions:
        key = (row.get("plan_family", "free"), row.get("status", "active"))
        count, seats = counts.get(key, (0, 0))
        counts[key] = (count + 1, seats + int(row.get("seat_capacity", 0) or 0))
    return [(key[0], key[1], value[0], value[1]) for key, value in sorted(counts.items())]


def _account_for(database, account_id):
    account = next((row for row in database.credit_accounts if row.get("id") == account_id), None)
    if not account:
        return (None, None, None)
    return (account.get("owner_type"), account.get("owner_id"), account.get("account_kind", "personal_wallet"))


def _filter_payments(database, normalized, params):
    kind, provider, status, user_id, workspace_id = _payment_filters(normalized, params)
    rows = []
    for row in database.payments:
        owner_type, owner_id, account_kind = _account_for(database, row.get("account_id"))
        metadata = row.get("metadata", {})
        if kind and row.get("kind") != kind or provider and row.get("provider") != provider or status and row.get("status") != status:
            continue
        if user_id and not (owner_type == "user" and owner_id == user_id):
            continue
        if workspace_id and not (owner_type == "workspace" and owner_id == workspace_id or metadata.get("workspaceId") == workspace_id):
            continue
        rows.append((row["id"], row.get("account_id"), owner_type, owner_id, account_kind, row.get("provider", "manual_test"), row.get("provider_payment_id"), row.get("amount_cents", 0), row.get("currency", "usd"), row.get("status", "pending"), row.get("created_at", "1970-01-01T00:00:00Z"), row.get("checkout_session_id"), row.get("kind", "topup"), metadata))
    return sorted(rows, key=lambda value: value[10], reverse=True)[: int(params[-1])]


def _payment_filters(normalized, params):
    index = 0
    values = []
    for marker in ("p.kind = %s", "p.provider = %s", "p.status = %s", "ca.owner_type = 'user' AND ca.owner_id = %s"):
        if marker in normalized:
            values.append(params[index])
            index += 1
        else:
            values.append(None)
    workspace_id = params[index] if "ca.owner_type = 'workspace' AND ca.owner_id = %s OR p.metadata ->> 'workspaceId' = %s" in normalized else None
    return (*values, workspace_id)


def _filter_wallets(database, normalized, params):
    account_kind, owner_id, owner_type, status = _ordered_filters(normalized, params, ("ca.account_kind = %s", "ca.owner_id = %s", "ca.owner_type = %s", "ca.status = %s"))
    rows = []
    for account in database.credit_accounts:
        if account_kind and account.get("account_kind") != account_kind or owner_id and account.get("owner_id") != owner_id:
            continue
        if owner_type and account.get("owner_type") != owner_type or status and account.get("status", "active") != status:
            continue
        balance = sum(float(row.get("credits_delta", 0)) for row in database.credit_ledger if row.get("account_id") == account["id"])
        rows.append((account["id"], account.get("owner_type"), account.get("owner_id"), account.get("account_kind", "personal_wallet"), account.get("status", "active"), account.get("created_at", "1970-01-01T00:00:00Z"), account.get("updated_at", account.get("created_at", "1970-01-01T00:00:00Z")), balance))
    return sorted(rows, key=lambda value: value[6], reverse=True)[: int(params[-1])]


def _filter_ledger(database, normalized, params):
    account_id, actor_user_id, reason, workspace_id = _ordered_filters(normalized, params, ("l.account_id = %s", "l.actor_user_id = %s", "l.reason = %s", "l.workspace_id = %s"))
    rows = []
    for row in database.credit_ledger:
        if account_id and row.get("account_id") != account_id or actor_user_id and row.get("actor_user_id") != actor_user_id:
            continue
        if reason and row.get("reason") != reason or workspace_id and row.get("workspace_id") != workspace_id:
            continue
        owner_type, owner_id, account_kind = _account_for(database, row.get("account_id"))
        rows.append((row["id"], row.get("account_id"), owner_type, owner_id, account_kind, row.get("workspace_id"), row.get("actor_user_id"), row.get("source_type"), row.get("source_id"), row.get("credits_delta", 0), row.get("reason"), row.get("metadata", {}), row.get("created_at", "1970-01-01T00:00:00Z")))
    return sorted(rows, key=lambda value: value[12], reverse=True)[: int(params[-1])]


def _filter_subscriptions(database, normalized, params):
    owner_id, plan_family, status, workspace_id = _ordered_filters(normalized, params, ("owner_id = %s", "plan_family = %s", "status = %s", "workspace_id = %s"))
    rows = []
    for row in database.subscriptions:
        if owner_id and row.get("owner_id") != owner_id or plan_family and row.get("plan_family") != plan_family:
            continue
        if status and row.get("status") != status or workspace_id and row.get("workspace_id") != workspace_id:
            continue
        rows.append((row["id"], row.get("account_id"), row.get("owner_type", "user"), row.get("owner_id", ""), row.get("workspace_id"), row.get("plan_family", "free"), row.get("plan_key"), row.get("provider", "manual_test"), row.get("provider_customer_id"), row.get("provider_subscription_id"), row.get("status", "active"), row.get("seat_capacity", 1), row.get("current_period_start"), row.get("current_period_end"), row.get("created_at", "1970-01-01T00:00:00Z"), row.get("updated_at", "1970-01-01T00:00:00Z")))
    return sorted(rows, key=lambda value: value[15], reverse=True)[: int(params[-1])]


def _ordered_filters(normalized, params, markers):
    index = 0
    values = []
    for marker in markers:
        if marker in normalized:
            values.append(params[index])
            index += 1
        else:
            values.append(None)
    return values


def _member_usage(database, params):
    workspace_id, limit = params
    rows = []
    for member in database.workspace_members:
        if member.get("workspace_id") != workspace_id:
            continue
        user = next((row for row in database.users if row["id"] == member.get("user_id")), None)
        charges = [row for row in database.credit_ledger if row.get("workspace_id") == workspace_id and row.get("actor_user_id") == member.get("user_id") and float(row.get("credits_delta", 0)) < 0]
        usage = sum(-float(row.get("credits_delta", 0)) for row in charges)
        rows.append((workspace_id, member.get("user_id"), user.get("email") if user else None, member.get("display_name") or (user.get("display_name") if user else None), member.get("role", "member"), usage, len(charges), max((row.get("created_at") for row in charges), default=None)))
    return sorted(rows, key=lambda value: (-float(value[5]), value[1]))[: int(limit)]
