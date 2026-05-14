"""refresh GeekAI image generation models and routes

Revision ID: 20260514_0021
Revises: 20260513_0020
Create Date: 2026-05-14
"""

from alembic import op


revision = "20260514_0021"
down_revision = "20260513_0020"
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
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key
    ) VALUES
        (
            'gpt-image-2',
            'GPT Image 2',
            'image_generation',
            '["image_generation","image_edit"]'::jsonb,
            '{"quality":["low","medium","high"],"size":["1024x1024","1024x1536","1536x1024"]}'::jsonb,
            'Use low quality for early tests.',
            '5-12s',
            TRUE,
            TRUE,
            'geekai',
            '1k'
        ),
        (
            'nano-banana-2',
            'Nano Banana 2',
            'image_generation',
            '["image_generation","image_edit","image_reference"]'::jsonb,
            '{"aspectRatio":["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","9:21","1:4","4:1","1:8","8:1"],"imageSize":["0.5K","1K","2K","4K"]}'::jsonb,
            'Fast Nano Banana 2 image generation and edits.',
            '4-10s',
            TRUE,
            FALSE,
            'geekai',
            '1k'
        ),
        (
            'doubao-seedream-5.0-lite',
            'Doubao Seedream 5.0 Lite',
            'image_generation',
            '["image_generation","image_edit","image_reference"]'::jsonb,
            '{"seedreamOutputFormat":["png","jpeg"],"seedreamSize":["2K","3K","4K","2048x2048","2304x1728","1728x2304","2848x1600","1600x2848","2496x1664","1664x2496","3136x1344","3072x3072","3456x2592","2592x3456","4096x2304","2304x4096","3744x2496","2496x3744","4704x2016","4096x4096","3520x4704","4704x3520","5504x3040","3040x5504","3328x4992","4992x3328","6240x2656"]}'::jsonb,
            'ByteDance Seedream 5.0 Lite with single-image and grouped outputs.',
            '6-18s',
            TRUE,
            FALSE,
            'geekai',
            NULL
        ),
        (
            'jimeng_t2i_v40',
            'Jimeng Image 4.0',
            'image_generation',
            '["image_generation","image_edit","image_reference"]'::jsonb,
            '{"jimengSize":["1024x1024","2048x2048","2304x1728","2560x1440","2496x1664","3024x1296","4096x4096","4694x3520","4992x3328","5404x3040","6198x2656"],"jimengStrength":[0.3,0.5,0.7,0.9]}'::jsonb,
            'Jimeng 4.0 for image generation and multi-image edits.',
            '6-18s',
            TRUE,
            FALSE,
            'geekai',
            NULL
        )
    ON CONFLICT (model_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        capability = EXCLUDED.capability,
        capabilities = EXCLUDED.capabilities,
        parameter_schema = EXCLUDED.parameter_schema,
        cost_hint = EXCLUDED.cost_hint,
        estimated_latency = EXCLUDED.estimated_latency,
        enabled = EXCLUDED.enabled,
        is_default = EXCLUDED.is_default,
        provider_key = EXCLUDED.provider_key,
        default_tier_key = EXCLUDED.default_tier_key,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_parameter_tiers (
        id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled
    ) VALUES
        ('tier_nano_banana_2_0_5k', 'nano-banana-2', '0_5k', '0.5K', 'imageSize', '{"size":"0.5K"}'::jsonb, 10, TRUE),
        ('tier_nano_banana_2_1k', 'nano-banana-2', '1k', '1K', 'imageSize', '{"size":"1K"}'::jsonb, 20, TRUE),
        ('tier_nano_banana_2_2k', 'nano-banana-2', '2k', '2K', 'imageSize', '{"size":"2K"}'::jsonb, 30, TRUE),
        ('tier_nano_banana_2_4k', 'nano-banana-2', '4k', '4K', 'imageSize', '{"size":"4K"}'::jsonb, 40, TRUE)
    ON CONFLICT (model_key, tier_key) DO UPDATE SET
        public_label = EXCLUDED.public_label,
        parameter_key = EXCLUDED.parameter_key,
        provider_params = EXCLUDED.provider_params,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET enabled = FALSE,
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES
        (
            'route_gpt_image_2_primary',
            'gpt-image-2',
            'geekai',
            'geekai-primary',
            '["image_generation","image_edit"]'::jsonb,
            5,
            NULL,
            240000,
            '{"maxAttempts":2}'::jsonb,
            TRUE,
            'gpt-image-2',
            'geekai',
            'gpt-image-2',
            10,
            100,
            'healthy'
        ),
        (
            'route_nano_banana_2_primary',
            'nano-banana-2',
            'geekai',
            'geekai-primary',
            '["image_generation","image_edit","image_reference"]'::jsonb,
            4,
            NULL,
            240000,
            '{"maxAttempts":2}'::jsonb,
            TRUE,
            'nano-banana-2',
            'geekai',
            'nano-banana-2',
            10,
            100,
            'healthy'
        ),
        (
            'route_doubao_seedream_5_0_lite_primary',
            'doubao-seedream-5.0-lite',
            'geekai',
            'geekai-primary',
            '["image_generation","image_edit","image_reference"]'::jsonb,
            6,
            NULL,
            240000,
            '{"maxAttempts":2}'::jsonb,
            TRUE,
            'doubao-seedream-5.0-lite',
            'geekai',
            'doubao-seedream-5.0-lite',
            10,
            100,
            'healthy'
        ),
        (
            'route_jimeng_t2i_v40_primary',
            'jimeng_t2i_v40',
            'geekai',
            'geekai-primary',
            '["image_generation","image_edit","image_reference"]'::jsonb,
            6,
            NULL,
            240000,
            '{"maxAttempts":2}'::jsonb,
            TRUE,
            'jimeng_t2i_v40',
            'geekai',
            'jimeng_t2i_v40',
            10,
            100,
            'healthy'
        )
    ON CONFLICT (id) DO UPDATE SET
        model_id = EXCLUDED.model_id,
        provider = EXCLUDED.provider,
        route_key = EXCLUDED.route_key,
        capabilities = EXCLUDED.capabilities,
        credit_cost = EXCLUDED.credit_cost,
        raw_cost_estimate = EXCLUDED.raw_cost_estimate,
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
    UPDATE tangent_model_provider_routes
    SET enabled = FALSE,
        health_status = 'disabled',
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
    """,
    """
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES
        ('price_nano_banana_2_0_5k_v1', 'nano-banana-2', '0_5k', 'per_image', 2.5, 2.5, 1, '{"amount":0.015,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_nano_banana_2_1k_v1', 'nano-banana-2', '1k', 'per_image', 4, 4, 1, '{"amount":0.03,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_nano_banana_2_2k_v1', 'nano-banana-2', '2k', 'per_image', 7, 7, 1, '{"amount":0.06,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_nano_banana_2_4k_v1', 'nano-banana-2', '4k', 'per_image', 12, 12, 1, '{"amount":0.12,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW())
    ON CONFLICT (id) DO UPDATE SET
        model_key = EXCLUDED.model_key,
        tier_key = EXCLUDED.tier_key,
        billing_unit = EXCLUDED.billing_unit,
        estimated_credits = EXCLUDED.estimated_credits,
        min_credits = EXCLUDED.min_credits,
        credit_multiplier = EXCLUDED.credit_multiplier,
        provider_cost_formula = EXCLUDED.provider_cost_formula,
        status = EXCLUDED.status,
        effective_from = EXCLUDED.effective_from,
        effective_to = EXCLUDED.effective_to,
        updated_at = NOW()
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_gpt_image_2_1k_v1',
        updated_at = NOW()
    WHERE model_key = 'gpt-image-2'
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_nano_banana_2_1k_v1',
        updated_at = NOW()
    WHERE model_key = 'nano-banana-2'
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = NULL,
        updated_at = NOW()
    WHERE model_key IN ('doubao-seedream-5.0-lite', 'jimeng_t2i_v40')
    """,
    """
    UPDATE tangent_model_registry
    SET enabled = FALSE,
        is_default = FALSE,
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET status = 'retired',
        effective_to = COALESCE(effective_to, NOW()),
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
      AND status <> 'retired'
    """,
]


DOWNGRADE = [
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"aspectRatio":["auto","1:1","4:3","16:9","3:2"],"resolution":["0.5K","1K","2K"]}'::jsonb,
        default_pricing_rule_id = 'price_gpt_image_2_1k_v1',
        updated_at = NOW()
    WHERE model_key = 'gpt-image-2'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET timeout_ms = 120000,
        enabled = TRUE,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE id = 'route_gpt_image_2_primary'
    """,
    """
    UPDATE tangent_model_registry
    SET enabled = TRUE,
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET enabled = TRUE,
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET enabled = TRUE,
        health_status = 'healthy',
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET status = 'active',
        effective_to = NULL,
        updated_at = NOW()
    WHERE model_key = 'gemini-3.1-flash-image-preview'
    """,
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_jimeng_t2i_v40_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_doubao_seedream_5_0_lite_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_nano_banana_2_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_nano_banana_2_4k_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_nano_banana_2_2k_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_nano_banana_2_1k_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_nano_banana_2_0_5k_v1'",
    "DELETE FROM tangent_model_parameter_tiers WHERE id = 'tier_nano_banana_2_4k'",
    "DELETE FROM tangent_model_parameter_tiers WHERE id = 'tier_nano_banana_2_2k'",
    "DELETE FROM tangent_model_parameter_tiers WHERE id = 'tier_nano_banana_2_1k'",
    "DELETE FROM tangent_model_parameter_tiers WHERE id = 'tier_nano_banana_2_0_5k'",
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = NULL,
        updated_at = NOW()
    WHERE model_key IN ('doubao-seedream-5.0-lite', 'jimeng_t2i_v40', 'nano-banana-2')
    """,
    "DELETE FROM tangent_model_registry WHERE model_key = 'jimeng_t2i_v40'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'doubao-seedream-5.0-lite'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'nano-banana-2'",
]
