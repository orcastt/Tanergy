import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select

import logging

from app.core.config import settings
from app.core.redis import redis_pool
from app.models.otp import EmailOtp
from app.services.email_service import send_otp_email

logger = logging.getLogger(__name__)


async def rate_limit_check(email: str) -> None:
    redis = redis_pool
    key_1min = f"otp:1min:{email}"
    key_1hr = f"otp:1hr:{email}"

    count_1min = await redis.get(key_1min)
    if count_1min and int(count_1min) >= 1:
        raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting a new code")

    count_1hr = await redis.get(key_1hr)
    if count_1hr and int(count_1hr) >= 5:
        raise HTTPException(status_code=429, detail="Too many requests. Try again in an hour")

    pipe = redis.pipeline()
    pipe.incr(key_1min)
    pipe.expire(key_1min, 60)
    pipe.incr(key_1hr)
    pipe.expire(key_1hr, 3600)
    await pipe.execute()


async def create_otp(email: str, db) -> dict:
    await rate_limit_check(email)

    code = f"{random.randint(0, 999999):06d}"
    now = datetime.now(timezone.utc)

    otp = EmailOtp(email=email, code=code, created_at=now, expires_at=now + timedelta(minutes=10))
    db.add(otp)
    await db.commit()

    if settings.RESEND_API_KEY:
        await send_otp_email(email, code)
    else:
        logger.info("DEV MODE — OTP for %s: %s", email, code)

    resp = {"message": "Verification code sent", "expires_in": 600}
    if settings.APP_ENV == "development" and not settings.RESEND_API_KEY:
        resp["dev_code"] = code
    return resp


async def verify_otp(email: str, code: str, db) -> bool:
    stmt = (
        select(EmailOtp)
        .where(EmailOtp.email == email, EmailOtp.used_at.is_(None))
        .order_by(EmailOtp.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    otp = result.scalar_one_or_none()

    if not otp:
        raise HTTPException(status_code=400, detail="No verification code found. Please request a new one")

    if otp.attempts >= 5:
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please request a new code")

    otp.attempts += 1
    now = datetime.now(timezone.utc)

    if now > otp.expires_at:
        await db.commit()
        raise HTTPException(status_code=400, detail="Verification code expired. Please request a new one")

    if otp.code != code:
        await db.commit()
        remaining = 5 - otp.attempts
        raise HTTPException(status_code=400, detail=f"Invalid code. {remaining} attempts remaining")

    otp.used_at = now
    await db.commit()
    return True
