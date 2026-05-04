def get_image_dimensions(content: bytes, mime: str) -> tuple[int, int]:
    if mime == "image/png" and len(content) >= 24 and content[1:4] == b"PNG":
        return int.from_bytes(content[16:20], "big"), int.from_bytes(content[20:24], "big")
    if mime == "image/jpeg":
        return _jpeg_dimensions(content)
    if mime == "image/webp":
        return _webp_dimensions(content)
    return 0, 0


def _jpeg_dimensions(content: bytes) -> tuple[int, int]:
    offset = 2
    while offset + 9 < len(content):
        if content[offset] != 0xFF:
            return 0, 0
        marker = content[offset + 1]
        length = int.from_bytes(content[offset + 2:offset + 4], "big")
        if 0xC0 <= marker <= 0xCF and marker not in {0xC4, 0xC8, 0xCC}:
            return (
                int.from_bytes(content[offset + 7:offset + 9], "big"),
                int.from_bytes(content[offset + 5:offset + 7], "big"),
            )
        offset += 2 + length
    return 0, 0


def _webp_dimensions(content: bytes) -> tuple[int, int]:
    if len(content) < 30 or content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        return 0, 0
    chunk = content[12:16]
    if chunk == b"VP8X":
        return 1 + int.from_bytes(content[24:27], "little"), 1 + int.from_bytes(content[27:30], "little")
    if chunk == b"VP8 ":
        return (
            int.from_bytes(content[26:28], "little") & 0x3FFF,
            int.from_bytes(content[28:30], "little") & 0x3FFF,
        )
    if chunk == b"VP8L" and len(content) >= 25:
        bits = int.from_bytes(content[21:25], "little")
        return 1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)
    return 0, 0
