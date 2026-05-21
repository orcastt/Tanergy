"""switch active AI provider routes back to GeekAI

Revision ID: 20260520_0032
Revises: 20260520_0031
Create Date: 2026-05-20
"""

from alembic import op


revision = "20260520_0032"
down_revision = "20260520_0031"
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


NANO_BANANA_SCHEMA = """
'{"aspectRatio":["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","1:4","4:1","1:8","8:1"],"imageSize":["0.5K","1K","2K","4K"]}'::jsonb
"""


UPGRADE = [
    """
    UPDATE tangent_model_registry
    SET provider_key = 'geekai',
        updated_at = NOW()
    WHERE model_key IN (
        'deepseek/deepseek-v3.1',
        'qwen/qwen2.5-vl-72b-instruct',
        'doubao-seedream-5.0-lite'
    )
    """,
    """
    UPDATE tangent_model_registry
    SET provider_key = 'geekai',
        cost_hint = 'GeekAI GPT Image 2 with tested 1K, 2K, and 4K render tiers.',
        updated_at = NOW()
    WHERE model_key = 'gpt-image-2'
    """,
    f"""
    UPDATE tangent_model_registry
    SET provider_key = 'geekai',
        cost_hint = 'GeekAI Nano Banana 2 with common and extended aspect ratios.',
        parameter_schema = {NANO_BANANA_SCHEMA},
        updated_at = NOW()
    WHERE model_key = 'nano-banana-2'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'geekai',
        provider = 'geekai',
        route_key = 'geekai-deepseek-v3-1-primary',
        updated_at = NOW()
    WHERE id = 'route_deepseek_v3_1_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'geekai',
        provider = 'geekai',
        route_key = 'geekai-qwen-2-5-vl-72b-primary',
        updated_at = NOW()
    WHERE id = 'route_qwen_2_5_vl_72b_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'geekai',
        provider = 'geekai',
        route_key = 'geekai-gpt-image-2-primary',
        updated_at = NOW()
    WHERE id = 'route_gpt_image_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'geekai',
        provider = 'geekai',
        provider_model = 'gemini-3.1-flash-image-preview',
        route_key = 'geekai-nano-banana-2-primary',
        updated_at = NOW()
    WHERE id = 'route_nano_banana_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'geekai',
        provider = 'geekai',
        route_key = 'geekai-seedream-5-lite-primary',
        updated_at = NOW()
    WHERE id = 'route_doubao_seedream_5_0_lite_primary'
    """,
]


DOWNGRADE = [
    """
    UPDATE tangent_model_registry
    SET provider_key = 'jiekou',
        updated_at = NOW()
    WHERE model_key IN (
        'deepseek/deepseek-v3.1',
        'qwen/qwen2.5-vl-72b-instruct',
        'gpt-image-2',
        'nano-banana-2',
        'doubao-seedream-5.0-lite'
    )
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'jiekou',
        provider = 'jiekou',
        route_key = 'jiekou-deepseek-v3-1-primary',
        updated_at = NOW()
    WHERE id = 'route_deepseek_v3_1_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'jiekou',
        provider = 'jiekou',
        route_key = 'jiekou-qwen-2-5-vl-72b-primary',
        updated_at = NOW()
    WHERE id = 'route_qwen_2_5_vl_72b_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'jiekou',
        provider = 'jiekou',
        route_key = 'jiekou-gpt-image-2-primary',
        updated_at = NOW()
    WHERE id = 'route_gpt_image_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'jiekou',
        provider = 'jiekou',
        provider_model = 'gemini-3.1-flash-image',
        route_key = 'jiekou-nano-banana-2-primary',
        updated_at = NOW()
    WHERE id = 'route_nano_banana_2_primary'
    """,
    """
    UPDATE tangent_model_provider_routes
    SET provider_key = 'jiekou',
        provider = 'jiekou',
        route_key = 'jiekou-seedream-5-lite-primary',
        updated_at = NOW()
    WHERE id = 'route_doubao_seedream_5_0_lite_primary'
    """,
]
