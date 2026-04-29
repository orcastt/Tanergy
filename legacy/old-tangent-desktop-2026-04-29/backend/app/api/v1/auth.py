from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.security import create_jwt
from app.models.user import User
from app.models.credit import CreditBalance, CreditTransaction
from app.schemas.auth import (
    GoogleAuthRequest, GoogleAuthResponse,
    SendOtpRequest, SendOtpResponse,
    VerifyOtpRequest, VerifyOtpResponse,
    UserOut,
)
from app.services.google_service import exchange_code
from app.services.otp_service import create_otp, verify_otp

router = APIRouter()


@router.post("/send-otp", response_model=SendOtpResponse)
async def send_otp(req: SendOtpRequest, db=Depends(get_db)):
    result = await create_otp(req.email, db)
    return SendOtpResponse(**result)


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp_route(req: VerifyOtpRequest, db=Depends(get_db)):
    await verify_otp(req.email, req.code, db)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    is_new = user is None
    if is_new:
        display_name = req.email.split("@")[0]
        user = User(email=req.email, display_name=display_name)
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Signup bonus: 50 free credits
        balance = CreditBalance(user_id=user.id, balance=50, plan="free")
        db.add(balance)
        txn = CreditTransaction(
            user_id=user.id, amount=50, type="credit",
            reason="signup_bonus", description="Welcome bonus",
        )
        db.add(txn)
        await db.commit()

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = create_jwt(str(user.id))
    return VerifyOtpResponse(token=token, user=UserOut.model_validate(user), is_new_user=is_new)


@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(req: GoogleAuthRequest, db=Depends(get_db)):
    info = await exchange_code(req.code)
    email = info.get("email")
    google_id = info.get("sub")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    result = await db.execute(select(User).where((User.google_id == google_id) | (User.email == email)))
    user = result.scalar_one_or_none()

    is_new = user is None
    if is_new:
        user = User(
            email=email,
            google_id=google_id,
            display_name=info.get("name", email.split("@")[0]),
            avatar_url=info.get("picture"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.google_id:
        user.google_id = google_id
        if info.get("picture") and not user.avatar_url:
            user.avatar_url = info["picture"]

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    token = create_jwt(str(user.id))
    return GoogleAuthResponse(token=token, user=UserOut.model_validate(user), is_new_user=is_new)


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/logout")
async def logout():
    return {"message": "logged out"}
