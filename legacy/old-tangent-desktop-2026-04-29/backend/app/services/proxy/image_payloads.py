from app.core.model_options import (
    GPT_IMAGE_2_QUALITIES,
    GPT_IMAGE_2_SIZES,
    GPT_IMAGE_2_UNSUPPORTED_FIELDS,
)


def normalize_aspect_ratio(aspect_ratio: str | None) -> str:
    return (aspect_ratio or "1:1").replace("：", ":").strip() or "1:1"


def size_for_model(model: str, aspect_ratio: str | None) -> str:
    ratio = normalize_aspect_ratio(aspect_ratio)
    if model.startswith("jimeng"):
        return {
            "1:1": "2048x2048",
            "4:3": "2304x1728",
            "3:2": "2496x1664",
            "16:9": "2560x1440",
            "21:9": "3024x1296",
            "3:4": "1728x2304",
            "2:3": "1664x2496",
            "9:16": "1440x2560",
        }.get(ratio, "2048x2048")
    if model.startswith("gpt-image"):
        return {
            "3:4": "1024x1536",
            "2:3": "1024x1536",
            "9:16": "1024x1536",
            "4:3": "1536x1024",
            "3:2": "1536x1024",
            "16:9": "1536x1024",
        }.get(ratio, "1024x1024")
    return "1024x1024"


def build_openai_image_body(model: str, prompt: str, aspect_ratio: str | None) -> dict:
    body: dict = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "async": False,
        "retries": 0,
        "response_format": "url",
        "output_format": "png",
    }
    if model.startswith(("gpt-image", "jimeng")):
        body["size"] = size_for_model(model, aspect_ratio)
    elif "nano-banana" in model:
        body["aspect_ratio"] = normalize_aspect_ratio(aspect_ratio)
        if model in {"nano-banana-2", "nano-banana-hd"}:
            body["size"] = "1K"
    else:
        body["aspect_ratio"] = normalize_aspect_ratio(aspect_ratio)
    return body


def merge_optional_image_fields(body: dict, fields: dict) -> dict:
    for key, value in fields.items():
        if value is not None:
            body[key] = value
    normalize_gpt_image_2_body(body)
    return body


def normalize_gpt_image_2_body(body: dict) -> dict:
    if body.get("model") != "gpt-image-2":
        return body
    for key in GPT_IMAGE_2_UNSUPPORTED_FIELDS:
        body.pop(key, None)
    if isinstance(body.get("image"), list):
        body["images"] = body.pop("image")
    if body.get("size") is not None:
        body["size"] = str(body["size"]).strip()
    if body.get("quality") is not None:
        body["quality"] = str(body["quality"]).strip().lower()
    if body.get("size") not in GPT_IMAGE_2_SIZES:
        raise ValueError(f"gpt-image-2 size must be one of: {', '.join(sorted(GPT_IMAGE_2_SIZES))}")
    if body.get("quality") is not None and body["quality"] not in GPT_IMAGE_2_QUALITIES:
        raise ValueError(f"gpt-image-2 quality must be one of: {', '.join(sorted(GPT_IMAGE_2_QUALITIES))}")
    return body


def normalize_image_value(image: str | list[str]) -> str | list[str]:
    if isinstance(image, list):
        return [normalize_image_value(item) for item in image]
    if image.startswith(("http://", "https://", "data:")):
        return image
    return f"data:image/png;base64,{image}"


def build_openai_image_edit_body(
    model: str,
    prompt: str,
    image: str | list[str],
    aspect_ratio: str | None,
) -> dict:
    body: dict = {
        "model": model,
        "prompt": prompt,
        "image": normalize_image_value(image),
        "background": "auto",
        "n": 1,
        "quality": "auto",
        "response_format": "url",
        "output_format": "png",
        "retries": 0,
    }
    if aspect_ratio:
        body["aspect_ratio"] = normalize_aspect_ratio(aspect_ratio)
    if model.startswith("gpt-image"):
        body["size"] = size_for_model(model, aspect_ratio)
    return body
