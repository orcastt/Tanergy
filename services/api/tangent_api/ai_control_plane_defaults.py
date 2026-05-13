DEFAULT_MODEL_ROWS = [
    {
        "capabilities": ["text"],
        "capability": "text",
        "cost_hint": "Fast streaming chat for node conversations.",
        "default_tier_key": None,
        "display_name": "Hunyuan 3.0 Preview",
        "enabled": True,
        "estimated_latency": "1-4s",
        "is_default": False,
        "model_key": "hunyuan-3.0-preview",
        "parameter_schema": {},
        "provider_key": "geekai",
    },
    {
        "capabilities": ["image_generation", "image_edit"],
        "capability": "image_generation",
        "cost_hint": "Use low quality for early tests.",
        "default_tier_key": "1k",
        "display_name": "GPT Image 2",
        "enabled": True,
        "estimated_latency": "5-12s",
        "is_default": True,
        "model_key": "gpt-image-2",
        "parameter_schema": {"aspectRatio": ["auto", "1:1", "4:3", "16:9", "3:2"], "resolution": ["0.5K", "1K", "2K"]},
        "provider_key": "geekai",
    },
    {
        "capabilities": ["image_generation", "image_edit", "image_reference"],
        "capability": "image_generation",
        "cost_hint": "Use 0.5K for fast mock validation.",
        "default_tier_key": "1k",
        "display_name": "Gemini 3.1 Flash Image Preview",
        "enabled": True,
        "estimated_latency": "4-10s",
        "is_default": False,
        "model_key": "gemini-3.1-flash-image-preview",
        "parameter_schema": {"aspectRatio": ["auto", "1:1", "4:3", "16:9"], "resolution": ["0.5K", "1K", "2K", "4K"]},
        "provider_key": "geekai",
    },
]

DEFAULT_TIER_ROWS = [
    {"enabled": True, "id": "tier_gpt_image_2_0_5k", "model_key": "gpt-image-2", "parameter_key": "resolution", "provider_params": {"resolution": "0.5K"}, "public_label": "0.5K", "sort_order": 10, "tier_key": "0_5k"},
    {"enabled": True, "id": "tier_gpt_image_2_1k", "model_key": "gpt-image-2", "parameter_key": "resolution", "provider_params": {"resolution": "1K"}, "public_label": "1K", "sort_order": 20, "tier_key": "1k"},
    {"enabled": True, "id": "tier_gpt_image_2_2k", "model_key": "gpt-image-2", "parameter_key": "resolution", "provider_params": {"resolution": "2K"}, "public_label": "2K", "sort_order": 30, "tier_key": "2k"},
    {"enabled": True, "id": "tier_gemini_flash_0_5k", "model_key": "gemini-3.1-flash-image-preview", "parameter_key": "resolution", "provider_params": {"resolution": "0.5K"}, "public_label": "0.5K", "sort_order": 10, "tier_key": "0_5k"},
    {"enabled": True, "id": "tier_gemini_flash_1k", "model_key": "gemini-3.1-flash-image-preview", "parameter_key": "resolution", "provider_params": {"resolution": "1K"}, "public_label": "1K", "sort_order": 20, "tier_key": "1k"},
    {"enabled": True, "id": "tier_gemini_flash_2k", "model_key": "gemini-3.1-flash-image-preview", "parameter_key": "resolution", "provider_params": {"resolution": "2K"}, "public_label": "2K", "sort_order": 30, "tier_key": "2k"},
    {"enabled": True, "id": "tier_gemini_flash_4k", "model_key": "gemini-3.1-flash-image-preview", "parameter_key": "resolution", "provider_params": {"resolution": "4K"}, "public_label": "4K", "sort_order": 40, "tier_key": "4k"},
]

DEFAULT_ROUTE_ROWS = [
    {"created_at": "2026-05-06T00:00:00Z", "enabled": True, "health_status": "healthy", "id": "route_hunyuan_text_primary", "model_key": "hunyuan-3.0-preview", "priority": 10, "provider_key": "geekai", "provider_model": "hunyuan-3.0-preview", "retry_policy": {"maxAttempts": 2}, "route_key": "geekai-text-primary", "timeout_ms": 45000, "updated_at": "2026-05-06T00:00:00Z", "weight": 100},
    {"created_at": "2026-05-06T00:00:00Z", "enabled": True, "health_status": "healthy", "id": "route_gpt_image_2_primary", "model_key": "gpt-image-2", "priority": 10, "provider_key": "geekai", "provider_model": "gpt-image-2", "retry_policy": {"maxAttempts": 2}, "route_key": "geekai-primary", "timeout_ms": 60000, "updated_at": "2026-05-06T00:00:00Z", "weight": 100},
    {"created_at": "2026-05-06T00:00:00Z", "enabled": True, "health_status": "healthy", "id": "route_gemini_flash_primary", "model_key": "gemini-3.1-flash-image-preview", "priority": 10, "provider_key": "geekai", "provider_model": "gemini-3.1-flash-image-preview", "retry_policy": {"maxAttempts": 2}, "route_key": "geekai-primary", "timeout_ms": 60000, "updated_at": "2026-05-06T00:00:00Z", "weight": 100},
]

DEFAULT_PRICING_ROWS = [
    {"billing_unit": "per_run", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 1.0, "id": "price_hunyuan_text_v1", "min_credits": 1.0, "model_key": "hunyuan-3.0-preview", "provider_cost_formula": {"amount": 0.002, "currency": "USD", "type": "per_run"}, "status": "active", "tier_key": None, "updated_at": "2026-05-06T00:00:00Z"},
    {"billing_unit": "per_image", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 3.0, "id": "price_gpt_image_2_0_5k_v1", "min_credits": 3.0, "model_key": "gpt-image-2", "provider_cost_formula": {"amount": 0.02, "currency": "USD", "type": "per_image"}, "status": "active", "tier_key": "0_5k", "updated_at": "2026-05-06T00:00:00Z"},
    {"billing_unit": "per_image", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 5.0, "id": "price_gpt_image_2_1k_v1", "min_credits": 5.0, "model_key": "gpt-image-2", "provider_cost_formula": {"amount": 0.04, "currency": "USD", "type": "per_image"}, "status": "active", "tier_key": "1k", "updated_at": "2026-05-06T00:00:00Z"},
    {"billing_unit": "per_image", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 9.0, "id": "price_gpt_image_2_2k_v1", "min_credits": 9.0, "model_key": "gpt-image-2", "provider_cost_formula": {"amount": 0.08, "currency": "USD", "type": "per_image"}, "status": "active", "tier_key": "2k", "updated_at": "2026-05-06T00:00:00Z"},
    {"billing_unit": "per_image", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 2.5, "id": "price_gemini_flash_0_5k_v1", "min_credits": 2.5, "model_key": "gemini-3.1-flash-image-preview", "provider_cost_formula": {"amount": 0.015, "currency": "USD", "type": "per_image"}, "status": "active", "tier_key": "0_5k", "updated_at": "2026-05-06T00:00:00Z"},
    {"billing_unit": "per_image", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 4.0, "id": "price_gemini_flash_1k_v1", "min_credits": 4.0, "model_key": "gemini-3.1-flash-image-preview", "provider_cost_formula": {"amount": 0.03, "currency": "USD", "type": "per_image"}, "status": "active", "tier_key": "1k", "updated_at": "2026-05-06T00:00:00Z"},
    {"billing_unit": "per_image", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 7.0, "id": "price_gemini_flash_2k_v1", "min_credits": 7.0, "model_key": "gemini-3.1-flash-image-preview", "provider_cost_formula": {"amount": 0.06, "currency": "USD", "type": "per_image"}, "status": "active", "tier_key": "2k", "updated_at": "2026-05-06T00:00:00Z"},
    {"billing_unit": "per_image", "created_at": "2026-05-06T00:00:00Z", "credit_multiplier": 1.0, "effective_from": "2026-05-06T00:00:00Z", "effective_to": None, "estimated_credits": 12.0, "id": "price_gemini_flash_4k_v1", "min_credits": 12.0, "model_key": "gemini-3.1-flash-image-preview", "provider_cost_formula": {"amount": 0.12, "currency": "USD", "type": "per_image"}, "status": "active", "tier_key": "4k", "updated_at": "2026-05-06T00:00:00Z"},
]
