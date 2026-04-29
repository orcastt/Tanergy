from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, admin_diagnostics, auth, billing, credits, health, models, proxy, workflows
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="TANGENT API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, settings.ADMIN_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["workflows"])
app.include_router(credits.router, prefix="/api/v1/credits", tags=["credits"])
app.include_router(proxy.router, prefix="/api/v1/proxy", tags=["proxy"])
app.include_router(models.router, prefix="/api/v1/models", tags=["models"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(admin_diagnostics.router, prefix="/api/v1/admin", tags=["admin-diagnostics"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
