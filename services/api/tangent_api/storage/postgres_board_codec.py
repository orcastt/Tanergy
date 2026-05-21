import json
import re
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.board_metadata import coerce_board_title
from tangent_api.schemas import BoardRecord

BOARD_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def board_record_from_row(row: tuple[Any, ...]) -> BoardRecord:
    last_opened_at = row[11].isoformat() if hasattr(row[11], "isoformat") else row[11]
    saved_at = row[12].isoformat() if hasattr(row[12], "isoformat") else str(row[12])
    created_at_value = row[13] if len(row) > 13 else None
    created_at = created_at_value.isoformat() if hasattr(created_at_value, "isoformat") else created_at_value
    document = row[4] if not isinstance(row[4], str) else json.loads(row[4])
    return BoardRecord(
        assetCount=row[6] or 0,
        byteSize=row[5],
        cardColor=row[9],
        createdAt=created_at or saved_at,
        description=row[8],
        document=document,
        id=row[0],
        isPinned=bool(row[15]) if len(row) > 15 else False,
        isStarred=bool(row[14]) if len(row) > 14 else False,
        lastOpenedAt=last_opened_at,
        ownerId=row[2],
        savedAt=saved_at,
        shapeCount=row[7] or 0,
        shareId=row[17] if len(row) > 17 else None,
        thumbnailUrl=row[10],
        title=coerce_board_title(row[3]),
        visibility=row[16] if len(row) > 16 else "private",
        workspaceId=row[1],
    )


def sanitize_board_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if BOARD_ID_PATTERN.match(value) and ".." not in value:
        return value
    raise HTTPException(status_code=400, detail="Invalid board id.")
