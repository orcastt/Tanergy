from typing import Optional


def get_image_dimensions(content: bytes, mime: str) -> tuple[int, int]:
    if mime == "image/png" and len(content) >= 24 and content[1:4] == b"PNG":
        return int.from_bytes(content[16:20], "big"), int.from_bytes(content[20:24], "big")
    if mime == "image/jpeg":
        width, height, orientation = _jpeg_dimensions(content)
        if orientation in {5, 6, 7, 8}:
            return height, width
        return width, height
    if mime == "image/webp":
        return _webp_dimensions(content)
    return 0, 0


def _jpeg_dimensions(content: bytes) -> tuple[int, int, int]:
    offset = 2
    orientation = 1
    while offset + 9 < len(content):
        if content[offset] != 0xFF:
            return 0, 0, orientation
        marker = content[offset + 1]
        if marker == 0xD9 or marker == 0xDA:
            break
        if marker in {0x01} or 0xD0 <= marker <= 0xD7:
            offset += 2
            continue
        length = int.from_bytes(content[offset + 2:offset + 4], "big")
        if marker == 0xE1:
            parsed_orientation = _jpeg_exif_orientation(content[offset + 4:offset + 2 + length])
            if parsed_orientation is not None:
                orientation = parsed_orientation
        if 0xC0 <= marker <= 0xCF and marker not in {0xC4, 0xC8, 0xCC}:
            return (
                int.from_bytes(content[offset + 7:offset + 9], "big"),
                int.from_bytes(content[offset + 5:offset + 7], "big"),
                orientation,
            )
        offset += 2 + length
    return 0, 0, orientation


def _jpeg_exif_orientation(segment: bytes) -> Optional[int]:
    if len(segment) < 14 or not segment.startswith(b"Exif\x00\x00"):
        return None
    tiff = segment[6:]
    if len(tiff) < 8:
        return None
    byte_order = tiff[:2]
    if byte_order == b"II":
        endian = "little"
    elif byte_order == b"MM":
        endian = "big"
    else:
        return None
    if int.from_bytes(tiff[2:4], endian) != 42:
        return None
    ifd_offset = int.from_bytes(tiff[4:8], endian)
    if ifd_offset + 2 > len(tiff):
        return None
    ifd_end = ifd_offset + 2
    entry_count = int.from_bytes(tiff[ifd_offset:ifd_end], endian)
    cursor = ifd_end
    for _ in range(entry_count):
        if cursor + 12 > len(tiff):
            break
        tag = int.from_bytes(tiff[cursor:cursor + 2], endian)
        field_type = int.from_bytes(tiff[cursor + 2:cursor + 4], endian)
        count = int.from_bytes(tiff[cursor + 4:cursor + 8], endian)
        if tag == 0x0112 and field_type == 3 and count >= 1:
            return int.from_bytes(tiff[cursor + 8:cursor + 10], endian)
        cursor += 12
    return None


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
