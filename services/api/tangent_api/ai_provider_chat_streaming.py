import json
from typing import Optional


def parse_chat_completion_response(
    content: bytes,
    *,
    content_length: Optional[str],
    content_type: Optional[str],
    max_bytes: int,
) -> dict[str, object]:
    _assert_size(content, content_length, max_bytes)
    if _looks_like_sse(content, content_type):
        return _parse_sse_chat_response(content)
    body = json.loads(content.decode("utf-8"))
    if not isinstance(body, dict):
        raise ValueError("Provider response was not a JSON object.")
    return body


def _assert_size(content: bytes, content_length: Optional[str], max_bytes: int) -> None:
    if content_length:
        try:
            if int(content_length) > max_bytes:
                raise ValueError("Provider response exceeded the JSON size limit.")
        except ValueError as exc:
            raise ValueError("Provider response exceeded the JSON size limit.") from exc
    if len(content) > max_bytes:
        raise ValueError("Provider response exceeded the JSON size limit.")


def _looks_like_sse(content: bytes, content_type: Optional[str]) -> bool:
    normalized_type = (content_type or "").lower()
    if "text/event-stream" in normalized_type:
        return True
    return content.lstrip().startswith(b"data:")


def _parse_sse_chat_response(content: bytes) -> dict[str, object]:
    text_parts: list[str] = []
    usage: Optional[dict[str, object]] = None
    for event in content.decode("utf-8", errors="replace").split("\n\n"):
        for line in event.splitlines():
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if not data or data == "[DONE]":
                continue
            chunk = _loads_chunk(data)
            if chunk is None:
                continue
            next_usage = chunk.get("usage")
            if isinstance(next_usage, dict):
                usage = next_usage
            text = _chunk_text(chunk)
            if text:
                text_parts.append(text)
    body: dict[str, object] = {
        "choices": [
            {
                "message": {
                    "content": "".join(text_parts),
                },
            }
        ],
    }
    if usage is not None:
        body["usage"] = usage
    return body


def _loads_chunk(data: str) -> Optional[dict[str, object]]:
    try:
        chunk = json.loads(data)
    except json.JSONDecodeError:
        return None
    return chunk if isinstance(chunk, dict) else None


def _chunk_text(chunk: dict[str, object]) -> str:
    choices = chunk.get("choices")
    if not isinstance(choices, list):
        return ""
    values: list[str] = []
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        delta = choice.get("delta")
        if isinstance(delta, dict):
            values.append(_content_text(delta.get("content")))
            continue
        message = choice.get("message")
        if isinstance(message, dict):
            values.append(_content_text(message.get("content")))
    return "".join(values)


def _content_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    values: list[str] = []
    for item in content:
        if isinstance(item, dict) and isinstance(item.get("text"), str):
            values.append(item["text"])
    return "".join(values)
