"""seed default analysis ai models and routes

Revision ID: 20260513_0020
Revises: 20260513_0019
Create Date: 2026-05-13
"""

from alembic import op


revision = "20260513_0020"
down_revision = "20260513_0019"
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
    ) VALUES (
        'gpt-5-mini',
        'GPT-5 Mini',
        'text',
        '["text","image_analysis"]'::jsonb,
        '{}'::jsonb,
        'Balanced multimodal model for chat and image analysis.',
        '1-4s',
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
        provider_key = EXCLUDED.provider_key,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key
    ) VALUES (
        'gpt-4o-mini',
        'GPT-4o Mini',
        'image_analysis',
        '["image_analysis"]'::jsonb,
        '{}'::jsonb,
        'Fast vision analysis for image prompt extraction and comparisons.',
        '1-4s',
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
        provider_key = EXCLUDED.provider_key,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key
    ) VALUES (
        'gemini-2.5-flash',
        'Gemini 2.5 Flash Vision',
        'image_analysis',
        '["image_analysis"]'::jsonb,
        '{}'::jsonb,
        'Gemini vision analysis through GeekAI chat completions.',
        '1-4s',
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
        provider_key = EXCLUDED.provider_key,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES (
        'route_gpt_5_mini_primary',
        'gpt-5-mini',
        'geekai',
        'geekai-multimodal-primary',
        '["text","image_analysis"]'::jsonb,
        2,
        NULL,
        45000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'gpt-5-mini',
        'geekai',
        'gpt-5-mini',
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
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES (
        'route_gpt_4o_mini_primary',
        'gpt-4o-mini',
        'geekai',
        'geekai-vision-fast',
        '["image_analysis"]'::jsonb,
        1.5,
        NULL,
        45000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'gpt-4o-mini',
        'geekai',
        'gpt-4o-mini',
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
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES (
        'route_gemini_2_5_flash_primary',
        'gemini-2.5-flash',
        'geekai',
        'geekai-vision-gemini',
        '["image_analysis"]'::jsonb,
        2,
        NULL,
        45000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'gemini-2.5-flash',
        'geekai',
        'gemini-2.5-flash',
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
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES (
        'price_gpt_5_mini_v1',
        'gpt-5-mini',
        NULL,
        'per_run',
        2,
        2,
        1,
        '{"amount":0.01,"currency":"USD","type":"per_run"}'::jsonb,
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
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES (
        'price_gpt_4o_mini_v1',
        'gpt-4o-mini',
        NULL,
        'per_run',
        1.5,
        1.5,
        1,
        '{"amount":0.008,"currency":"USD","type":"per_run"}'::jsonb,
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
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES (
        'price_gemini_2_5_flash_v1',
        'gemini-2.5-flash',
        NULL,
        'per_run',
        2,
        2,
        1,
        '{"amount":0.012,"currency":"USD","type":"per_run"}'::jsonb,
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
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_gpt_5_mini_v1',
        updated_at = NOW()
    WHERE model_key = 'gpt-5-mini'
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_gpt_4o_mini_v1',
        updated_at = NOW()
    WHERE model_key = 'gpt-4o-mini'
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_gemini_2_5_flash_v1',
        updated_at = NOW()
    WHERE model_key = 'gemini-2.5-flash'
    """,
]


DOWNGRADE = [
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gemini_2_5_flash_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_4o_mini_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_5_mini_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gemini_2_5_flash_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gpt_4o_mini_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gpt_5_mini_v1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gemini-2.5-flash'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gpt-4o-mini'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gpt-5-mini'",
]
