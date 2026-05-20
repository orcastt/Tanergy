import importlib.util
from pathlib import Path

import pytest


VERSIONS_DIR = Path(__file__).parents[1] / "migrations" / "versions"
SCRIPTS_DIR = Path(__file__).parents[1] / "scripts"


def load_migration(filename: str):
    path = VERSIONS_DIR / filename
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_script(filename: str):
    path = SCRIPTS_DIR / filename
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_alembic_revision_chain_is_linear():
    migrations = [
        load_migration("20260501_0001_p0_core_schema.py"),
        load_migration("20260502_0002_board_metadata.py"),
        load_migration("20260502_0003_board_management_metadata.py"),
        load_migration("20260502_0004_s1a_core_schema.py"),
        load_migration("20260502_0005_s1a_future_systems_schema.py"),
        load_migration("20260502_0006_s1a_constraints_indexes.py"),
        load_migration("20260506_0007_workspace_entitlements_ai_charge_contract.py"),
        load_migration("20260506_0008_ai_control_plane_registry_pricing.py"),
        load_migration("20260506_0009_ai_run_quote_facts.py"),
        load_migration("20260506_0010_ai_runtime_provider_currency.py"),
        load_migration("20260506_0011_ai_control_plane_versions_and_payment_checkout.py"),
        load_migration("20260508_0012_team_group_wallet_contracts.py"),
        load_migration("20260508_0013_workspace_invites_roles.py"),
        load_migration("20260510_0014_admin_operator_access_pause_facts.py"),
        load_migration("20260511_0015_plan_catalog_admin_controls.py"),
        load_migration("20260511_0016_ai_text_route_seed.py"),
        load_migration("20260512_0017_board_collaboration_presence.py"),
        load_migration("20260512_0018_board_realtime_documents.py"),
        load_migration("20260513_0019_ai_run_text_output.py"),
        load_migration("20260513_0020_ai_analysis_route_seed.py"),
        load_migration("20260514_0021_ai_image_model_refresh.py"),
        load_migration("20260515_0022_auth_user_profile_fields.py"),
        load_migration("20260515_0023_ai_gpt55_text_analysis_seed.py"),
        load_migration("20260516_0024_remove_hunyuan_text_model.py"),
        load_migration("20260516_0025_jiekou_image_provider_routes.py"),
        load_migration("20260516_0026_jiekou_text_multimodal_models.py"),
        load_migration("20260516_0027_jiekou_only_ai_provider.py"),
        load_migration("20260516_0028_gpt_image_2_4k_tier.py"),
        load_migration("20260518_0029_jiekou_gemini_flash_nano_banana.py"),
        load_migration("20260518_0030_ai_credit_pricing_and_remove_ocr.py"),
        load_migration("20260520_0031_security_rate_limit_idempotency.py"),
        load_migration("20260520_0032_geekai_provider_routes.py"),
        load_migration("20260520_0033_geekai_qwq_text_default.py"),
    ]

    for previous, current in zip(migrations, migrations[1:]):
        assert current.down_revision == previous.revision


def test_s1a_migrations_keep_required_schema_contracts():
    core = load_migration("20260502_0004_s1a_core_schema.py")
    future = load_migration("20260502_0005_s1a_future_systems_schema.py")
    hardening = load_migration("20260502_0006_s1a_constraints_indexes.py")
    entitlements = load_migration("20260506_0007_workspace_entitlements_ai_charge_contract.py")
    ai_control_plane = load_migration("20260506_0008_ai_control_plane_registry_pricing.py")
    ai_run_facts = load_migration("20260506_0009_ai_run_quote_facts.py")
    ai_runtime_currency = load_migration("20260506_0010_ai_runtime_provider_currency.py")
    ai_control_plane_versions = load_migration("20260506_0011_ai_control_plane_versions_and_payment_checkout.py")
    team_group_wallets = load_migration("20260508_0012_team_group_wallet_contracts.py")
    workspace_invite_roles = load_migration("20260508_0013_workspace_invites_roles.py")
    admin_operator_facts = load_migration("20260510_0014_admin_operator_access_pause_facts.py")
    plan_catalog_controls = load_migration("20260511_0015_plan_catalog_admin_controls.py")
    text_route_seed = load_migration("20260511_0016_ai_text_route_seed.py")
    board_collaboration_presence = load_migration("20260512_0017_board_collaboration_presence.py")
    board_realtime_documents = load_migration("20260512_0018_board_realtime_documents.py")
    ai_run_text_output = load_migration("20260513_0019_ai_run_text_output.py")
    analysis_route_seed = load_migration("20260513_0020_ai_analysis_route_seed.py")
    image_model_refresh = load_migration("20260514_0021_ai_image_model_refresh.py")
    auth_user_profile_fields = load_migration("20260515_0022_auth_user_profile_fields.py")
    gpt_55_seed = load_migration("20260515_0023_ai_gpt55_text_analysis_seed.py")
    remove_hunyuan_text_model = load_migration("20260516_0024_remove_hunyuan_text_model.py")
    jiekou_image_routes = load_migration("20260516_0025_jiekou_image_provider_routes.py")
    jiekou_text_models = load_migration("20260516_0026_jiekou_text_multimodal_models.py")
    jiekou_only_provider = load_migration("20260516_0027_jiekou_only_ai_provider.py")
    gpt_image_2_4k_tier = load_migration("20260516_0028_gpt_image_2_4k_tier.py")
    jiekou_gemini_flash_nano_banana = load_migration("20260518_0029_jiekou_gemini_flash_nano_banana.py")
    ai_credit_pricing_remove_ocr = load_migration("20260518_0030_ai_credit_pricing_and_remove_ocr.py")
    security_rate_limit_idempotency = load_migration("20260520_0031_security_rate_limit_idempotency.py")
    geekai_provider_routes = load_migration("20260520_0032_geekai_provider_routes.py")
    geekai_qwq_text_default = load_migration("20260520_0033_geekai_qwq_text_default.py")
    core_sql = "\n".join(core.UPGRADE)
    future_sql = "\n".join(future.UPGRADE)
    hardening_sql = "\n".join(hardening.UPGRADE)
    entitlement_sql = "\n".join(entitlements.UPGRADE)
    ai_control_plane_sql = "\n".join(ai_control_plane.UPGRADE)
    ai_run_facts_sql = "\n".join(ai_run_facts.UPGRADE)
    ai_runtime_currency_sql = "\n".join(ai_runtime_currency.UPGRADE)
    ai_control_plane_versions_sql = "\n".join(ai_control_plane_versions.UPGRADE)
    team_group_wallets_sql = "\n".join(team_group_wallets.UPGRADE)
    workspace_invite_roles_sql = "\n".join(workspace_invite_roles.UPGRADE)
    admin_operator_facts_sql = "\n".join(admin_operator_facts.UPGRADE)
    plan_catalog_controls_sql = "\n".join(plan_catalog_controls.UPGRADE)
    text_route_seed_sql = "\n".join(text_route_seed.UPGRADE)
    board_collaboration_presence_sql = "\n".join(board_collaboration_presence.UPGRADE)
    board_realtime_documents_sql = "\n".join(board_realtime_documents.UPGRADE)
    ai_run_text_output_sql = "\n".join(ai_run_text_output.UPGRADE)
    analysis_route_seed_sql = "\n".join(analysis_route_seed.UPGRADE)
    image_model_refresh_sql = "\n".join(image_model_refresh.UPGRADE)
    auth_user_profile_fields_sql = "\n".join(auth_user_profile_fields.UPGRADE)
    gpt_55_seed_sql = "\n".join(gpt_55_seed.UPGRADE)
    remove_hunyuan_text_model_sql = "\n".join(remove_hunyuan_text_model.UPGRADE)
    jiekou_image_routes_sql = "\n".join(jiekou_image_routes.UPGRADE)
    jiekou_text_models_sql = "\n".join(jiekou_text_models.UPGRADE)
    jiekou_only_provider_sql = "\n".join(jiekou_only_provider.UPGRADE)
    gpt_image_2_4k_tier_sql = "\n".join(gpt_image_2_4k_tier.UPGRADE)
    jiekou_gemini_flash_nano_banana_sql = "\n".join(jiekou_gemini_flash_nano_banana.UPGRADE)
    ai_credit_pricing_remove_ocr_sql = "\n".join(ai_credit_pricing_remove_ocr.UPGRADE)
    security_rate_limit_idempotency_sql = "\n".join(security_rate_limit_idempotency.UPGRADE)
    geekai_provider_routes_sql = "\n".join(geekai_provider_routes.UPGRADE)
    geekai_qwq_text_default_sql = "\n".join(geekai_qwq_text_default.UPGRADE)

    for table_name in [
        "tangent_workspace_members",
        "tangent_board_members",
        "tangent_board_user_preferences",
        "tangent_board_assets",
        "tangent_collections",
    ]:
        assert table_name in core_sql

    for table_name in [
        "tangent_admin_roles",
        "tangent_credit_accounts",
        "tangent_credit_ledger",
        "tangent_ai_api_calls",
        "tangent_analytics_events",
        "tangent_idempotency_keys",
    ]:
        assert table_name in future_sql

    for contract in [
        "tangent_workspaces ADD COLUMN IF NOT EXISTS kind",
        "tangent_workspace_seat_assignments",
        "tangent_workspace_usage_rollups",
        "tangent_workspace_dashboard_snapshots",
        "charged_account_id",
        "charged_scope",
        "entitlement_source",
    ]:
        assert contract in entitlement_sql

    for contract in [
        "tangent_boards_owner_fk",
        "tangent_auth_sessions_user_fk",
        "tangent_assets_workspace_fk",
        "tangent_email_otps_purpose_ck",
        "tangent_ai_api_calls_user_idx",
    ]:
        assert contract in hardening_sql

    for contract in [
        "tangent_security_events",
        "tangent_security_daily_usage",
        "request_fingerprint",
        "response_json",
        "tangent_idempotency_keys_scope_idx",
    ]:
        assert contract in security_rate_limit_idempotency_sql

    for contract in [
        "tangent_model_registry",
        "tangent_model_parameter_tiers",
        "tangent_model_pricing_rules",
        "ALTER TABLE tangent_model_provider_routes ADD COLUMN IF NOT EXISTS model_key",
        "tangent_model_registry_default_pricing_rule_fk",
    ]:
        assert contract in ai_control_plane_sql

    for contract in [
        "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS estimated_credits",
        "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS pricing_rule_id",
        "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS route_id",
        "ALTER TABLE tangent_ai_api_calls ADD COLUMN IF NOT EXISTS pricing_rule_id",
        "tangent_ai_runs_pricing_idx",
    ]:
        assert contract in ai_run_facts_sql

    for contract in [
        "ALTER TABLE tangent_ai_api_calls ADD COLUMN IF NOT EXISTS provider_currency",
        "price_gpt_image_2_1k_v1",
        "price_gemini_flash_4k_v1",
    ]:
        assert contract in ai_runtime_currency_sql

    for contract in [
        "tangent_ai_control_plane_versions",
        "tangent_ai_control_plane_versions_lookup_idx",
        "ALTER TABLE tangent_payments ADD COLUMN IF NOT EXISTS checkout_session_id",
        "ALTER TABLE tangent_payments ADD COLUMN IF NOT EXISTS kind",
        "ALTER TABLE tangent_payments ADD COLUMN IF NOT EXISTS metadata",
        "ALTER TABLE tangent_api_cost_ledger ADD COLUMN IF NOT EXISTS settlement_kind",
    ]:
        assert contract in ai_control_plane_versions_sql

    for contract in [
        "ALTER TABLE tangent_credit_accounts ADD COLUMN IF NOT EXISTS account_kind",
        "tangent_credit_accounts_account_kind_ck",
        "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS plan_family",
        "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS seat_capacity",
        "tangent_subscriptions_one_active_collaborate_per_user_idx",
        "tangent_subscriptions_one_active_team_per_workspace_idx",
        "ALTER TABLE tangent_workspace_invitations ADD COLUMN IF NOT EXISTS token_hash",
        "CHECK (charged_scope IN ('actor_personal', 'team_wallet', 'workspace_pool'))",
    ]:
        assert contract in team_group_wallets_sql

    for contract in [
        "tangent_workspace_members_role_ck",
        "tangent_workspace_invitations_role_ck",
        "'editor'",
        "'viewer'",
        "ALTER COLUMN email DROP NOT NULL",
        "tangent_workspace_members_workspace_role_idx",
    ]:
        assert contract in workspace_invite_roles_sql

    for contract in [
        "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS last_ip_address",
        "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS paused_at",
        "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS paused_by",
        "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS pause_reason",
        "tangent_subscriptions_paused_idx",
    ]:
        assert contract in admin_operator_facts_sql

    for contract in [
        "tangent_plan_catalog",
        "tangent_plan_catalog_family_idx",
        "'collaborate_plus'",
        "'team_growth'",
    ]:
        assert contract in plan_catalog_controls_sql

    for contract in [
        "hunyuan-3.0-preview",
        "route_hunyuan_text_primary",
        "price_hunyuan_text_v1",
        "default_pricing_rule_id = 'price_hunyuan_text_v1'",
    ]:
        assert contract in text_route_seed_sql

    for contract in [
        "tangent_board_collaboration_sessions",
        "client_instance_id",
        "permission IN ('view', 'edit', 'manage', 'owner')",
        "tangent_board_collaboration_active_idx",
    ]:
        assert contract in board_collaboration_presence_sql

    for contract in [
        "tangent_board_realtime_documents",
        "room_key",
        "document_updates JSONB NOT NULL DEFAULT '[]'::jsonb",
        "tangent_board_realtime_updated_idx",
    ]:
        assert contract in board_realtime_documents_sql

    for contract in [
        "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS text_output TEXT",
    ]:
        assert contract in ai_run_text_output_sql

    for contract in [
        "gpt-5-mini",
        "route_gpt_5_mini_primary",
        "price_gpt_5_mini_v1",
        "default_pricing_rule_id = 'price_gpt_5_mini_v1'",
    ]:
        assert contract in analysis_route_seed_sql

    for contract in [
        "nano-banana-2",
        "route_nano_banana_2_primary",
        "price_nano_banana_2_1k_v1",
        "jimeng_t2i_v40",
    ]:
        assert contract in image_model_refresh_sql

    assert image_model_refresh_sql.index("INSERT INTO tangent_model_pricing_rules") < image_model_refresh_sql.index("default_pricing_rule_id = 'price_nano_banana_2_1k_v1'")

    for contract in [
        "tangent_users ADD COLUMN IF NOT EXISTS gender",
        "tangent_users ADD COLUMN IF NOT EXISTS profile_completed_at",
    ]:
        assert contract in auth_user_profile_fields_sql

    for contract in [
        "gpt-5.5",
        "route_gpt_5_5_primary",
        "price_gpt_5_5_v1",
        "default_pricing_rule_id = 'price_gpt_5_5_v1'",
    ]:
        assert contract in gpt_55_seed_sql

    for contract in [
        "DELETE FROM tangent_model_provider_routes WHERE id = 'route_hunyuan_text_primary'",
        "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_hunyuan_text_v1'",
        "DELETE FROM tangent_model_registry WHERE model_key = 'hunyuan-3.0-preview'",
    ]:
        assert contract in remove_hunyuan_text_model_sql

    for contract in [
        "provider_key = 'jiekou'",
        "route_gpt_image_2_geekai_fallback",
        "route_nano_banana_2_geekai_fallback",
        "route_doubao_seedream_5_0_lite_geekai_fallback",
        "DELETE FROM tangent_model_parameter_tiers",
        "DELETE FROM tangent_model_pricing_rules",
        "jiekou-nano-banana-2-primary",
    ]:
        assert contract in jiekou_image_routes_sql

    for contract in [
        "deepseek/deepseek-ocr-2",
        "route_deepseek_ocr_2_primary",
        "price_deepseek_ocr_2_v1",
        "deepseek/deepseek-v3.1",
        "route_deepseek_v3_1_primary",
        "qwen/qwen2.5-vl-72b-instruct",
        "route_qwen_2_5_vl_72b_primary",
        "price_qwen_2_5_vl_72b_v1",
    ]:
        assert contract in jiekou_text_models_sql

    for contract in [
        "route_gpt_5_5_primary",
        "route_gpt_5_mini_primary",
        "route_gpt_4o_mini_primary",
        "route_gemini_2_5_flash_primary",
        "route_gpt_image_2_geekai_fallback",
        "route_nano_banana_2_geekai_fallback",
        "route_doubao_seedream_5_0_lite_geekai_fallback",
        "route_jimeng_t2i_v40_primary",
        "DELETE FROM tangent_model_registry WHERE model_key = 'gpt-5.5'",
        "DELETE FROM tangent_model_registry WHERE model_key = 'jimeng_t2i_v40'",
    ]:
        assert contract in jiekou_only_provider_sql

    for contract in [
        '"resolution":["1K","2K","4K"]',
        "tier_gpt_image_2_4k",
        '"resolution":"4K"',
        "price_gpt_image_2_4k_v1",
    ]:
        assert contract in gpt_image_2_4k_tier_sql

    for contract in [
        "gemini-3.1-flash-image",
        "tier_nano_banana_2_0_5k",
        "price_nano_banana_2_0_5k_v1",
        '"imageSize":["0.5K","1K","2K","4K"]',
        '"size":"0.5K"',
    ]:
        assert contract in jiekou_gemini_flash_nano_banana_sql

    for contract in [
        "DELETE FROM tangent_model_provider_routes WHERE id = 'route_deepseek_ocr_2_primary'",
        "DELETE FROM tangent_model_pricing_rules WHERE id = 'price_deepseek_ocr_2_v1'",
        "DELETE FROM tangent_model_registry WHERE model_key = 'deepseek/deepseek-ocr-2'",
        '"type":"token_usage_estimate"',
        '"inputUsdPerMTok":0.27',
        '"inputUsdPerMTok":0.8',
        "price_doubao_seedream_5_0_lite_v1",
        "price_gpt_image_2_4k_v1",
        "21.5",
    ]:
        assert contract in ai_credit_pricing_remove_ocr_sql

    for contract in [
        "provider_key = 'geekai'",
        "geekai-deepseek-v3-1-primary",
        "gemini-3.1-flash-image-preview",
        '"aspectRatio":["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9","1:4","4:1","1:8","8:1"]',
        "geekai-seedream-5-lite-primary",
    ]:
        assert contract in geekai_provider_routes_sql

    for contract in [
        "qwq-plus-latest",
        "route_qwq_plus_latest_primary",
        "price_qwq_plus_latest_v1",
        "geekai-qwq-plus-latest-primary",
        "default_pricing_rule_id = 'price_qwq_plus_latest_v1'",
    ]:
        assert contract in geekai_qwq_text_default_sql


def test_text_route_seed_uses_driver_sql_for_json_literals(monkeypatch):
    text_route_seed = load_migration("20260511_0016_ai_text_route_seed.py")
    executed: list[str] = []

    class FakeConnection:
        def exec_driver_sql(self, statement: str) -> None:
            executed.append(statement)

    class FakeOp:
        def get_bind(self) -> FakeConnection:
            return FakeConnection()

    monkeypatch.setattr(text_route_seed, "op", FakeOp())

    text_route_seed.upgrade()

    assert len(executed) == len(text_route_seed.UPGRADE)
    assert any('{"maxAttempts":2}' in statement for statement in executed)


def test_s1a_smoke_runner_requires_explicit_database(monkeypatch):
    smoke = load_script("s1a_migration_smoke.py")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("S1A_SMOKE_DATABASE_URL", raising=False)
    monkeypatch.delenv("S1A_SMOKE_ALLOW_RESET", raising=False)

    with pytest.raises(SystemExit, match="disposable Postgres database"):
        smoke.main()
