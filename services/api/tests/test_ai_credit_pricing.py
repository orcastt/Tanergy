from tangent_api.ai_credit_pricing import credits_from_provider_cost, estimate_credits_for_rule
from tangent_api.ai_schemas import AiRunRequest


def test_image_provider_cost_rounds_up_to_margin_credit_step():
    assert credits_from_provider_cost(
        0.16,
        formula={"creditUsd": 0.01, "grossMargin": 0.25},
        minimum=0,
    ) == 21.5


def test_text_pricing_scales_with_context_size():
    pricing_rule = {
        "billing_unit": "per_run",
        "credit_multiplier": 1,
        "estimated_credits": 1,
        "min_credits": 1,
        "provider_cost_formula": {
            "creditUsd": 0.01,
            "currency": "USD",
            "estimatedInputTokens": 1,
            "estimatedOutputTokens": 800,
            "grossMargin": 0.25,
            "inputUsdPerMTok": 0.8,
            "outputUsdPerMTok": 0.8,
            "type": "token_usage_estimate",
        },
    }
    short_payload = AiRunRequest(prompt="Short request", run_type="text", selected_model_id="qwen/qwen2.5-vl-72b-instruct")
    long_payload = AiRunRequest(
        params={"messages": [{"content": "x" * 400_000, "role": "user"}]},
        prompt="Summarize this context",
        run_type="text",
        selected_model_id="qwen/qwen2.5-vl-72b-instruct",
    )

    assert estimate_credits_for_rule(short_payload, pricing_rule) == 1
    assert estimate_credits_for_rule(long_payload, pricing_rule) > estimate_credits_for_rule(short_payload, pricing_rule)
