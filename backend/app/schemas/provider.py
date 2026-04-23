from datetime import datetime

from pydantic import BaseModel


class ProviderOut(BaseModel):
    id: str
    name: str
    base_url: str
    key_env: str
    auth_style: str
    extra_headers: dict | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderCreate(BaseModel):
    id: str
    name: str
    base_url: str
    key_env: str
    auth_style: str = "bearer"
    extra_headers: dict | None = None
    is_active: bool = True


class ProviderUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    key_env: str | None = None
    auth_style: str | None = None
    extra_headers: dict | None = None
    is_active: bool | None = None
