"""add model registry analytics fields

Revision ID: a00000000009
Revises: a00000000008
Create Date: 2026-04-28
"""

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "a00000000009"
down_revision = "a00000000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("model_configs", sa.Column("endpoint_type", sa.String(40), nullable=True))
    op.add_column("model_configs", sa.Column("capabilities", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("model_configs", sa.Column("parameter_schema", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("model_configs", sa.Column("pricing_schema", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("model_configs", sa.Column("smoke_test_payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("model_configs", sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("model_configs", sa.Column("fallback_priority", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("api_call_logs", sa.Column("endpoint", sa.String(120), nullable=True))
    op.add_column("api_call_logs", sa.Column("request_params", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("api_call_logs", sa.Column("response_meta", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("api_call_logs", sa.Column("upstream_task_id", sa.String(120), nullable=True))
    op.add_column("api_call_logs", sa.Column("error_code", sa.String(80), nullable=True))
    op.add_column("api_call_logs", sa.Column("refund_transaction_id", UUID(as_uuid=True), nullable=True))
    op.add_column("api_call_logs", sa.Column("upstream_cost", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("api_call_logs", sa.Column("route_provider", sa.String(50), nullable=True))
    op.create_foreign_key(
        "fk_api_call_logs_refund_transaction",
        "api_call_logs",
        "credit_transactions",
        ["refund_transaction_id"],
        ["id"],
        ondelete="SET NULL",
    )

    _set_endpoint_defaults()
    _seed_geekai_registry_metadata()


def downgrade() -> None:
    op.drop_constraint("fk_api_call_logs_refund_transaction", "api_call_logs", type_="foreignkey")
    op.drop_column("api_call_logs", "route_provider")
    op.drop_column("api_call_logs", "upstream_cost")
    op.drop_column("api_call_logs", "refund_transaction_id")
    op.drop_column("api_call_logs", "error_code")
    op.drop_column("api_call_logs", "upstream_task_id")
    op.drop_column("api_call_logs", "response_meta")
    op.drop_column("api_call_logs", "request_params")
    op.drop_column("api_call_logs", "endpoint")

    op.drop_column("model_configs", "fallback_priority")
    op.drop_column("model_configs", "is_default")
    op.drop_column("model_configs", "smoke_test_payload")
    op.drop_column("model_configs", "pricing_schema")
    op.drop_column("model_configs", "parameter_schema")
    op.drop_column("model_configs", "capabilities")
    op.drop_column("model_configs", "endpoint_type")


def _set_endpoint_defaults() -> None:
    op.execute("""
        UPDATE model_configs
        SET endpoint_type = CASE call_type
            WHEN 'chat' THEN 'chat_completions'
            WHEN 'image' THEN 'images_generations'
            WHEN 'image_chat' THEN 'chat_completions'
            WHEN 'image_edit' THEN 'images_edits'
            WHEN 'image_enhance' THEN 'images_enhance'
            ELSE call_type
        END;
    """)
    op.execute("""
        UPDATE api_call_logs
        SET endpoint = CASE call_type
            WHEN 'chat' THEN '/chat/completions'
            WHEN 'image' THEN '/images/generations'
            WHEN 'image_chat' THEN '/chat/completions'
            WHEN 'image_edit' THEN '/images/edits'
            WHEN 'image_enhance' THEN '/images/enhance'
            WHEN 'image_result' THEN '/images/{task_id}'
            ELSE endpoint
        END,
        route_provider = provider;
    """)


def _seed_geekai_registry_metadata() -> None:
    _update_model(
        "nemotron-3-super-120b-a12b",
        endpoint_type="chat_completions",
        capabilities={
            "text_generation": True,
            "streaming": True,
            "background": False,
        },
        parameter_schema={
            "max_tokens": {"type": "integer", "default": 4096, "min": 1, "max": 4096},
            "temperature": {"type": "number", "default": None, "min": 0, "max": 2},
        },
        pricing_schema=_credit_pricing(
            user_charge={"mode": "fixed_per_call", "credits_per_call": 1},
            provider_cost={"currency": "CNY", "unit": "chat", "price_table": []},
        ),
        smoke_test_payload={
            "model": "nemotron-3-super-120b-a12b",
            "messages": [{"role": "user", "content": "只回复 OK"}],
            "max_tokens": 16,
        },
        is_default=True,
        fallback_priority=10,
    )
    _update_model(
        "gpt-image-2",
        endpoint_type="images_generations",
        capabilities={
            "text_to_image": True,
            "image_to_image": True,
            "multi_image": True,
            "async": True,
            "unsupported_fields": ["negative_prompt", "seed", "strength", "aspect_ratio", "style_preset"],
        },
        parameter_schema={
            "size": {"type": "enum", "default": "1024x1024", "options": ["1024x1024", "1024x1536", "1536x1024"]},
            "quality": {"type": "enum", "default": "medium", "test_default": "low", "options": ["low", "medium", "high"]},
            "response_format": {"type": "enum", "default": "url", "options": ["url", "b64_json"]},
            "output_format": {"type": "enum", "default": "png", "options": ["png", "jpeg", "webp"]},
        },
        pricing_schema=_credit_pricing(
            user_charge={"mode": "fixed_per_call", "credits_per_call": 8, "test_credits_per_call": 8},
            provider_cost={
                "currency": "CNY",
                "unit": "image",
                "source": "GeekAI public model page",
                "discount_multiplier": None,
                "price_table": [
                    {"quality": "low", "size": "1024x1024", "amount": 0.048},
                    {"quality": "low", "size": "1024x1536", "amount": 0.04},
                    {"quality": "low", "size": "1536x1024", "amount": 0.04},
                    {"quality": "medium", "size": "1024x1024", "amount": 0.398},
                    {"quality": "medium", "size": "1024x1536", "amount": 0.31},
                    {"quality": "medium", "size": "1536x1024", "amount": 0.31},
                    {"quality": "high", "size": "1024x1024", "amount": 1.586},
                    {"quality": "high", "size": "1024x1536", "amount": 1.24},
                    {"quality": "high", "size": "1536x1024", "amount": 1.24},
                ],
            },
        ),
        smoke_test_payload={
            "model": "gpt-image-2",
            "prompt": "画一只极简线条小猫",
            "size": "1024x1536",
            "quality": "low",
            "response_format": "url",
            "output_format": "png",
            "async": False,
        },
        is_default=True,
        fallback_priority=10,
    )
    _update_model(
        "gemini-3.1-flash-image-preview",
        endpoint_type="chat_completions",
        capabilities={
            "text_to_image": True,
            "image_edit": True,
            "multi_image": True,
            "max_reference_images": 14,
            "search": True,
            "background": True,
            "image_sizes": ["0.5K", "1K", "2K", "4K"],
        },
        parameter_schema={
            "image.image_size": {"type": "enum", "default": "1K", "test_default": "0.5K", "options": ["0.5K", "1K", "2K", "4K"]},
            "image.aspect_ratio": {"type": "enum", "default": "1:1", "options": ["1:1", "5:4", "4:5", "16:9", "9:16", "1:4", "4:1", "1:8", "8:1"]},
            "enable_search": {"type": "boolean", "default": False},
            "background": {"type": "boolean", "default": False},
        },
        pricing_schema=_credit_pricing(
            user_charge={"mode": "fixed_per_call", "credits_per_call": 5, "test_credits_per_call": 5},
            provider_cost={
                "currency": "CNY",
                "unit": "image",
                "source": "GeekAI public model page",
                "discount_multiplier": None,
                "price_table": [
                    {"image_size": "0.5K", "size": "512x512", "amount": 0.35},
                    {"image_size": "1K", "size": "1024x1024", "amount": 0.5},
                    {"image_size": "2K", "size": "2048x2048", "amount": 0.75},
                    {"image_size": "4K", "size": "4096x4096", "amount": 1.15},
                ],
            },
        ),
        smoke_test_payload={
            "model": "gemini-3.1-flash-image-preview",
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": "画一张极简风格的蓝色小星球图标"}],
                }
            ],
            "image": {"image_size": "0.5K", "aspect_ratio": "1:1"},
        },
        is_default=False,
        fallback_priority=20,
    )
    _update_model(
        "gpt-image-1",
        endpoint_type="images_edits",
        capabilities={"image_edit": True, "multi_image": True},
        parameter_schema={
            "size": {"type": "string", "default": "1024x1024"},
            "quality": {"type": "enum", "default": "auto", "options": ["auto", "low", "medium", "high"]},
            "background": {"type": "enum", "default": "auto", "options": ["auto", "transparent", "opaque"]},
        },
        pricing_schema=_credit_pricing(
            user_charge={"mode": "fixed_per_call", "credits_per_call": 6},
            provider_cost={"currency": "CNY", "unit": "image_edit", "price_table": []},
        ),
        smoke_test_payload={
            "model": "gpt-image-1",
            "prompt": "给图片添加柔和暖光",
            "quality": "auto",
            "response_format": "url",
        },
        is_default=True,
        fallback_priority=10,
    )
    _update_model(
        "jimeng-image-enhance-v2",
        endpoint_type="images_enhance",
        capabilities={"image_enhance": True},
        parameter_schema={
            "size": {"type": "enum", "default": "720p", "options": ["720p", "1080p", "2k", "4k"]},
            "output_format": {"type": "enum", "default": "png", "options": ["png", "jpeg", "webp"]},
        },
        pricing_schema=_credit_pricing(
            user_charge={"mode": "fixed_per_call", "credits_per_call": 3},
            provider_cost={"currency": "CNY", "unit": "image_enhance", "price_table": []},
        ),
        smoke_test_payload={
            "model": "jimeng-image-enhance-v2",
            "size": "720p",
            "response_format": "url",
            "output_format": "png",
        },
        is_default=True,
        fallback_priority=10,
    )


def _credit_pricing(user_charge: dict, provider_cost: dict) -> dict:
    return {
        "billing_unit": "credit",
        "credit_value": {"currency": "CNY", "amount": 0.01},
        "display_currencies": ["CNY", "USD"],
        "user_charge": user_charge,
        "provider_cost": provider_cost,
        "notes": "Internal ledger is always credits. User purchase currency can be localized later without changing usage logs.",
    }


def _update_model(
    model: str,
    *,
    endpoint_type: str,
    capabilities: dict,
    parameter_schema: dict,
    pricing_schema: dict,
    smoke_test_payload: dict,
    is_default: bool,
    fallback_priority: int,
) -> None:
    op.execute(f"""
        UPDATE model_configs
        SET endpoint_type = '{endpoint_type}',
            capabilities = {_json(capabilities)},
            parameter_schema = {_json(parameter_schema)},
            pricing_schema = {_json(pricing_schema)},
            smoke_test_payload = {_json(smoke_test_payload)},
            is_default = {'true' if is_default else 'false'},
            fallback_priority = {fallback_priority}
        WHERE provider = 'geekai'
          AND model = '{model}';
    """)


def _json(value: dict) -> str:
    encoded = json.dumps(value, ensure_ascii=False).replace("'", "''")
    return f"'{encoded}'::jsonb"
