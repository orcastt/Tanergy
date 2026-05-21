"""seed jiekou text and multimodal models

Revision ID: 20260516_0026
Revises: 20260516_0025
Create Date: 2026-05-16
"""

from alembic import op


revision = "20260516_0026"
down_revision = "20260516_0025"
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
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE model_key = 'gpt-5.5'
    """,
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key
    ) VALUES (
        'deepseek/deepseek-ocr-2',
        'DeepSeek OCR 2',
        'text',
        '["text","image_analysis"]'::jsonb,
        '{}'::jsonb,
        'Low-cost multimodal OCR and document understanding for chat and visual analysis.',
        '1-4s',
        TRUE,
        TRUE,
        'jiekou',
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
    ) VALUES (
        'deepseek/deepseek-v3.1',
        'DeepSeek V3.1',
        'text',
        '["text"]'::jsonb,
        '{}'::jsonb,
        'Fast text reasoning for prompt optimization and general chat.',
        '1-4s',
        TRUE,
        FALSE,
        'jiekou',
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
        'qwen/qwen2.5-vl-72b-instruct',
        'Qwen 2.5 VL 72B',
        'image_analysis',
        '["text","image_analysis"]'::jsonb,
        '{}'::jsonb,
        'Higher-context multimodal fallback for harder visual reasoning.',
        '2-8s',
        TRUE,
        FALSE,
        'jiekou',
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
        'route_deepseek_ocr_2_primary',
        'deepseek/deepseek-ocr-2',
        'jiekou',
        'jiekou-deepseek-ocr-2-primary',
        '["text","image_analysis"]'::jsonb,
        1,
        NULL,
        60000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'deepseek/deepseek-ocr-2',
        'jiekou',
        'deepseek/deepseek-ocr-2',
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
        'route_deepseek_v3_1_primary',
        'deepseek/deepseek-v3.1',
        'jiekou',
        'jiekou-deepseek-v3-1-primary',
        '["text"]'::jsonb,
        2,
        NULL,
        60000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'deepseek/deepseek-v3.1',
        'jiekou',
        'deepseek/deepseek-v3.1',
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
        'route_qwen_2_5_vl_72b_primary',
        'qwen/qwen2.5-vl-72b-instruct',
        'jiekou',
        'jiekou-qwen-2-5-vl-72b-primary',
        '["text","image_analysis"]'::jsonb,
        3,
        NULL,
        90000,
        '{"maxAttempts":2}'::jsonb,
        TRUE,
        'qwen/qwen2.5-vl-72b-instruct',
        'jiekou',
        'qwen/qwen2.5-vl-72b-instruct',
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
        'price_deepseek_ocr_2_v1',
        'deepseek/deepseek-ocr-2',
        NULL,
        'per_run',
        1,
        1,
        1,
        '{"amount":0.005,"currency":"USD","type":"per_run"}'::jsonb,
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
        'price_deepseek_v3_1_v1',
        'deepseek/deepseek-v3.1',
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
        'price_qwen_2_5_vl_72b_v1',
        'qwen/qwen2.5-vl-72b-instruct',
        NULL,
        'per_run',
        3,
        3,
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
    SET default_pricing_rule_id = 'price_deepseek_ocr_2_v1',
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-ocr-2'
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_deepseek_v3_1_v1',
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-v3.1'
    """,
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_qwen_2_5_vl_72b_v1',
        updated_at = NOW()
    WHERE model_key = 'qwen/qwen2.5-vl-72b-instruct'
    """,
]


DOWNGRADE = [
    "UPDATE tangent_model_registry SET is_default = TRUE, updated_at = NOW() WHERE model_key = 'gpt-5.5'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_deepseek_ocr_2_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_deepseek_v3_1_primary'",
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_qwen_2_5_vl_72b_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_deepseek_ocr_2_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_deepseek_v3_1_v1'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_qwen_2_5_vl_72b_v1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'deepseek/deepseek-ocr-2'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'deepseek/deepseek-v3.1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'qwen/qwen2.5-vl-72b-instruct'",
]
