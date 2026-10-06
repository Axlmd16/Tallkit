# Cobertura de proformas comerciales

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `openspec/changes/gestionar-proformas-comerciales`; specs `proformas-comerciales` (nueva) y `ventas-comerciales` (delta) |
| Estado | En aplicación; un escenario solo pasa a «Cumplido» con una prueba ejecutada que lo verifique |
| Fecha | 2026-10-06 |
| Alcance | **Proformas** de productos del **RUC comercial**: borrador, emisión numerada, vigencia, anulación, copia vinculada, impresión y conversión única a venta. Excluye servicios, descuentos, reservas, anticipos, PDF en servidor y facturación electrónica |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | Cumplidos | Parciales | Pendientes |
|---|---|---|---|---|---|
| Proformas comerciales | 10 | 45 | 0 | 0 | 45 |
| Ventas comerciales (delta) | 5 | 31 | 0 | 0 | 31 |
| **Total** | **15** | **76** | **0** | **0** | **76** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el comportamiento del escenario; «Parcial» indica una limitación real descrita en la columna de resultado. La columna «Tarea» remite a `tasks.md` del cambio. Las rutas son relativas a la raíz del repositorio y `archivo::prueba` identifica la prueba exacta.

Los requisitos modificados de ventas incluyen los escenarios ya vigentes de `openspec/specs/ventas-comerciales`; su evidencia previa está en [cobertura de ventas y pagos](cobertura-ventas-pagos.md) y aquí se registran como regresiones preservadas que deben volver a ejecutarse.

## 2. Escenarios

### Proformas comerciales

| ID | Requisito | Escenario | Tarea | Prueba | Resultado |
|---|---|---|---|---|---|
| P-01 | Autorización de proformas por acción | Acciones comerciales autorizadas | 7.4 | — | Pendiente |
| P-02 | Autorización de proformas por acción | Acceso directo sin rol comercial | 7.4 | — | Pendiente |
| P-03 | Autorización de proformas por acción | Roles acumulados sin acceso a costos | 7.4 | — | Pendiente |
| P-04 | Autorización de proformas por acción | Reintento después de perder autorización | 7.4 | — | Pendiente |
| P-05 | Borradores de oferta comercial sin efectos definitivos | Preparar y corregir el borrador | 2.1, 5.1, 5.3 | — | Pendiente |
| P-06 | Borradores de oferta comercial sin efectos definitivos | Emitir una oferta incompleta | 2.1, 5.1, 5.3 | — | Pendiente |
| P-07 | Borradores de oferta comercial sin efectos definitivos | Línea incompatible | 2.1, 5.1, 5.3 | — | Pendiente |
| P-08 | Borradores de oferta comercial sin efectos definitivos | Producto desactivado antes de emitir | 2.1, 5.1, 5.3 | — | Pendiente |
| P-09 | Borradores de oferta comercial sin efectos definitivos | Cotizar un kit | 2.1, 5.1, 5.3 | — | Pendiente |
| P-10 | Borradores de oferta comercial sin efectos definitivos | Intento de cobrar una oferta | 2.1, 5.1, 5.3 | — | Pendiente |
| P-11 | Precios de catálogo y cálculo de la oferta | Precio manual enviado por un Administrador | 2.3, 5.2 | — | Pendiente |
| P-12 | Precios de catálogo y cálculo de la oferta | Desglose inclusivo de la oferta | 2.3, 5.2 | — | Pendiente |
| P-13 | Precios de catálogo y cálculo de la oferta | Redondeo y suma por línea | 2.3, 5.2 | — | Pendiente |
| P-14 | Precios de catálogo y cálculo de la oferta | Cambio posterior a la revisión | 2.3, 5.2 | — | Pendiente |
| P-15 | Precios de catálogo y cálculo de la oferta | Configuración tributaria ausente | 2.3, 5.2 | — | Pendiente |
| P-16 | Vigencia y estados de la oferta | Fecha sugerida y ajuste | 2.2, 5.5 | — | Pendiente |
| P-17 | Vigencia y estados de la oferta | Límite del vencimiento | 2.2, 5.5 | — | Pendiente |
| P-18 | Vigencia y estados de la oferta | Emisión posterior a la fecha elegida | 2.2, 5.5 | — | Pendiente |
| P-19 | Vigencia y estados de la oferta | Anular y conservar historia | 2.2, 5.5 | — | Pendiente |
| P-20 | Vigencia y estados de la oferta | Estado terminal conservado | 2.2, 5.5 | — | Pendiente |
| P-21 | Emisión numerada e historia inmutable | Emisión válida | 3.3, 5.3, 5.4 | — | Pendiente |
| P-22 | Emisión numerada e historia inmutable | Cambio de datos maestros | 3.3, 5.3, 5.4 | — | Pendiente |
| P-23 | Emisión numerada e historia inmutable | Edición de documento emitido | 3.3, 5.3, 5.4 | — | Pendiente |
| P-24 | Emisión numerada e historia inmutable | Falla durante emisión | 3.3, 5.3, 5.4 | — | Pendiente |
| P-25 | Emisión numerada e historia inmutable | Falta serie activa | 3.3, 5.3, 5.4 | — | Pendiente |
| P-26 | Disponibilidad informativa sin reserva | Ofertar por encima de disponibilidad | 5.2, 5.3 | — | Pendiente |
| P-27 | Disponibilidad informativa sin reserva | Stock cambia después de emitir | 5.2, 5.3 | — | Pendiente |
| P-28 | Nueva oferta vinculada con valores actuales | Retomar una vencida con otro precio | 5.1 | — | Pendiente |
| P-29 | Nueva oferta vinculada con valores actuales | Cambiar cantidades de una emitida | 5.1 | — | Pendiente |
| P-30 | Conversión única y atómica a venta | Conversión válida | 6.1, 6.2, 7.1 | — | Pendiente |
| P-31 | Conversión única y atómica a venta | Oferta no convertible | 6.1, 6.2, 7.1 | — | Pendiente |
| P-32 | Conversión única y atómica a venta | Referencia desactivada al convertir | 6.1, 6.2, 7.1 | — | Pendiente |
| P-33 | Conversión única y atómica a venta | Fallo de creación de la venta | 6.1, 6.2, 7.1 | — | Pendiente |
| P-34 | Conversión única y atómica a venta | Conversiones simultáneas | 6.1, 6.2, 7.1 | — | Pendiente |
| P-35 | Conversión única y atómica a venta | Conversión compite con anulación o vencimiento | 6.1, 6.2, 7.1 | — | Pendiente |
| P-36 | Reintentos y ediciones concurrentes de proformas | Respuesta de creación perdida | 5.1, 5.4, 7.1 | — | Pendiente |
| P-37 | Reintentos y ediciones concurrentes de proformas | Reemisión del mismo documento | 5.1, 5.4, 7.1 | — | Pendiente |
| P-38 | Reintentos y ediciones concurrentes de proformas | Identidad de intento incompatible | 5.1, 5.4, 7.1 | — | Pendiente |
| P-39 | Reintentos y ediciones concurrentes de proformas | Guardado obsoleto | 5.1, 5.4, 7.1 | — | Pendiente |
| P-40 | Reintentos y ediciones concurrentes de proformas | Emisiones independientes simultáneas | 5.1, 5.4, 7.1 | — | Pendiente |
| P-41 | Consulta e impresión de cotizaciones | Buscar y navegar | 5.5, 8.2, 9.1…9.4 | — | Pendiente |
| P-42 | Consulta e impresión de cotizaciones | Impresión comercial completa | 5.5, 8.2, 9.1…9.4 | — | Pendiente |
| P-43 | Consulta e impresión de cotizaciones | Emisor sin logo | 5.5, 8.2, 9.1…9.4 | — | Pendiente |
| P-44 | Consulta e impresión de cotizaciones | Imprimir después de anular o vencer | 5.5, 8.2, 9.1…9.4 | — | Pendiente |
| P-45 | Consulta e impresión de cotizaciones | Captura accesible y error recuperable | 5.5, 8.2, 9.1…9.4 | — | Pendiente |

### Ventas comerciales (delta)

| ID | Requisito | Escenario | Tarea | Prueba | Resultado |
|---|---|---|---|---|---|
| V-01 | Origen proforma conservado y venta editable | Cliente acepta una parte | 3.2, 3.3, 6.4, 6.5 | — | Pendiente |
| V-02 | Origen proforma conservado y venta editable | Venta queda sin líneas | 3.2, 3.3, 6.4, 6.5 | — | Pendiente |
| V-03 | Origen proforma conservado y venta editable | Intento de cambiar el origen | 3.2, 3.3, 6.4, 6.5 | — | Pendiente |
| V-04 | Origen proforma conservado y venta editable | Anulación posterior de la venta | 3.2, 3.3, 6.4, 6.5 | — | Pendiente |
| V-05 | Revisión de diferencias entre oferta y venta | Precio distinto al cotizado | 6.3, 6.5 | — | Pendiente |
| V-06 | Revisión de diferencias entre oferta y venta | Cambia la tarifa | 6.3, 6.5 | — | Pendiente |
| V-07 | Revisión de diferencias entre oferta y venta | Conversión sin disponibilidad suficiente | 6.3, 6.5 | — | Pendiente |
| V-08 | Revisión de diferencias entre oferta y venta | Nuevo cambio después de revisar | 6.3, 6.5 | — | Pendiente |
| V-09 | Revisión de diferencias entre oferta y venta | Vence la oferta después de convertir | 6.3, 6.5 | — | Pendiente |
| V-10 | Revisión de diferencias entre oferta y venta | Confirmación y cobro independientes | 6.3, 6.5 | — | Pendiente |
| V-11 | Autorización comercial por acción | Vendedor confirma una venta autorizada | 6.5, 7.4 | — | Pendiente |
| V-12 | Autorización comercial por acción | Encargado sin rol comercial intenta acceder | 6.5, 7.4 | — | Pendiente |
| V-13 | Autorización comercial por acción | Encargado consulta la venta vinculada de una orden | 6.5, 7.4 | — | Pendiente |
| V-14 | Autorización comercial por acción | Roles acumulados y costos restringidos | 6.5, 7.4 | — | Pendiente |
| V-15 | Autorización comercial por acción | Sesión invalidada antes de confirmar | 6.5, 7.4 | — | Pendiente |
| V-16 | Autorización comercial por acción | Acceso a venta de origen proforma | 6.5, 7.4 | — | Pendiente |
| V-17 | Borradores directos sin efectos económicos | Guardar y editar un borrador | 6.4, 6.5 | — | Pendiente |
| V-18 | Borradores directos sin efectos económicos | Borrador vinculado reserva sin descontar | 6.4, 6.5 | — | Pendiente |
| V-19 | Borradores directos sin efectos económicos | Confirmación incompleta o con cantidad inválida | 6.4, 6.5 | — | Pendiente |
| V-20 | Borradores directos sin efectos económicos | Desactivación de producto después de preparar la venta | 6.4, 6.5 | — | Pendiente |
| V-21 | Borradores directos sin efectos económicos | Intento de mezclar servicios o entidad artesanal | 6.4, 6.5 | — | Pendiente |
| V-22 | Borradores directos sin efectos económicos | Venta de un kit completo | 6.4, 6.5 | — | Pendiente |
| V-23 | Borradores directos sin efectos económicos | Editar cantidades sin cambiar la oferta original | 6.4, 6.5 | — | Pendiente |
| V-24 | Consulta comercial y comprobante interno accesibles | Filtrar ventas y abrir detalle | 6.4, 8.5 | — | Pendiente |
| V-25 | Consulta comercial y comprobante interno accesibles | Vendedor encuentra repuestos pendientes de confirmar | 6.4, 8.5 | — | Pendiente |
| V-26 | Consulta comercial y comprobante interno accesibles | Imprimir una venta anulada | 6.4, 8.5 | — | Pendiente |
| V-27 | Consulta comercial y comprobante interno accesibles | Error durante captura accesible | 6.4, 8.5 | — | Pendiente |
| V-28 | Consulta comercial y comprobante interno accesibles | Comprobante con logotipo comercial | 6.4, 8.5 | — | Pendiente |
| V-29 | Consulta comercial y comprobante interno accesibles | Comprobante sin logotipo comercial | 6.4, 8.5 | — | Pendiente |
| V-30 | Consulta comercial y comprobante interno accesibles | Encargado consulta una venta vinculada | 6.4, 8.5 | — | Pendiente |
| V-31 | Consulta comercial y comprobante interno accesibles | Filtrar ventas originadas por proformas | 6.4, 8.5 | — | Pendiente |

## 3. Evidencia por tarea

Se completa durante la aplicación con el comando ejecutado, el resultado en rojo y en verde, y lo que no se ejecutó.

| Tarea | Comando | Resultado |
|---|---|---|
| 1.1 | `git status --short`; `git log --oneline -- openspec/changes/gestionar-proformas-comerciales docs/adr/0012-*` | Propuesta `d166ec7`, specs `d23996e`, diseño y ADR-0012 `732562b` y tareas `310fd19` en `master`; árbol limpio antes de aplicar |
| 1.2 | Generación desde ambas specs con comprobación `total == 76` | 45 escenarios de proformas y 31 de ventas, todos «Pendiente» |
| 1.3 | `cd backend && uv run --frozen pytest --no-cov tests/proformas/test_fixtures.py` | 2 aprobadas; PostgreSQL de pruebas en `127.0.0.1:55432`, base aislada `test_*` |
| 2.1…2.3 | `uv run --frozen pytest --no-cov tests/proformas/test_domain_input.py tests/proformas/test_domain_validity.py tests/proformas/test_domain_amounts.py` | Rojo: `ModuleNotFoundError: proformas.domain`; verde: 71 aprobadas |
| 2.4 | `uv run --frozen pytest --no-cov tests/proformas/test_boundaries.py tests/sales/test_boundaries.py` | Rojo: `No installed app with label 'proformas'`; verde tras registrar la app |
| 3.1 | `uv run --frozen pytest --no-cov tests/proformas/test_models.py` | Rojo: sin `proformas.models`; verde: 12 aprobadas |
| 3.2 | `uv run --frozen pytest --no-cov tests/proformas/test_sale_origin_models.py tests/sales/test_models.py` | Rojo: campos `origin_proforma`/`proforma_snapshot` inexistentes; verde |
| 3.3 | `uv run --frozen pytest --no-cov tests/proformas/test_history_protection.py tests/sales/test_history_protection.py` | Rojo: escrituras directas aceptadas; verde con los triggers `proformas_*_guard` y `sales_proforma_origin_guard` |
| 3.4 | `uv run --frozen pytest --no-cov tests/proformas/test_migrations.py`; `uv run --frozen python manage.py makemigrations --check --dry-run` | 2 aprobadas (avance y reversión sin datos nuevos sobre ventas directa y de mantenimiento); `No changes detected`. No se ejecutó `make migrate` sobre datos del usuario |
| 4.1, 4.2 | `uv run --frozen pytest --no-cov tests/workshop_configuration/test_brand_contract.py tests/workshop_configuration/test_entity_logos.py tests/workshop_configuration/test_entity_logo_api.py` | Rojo: sin `workshop_configuration.application.brand`; verde: 45 aprobadas. Los escritores de logotipo no cambiaron: ya bloquean la fila de la entidad |
| 4.3 | `uv run --frozen pytest --no-cov tests/proformas/test_proforma_links.py` | Rojo: sin `sales.application.proforma_links`; verde: 11 aprobadas |
| 4.4 | `uv run --frozen pytest --no-cov tests/proformas/test_boundaries.py tests/sales/test_boundaries.py`; regresión `tests/workshop_configuration/test_entity_logo_api.py tests/workshop_configuration/test_logo_storage.py tests/inventory -k "reserv or logo"` | 30 de frontera y 49 de regresión aprobadas; no se añadieron DTO a clientes, catálogo, inventario ni numeración |

Referencia terminológica: [cobertura-proformas-glossary-reference.md](cobertura-proformas-glossary-reference.md).
