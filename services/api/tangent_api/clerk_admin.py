from __future__ import annotations

import os

import httpx
from fastapi import HTTPException


def delete_clerk_user(user_id: str) -> None:
    clerk_secret_key = (os.getenv("CLERK_SECRET_KEY") or "").strip()
    if not clerk_secret_key:
        raise HTTPException(status_code=503, detail="Clerk account deletion requires CLERK_SECRET_KEY.")

    url = f"https://api.clerk.com/v1/users/{user_id}"
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.delete(
                url,
                headers={
                    "Authorization": f"Bearer {clerk_secret_key}",
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 404:
                return
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="Clerk account deletion failed.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Clerk account deletion failed.") from exc
