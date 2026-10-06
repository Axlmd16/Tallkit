## 1. Preparación y línea base focalizada

Dependencias: propuesta, specs y diseño aprobados y registrados en `master`, conforme a `AGENTS.md`.

Por instrucción del usuario se ejecutan solo pruebas focalizadas. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde. No se ejecutan `make check`, `make test`, pytest completo, Vitest completo ni toda la suite de Playwright; el resumen final indica qué se ejecutó y qué no.

- [x] 1.1 Comprobar `git status --short`, la rama vigente y que este cambio esté en `master` sin modificaciones pendientes. Registrar cambios ajenos en las rutas afectadas; no crear ramas ni merges sin autorización.
- [x] 1.2 Tomar un respaldo de la base de desarrollo antes de migrar y anotar su ubicación (diseño, Migration Plan).
- [x] 1.3 Ejecutar y registrar la línea base: `cd backend && uv run --frozen pytest --no-cov tests/test_shared_money.py tests/sales/test_balances.py tests/sales/test_payments.py tests/sales/test_payment_corrections.py tests/sales/test_refunds.py tests/sales/test_void.py tests/sales/test_queries.py tests/workshop/test_artisan_payments.py tests/workshop/test_artisan_receivables.py tests/customer_registry/test_customer_services.py`.
- [x] 1.4 Añadir a `docs/negocio/requisitos/cobertura-ventas-pagos.md` y `cobertura-integracion-mantenimiento.md` una matriz pendiente que relacione cada requirement y escenario de las seis specs delta con los grupos y archivos de prueba de este checklist.

Evidencia del grupo: estado Git, respaldo anotado, comando de línea base con su resultado real y matriz de cobertura pendiente.

Resultado registrado (2026-10-05):
- 1.1: rama `develop`, árbol limpio y las cuatro fases del cambio en `master` (commit `0fc7f91`).
- 1.2: respaldo `pg_dump -Fc` de la base de desarrollo (contenedor `sys-taller-db-1`) en el scratchpad de la sesión, `sys_taller-antes-retenciones.dump` (548 KB); no se versiona.
- 1.3: 153 pruebas pasan en 29 s con el comando de la tarea.
- 1.4: matrices pendientes añadidas a `cobertura-ventas-pagos.md` (17 requisitos) y `cobertura-integracion-mantenimiento.md` (3 requisitos).

## 2. Núcleo monetario y reglas puras del comprobante

Dependencias: grupo 1. Diseño 2, 3 y 5; specs `retenciones-recibidas-en-cobros` («Retención recibida sobre una única operación confirmada», «Cobro acompañado…», «Comprobante de retención completado después») y los requisitos de saldo de ambos ámbitos.

- [x] 2.1 Escribir primero en `backend/tests/test_shared_money.py` casos rojos de `compute_balance` con `withheld`: retención que completa el saldo, solo retención (estado parcial), exceso con retención tras devolución (`excess` limitado al dinero y `withheld_excess` con el resto) y equivalencia exacta con `withheld = 0` frente a los resultados actuales.
- [x] 2.2 Añadir casos rojos de `validate_settlement`: importes no positivos, suma mayor que el saldo, contado cubierto con dinero más retención, contado insuficiente, retención sola en crédito y delegación de `validate_charge`.
- [x] 2.3 Implementar en `backend/src/shared/money.py` el argumento `withheld`, los campos `withheld` y `withheld_excess` de `BalanceResult` y `validate_settlement`; hacer pasar 2.1–2.2 sin modificar las pruebas existentes de saldo.
- [x] 2.4 Escribir primero `backend/tests/test_shared_withholding.py` con casos rojos de `parse_voucher_number` (formato `NNN-NNN-NNNNNNNNN`, rechazo de `1-1-28564`, espacios y letras), `validate_breakdown` (suma igual al importe, importes no negativos, hasta dos decimales, ambos o ninguno) y la regla del umbral de advertencia con `Decimal`.
- [x] 2.5 Implementar `backend/src/shared/withholding.py` como módulo puro, sin Django ni DRF, y hacer pasar 2.4.
- [x] 2.6 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/test_shared_money.py tests/test_shared_withholding.py tests/sales/test_balances.py`, Ruff sobre los archivos tocados y mypy sobre `src/shared`.

Evidencia del grupo: rojo y verde registrados; las pruebas previas de saldo pasan sin cambios.

Resultado registrado (2026-10-05): rojo por `ImportError` (`validate_settlement` y `shared.withholding` no existían); verde con 110 pruebas en `test_shared_money.py`, `test_shared_withholding.py`, `tests/sales/test_balances.py`, `test_payments.py` y `tests/workshop/test_artisan_payments.py`, estas tres últimas sin modificar. Ruff y mypy sin hallazgos en `src/shared`.

## 3. Ajustes por entidad en configuración

Dependencias: grupo 2. Diseño 4 y 6; spec `configuracion-operativa-y-fiscal`, «Ajustes de retenciones recibidas en el perfil tributario».

- [ ] 3.1 Crear la migración aditiva de `workshop_configuration` con `ReceivedWithholdingSetting` (entidad uno a uno, `registration_enabled`, `warning_percentage` con restricción `> 0` y `≤ 100`, `version`, autoría). Añadir prueba de modelo de las restricciones.
- [ ] 3.2 Escribir primero `backend/tests/workshop_configuration/test_withholding_settings.py` con casos rojos: valores por defecto sin fila (activado, 20), cambio en una sola entidad, porcentaje inválido (0, más de 100, tres decimales), advertencia desactivada, denegación a un Vendedor, auditoría del cambio, idempotencia del comando y ausencia de efecto sobre el estado del perfil y sobre `FiscalConfiguration`.
- [ ] 3.3 Implementar el servicio de aplicación (lectura `withholding_settings` para otros módulos y comando administrativo con `entidades_fiscales.editar`) y hacer pasar 3.2.
- [ ] 3.4 Exponer `GET` y `PUT` de los ajustes en `workshop_configuration/api`, con casos de API en `tests/workshop_configuration/test_api.py`.
- [ ] 3.5 Verificar con pytest focalizado de los archivos de este grupo, `uv run --frozen python manage.py makemigrations --check --dry-run`, Ruff y mypy sobre `src/workshop_configuration`.

Evidencia del grupo: pruebas en verde, chequeo de migraciones sin pendientes.

## 4. Marca de agente de retención en el cliente

Dependencias: grupo 1. Diseño 7; spec `gestion-de-clientes`, «Marca opcional de agente de retención».

- [ ] 4.1 Crear la migración aditiva de `customer_registry` con `Customer.is_withholding_agent` en falso; prueba de migración que confirme que los clientes previos quedan sin marca.
- [ ] 4.2 Escribir primero casos rojos en `tests/customer_registry/test_customer_services.py` y `test_customer_api.py`: activar y desactivar con permiso de edición por cada rol, auditoría, valor por defecto y ausencia de efecto sobre operaciones.
- [ ] 4.3 Implementar el campo en servicios, serializador y consultas, y añadirlo a las referencias que `customer_registry` entrega a `sales` y `workshop` (`test_sales_references.py`, `test_workshop_references.py`).
- [ ] 4.4 Verificar con pytest focalizado de `tests/customer_registry`, chequeo de migraciones, Ruff y mypy sobre `src/customer_registry`.

Evidencia del grupo: pruebas en verde; `test_module_boundary.py` sigue pasando.

## 5. Retenciones comerciales: modelo, saldo y cobro

Dependencias: grupos 2, 3 y 4. Diseño 1 a 4; specs `retenciones-recibidas-en-cobros` y `pagos-comerciales-y-credito-simple`.

- [ ] 5.1 Crear la migración aditiva de `sales` con `CommercialWithholding` y `CommercialWithholdingVoucherChange` y sus restricciones (importe positivo, desglose coherente, número y fecha juntos, unicidad parcial del comprobante por cliente entre vigentes). Añadir pruebas en `tests/sales/test_models.py`.
- [ ] 5.2 Escribir primero casos rojos en `tests/sales/test_balances.py` y `test_queries.py`: el `Ledger` suma solo retenciones vigentes; saldo, estado, `withheld` y `withheld_excess` en detalle y resumen.
- [ ] 5.3 Implementar la suma de retenciones vigentes en `sales/application/ledger.py` y su proyección en `reads.py`; hacer pasar 5.2.
- [ ] 5.4 Escribir primero `tests/sales/test_withholdings.py` con casos rojos del cobro: dinero más retención en contado, contado insuficiente, retención sola en crédito, retención mayor que el saldo, precisión excesiva, venta en borrador o anulada, entidad con registro desactivado, advertencia sin y con reconocimiento, advertencia desactivada, fallo que revierte dinero y retención, y revisión previa que incluye la retención.
- [ ] 5.5 Implementar el campo `withholding` en la revisión y el registro de `sales/application/payments.py` (validación con `validate_settlement`, consulta de ajustes, inserción atómica, `digest` con retención) y hacer pasar 5.4.
- [ ] 5.6 Añadir a `tests/sales/test_idempotency.py` y `test_concurrency.py` casos rojos: reintento idéntico, reintento con otro importe retenido, pago y retención simultáneos sobre el mismo saldo; implementar hasta verde.
- [ ] 5.7 Añadir a `tests/sales/test_authorization.py` los casos positivos y negativos por rol (Administrador, Vendedor, Encargado del taller y combinaciones) para registrar con retención.
- [ ] 5.8 Verificar con pytest focalizado de los archivos de `tests/sales` tocados, chequeo de migraciones, Ruff y mypy sobre `src/sales`.

Evidencia del grupo: rojo y verde registrados; `tests/sales/test_payments.py` pasa sin modificarse.

## 6. Retenciones comerciales: comprobante, anulación, seguimiento y correcciones

Dependencias: grupo 5. Diseño 5; specs `retenciones-recibidas-en-cobros` y `correcciones-de-ventas-y-reembolsos`.

- [ ] 6.1 Escribir primero casos rojos en `tests/sales/test_withholdings.py`: completar comprobante válido, desglose que no suma, formato inválido, fecha futura, número repetido para el mismo cliente, completar una retención anulada, corrección posterior solo por Administrador con motivo e historia.
- [ ] 6.2 Implementar `sales/application/withholdings.py` (completar y corregir comprobante) con `execute_write`, permisos `pagos_comerciales.registrar` y `.anular`, e idempotencia; hacer pasar 6.1.
- [ ] 6.3 Escribir primero casos rojos de anulación: motivo vacío, denegación a Vendedor, saldo que reaparece, liberación del número y retención anulada que no se reactiva; implementar hasta verde.
- [ ] 6.4 Escribir primero casos rojos de la lista de pendientes en `tests/sales/test_queries.py`: solo vigentes sin número, solo ámbito comercial, paginación estable, total del conjunto y salida al completarse; implementar la consulta.
- [ ] 6.5 Añadir a `tests/sales/test_refunds.py` y `test_returns.py` casos rojos: devolución total con retención (reembolso limitado al dinero y retención en exceso visible), intento de reembolsar el total y resolución al anular la retención; ajustar proyecciones hasta verde sin cambiar la regla de `refunds.py`.
- [ ] 6.6 Añadir a `tests/sales/test_void.py` el bloqueo de la anulación de una venta con retenciones vigentes e implementarlo en `sales/application/voids.py`.
- [ ] 6.7 Incluir las retenciones en el historial de la venta (`tests/sales/test_history.py`) con vigencia, situación del comprobante y motivo de anulación.
- [ ] 6.8 Exponer las rutas del diseño 8 en `sales/api` con casos en `tests/sales/test_api.py` y `test_authorization.py`.
- [ ] 6.9 Verificar con pytest focalizado de `tests/sales`, Ruff y mypy sobre `src/sales`.

Evidencia del grupo: pruebas en verde con su salida.

## 7. Retenciones artesanales

Dependencias: grupos 2, 3 y 4. Diseño 1 a 5; specs `retenciones-recibidas-en-cobros` y `pagos-artesanales-y-credito-simple`.

- [ ] 7.1 Crear la migración aditiva de `workshop` con `ArtisanWithholding` y `ArtisanWithholdingVoucherChange` y las mismas restricciones; pruebas en `tests/workshop/test_models.py`.
- [ ] 7.2 Escribir primero casos rojos en `tests/workshop/test_artisan_payments.py` y `test_economic_summary.py`: saldo y estado con retención vigente y anulada, cobrado y retenido separados.
- [ ] 7.3 Implementar la suma de retenciones vigentes en el saldo de `workshop/application/service_operations.py` y en las proyecciones; hacer pasar 7.2.
- [ ] 7.4 Escribir primero `tests/workshop/test_artisan_withholdings.py` con los mismos casos de cobro del grupo 5 aplicados a la operación artesanal, más completar, corregir, anular y lista de pendientes; implementar en `workshop/application/artisan_payments.py` y un módulo `artisan_withholdings.py` hasta verde.
- [ ] 7.5 Añadir el bloqueo de la anulación de una operación artesanal con retenciones vigentes y su prueba.
- [ ] 7.6 Añadir a `tests/workshop/test_artisan_receivables.py` que una operación cerrada con retención no figura como deuda y que la retención no se descuenta de la venta vinculada de la misma orden.
- [ ] 7.7 Añadir a `tests/workshop/test_concurrency.py`, `test_authorization.py` y `test_boundaries.py` los casos de concurrencia, permisos por rol y ámbito, y frontera de módulo (sin escrituras en tablas de `sales`).
- [ ] 7.8 Exponer las rutas en `workshop/api/billing_views.py` con casos en `tests/workshop/test_billing_api.py`.
- [ ] 7.9 Verificar con pytest focalizado de `tests/workshop`, chequeo de migraciones, Ruff y mypy sobre `src/workshop`.

Evidencia del grupo: rojo y verde registrados; `test_boundaries.py` en verde.

## 8. Independencia de la preparación fiscal y contrato OpenAPI

Dependencias: grupos 6 y 7. Diseño 8; spec `retenciones-recibidas-en-cobros`, «Independencia de la preparación fiscal».

- [ ] 8.1 Añadir a `tests/sales/test_fiscal_source.py` y `tests/workshop/test_fiscal_source.py` casos que comprueben que una operación con retención sugiere y declara formas de pago por el total, sin una forma «retención», y que registrar una retención no exige preparación fiscal.
- [ ] 8.2 Ajustar, solo si las pruebas lo exigen, la sugerencia de formas de pago para que ignore las retenciones.
- [ ] 8.3 Regenerar `backend/schema.yml` y actualizar `tests/sales/test_openapi.py`, `tests/workshop/test_openapi.py` y el contrato de configuración y clientes.
- [ ] 8.4 Verificar con pytest focalizado de los archivos de este grupo.

Evidencia del grupo: diff del contrato revisado y pruebas en verde.

## 9. Frontend: cobro con retención y detalle

Dependencias: grupo 8. Diseño 9; requisito «Cobro en lenguaje llano».

- [ ] 9.1 Actualizar tipos y clientes de API en `frontend/src/features/sales`, `features/maintenance` (`billingApi`, `billingHooks`), `features/customers` y `features/workshop-configuration`, con sus pruebas de contrato.
- [ ] 9.2 Escribir primero pruebas de `features/sales/PaymentDialog.tsx`: dinero menor que el saldo muestra la pregunta con la diferencia calculada; confirmar, ajustar o dejar como saldo; cliente marcado la muestra desde el inicio; entidad desactivada no la ofrece; advertencia del umbral pide confirmación; ausencia de campos de comprobante. Implementar hasta verde.
- [ ] 9.3 Hacer lo mismo en `features/maintenance/BillingDialogs.tsx` para el cobro artesanal.
- [ ] 9.4 Mostrar «Cobrado», «Retenido» y «Saldo» separados y las retenciones en el historial en `pages/sales/SaleDetailPage.tsx` y en el resumen económico del mantenimiento, con sus pruebas.
- [ ] 9.5 Verificar con Vitest de los archivos tocados, `tsc`, ESLint y Prettier sobre ellos.

Evidencia del grupo: pruebas de Vitest en verde con su salida.

## 10. Frontend: seguimiento, cliente y configuración

Dependencias: grupo 9. Diseño 9; requisitos de seguimiento, marca del cliente y ajustes.

- [ ] 10.1 Crear la vista «Retenciones por completar» por ámbito, enlazada desde cuentas por cobrar, con modal para completar el comprobante, corrección y anulación solo para Administrador, confirmación por toast y estados vacío, carga y error; pruebas incluidas.
- [ ] 10.2 Añadir el interruptor «Agente de retención» a `features/customers/CustomerForm.tsx` con ayuda breve y pruebas.
- [ ] 10.3 Añadir el bloque de retenciones dentro de la subsección «Perfil tributario» de Facturación electrónica (activar o desactivar y porcentaje de advertencia, edición en modal, solo Administrador), sin pestaña nueva; pruebas incluidas.
- [ ] 10.4 Revisar accesibilidad y adaptación a ancho reducido de los diálogos y vistas nuevos con los patrones vigentes.
- [ ] 10.5 Verificar con Vitest de los archivos tocados, `tsc`, ESLint y Prettier.

Evidencia del grupo: pruebas en verde y capturas de las vistas nuevas.

## 11. Recorridos de punta a punta

Dependencias: grupo 10.

- [ ] 11.1 Añadir a `frontend/e2e/sales-payments.spec.ts` un recorrido: marcar un cliente como agente de retención, cobrar una venta con dinero y retención, verla sin deuda y completar el comprobante desde el seguimiento.
- [ ] 11.2 Añadir a `frontend/e2e/maintenance-billing.spec.ts` el recorrido equivalente para una operación artesanal, incluida la anulación de la retención por el Administrador.
- [ ] 11.3 Añadir a `frontend/e2e/workshop-configuration.spec.ts` la desactivación del registro en una entidad y comprobar que su cobro deja de ofrecer la retención.
- [ ] 11.4 Ejecutar solo esas tres especificaciones y registrar el resultado y las limitaciones del entorno.

Evidencia del grupo: recorridos en verde con su salida; no se ejecuta el resto de Playwright.

## 12. Documentación, trazabilidad y cierre

Dependencias: grupos 1 a 11.

- [ ] 12.1 Registrar DP-032 en `docs/negocio/decisiones/decisiones-confirmadas.yaml` con D1…D7 y su referencia de glosario.
- [ ] 12.2 Actualizar `docs/arquitectura/modelo-dominio.md` (§5.3, §10 y diagrama) y `docs/arquitectura/modelo-datos.md` con las tablas nuevas.
- [ ] 12.3 Actualizar `docs/negocio/producto/reglas-negocio.md` (RN-VEN-011 y reglas nuevas), `glosario.md` (retención recibida, comprobante de retención, comprobante pendiente), `requisitos-funcionales.md`, `casos-de-uso.md` (CU-013), `interfaz-y-navegacion.md` y `matriz-trazabilidad.md`, con sus referencias de glosario.
- [ ] 12.4 Completar las matrices de cobertura de 1.4 con los archivos y casos reales de prueba.
- [ ] 12.5 Ejecutar `openspec validate registrar-retenciones-recibidas-en-cobros --strict`, el chequeo de migraciones y la verificación focalizada final de backend y frontend.
- [ ] 12.6 Redactar el resumen de cierre con comandos y resultados reales, indicando expresamente qué no se ejecutó (`make check`, `make test`, suites completas y el resto de Playwright) para que el usuario decida si quiere la verificación completa antes de integrar.

Evidencia del grupo: documentos sincronizados, validación de OpenSpec y resumen con resultados reales.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
