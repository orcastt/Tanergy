import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from tangent_api.env_bootstrap import load_repo_env

load_repo_env()

from tangent_api.routers import (
    admin,
    admin_ai_analytics,
    admin_bootstrap,
    admin_directory,
    admin_finance,
    admin_operator,
    ai,
    assets,
    auth,
    billing,
    boards,
    credits,
    image_ops,
    workspaces,
)

app = FastAPI(title="TANGENT API", version="0.1.0")

DEFAULT_HTTP_BODY_LIMIT_BYTES = 10 * 1024 * 1024
ASSET_UPLOAD_BODY_LIMIT_BYTES = 110 * 1024 * 1024
ASSET_DATA_URL_BODY_LIMIT_BYTES = 140 * 1024 * 1024
BOARD_DOCUMENT_BODY_LIMIT_BYTES = 3 * 1024 * 1024
BILLING_WEBHOOK_BODY_LIMIT_BYTES = 512 * 1024


@app.middleware("http")
async def reject_oversized_http_bodies(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            byte_length = int(content_length)
        except ValueError:
            return JSONResponse({"detail": "Invalid Content-Length header."}, status_code=400)
        max_bytes = _body_limit_for_path(request.url.path)
        if byte_length > max_bytes:
            return JSONResponse({"detail": "Request body is too large."}, status_code=413)
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "TANGENT_ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100",
        ).split(",")
        if origin.strip()
    ],
)

app.include_router(ai.router)
app.include_router(admin.router)
app.include_router(admin_ai_analytics.router)
app.include_router(admin_bootstrap.router)
app.include_router(admin_directory.router)
app.include_router(admin_finance.router)
app.include_router(admin_operator.router)
app.include_router(assets.router)
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(boards.router)
app.include_router(credits.router)
app.include_router(image_ops.router)
app.include_router(workspaces.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _body_limit_for_path(path: str) -> int:
    if path == "/api/v1/assets/upload":
        return ASSET_UPLOAD_BODY_LIMIT_BYTES
    if path == "/api/v1/assets/from-data-url":
        return ASSET_DATA_URL_BODY_LIMIT_BYTES
    if path.startswith("/api/v1/boards"):
        return BOARD_DOCUMENT_BODY_LIMIT_BYTES
    if path.startswith("/api/v1/billing/webhooks/"):
        return BILLING_WEBHOOK_BODY_LIMIT_BYTES
    return DEFAULT_HTTP_BODY_LIMIT_BYTES
