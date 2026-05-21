from tangent_api.storage.postgres_schema import has_postgres_column


def auth_user_last_ip_enabled() -> bool:
    try:
        return has_postgres_column("tangent_users", "last_ip_address")
    except Exception:
        return True


def auth_user_last_ip_insert_field_sql() -> str:
    return "last_ip_address," if auth_user_last_ip_enabled() else ""


def auth_user_last_ip_insert_value_sql() -> str:
    return "%s," if auth_user_last_ip_enabled() else ""


def auth_user_last_ip_update_assignment_sql() -> str:
    return "last_ip_address = COALESCE(%s, last_ip_address)," if auth_user_last_ip_enabled() else ""
