from tangent_api.admin_operator_rows import registration_state_from_values, user_from_row


def test_user_from_row_maps_verified_user_ip_and_login():
    row = (
        "user_ada",
        "ada@example.com",
        "Ada",
        "active",
        "2026-05-10T08:00:00Z",
        "2026-05-10T09:00:00Z",
        True,
        "203.0.113.20",
    )

    user = user_from_row(row)

    assert user.ip_address == "203.0.113.20"
    assert user.last_login_at == "2026-05-10T09:00:00Z"
    assert user.registration_state == "verified"


def test_user_plan_from_row_maps_pause_fields():
    from tangent_api.admin_operator_rows import user_plan_from_row

    plan = user_plan_from_row(
        (
            "sub_group_1",
            "collaborate_plus",
            "paused",
            "2026-05-10T00:00:00Z",
            "2026-06-09T00:00:00Z",
            "2026-05-15T00:00:00Z",
            "user_admin",
            "pause for review",
        )
    )

    assert plan.status == "paused"
    assert plan.paused_at == "2026-05-15T00:00:00Z"
    assert plan.paused_by == "user_admin"
    assert plan.pause_reason == "pause for review"


def test_registration_state_falls_back_to_registered_without_email_verification():
    assert registration_state_from_values(email_verified=False, last_login_at="2026-05-10T09:00:00Z") == "registered"
    assert registration_state_from_values(email_verified=False, last_login_at=None) == "pending_verification"
