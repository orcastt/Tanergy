"""add ai runtime provider currency and cost formula defaults

Revision ID: 20260506_0010
Revises: 20260506_0009
Create Date: 2026-05-06
"""

from alembic import op


revision = "20260506_0010"
down_revision = "20260506_0009"
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
    "ALTER TABLE tangent_ai_api_calls ADD COLUMN IF NOT EXISTS provider_currency TEXT",
    """
    UPDATE tangent_model_pricing_rules
    SET provider_cost_formula = '{"type":"per_image","currency":"USD","amount":0.02}'::jsonb
    WHERE id = 'price_gpt_image_2_0_5k_v1' AND COALESCE(provider_cost_formula ->> 'amount', '') = ''
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET provider_cost_formula = '{"type":"per_image","currency":"USD","amount":0.04}'::jsonb
    WHERE id = 'price_gpt_image_2_1k_v1' AND COALESCE(provider_cost_formula ->> 'amount', '') = ''
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET provider_cost_formula = '{"type":"per_image","currency":"USD","amount":0.08}'::jsonb
    WHERE id = 'price_gpt_image_2_2k_v1' AND COALESCE(provider_cost_formula ->> 'amount', '') = ''
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET provider_cost_formula = '{"type":"per_image","currency":"USD","amount":0.015}'::jsonb
    WHERE id = 'price_gemini_flash_0_5k_v1' AND COALESCE(provider_cost_formula ->> 'amount', '') = ''
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET provider_cost_formula = '{"type":"per_image","currency":"USD","amount":0.03}'::jsonb
    WHERE id = 'price_gemini_flash_1k_v1' AND COALESCE(provider_cost_formula ->> 'amount', '') = ''
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET provider_cost_formula = '{"type":"per_image","currency":"USD","amount":0.06}'::jsonb
    WHERE id = 'price_gemini_flash_2k_v1' AND COALESCE(provider_cost_formula ->> 'amount', '') = ''
    """,
    """
    UPDATE tangent_model_pricing_rules
    SET provider_cost_formula = '{"type":"per_image","currency":"USD","amount":0.12}'::jsonb
    WHERE id = 'price_gemini_flash_4k_v1' AND COALESCE(provider_cost_formula ->> 'amount', '') = ''
    """,
]


DOWNGRADE = [
    "ALTER TABLE tangent_ai_api_calls DROP COLUMN IF EXISTS provider_currency",
]
