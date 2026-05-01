from fastapi import FastAPI

from tangent_api.routers import assets, boards

app = FastAPI(title="TANGENT API", version="0.1.0")

app.include_router(assets.router)
app.include_router(boards.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
