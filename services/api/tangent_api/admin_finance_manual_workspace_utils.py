from tangent_api.safe_text import normalize_safe_label


def insert_workspace(
    cursor: object,
    *,
    kind: str,
    owner_id: str,
    workspace_id: str,
    workspace_name: str,
) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_workspaces (
            id,
            name,
            owner_id,
            kind,
            slug,
            status,
            billing_owner_user_id
        )
        VALUES (%s, %s, %s, %s, NULL, 'active', %s)
        """,
        (workspace_id, workspace_name, owner_id, kind, owner_id),
    )


def insert_owner_membership(
    cursor: object,
    *,
    display_name: str,
    user_id: str,
    workspace_id: str,
) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_workspace_members (
            workspace_id,
            user_id,
            role,
            display_name,
            invited_by
        )
        VALUES (%s, %s, 'owner', %s, NULL)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET
            role = 'owner',
            display_name = COALESCE(EXCLUDED.display_name, tangent_workspace_members.display_name)
        """,
        (workspace_id, user_id, display_name),
    )


def normalize_workspace_name(value: str) -> str:
    return normalize_safe_label(value, field_name="Workspace name")
