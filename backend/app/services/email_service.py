import httpx
from fastapi import HTTPException

from app.core.config import settings


async def send_otp_email(email: str, code: str) -> None:
    if not settings.RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.RESEND_FROM_EMAIL,
                "to": [email],
                "subject": "TANVAS 验证码 / Verification Code",
                "html": (
                    f"<div style='font-family:sans-serif;max-width:400px;margin:0 auto;'>"
                    f"<h2>TANVAS</h2>"
                    f"<p>您的验证码是：</p>"
                    f"<p style='font-size:32px;font-weight:bold;letter-spacing:4px;'>{code}</p>"
                    f"<p style='color:#898989;'>验证码 10 分钟内有效。</p>"
                    f"</div>"
                ),
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to send email")
