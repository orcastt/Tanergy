def admin_operator_user_ip_field_sql() -> str:
    return "last_ip_address"


def admin_operator_subscription_snapshot_sql(source_alias: str) -> str:
    return f"""
        {source_alias}.id AS subscription_id,
        {source_alias}.plan_key,
        {source_alias}.status,
        {source_alias}.seat_capacity,
        {source_alias}.current_period_start,
        {source_alias}.current_period_end,
        {_optional_subscription_column_sql(source_alias, "paused_at", "timestamptz")},
        {_optional_subscription_column_sql(source_alias, "paused_by", "text")},
        {_optional_subscription_column_sql(source_alias, "pause_reason", "text")}
    """


def _optional_subscription_column_sql(source_alias: str, column_name: str, cast_name: str) -> str:
    return f"{source_alias}.{column_name} AS {column_name}"
