def ensure_credit_account(cursor: object, owner_type: str, owner_id: str) -> str:
    account_id = f"credit_{owner_type}_{owner_id}"
    account_kind = "team_wallet" if owner_type == "workspace" else "personal_wallet"
    cursor.execute(
        """
        INSERT INTO tangent_credit_accounts (
            id,
            owner_type,
            owner_id,
            account_kind,
            status
        )
        VALUES (%s, %s, %s, %s, 'active')
        ON CONFLICT (owner_type, owner_id)
        DO UPDATE SET
            status = 'active',
            account_kind = EXCLUDED.account_kind,
            updated_at = NOW()
        RETURNING id
        """,
        (account_id, owner_type, owner_id, account_kind),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else account_id
