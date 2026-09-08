# syntax=docker/dockerfile:1.7
FROM python:3.13.14-slim-bookworm AS base
COPY --from=ghcr.io/astral-sh/uv:0.11.23 /uv /uvx /bin/
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./

FROM base AS development
RUN uv sync --frozen
COPY backend/ ./
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM base AS production
RUN uv sync --frozen --no-dev
COPY backend/ ./
RUN python manage.py collectstatic --noinput --settings=config.settings.base
RUN addgroup --system app && adduser --system --ingroup app app \
    && chown -R app:app /app
USER app
EXPOSE 8000
CMD ["gunicorn", "--chdir", "src", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4", "--access-logfile", "-", "config.wsgi:application"]
