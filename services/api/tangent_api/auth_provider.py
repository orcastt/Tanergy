import base64
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import HTTPException

DEFAULT_CLERK_JWKS_URL = "https://api.clerk.com/v1/jwks"
JWKS_CACHE_TTL_SECONDS = 300

_jwks_cache: dict[str, tuple[float, dict[str, Any]]] = {}


@dataclass(frozen=True)
class VerifiedAuthIdentity:
    provider: str
    provider_subject: str
    email: Optional[str]
    email_verified: bool
    display_name: str
    avatar_url: Optional[str]
    session_id: Optional[str]


async def verify_bearer_token(token: str) -> VerifiedAuthIdentity:
    provider = (os.getenv("AUTH_PROVIDER") or "clerk").strip().lower()
    if provider != "clerk":
        raise HTTPException(status_code=501, detail=f"Unsupported auth provider: {provider}.")
    return await _verify_clerk_session_token(token)


async def _verify_clerk_session_token(token: str) -> VerifiedAuthIdentity:
    header, claims, signature, signing_input = _decode_jwt_parts(token)
    if header.get("alg") != "RS256":
        raise HTTPException(status_code=401, detail="Invalid token algorithm.")
    key_id = header.get("kid")
    if not isinstance(key_id, str) or not key_id.strip():
        raise HTTPException(status_code=401, detail="Missing token key id.")

    jwks = await _load_clerk_jwks()
    jwk = _find_jwk(jwks, key_id)
    public_key = _build_rsa_public_key(jwk)
    _verify_signature(public_key, signing_input, signature)
    _validate_registered_claims(claims)

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise HTTPException(status_code=401, detail="Missing token subject.")

    return VerifiedAuthIdentity(
        provider="clerk",
        provider_subject=subject,
        email=_optional_str(claims.get("email")),
        email_verified=_coerce_bool(claims.get("email_verified")),
        display_name=_get_display_name(claims),
        avatar_url=_optional_str(claims.get("image_url")),
        session_id=_optional_str(claims.get("sid")),
    )


def _decode_jwt_parts(token: str) -> tuple[dict[str, Any], dict[str, Any], bytes, bytes]:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Malformed bearer token.")
    header_segment, payload_segment, signature_segment = parts
    try:
        header = json.loads(_decode_base64url(header_segment))
        claims = json.loads(_decode_base64url(payload_segment))
        signature = base64.urlsafe_b64decode(_pad_base64(signature_segment))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Malformed bearer token.") from exc
    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    if not isinstance(header, dict) or not isinstance(claims, dict):
        raise HTTPException(status_code=401, detail="Malformed bearer token.")
    return header, claims, signature, signing_input


async def _load_clerk_jwks() -> dict[str, Any]:
    jwks_url = (os.getenv("CLERK_JWKS_URL") or DEFAULT_CLERK_JWKS_URL).strip()
    cached = _jwks_cache.get(jwks_url)
    now = time.time()
    if cached and now - cached[0] < JWKS_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            jwks = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Failed to load auth verification keys.") from exc

    if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
        raise HTTPException(status_code=503, detail="Invalid auth verification key set.")

    _jwks_cache[jwks_url] = (now, jwks)
    return jwks


def _find_jwk(jwks: dict[str, Any], key_id: str) -> dict[str, Any]:
    for item in jwks.get("keys", []):
        if isinstance(item, dict) and item.get("kid") == key_id:
            return item
    raise HTTPException(status_code=401, detail="Unknown token signing key.")


def _build_rsa_public_key(jwk: dict[str, Any]) -> rsa.RSAPublicKey:
    if jwk.get("kty") != "RSA":
        raise HTTPException(status_code=401, detail="Unsupported token key type.")
    modulus = _optional_str(jwk.get("n"))
    exponent = _optional_str(jwk.get("e"))
    if not modulus or not exponent:
        raise HTTPException(status_code=401, detail="Incomplete token signing key.")
    try:
        public_numbers = rsa.RSAPublicNumbers(
            e=int.from_bytes(base64.urlsafe_b64decode(_pad_base64(exponent)), "big"),
            n=int.from_bytes(base64.urlsafe_b64decode(_pad_base64(modulus)), "big"),
        )
        return public_numbers.public_key()
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token signing key.") from exc


def _verify_signature(public_key: rsa.RSAPublicKey, signing_input: bytes, signature: bytes) -> None:
    try:
        public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
    except Exception as exc:  # pragma: no cover - cryptography raises several concrete types
        raise HTTPException(status_code=401, detail="Invalid token signature.") from exc


def _validate_registered_claims(claims: dict[str, Any]) -> None:
    now = int(time.time())
    exp = claims.get("exp")
    nbf = claims.get("nbf")
    if not isinstance(exp, (int, float)) or now >= int(exp):
        raise HTTPException(status_code=401, detail="Expired auth token.")
    if isinstance(nbf, (int, float)) and now < int(nbf):
        raise HTTPException(status_code=401, detail="Auth token is not active yet.")

    issuer = (os.getenv("CLERK_JWT_ISSUER") or "").strip()
    if issuer:
        if claims.get("iss") != issuer:
            raise HTTPException(status_code=401, detail="Invalid token issuer.")

    audience = (os.getenv("CLERK_JWT_AUDIENCE") or "").strip()
    if audience:
        claim_audience = claims.get("aud")
        audience_values = claim_audience if isinstance(claim_audience, list) else [claim_audience]
        if audience not in audience_values:
            raise HTTPException(status_code=401, detail="Invalid token audience.")

    authorized_parties = _get_authorized_parties()
    azp = claims.get("azp")
    if authorized_parties and isinstance(azp, str) and azp not in authorized_parties:
        raise HTTPException(status_code=401, detail="Invalid token authorized party.")

    if claims.get("sts") == "pending":
        raise HTTPException(status_code=403, detail="Auth session is pending organization membership.")


def _get_authorized_parties() -> list[str]:
    configured = (os.getenv("CLERK_AUTHORIZED_PARTIES") or "").strip()
    raw_value = configured or (os.getenv("TANGENT_ALLOWED_ORIGINS") or "")
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _decode_base64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(_pad_base64(value))


def _pad_base64(value: str) -> str:
    return value + "=" * (-len(value) % 4)


def _optional_str(value: Any) -> Optional[str]:
    return value if isinstance(value, str) and value.strip() else None


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() == "true"
    return False


def _get_display_name(claims: dict[str, Any]) -> str:
    for key in ("name", "full_name", "username", "given_name"):
        value = _optional_str(claims.get(key))
        if value:
            return value
    email = _optional_str(claims.get("email"))
    if email:
        return email.split("@")[0]
    return "Tanergy user"
