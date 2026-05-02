FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY alembic.ini ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY tangent_api ./tangent_api

RUN python -m pip install --upgrade pip \
  && python -m pip install .

EXPOSE 8000

CMD ["uvicorn", "tangent_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
