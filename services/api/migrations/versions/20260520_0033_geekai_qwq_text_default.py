"""make GeekAI QwQ the active text default

Revision ID: 20260520_0033
Revises: 20260520_0032
Create Date: 2026-05-20
"""

from alembic import op


revision = "20260520_0033"
down_revision = "20260520_0032"
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


QWQ_COST_FORMULA = """
'{
  "type":"token_usage_estimate",
  "currency":"USD",
  "inputUsdPerMTok":0.0,
  "outputUsdPerMTok":0.0,
  "estimatedInputTokens":1200,
  "estimatedOutputTokens":800,
  "grossMargin":0.25,
  "creditUsd":0.01,
  "source":"geekai_model_page_is_free_true"
}'::jsonb
"""


UPSERT_QWQ_MODEL = """
INSERT INTO tangent_model_registry (
    model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
    estimated_latency, enabled, is_default, provider_key, default_tier_key,
    default_pricing_rule_id
) VALUES (
    'qwq-plus-latest',
    'QwQ Plus Latest',
    'text',
    '["text"]'::jsonb,
    '{}'::jsonb,
    'GeekAI streaming chat default for canvas chat and prompt optimization.',
    '2-8s',
    TRUE,
    TRUE,
    'geekai',
    NULL,
    'price_qwq_plus_latest_v1'
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
    default_pricing_rule_id = EXCLUDED.default_pricing_rule_id,
    updated_at = NOW()
"""


UPSERT_QWQ_ROUTE = """
INSERT INTO tangent_model_provider_routes (
    id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
    timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
    priority, weight, health_status
) VALUES (
    'route_qwq_plus_latest_primary',
    'qwq-plus-latest',
    'geekai',
    'geekai-qwq-plus-latest-primary',
    '["text"]'::jsonb,
    1,
    NULL,
    90000,
    '{"maxAttempts":2}'::jsonb,
    TRUE,
    'qwq-plus-latest',
    'geekai',
    'qwq-plus-latest',
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
"""


UPGRADE = [
    """
    UPDATE tangent_model_registry
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE capabilities @> '["text"]'::jsonb
    """,
    """
    UPDATE tangent_model_registry
    SET is_default = FALSE,
        provider_key = 'geekai',
        cost_hint = 'GeekAI fallback text model kept for operator rollback.',
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-v3.1'
    """,
    UPSERT_QWQ_MODEL,
    UPSERT_QWQ_ROUTE,
    f"""
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES (
        'price_qwq_plus_latest_v1',
        'qwq-plus-latest',
        NULL,
        'per_run',
        1,
        1,
        1,
        {QWQ_COST_FORMULA},
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
        effective_to = NULL,
        updated_at = NOW()
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_qwq_plus_latest_v1',
        updated_at = NOW()
    WHERE model_key = 'qwq-plus-latest'
    """,
]


DOWNGRADE = [
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_qwq_plus_latest_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_qwq_plus_latest_v1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'qwq-plus-latest'",
    """
    UPDATE tangent_model_registry
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE capabilities @> '["text"]'::jsonb
    """,
    """
    UPDATE tangent_model_registry
    SET is_default = TRUE,
        cost_hint = 'Token-priced text reasoning for prompt optimization and general chat.',
        default_pricing_rule_id = 'price_deepseek_v3_1_v1',
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-v3.1'
    """,
]
