from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.credit import CreditBalance, CreditTransaction
from app.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY

PLAN_CONFIG = {
    "monthly": {
        "price_id": "",  # Set in env or here
        "credits": 500,
        "plan_name": "pro_monthly",
    },
    "yearly": {
        "price_id": "",
        "credits": 6000,
        "plan_name": "pro_yearly",
    },
}


class CheckoutRequest(BaseModel):
    plan: str  # "monthly" or "yearly"


class SubscriptionInfo(BaseModel):
    plan: str
    credits_remaining: int
    stripe_status: str | None = None


@router.post("/checkout")
async def create_checkout(
    req: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = PLAN_CONFIG.get(req.plan)
    if not config:
        raise HTTPException(status_code=400, detail="Invalid plan")

    try:
        session = stripe.checkout.Session.create(
            mode="payment" if not config["price_id"] else "subscription",
            customer_email=user.email,
            line_items=[{"price": config["price_id"], "quantity": 1}] if config["price_id"] else [],
            metadata={
                "user_id": str(user.id),
                "plan": req.plan,
                "credits": config["credits"],
            },
            success_url=settings.FRONTEND_URL + "/dashboard?checkout=success",
            cancel_url=settings.FRONTEND_URL + "/credits?checkout=cancelled",
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            body, sig, settings.STRIPE_WEBHOOK_SECRET,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        user_id = metadata.get("user_id")
        credits = int(metadata.get("credits", 0))
        plan = metadata.get("plan", "monthly")

        if user_id and credits > 0:
            from app.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                uid = UUID(user_id)
                result = await db.execute(
                    select(CreditBalance).where(CreditBalance.user_id == uid).with_for_update()
                )
                balance = result.scalar_one_or_none()
                if balance is None:
                    balance = CreditBalance(user_id=uid, balance=0, plan="free")
                    db.add(balance)
                    await db.flush()

                balance.balance += credits
                balance.plan = PLAN_CONFIG.get(plan, {}).get("plan_name", "free")
                txn = CreditTransaction(
                    user_id=uid, amount=credits, type="credit",
                    reason="purchase", description=f"Stripe {plan} plan",
                )
                db.add(txn)
                await db.commit()

    return {"received": True}


@router.get("/subscription")
async def get_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.user_id == user.id)
    )
    balance = result.scalar_one_or_none()

    return SubscriptionInfo(
        plan=balance.plan if balance else "free",
        credits_remaining=balance.balance if balance else 0,
        stripe_status=None,
    )
