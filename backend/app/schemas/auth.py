from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SendOtpRequest(BaseModel):
    email: EmailStr


class SendOtpResponse(BaseModel):
    message: str
    expires_in: int = 600
    dev_code: str | None = None


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str


class VerifyOtpResponse(BaseModel):
    token: str
    user: UserOut
    is_new_user: bool


class GoogleAuthRequest(BaseModel):
    code: str


class GoogleAuthResponse(BaseModel):
    token: str
    user: UserOut
    is_new_user: bool
