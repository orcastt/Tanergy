import json
import os
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import (
    assert_board_page_limit,
    assert_board_allows_share_links,
    assert_can_create_board,
    assert_can_manage_board,
    assert_can_own_board,
    assert_can_read_board,
    assert_workspace_allows_board_visibility,
    assert_can_write_board,
    can_read_board,
    can_read_workspace,
    workspace_kind_allows_board_sharing,
)
from tangent_api.board_asset_references import assert_no_local_foreign_asset_refs
from tangent_api.board_guard import audit_board_document
from tangent_api.board_metadata import get_board_snapshot_display_title
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardMemberCandidateRecord,
    BoardMemberRecord,
    BoardRecord,
    BoardRestoreResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardShareLinkRecord,
    BoardShareLinkResolveRecord,
    BoardSummary,
    get_board_document_metrics,
    normalize_board_card_color,
    normalize_board_description,
    normalize_board_share_id,
    normalize_board_thumbnail_url,
    normalize_board_visibility,
    summarize_board_record,
)
from tangent_api.storage.local_board_snapshot_store import create_board_snapshot, load_board_snapshot

BOARD_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
BOARD_MEMBER_ROLE_PATTERN = {"owner", "admin", "editor", "viewer", "temporary_viewer"}
BOARD_SHARE_ACCESS_ROLE_PATTERN = {"viewer", "editor"}
WORKSPACE_ROLE_PATTERN = {"owner", "admin", "member", "guest"}


def save_board(input_data: BoardSaveRequest, context: ApiRequestContext) -> BoardSaveResponse:
    _assert_local_driver()
    audit = audit_board_document(input_data.document)
    if not audit.ok:
        return BoardSaveResponse(audit=audit, error="Board document failed save guard.", ok=False)
    assert_no_local_foreign_asset_refs(input_data.document, context)

    board_id = _sanitize_board_id(input_data.board_id) or f"board_{uuid4()}"
    metrics = get_board_document_metrics(input_data.document)
    assert_board_page_limit(metrics.get("page_count", 1), context)
    existing = _read_existing_board(board_id, context)
    if existing:
        assert_can_write_board(existing, context, _get_board_member_role(existing.id, existing, context))
    else:
        assert_can_create_board(context)
    saved_at = datetime.now(timezone.utc).isoformat()
    record = BoardRecord(
        assetCount=metrics["asset_count"],
        byteSize=audit.byte_size,
        cardColor=normalize_board_card_color(input_data.card_color or (existing.card_color if existing else None)),
        createdAt=existing.created_at if existing else saved_at,
        description=normalize_board_description(input_data.description or (existing.description if existing else None)),
        document=input_data.document,
        id=board_id,
        isPinned=existing.is_pinned if existing else False,
        isStarred=existing.is_starred if existing else False,
        lastOpenedAt=existing.last_opened_at if existing else None,
        ownerId=existing.owner_id if existing else context.user_id,
        savedAt=saved_at,
        shapeCount=metrics["shape_count"],
        shareId=normalize_board_share_id(existing.share_id if existing else None),
        thumbnailUrl=normalize_board_thumbnail_url(input_data.thumbnail_url or (existing.thumbnail_url if existing else None)),
        title=(input_data.title or "Untitled Board").strip() or "Untitled Board",
        visibility=normalize_board_visibility(existing.visibility if existing else None),
        workspaceId=context.workspace_id,
    )

    path = _board_path(board_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(record.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not existing:
        _write_member_records(
            record.id,
            [
                BoardMemberRecord(
                    displayName=context.user_display_name,
                    invitedBy=None,
                    joinedAt=saved_at,
                    role="owner",
                    userId=record.owner_id,
                )
            ],
        )
    return BoardSaveResponse(audit=audit, board=summarize_board_record(record), ok=True)


def load_board(board_id: str, context: ApiRequestContext) -> BoardRecord:
    _assert_local_driver()
    safe_board_id = _sanitize_board_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")

    path = _board_path(safe_board_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Board not found.")

    record = _read_board_record(safe_board_id)
    assert_can_read_board(record, context, _get_board_member_role(record.id, record, context))
    updated = record.model_copy(update={"last_opened_at": datetime.now(timezone.utc).isoformat()})
    _write_board_record(updated)
    return updated


def list_boards(context: ApiRequestContext) -> list[BoardSummary]:
    boards, _ = list_boards_paginated(context)
    return boards


def list_boards_paginated(
    context: ApiRequestContext,
    cursor: Optional[str] = None,
    limit: int = 50,
) -> tuple[list[BoardSummary], Optional[str]]:
    _assert_local_driver()
    if not can_read_workspace(context):
        return [], None
    boards_root = _storage_root() / "boards"
    if not boards_root.exists():
        return [], None

    summaries: list[BoardSummary] = []
    for path in boards_root.glob("*.json"):
        if path.name.endswith((".members.json", ".shares.json")):
            continue
        try:
            record = BoardRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            continue
        member_role = _get_board_member_role(record.id, record, context) if context.workspace_role == "guest" else None
        if not can_read_board(record, context, member_role):
            continue
        summaries.append(summarize_board_record(record))

    ordered = sorted(summaries, key=lambda record: (record.saved_at, record.id), reverse=True)
    return _paginate_board_summaries(ordered, cursor, limit)


def rename_board(board_id: str, title: Optional[str], context: ApiRequestContext) -> BoardSummary:
    return update_board_metadata(board_id, title, None, None, None, None, None, None, None, context)


def update_board_metadata(
    board_id: str,
    title: Optional[str],
    description: Optional[str],
    card_color: Optional[str],
    thumbnail_url: Optional[str],
    is_starred: Optional[bool],
    is_pinned: Optional[bool],
    visibility: Optional[str],
    share_id: Optional[str],
    context: ApiRequestContext,
) -> BoardSummary:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    next_title = title.strip() if title is not None else record.title
    if not next_title:
        raise HTTPException(status_code=400, detail="Board title is required.")
    if len(next_title) > 80:
        raise HTTPException(status_code=400, detail="Board title must be 80 characters or fewer.")

    update_data = {"title": next_title, "saved_at": datetime.now(timezone.utc).isoformat()}
    if description is not None:
        update_data["description"] = normalize_board_description(description)
    if card_color is not None:
        update_data["card_color"] = normalize_board_card_color(card_color)
    if thumbnail_url is not None:
        update_data["thumbnail_url"] = normalize_board_thumbnail_url(thumbnail_url)
    if is_starred is not None:
        update_data["is_starred"] = bool(is_starred)
    if is_pinned is not None:
        update_data["is_pinned"] = bool(is_pinned)
    if visibility is not None:
        next_visibility = normalize_board_visibility(visibility)
        assert_workspace_allows_board_visibility(context.workspace_kind, next_visibility)
        update_data["visibility"] = next_visibility
    if share_id is not None:
        update_data["share_id"] = normalize_board_share_id(share_id)
    next_visibility = str(update_data.get("visibility", record.visibility))
    if not workspace_kind_allows_board_sharing(context.workspace_kind):
        update_data["share_id"] = None

    updated = record.model_copy(update=update_data)
    _write_board_record(updated)
    return summarize_board_record(updated)


def delete_board(board_id: str, context: ApiRequestContext) -> str:
    record = _load_board_without_touch(board_id, context, required_access="read")
    assert_can_own_board(record, context, _get_board_member_role(record.id, record, context))
    _board_path(record.id).unlink()
    _member_path(record.id).unlink(missing_ok=True)
    return record.id


def copy_board(board_id: str, context: ApiRequestContext) -> BoardSummary:
    source = _load_board_without_touch(board_id, context, required_access="read")
    assert_can_own_board(source, context, _get_board_member_role(source.id, source, context))
    assert_can_create_board(context)
    copied = save_board(
        BoardSaveRequest(
            boardId=None,
            cardColor=source.card_color,
            description=source.description,
            document=deepcopy(source.document),
            thumbnailUrl=source.thumbnail_url,
            title=_copy_title(source.title),
        ),
        context,
    )
    if not copied.ok or not copied.board:
        raise HTTPException(status_code=422, detail=copied.error or "Board copy failed.")
    return copied.board


def restore_board_snapshot(board_id: str, snapshot_id: str, context: ApiRequestContext) -> BoardRestoreResponse:
    record = _load_board_without_touch(board_id, context, required_access="write")
    source_snapshot = load_board_snapshot(board_id, snapshot_id, context)
    pre_restore_snapshot = create_board_snapshot(
        board_id,
        BoardSnapshotCreateRequest(
            document=record.document,
            reason="pre_restore",
            thumbnailUrl=record.thumbnail_url,
            title=get_board_snapshot_display_title(record.document, record.title),
        ),
        context,
    )
    restored = save_board(
        BoardSaveRequest(
            boardId=record.id,
            cardColor=record.card_color,
            description=record.description,
            document=deepcopy(source_snapshot.document),
            thumbnailUrl=source_snapshot.thumbnail_url or record.thumbnail_url,
            title=record.title,
        ),
        context,
    )
    if not restored.ok or not restored.board:
        raise HTTPException(status_code=422, detail=restored.error or "Board restore failed.")
    board = load_board(record.id, context)
    return BoardRestoreResponse(
        board=board,
        ok=True,
        preRestoreSnapshotId=pre_restore_snapshot.id,
        sourceSnapshotId=source_snapshot.id,
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
        update={
            "email": normalized_email,
            "workspace_role": workspace_role,
        }
    )


def ensure_board_share_link(
    board_id: str,
    access_role: str,
    context: ApiRequestContext,
    expires_at: Optional[str] = None,
) -> BoardShareLinkRecord:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    assert_board_allows_share_links(record, context.workspace_kind)
    normalized_access_role = _normalize_board_share_access_role(access_role)
    normalized_expires_at = _normalize_share_expires_at(expires_at)
    share_links = _read_share_links(record.id)
    existing = next((item for item in share_links if item.share_id and _is_share_link_active(item)), None)
    if existing:
        updated = existing.model_copy(update={"access_role": normalized_access_role, "expires_at": normalized_expires_at})
        next_links = [updated, *[item for item in share_links if item.id != existing.id]]
        _write_share_links(record.id, next_links)
        update_board_metadata(record.id, None, None, None, None, None, None, None, updated.share_id, context)
        return updated

    now = datetime.now(timezone.utc).isoformat()
    created = BoardShareLinkRecord(
        accessRole=normalized_access_role,
        boardId=record.id,
        createdAt=now,
        createdBy=context.user_id,
        expiresAt=normalized_expires_at,
        id=f"board_share_{uuid4()}",
        shareId=_create_share_id(),
        workspaceId=record.workspace_id,
    )
    _write_share_links(record.id, [created])
    update_board_metadata(record.id, None, None, None, None, None, None, None, created.share_id, context)
    return created


def revoke_board_share_link(board_id: str, share_id: str, context: ApiRequestContext) -> str:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    normalized_share_id = _require_share_id(share_id)
    share_links = _read_share_links(record.id)
    next_links = [item for item in share_links if item.share_id != normalized_share_id]
    if len(next_links) == len(share_links):
        raise HTTPException(status_code=404, detail="Board share link not found.")
    _write_share_links(record.id, next_links)
    update_board_metadata(record.id, None, None, None, None, None, None, None, "", context)
    return normalized_share_id


def resolve_board_share_link(share_id: str) -> BoardShareLinkResolveRecord:
    normalized_share_id = _require_share_id(share_id)
    boards_root = _storage_root() / "boards"
    if not boards_root.exists():
        raise HTTPException(status_code=404, detail="Board share link not found.")
    for path in boards_root.glob("*.shares.json"):
        board_id = path.name.removesuffix(".shares.json")
        for link in _read_share_links(board_id):
            if link.share_id != normalized_share_id or not _is_share_link_active(link):
                continue
            record = _read_board_record(board_id)
            return BoardShareLinkResolveRecord(
                accessRole=link.access_role,
                boardId=record.id,
                boardTitle=record.title,
                shareId=link.share_id,
                workspaceId=record.workspace_id,
            )
    raise HTTPException(status_code=404, detail="Board share link not found.")


def load_shared_board(share_id: str) -> BoardRecord:
    normalized_share_id = _require_share_id(share_id)
    boards_root = _storage_root() / "boards"
    if not boards_root.exists():
        raise HTTPException(status_code=404, detail="Board share link not found.")
    for path in boards_root.glob("*.shares.json"):
        board_id = path.name.removesuffix(".shares.json")
        for link in _read_share_links(board_id):
            if link.share_id != normalized_share_id or not _is_share_link_active(link):
                continue
            record = _read_board_record(board_id)
            opened_at = datetime.now(timezone.utc).isoformat()
            updated = record.model_copy(update={"last_opened_at": opened_at})
            _write_board_record(updated)
            return updated
    raise HTTPException(status_code=404, detail="Board share link not found.")


def _storage_root() -> Path:
    return Path(os.getenv("TANGENT_BOARD_STORAGE_DIR", ".tangent-boards"))


def _assert_local_driver() -> None:
    driver = os.getenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    if driver != "local-dev":
        raise HTTPException(
            status_code=501,
            detail=f'Unsupported board storage driver "{driver}". Supported driver: local-dev.',
        )


def _board_path(board_id: str) -> Path:
    return _storage_root() / "boards" / f"{board_id}.json"


def _member_path(board_id: str) -> Path:
    return _storage_root() / "boards" / f"{board_id}.members.json"


def _share_link_path(board_id: str) -> Path:
    return _storage_root() / "boards" / f"{board_id}.shares.json"


def _workspace_people_path(workspace_id: str) -> Path:
    return _storage_root() / "workspaces" / f"{workspace_id}.people.json"


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
    people_by_user_id = {
        item["user_id"]: item
        for item in _read_workspace_people(record.workspace_id, record, context)
    }
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


def _is_share_link_active(link: BoardShareLinkRecord) -> bool:
    if not link.expires_at:
        return True
    try:
        expires_at = datetime.fromisoformat(link.expires_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at > datetime.now(timezone.utc)


def _normalize_share_expires_at(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        expires_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid board share expiry.") from exc
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Board share expiry must be in the future.")
    return expires_at.isoformat()


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
    owner_display = record.owner_id
    if owner_user_id == context.user_id:
        owner_display = context.user_display_name
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
    people: list[dict[str, str]] = []
    for item in payload:
        person = _normalize_workspace_person(item)
        if person:
            people.append(person)
    by_user_id = {person["user_id"]: person for person in people}
    by_user_id.setdefault(owner_user_id, default_people[0])
    return sorted(by_user_id.values(), key=lambda item: (item["workspace_role"] != "owner", item["email"].lower()))


def _write_workspace_people(workspace_id: str, people: list[dict[str, str]]) -> None:
    path = _workspace_people_path(workspace_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    deduped = {
        person["user_id"]: person
        for person in people
        if person.get("user_id") and person.get("email")
    }
    ordered = sorted(deduped.values(), key=lambda item: (item["workspace_role"] != "owner", item["email"].lower()))
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _paginate_board_summaries(
    summaries: list[BoardSummary],
    cursor: Optional[str],
    limit: int,
) -> tuple[list[BoardSummary], Optional[str]]:
    normalized_limit = max(1, min(limit, 100))
    start_index = 0
    if cursor:
        for index, item in enumerate(summaries):
            if _encode_board_cursor(item) == cursor:
                start_index = index + 1
                break
    page = summaries[start_index:start_index + normalized_limit]
    next_cursor = _encode_board_cursor(page[-1]) if start_index + normalized_limit < len(summaries) and page else None
    return page, next_cursor


def _encode_board_cursor(board: BoardSummary) -> str:
    return f"{board.saved_at.replace('+00:00', 'Z')}|{board.id}"


def _copy_title(title: str) -> str:
    return f"{title} Copy" if title else "Untitled Board Copy"


def _normalize_board_member_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in BOARD_MEMBER_ROLE_PATTERN:
        raise HTTPException(status_code=400, detail="Invalid board member role.")
    return normalized


def _normalize_board_share_access_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in BOARD_SHARE_ACCESS_ROLE_PATTERN:
        raise HTTPException(status_code=400, detail="Invalid board share access role.")
    return normalized


def _normalize_workspace_person(payload: object) -> Optional[dict[str, str]]:
    if not isinstance(payload, dict):
        return None
    user_id = payload.get("user_id")
    email = payload.get("email")
    workspace_role = payload.get("workspace_role")
    if not isinstance(user_id, str) or not isinstance(email, str) or not isinstance(workspace_role, str):
        return None
    normalized_user_id = _sanitize_user_id(user_id)
    normalized_email = _normalize_email(email)
    normalized_workspace_role = workspace_role.strip().lower()
    if normalized_workspace_role not in WORKSPACE_ROLE_PATTERN:
        return None
    display_name = _normalize_display_name(payload.get("display_name"))
    return {
        "display_name": display_name or normalized_email.split("@")[0],
        "email": normalized_email,
        "user_id": normalized_user_id,
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


def _normalize_display_name(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed[:80] if trimmed else None


def _normalize_email(value: object) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail="Valid email is required.")
    trimmed = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", trimmed):
        raise HTTPException(status_code=400, detail="Valid email is required.")
    return trimmed[:320]


def _sanitize_user_id(value: str) -> str:
    trimmed = value.strip()
    if not trimmed or not BOARD_ID_PATTERN.match(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail="Invalid user id.")
    return trimmed


def _create_local_person_id(email: str) -> str:
    local_part = re.sub(r"[^a-z0-9]+", "_", email.split("@", 1)[0].lower()).strip("_")
    suffix = uuid4().hex[:6]
    return _sanitize_user_id(f"user_{local_part or 'member'}_{suffix}")


def _create_share_id() -> str:
    return uuid4().hex[:16]


def _require_share_id(value: str) -> str:
    normalized = normalize_board_share_id(value)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid board share id.")
    return normalized


def _sanitize_board_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if BOARD_ID_PATTERN.match(value) and ".." not in value:
        return value
    raise HTTPException(status_code=400, detail="Invalid board id.")
