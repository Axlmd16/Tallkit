.PHONY: install dev down logs check backend-check frontend-check test audit migrate admin compose-check

install:
	cd backend && uv sync --frozen
	cd frontend && npm ci

dev:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f backend frontend

backend-check:
	cd backend && uv run --frozen ruff format --check .
	cd backend && uv run --frozen ruff check .
	cd backend && uv run --frozen mypy src tests
	cd backend && uv run --frozen python manage.py check
	cd backend && uv run --frozen python manage.py makemigrations --check --dry-run
	cd backend && uv run --frozen pytest

frontend-check:
	cd frontend && npm run format:check
	cd frontend && npm run lint
	cd frontend && npm run typecheck
	cd frontend && npm run test:coverage
	cd frontend && npm run build

check: backend-check frontend-check compose-check

test:
	cd backend && uv run --frozen pytest
	cd frontend && npm test

audit:
	cd backend && uv run --frozen pip-audit
	cd frontend && npm audit --audit-level=high

migrate:
	docker compose exec backend python manage.py migrate

admin:
	docker compose exec backend python manage.py createsuperuser

compose-check:
	docker compose config --quiet
