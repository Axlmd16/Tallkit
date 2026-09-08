# ADR-0002: Gestión de versiones y dependencias

- Estado: Aceptada
- Fecha: 2026-09-08

## Contexto

El proyecto requiere instalaciones reproducibles, componentes estables y dependencias con un uso
actual. Python y JavaScript tienen gestores distintos y el entorno del desarrollador no siempre
coincide con la versión objetivo.

## Decisión

Usar `uv` 0.11.23, `pyproject.toml`, grupo `dev`, `.python-version` y `uv.lock` para Python. Usar npm,
`package.json`, `.node-version` y `package-lock.json` para frontend. Los manifiestos Python permiten
parches compatibles dentro de una línea menor; el lockfile fija el grafo exacto. Las dependencias
JavaScript directas se fijan exactamente y el lockfile fija las transitivas. CI y Docker instalan con
`uv sync --frozen` y `npm ci`.

La línea base es Python 3.13.14, Django 5.2.17 LTS, Node.js 24.20.0 LTS, React 19.2.8,
TypeScript 6.0.3, Vite 8.2.2, Tailwind CSS 4.3.3 y PostgreSQL 17.11. Python 3.13.15 se descartó
porque el catálogo reproducible de `uv` 0.11.23 ofrecía 3.13.14 como último parche instalable.

Versiones directas resueltas el 2026-09-08:

| Área | Versiones exactas |
|---|---|
| Runtime backend | Django 5.2.17, DRF 3.18.1, django-environ 0.14.0, drf-spectacular 0.30.0, psycopg 3.3.5, structlog 26.1.0, WhiteNoise 6.12.0, Gunicorn 26.2.0 |
| Calidad backend | Ruff 0.16.6, mypy 1.20.2, django-stubs 5.2.9, djangorestframework-stubs 3.16.9, pytest 9.1.1, pytest-django 4.14.0, pytest-cov 7.1.0, pip-audit 2.10.1, pre-commit 4.6.2 |
| Runtime frontend | React 19.2.8, React DOM 19.2.8, React Router 7.18.3, TanStack Query 5.102.8 |
| Build y estilos | Node.js 24.20.0 LTS, npm 11.19.0, TypeScript 6.0.3, Vite 8.2.2, plugin React 6.1.1, Tailwind CSS/plugin Vite 4.3.3 |
| Calidad frontend | ESLint 10.0.1, typescript-eslint 8.70.0, Prettier 3.6.2, Vitest/coverage 4.1.1, Testing Library React 16.3.3, Playwright 1.63.0, happy-dom 20.14.0 |
| Infraestructura | PostgreSQL 17.11, Nginx 1.30.4 estable, Docker Engine 29.7.2 |

npm se eligió frente a pnpm porque viene con Node LTS y reduce requisitos del entorno en este
monorepositorio pequeño. Dependabot propone actualizaciones; una subida mayor requiere validación.

## Alternativas consideradas

- `pip` y requirements: separan metadatos, grupos y resolución en varios archivos.
- Poetry: añade otro gestor sin ventaja sobre `uv` para el alcance actual.
- pnpm: es eficiente, pero exige una herramienta adicional y su workspace no aporta valor ahora.
- Rangos abiertos o `latest`: reducen reproducibilidad y pueden introducir cambios incompatibles.

## Consecuencias

Las instalaciones nuevas producen el mismo grafo y las actualizaciones son deliberadas. Los dos
lockfiles deben actualizarse junto con sus manifiestos. Las alertas y auditorías no sustituyen la
revisión de compatibilidad ni las pruebas.

## Referencias

- `backend/pyproject.toml` y `backend/uv.lock`
- `frontend/package.json` y `frontend/package-lock.json`
- [Referencia terminológica](0002-gestion-de-versiones-y-dependencias-glossary-reference.md)
