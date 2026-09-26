<!--
Tareas aprobadas el 2026-09-24 («haz commit»). La propuesta (344c903), las specs (3bf551f) y el diseño (25fb8d2)
están registrados en master.

Aplicar TDD: prueba que falla por la razón esperada, implementación mínima y refactorización.
Backend con `uv run --frozen`; frontend con npm. Por preferencia del usuario se ejecutan solo las
pruebas afectadas y se registra qué se ejecutó y qué no.
-->

## 1. Eliminar el borrador vinculado vacío (D1, D2)

- [x] 1.1 Escribir pruebas que fallan en `backend/tests/sales/test_workshop_links.py`:
  - Retirar la última línea libera la reserva, elimina la venta en `DRAFT` y registra el evento `sales.linked_draft_discarded` con el número de la orden en el motivo.
  - Retirar una de dos líneas conserva la venta.
  - Agregar después crea un borrador nuevo.
- [x] 1.2 Implementar la eliminación en `backend/src/sales/application/workshop_links.py::remove_linked_line` (devuelve si eliminó la venta) y ajustar las pruebas existentes que esperaban la venta vacía.
- [x] 1.3 Escribir pruebas en `backend/tests/workshop/test_parts.py`: retirar el último repuesto por la orden deja la orden sin venta abierta y sin repuestos pendientes; el reintento con la misma clave responde sin error ni efectos adicionales.
- [x] 1.4 Añadir en `backend/tests/workshop/test_integration_concurrency.py` el escenario de retirar la última línea frente a confirmar la venta: nunca se confirma una venta eliminada ni queda reserva huérfana.
- [x] 1.5 Evidencia: `uv run --frozen pytest --no-cov tests/sales/test_workshop_links.py tests/workshop/test_parts.py tests/workshop/test_integration_concurrency.py` en verde.

## 2. Limpieza explícita de borradores vacíos existentes (D3)

- [x] 2.1 Escribir pruebas que fallan en `backend/tests/sales/test_purge_empty_linked_drafts.py`:
  - Por omisión solo informa los borradores vinculados vacíos, sin eliminar.
  - Con confirmación elimina solo esos, con auditoría, y no toca borradores directos vacíos, vinculados con líneas ni confirmados.
  - Una segunda ejecución no tiene efectos.
- [x] 2.2 Implementar `purge_empty_linked_drafts(confirm: bool)` en `workshop_links.py` y el comando `backend/src/sales/management/commands/purge_empty_linked_drafts.py` (`--confirm`).
- [x] 2.3 Evidencia: `uv run --frozen pytest --no-cov tests/sales/test_purge_empty_linked_drafts.py` en verde; ruff y mypy sin errores en `src/sales`.

## 3. Textos del comprobante de servicios (D4)

- [x] 3.1 Cambiar la etiqueta del resumen en `backend/src/workshop/application/economic_summary.py` a «Sin comprobante: todavía no genera deuda.» y actualizar su prueba en `backend/tests/workshop/test_economic_summary.py`.
- [x] 3.2 Actualizar los textos en `frontend/src/features/maintenance/EconomicSummary.tsx`, `BillingDialogs.tsx` y `ServiceLines.tsx` según la tabla D4, con el aviso de comprobante interno en el diálogo.
- [x] 3.3 Actualizar las aserciones en `frontend/src/features/maintenance/billing.test.tsx`, `components.test.tsx` y `frontend/e2e/maintenance-billing.spec.ts`.
- [x] 3.4 Evidencia: `npx vitest run src/features/maintenance src/pages/maintenance`, typecheck, ESLint y prettier sobre los archivos tocados en verde; `npx playwright test e2e/maintenance-billing.spec.ts` en verde.

## 4. Documentación y verificación

- [x] 4.1 Actualizar la nota de UI en `docs/negocio/requisitos/interfaz-y-navegacion.md`, el término «Pendiente de documentar» en `docs/negocio/producto/glosario.md` (renombrado a «Sin comprobante») y `docs/negocio/requisitos/cobertura-integracion-mantenimiento.md` con las pruebas nuevas.
- [x] 4.2 Ejecutar `purge_empty_linked_drafts` en la base de desarrollo, primero sin confirmar y luego con `--confirm`, y después `reconcile_sales` y `reconcile_inventory` sin diferencias.
- [x] 4.3 Evidencia: `openspec validate ajustar-venta-vinculada-vacia-y-textos-de-servicios --strict` válido, `makemigrations --check` sin cambios y `git status` limitado a los archivos del cambio.
