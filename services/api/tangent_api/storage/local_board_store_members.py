from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardMemberCandidateRecord, BoardMemberRecord
from tangent_api.storage.local_board_store_records import (
    _load_board_without_touch,
    _read_member_records,
    _read_workspace_people,
    _write_member_records,
    _write_workspace_people,
)
from tangent_api.storage.local_board_store_support import (
    _create_local_person_id,
    _normalize_board_member_role,
    _normalize_display_name,
    _normalize_email,
)


def list_board_members(board_id: str, context: ApiRequestContext) -> list[BoardMemberRecord]:
    record = _load_board_without_touch(board_id, context, required_access="read")
    return _read_member_records(record.id, record, context)


def upsert_board_member(
    board_id: str,
    user_id: str,
    role: str,
    display_name: Optional[str],
    context: ApiRequestContext,
) -> BoardMemberRecord:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    normalized_role = _normalize_board_member_role(role)
    people = _read_workspace_people(record.workspace_id, record, context)
    person = next((item for item in people if item["user_id"] == user_id), None)
    members = _read_member_records(record.id, record, context)
    now = datetime.now(timezone.utc).isoformat()
    next_display_name = display_name.strip() if isinstance(display_name, str) and display_name.strip() else None
    next_member = BoardMemberRecord(
        displayName=next_display_name or (person["display_name"] if person else user_id),
        email=person["email"] if person else None,
        invitedBy=context.user_id,
        joinedAt=next((member.joined_at for member in members if member.user_id == user_id), now),
        role=normalized_role,
        userId=user_id,
        workspaceRole=person["workspace_role"] if person else None,
    )
    filtered = [member for member in members if member.user_id != user_id]
    filtered.append(next_member)
    _write_member_records(record.id, filtered)
    return next_member


def remove_board_member(board_id: str, user_id: str, context: ApiRequestContext) -> str:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    if user_id == record.owner_id:
        raise HTTPException(status_code=400, detail="Board owner cannot be removed.")
    members = _read_member_records(record.id, record, context)
    _write_member_records(record.id, [member for member in members if member.user_id != user_id])
    return user_id


def search_board_member_candidates(
    board_id: str,
    query: str,
    context: ApiRequestContext,
) -> list[BoardMemberCandidateRecord]:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    normalized_query = query.strip().lower()
    if not normalized_query:
        return []
    people = _read_workspace_people(record.workspace_id, record, context)
    member_roles = {member.user_id: member.role for member in _read_member_records(record.id, record, context)}
    candidates: list[BoardMemberCandidateRecord] = []
    for person in people:
        haystacks = [person["email"].lower(), person["user_id"].lower()]
        display_name = person.get("display_name")
        if display_name:
            haystacks.append(display_name.lower())
        if not any(normalized_query in item for item in haystacks):
            continue
        board_role = member_roles.get(person["user_id"])
        candidates.append(
            BoardMemberCandidateRecord(
                alreadyMember=board_role is not None,
                boardRole=board_role,
                displayName=display_name,
                email=person["email"],
                userId=person["user_id"],
                workspaceRole=person["workspace_role"],
            )
        )
    candidates.sort(
        key=lambda item: (
            item.already_member,
            (item.display_name or item.email).lower(),
            item.user_id.lower(),
        )
    )
    return candidates[:12]


def invite_board_member_by_email(
    board_id: str,
    email: str,
    role: str,
    display_name: Optional[str],
    context: ApiRequestContext,
) -> BoardMemberRecord:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    normalized_email = _normalize_email(email)
    normalized_display_name = _normalize_display_name(display_name) or normalized_email.split("@")[0]
    people = _read_workspace_people(record.workspace_id, record, context)
    existing_person = next((item for item in people if item["email"].lower() == normalized_email.lower()), None)
    if existing_person:
        user_id = existing_person["user_id"]
        workspace_role = existing_person["workspace_role"]
        display = existing_person.get("display_name") or normalized_display_name
    else:
        user_id = _create_local_person_id(normalized_email)
        workspace_role = "member"
        display = normalized_display_name
        people.append(
            {
                "display_name": display,
                "email": normalized_email,
                "user_id": user_id,
                "workspace_role": workspace_role,
            }
        )
        _write_workspace_people(record.workspace_id, people)

    return upsert_board_member(board_id, user_id, role, display, context).model_copy(
        update={"email": normalized_email, "workspace_role": workspace_role}
    )
