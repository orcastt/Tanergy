import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tangent_api.routers import assets, boards

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

app.include_router(assets.router)
app.include_router(boards.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
