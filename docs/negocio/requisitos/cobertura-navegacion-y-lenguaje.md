# Cobertura de navegación y lenguaje

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `openspec/changes/reorganizar-navegacion-y-lenguaje` (U4); specs nuevas `navegacion-de-uso-diario` y `lenguaje-visible-de-uso-diario`, y deltas de ocho specs existentes |
| Estado | Aplicado y verificado (unitarias, integración, E2E y `make check`) |
| Alcance | Menú de nueve entradas, nombres de negocio, términos y formatos, ficha del cliente, existencia en productos, contadores de mantenimientos, lista local de facturas y listas del inicio |

Una fila por requisito. Las rutas de backend son relativas a `backend/` y las de frontend a `frontend/src/`.

| Spec | Requisito | Prueba |
|---|---|---|
| `navegacion-de-uso-diario` | Menú de nueve entradas sin grupos plegables | `app/navigation.test.ts`; `app/AuthenticatedShell.test.tsx` |
| `navegacion-de-uso-diario` | Contenido de cada entrada | `app/navigation.test.ts` (cobertura de rutas); `app/AuthenticatedShell.test.tsx` (pestañas y «Cuentas» por negocio); `pages/settings/SettingsPage.test.tsx` |
| `navegacion-de-uso-diario` | Facturas antes de la emisión real | `tests/workshop/test_fiscal_listing.py`; `pages/invoices/InvoicesPage.test.tsx` |
| `lenguaje-visible-de-uso-diario` | Negocio identificado por su nombre | `shared/api/entity-logos.test.tsx`; `shared/ui/states.test.tsx`; `shared/ui/data/StatLink.test.tsx` |
| `lenguaje-visible-de-uso-diario` | Términos simples en pantalla | Sin texto fijado por prueba (regla de `AGENTS.md`); revisión por búsqueda en el código |
| `lenguaje-visible-de-uso-diario` | Importes y porcentajes legibles | `shared/ui/business/business.test.tsx`; `shared/ui/business/formatRate.test.ts` |
| `lenguaje-visible-de-uso-diario` | Acciones que dicen lo que hacen | `features/maintenance/billing.test.tsx`; `pages/customers/CustomerDetailPage.test.tsx` |
| `lenguaje-visible-de-uso-diario` | Avisos que no tapan el total | Sin prueba nueva (maquetación): `shared/ui/feedback/Toast.tsx` anclado bajo la barra superior |
| `experiencia-adaptable-frontend` | Menú y pestañas adaptables | `app/AuthenticatedShell.test.tsx` (tableta y teléfono) |
| `objetivos-de-uso-diario` | Objetivos de la usuaria diaria | `app/AuthenticatedShell.test.tsx`; `pages/home/HomePage.test.tsx` |
| `gestion-de-clientes` | Ficha con vehículos, compras y deuda por negocio | `pages/customers/CustomerDetailPage.test.tsx` |
| `catalogo-de-productos-y-categorias` | Existencia real de solo lectura | `tests/inventory/test_api.py` (`TestQuantities`); `pages/products/ProductsPage.test.tsx`; `tests/catalog/test_boundaries.py` |
| `ordenes-de-mantenimiento` | Segmentos con contador del servidor | `tests/workshop/test_home_summary.py`; `tests/workshop/test_api.py`; `pages/maintenance/MaintenanceOrdersPage.test.tsx` |
| `configuracion-operativa-y-fiscal` | Nombre comercial pedido, opcional | `features/workshop-configuration/__tests__/queries.test.tsx` |
| `pagina-de-inicio` | «En el taller» y «Falta cobrar» | `pages/home/HomePage.test.tsx` |
| `preparacion-y-seguimiento-fiscal` | Lista local de preparaciones | `tests/workshop/test_fiscal_listing.py`; `tests/fiscal/test_boundaries.py` |

## Brechas y notas

- **Sin «Canceladas».** El estado «cancelado» de un mantenimiento no existe en el código; los segmentos son Todas, Abiertas y Finalizadas.
- **Sin emisión real.** «Facturas» muestra solo preparaciones locales; ninguna se presenta como enviada, autorizada o emitida (`DP-034`, regla 8).
- **Nombre comercial en la configuración inicial.** La inicialización no recibe el nombre: se guarda justo después con la edición de entidad existente; si falla, se completa en «Ajustes».
- **Valor inicial «Crédito» de una venta nueva.** Queda para un arreglo pequeño aparte (decisión 4 de la propuesta).
- **E2E.** Se añadió y ejecutó `frontend/e2e/navigation-language.spec.ts` (menú adaptable a 360, 768, 1024 y 1440 px con área táctil >= 44 px, teclado y accesibilidad; recorrido menú → ficha del cliente → cuentas). Las pruebas E2E heredadas (`e2e/responsive.spec.ts`, `catalogs-quality.spec.ts`, `catalogs.spec.ts`, `home.spec.ts`, `maintenance-billing.spec.ts`, `proformas.spec.ts`) todavía mencionan los grupos del menú anterior y «RUC comercial» / «RUC artesanal»; quedan pendientes de actualizar cuando se ejecute la suite E2E completa.
- **Revisión visual.** El menú de nueve entradas, su altura táctil mínima (`>= 44 px`), el foco por teclado, la ausencia de desplazamiento horizontal y la accesibilidad a 360, 768, 1024 y 1440 px se verificaron en navegador real con `frontend/e2e/navigation-language.spec.ts`.
