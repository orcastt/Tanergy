"""map Nano Banana 2 to Jiekou Gemini 3.1 Flash image endpoints

Revision ID: 20260518_0029
Revises: 20260516_0028
Create Date: 2026-05-18
"""

from alembic import op


revision = "20260518_0029"
down_revision = "20260516_0028"
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
    SET parameter_schema = '{"aspectRatio":["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","1:4","4:1","1:8","8:1"],"imageSize":["0.5K","1K","2K","4K"]}'::jsonb,
        provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key = 'nano-banana-2'
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
        5,
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
    UPDATE tangent_model_provider_routes
    SET provider_model = 'gemini-3.1-flash-image',
        updated_at = NOW()
    WHERE id = 'route_nano_banana_2_primary'
    """,
]


DOWNGRADE = [
    """
    UPDATE tangent_model_registry
    SET parameter_schema = '{"aspectRatio":["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","1:4","4:1","1:8","8:1"],"imageSize":["1K","2K","4K"]}'::jsonb,
        provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key = 'nano-banana-2'
    """,
    "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_nano_banana_2_0_5k_v1'",
    "DELETE FROM tangent_model_parameter_tiers WHERE id = 'tier_nano_banana_2_0_5k'",
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
    SET provider_model = 'nano-banana-2',
        updated_at = NOW()
    WHERE id = 'route_nano_banana_2_primary'
    """,
]
