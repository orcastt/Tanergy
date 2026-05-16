"""switch image model primaries to Jiekou with GeekAI fallbacks

Revision ID: 20260516_0025
Revises: 20260516_0024
Create Date: 2026-05-16
"""

from alembic import op


revision = "20260516_0025"
down_revision = "20260516_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    for statement in UPGRADE:
        connection.exec_driver_sql(statement)


def downgrade() -> None:
    connection = op.get_bind()
    for statement in DOWNGRADE:
        connection.exec_driver_sql(statement)


UPGRADE = [
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"quality":["low","medium","high"],"size":["1024x1024","1024x1536","1536x1024","2048x2048","2048x1152","3840x2160","2160x3840","2048x1360","1360x2048","1152x2048","2048x1536","1536x2048","2048x880","880x2048","688x2048","2048x688","2048x1024","1024x2048"]}'::jsonb,
        provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key = 'gpt-image-2'
    """,
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"aspectRatio":["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"],"imageSize":["1K","2K","4K"]}'::jsonb,
        provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key = 'nano-banana-2'
    """,
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"seedreamSize":["2K","3K","4K","2048x2048","2304x1728","1728x2304","2848x1600","1600x2848","2496x1664","1664x2496","3136x1344","3072x3072","3456x2592","2592x3456","4096x2304","2304x4096","3744x2496","2496x3744","4704x2016","4096x4096","3520x4704","4704x3520","5504x3040","3040x5504","3328x4992","4992x3328","6240x2656"]}'::jsonb,
        provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key = 'doubao-seedream-5.0-lite'
    """,
    """
    DELETE FROM tangent_model_parameter_tiers
    WHERE id = 'tier_nano_banana_2_0_5k'
    """,
    """
    DELETE FROM tangent_model_pricing_rules
    WHERE id = 'price_nano_banana_2_0_5k_v1'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET provider_params = '{"quality":"1k"}'::jsonb,
        updated_at = NOW()
    WHERE id = 'tier_nano_banana_2_1k'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET provider_params = '{"quality":"2k"}'::jsonb,
        updated_at = NOW()
    WHERE id = 'tier_nano_banana_2_2k'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET provider_params = '{"quality":"4k"}'::jsonb,
        updated_at = NOW()
    WHERE id = 'tier_nano_banana_2_4k'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider = 'jiekou',
        provider_key = 'jiekou',
        provider_model = 'gpt-image-2',
        route_key = 'jiekou-gpt-image-2-primary',
        priority = 10,
        weight = 100,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE id = 'route_gpt_image_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider = 'jiekou',
        provider_key = 'jiekou',
        provider_model = 'nano-banana-2',
        route_key = 'jiekou-nano-banana-2-primary',
        priority = 10,
        weight = 100,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE id = 'route_nano_banana_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider = 'jiekou',
        provider_key = 'jiekou',
        provider_model = 'doubao-seedream-5.0-lite',
        route_key = 'jiekou-seedream-5-lite-primary',
        priority = 10,
        weight = 100,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE id = 'route_doubao_seedream_5_0_lite_primary'
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES (
        'route_gpt_image_2_geekai_fallback',
        'gpt-image-2',
        'geekai',
        'geekai-gpt-image-2-fallback',
        '["image_generation","image_edit"]'::jsonb,
        5,
        NULL,
        240000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'gpt-image-2',
        'geekai',
        'gpt-image-2',
        20,
        80,
        'healthy'
    )
    ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        route_key = EXCLUDED.route_key,
        capabilities = EXCLUDED.capabilities,
        credit_cost = EXCLUDED.credit_cost,
        timeout_ms = EXCLUDED.timeout_ms,
        retry_policy = EXCLUDED.retry_policy,
        enabled = EXCLUDED.enabled,
        model_key = EXCLUDED.model_key,
        provider_key = EXCLUDED.provider_key,
        provider_model = EXCLUDED.provider_model,
        priority = EXCLUDED.priority,
        weight = EXCLUDED.weight,
        health_status = EXCLUDED.health_status,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES (
        'route_nano_banana_2_geekai_fallback',
        'nano-banana-2',
        'geekai',
        'geekai-nano-banana-2-fallback',
        '["image_generation","image_edit","image_reference"]'::jsonb,
        4,
        NULL,
        240000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'nano-banana-2',
        'geekai',
        'nano-banana-2',
        20,
        80,
        'healthy'
    )
    ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        route_key = EXCLUDED.route_key,
        capabilities = EXCLUDED.capabilities,
        credit_cost = EXCLUDED.credit_cost,
        timeout_ms = EXCLUDED.timeout_ms,
        retry_policy = EXCLUDED.retry_policy,
        enabled = EXCLUDED.enabled,
        model_key = EXCLUDED.model_key,
        provider_key = EXCLUDED.provider_key,
        provider_model = EXCLUDED.provider_model,
        priority = EXCLUDED.priority,
        weight = EXCLUDED.weight,
        health_status = EXCLUDED.health_status,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES (
        'route_doubao_seedream_5_0_lite_geekai_fallback',
        'doubao-seedream-5.0-lite',
        'geekai',
        'geekai-seedream-5-lite-fallback',
        '["image_generation","image_edit","image_reference"]'::jsonb,
        6,
        NULL,
        240000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'doubao-seedream-5.0-lite',
        'geekai',
        'doubao-seedream-5.0-lite',
        20,
        80,
        'healthy'
    )
    ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        route_key = EXCLUDED.route_key,
        capabilities = EXCLUDED.capabilities,
        credit_cost = EXCLUDED.credit_cost,
        timeout_ms = EXCLUDED.timeout_ms,
        retry_policy = EXCLUDED.retry_policy,
        enabled = EXCLUDED.enabled,
        model_key = EXCLUDED.model_key,
        provider_key = EXCLUDED.provider_key,
        provider_model = EXCLUDED.provider_model,
        priority = EXCLUDED.priority,
        weight = EXCLUDED.weight,
        health_status = EXCLUDED.health_status,
        updated_at = NOW()
    """,
]


DOWNGRADE = [
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"quality":["low","medium","high"],"size":["1024x1024","1024x1536","1536x1024"]}'::jsonb,
        provider_key = 'geekai',
        updated_at = NOW()
    WHERE model_key = 'gpt-image-2'
    """,
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"aspectRatio":["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","9:21","1:4","4:1","1:8","8:1"],"imageSize":["0.5K","1K","2K","4K"]}'::jsonb,
        provider_key = 'geekai',
        updated_at = NOW()
    WHERE model_key = 'nano-banana-2'
    """,
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"seedreamOutputFormat":["png","jpeg"],"seedreamSize":["2K","3K","4K","2048x2048","2304x1728","1728x2304","2848x1600","1600x2848","2496x1664","1664x2496","3136x1344","3072x3072","3456x2592","2592x3456","4096x2304","2304x4096","3744x2496","2496x3744","4704x2016","4096x4096","3520x4704","4704x3520","5504x3040","3040x5504","3328x4992","4992x3328","6240x2656"]}'::jsonb,
        provider_key = 'geekai',
        updated_at = NOW()
    WHERE model_key = 'doubao-seedream-5.0-lite'
    """,
    """
    INSERT INTO tangent_model_parameter_tiers (
        id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled
    ) VALUES (
        'tier_nano_banana_2_0_5k',
        'nano-banana-2',
        '0_5k',
        '0.5K',
        'imageSize',
        '{"size":"0.5K"}'::jsonb,
        10,
        TRUE
    )
    ON CONFLICT (model_key, tier_key) DO UPDATE SET
        public_label = EXCLUDED.public_label,
        parameter_key = EXCLUDED.parameter_key,
        provider_params = EXCLUDED.provider_params,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES (
        'price_nano_banana_2_0_5k_v1',
        'nano-banana-2',
        '0_5k',
        'per_image',
        2.5,
        2.5,
        1,
        '{"amount":0.015,"currency":"USD","type":"per_image"}'::jsonb,
        'active',
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        model_key = EXCLUDED.model_key,
        tier_key = EXCLUDED.tier_key,
        billing_unit = EXCLUDED.billing_unit,
        estimated_credits = EXCLUDED.estimated_credits,
        min_credits = EXCLUDED.min_credits,
        credit_multiplier = EXCLUDED.credit_multiplier,
        provider_cost_formula = EXCLUDED.provider_cost_formula,
        status = EXCLUDED.status,
        updated_at = NOW()
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET provider_params = '{"size":"1K"}'::jsonb,
        updated_at = NOW()
    WHERE id = 'tier_nano_banana_2_1k'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET provider_params = '{"size":"2K"}'::jsonb,
        updated_at = NOW()
    WHERE id = 'tier_nano_banana_2_2k'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET provider_params = '{"size":"4K"}'::jsonb,
        updated_at = NOW()
    WHERE id = 'tier_nano_banana_2_4k'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider = 'geekai',
        provider_key = 'geekai',
        route_key = 'geekai-primary',
        priority = 10,
        weight = 100,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE id = 'route_gpt_image_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider = 'geekai',
        provider_key = 'geekai',
        route_key = 'geekai-primary',
        priority = 10,
        weight = 100,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE id = 'route_nano_banana_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider = 'geekai',
        provider_key = 'geekai',
        route_key = 'geekai-primary',
        priority = 10,
        weight = 100,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE id = 'route_doubao_seedream_5_0_lite_primary'
    """,
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_image_2_geekai_fallback'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_nano_banana_2_geekai_fallback'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_doubao_seedream_5_0_lite_geekai_fallback'",
]
