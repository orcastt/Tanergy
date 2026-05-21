"""seed default text ai model and route

Revision ID: 20260511_0016
Revises: 20260511_0015
Create Date: 2026-05-11
"""

from alembic import op


revision = "20260511_0016"
down_revision = "20260511_0015"
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
        'hunyuan-3.0-preview',
        'Hunyuan 3.0 Preview',
        'text',
        '["text"]'::jsonb,
        '{}'::jsonb,
        'Fast streaming chat for node conversations.',
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
        'route_hunyuan_text_primary',
        'hunyuan-3.0-preview',
        'geekai',
        'geekai-text-primary',
        '["text"]'::jsonb,
        1,
        NULL,
        45000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'hunyuan-3.0-preview',
        'geekai',
        'hunyuan-3.0-preview',
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
        'price_hunyuan_text_v1',
        'hunyuan-3.0-preview',
        NULL,
        'per_run',
        1,
        1,
        1,
        '{"amount":0.002,"currency":"USD","type":"per_run"}'::jsonb,
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
    SET default_pricing_rule_id = 'price_hunyuan_text_v1',
        updated_at = NOW()
    WHERE model_key = 'hunyuan-3.0-preview'
    """,
]


DOWNGRADE = [
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_hunyuan_text_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_hunyuan_text_v1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'hunyuan-3.0-preview'",
]
