from __future__ import annotations

from typing import Optional

from tangent_api.storage.asset_store_common import detect_image_mime


def resolve_provider_image_mime(content: bytes, header_mime: Optional[str] = None) -> str:
    detected = detect_image_mime(content)
    if detected:
        return detected
    normalized_header = (header_mime or "").strip().lower()
    if normalized_header.startswith("image/"):
        raise ValueError("Provider returned image content with an unsupported or invalid format.")
    raise ValueError("Provider returned non-image output.")
