<!--
Tareas para revisión. El usuario aprobó expresamente el diseño y ADR-0006 el 2026-09-20,
registrados en master en 0ef91f6; las specs en c393e13 y la propuesta en b527d68. Este
artefacto no autoriza implementación: apply requiere aprobación explícita posterior,
conforme a openspec/config.yaml y AGENTS.md. Tampoco autoriza commits, ramas ni merges.

Aplicar TDD en cada grupo de comportamiento: primero la prueba que falla por la razón
esperada, después la implementación mínima y por último la refactorización. Las rutas de
archivos existentes fueron confirmadas por inspección; los archivos nuevos provienen del
diseño y todavía no existen. Backend siempre con `uv run --frozen`; frontend con npm.
Toda evidencia debe ser un resultado real ejecutado, nunca una afirmación anticipada.
-->

## 1. Preparación del módulo comercial y fronteras

- [x] 1.1 Crear `backend/src/sales/` con `__init__.py`, `apps.py`, `models.py` sin modelos, `domain/__init__.py`, `application/__init__.py`, `api/__init__.py` y `migrations/__init__.py`, sin código de negocio todavía.
- [x] 1.2 Registrar `sales.apps.SalesConfig` en `backend/src/config/settings/base.py` después de `purchasing.apps.PurchasingConfig`, sin alterar el orden de las aplicaciones existentes.
- [x] 1.3 Crear el directorio `backend/tests/sales/` sin `__init__.py`, siguiendo la convención vigente de `backend/tests/purchasing/`, y reutilizar `backend/tests/conftest.py` y `backend/tests/fixtures/`.
- [x] 1.4 Escribir en `backend/tests/sales/test_boundaries.py`, adaptando `backend/tests/purchasing/test_boundaries.py`, las pruebas que fallan mientras la aplicación no exista y que prohíban importar modelos de `catalog`, `customer_registry`, `inventory`, `workshop_configuration` e `identity`, ejecutar SQL de otros módulos y escribir en persistencia ajena.
- [x] 1.5 Añadir en la misma prueba la prohibición de que `sales/domain/` importe Django, DRF o persistencia, y la prohibición de que `inventory`, `purchasing`, `catalog`, `customer_registry` y `workshop_configuration` importen `sales`.
- [x] 1.6 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_boundaries.py` en verde y `uv run --frozen python manage.py check` sin errores.

## 2. Dominio puro de importes de venta

- [x] 2.1 Escribir en `backend/tests/sales/test_amounts.py` las pruebas que fallan del desglose por línea: total = cantidad × precio final; base = HALF_UP(total / (1 + tarifa/100), 2); impuesto = total − base, con el ejemplo de la spec: 2 × 11.50 al 15 % produce total 23.00, base 20.00 e impuesto 3.00.
- [x] 2.2 Añadir la prueba del medio centavo de la spec: tarifa de prueba 20 % y total de línea 0.03 producen base 0.03 e impuesto 0.00 conservando el total 0.03.
- [x] 2.3 Añadir la prueba de totales del documento: dos líneas de total 0.03 al 20 % producen base 0.06, impuesto 0.00 y total 0.06, sumando líneas ya redondeadas sin recálculo global.
- [x] 2.4 Añadir la prueba de tarifa cero explícita configurada, que produce impuesto 0.00, frente a la ausencia de vigencia, que es error y nunca exención.
- [x] 2.5 Añadir pruebas de rechazo de cantidad cero, negativa o fraccionaria, precio con más de dos decimales, valores no finitos y desbordamiento de los máximos declarados en el diseño, sin truncar ni redondear la entrada.
- [x] 2.6 Escribir las pruebas de la venta de total cero: importes cero válidos sin inventar pago ni tratarla como error de cálculo.
- [x] 2.7 Implementar `backend/src/sales/domain/amounts.py` con `Decimal`, contexto local de precisión 60 y HALF_UP explícito, sin importar Django, DRF ni persistencia, hasta que las pruebas pasen; refactorizar después sin cambiar resultados.
- [x] 2.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_amounts.py` en verde y `uv run --frozen mypy src/sales` sin errores.

## 3. Dominio puro de distribución de costos y devoluciones

- [x] 3.1 Escribir en `backend/tests/sales/test_allocation.py` las pruebas que fallan del reparto del valor de salida realmente aplicado entre líneas del mismo producto por cantidad y posición estable, con diferencias de valor proporcional acumulado a seis decimales y residuo en la última línea.
- [x] 3.2 Añadir la prueba de líneas repetidas del mismo producto en una venta, comprobando que la suma de asignaciones iguala exactamente el valor publicado por inventario y no `cantidad × costo publicado`.
- [x] 3.3 Escribir en `backend/tests/sales/test_return_amounts.py` la prueba del ejemplo histórico de la spec: venta de 2 unidades con total 23.00, base 20.00 e impuesto 3.00; devolver una unidad corrige total 11.50, base 10.00 e impuesto 1.50 aunque cambien precio y tarifa del catálogo.
- [x] 3.4 Añadir la prueba de devoluciones sucesivas con residuo de la spec: tres unidades con total 0.15, base 0.13 e impuesto 0.02 producen bases 0.04, 0.05 y 0.04, impuestos 0.01, 0.00 y 0.01 y totales 0.05 cada vez, sumando exactamente los importes originales.
- [x] 3.5 Añadir la prueba de asignación de costo por tramo devuelto: proporción acumulada del valor histórico a seis decimales para aptos y no aptos, orden canónico apto antes que no apto y residuo agotado por el último tramo de la línea.
- [x] 3.6 Añadir la prueba de que devolver todas las unidades aptas restituye exactamente el valor histórico de salida y de que una devolución mixta nunca reintegra el valor asignado a unidades no aptas.
- [x] 3.7 Añadir pruebas de rechazo de cantidad acumulada mayor que la vendida, de importes acumulados superiores a los originales y de exigible negativo derivado.
- [x] 3.8 Implementar `backend/src/sales/domain/allocation.py` y `backend/src/sales/domain/returns.py` como funciones puras sobre `Decimal`, sin dependencias de framework.
- [x] 3.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_allocation.py tests/sales/test_return_amounts.py` en verde y `uv run --frozen mypy src/sales` sin errores.

## 4. Dominio puro de saldos, estados y condición

- [x] 4.1 Escribir en `backend/tests/sales/test_balances.py` las pruebas que fallan de E (exigible vigente tras correcciones), P (pagos válidos netos de correcciones) y R (reembolsos efectivos), con aplicado neto P − R.
- [x] 4.2 Añadir las pruebas de las fórmulas de la spec: saldo = máximo(E − (P − R), 0) y exceso = máximo((P − R) − E, 0), con los casos 100/30 → saldo 70 parcial; 100/100 → saldo 0 pagado; exigible 80 con pagos 100 → saldo 0, pagado y exceso 20; tras reembolso de 20 → exceso 0.
- [x] 4.3 Añadir la prueba de la venta de 100.00 con pagos 60.00 cuya devolución reduce el exigible a 80.00: saldo 20.00, estado parcial y sin reembolso pendiente.
- [x] 4.4 Añadir la prueba del estado de importe cero: sin deuda, sin pago ficticio y con rechazo de todo cobro posterior.
- [x] 4.5 Añadir las pruebas de la condición: CONTADO exige cobro igual al saldo y rechaza abonos parciales; CREDITO admite abonos sin vencimiento, cuotas ni intereses; CREDITO nunca es medio de pago.
- [x] 4.6 Implementar `backend/src/sales/domain/balances.py` con las fórmulas aprobadas y sin estados almacenados editables.
- [x] 4.7 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_balances.py` en verde.

## 5. Persistencia comercial, restricciones e historia inmutable

- [x] 5.1 Escribir en `backend/tests/sales/test_models.py` las pruebas que fallan de `Sale`: estados `DRAFT`/`CONFIRMED`/`VOIDED`, número único cuando existe y ausente en borrador, versión creciente, referencias `PROTECT` a cliente, entidad fiscal, bodega y usuario, y snapshots históricos con clave de versión validada.
- [x] 5.2 Escribir las pruebas de `SaleLine`: posición única por venta, cantidad entera positiva, y precio/base/tarifa/impuesto/total históricos informados solo al confirmar.
- [x] 5.3 Escribir las pruebas de `SaleCostAllocation`: vínculo línea–movimiento agrupado, cantidad, costo publicado `Decimal(24,6)` y valor aplicado `Decimal(38,6)`, inmutable y con suma verificable por movimiento.
- [x] 5.4 Escribir las pruebas de `CommercialPayment` y `PaymentPart`: UUID único del hecho, importe positivo `Decimal(24,2)`, una parte por medio sin repetición, suma exacta de partes y prohibición de reutilizar el UUID en otra venta.
- [x] 5.5 Escribir las pruebas de `PaymentCorrection`: una corrección vigente por pago original, motivo no vacío, reemplazo opcional vinculado y conservación íntegra del original.
- [x] 5.6 Escribir las pruebas de `SaleReturn` y `SaleReturnLine`: UUID único, línea original de la misma venta, cantidades aptas/no aptas enteras no negativas con suma positiva, e importes históricos asignados.
- [x] 5.7 Escribir las pruebas de `CommercialRefund` y `RefundPart`, `SaleVoid` (única por venta) y `SalesCommand` (unicidad actor/acción/clave, huella canónica e identidad de resultado).
- [x] 5.8 Implementar los modelos en `backend/src/sales/models.py` con FK `PROTECT` y `related_name='+'` hacia catálogo, clientes, inventario, configuración y usuario, sin añadir campos inversos a los contratos ajenos.
- [x] 5.9 Generar `backend/src/sales/migrations/0001_initial.py` con tablas, constraints de rango y estado, unicidades de número/UUID/corrección e índices de venta por cliente/fecha/ID y estado/fecha/ID, y de pagos, devoluciones y reembolsos por venta/fecha/ID.
- [x] 5.10 Escribir en `backend/tests/sales/test_history_protection.py` las pruebas que fallan al intentar `UPDATE` y `DELETE` de ventas confirmadas, líneas, pagos, partes, devoluciones, reembolsos y asignaciones, tanto por ORM como por SQL directo, permitiendo únicamente la transición autorizada de estado/versión/campos de anulación.
- [x] 5.11 Añadir `backend/src/sales/migrations/0002_history_protection.py` con los triggers PostgreSQL correspondientes y los triggers diferidos de suma de partes y pertenencia a la misma venta, reversibles y sin desactivación en producción.
- [x] 5.12 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_models.py tests/sales/test_history_protection.py` en verde y `uv run --frozen python manage.py makemigrations --check --dry-run` sin cambios pendientes.

## 6. Interfaces públicas de catálogo y clientes

- [x] 6.1 Escribir en `backend/tests/catalog/test_sales_references.py` las pruebas que fallan de referencias por IDs con precio final vigente y elección tributaria, búsqueda paginada y `lock_product_references(ids)` bajo transacción activa, incluida la consulta histórica con `require_active=False`.
- [x] 6.2 Implementar `backend/src/catalog/application/sales_references.py` sin modificar `inventory_references.py` ni añadir precio de venta a sus consumidores actuales.
- [x] 6.3 Escribir en `backend/tests/customer_registry/test_sales_references.py` las pruebas de búsqueda paginada y consulta/bloqueo de cliente con DTO inmutable de identidad, contacto y estado, sin vehículos ni capacidad de escritura.
- [x] 6.4 Implementar `backend/src/customer_registry/application/sales_references.py` conservando intacto `catalog_references.py`.
- [x] 6.5 Añadir en ambas interfaces la prueba negativa que exige transacción exterior activa para las variantes bloqueantes y que rechaza DTO de bloqueo provenientes del cliente HTTP.
- [x] 6.6 Añadir la prueba de que un cliente desactivado después de vender sigue permitiendo consultar y corregir su historia pero no iniciar ventas nuevas.
- [x] 6.7 Actualizar la lista blanca de `backend/tests/catalog/test_boundaries.py` y la equivalente de clientes para incluir las interfaces nuevas, sin relajar las prohibiciones de modelos ni de escrituras ajenas.
- [x] 6.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/catalog tests/customer_registry` en verde, incluida la regresión de esos módulos.

## 7. Ampliación de inventario para efectos comerciales

- [x] 7.1 Escribir en `backend/tests/inventory/test_sales_effects.py` las pruebas que fallan para los nuevos `OperationKind.SALE_OUT` y `OperationKind.CUSTOMER_RETURN_IN`, con `CUSTOMER_RETURN_IN` incorporado a `ENTRY_KINDS` de `backend/src/inventory/application/posting.py` y `SALE_OUT` como salida.
- [x] 7.2 Añadir las pruebas del origen de la devolución: `source_type`/`source_id` apuntando a la devolución y `corrects_operation` a la salida original, sin usar `REVERSAL` ni la relación uno a uno `reverses_movement`.
- [x] 7.3 Añadir la prueba de que una devolución con cantidad apta cero no crea operación física vacía y de que un reingreso apto se integra como entrada nueva sin reescribir movimientos anteriores.
- [x] 7.4 Añadir la prueba del ejemplo de la spec: unidad vendida con costo histórico 4.00 y existencia de dos unidades valoradas en 12.00 tras otra compra producen, al devolver apta, existencia 3, valor 16.00 y promedio publicado 5.333333.
- [x] 7.5 Añadir la prueba de que `backend/src/inventory/application/operations.py` sigue aceptando únicamente carga inicial y ajustes manuales y rechaza crear o revertir tipos comerciales por el acceso administrativo genérico.
- [x] 7.6 Escribir la prueba de la consulta inmutable de efectos de salida con valor realmente aplicado, extendiendo el DTO de `operation_effects` en `backend/src/inventory/application/queries.py` sin devolver modelos de persistencia.
- [x] 7.7 Escribir la prueba de `get_operation` que no trate todo origen distinto de `PURCHASE_RECEIPT` como ajuste libre y que no conceda acceso a la venta ni a costos desde el Kardex.
- [x] 7.8 Implementar los cambios en `backend/src/inventory/models.py`, `application/posting.py`, `application/operations.py` y `application/queries.py`, y generar `backend/src/inventory/migrations/0004_commercial_operations.py` con los nuevos valores y checks, conservando los triggers de historia vigentes.
- [x] 7.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory` en verde, incluida la regresión completa de inventario, y `makemigrations --check --dry-run` limpio.

## 8. Ventas: borradores, referencias y precios

- [x] 8.1 Escribir en `backend/tests/sales/test_drafts.py` las pruebas que fallan de crear, editar, listar y recuperar borradores sin reservar, descontar inventario, crear deuda ni consumir número.
- [x] 8.2 Añadir la prueba de edición concurrente con `expected_version` que conserva una modificación y rechaza la obsoleta con `stale_record`, sin sobrescritura silenciosa.
- [x] 8.3 Añadir pruebas de validación de referencias: cliente registrado conforme a DP-008, productos activos, rechazo de servicios y rechazo explícito de la entidad artesanal en una venta comercial.
- [x] 8.4 Añadir pruebas de cantidades: enteras positivas de presentaciones completas y rechazo de cero, negativas y fraccionarias, identificando la línea afectada.
- [x] 8.5 Añadir la prueba del kit vendido intacto: se descuenta solo la unidad del kit y nunca sus componentes.
- [x] 8.6 Añadir la prueba de que el precio aplicado procede del catálogo vigente y de que un precio negociado, un descuento —incluso de valor cero— o un impuesto sustituido en la venta se rechazan para todos los roles, incluido Administrador.
- [x] 8.7 Añadir la prueba del producto desactivado después de agregarse al borrador, que impide confirmar e identifica la línea conservando el borrador.
- [x] 8.8 Implementar `backend/src/sales/application/sales.py`, `backend/src/sales/application/errors.py` y `backend/src/sales/domain/draft_input.py` reutilizando `backend/src/shared/command_values.py`.
- [x] 8.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_drafts.py` en verde.

## 9. Ventas: revisión firmada y previsualización de captura

- [x] 9.1 Escribir en `backend/tests/sales/test_review.py` las pruebas que fallan del token firmado de 15 minutos ligado a actor, acción, venta, versión y huella del contenido y efectos, sin costos para roles no autorizados.
- [x] 9.2 Añadir las pruebas de rechazo de token modificado, vencido, de otro actor, de otra acción o de otra versión de la venta.
- [x] 9.3 Añadir la prueba del escenario de la spec: revisión con precio 10.00 y cambio de catálogo a 12.00 exige nueva revisión con 12.00 y totales actuales, sin confirmar ni descontar existencia.
- [x] 9.4 Añadir la prueba de que cada acción incluye solo sus dependencias relevantes en la huella (líneas, condición, cliente, precios y tarifas, fecha operativa, disponibilidad, saldo, devoluciones y reembolsos existentes, valoración cuando corresponda).
- [x] 9.5 Escribir en `backend/tests/sales/test_draft_preview.py` las pruebas de la previsualización de captura sin persistir: no guarda borrador, no crea recibos, no reserva inventario, no numera y no registra usos fiscales, y devuelve proyección documental con incidencias por campo para entradas incompletas.
- [x] 9.6 Añadir la prueba de que la previsualización de captura no habilita confirmar por sí sola y exige primero guardar y revisar el borrador persistido.
- [x] 9.7 Implementar `backend/src/sales/application/reviews.py` siguiendo el patrón de revisión vigente en `backend/src/purchasing/application/purchases.py`, sin duplicar sus servicios.
- [x] 9.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_review.py tests/sales/test_draft_preview.py` en verde.

## 10. Ventas: confirmación atómica, numeración y salidas

- [x] 10.1 Escribir en `backend/tests/sales/test_confirm.py` las pruebas que fallan de la confirmación válida con varios productos: número de la serie activa del ámbito de ventas comerciales (inicialmente COM-VEN), snapshots históricos, salidas `SALE_OUT`, asignaciones de costo, importe exigible y auditoría, todo en una sola transacción y sin crear pago ni autorización fiscal.
- [x] 10.2 Añadir la prueba de disponibilidad insuficiente en una de dos líneas, que rechaza toda la venta sin descontar el otro producto ni consumir numeración.
- [x] 10.3 Añadir pruebas de configuración ausente: falta entidad, bodega, serie o vigencia tributaria única, que rechazan con explicación corregible sin número, movimientos ni saldo, y que nunca interpretan la ausencia como tarifa cero.
- [x] 10.4 Añadir la prueba de la fecha efectiva: hora del servidor capturada tras los bloqueos, resolución en America/Guayaquil, segunda comprobación tras bloquear configuración y numeración, y `review_required` sin consumir número si cambió el día o la configuración revisada.
- [x] 10.5 Añadir la prueba del cruce de tarifa de la spec: confirmar después de entrar en vigor otra tarifa resuelve la del momento efectivo y exige nueva revisión del desglose cambiado.
- [x] 10.6 Añadir pruebas de rollback inyectado en cada efecto (numeración, uso fiscal, publicación de inventario, asignaciones, auditoría y recibo), que conservan el borrador y revierten el intento completo.
- [x] 10.7 Añadir la prueba del orden total de recursos del diseño: recibo, venta y hechos comerciales, operación original de inventario, cliente y productos por ID ascendente, posiciones, configuración y numeración, e inserciones finales, sin adquirir después recursos de grupos anteriores.
- [x] 10.8 Añadir la prueba de la venta confirmada aún no cobrada: confirmada y pendiente de pago, con documento interno confirmado y sin autorización del SRI.
- [x] 10.9 Implementar la confirmación en `backend/src/sales/application/sales.py` consumiendo `workshop_configuration.application.operation_context`, `configuration_resolver` y `numbering` dentro de la transacción exterior, e `inventory.application.posting` por su interfaz pública.
- [x] 10.10 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_confirm.py` en verde.

## 11. Ventas: estados, historia y edición destructiva

- [x] 11.1 Escribir en `backend/tests/sales/test_history.py` la prueba que falla de conservación histórica: cambiar nombre del cliente, producto, datos fiscales, precio, tarifa o costo actual no altera la venta confirmada ni su comprobante.
- [x] 11.2 Añadir la prueba de rechazo de edición genérica o eliminación de una venta confirmada o anulada por cualquier rol, incluidos importes, cantidades, cliente y estado.
- [x] 11.3 Añadir la prueba de independencia entre estado de venta, estado de pago, documento interno y futura facturación.
- [x] 11.4 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_history.py` en verde.

## 12. Pagos comerciales: registro, condición y saldo

- [x] 12.1 Escribir en `backend/tests/sales/test_payments.py` la prueba que falla del pago combinado válido: saldo 100.00 cobrado con 40.00 en efectivo y 60.00 en transferencia produce un solo pago con ambas partes, fecha efectiva del sistema, actor y entidad comercial.
- [x] 12.2 Añadir pruebas de rechazo por partes que no suman el importe, parte no positiva, medio distinto de EFECTIVO/TRANSFERENCIA, intento de CREDITO como medio y más de dos decimales, sin redondeo silencioso.
- [x] 12.3 Añadir pruebas de estado de la venta: pago contra borrador rechazado por anticipo, y pago contra venta anulada o sin saldo rechazado sin crear dinero aplicado.
- [x] 12.4 Añadir la prueba del sobrepago: saldo 35.00 y cobro de 40.00 se rechazan por completo, sin registrar 35.00 ni guardar 5.00 a favor.
- [x] 12.5 Añadir la prueba del importe destinado a dos ventas, que exige pagos separados elegidos por el usuario sin reparto automático, y la del intento de cobrar una operación artesanal mediante el registro comercial.
- [x] 12.6 Añadir la prueba de la fecha manipulada: un cobro con fecha distinta de la efectiva del sistema se rechaza y el cobro queda pendiente, sin asiento retroactivo.
- [x] 12.7 Añadir las pruebas de condición: contado exige cobro igual al saldo y rechaza un abono de 40.00 sobre saldo 100.00 sin convertir la condición; contado interrumpido conserva la venta confirmada con saldo 100.00 y permite reanudar; crédito de 100.00 confirmado sin dinero queda pendiente sin vencimiento ni plan.
- [x] 12.8 Añadir las pruebas de derivación de saldos y estados sobre datos persistidos, replicando los casos del grupo 4 a través del servicio, y la prohibición de editar manualmente saldo, total pagado o estado de pago.
- [x] 12.9 Implementar `backend/src/sales/application/payments.py` sobre `backend/src/sales/domain/balances.py`, bloqueando siempre la venta antes del pago y sin abrir transacciones independientes.
- [x] 12.10 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_payments.py` en verde.

## 13. Pagos: corrección administrativa sin borrar historia

- [x] 13.1 Escribir en `backend/tests/sales/test_payment_corrections.py` la prueba que falla de anulación de un pago erróneo de 100.00 con motivo: conserva el original anulado y su auditoría y deriva saldo 100.00 y estado pendiente, sin cambiar el estado confirmado de la venta.
- [x] 13.2 Añadir la prueba de sustitución del medio: 100.00 en efectivo sustituido por 100.00 en transferencia conserva original y reemplazo vinculados, cambia los medios netos y mantiene el saldo sin contabilizar 200.00, en una sola acción.
- [x] 13.3 Añadir pruebas de rechazo de corrección sin motivo o con motivo en blanco y de reemplazo que incumple saldo, medios, precisión o condición de contado, conservando vigente el original.
- [x] 13.4 Añadir la prueba de dependencia incompatible: con pagos válidos de 100.00, exigible cero y reembolso efectivo de 100.00, anular esos pagos se rechaza explicando la dependencia, sin borrar el desembolso ni crear deuda del cliente.
- [x] 13.5 Añadir la prueba de que una anulación de pago nunca representa dinero realmente reembolsado y de que no se transfiere dinero a otra venta.
- [x] 13.6 Añadir la prueba de que la corrección bloquea primero la venta y después el pago, nunca en orden inverso.
- [x] 13.7 Implementar la corrección en `backend/src/sales/application/payments.py` con registro compensatorio y reemplazo opcional aplicados conjuntamente.
- [x] 13.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_payment_corrections.py` en verde.

## 14. Correcciones: devoluciones de cliente

- [x] 14.1 Escribir en `backend/tests/sales/test_returns.py` la prueba que falla de la devolución parcial con aptitud mixta de la spec: de cinco unidades se devuelven tres, dos aptas y una no apta, se corrigen económicamente tres, reingresan dos y quedan dos devolvibles.
- [x] 14.2 Añadir la prueba del límite acumulado: con cinco vendidas y tres devueltas, tres adicionales se rechazan por completo, incluso repartidas en entradas repetidas de la misma línea dentro de una solicitud.
- [x] 14.3 Añadir pruebas de elegibilidad: línea de otra venta, origen artesanal, venta en borrador o anulada se rechazan sin alterar ninguna operación.
- [x] 14.4 Añadir pruebas de datos inválidos: cantidad cero, negativa o fraccionaria y ausencia de clasificación de aptitud se rechazan sin efectos parciales.
- [x] 14.5 Añadir la prueba del producto no apto: reduce el exigible sin aumentar existencia ni valoración y sin generar entrada física.
- [x] 14.6 Añadir la prueba del producto desactivado después de vender: admite el reingreso histórico sin reactivar el producto para ventas nuevas.
- [x] 14.7 Añadir la prueba de la devolución posterior a otros movimientos, que no queda impedida por la restricción de reversión exacta del último movimiento.
- [x] 14.8 Añadir la prueba de la devolución total sin cobros: exigible y saldo cero conservando la venta confirmada y la devolución vinculada, sin convertirla silenciosamente en anulada.
- [x] 14.9 Añadir la prueba de la devolución revisada que queda obsoleta por otro pago o devolución y exige revisión actualizada.
- [x] 14.10 Implementar `backend/src/sales/application/returns.py` sobre el dominio del grupo 3, publicando `CUSTOMER_RETURN_IN` solo cuando hay cantidad apta.
- [x] 14.11 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_returns.py` en verde.

## 15. Correcciones: exceso pagado y reembolso efectivo

- [x] 15.1 Escribir en `backend/tests/sales/test_refunds.py` la prueba que falla del exceso visible: venta de 100.00 pagada cuya devolución reduce el exigible a 60.00 muestra 40.00 pendientes de reembolso y saldo cobrable cero, sin registrar dinero devuelto.
- [x] 15.2 Añadir la prueba del registro del desembolso de 40.00 con medio real y motivo por el Administrador, que deja exceso cero sin nueva deuda y vinculado a la venta y a su corrección.
- [x] 15.3 Añadir pruebas de rechazo: reembolso mayor que el exceso vigente, reembolso sobre una venta que nunca recibió pagos, medio CREDITO, importe no positivo, precisión excesiva, partes incoherentes y destino artesanal.
- [x] 15.4 Añadir la prueba de que los importes acumulados de reembolso no exceden la obligación atribuible a su corrección ni el exceso global actual.
- [x] 15.5 Añadir la prueba de que un reembolso confirmado no se edita ni elimina por acciones ordinarias, conservando importe, medio, actor, fecha y vínculo.
- [x] 15.6 Añadir la prueba de fallo durante el registro: conserva el estado previo sin reembolso parcial, comunica que el registro falló y permite reintentar el mismo hecho sin solicitar un segundo desembolso.
- [x] 15.7 Implementar `backend/src/sales/application/refunds.py` bloqueando venta y corrección, sin invocar sistemas externos ni compensar ventas entre sí.
- [x] 15.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_refunds.py` en verde.

## 16. Correcciones: anulación conservadora con tratamiento de pagos

- [x] 16.1 Escribir en `backend/tests/sales/test_void.py` la prueba que falla de la anulación de una venta sin pagos ni devoluciones cuyas salidas son los últimos efectos: queda anulada con exigible cero, cantidades y valoración previas restituidas mediante movimientos vinculados y número original conservado.
- [x] 16.2 Añadir la prueba del movimiento posterior en uno de varios productos, que rechaza toda la anulación identificando la dependencia sin compensar los otros ni reescribir movimientos.
- [x] 16.3 Añadir la prueba de la anulación posterior a una devolución confirmada, que se rechaza y orienta a limitar devoluciones adicionales a lo aún devolvible.
- [x] 16.4 Añadir la prueba del dinero recibido sin tratamiento: completar la anulación se bloquea conservando la venta confirmada y sus pagos, sin marcar un reembolso ficticio.
- [x] 16.5 Añadir la prueba de la anulación con desembolso expresamente registrado de 100.00 y su medio real dentro del mismo comando: conserva el cobro original, registra el reembolso vinculado y deja exigible, saldo y exceso cero, sin pagos huérfanos ni doble desembolso.
- [x] 16.6 Añadir la prueba del pago erróneo ya corregido antes de anular, que conserva la corrección y no inventa un reembolso de dinero no recibido.
- [x] 16.7 Añadir la prueba de fallo durante la anulación con tratamiento de pagos, que conserva íntegro el estado anterior y permite reintentar sin duplicar efectos.
- [x] 16.8 Añadir la prueba de repetición de una anulación completada, que devuelve el resultado existente sin otros movimientos, reembolsos ni cambios de numeración.
- [x] 16.9 Implementar `backend/src/sales/application/voids.py` usando la reversión exacta existente de `backend/src/inventory/application/posting.py` y coordinando internamente el reembolso de anulación sin reclamar otro recibo.
- [x] 16.10 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_void.py` en verde.

## 17. Idempotencia, recibos y consulta de estado

- [x] 17.1 Escribir en `backend/tests/sales/test_idempotency.py` las pruebas que fallan de la separación entre `idempotency_key` de transporte (8…128 caracteres, formato vigente) y `operation_id` UUID estable de pagos, devoluciones, reembolsos y correcciones.
- [x] 17.2 Añadir la prueba de repetición de la creación de borrador con igual identidad y contenido, que devuelve el mismo borrador sin crear otro.
- [x] 17.3 Añadir la prueba de reconfirmación compatible con otra identidad de transporte, que devuelve la venta existente sin duplicar número, salida ni deuda.
- [x] 17.4 Añadir las pruebas de conflicto por identidad reutilizada con contenido incompatible en venta, pago, devolución y reembolso, sin ocultar la incompatibilidad ni ejecutar efectos.
- [x] 17.5 Añadir la prueba de dos cobros legítimos del mismo importe con UUID distintos, que se distinguen por identidad y no por valores.
- [x] 17.6 Añadir la prueba de repetición de un pago de 25.00 cuya respuesta no llegó, que devuelve el pago existente sin otros 25.00 ni nuevas partes, y su equivalente para devolución y reembolso.
- [x] 17.7 Añadir la prueba de que la autorización vigente se comprueba antes de buscar o devolver un resultado y de que el replay proyecta la respuesta con los permisos actuales, sin exponer costos a un estado de roles distinto.
- [x] 17.8 Añadir la prueba de la revisión caducada en operaciones de dinero: no obliga a repetir la entrega física; se revalidan los datos y se registra el mismo hecho con el mismo `operation_id`.
- [x] 17.9 Añadir la prueba del intento fallido completamente revertido, que puede volver a validarse con la misma clave.
- [x] 17.10 Implementar `backend/src/sales/application/commands.py` con `SalesCommand`, huella canónica e identidad de resultado, y la consulta autorizada de estado por UUID.
- [x] 17.11 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_idempotency.py` en verde.

## 18. Consultas comerciales, cuentas por cobrar y documento

- [x] 18.1 Escribir en `backend/tests/sales/test_queries.py` las pruebas que fallan de la lista con número, cliente, origen directo, fecha, total y estados independientes, filtros por cliente, fecha y estado y paginación estable con ID de desempate.
- [x] 18.2 Añadir la prueba de recorrido completo de páginas sin cambios concurrentes, que devuelve cada coincidencia exactamente una vez, sin duplicados ni omisiones.
- [x] 18.3 Añadir las pruebas del detalle con enlaces a pagos, correcciones y origen de movimientos según permisos, y del historial que distingue pagos vigentes y corregidos sin sumar ambos como cobros válidos.
- [x] 18.4 Añadir la prueba de cuentas por cobrar del mismo cliente con saldos 30.00 y 70.00 y una operación artesanal ajena: muestra ambas ventas y total comercial 100.00 excluyendo la artesanal, sin pago repartido automáticamente.
- [x] 18.5 Añadir la prueba de separación de `receivable_total` y `refund_due_total`: 40.00 por pagar en una venta y 20.00 por reembolsar en otra se muestran separados, sin deuda neta 20.00 ni saldo a favor utilizable.
- [x] 18.6 Añadir la prueba de que las sumas corresponden a todas las coincidencias autorizadas y no solo a la página visible, con filtros aplicados antes de los agregados y sin multiplicación por joins entre líneas, pagos y partes.
- [x] 18.7 Añadir la prueba de antigüedad: una venta a crédito confirmada diez fechas operativas antes muestra diez días desde la confirmación en America/Guayaquil, sin vencimiento, recargo ni etiqueta de morosidad.
- [x] 18.8 Añadir la prueba del documento interno: identifica RUC comercial, cliente, líneas, desglose, número y estado, declara que no es factura electrónica autorizada por el SRI y omite costos; una venta anulada conserva número y valores originales indicando la anulación.
- [x] 18.9 Añadir la prueba de ausencia de consultas N+1 en filas y agregados de lista, detalle y cuentas por cobrar.
- [x] 18.10 Implementar `backend/src/sales/application/queries.py` con proyecciones explícitas por lista blanca y snapshot de lectura consistente por respuesta, sin bloquear escrituras.
- [x] 18.11 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_queries.py` en verde.

## 19. Autorización, proyecciones y ausencia de filtraciones

- [x] 19.1 Escribir en `backend/tests/sales/test_authorization.py` las pruebas que fallan de cada acción con los permisos existentes `ventas.ver`, `ventas.crear`, `ventas.confirmar`, `ventas.anular`, `ventas.devolver`, `pagos_comerciales.ver`, `pagos_comerciales.registrar` y `pagos_comerciales.anular`, sin crear permisos nuevos en `backend/src/identity/domain/authorization.py`.
- [x] 19.2 Añadir las pruebas de los tres roles y sus combinaciones: Vendedor confirma una venta autorizada; Encargado del taller sin rol comercial es denegado en consulta, creación, edición, confirmación, cobro y saldo por acceso directo; Vendedor con Encargado cobra por su rol Vendedor sin acceder a correcciones administrativas.
- [x] 19.3 Añadir la prueba de que solo el Administrador anula ventas, registra devoluciones y reembolsos y corrige pagos, con Vendedor rechazado incluso mediante solicitudes directas o reintentos.
- [x] 19.4 Añadir la prueba de sesión invalidada antes de confirmar o de repetir una confirmación, que rechaza sin ejecutar efectos ni revelar el resultado protegido.
- [x] 19.5 Añadir pruebas recursivas que recorren toda la respuesta operativa comprobando la ausencia de costo histórico de salida, valor asignado y valoración en detalle, listas, documento, errores, enlaces anidados y recibos de replay para Vendedor y Encargado.
- [x] 19.6 Añadir la prueba de que ningún parámetro de consulta eleva la proyección y de que el permiso de valoración es el único que añade costos.
- [x] 19.7 Añadir la prueba de que un movimiento de Kardex visible no concede acceso a la venta ni a sus costos, y de que el catálogo visual no gana información económica por un enlace anidado.
- [x] 19.8 Añadir la prueba de que un Administrador con roles adicionales no puede mezclar RUC en ninguna consulta ni escritura comercial.
- [x] 19.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_authorization.py` en verde.

## 20. Concurrencia real sobre PostgreSQL

- [x] 20.1 Crear `backend/tests/sales/test_concurrency.py` con `pytest.mark.django_db(transaction=True)`, conexiones independientes por worker, cierre explícito de conexiones y barreras con timeout antes de adquirir el recurso competido, siguiendo `backend/tests/purchasing/test_concurrency.py`.
- [x] 20.2 Escribir la prueba de dos ventas que compiten por la última unidad: confirma como máximo una y la otra informa insuficiencia sin número, deuda ni salida parcial.
- [x] 20.3 Escribir la prueba de dos confirmaciones concurrentes con inventario suficiente, que reciben números distintos y consecutivos de la serie comercial activa sin invadir ART-SER.
- [x] 20.4 Escribir la prueba de dos cobros de 70.00 sobre un saldo de 100.00, que acepta como máximo uno sin aplicación automática parcial.
- [x] 20.5 Escribir la prueba de cobro concurrente con anulación de la venta, que produce un orden válido sin dejar pagos huérfanos.
- [x] 20.6 Escribir la prueba de pago y devolución simultáneos: si el cobro llega primero, el exceso queda por reembolsar; si la devolución llega primero, el cobro se valida contra el saldo reducido, sin sobrepago aceptado.
- [x] 20.7 Escribir la prueba de dos devoluciones que compiten por la última unidad devolvible y la de dos reembolsos de 30.00 contra un exceso de 40.00, que aceptan como máximo uno cada una.
- [x] 20.8 Escribir la prueba de dos ventas con varios productos solicitados en orden inverso, que demuestra ausencia de ciclos de bloqueo en lugar de apoyarse en la traducción de deadlocks.
- [x] 20.9 Escribir las pruebas de venta frente a compra, ajuste, edición de cliente o producto y sucesión de definiciones tributarias y series concurrentes, comprobando el orden común del diseño.
- [x] 20.10 Afirmar en todas ellas el número exacto de éxitos y conflictos, la finalización de los workers y el estado completo resultante de saldos, movimientos, números, usos y auditoría; ninguna prueba debe limitarse a comprobar la ausencia de excepción.
- [x] 20.11 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_concurrency.py` en verde contra PostgreSQL real, con los workers terminados.

## 21. Comando de reconciliación comercial

- [x] 21.1 Escribir en `backend/tests/sales/test_reconcile.py` las pruebas que fallan de la verificación de número y configuración por venta confirmada, de movimientos frente a asignaciones de costo y de cantidades devueltas frente a las vendidas.
- [x] 21.2 Añadir las pruebas de verificación de E, P y R, suma de partes, reembolsos dentro del exceso atribuible y ausencia de pagos huérfanos tras anulaciones.
- [x] 21.3 Añadir la prueba del código de salida distinto de cero ante diferencias y del comportamiento de solo lectura, sin `--fix` ni corrección silenciosa de saldos.
- [x] 21.4 Implementar `backend/src/sales/management/commands/reconcile_sales.py` con transacción de lectura al comienzo, consultando inventario por su interfaz pública y sin que inventario importe ventas.
- [x] 21.5 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_reconcile.py` en verde y ejecución manual del comando sobre datos de prueba con su salida registrada.

## 22. API HTTP de ventas, cobros y correcciones

- [x] 22.1 Escribir en `backend/tests/sales/test_api.py` las pruebas que fallan de `GET`/`POST` `sales/` y `GET`/`PATCH` `sales/{id}/` con `ventas.ver` y `ventas.crear`, sin `DELETE` y con los códigos 200 y 201 esperados.
- [x] 22.2 Añadir pruebas de `POST` `sales/draft-preview/`, `sales/{id}/preview/` y `sales/{id}/confirm/`, exigiendo `expected_version`, `review_token` e `idempotency_key` en la confirmación y comprobando que las previas son de solo lectura, sin recibo ni asignación.
- [x] 22.3 Añadir pruebas de `GET`/`POST` `sales/{id}/payments/` y `POST` `payments/preview/` con `pagos_comerciales.ver` y `pagos_comerciales.registrar`.
- [x] 22.4 Añadir pruebas de `POST` `sales/{id}/payments/{payment_id}/correction-preview/` y `correct/` con `pagos_comerciales.anular` y motivo obligatorio.
- [x] 22.5 Añadir pruebas de `GET`/`POST` `sales/{id}/returns/`, `POST` `returns/preview/`, `GET`/`POST` `sales/{id}/refunds/` y `POST` `refunds/preview/` con `ventas.devolver`.
- [x] 22.6 Añadir pruebas de `POST` `sales/{id}/void-preview/` y `void/` con `ventas.anular`, incluido el payload del desembolso expresamente confirmado y su UUID.
- [x] 22.7 Añadir pruebas de `GET` `sales/{id}/document/`, `sales/receivables/`, `sales/operations/{operation_id}/`, `sales/customer-options/` y `sales/product-options/`.
- [x] 22.8 Añadir pruebas del contrato de campos: decimales como cadenas sin exponente ni coma, rechazo de números binarios JSON y booleanos, `unknown_field` ante campos ajenos, y rechazo explícito de precio editable, descuento, fecha fiscal, impuesto, total, costo y saldo en la entrada.
- [x] 22.9 Añadir pruebas de límites: hasta 200 líneas por venta o devolución, una parte por cada uno de los dos medios, notas hasta 2000 caracteres, motivos de 1 a 500 tras recortar espacios, `PATCH` que distingue omitir de vaciar y sustituye la colección completa de líneas conservando orden.
- [x] 22.10 Añadir pruebas de listas `{count,page,page_size,total_pages,results}` con página inicial 1, tamaño 20 y máximo 100, filtros de cliente, estado, antigüedad y fechas inclusivas en zona de negocio, y orden estable con ID de desempate.
- [x] 22.11 Añadir pruebas de errores `application/problem+json` con `X-Request-ID`: 400 de campos y escala, 403 por sesión, CSRF o permiso, 404 tras autorizar, y 409 de versión, revisión, idempotencia, estado, dependencia y disponibilidad, sin revelar documentos ajenos, costos ni datos de infraestructura.
- [x] 22.12 Implementar `backend/src/sales/api/serializers.py`, `views.py` y `urls.py` delgados, sin cálculos monetarios ni escrituras ajenas, y montarlos con `path("sales/", include("sales.api.urls"))` en `backend/src/config/api/urls.py`.
- [x] 22.13 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/sales/test_api.py` en verde.

## 23. Contrato OpenAPI

- [x] 23.1 Añadir las anotaciones necesarias en las vistas de `sales` para que el esquema describa rutas, permisos, parámetros, envolturas paginadas, campos decimales como cadenas y los códigos de error definidos.
- [x] 23.2 Documentar en el esquema los límites publicados de 200 líneas, dos partes por pago, 2000 caracteres de nota y 500 de motivo.
- [x] 23.3 Regenerar `backend/schema.yml` y revisar el diff para confirmar que no cambian los contratos de identidad, clientes, catálogos, configuración, compras ni inventario salvo las extensiones aprobadas.
- [x] 23.4 Evidencia del grupo: `cd backend && uv run --frozen python manage.py spectacular --validate` sin errores y diff de `backend/schema.yml` revisado.

## 24. Frontend: base de la funcionalidad de ventas

- [x] 24.1 Crear `frontend/src/features/sales/types.ts` con los contratos del backend, conservando los decimales como cadenas y sin convertirlos a `number` para cálculos.
- [x] 24.2 Escribir pruebas en `frontend/src/features/sales/api.test.ts` e implementar `api.ts` sobre `frontend/src/shared/api/client.ts`, con sesión y CSRF en todas las escrituras.
- [x] 24.3 Escribir pruebas en `frontend/src/features/sales/hooks.test.tsx` e implementar `hooks.ts` con TanStack Query, usando `frontend/src/shared/api/idempotency.ts` para las mutaciones y sin reintentos automáticos.
- [x] 24.4 Implementar y probar la conservación del UUID de cada intención monetaria mediante un identificador opaco en `sessionStorage` ligado a usuario, venta y acción, sin guardar importes, cliente, motivo ni token, y con consulta del estado del UUID al recargar antes de ofrecer otra operación.
- [x] 24.5 Añadir la prueba de que ante un resultado incierto la interfaz no afirma que el dinero no se entregó y permite registrar o reintentar el mismo hecho.
- [x] 24.6 Añadir la prueba de invalidación tras una mutación propia: venta, listas, cuentas por cobrar y, en cambios físicos, inventario y cortes de Kardex de los productos afectados.
- [x] 24.7 Añadir la prueba de que una respuesta antigua no sustituye una revisión más reciente, reutilizando `frontend/src/shared/api/latest-review.ts`.
- [x] 24.8 Añadir las rutas `/sales`, `/sales/new`, `/sales/:id`, `/sales/:id/edit`, `/sales/:id/document` y `/sales/receivables` en `frontend/src/app/App.tsx`, su entrada en `frontend/src/app/navigation.ts` y sus accesos por permiso en `frontend/src/app/AuthenticatedShell.tsx`, con pruebas de navegación autorizada en `frontend/src/app/sales-routes.test.tsx`.
- [x] 24.9 Añadir la prueba de limpieza de identificadores y cachés con datos económicos al cerrar o invalidar la sesión.
- [x] 24.10 Evidencia del grupo: `cd frontend && npm test -- src/features/sales src/app/sales-routes.test.tsx` en verde y `npm run typecheck` sin errores.

## 25. Frontend: editor de ventas con vista previa en vivo

- [x] 25.1 Escribir pruebas e implementar `frontend/src/pages/sales/SaleEditorPage.tsx` con la composición de dos superficies blancas alineadas arriba: formulario a la izquierda y vista previa del documento a la derecha, con separación de 30 px y pesos comparables desde 1280 px.
- [x] 25.2 Implementar el panel izquierdo con la captura aprobada, el editor de líneas y las acciones Guardar borrador y Revisar y confirmar, reutilizando `Field`, `Input`, `Select`, `InlineNotice` y los tokens de `DESIGN.md` sin añadir dependencias.
- [x] 25.3 Implementar el panel derecho con título «Vista previa» y una hoja del comprobante con cabecera, identidad fiscal, cliente, líneas y totales organizados como en el documento imprimible, sin convertirlo en tarjeta de métricas ni resumen lateral.
- [x] 25.4 Añadir pruebas del comportamiento sticky de la vista previa cuando cabe en altura y del recorrido completo de un documento largo sin recortar contenido ni atrapar el desplazamiento.
- [x] 25.5 Añadir pruebas del apilado bajo 1280 px con formulario primero, enlace «Ver vista previa» y retorno al formulario sin perder datos ni montar una segunda copia editable, y sin desplazamiento horizontal de la página.
- [x] 25.6 Implementar y probar la consulta reactiva: tras 300 ms sin cambios relevantes de cliente, líneas o cantidades, `POST sales/draft-preview/` autenticada y protegida por CSRF, sin guardar borrador, crear recibos, reservar inventario, numerar ni registrar usos fiscales.
- [x] 25.7 Añadir la prueba de respuestas fuera de orden descartadas mediante `latest-review`, y la de que el frontend nunca calcula importes definitivos con coma flotante.
- [x] 25.8 Añadir las pruebas de estado: «Actualizando importes» durante el cálculo, valores anteriores identificados como pendientes, y guiones o advertencias ante datos incompletos o fallo de la consulta, nunca ceros inventados ni una vista antigua presentada como vigente.
- [x] 25.9 Añadir la prueba de la región de estado accesible que anuncia cambios sin mover el foco ni releer toda la hoja a cada pulsación.
- [x] 25.10 Añadir las pruebas de las etiquetas «Borrador · Vista previa» y «Número pendiente de confirmación», del aviso permanente de documento interno no autorizado por el SRI y de que la previsualización de captura no habilita confirmar por sí sola.
- [x] 25.11 Implementar el selector de clientes y productos en `frontend/src/features/sales/ReferencePicker.tsx`, que recorre todas las páginas necesarias, conserva las entradas tras error y etiqueta referencias inactivas explicando el bloqueo de confirmación.
- [x] 25.12 Añadir el manejo de `review_required` y `stale_record` que conserva la entrada del usuario y ofrece revisar o recargar sin sobrescritura automática, con su prueba.
- [x] 25.13 Evidencia del grupo: `cd frontend && npm test -- src/pages/sales/SaleEditorPage.test.tsx src/features/sales` en verde.

## 26. Frontend: lista, detalle, cobros, correcciones y comprobante

- [x] 26.1 Escribir pruebas e implementar `frontend/src/pages/sales/SalesPage.tsx` con `PageHeader`, `ElevatedDataList`, `Pagination`, `StatusBadge` e `InlineNotice`, filtros de cliente, estado y período en la URL y conservación al volver del detalle.
- [x] 26.2 Escribir pruebas e implementar `frontend/src/pages/sales/SaleDetailPage.tsx` con `FiscalScopeBadge`, estados de venta, pago y documento en campos separados, líneas históricas, saldo y exceso distinguidos, e historial de cobros y correcciones.
- [x] 26.3 Escribir pruebas e implementar el formulario contextual de cobro en `Drawer` o `Dialog`, con medios combinados, importe validado contra el saldo mostrado por el servidor y explicación de que contado requiere cubrir el saldo completo.
- [x] 26.4 Escribir pruebas e implementar la corrección de pago con motivo obligatorio, reemplazo opcional y explicación de dependencias incompatibles, visible solo para Administrador.
- [x] 26.5 Escribir pruebas e implementar la devolución con cantidades originales y devueltas, clasificación de aptitud por cantidad, revisión de efectos y motivo obligatorio.
- [x] 26.6 Escribir pruebas e implementar el registro de reembolso con medio real, importe acotado al exceso vigente y distinción explícita entre registrar el hecho y entregar el dinero.
- [x] 26.7 Escribir pruebas e implementar el diálogo de anulación con consecuencias, motivo obligatorio, captura del desembolso cuando hay dinero recibido y mensaje de reintento del mismo registro cuando falla, sin pedir un segundo desembolso.
- [x] 26.8 Escribir pruebas e implementar `frontend/src/pages/sales/SaleDocumentPage.tsx` con datos históricos y CSS de impresión, que oculta navegación y acciones, muestra el aviso del SRI y el estado y omite costos, sin PDF ni motor nuevo.
- [x] 26.9 Escribir pruebas e implementar `frontend/src/pages/sales/ReceivablesPage.tsx` con filtros de cliente, estado y antigüedad, totales de todas las coincidencias, columnas separadas de deuda y reembolso pendiente y antigüedad sin etiquetas de mora.
- [x] 26.10 Añadir pruebas de estados reales de carga, vacío, error y éxito, de errores asociados a su campo o acción, de prevención de envío duplicado, de foco de retorno al cerrar diálogos y de la vista de líneas como grupos etiquetados en ancho móvil.
- [x] 26.11 Añadir la prueba de que las proyecciones sin permiso de valoración nunca solicitan ni muestran costos, en lista, detalle, documento y errores.
- [x] 26.12 Evidencia del grupo: `cd frontend && npm test -- src/pages/sales` en verde.

## 27. Pruebas extremo a extremo y accesibilidad

- [x] 27.1 Crear `frontend/e2e/sales-payments.spec.ts` reutilizando `frontend/e2e/helpers.ts` y `frontend/e2e/accessibility.ts`, con el flujo completo contra la API real: borrador, vista previa en vivo, revisión, confirmación, verificación del Kardex y cobro.
- [x] 27.2 Añadir el escenario de contado interrumpido y reanudado que no inventa un pago ni convierte la venta a crédito.
- [x] 27.3 Añadir el escenario de doble envío y timeout de un cobro que no duplica el dinero y consulta el estado del UUID tras recargar la página.
- [x] 27.4 Añadir los escenarios de disponibilidad insuficiente y de anulación bloqueada por movimientos posteriores, comprobando los mensajes que identifican producto y dependencia.
- [x] 27.5 Añadir el escenario de devolución parcial con aptitud mixta, exceso visible y registro posterior del reembolso.
- [x] 27.6 Añadir el escenario de filtros conservados al volver del detalle y el de cuentas por cobrar con totales de varias páginas.
- [x] 27.7 Añadir la comprobación de correspondencia entre la hoja de vista previa y el comprobante impreso, incluido el aviso del SRI.
- [x] 27.8 Añadir comprobaciones de navegación por teclado, `reduced-motion`, foco de retorno y verificación axe sin violaciones nuevas.
- [x] 27.9 Capturar evidencia visual del editor en dos columnas a 1280 y 1440 px y apilado a 360, 768 y 1024 px, dejando constancia de que la validación técnica no sustituye la aceptación visual humana de los nuevos baselines.
- [x] 27.10 Evidencia del grupo: `cd frontend && npm run test:e2e -- e2e/sales-payments.spec.ts` en verde, con las capturas registradas.

## 28. Migraciones y tratamiento de datos existentes

- [x] 28.1 Confirmar al generar las migraciones los nombres reales de las dependencias `catalog`, `customer_registry`, `inventory`, `workshop_configuration` y del usuario swappable, en lugar de asumir los inspeccionados durante el diseño.
- [x] 28.2 Ejecutar las migraciones sobre una base PostgreSQL limpia y comprobar tablas, constraints, índices y triggers creados, incluidos los nuevos tipos y checks de inventario.
- [x] 28.3 Ejecutar las migraciones sobre una copia desechable con identidad, clientes, configuración, catálogos, compras e inventario, comprobando conteos, saldos y numeración anteriores intactos y la reversibilidad técnica antes de cualquier dato real.
- [x] 28.4 Comprobar explícitamente que no se siembran ventas, pagos, saldos iniciales ni movimientos comerciales ficticios y que ninguna venta previa se renumera.
- [x] 28.5 Comparar `reconcile_inventory` antes y después del ensayo y registrar la diferencia cero.
- [x] 28.6 Documentar el procedimiento de reversión del diseño: antes del primer uso, retirar rutas y revertir migraciones solo con tablas vacías y sin tipos comerciales usados; después de registrar ventas, detener nuevas escrituras comerciales, conservar esquema e historia y corregir hacia adelante o restaurar un respaldo completo con conciliación del dinero recibido.
- [x] 28.7 Evidencia del grupo: `make migrate` por el procedimiento local autorizado en ambos ensayos y `cd backend && uv run --frozen python manage.py makemigrations --check --dry-run` sin cambios pendientes.

## 29. Documentación, trazabilidad y ADR

- [x] 29.1 Crear `docs/negocio/requisitos/cobertura-ventas-pagos.md` y su `cobertura-ventas-pagos-glossary-reference.md` con una fila por cada uno de los 105 escenarios, identificada por capacidad, requisito y título, con la prueba exacta, el comando, el resultado y el límite real; no marcar cubierto por la sola existencia de un test.
- [x] 29.2 Actualizar `docs/arquitectura/modelo-datos.md` con las tablas, restricciones, índices y triggers realmente creados en `sales` y las extensiones de `inventory`, sin anticipar capacidades futuras.
- [x] 29.3 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` y `requisitos-funcionales.md` registrando la cobertura de RF-VEN-001/003…015/017/018, RF-PAG-001…009/011/012, RF-REP-006 comercial y RF-AUD-001…004/006, y dejando RF-VEN-002/016 y RF-PAG-010 como pendientes de proformas y taller.
- [x] 29.4 Registrar en `docs/negocio/decisiones/decisiones-confirmadas.yaml` las cuatro recomendaciones aprobadas de esta entrega —política decimal de ventas y fecha efectiva, precio de catálogo sin edición en la venta, contado con cobro posterior independiente y correcciones con reembolso expresamente registrado— sin declarar cerradas las decisiones abiertas.
- [x] 29.5 Cambiar el estado de `docs/adr/0006-coordinacion-transaccional-ventas-comerciales.md` de propuesto a aceptado con la fecha real, actualizando su referencia terminológica y sin reemplazar ADR-0001/0003/0004/0005.
- [x] 29.6 Actualizar `docs/tecnico/arquitectura-inicial.md` y `README.md` con la nueva frontera del módulo comercial y sus interfaces públicas; `docs/architecture/` de contenedores no cambia.
- [x] 29.7 Actualizar `docs/negocio/producto/glosario.md`, `docs/tecnico/glosario-tecnico.md` y las referencias terminológicas afectadas con los términos incorporados por esta capacidad.
- [x] 29.8 Evidencia del grupo: `openspec validate gestionar-ventas-pagos-credito-simple --strict --no-interactive` sin errores y revisión manual de los enlaces locales de los documentos tocados.

## 30. Verificación final y cierre del cambio

- [x] 30.1 Ejecutar `make check` completo y registrar el resultado real de formato, lint, tipos, `manage.py check`, comprobación de migraciones, pruebas backend, comprobaciones frontend y `compose-check`, distinguiendo los fallos preexistentes de los introducidos por este cambio.
- [x] 30.2 Ejecutar `make test` y confirmar que la cobertura no baja respecto de la medición previa al cambio; `--no-cov` solo en los ciclos enfocados y sin bajar ningún umbral.
- [x] 30.3 Ejecutar `make audit` y registrar el resultado, comprobando que no se añadieron dependencias y que `uv.lock` y `package-lock.json` permanecen coherentes.
- [x] 30.4 Ejecutar la regresión de los módulos anteriores: `cd backend && uv run --frozen pytest tests/identity tests/customer_registry tests/catalog tests/supplier_registry tests/workshop_configuration tests/purchasing tests/inventory tests/api` y registrar cualquier fallo preexistente sin atribuirlo a este cambio.
- [x] 30.5 Ejecutar `openspec validate --all --strict --no-interactive` y `git diff --check`, revisando además que no se versionan secretos, `.env`, datos, cargas, respaldos, cachés ni artefactos generados.
- [x] 30.6 Ejecutar `reconcile_inventory` y `reconcile_sales` sobre el entorno de prueba y comprobar diferencia cero y código de salida cero antes de dar el cambio por aplicado.
- [x] 30.7 Informar los comandos ejecutados y sus resultados reales, junto con el trabajo pendiente y las limitaciones, y solicitar autorización explícita antes de cualquier operación Git, despliegue o archivo del cambio.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
