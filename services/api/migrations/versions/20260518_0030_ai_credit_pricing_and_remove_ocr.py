"""price AI runs by Jiekou cost and remove DeepSeek OCR 2

Revision ID: 20260518_0030
Revises: 20260518_0029
Create Date: 2026-05-18
"""

from alembic import op


revision = "20260518_0030"
down_revision = "20260518_0029"
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


UPSERT_PRICING = """
INSERT INTO tangent_model_pricing_rules (
    id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
    credit_multiplier, provider_cost_formula, status, effective_from
) VALUES {values}
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
"""


UPGRADE = [
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = NULL,
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-ocr-2'
    """,
    "DELETE FROM tangent_model_provider_routes WHERE id = 'route_deepseek_ocr_2_primary'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_deepseek_ocr_2_v1'",
    "DELETE FROM tangent_model_registry WHERE model_key = 'deepseek/deepseek-ocr-2'",
    """
    UPDATE tangent_model_registry
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE capabilities @> '["text"]'::jsonb
    """,
    """
    UPDATE tangent_model_registry
    SET cost_hint = 'Token-priced text reasoning for prompt optimization and general chat.',
        enabled = TRUE,
        is_default = TRUE,
        provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-v3.1'
    """,
    """
    UPDATE tangent_model_registry
    SET cost_hint = 'Higher-context multimodal fallback for harder visual reasoning.',
        enabled = TRUE,
        is_default = FALSE,
        provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key = 'qwen/qwen2.5-vl-72b-instruct'
    """,
    UPSERT_PRICING.format(
        values="""
        (
            'price_deepseek_v3_1_v1',
            'deepseek/deepseek-v3.1',
            NULL,
            'per_run',
            1,
            1,
            1,
            '{"type":"token_usage_estimate","currency":"USD","inputUsdPerMTok":0.27,"outputUsdPerMTok":1.0,"estimatedInputTokens":1200,"estimatedOutputTokens":800,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_qwen_2_5_vl_72b_v1',
            'qwen/qwen2.5-vl-72b-instruct',
            NULL,
            'per_run',
            3,
            3,
            1,
            '{"type":"token_usage_estimate","currency":"USD","inputUsdPerMTok":0.8,"outputUsdPerMTok":0.8,"estimatedInputTokens":1600,"estimatedOutputTokens":900,"imageInputTokens":1200,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_gpt_image_2_1k_v1',
            'gpt-image-2',
            '1k',
            'per_image',
            5.5,
            5.5,
            1,
            '{"type":"per_image","currency":"USD","amount":0.04,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_gpt_image_2_2k_v1',
            'gpt-image-2',
            '2k',
            'per_image',
            11,
            11,
            1,
            '{"type":"per_image","currency":"USD","amount":0.08,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_gpt_image_2_4k_v1',
            'gpt-image-2',
            '4k',
            'per_image',
            21.5,
            21.5,
            1,
            '{"type":"per_image","currency":"USD","amount":0.16,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_nano_banana_2_0_5k_v1',
            'nano-banana-2',
            '0_5k',
            'per_image',
            2,
            2,
            1,
            '{"type":"per_image","currency":"USD","amount":0.015,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_nano_banana_2_1k_v1',
            'nano-banana-2',
            '1k',
            'per_image',
            4,
            4,
            1,
            '{"type":"per_image","currency":"USD","amount":0.03,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_nano_banana_2_2k_v1',
            'nano-banana-2',
            '2k',
            'per_image',
            8,
            8,
            1,
            '{"type":"per_image","currency":"USD","amount":0.06,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_nano_banana_2_4k_v1',
            'nano-banana-2',
            '4k',
            'per_image',
            16,
            16,
            1,
            '{"type":"per_image","currency":"USD","amount":0.12,"grossMargin":0.25,"creditUsd":0.01}'::jsonb,
            'active',
            NOW()
        ),
        (
            'price_doubao_seedream_5_0_lite_v1',
            'doubao-seedream-5.0-lite',
            NULL,
            'per_image',
            5,
            5,
            1,
            '{"type":"per_image","currency":"USD","amount":0.035,"grossMargin":0.25,"creditUsd":0.01,"source":"seedream_5_lite_market_reference_pending_jiekou_price_table"}'::jsonb,
            'active',
            NOW()
        )
        """
    ),
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
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_doubao_seedream_5_0_lite_v1',
        updated_at = NOW()
    WHERE model_key = 'doubao-seedream-5.0-lite'
    """,
]


DOWNGRADE = [
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key
    ) VALUES ('deepseek/deepseek-ocr-2', 'DeepSeek OCR 2', 'text', '["text","image_analysis"]'::jsonb, '{}'::jsonb,
        'Low-cost multimodal OCR and document understanding for chat and visual analysis.', '1-4s', TRUE, TRUE, 'jiekou', NULL)
    ON CONFLICT (model_key) DO UPDATE SET
        display_name = EXCLUDED.display_name, capability = EXCLUDED.capability,
        capabilities = EXCLUDED.capabilities, parameter_schema = EXCLUDED.parameter_schema,
        cost_hint = EXCLUDED.cost_hint, estimated_latency = EXCLUDED.estimated_latency,
        enabled = EXCLUDED.enabled, is_default = EXCLUDED.is_default,
        provider_key = EXCLUDED.provider_key, updated_at = NOW()
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES ('route_deepseek_ocr_2_primary', 'deepseek/deepseek-ocr-2', 'jiekou', 'jiekou-deepseek-ocr-2-primary',
        '["text","image_analysis"]'::jsonb, 1, NULL, 60000, '{"maxAttempts":2}'::jsonb, TRUE,
        'deepseek/deepseek-ocr-2', 'jiekou', 'deepseek/deepseek-ocr-2', 10, 100, 'healthy')
    ON CONFLICT (id) DO UPDATE SET
        enabled = EXCLUDED.enabled, model_key = EXCLUDED.model_key,
        provider_key = EXCLUDED.provider_key, provider_model = EXCLUDED.provider_model,
        health_status = EXCLUDED.health_status, updated_at = NOW()
    """,
    UPSERT_PRICING.format(
        values="""
        ('price_deepseek_ocr_2_v1', 'deepseek/deepseek-ocr-2', NULL, 'per_run', 1, 1, 1, '{"amount":0.005,"currency":"USD","type":"per_run"}'::jsonb, 'active', NOW()),
        ('price_deepseek_v3_1_v1', 'deepseek/deepseek-v3.1', NULL, 'per_run', 1.5, 1.5, 1, '{"amount":0.008,"currency":"USD","type":"per_run"}'::jsonb, 'active', NOW()),
        ('price_qwen_2_5_vl_72b_v1', 'qwen/qwen2.5-vl-72b-instruct', NULL, 'per_run', 3, 3, 1, '{"amount":0.02,"currency":"USD","type":"per_run"}'::jsonb, 'active', NOW()),
        ('price_gpt_image_2_1k_v1', 'gpt-image-2', '1k', 'per_image', 5, 5, 1, '{"amount":0.04,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_gpt_image_2_2k_v1', 'gpt-image-2', '2k', 'per_image', 9, 9, 1, '{"amount":0.08,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_gpt_image_2_4k_v1', 'gpt-image-2', '4k', 'per_image', 16, 16, 1, '{"amount":0.16,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_nano_banana_2_0_5k_v1', 'nano-banana-2', '0_5k', 'per_image', 2.5, 2.5, 1, '{"amount":0.015,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_nano_banana_2_1k_v1', 'nano-banana-2', '1k', 'per_image', 4, 4, 1, '{"amount":0.03,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_nano_banana_2_2k_v1', 'nano-banana-2', '2k', 'per_image', 7, 7, 1, '{"amount":0.06,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW()),
        ('price_nano_banana_2_4k_v1', 'nano-banana-2', '4k', 'per_image', 12, 12, 1, '{"amount":0.12,"currency":"USD","type":"per_image"}'::jsonb, 'active', NOW())
        """
    ),
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_doubao_seedream_5_0_lite_v1'",
    """
    UPDATE tangent_model_registry
    SET default_pricing_rule_id = 'price_deepseek_ocr_2_v1',
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-ocr-2'
    """,
    """
    UPDATE tangent_model_registry
    SET is_default = FALSE,
        updated_at = NOW()
    WHERE model_key = 'deepseek/deepseek-v3.1'
    """,
]
