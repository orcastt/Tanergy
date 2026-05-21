from typing import Optional

from fastapi import Request


def extract_request_ip(request: Request) -> Optional[str]:
    for header_name in ("x-forwarded-for", "x-real-ip"):
        raw_value = request.headers.get(header_name)
        if not raw_value:
            continue
        candidate = raw_value.split(",")[0].strip()
        normalized = normalize_last_ip_address(candidate)
        if normalized:
            return normalized
    client = getattr(request, "client", None)
    return normalize_last_ip_address(getattr(client, "host", None))


def normalize_last_ip_address(value: Optional[str]) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return normalized[:128]
