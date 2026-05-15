from tangent_api.image_dimensions import get_image_dimensions


def test_get_image_dimensions_swaps_jpeg_orientation():
    content = (
        b"\xff\xd8"
        + b"\xff\xe1\x00\"\x45\x78\x69\x66\x00\x00"
        + b"\x4d\x4d\x00\x2a\x00\x00\x00\x08"
        + b"\x00\x01"
        + b"\x01\x12\x00\x03\x00\x00\x00\x01\x00\x06\x00\x00"
        + b"\x00\x00\x00\x00"
        + b"\xff\xc0\x00\x0b\x08\x03\x00\x05\x00\x01\x11\x00"
        + b"\xff\xd9"
    )

    assert get_image_dimensions(content, "image/jpeg") == (768, 1280)
