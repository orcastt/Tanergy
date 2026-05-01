import os
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException

S3_COMPATIBLE_REQUIRED_ENV = (
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
)


@dataclass(frozen=True)
class S3AssetStorageConfig:
    access_key_id: str
    addressing_style: str
    bucket: str
    endpoint: str
    public_base_url: Optional[str]
    region: str
    secret_access_key: str

    @classmethod
    def from_env(cls) -> "S3AssetStorageConfig":
        missing = [name for name in S3_COMPATIBLE_REQUIRED_ENV if not os.getenv(name)]
        if missing:
            raise HTTPException(
                status_code=501,
                detail="S3-compatible asset storage is not configured. Missing config: "
                + ", ".join(missing)
                + ".",
            )

        return cls(
            access_key_id=os.environ["S3_ACCESS_KEY_ID"],
            addressing_style=os.getenv("S3_ADDRESSING_STYLE", "path"),
            bucket=os.environ["S3_BUCKET"],
            endpoint=os.environ["S3_ENDPOINT"],
            public_base_url=os.getenv("S3_PUBLIC_BASE_URL") or None,
            region=os.getenv("S3_REGION", "auto"),
            secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        )


def create_s3_client(config: S3AssetStorageConfig) -> Any:
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise HTTPException(
            status_code=501,
            detail="boto3 is required for TANGENT_ASSET_STORAGE_DRIVER=s3-compatible.",
        ) from exc

    return boto3.client(
        "s3",
        aws_access_key_id=config.access_key_id,
        aws_secret_access_key=config.secret_access_key,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": config.addressing_style},
        ),
        endpoint_url=config.endpoint,
        region_name=config.region,
    )


def is_missing_object_error(exc: Exception) -> bool:
    response = getattr(exc, "response", None)
    if not isinstance(response, dict):
        return False
    error = response.get("Error") or {}
    code = str(error.get("Code") or "")
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return code in {"404", "NoSuchKey", "NotFound"} or status == 404
