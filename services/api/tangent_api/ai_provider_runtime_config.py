import os
from typing import Optional


_DEFAULT_PROVIDER_BASE_URLS = {
    "geekai": "https://geekai.co/api/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta",
    "openai": "https://api.openai.com/v1",
}


def should_use_live_provider(provider_key: str, provider_model: Optional[str] = None, run_type: Optional[str] = None) -> bool:
    normalized_key = provider_key.upper().replace("-", "_")
    provider_mode = os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_MODE", "").strip().lower()
    global_mode = os.getenv("TANGENT_AI_PROVIDER_EXECUTION_MODE", "").strip().lower()
    if provider_mode == "stub" or global_mode == "stub":
        return False
    if provider_mode == "live" or global_mode == "live":
        return True
    if _is_local_or_test_runtime():
        return False
    return bool(provider_api_key(provider_key, provider_model, run_type) and provider_base_url(provider_key, provider_model, run_type))


def should_allow_stub_provider_adapter() -> bool:
    if os.getenv("TANGENT_AI_ALLOW_STUB_PROVIDER", "").strip() == "1":
        return True
    return _is_local_or_test_runtime()


def provider_api_key(provider_key: str, provider_model: Optional[str] = None, run_type: Optional[str] = None) -> Optional[str]:
    _ = provider_model
    geekai_value = _geekai_scope_value("API_KEY", provider_key, run_type)
    if geekai_value:
        return geekai_value
    scope_override = _provider_scope_value("API_KEY", provider_key, run_type)
    if scope_override:
        return scope_override
    normalized_key = provider_key.upper().replace("-", "_")
    return (
        os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_API_KEY")
        or os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_KEY")
        or os.getenv(f"{normalized_key}_API_KEY")
        or os.getenv(f"{normalized_key}_KEY")
        or os.getenv(_legacy_provider_api_key_env(provider_key))
    )


def provider_base_url(provider_key: str, provider_model: Optional[str] = None, run_type: Optional[str] = None) -> Optional[str]:
    _ = provider_model
    geekai_value = _geekai_scope_value("BASE_URL", provider_key, run_type)
    if geekai_value:
        return geekai_value
    scope_override = _provider_scope_value("BASE_URL", provider_key, run_type)
    if scope_override:
        return scope_override
    normalized_key = provider_key.upper().replace("-", "_")
    return (
        os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_BASE_URL")
        or os.getenv(_legacy_provider_base_url_env(provider_key))
        or _default_provider_base_url(provider_key, run_type)
    )


def _is_local_or_test_runtime() -> bool:
    runtime_names = {"TANGENT_ENV", "ENVIRONMENT", "APP_ENV", "PYTHON_ENV"}
    runtime_values = {
        os.getenv(name, "").strip().lower()
        for name in runtime_names
        if os.getenv(name, "").strip()
    }
    if runtime_values.intersection({"prod", "production", "stage", "staging"}):
        return False
    if runtime_values.intersection({"dev", "development", "local", "test", "testing"}):
        return True
    return not runtime_values


def _provider_scope_value(value_suffix: str, provider_key: str, run_type: Optional[str]) -> Optional[str]:
    scope = _provider_scope_for_run_type(run_type)
    if scope is None:
        return None
    normalized_provider = provider_key.upper().replace("-", "_")
    normalized_scope = scope.upper()
    candidates = [
        f"TANGENT_AI_PROVIDER_{normalized_provider}_{normalized_scope}_{value_suffix}",
        f"{normalized_provider}_{normalized_scope}_{value_suffix}",
    ]
    if value_suffix == "API_KEY":
        candidates.extend([
            f"TANGENT_AI_PROVIDER_{normalized_provider}_{normalized_scope}_KEY",
            f"{normalized_provider}_{normalized_scope}_KEY",
        ])
    return _first_env_value(candidates)


def _geekai_scope_value(value_suffix: str, provider_key: str, run_type: Optional[str]) -> Optional[str]:
    if provider_key != "geekai":
        return None
    scope = _provider_scope_for_run_type(run_type)
    names = _geekai_env_names(value_suffix, scope)
    return _first_env_value(names)


def _geekai_env_names(value_suffix: str, scope: Optional[str]) -> list[str]:
    if scope == "image" and value_suffix == "BASE_URL":
        return [
            "GEEKAI_BALANCE_IMAGE_API_KEY_BASE_URL",
            "GEEKAI_IMAGE_BASE_URL",
            "GEEKAI_OFFICIAL_IMAGE_API_KEY_BASE_URL",
            # Legacy typo alias kept so older server envs survive one rollout.
            "GEEKAI_OFFCIAL_IMAGE_API_KEY_BASE_URL",
        ]
    if scope == "image":
        return [
            f"GEEKAI_BALANCE_IMAGE_{value_suffix}",
            f"GEEKAI_IMAGE_{value_suffix}",
            f"GEEKAI_OFFICIAL_IMAGE_{value_suffix}",
            # Legacy typo alias kept so older server envs survive one rollout.
            f"GEEKAI_OFFCIAL_IMAGE_{value_suffix}",
        ]
    if scope == "text":
        return [f"GEEKAI_TEXT_{value_suffix}"]
    if scope == "video":
        return [f"GEEKAI_VIDEO_{value_suffix}"]
    return []


def _provider_scope_for_run_type(run_type: Optional[str]) -> Optional[str]:
    normalized = str(run_type or "").strip().lower()
    if normalized in {"image_generation", "image_edit"}:
        return "image"
    if normalized in {"image_analysis", "text"}:
        return "text"
    if normalized == "video":
        return "video"
    return None


def _legacy_provider_api_key_env(provider_key: str) -> str:
    if provider_key == "google":
        return "GOOGLE_API_KEY"
    if provider_key == "geekai":
        return "GEEKAI_API_KEY"
    if provider_key == "jiekou":
        return "JIEKOU_API_KEY"
    if provider_key == "openai":
        return "OPENAI_API_KEY"
    return f"{provider_key.upper()}_API_KEY"


def _legacy_provider_base_url_env(provider_key: str) -> str:
    if provider_key == "openai":
        return "OPENAI_BASE_URL"
    if provider_key == "google":
        return "GOOGLE_BASE_URL"
    if provider_key == "geekai":
        return "GEEKAI_BASE_URL"
    if provider_key == "jiekou":
        return "JIEKOU_BASE_URL"
    return f"{provider_key.upper()}_BASE_URL"


def _default_provider_base_url(provider_key: str, run_type: Optional[str]) -> Optional[str]:
    if provider_key == "jiekou":
        scope = _provider_scope_for_run_type(run_type)
        if scope == "text":
            return "https://api.jiekou.ai/openai/v1"
        return "https://api.jiekou.ai/v3"
    return _DEFAULT_PROVIDER_BASE_URLS.get(provider_key)


def _first_env_value(names: list[str]) -> Optional[str]:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None
