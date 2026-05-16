"""retire legacy GeekAI control-plane routes

Revision ID: 20260516_0027
Revises: 20260516_0026
Create Date: 2026-05-16
"""

from alembic import op


revision = "20260516_0027"
down_revision = "20260516_0026"
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
    SET default_pricing_rule_id = NULL,
        is_default = FALSE,
        updated_at = NOW()
    WHERE model_key IN ('gpt-5.5', 'gpt-5-mini', 'gpt-4o-mini', 'gemini-2.5-flash', 'jimeng_t2i_v40')
    """,
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_5_5_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_5_mini_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_4o_mini_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gemini_2_5_flash_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_image_2_geekai_fallback'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_nano_banana_2_geekai_fallback'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_doubao_seedream_5_0_lite_geekai_fallback'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_jimeng_t2i_v40_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gpt_5_5_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gpt_5_mini_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gpt_4o_mini_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gemini_2_5_flash_v1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gpt-5.5'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gpt-5-mini'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gpt-4o-mini'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gemini-2.5-flash'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'jimeng_t2i_v40'",
]


DOWNGRADE = [
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key
    ) VALUES (
        'gpt-5.5',
        'GPT-5.5',
        'text',
        '["text","image_analysis"]'::jsonb,
        '{}'::jsonb,
        'Higher-quality multimodal reasoning for chat and image reverse prompting.',
        '2-8s',
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
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key
    ) VALUES
        ('gpt-5-mini', 'GPT-5 Mini', 'text', '["text","image_analysis"]'::jsonb, '{}'::jsonb, 'Balanced multimodal model for chat and image analysis.', '1-4s', TRUE, FALSE, 'geekai', NULL),
        ('gpt-4o-mini', 'GPT-4o Mini', 'image_analysis', '["image_analysis"]'::jsonb, '{}'::jsonb, 'Fast vision analysis for image prompt extraction and comparisons.', '1-4s', TRUE, FALSE, 'geekai', NULL),
        ('gemini-2.5-flash', 'Gemini 2.5 Flash Vision', 'image_analysis', '["image_analysis"]'::jsonb, '{}'::jsonb, 'Gemini vision analysis through GeekAI chat completions.', '1-4s', TRUE, FALSE, 'geekai', NULL),
        ('jimeng_t2i_v40', 'Jimeng Image 4.0', 'image_generation', '["image_generation","image_edit","image_reference"]'::jsonb, '{"jimengSize":["1024x1024","2048x2048","2304x1728","2560x1440","2496x1664","3024x1296","4096x4096","4694x3520","4992x3328","5404x3040","6198x2656"],"jimengStrength":[0.3,0.5,0.7,0.9]}'::jsonb, 'Jimeng 4.0 for image generation and multi-image edits.', '6-18s', TRUE, FALSE, 'geekai', NULL)
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
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES
        ('route_gpt_5_5_primary', 'gpt-5.5', 'geekai', 'geekai-gpt55-primary', '["text","image_analysis"]'::jsonb, 4, NULL, 60000, '{"maxAttempts":2}'::jsonb, TRUE, 'gpt-5.5', 'geekai', 'gpt-5.5', 10, 100, 'healthy'),
        ('route_gpt_5_mini_primary', 'gpt-5-mini', 'geekai', 'geekai-multimodal-primary', '["text","image_analysis"]'::jsonb, 2, NULL, 45000, '{"maxAttempts":2}'::jsonb, TRUE, 'gpt-5-mini', 'geekai', 'gpt-5-mini', 10, 100, 'healthy'),
        ('route_gpt_4o_mini_primary', 'gpt-4o-mini', 'geekai', 'geekai-vision-fast', '["image_analysis"]'::jsonb, 1.5, NULL, 45000, '{"maxAttempts":2}'::jsonb, TRUE, 'gpt-4o-mini', 'geekai', 'gpt-4o-mini', 10, 100, 'healthy'),
        ('route_gemini_2_5_flash_primary', 'gemini-2.5-flash', 'geekai', 'geekai-vision-gemini', '["image_analysis"]'::jsonb, 2, NULL, 45000, '{"maxAttempts":2}'::jsonb, TRUE, 'gemini-2.5-flash', 'geekai', 'gemini-2.5-flash', 10, 100, 'healthy'),
        ('route_gpt_image_2_geekai_fallback', 'gpt-image-2', 'geekai', 'geekai-gpt-image-2-fallback', '["image_generation","image_edit"]'::jsonb, 5, NULL, 240000, '{"maxAttempts":2}'::jsonb, TRUE, 'gpt-image-2', 'geekai', 'gpt-image-2', 20, 80, 'healthy'),
        ('route_nano_banana_2_geekai_fallback', 'nano-banana-2', 'geekai', 'geekai-nano-banana-2-fallback', '["image_generation","image_edit","image_reference"]'::jsonb, 4, NULL, 240000, '{"maxAttempts":2}'::jsonb, TRUE, 'nano-banana-2', 'geekai', 'nano-banana-2', 20, 80, 'healthy'),
        ('route_doubao_seedream_5_0_lite_geekai_fallback', 'doubao-seedream-5.0-lite', 'geekai', 'geekai-seedream-5-lite-fallback', '["image_generation","image_edit","image_reference"]'::jsonb, 0, NULL, 240000, '{"maxAttempts":2}'::jsonb, TRUE, 'doubao-seedream-5.0-lite', 'geekai', 'doubao-seedream-5.0-lite', 20, 80, 'healthy'),
        ('route_jimeng_t2i_v40_primary', 'jimeng_t2i_v40', 'geekai', 'geekai-primary', '["image_generation","image_edit","image_reference"]'::jsonb, 0, NULL, 240000, '{"maxAttempts":2}'::jsonb, TRUE, 'jimeng_t2i_v40', 'geekai', 'jimeng_t2i_v40', 10, 100, 'healthy')
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
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES
        ('price_gpt_5_5_v1', 'gpt-5.5', NULL, 'per_run', 4, 4, 1, '{"amount":0.02,"currency":"USD","type":"per_run"}'::jsonb, 'active', NOW()),
        ('price_gpt_5_mini_v1', 'gpt-5-mini', NULL, 'per_run', 2, 2, 1, '{"amount":0.01,"currency":"USD","type":"per_run"}'::jsonb, 'active', NOW()),
        ('price_gpt_4o_mini_v1', 'gpt-4o-mini', NULL, 'per_run', 1.5, 1.5, 1, '{"amount":0.008,"currency":"USD","type":"per_run"}'::jsonb, 'active', NOW()),
        ('price_gemini_2_5_flash_v1', 'gemini-2.5-flash', NULL, 'per_run', 2, 2, 1, '{"amount":0.012,"currency":"USD","type":"per_run"}'::jsonb, 'active', NOW())
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
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_gpt_5_5_v1',
        updated_at = NOW()
    WHERE model_key = 'gpt-5.5'
    """,
]
