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

- [x] 3.1 Crear la migración aditiva de `workshop_configuration` con `ReceivedWithholdingSetting` (entidad uno a uno, `registration_enabled`, `warning_percentage` con restricción `> 0` y `≤ 100`, `version`, autoría). Añadir prueba de modelo de las restricciones.
- [x] 3.2 Escribir primero `backend/tests/workshop_configuration/test_withholding_settings.py` con casos rojos: valores por defecto sin fila (activado, 20), cambio en una sola entidad, porcentaje inválido (0, más de 100, tres decimales), advertencia desactivada, denegación a un Vendedor, auditoría del cambio, idempotencia del comando y ausencia de efecto sobre el estado del perfil y sobre `FiscalConfiguration`.
- [x] 3.3 Implementar el servicio de aplicación (lectura `withholding_settings` para otros módulos y comando administrativo con `entidades_fiscales.editar`) y hacer pasar 3.2.
- [x] 3.4 Exponer `GET` y `PUT` de los ajustes en `workshop_configuration/api`, con casos de API en `tests/workshop_configuration/test_api.py`.
- [x] 3.5 Verificar con pytest focalizado de los archivos de este grupo, `uv run --frozen python manage.py makemigrations --check --dry-run`, Ruff y mypy sobre `src/workshop_configuration`.

Evidencia del grupo: pruebas en verde, chequeo de migraciones sin pendientes.

Resultado registrado (2026-10-05): rojo por `ImportError` (el servicio y el modelo no existían); verde con 21 pruebas en `test_withholding_settings.py` y 24 en `tests/fiscal/test_configuration_api.py`; `makemigrations --check` sin cambios; Ruff y mypy sin hallazgos. Ajustes respecto del diseño: el permiso es `parametros.gestionar`, el mismo de los demás ajustes fiscales por entidad (solo Administrador), y las rutas `GET`/`PUT` viven en `fiscal/api` (`configuration/entities/{id}/withholding-settings/`), junto a las del perfil tributario, por lo que su prueba de API está en `tests/fiscal/test_configuration_api.py`. La auditoría registra `changed_fields`, porque el registro de auditoría solo admite claves seguras.

## 4. Marca de agente de retención en el cliente

Dependencias: grupo 1. Diseño 7; spec `gestion-de-clientes`, «Marca opcional de agente de retención».

- [x] 4.1 Crear la migración aditiva de `customer_registry` con `Customer.is_withholding_agent` en falso; prueba de migración que confirme que los clientes previos quedan sin marca.
- [x] 4.2 Escribir primero casos rojos en `tests/customer_registry/test_customer_services.py` y `test_customer_api.py`: activar y desactivar con permiso de edición por cada rol, auditoría, valor por defecto y ausencia de efecto sobre operaciones.
- [x] 4.3 Implementar el campo en servicios, serializador y consultas, y añadirlo a las referencias que `customer_registry` entrega a `sales` y `workshop` (`test_sales_references.py`, `test_workshop_references.py`).
- [x] 4.4 Verificar con pytest focalizado de `tests/customer_registry`, chequeo de migraciones, Ruff y mypy sobre `src/customer_registry`.

Evidencia del grupo: pruebas en verde; `test_module_boundary.py` sigue pasando.

Resultado registrado (2026-10-05): rojo por `ImportError` y por el campo inexistente; verde con 175 pruebas en `tests/customer_registry`, incluida la de migración. Las pruebas nuevas están en `tests/customer_registry/test_customer_withholding_flag.py` (servicios, API, referencias y migración en un solo archivo). `sales_references.CustomerReference` añade la marca y `workshop_references.customer_withholding_flags` la entrega al taller. Ruff y mypy sin hallazgos; `makemigrations --check` sin cambios.

## 5. Retenciones comerciales: modelo, saldo y cobro

Dependencias: grupos 2, 3 y 4. Diseño 1 a 4; specs `retenciones-recibidas-en-cobros` y `pagos-comerciales-y-credito-simple`.

- [x] 5.1 Crear la migración aditiva de `sales` con `CommercialWithholding` y `CommercialWithholdingVoucherChange` y sus restricciones (importe positivo, desglose coherente, número y fecha juntos, unicidad parcial del comprobante por cliente entre vigentes). Añadir pruebas en `tests/sales/test_models.py`.
- [x] 5.2 Escribir primero casos rojos en `tests/sales/test_balances.py` y `test_queries.py`: el `Ledger` suma solo retenciones vigentes; saldo, estado, `withheld` y `withheld_excess` en detalle y resumen.
- [x] 5.3 Implementar la suma de retenciones vigentes en `sales/application/ledger.py` y su proyección en `reads.py`; hacer pasar 5.2.
- [x] 5.4 Escribir primero `tests/sales/test_withholdings.py` con casos rojos del cobro: dinero más retención en contado, contado insuficiente, retención sola en crédito, retención mayor que el saldo, precisión excesiva, venta en borrador o anulada, entidad con registro desactivado, advertencia sin y con reconocimiento, advertencia desactivada, fallo que revierte dinero y retención, y revisión previa que incluye la retención.
- [x] 5.5 Implementar el campo `withholding` en la revisión y el registro de `sales/application/payments.py` (validación con `validate_settlement`, consulta de ajustes, inserción atómica, `digest` con retención) y hacer pasar 5.4.
- [x] 5.6 Añadir a `tests/sales/test_idempotency.py` y `test_concurrency.py` casos rojos: reintento idéntico, reintento con otro importe retenido, pago y retención simultáneos sobre el mismo saldo; implementar hasta verde.
- [x] 5.7 Añadir a `tests/sales/test_authorization.py` los casos positivos y negativos por rol (Administrador, Vendedor, Encargado del taller y combinaciones) para registrar con retención.
- [x] 5.8 Verificar con pytest focalizado de los archivos de `tests/sales` tocados, chequeo de migraciones, Ruff y mypy sobre `src/sales`.

Evidencia del grupo: rojo y verde registrados; `tests/sales/test_payments.py` pasa sin modificarse.

Resultado registrado (2026-10-05): rojo por `ImportError` y por campos inexistentes; verde con 573 pruebas en `tests/sales` (28 nuevas de retenciones y una de concurrencia), `test_payments.py` sin modificar. Ruff, mypy y `makemigrations --check` sin hallazgos. Ajustes respecto del diseño y de las tareas:
- La unicidad del comprobante usa la FK `customer` de la retención en lugar de copiar la identificación; es exacta y no depende de cambios posteriores en la ficha.
- Las pruebas de modelo, saldo, listados, idempotencia y permisos de este grupo están reunidas en `tests/sales/test_withholdings.py`; la de concurrencia está en `test_concurrency.py`.
- La restricción del desglose exige además que renta e IVA no sean nulos, porque en SQL una comparación con nulo no rechaza la fila.
- Ventas lee los ajustes mediante `operation_context.received_withholding_settings`, la interfaz ya publicada de configuración, para respetar la frontera de módulos.
- Al sustituir un pago, el saldo disponible descuenta también las retenciones vigentes.
- Código de error nuevo `withholding_warning` (HTTP 409) para la advertencia reconocible; la revisión previa devuelve además `warning` con porcentaje y umbral.
- La retención registrada sin dinero devuelve un resultado de tipo `withholding`; con dinero, el pago incluye `withholding`.

## 6. Retenciones comerciales: comprobante, anulación, seguimiento y correcciones

Dependencias: grupo 5. Diseño 5; specs `retenciones-recibidas-en-cobros` y `correcciones-de-ventas-y-reembolsos`.

- [x] 6.1 Escribir primero casos rojos en `tests/sales/test_withholdings.py`: completar comprobante válido, desglose que no suma, formato inválido, fecha futura, número repetido para el mismo cliente, completar una retención anulada, corrección posterior solo por Administrador con motivo e historia.
- [x] 6.2 Implementar `sales/application/withholdings.py` (completar y corregir comprobante) con `execute_write`, permisos `pagos_comerciales.registrar` y `.anular`, e idempotencia; hacer pasar 6.1.
- [x] 6.3 Escribir primero casos rojos de anulación: motivo vacío, denegación a Vendedor, saldo que reaparece, liberación del número y retención anulada que no se reactiva; implementar hasta verde.
- [x] 6.4 Escribir primero casos rojos de la lista de pendientes en `tests/sales/test_queries.py`: solo vigentes sin número, solo ámbito comercial, paginación estable, total del conjunto y salida al completarse; implementar la consulta.
- [x] 6.5 Añadir a `tests/sales/test_refunds.py` y `test_returns.py` casos rojos: devolución total con retención (reembolso limitado al dinero y retención en exceso visible), intento de reembolsar el total y resolución al anular la retención; ajustar proyecciones hasta verde sin cambiar la regla de `refunds.py`.
- [x] 6.6 Añadir a `tests/sales/test_void.py` el bloqueo de la anulación de una venta con retenciones vigentes e implementarlo en `sales/application/voids.py`.
- [x] 6.7 Incluir las retenciones en el historial de la venta (`tests/sales/test_history.py`) con vigencia, situación del comprobante y motivo de anulación.
- [x] 6.8 Exponer las rutas del diseño 8 en `sales/api` con casos en `tests/sales/test_api.py` y `test_authorization.py`.
- [x] 6.9 Verificar con pytest focalizado de `tests/sales`, Ruff y mypy sobre `src/sales`.

Evidencia del grupo: pruebas en verde con su salida.

Resultado registrado (2026-10-05): 593 pruebas en verde en `tests/sales` (17 nuevas en `test_withholding_followup.py` y 3 de API en `test_api.py`); Ruff y mypy sin hallazgos en `src/sales`. Notas:
- En este grupo el servicio `sales/application/withholdings.py` se escribió antes que sus pruebas, por lo que no hubo fase roja registrada; las pruebas cubren después cada escenario de las specs.
- Las pruebas de comprobante, anulación, lista de pendientes, historial, devolución con retención y bloqueo de la anulación de la venta están reunidas en `tests/sales/test_withholding_followup.py`.
- `refunds.py` no cambió: el exceso reembolsable ya sale limitado del núcleo monetario. `voids.py` rechaza con `dependency_conflict` y nombra cada retención vigente.
- Rutas nuevas: `GET sales/withholdings/pending/`, `GET sales/{id}/withholdings/` y `POST …/withholdings/{wid}/voucher/`, `…/voucher-correction/` y `…/void/`. La consulta de estado de operación devuelve `withholding` cuando la acción no incluyó dinero.
- La corrección de un comprobante exige `operation_id` propio; completar y anular se apoyan en la clave de idempotencia del comando.

## 7. Retenciones artesanales

Dependencias: grupos 2, 3 y 4. Diseño 1 a 5; specs `retenciones-recibidas-en-cobros` y `pagos-artesanales-y-credito-simple`.

- [x] 7.1 Crear la migración aditiva de `workshop` con `ArtisanWithholding` y `ArtisanWithholdingVoucherChange` y las mismas restricciones; pruebas en `tests/workshop/test_models.py`.
- [x] 7.2 Escribir primero casos rojos en `tests/workshop/test_artisan_payments.py` y `test_economic_summary.py`: saldo y estado con retención vigente y anulada, cobrado y retenido separados.
- [x] 7.3 Implementar la suma de retenciones vigentes en el saldo de `workshop/application/service_operations.py` y en las proyecciones; hacer pasar 7.2.
- [x] 7.4 Escribir primero `tests/workshop/test_artisan_withholdings.py` con los mismos casos de cobro del grupo 5 aplicados a la operación artesanal, más completar, corregir, anular y lista de pendientes; implementar en `workshop/application/artisan_payments.py` y un módulo `artisan_withholdings.py` hasta verde.
- [x] 7.5 Añadir el bloqueo de la anulación de una operación artesanal con retenciones vigentes y su prueba.
- [x] 7.6 Añadir a `tests/workshop/test_artisan_receivables.py` que una operación cerrada con retención no figura como deuda y que la retención no se descuenta de la venta vinculada de la misma orden.
- [x] 7.7 Añadir a `tests/workshop/test_concurrency.py`, `test_authorization.py` y `test_boundaries.py` los casos de concurrencia, permisos por rol y ámbito, y frontera de módulo (sin escrituras en tablas de `sales`).
- [x] 7.8 Exponer las rutas en `workshop/api/billing_views.py` con casos en `tests/workshop/test_billing_api.py`.
- [x] 7.9 Verificar con pytest focalizado de `tests/workshop`, chequeo de migraciones, Ruff y mypy sobre `src/workshop`.

Evidencia del grupo: rojo y verde registrados; `test_boundaries.py` en verde.

Resultado registrado (2026-10-05): 327 pruebas en verde en `tests/workshop` (28 nuevas en `test_artisan_withholdings.py`, una de API, una de concurrencia y una de resumen económico); Ruff, mypy y `makemigrations --check` sin hallazgos. Notas:
- Como en el grupo 6, el código se escribió antes que sus pruebas y no hubo fase roja registrada, salvo los fallos por la frontera de módulos y por un contrato exacto de totales.
- Las pruebas de modelo, saldo, cobro, comprobante, anulación, seguimiento, cuentas por cobrar y permisos están reunidas en `tests/workshop/test_artisan_withholdings.py`; la de concurrencia, en `test_integration_concurrency.py`; la de la orden con venta vinculada, en `test_economic_summary.py`.
- `tests/workshop/test_boundaries.py` admite el módulo puro `shared.withholding`, igual que `shared.money`. El taller lee los ajustes por `workshop_references.artisan_withholding_settings`.
- Contrato ampliado: la operación artesanal y sus cuentas por cobrar añaden `withheld`; `paid` sigue siendo solo dinero. `tests/workshop/test_artisan_receivables.py` se actualizó porque comparaba el diccionario de totales exacto.
- Los comandos de retención devuelven el detalle de la operación con su lista `withholdings`, igual que los cobros artesanales.
- Código de error nuevo `withholdings_block_void` (HTTP 409) al anular una operación con retenciones vigentes.
- Se adelantó de 8.3 la actualización de rutas esperadas en `tests/workshop/test_openapi.py`, `tests/sales/test_openapi.py` y `tests/fiscal/test_openapi.py`.

## 8. Independencia de la preparación fiscal y contrato OpenAPI

Dependencias: grupos 6 y 7. Diseño 8; spec `retenciones-recibidas-en-cobros`, «Independencia de la preparación fiscal».

- [x] 8.1 Añadir a `tests/sales/test_fiscal_source.py` y `tests/workshop/test_fiscal_source.py` casos que comprueben que una operación con retención sugiere y declara formas de pago por el total, sin una forma «retención», y que registrar una retención no exige preparación fiscal.
- [x] 8.2 Ajustar, solo si las pruebas lo exigen, la sugerencia de formas de pago para que ignore las retenciones.
- [x] 8.3 Regenerar `backend/schema.yml` y actualizar `tests/sales/test_openapi.py`, `tests/workshop/test_openapi.py` y el contrato de configuración y clientes.
- [x] 8.4 Verificar con pytest focalizado de los archivos de este grupo.

Evidencia del grupo: diff del contrato revisado y pruebas en verde.

Resultado registrado (2026-10-05): 195 pruebas en verde en los archivos del grupo y en `tests/customer_registry`. Notas:
- 8.2 no requirió cambios: la sugerencia de formas de pago solo lee partes de pago por medio, así que una retención nunca aparece; lo que el dinero no cubre se asigna a la forma predeterminada y la suma iguala el total del comprobante.
- `backend/schema.yml` regenerado con `manage.py spectacular --validate`, sin advertencias: rutas nuevas de retenciones en ventas y taller, ajustes por entidad, `withholding` en el cobro y `is_withholding_agent` en clientes.

## 9. Frontend: cobro con retención y detalle

Dependencias: grupo 8. Diseño 9; requisito «Cobro en lenguaje llano».

- [x] 9.1 Actualizar tipos y clientes de API en `frontend/src/features/sales`, `features/maintenance` (`billingApi`, `billingHooks`), `features/customers` y `features/workshop-configuration`, con sus pruebas de contrato.
- [x] 9.2 Escribir primero pruebas de `features/sales/PaymentDialog.tsx`: dinero menor que el saldo muestra la pregunta con la diferencia calculada; confirmar, ajustar o dejar como saldo; cliente marcado la muestra desde el inicio; entidad desactivada no la ofrece; advertencia del umbral pide confirmación; ausencia de campos de comprobante. Implementar hasta verde.
- [x] 9.3 Hacer lo mismo en `features/maintenance/BillingDialogs.tsx` para el cobro artesanal.
- [x] 9.4 Mostrar «Cobrado», «Retenido» y «Saldo» separados y las retenciones en el historial en `pages/sales/SaleDetailPage.tsx` y en el resumen económico del mantenimiento, con sus pruebas.
- [x] 9.5 Verificar con Vitest de los archivos tocados, `tsc`, ESLint y Prettier sobre ellos.

Evidencia del grupo: pruebas de Vitest en verde con su salida.

Resultado registrado (2026-10-05): `tsc`, ESLint y Prettier sin hallazgos en lo tocado; Vitest en verde en las áreas afectadas (ventas, mantenimiento, clientes, fiscal, páginas y rutas). Notas:
- El backend añadió `withholding_context` (entidad que registra retenciones y marca vigente del cliente) al detalle de la venta y al resumen de la operación artesanal, y `withholdings` al detalle de la venta, porque quien cobra no puede leer la configuración administrativa.
- La pregunta del cobro vive en `features/sales/WithholdingQuestion.tsx` y la usan los dos diálogos; propone la diferencia ya calculada y nunca pide datos del comprobante.
- En el taller el cobro no tiene revisión previa: la advertencia llega como rechazo `withholding_warning` y el diálogo muestra la confirmación.
- Pruebas nuevas: `WithholdingQuestion.test.tsx`, casos en `features/sales/api.test.ts`, `features/maintenance/billing.test.tsx`, `pages/sales/SaleDetailPage.test.tsx` y `pages/maintenance/billingPages.test.tsx`.
- Se actualizaron los mocks de `SaleDetailPage.test.tsx`, `ProfileConditionsSection.test.tsx` y `FiscalConfigurationSection.test.tsx` para incluir los hooks nuevos.

## 10. Frontend: seguimiento, cliente y configuración

Dependencias: grupo 9. Diseño 9; requisitos de seguimiento, marca del cliente y ajustes.

- [x] 10.1 Crear la vista «Retenciones por completar» por ámbito, enlazada desde cuentas por cobrar, con modal para completar el comprobante, corrección y anulación solo para Administrador, confirmación por toast y estados vacío, carga y error; pruebas incluidas.
- [x] 10.2 Añadir el interruptor «Agente de retención» a `features/customers/CustomerForm.tsx` con ayuda breve y pruebas.
- [x] 10.3 Añadir el bloque de retenciones dentro de la subsección «Perfil tributario» de Facturación electrónica (activar o desactivar y porcentaje de advertencia, edición en modal, solo Administrador), sin pestaña nueva; pruebas incluidas.
- [x] 10.4 Revisar accesibilidad y adaptación a ancho reducido de los diálogos y vistas nuevos con los patrones vigentes.
- [x] 10.5 Verificar con Vitest de los archivos tocados, `tsc`, ESLint y Prettier.

Evidencia del grupo: pruebas en verde y capturas de las vistas nuevas.

Resultado registrado (2026-10-05): pruebas en verde. Notas:
- 10.1: `pages/withholdings/PendingWithholdingsPage.tsx`, una sola página con el ámbito como propiedad, en `/sales/withholdings` y `/maintenance/withholdings`, enlazada desde las dos cuentas por cobrar y desde el detalle de cada operación. Los diálogos de comprobante y anulación (`features/sales/WithholdingRecords.tsx`) se comparten entre ámbitos. La corrección de un comprobante ya completado se hace desde el detalle de la operación, donde sigue visible.
- 10.2: el formulario de cliente envía la marca solo cuando la persona la cambia, para no alterar el contrato de las ediciones que no la tocan.
- 10.3: `WithholdingSettingsBlock` dentro de `ProfileConditionsSection`, sin pestaña ni sección nueva.
- 10.4: se comprobó con axe en los recorridos E2E (diálogo de cobro, lista de pendientes y diálogo del comprobante) y a 390 px de ancho sin desplazamiento horizontal. No se tomaron capturas ni hubo revisión visual manual; queda como aceptación humana.

## 11. Recorridos de punta a punta

Dependencias: grupo 10.

- [x] 11.1 Añadir a `frontend/e2e/sales-payments.spec.ts` un recorrido: marcar un cliente como agente de retención, cobrar una venta con dinero y retención, verla sin deuda y completar el comprobante desde el seguimiento.
- [x] 11.2 Añadir a `frontend/e2e/maintenance-billing.spec.ts` el recorrido equivalente para una operación artesanal, incluida la anulación de la retención por el Administrador.
- [x] 11.3 Añadir a `frontend/e2e/workshop-configuration.spec.ts` la desactivación del registro en una entidad y comprobar que su cobro deja de ofrecer la retención.
- [x] 11.4 Ejecutar solo esas tres especificaciones y registrar el resultado y las limitaciones del entorno.

Evidencia del grupo: recorridos en verde con su salida; no se ejecuta el resto de Playwright.

Resultado registrado (2026-10-05): 12 pruebas pasan en `e2e/sales-payments.spec.ts` y `e2e/maintenance-billing.spec.ts` (9 existentes y 3 nuevas), con el backend real de `testserver`.
- 11.1: se marca el cliente como agente de retención por la API, el cobro lo sugiere desde el inicio, 98,00 por transferencia y 2,00 retenidos cierran una venta de 100,00, y el comprobante se completa desde «Retenciones por completar», también a 390 px.
- 11.2: operación artesanal de contado cerrada con dinero y 1,00 retenido; el Administrador anula la retención y el saldo vuelve a 1,00.
- 11.3: se escribió en `sales-payments.spec.ts` y no en `workshop-configuration.spec.ts`, porque necesita una venta real y aquella especificación simula la configuración con `page.route`. El Administrador desactiva el registro desde el Perfil tributario, el cobro deja de ofrecer la retención y se restablece al final.
- Reparación ajena necesaria: los dos archivos sembraban existencia con `POST /purchases/`, que dejó de aceptar altas con las entradas de stock (DP-030), por lo que todos sus recorridos fallaban antes de este cambio. Se sustituyó por `POST /purchases/entries/`.
- Entorno: el puerto 8001 de `playwright.config.ts` está ocupado por otro proyecto local y el navegador de Playwright no está instalado; se ejecutó con una configuración temporal (puertos 8011 y 55184, Google Chrome del sistema) que se borró. No se ejecutó el resto de Playwright.

## 12. Documentación, trazabilidad y cierre

Dependencias: grupos 1 a 11.

- [x] 12.1 Registrar DP-032 en `docs/negocio/decisiones/decisiones-confirmadas.yaml` con D1…D7 y su referencia de glosario.
- [x] 12.2 Actualizar `docs/arquitectura/modelo-dominio.md` (§5.3, §10 y diagrama) y `docs/arquitectura/modelo-datos.md` con las tablas nuevas.
- [x] 12.3 Actualizar `docs/negocio/producto/reglas-negocio.md` (RN-VEN-011 y reglas nuevas), `glosario.md` (retención recibida, comprobante de retención, comprobante pendiente), `requisitos-funcionales.md`, `casos-de-uso.md` (CU-013), `interfaz-y-navegacion.md` y `matriz-trazabilidad.md`, con sus referencias de glosario.
- [x] 12.4 Completar las matrices de cobertura de 1.4 con los archivos y casos reales de prueba.
- [x] 12.5 Ejecutar `openspec validate registrar-retenciones-recibidas-en-cobros --strict`, el chequeo de migraciones y la verificación focalizada final de backend y frontend.
- [x] 12.6 Redactar el resumen de cierre con comandos y resultados reales, indicando expresamente qué no se ejecutó (`make check`, `make test`, suites completas y el resto de Playwright) para que el usuario decida si quiere la verificación completa antes de integrar.

Evidencia del grupo: documentos sincronizados, validación de OpenSpec y resumen con resultados reales.

Resultado registrado (2026-10-05):
- 12.1: DP-032 en `decisiones-confirmadas.yaml` con D1…D7 y su referencia de glosario.
- 12.2: `modelo-dominio.md` (operación trazable en §5.3, saldo en §10, extensión §11.7, diagrama y trazabilidad) y `modelo-datos.md` (columna del cliente, tablas de retención de ventas y taller y ajustes por entidad).
- 12.3: RN-VEN-011 actualizada y RN-VEN-022…025 nuevas; glosario con «Retención recibida», «Comprobante de retención» y «Comprobante pendiente»; RF-PAG-013…015, RF-CLI-014 y RF-ACC-017; alternativas de CU-013; UI-019, UI-022, UI-060…062 y la nueva UI-064; fila de trazabilidad; referencias de glosario de cada documento.
- 12.4: las 20 filas de las dos matrices de cobertura quedaron con sus pruebas reales y estado «Cubierto».
- 12.5: `openspec validate --strict` válido; `makemigrations --check` sin cambios; `schema.yml` idéntico a la generación con `spectacular --validate`.

### Resumen de cierre

Qué se ejecutó (2026-10-05), todo en verde:

- Backend: `uv run --frozen pytest --no-cov tests/test_shared_money.py tests/test_shared_withholding.py tests/sales tests/workshop tests/customer_registry tests/workshop_configuration/test_withholding_settings.py tests/fiscal/test_configuration_api.py tests/fiscal/test_openapi.py` → 1200 pruebas pasan en 3 min 7 s. Ruff (`check` y `format --check`) y mypy sobre `src` sin hallazgos.
- Frontend: Vitest de ventas, mantenimiento, clientes, fiscal, sus páginas, la página de retenciones y las rutas → 54 archivos, 501 pruebas pasan. `tsc`, ESLint y Prettier sin hallazgos en lo tocado.
- E2E: `e2e/sales-payments.spec.ts` y `e2e/maintenance-billing.spec.ts` → 12 pruebas pasan con una configuración temporal de Playwright (puertos 8011 y 55184, Google Chrome del sistema) que se borró.

Qué no se ejecutó, conforme a la instrucción de pruebas focalizadas: `make check`, `make test`, `make audit`, `npm run build`, el resto de pytest (compras, inventario, catálogo, identidad, el resto de fiscal y de configuración), el resto de Vitest y el resto de Playwright. Falta decidir si se quiere la verificación completa antes de integrar.

Diferencias respecto de los artefactos aprobados, ya anotadas en cada grupo:

- La unicidad del comprobante usa la FK del cliente en la retención, no una copia de su identificación.
- El permiso de los ajustes es `parametros.gestionar` y sus rutas viven en la API fiscal, junto a las del perfil tributario.
- El backend añadió `withholding_context` al detalle de la venta y al resumen de la operación artesanal para que la pantalla de cobro sepa qué ofrecer.
- El recorrido E2E de la entidad sin retenciones está en `sales-payments.spec.ts`.
- En los grupos 6 y 7 el código se escribió antes que sus pruebas.

Trabajo pendiente real:

- Aceptación visual humana de las pantallas nuevas; no se tomaron capturas.
- Los recorridos E2E de ventas y taller estaban rotos antes de este cambio por la siembra de existencia con la API de compras anterior; se repararon aquí. No se revisó si otras especificaciones de Playwright tienen el mismo problema.
- Importar el XML del comprobante de retención y vincular la retención con la factura autorizada quedan para cambios posteriores, como indica la propuesta.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
