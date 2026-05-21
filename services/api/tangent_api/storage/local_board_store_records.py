import json
from typing import Optional

from fastapi import HTTPException

from tangent_api.board_access import assert_can_manage_board, assert_can_read_board, assert_can_write_board
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardMemberRecord, BoardRecord, BoardShareLinkRecord
from tangent_api.storage.local_board_store_support import (
    WORKSPACE_ROLE_PATTERN,
    _board_path,
    _member_path,
    _normalize_display_name,
    _normalize_email,
    _sanitize_board_id,
    _sanitize_user_id,
    _share_link_path,
    _workspace_people_path,
)


def _read_existing_board(board_id: str, context: ApiRequestContext) -> Optional[BoardRecord]:
    try:
        record = _read_board_record(board_id)
    except Exception:
        return None
    return record if record.workspace_id == context.workspace_id else None


def _load_board_without_touch(
    board_id: str,
    context: ApiRequestContext,
    required_access: str = "read",
) -> BoardRecord:
    safe_board_id = _sanitize_board_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")
    record = _read_board_record(safe_board_id)
    member_role = _get_board_member_role(record.id, record, context)
    if required_access == "manage":
        assert_can_manage_board(record, context, member_role)
    elif required_access == "write":
        assert_can_write_board(record, context, member_role)
    else:
        assert_can_read_board(record, context, member_role)
    return record


def _read_board_record(board_id: str) -> BoardRecord:
    path = _board_path(board_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Board not found.")
    return BoardRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _write_board_record(record: BoardRecord) -> None:
    path = _board_path(record.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(record.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _read_member_records(board_id: str, record: BoardRecord, context: ApiRequestContext) -> list[BoardMemberRecord]:
    people_by_user_id = {item["user_id"]: item for item in _read_workspace_people(record.workspace_id, record, context)}
    path = _member_path(board_id)
    if path.exists():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            members = [BoardMemberRecord.model_validate(item) for item in payload]
            return [_hydrate_member_record(member, people_by_user_id.get(member.user_id)) for member in members]
        except Exception:
            pass
    return [_default_owner_member(record, people_by_user_id.get(record.owner_id), context)]


def _get_board_member_role(board_id: str, record: BoardRecord, context: ApiRequestContext) -> Optional[str]:
    for member in _read_member_records(board_id, record, context):
        if member.user_id == context.user_id:
            return member.role.strip().lower()
    return None


def _write_member_records(board_id: str, members: list[BoardMemberRecord]) -> None:
    path = _member_path(board_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps([member.model_dump(by_alias=True) for member in members], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _read_share_links(board_id: str) -> list[BoardShareLinkRecord]:
    path = _share_link_path(board_id)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    links: list[BoardShareLinkRecord] = []
    for item in payload:
        try:
            links.append(BoardShareLinkRecord.model_validate(item))
        except Exception:
            continue
    return links


def _write_share_links(board_id: str, links: list[BoardShareLinkRecord]) -> None:
    path = _share_link_path(board_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps([link.model_dump(by_alias=True) for link in links], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _read_workspace_people(
    workspace_id: str,
    record: BoardRecord,
    context: ApiRequestContext,
) -> list[dict[str, str]]:
    owner_user_id = record.owner_id
    owner_display = context.user_display_name if owner_user_id == context.user_id else record.owner_id
    owner_email = "dev@tangent.local" if owner_user_id == "dev-user" else f"{owner_user_id}@local.tangent"
    default_people = [
        {
            "display_name": owner_display,
            "email": owner_email,
            "user_id": owner_user_id,
            "workspace_role": "owner",
        }
    ]
    path = _workspace_people_path(workspace_id)
    if not path.exists():
        return default_people
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default_people
    if not isinstance(payload, list):
        return default_people
    people = [person for item in payload if (person := _normalize_workspace_person(item))]
    by_user_id = {person["user_id"]: person for person in people}
    by_user_id.setdefault(owner_user_id, default_people[0])
    return sorted(by_user_id.values(), key=lambda item: (item["workspace_role"] != "owner", item["email"].lower()))


def _write_workspace_people(workspace_id: str, people: list[dict[str, str]]) -> None:
    path = _workspace_people_path(workspace_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    deduped = {person["user_id"]: person for person in people if person.get("user_id") and person.get("email")}
    ordered = sorted(deduped.values(), key=lambda item: (item["workspace_role"] != "owner", item["email"].lower()))
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _normalize_workspace_person(payload: object) -> Optional[dict[str, str]]:
    if not isinstance(payload, dict):
        return None
    user_id = payload.get("user_id")
    email = payload.get("email")
    workspace_role = payload.get("workspace_role")
    if not isinstance(user_id, str) or not isinstance(email, str) or not isinstance(workspace_role, str):
        return None
    normalized_workspace_role = workspace_role.strip().lower()
    if normalized_workspace_role not in WORKSPACE_ROLE_PATTERN:
        return None
    normalized_email = _normalize_email(email)
    return {
        "display_name": _normalize_display_name(payload.get("display_name")) or normalized_email.split("@")[0],
        "email": normalized_email,
        "user_id": _sanitize_user_id(user_id),
        "workspace_role": normalized_workspace_role,
    }


def _hydrate_member_record(
    member: BoardMemberRecord,
    person: Optional[dict[str, str]],
) -> BoardMemberRecord:
    return member.model_copy(
        update={
            "display_name": member.display_name or (person["display_name"] if person else None),
            "email": member.email or (person["email"] if person else None),
            "workspace_role": member.workspace_role or (person["workspace_role"] if person else None),
        }
    )


def _default_owner_member(
    record: BoardRecord,
    person: Optional[dict[str, str]],
    context: ApiRequestContext,
) -> BoardMemberRecord:
    display_name = context.user_display_name if record.owner_id == context.user_id else record.owner_id
    return BoardMemberRecord(
        displayName=person["display_name"] if person else display_name,
        email=person["email"] if person else None,
        invitedBy=None,
        joinedAt=record.created_at or record.saved_at,
        role="owner",
        userId=record.owner_id,
        workspaceRole=person["workspace_role"] if person else "owner",
    )
