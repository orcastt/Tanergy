import json
from copy import deepcopy
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import (
    assert_board_page_limit,
    assert_can_create_board,
    assert_can_own_board,
    assert_can_read_board,
    assert_can_write_board,
    assert_workspace_allows_board_visibility,
    can_read_board,
    can_read_workspace,
    workspace_kind_allows_board_sharing,
)
from tangent_api.board_asset_references import assert_no_local_foreign_asset_refs
from tangent_api.board_guard import audit_board_document
from tangent_api.board_metadata import get_board_snapshot_display_title
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardMemberRecord,
    BoardRecord,
    BoardRestoreResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardSummary,
    get_board_document_metrics,
    normalize_board_card_color,
    normalize_board_description,
    normalize_board_share_id,
    normalize_board_thumbnail_url,
    normalize_board_title,
    normalize_board_visibility,
    summarize_board_record,
)
from tangent_api.storage.local_board_snapshot_store import create_board_snapshot, load_board_snapshot
from tangent_api.storage.local_board_store_records import (
    _get_board_member_role,
    _load_board_without_touch,
    _read_board_record,
    _read_existing_board,
    _read_workspace_people,
    _write_board_record,
    _write_member_records,
)
from tangent_api.storage.local_board_store_support import (
    _assert_local_driver,
    _copy_title,
    _paginate_board_summaries,
    _sanitize_board_id,
    _storage_root,
)


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
        if not input_data.create_if_missing:
            raise HTTPException(status_code=404, detail="Board not found in workspace.")
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
        ownerId=existing.owner_id if existing else _resolve_local_board_owner_id(context, saved_at),
        savedAt=saved_at,
        shapeCount=metrics["shape_count"],
        shareId=normalize_board_share_id(existing.share_id if existing else None),
        thumbnailUrl=normalize_board_thumbnail_url(input_data.thumbnail_url or (existing.thumbnail_url if existing else None)),
        title=normalize_board_title(input_data.title, existing.title if existing else "Untitled Board"),
        visibility=normalize_board_visibility(existing.visibility if existing else None),
        workspaceId=context.workspace_id,
    )
    _write_board_record(record)
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


def _resolve_local_board_owner_id(context: ApiRequestContext, saved_at: str) -> str:
    if context.workspace_kind not in {"group_workspace", "team_workspace"} or context.workspace_role == "owner":
        return context.user_id
    placeholder = BoardRecord(
        assetCount=0,
        byteSize=0,
        cardColor=None,
        createdAt=saved_at,
        description=None,
        document={},
        id="temp",
        isPinned=False,
        isStarred=False,
        lastOpenedAt=None,
        ownerId=context.user_id,
        savedAt=saved_at,
        shapeCount=0,
        shareId=None,
        thumbnailUrl=None,
        title="",
        visibility="private",
        workspaceId=context.workspace_id,
    )
    owner = next((person for person in _read_workspace_people(context.workspace_id, placeholder, context) if person["workspace_role"] == "owner"), None)
    return owner["user_id"] if owner else context.user_id


def load_board(board_id: str, context: ApiRequestContext) -> BoardRecord:
    _assert_local_driver()
    safe_board_id = _sanitize_board_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")

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
        member_role = _get_board_member_role(record.id, record, context)
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
    next_title = normalize_board_title(title, record.title) if title is not None else record.title

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
    if not workspace_kind_allows_board_sharing(context.workspace_kind):
        update_data["share_id"] = None

    updated = record.model_copy(update=update_data)
    _write_board_record(updated)
    return summarize_board_record(updated)


def delete_board(board_id: str, context: ApiRequestContext) -> str:
    record = _load_board_without_touch(board_id, context, required_access="read")
    assert_can_own_board(record, context, _get_board_member_role(record.id, record, context))
    path = _storage_root() / "boards" / f"{record.id}.json"
    member_path = _storage_root() / "boards" / f"{record.id}.members.json"
    path.unlink()
    member_path.unlink(missing_ok=True)
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
