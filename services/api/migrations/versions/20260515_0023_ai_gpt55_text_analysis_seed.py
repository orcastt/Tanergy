"""seed gpt-5.5 text and analysis model

Revision ID: 20260515_0023
Revises: 20260515_0022
Create Date: 2026-05-15
"""

from alembic import op


revision = "20260515_0023"
down_revision = "20260515_0022"
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
        provider_key = EXCLUDED.provider_key,
        updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES (
        'route_gpt_5_5_primary',
        'gpt-5.5',
        'geekai',
        'geekai-gpt55-primary',
        '["text","image_analysis"]'::jsonb,
        4,
        NULL,
        60000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'gpt-5.5',
        'geekai',
        'gpt-5.5',
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
        'price_gpt_5_5_v1',
        'gpt-5.5',
        NULL,
        'per_run',
        4,
        4,
        1,
        '{"amount":0.02,"currency":"USD","type":"per_run"}'::jsonb,
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
    SET default_pricing_rule_id = 'price_gpt_5_5_v1',
        updated_at = NOW()
    WHERE model_key = 'gpt-5.5'
    """,
]


DOWNGRADE = [
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_gpt_5_5_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gpt_5_5_v1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'gpt-5.5'",
]
