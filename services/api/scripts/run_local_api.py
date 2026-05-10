"""Start the local FastAPI server with repo env files loaded."""

from __future__ import annotations

import os

import uvicorn

from tangent_api.env_bootstrap import load_repo_env


def main() -> None:
    load_repo_env()
    host = os.getenv("TANGENT_LOCAL_API_HOST", "127.0.0.1")
    port = int(os.getenv("TANGENT_LOCAL_API_PORT", "8100"))
    uvicorn.run(
        "tangent_api.main:app",
        host=host,
        port=port,
        reload=True,
    )


if __name__ == "__main__":
    main()
