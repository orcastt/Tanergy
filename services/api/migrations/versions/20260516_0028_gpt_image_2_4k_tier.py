"""align GPT Image 2 ratio UI with 4K pricing tier

Revision ID: 20260516_0028
Revises: 20260516_0027
Create Date: 2026-05-16
"""

from alembic import op


revision = "20260516_0028"
down_revision = "20260516_0027"
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
    SET parameter_schema = '{"aspectRatio":["1:1","2:3","3:2","3:4","4:3","9:16","16:9","21:9","9:21","2:1","1:2","3:1","1:3"],"resolution":["1K","2K","4K"]}'::jsonb,
        cost_hint = 'Aspect ratio UI maps to the supported Jiekou GPT Image 2 render tiers.',
        updated_at = NOW()
    WHERE model_key = 'gpt-image-2'
    """,
    """
    DELETE FROM tangent_model_parameter_tiers
    WHERE id = 'tier_gpt_image_2_0_5k'
    """,
    """
    DELETE FROM tangent_model_pricing_rules
    WHERE id = 'price_gpt_image_2_0_5k_v1'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET sort_order = 10,
        updated_at = NOW()
    WHERE id = 'tier_gpt_image_2_1k'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET sort_order = 20,
        updated_at = NOW()
    WHERE id = 'tier_gpt_image_2_2k'
    """,
    """
    INSERT INTO tangent_model_parameter_tiers (
        id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled
    ) VALUES (
        'tier_gpt_image_2_4k',
        'gpt-image-2',
        '4k',
        '4K',
        'resolution',
        '{"resolution":"4K"}'::jsonb,
        30,
        TRUE
    )
    ON CONFLICT (model_key, tier_key) DO UPDATE SET
        id = EXCLUDED.id,
        public_label = EXCLUDED.public_label,
        parameter_key = EXCLUDED.parameter_key,
        provider_params = EXCLUDED.provider_params,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled
    """,
    """
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES (
        'price_gpt_image_2_4k_v1',
        'gpt-image-2',
        '4k',
        'per_image',
        16,
        16,
        1,
        '{"amount":0.16,"currency":"USD","type":"per_image"}'::jsonb,
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
]


DOWNGRADE = [
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"quality":["low","medium","high"],"size":["1024x1024","1024x1536","1536x1024","2048x2048","2048x1152","3840x2160","2160x3840","2048x1360","1360x2048","1152x2048","2048x1536","1536x2048","2048x880","880x2048","688x2048","2048x688","2048x1024","1024x2048"]}'::jsonb,
        cost_hint = 'Use low quality for early tests.',
        updated_at = NOW()
    WHERE model_key = 'gpt-image-2'
    """,
    """
    INSERT INTO tangent_model_parameter_tiers (
        id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled
    ) VALUES (
        'tier_gpt_image_2_0_5k',
        'gpt-image-2',
        '0_5k',
        '0.5K',
        'resolution',
        '{"resolution":"0.5K"}'::jsonb,
        10,
        TRUE
    )
    ON CONFLICT (model_key, tier_key) DO UPDATE SET
        id = EXCLUDED.id,
        public_label = EXCLUDED.public_label,
        parameter_key = EXCLUDED.parameter_key,
        provider_params = EXCLUDED.provider_params,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled
    """,
    """
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES (
        'price_gpt_image_2_0_5k_v1',
        'gpt-image-2',
        '0_5k',
        'per_image',
        3,
        3,
        1,
        '{"amount":0.02,"currency":"USD","type":"per_image"}'::jsonb,
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
    SET sort_order = 20,
        updated_at = NOW()
    WHERE id = 'tier_gpt_image_2_1k'
    """,
    """
    UPDATE tangent_model_parameter_tiers
    SET sort_order = 30,
        updated_at = NOW()
    WHERE id = 'tier_gpt_image_2_2k'
    """,
    "DELETE FROM tangent_model_parameter_tiers WHERE id = 'tier_gpt_image_2_4k'",
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_gpt_image_2_4k_v1'",
]
