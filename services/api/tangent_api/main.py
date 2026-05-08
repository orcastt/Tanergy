import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tangent_api.routers import (
    admin,
    admin_ai_analytics,
    admin_directory,
    admin_finance,
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
app.include_router(admin_directory.router)
app.include_router(admin_finance.router)
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
