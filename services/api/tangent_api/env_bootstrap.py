from __future__ import annotations

import os
from pathlib import Path


def load_repo_env() -> None:
    if os.getenv("TANGENT_SKIP_ENV_FILE_LOAD") == "1":
        return

    protected_keys = set(os.environ)
    for path in _env_candidate_paths(Path(__file__).resolve()):
        _load_env_file(path, protected_keys)


def _env_candidate_paths(module_path: Path) -> tuple[Path, ...]:
    repo_root = _find_repo_root(module_path)
    service_root = _find_service_root(module_path)
    candidates: list[Path] = []

    if repo_root is not None:
        candidates.extend(
            (
                repo_root / ".env",
                repo_root / ".env.local",
            )
        )
    if service_root is not None:
        candidates.extend(
            (
                service_root / ".env",
                service_root / ".env.local",
            )
        )
    return tuple(candidates)


def _find_repo_root(module_path: Path) -> Path | None:
    for parent in module_path.parents:
        if (parent / ".git").exists():
            return parent
        if (parent / "ARCH").is_dir() and (parent / "PRD").is_dir():
            return parent
    return None


def _find_service_root(module_path: Path) -> Path | None:
    for parent in module_path.parents:
        if (parent / "alembic.ini").is_file() and (parent / "tangent_api").is_dir():
            return parent
    return None


def _load_env_file(path: Path, protected_keys: set[str]) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        parsed = _parse_env_line(line)
        if parsed is None:
            continue
        key, value = parsed
        if key in protected_keys:
            continue
        os.environ[key] = value


def _parse_env_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None
    if stripped.startswith("export "):
        stripped = stripped[7:].lstrip()
    if "=" not in stripped:
        return None

    key, value = stripped.split("=", 1)
    key = key.strip()
    if not key:
        return None

    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    return key, value
