"""add ai control plane registry pricing tables

Revision ID: 20260506_0008
Revises: 20260506_0007
Create Date: 2026-05-06
"""

from alembic import op


revision = "20260506_0008"
down_revision = "20260506_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)


def constraint_sql(name: str, table: str, clause: str) -> str:
    return f"""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{name}') THEN
            ALTER TABLE {table} ADD CONSTRAINT {name} {clause};
        END IF;
    END
    $$;
    """


UPGRADE = [
    """
    CREATE TABLE IF NOT EXISTS tangent_model_registry (
        model_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        capability TEXT NOT NULL DEFAULT 'image_generation',
        capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
        parameter_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
        cost_hint TEXT NOT NULL DEFAULT '',
        estimated_latency TEXT NOT NULL DEFAULT '',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        provider_key TEXT,
        default_tier_key TEXT,
        default_pricing_rule_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    constraint_sql(
        "tangent_model_registry_capability_ck",
        "tangent_model_registry",
        "CHECK (capability IN ('image_generation', 'image_edit', 'image_analysis', 'image_reference', 'text')) NOT VALID",
    ),
    """
    CREATE TABLE IF NOT EXISTS tangent_model_parameter_tiers (
        id TEXT PRIMARY KEY,
        model_key TEXT NOT NULL REFERENCES tangent_model_registry(model_key) ON DELETE CASCADE,
        tier_key TEXT NOT NULL,
        public_label TEXT NOT NULL,
        parameter_key TEXT NOT NULL DEFAULT 'resolution',
        provider_params JSONB NOT NULL DEFAULT '{}'::jsonb,
        sort_order INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (model_key, tier_key)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_model_pricing_rules (
        id TEXT PRIMARY KEY,
        model_key TEXT NOT NULL REFERENCES tangent_model_registry(model_key) ON DELETE CASCADE,
        tier_key TEXT,
        billing_unit TEXT NOT NULL DEFAULT 'per_image',
        estimated_credits NUMERIC(12, 4) NOT NULL DEFAULT 0,
        min_credits NUMERIC(12, 4) NOT NULL DEFAULT 0,
        credit_multiplier NUMERIC(12, 4) NOT NULL DEFAULT 1,
        provider_cost_formula JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'draft',
        effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        effective_to TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    constraint_sql(
        "tangent_model_pricing_rules_status_ck",
        "tangent_model_pricing_rules",
        "CHECK (status IN ('draft', 'active', 'retired')) NOT VALID",
    ),
    constraint_sql(
        "tangent_model_pricing_rules_unit_ck",
        "tangent_model_pricing_rules",
        "CHECK (billing_unit IN ('per_image', 'per_run', 'per_output_token', 'per_input_token', 'blended')) NOT VALID",
    ),
    "ALTER TABLE tangent_model_provider_routes ADD COLUMN IF NOT EXISTS model_key TEXT",
    "ALTER TABLE tangent_model_provider_routes ADD COLUMN IF NOT EXISTS provider_key TEXT",
    "ALTER TABLE tangent_model_provider_routes ADD COLUMN IF NOT EXISTS provider_model TEXT",
    "ALTER TABLE tangent_model_provider_routes ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100",
    "ALTER TABLE tangent_model_provider_routes ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 100",
    "ALTER TABLE tangent_model_provider_routes ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'unknown'",
    "UPDATE tangent_model_provider_routes SET model_key = COALESCE(model_key, model_id) WHERE model_key IS NULL",
    "UPDATE tangent_model_provider_routes SET provider_key = COALESCE(provider_key, provider) WHERE provider_key IS NULL",
    "UPDATE tangent_model_provider_routes SET provider_model = COALESCE(provider_model, model_id) WHERE provider_model IS NULL",
    constraint_sql(
        "tangent_model_provider_routes_health_status_ck",
        "tangent_model_provider_routes",
        "CHECK (health_status IN ('healthy', 'unknown', 'degraded', 'failed', 'disabled')) NOT VALID",
    ),
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema,
        cost_hint, estimated_latency, enabled, is_default, provider_key, default_tier_key
    )
    SELECT
        mo.id,
        mo.display_name,
        CASE
            WHEN mo.capabilities ? 'image_generation' THEN 'image_generation'
            WHEN mo.capabilities ? 'image_edit' THEN 'image_edit'
            WHEN mo.capabilities ? 'image_analysis' THEN 'image_analysis'
            WHEN mo.capabilities ? 'image_reference' THEN 'image_reference'
            ELSE 'text'
        END,
        mo.capabilities,
        mo.parameter_schema,
        mo.cost_hint,
        mo.estimated_latency,
        mo.is_enabled,
        mo.is_default,
        mo.provider,
        CASE
            WHEN mo.parameter_schema -> 'resolution' ? '1K' THEN '1k'
            ELSE NULL
        END
    FROM tangent_model_options mo
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
        model_key, display_name, capability, capabilities, parameter_schema,
        enabled, is_default, provider_key
    )
    SELECT DISTINCT
        r.model_id,
        INITCAP(REPLACE(r.model_id, '-', ' ')),
        'image_generation',
        '["image_generation"]'::jsonb,
        '{}'::jsonb,
        TRUE,
        FALSE,
        r.provider
    FROM tangent_model_provider_routes r
    WHERE r.model_id IS NOT NULL
    ON CONFLICT (model_key) DO NOTHING
    """,
    """
    INSERT INTO tangent_model_registry (
        model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
        estimated_latency, enabled, is_default, provider_key, default_tier_key, default_pricing_rule_id
    ) VALUES
        (
            'gpt-image-2',
            'GPT Image 2',
            'image_generation',
            '["image_generation", "image_edit"]'::jsonb,
            '{"aspectRatio":["auto","1:1","4:3","16:9","3:2"],"resolution":["0.5K","1K","2K"]}'::jsonb,
            'Use low quality for early tests.',
            '5-12s',
            TRUE,
            TRUE,
            'geekai',
            '1k',
            'price_gpt_image_2_1k_v1'
        ),
        (
            'gemini-3.1-flash-image-preview',
            'Gemini 3.1 Flash Image Preview',
            'image_generation',
            '["image_generation", "image_edit", "image_reference"]'::jsonb,
            '{"aspectRatio":["auto","1:1","4:3","16:9"],"resolution":["0.5K","1K","2K","4K"]}'::jsonb,
            'Use 0.5K for fast mock validation.',
            '4-10s',
            TRUE,
            FALSE,
            'geekai',
            '1k',
            'price_gemini_flash_1k_v1'
        )
    ON CONFLICT (model_key) DO NOTHING
    """,
    """
    INSERT INTO tangent_model_parameter_tiers (
        id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled
    ) VALUES
        ('tier_gpt_image_2_0_5k', 'gpt-image-2', '0_5k', '0.5K', 'resolution', '{"resolution":"0.5K"}'::jsonb, 10, TRUE),
        ('tier_gpt_image_2_1k', 'gpt-image-2', '1k', '1K', 'resolution', '{"resolution":"1K"}'::jsonb, 20, TRUE),
        ('tier_gpt_image_2_2k', 'gpt-image-2', '2k', '2K', 'resolution', '{"resolution":"2K"}'::jsonb, 30, TRUE),
        ('tier_gemini_flash_0_5k', 'gemini-3.1-flash-image-preview', '0_5k', '0.5K', 'resolution', '{"resolution":"0.5K"}'::jsonb, 10, TRUE),
        ('tier_gemini_flash_1k', 'gemini-3.1-flash-image-preview', '1k', '1K', 'resolution', '{"resolution":"1K"}'::jsonb, 20, TRUE),
        ('tier_gemini_flash_2k', 'gemini-3.1-flash-image-preview', '2k', '2K', 'resolution', '{"resolution":"2K"}'::jsonb, 30, TRUE),
        ('tier_gemini_flash_4k', 'gemini-3.1-flash-image-preview', '4k', '4K', 'resolution', '{"resolution":"4K"}'::jsonb, 40, TRUE)
    ON CONFLICT (model_key, tier_key) DO NOTHING
    """,
    """
    INSERT INTO tangent_model_provider_routes (
        id, model_id, provider, route_key, capabilities, credit_cost, raw_cost_estimate,
        timeout_ms, retry_policy, enabled, model_key, provider_key, provider_model,
        priority, weight, health_status
    ) VALUES
        (
            'route_gpt_image_2_primary',
            'gpt-image-2',
            'geekai',
            'geekai-primary',
            '["image_generation", "image_edit"]'::jsonb,
            5,
            NULL,
            60000,
            '{"maxAttempts":2}'::jsonb,
            TRUE,
            'gpt-image-2',
            'geekai',
            'gpt-image-2',
            10,
            100,
            'healthy'
        ),
        (
            'route_gemini_flash_primary',
            'gemini-3.1-flash-image-preview',
            'geekai',
            'geekai-primary',
            '["image_generation", "image_edit", "image_reference"]'::jsonb,
            4,
            NULL,
            60000,
            '{"maxAttempts":2}'::jsonb,
            TRUE,
            'gemini-3.1-flash-image-preview',
            'geekai',
            'gemini-3.1-flash-image-preview',
            10,
            100,
            'healthy'
        )
    ON CONFLICT (id) DO NOTHING
    """,
    """
    INSERT INTO tangent_model_pricing_rules (
        id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
        credit_multiplier, provider_cost_formula, status, effective_from
    ) VALUES
        ('price_gpt_image_2_0_5k_v1', 'gpt-image-2', '0_5k', 'per_image', 3, 3, 1, '{"unit":"image"}'::jsonb, 'active', NOW()),
        ('price_gpt_image_2_1k_v1', 'gpt-image-2', '1k', 'per_image', 5, 5, 1, '{"unit":"image"}'::jsonb, 'active', NOW()),
        ('price_gpt_image_2_2k_v1', 'gpt-image-2', '2k', 'per_image', 9, 9, 1, '{"unit":"image"}'::jsonb, 'active', NOW()),
        ('price_gemini_flash_0_5k_v1', 'gemini-3.1-flash-image-preview', '0_5k', 'per_image', 2.5, 2.5, 1, '{"unit":"image"}'::jsonb, 'active', NOW()),
        ('price_gemini_flash_1k_v1', 'gemini-3.1-flash-image-preview', '1k', 'per_image', 4, 4, 1, '{"unit":"image"}'::jsonb, 'active', NOW()),
        ('price_gemini_flash_2k_v1', 'gemini-3.1-flash-image-preview', '2k', 'per_image', 7, 7, 1, '{"unit":"image"}'::jsonb, 'active', NOW()),
        ('price_gemini_flash_4k_v1', 'gemini-3.1-flash-image-preview', '4k', 'per_image', 12, 12, 1, '{"unit":"image"}'::jsonb, 'active', NOW())
    ON CONFLICT (id) DO NOTHING
    """,
    constraint_sql(
        "tangent_model_provider_routes_model_key_fk",
        "tangent_model_provider_routes",
        "FOREIGN KEY (model_key) REFERENCES tangent_model_registry(model_key) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_model_registry_default_pricing_rule_fk",
        "tangent_model_registry",
        "FOREIGN KEY (default_pricing_rule_id) REFERENCES tangent_model_pricing_rules(id) ON DELETE SET NULL NOT VALID",
    ),
    "CREATE INDEX IF NOT EXISTS tangent_model_registry_enabled_idx ON tangent_model_registry (enabled, capability, is_default)",
    "CREATE INDEX IF NOT EXISTS tangent_model_parameter_tiers_model_idx ON tangent_model_parameter_tiers (model_key, enabled, sort_order)",
    "CREATE INDEX IF NOT EXISTS tangent_model_pricing_rules_model_idx ON tangent_model_pricing_rules (model_key, status, effective_from DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_model_provider_routes_model_key_idx ON tangent_model_provider_routes (model_key, enabled, priority, weight DESC)",
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_model_provider_routes_model_key_idx",
    "DROP INDEX IF EXISTS tangent_model_pricing_rules_model_idx",
    "DROP INDEX IF EXISTS tangent_model_parameter_tiers_model_idx",
    "DROP INDEX IF EXISTS tangent_model_registry_enabled_idx",
    "ALTER TABLE IF EXISTS tangent_model_registry DROP CONSTRAINT IF EXISTS tangent_model_registry_default_pricing_rule_fk",
    "ALTER TABLE IF EXISTS tangent_model_provider_routes DROP CONSTRAINT IF EXISTS tangent_model_provider_routes_model_key_fk",
    "ALTER TABLE IF EXISTS tangent_model_provider_routes DROP CONSTRAINT IF EXISTS tangent_model_provider_routes_health_status_ck",
    "ALTER TABLE tangent_model_provider_routes DROP COLUMN IF EXISTS health_status",
    "ALTER TABLE tangent_model_provider_routes DROP COLUMN IF EXISTS weight",
    "ALTER TABLE tangent_model_provider_routes DROP COLUMN IF EXISTS priority",
    "ALTER TABLE tangent_model_provider_routes DROP COLUMN IF EXISTS provider_model",
    "ALTER TABLE tangent_model_provider_routes DROP COLUMN IF EXISTS provider_key",
    "ALTER TABLE tangent_model_provider_routes DROP COLUMN IF EXISTS model_key",
    "ALTER TABLE IF EXISTS tangent_model_pricing_rules DROP CONSTRAINT IF EXISTS tangent_model_pricing_rules_unit_ck",
    "ALTER TABLE IF EXISTS tangent_model_pricing_rules DROP CONSTRAINT IF EXISTS tangent_model_pricing_rules_status_ck",
    "DROP TABLE IF EXISTS tangent_model_pricing_rules",
    "DROP TABLE IF EXISTS tangent_model_parameter_tiers",
    "ALTER TABLE IF EXISTS tangent_model_registry DROP CONSTRAINT IF EXISTS tangent_model_registry_capability_ck",
    "DROP TABLE IF EXISTS tangent_model_registry",
]
