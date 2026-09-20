<!--
Tareas para revisión. Design aprobado por el usuario y registrado en master en 8253c36;
proposal en c17ad64 y specs en ab9adcd. Este artefacto no autoriza implementación:
apply requiere aprobación explícita posterior, conforme a openspec/config.yaml.

Aplicar TDD en cada grupo de comportamiento: primero la prueba que falla por la razón
esperada, después la implementación mínima y por último la refactorización. Los nombres
de archivos nuevos provienen del design y todavía no existen; las rutas de archivos
existentes fueron confirmadas por inspección. Toda evidencia debe ser un resultado real
ejecutado, nunca una afirmación anticipada.
-->

## 1. Preparación de fronteras y módulos

- [x] 1.1 Eliminar el bytecode obsoleto sin fuentes de `backend/src/purchasing/__pycache__/` y sus subdirectorios, verificando con `git status --short` que no se versiona nada y que ningún módulo real se pierde.
- [x] 1.2 Crear `backend/src/inventory/` con `__init__.py`, `apps.py`, `models.py` vacío de modelos y `migrations/__init__.py`; registrar la aplicación en `backend/src/config/settings/base.py` sin alterar el orden de las existentes.
- [x] 1.3 Crear `backend/src/purchasing/` con la misma estructura mínima y registrarla igualmente en `backend/src/config/settings/base.py`.
- [x] 1.4 Escribir en `backend/tests/inventory/test_boundaries.py` y `backend/tests/purchasing/test_boundaries.py` pruebas que fallen mientras las aplicaciones no existan y que prohíban importar modelos ajenos, ejecutar SQL de otros módulos y escribir en persistencia ajena.
- [x] 1.5 Sustituir en `backend/tests/catalog/test_boundaries.py` la prohibición absoluta de importar `catalog.application` por una lista blanca de interfaces públicas permitidas, conservando intactas las prohibiciones de modelos y escrituras ajenas.
- [x] 1.6 Crear los directorios de prueba `backend/tests/inventory/` y `backend/tests/purchasing/` (sin `__init__.py`: un paquete de pruebas `inventory`/`purchasing` ocultaría los módulos de `src`; se añadió `--import-mode=importlib` a pytest) y las fixtures mínimas reutilizando `backend/tests/conftest.py` y `backend/tests/fixtures/`.
- [x] 1.7 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_boundaries.py tests/purchasing/test_boundaries.py tests/catalog/test_boundaries.py` en verde y `uv run --frozen python manage.py check` sin errores.

## 2. Dominio puro de importes de compra

- [x] 2.1 Escribir en `backend/tests/purchasing/test_amounts.py` las pruebas que fallan para base = cantidad × costo con `Q2` HALF_UP, impuesto sobre la base ya redondeada y total = base + impuesto, usando los ejemplos exactos de la spec: 2 × 10.00 al 10 % produce 20.00/2.00/22.00.
- [x] 2.2 Añadir la prueba del redondeo por línea de la spec: dos líneas de 1 × 0.335 al 10 % producen base 0.34, impuesto 0.03 por línea y totales de documento 0.68 / 0.06 / 0.74.
- [x] 2.3 Añadir pruebas de valor inventariable: base cuando el impuesto es `RECOVERABLE` y base + impuesto cuando es `NON_RECOVERABLE`, sin admitir recuperación parcial ni clasificación ausente.
- [x] 2.4 Añadir pruebas de rechazo de cantidad cero, cantidad fraccionaria, costo negativo, costo con siete decimales, valores no finitos y exceso de rango, comprobando que no se trunca ni se redondea la entrada.
- [x] 2.5 Añadir la prueba de tarifa cero explícita aceptada con impuesto 0.00 frente a definición sin vigencia, que no debe convertirse en exención.
- [x] 2.6 Implementar `backend/src/purchasing/domain/amounts.py` con `Decimal`, contexto local de precisión 60 y sin importar Django, DRF ni persistencia, hasta que las pruebas anteriores pasen; refactorizar después sin cambiar resultados.
- [x] 2.7 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/purchasing/test_amounts.py` en verde y `uv run --frozen mypy src/purchasing` sin errores.

## 3. Dominio puro de valoración de inventario

- [x] 3.1 Escribir en `backend/tests/inventory/test_valuation.py` la prueba que falla del promedio ponderado de la spec: 10 unidades con valor 20.00 más entrada de 5 con valor 20.00 producen 15 unidades, valor 40.00 y promedio 2.666667.
- [x] 3.2 Añadir la prueba del residuo terminal: 3 unidades con valor 1.000000 y promedio 0.333333 salen de una en una por 0.333333, 0.333333 y 0.333334, dejando cantidad y valor cero.
- [x] 3.3 Añadir la prueba de la salida parcial acotada por `min(valor_conservado, nominal)`, comprobando que el ajuste de redondeo se registra como residuo técnico y que el promedio publicado no se recalcula.
- [x] 3.4 Añadir la prueba de entrada posterior al agotamiento: desde cantidad y valor cero, 2 unidades con valor 7.00 producen promedio 3.500000 sin arrastrar valor antiguo.
- [x] 3.5 Añadir la prueba de reversión exacta, que restituye cantidad, valor y promedio anteriores conservados en el movimiento original en lugar de valorar al promedio actual.
- [x] 3.6 Añadir pruebas de límites: cantidades grandes, costos muy pequeños que fuercen el acotamiento y secuencias largas de entradas y salidas alternadas sin pérdida oculta de valor.
- [x] 3.7 Implementar `backend/src/inventory/domain/valuation.py` y `backend/src/inventory/domain/validation.py` con `Decimal`, `Q6` HALF_UP y sin dependencias de framework, hasta que las pruebas pasen.
- [x] 3.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_valuation.py` en verde y `uv run --frozen mypy src/inventory` sin errores.

## 4. Persistencia de inventario, restricciones e historia inmutable

- [x] 4.1 Escribir en `backend/tests/inventory/test_models.py` pruebas que fallen para las restricciones de `InventoryPosition`: par producto/bodega único, cantidad y valor no negativos, cantidad de parte fraccionaria cero y cantidad cero que implica valor y promedio cero.
- [x] 4.2 Escribir pruebas de `InventoryOperation` e `InventoryOperationLine`: tipos `PURCHASE_RECEIPT`/`INITIAL_LOAD`/`ADJUSTMENT_IN`/`ADJUSTMENT_OUT`/`REVERSAL`, estados `PREPARED`/`POSTED`/`REVERSED`, origen `(source_type, source_id)` único y relación `reverses` única.
- [x] 4.3 Escribir pruebas de `InventoryMovement`: únicos `(position, ordinal)` y `(operation, product)`, cantidad positiva en un solo sentido, vínculo `reverses_movement` único y snapshots históricos de producto y unidad.
- [x] 4.4 Escribir la prueba de la restricción parcial que impide una segunda carga inicial por producto y bodega incluso después de compensarla.
- [x] 4.5 Implementar los modelos en `backend/src/inventory/models.py` con FK `PROTECT` y `related_name='+'` hacia catálogo, configuración y usuario, sin añadir campos inversos de stock al contrato de catálogo.
- [x] 4.6 Generar `backend/src/inventory/migrations/0001_initial.py` con tablas, constraints e índices `(position_id, ordinal)`, `(product_id, effective_at, ordinal)`, `(product_id, movement_type, ordinal)`, `(actor_id, effective_at, id)`, origen/operación y `(kind, state, created_at, id)`.
- [x] 4.7 Escribir en `backend/tests/inventory/test_history_protection.py` pruebas que fallen al intentar `UPDATE` y `DELETE` de movimientos y de líneas de operación `POSTED` tanto por ORM como por SQL directo, y que permitan la transición legítima a `REVERSED` con su relación compensatoria.
- [x] 4.8 Añadir la migración con los triggers PostgreSQL correspondientes, reversible y sin desactivación en producción, junto con QuerySets sin mutadores públicos.
- [x] 4.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_models.py tests/inventory/test_history_protection.py` en verde y `uv run --frozen python manage.py makemigrations --check --dry-run` sin cambios pendientes.

## 5. Persistencia de compras e identidad documental

- [x] 5.1 Escribir en `backend/tests/purchasing/test_models.py` pruebas que fallen para `PurchaseDocumentIdentity`: unicidad `(supplier, document_type, normalized_reference)` en los tipos documentados y una identidad propia por compra raíz en `SIN_DOCUMENTO`.
- [x] 5.2 Escribir pruebas de normalización `strip().upper()` que conserve ceros iniciales y puntuación significativa, incluida la comprobación de equivalencia de comparación Unicode en PostgreSQL igual que en los códigos del catálogo.
- [x] 5.3 Escribir pruebas de `Purchase`: estados `DRAFT`/`CONFIRMED`/`VOIDED`, unicidad parcial de identidad externa cuando el estado es `CONFIRMED`, número interno único cuando está informado y relación `replaces` hacia el antecedente.
- [x] 5.4 Escribir pruebas de `PurchaseLine` con posición de línea única por compra y snapshots congelados al confirmar, y de `PurchaseCommand` con unicidad actor/acción/clave.
- [x] 5.5 Implementar los modelos en `backend/src/purchasing/models.py`, con FK `PROTECT` hacia proveedor, producto, configuración y usuario, y esquema JSON de snapshots con clave de versión validada.
- [x] 5.6 Generar `backend/src/purchasing/migrations/0001_initial.py` con sus constraints e índices `(state, document_date, id)`, `(document_identity_id, id)`, `(document_date, id)`, `(purchase_id, position)` y `(product_id, purchase_id)`, sin ninguna FK de `inventory` hacia `purchasing`.
- [x] 5.7 Escribir en `backend/tests/purchasing/test_history_protection.py` las pruebas de los triggers que impiden alterar líneas y contenido económico después de confirmar, permitiendo solo los metadatos de anulación definidos, y añadir la migración correspondiente.
- [x] 5.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/purchasing/test_models.py tests/purchasing/test_history_protection.py` en verde y `uv run --frozen python manage.py makemigrations --check --dry-run` limpio.

## 6. Interfaces públicas de módulos existentes

- [x] 6.1 Escribir en `backend/tests/catalog/test_inventory_references.py` pruebas que fallen para referencias por IDs, búsqueda paginada y `lock_product_references(ids)` bajo transacción activa, comprobando que devuelve DTO congelados con código, nombre, presentación, unidad, estado y elección tributaria, y que no expone precio de venta cuando no se necesita.
- [x] 6.2 Implementar `backend/src/catalog/application/inventory_references.py` manteniendo los bloqueos y consultas de catálogo dentro de su propio módulo.
- [x] 6.3 Escribir pruebas en `backend/tests/supplier_registry/test_purchase_references.py` e implementar `backend/src/supplier_registry/application/purchase_references.py` con referencia de proveedor y `lock_supplier_reference(id)`, devolviendo nombre, identificación opcional, estado y versión sin exponer edición ni copiar contactos innecesarios.
- [x] 6.4 Escribir pruebas en `backend/tests/workshop_configuration/test_operation_context.py` e implementar `backend/src/workshop_configuration/application/operation_context.py` con contexto de bodega y entidad comercial, opciones de impuesto para una fecha documental, consulta de revisión sin usos y variante bloqueante para confirmación.
- [x] 6.5 Añadir a cada interfaz la prueba negativa que exige transacción exterior activa para las variantes bloqueantes y que rechaza DTO de bloqueo provenientes del cliente HTTP.
- [x] 6.6 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/catalog tests/supplier_registry tests/workshop_configuration` en verde, incluida la regresión de los módulos existentes.

## 7. Corrección del contrato transaccional de configuración (ADR-0004)

- [x] 7.1 Escribir en `backend/tests/workshop_configuration/` la prueba que falla exigiendo que `configuration_resolver.py` rechace su uso confirmado fuera de una transacción activa y que bloquee las `TaxDefinition` ordenadas por ID antes que sus períodos.
- [x] 7.2 Corregir `backend/src/workshop_configuration/application/configuration_resolver.py`: precondición transaccional, orden de bloqueos, resolución de una sola vigencia por fecha, devolución de snapshots inmutables y separación entre consulta de revisión sin usos y resolución para confirmación.
- [x] 7.3 Escribir pruebas y corregir `backend/src/workshop_configuration/application/taxes.py` para que `update_tax_period` y `schedule_successor` lean preliminarmente la definición, bloqueen esa raíz antes que los períodos y revaliden pertenencia, versión y usos dentro del bloqueo.
- [x] 7.4 Escribir pruebas y corregir `backend/src/workshop_configuration/application/series.py` para que la edición y sustitución bloqueen `NumberingScope` antes que `DocumentSeries` y revaliden relación y versión.
- [x] 7.5 Escribir pruebas y corregir `backend/src/workshop_configuration/application/numbering.py` para exigir transacción exterior antes de cualquier savepoint, obtener el ámbito por servicio público y usar la clave interna `purchase:<id>:confirm` distinta de la clave de transporte.
- [x] 7.6 Añadir la prueba de colisión de claves entre documentos que exige no devolver el número de otro documento aunque coincida una huella, y actualizar los tests existentes que invocan `allocate_number` fuera de transacción para que abran la transacción consumidora, endureciendo sus aserciones.
- [x] 7.7 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/workshop_configuration` en verde, confirmando que no cambia la API pública administrativa ni las reglas fiscales aprobadas.

## 8. Núcleo de publicación de inventario

- [x] 8.1 Escribir en `backend/tests/inventory/test_posting.py` las pruebas que fallan para `prepare`, `lock`, publicación de entradas y salidas y reversión exacta, exigiendo transacción exterior y contexto ya bloqueado.
- [x] 8.2 Añadir la prueba del orden total de recursos del design: recibo, identidad y operaciones, proveedor, referencias de catálogo, posiciones, contexto de configuración e inserciones finales, sin adquirir después recursos de grupos anteriores.
- [x] 8.3 Añadir pruebas de creación de posición inexistente bajo bloqueo del producto y de que las consultas nunca crean posiciones.
- [x] 8.4 Añadir la prueba de asignación de `ordinal` consecutivo por posición y de `effective_at` obtenido después de los bloqueos, que nunca retrocede respecto del último momento de esa posición.
- [x] 8.5 Añadir la prueba de agrupación por producto de las líneas de compra: cantidades y valores inventariables sumados en un único movimiento por producto, conservando el detalle en `PurchaseLine` e `InventoryOperationLine`.
- [x] 8.6 Añadir pruebas de stock insuficiente que fallan antes de valorar y de rechazo de saldo negativo dentro de la misma operación atómica.
- [x] 8.7 Implementar `backend/src/inventory/application/posting.py` (y `queries.py` con `get_position`; `operations.py` se implementa en el grupo 11 con las operaciones manuales; la traducción de conflictos vive en `backend/src/shared/transactions.py`) sobre el dominio puro del grupo 3, sin importar `purchasing` ni confirmar por separado.
- [x] 8.8 Añadir la traducción de errores de deadlock, serialización y timeout de bloqueo a conflicto reintentable solo después del rollback completo, con su prueba correspondiente.
- [x] 8.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_posting.py` en verde.

## 9. Compras: borradores, revisión y confirmación

- [ ] 9.1 Escribir en `backend/tests/purchasing/test_drafts.py` las pruebas que fallan para crear, editar y recuperar borradores sin efectos de stock, valoración, uso fiscal ni numeración, incluido el borrador sin líneas.
- [ ] 9.2 Añadir pruebas de edición concurrente del borrador con `expected_version`, que conservan una modificación y rechazan la desactualizada con `stale_record`.
- [ ] 9.3 Añadir pruebas de validación de referencias: proveedor y productos activos al guardar, rechazo de servicios como producto inventariable, proveedor ocasional válido y referencias inactivas legibles que impiden confirmar.
- [ ] 9.4 Escribir en `backend/tests/purchasing/test_review.py` las pruebas del token firmado de revisión: contenido con identificadores, digest y vencimiento de 15 minutos, sin costos ni datos de proveedor, ligado a actor y acción, y rechazo de token modificado, vencido o de otro actor.
- [ ] 9.5 Escribir en `backend/tests/purchasing/test_confirm.py` las pruebas de confirmación atómica: recepción completa de todas las líneas en la bodega comercial, número interno único de la serie COM-ING, movimientos vinculados, promedio actualizado y auditoría, todo en una sola transacción.
- [ ] 9.6 Añadir pruebas de fallos intermedios que exigen rollback de movimientos, uso fiscal, número, auditoría y recibo provisional, no solo del estado del documento.
- [ ] 9.7 Añadir pruebas de `review_required` cuando cambian importes o datos relevantes, de rechazo de fecha futura y de rechazo de totales impuestos por el cliente.
- [ ] 9.8 Añadir pruebas de configuración ausente o ámbito incorrecto que rechazan por completo con `configuration_missing` o `invalid_tax_scope`, sin valores inventados.
- [ ] 9.9 Implementar `backend/src/purchasing/application/purchases.py`, `commands.py`, `queries.py` y `errors.py` reutilizando `backend/src/shared/command_values.py` y el patrón de recibos de `backend/src/catalog/application/commands.py`.
- [ ] 9.10 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/purchasing/test_drafts.py tests/purchasing/test_review.py tests/purchasing/test_confirm.py` en verde.

## 10. Compras: identidad externa, duplicados, reemplazo y anulación

- [ ] 10.1 Escribir en `backend/tests/purchasing/test_document_identity.py` las pruebas de referencia repetida normalizada rechazada con `duplicate_supplier_document`, incluso frente a borradores y anulados, y de aceptación con otro proveedor o tipo.
- [ ] 10.2 Añadir pruebas de `SIN_DOCUMENTO`: explicación obligatoria, ausencia de número inventado, advertencia de coincidencias por proveedor, fecha, productos, cantidades e importes y exigencia de `acknowledged_matches` con los IDs revisados.
- [ ] 10.3 Añadir la prueba de nuevas coincidencias aparecidas entre revisión y confirmación, que exige una revisión nueva sin fusionar ni bloquear compras legítimas iguales.
- [ ] 10.4 Escribir en `backend/tests/purchasing/test_replacement.py` las pruebas de reemplazo vinculado: reutilización de la identidad externa solo con antecedente anulado, número interno nuevo, conservación de la cadena y rechazo cuando existe una confirmada vigente.
- [ ] 10.5 Escribir en `backend/tests/purchasing/test_void.py` las pruebas de anulación conservadora: restitución exacta de cantidad, valor y promedio previos, conservación del número, compensación vinculada y motivo obligatorio de 1 a 2000 caracteres no blancos.
- [ ] 10.6 Añadir pruebas de `unsafe_reversal` con movimiento posterior aunque haya stock suficiente, del bloqueo total cuando un solo producto tiene dependencia y de `inventory_inconsistent` ante discrepancia de saldos.
- [ ] 10.7 Añadir pruebas de anulación repetida que devuelve el estado anulado sin segunda compensación y de confirmación repetida sobre una compra ya anulada, que no la reactiva.
- [ ] 10.8 Implementar el reemplazo, la anulación con vista previa separada y sus errores en `backend/src/purchasing/application/purchases.py`.
- [ ] 10.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/purchasing/test_document_identity.py tests/purchasing/test_replacement.py tests/purchasing/test_void.py` en verde.

## 11. Inventario: carga inicial, ajustes y correcciones

- [ ] 11.1 Escribir en `backend/tests/inventory/test_initial_load.py` las pruebas de primera carga por producto sin historia: 8 unidades a costo 2.50 producen existencia 8 y valor 20.00 con origen `INITIAL_LOAD` y sin proveedor inventado.
- [ ] 11.2 Añadir pruebas de rechazo de carga inicial en productos con historia aunque estén agotados y en cargas ya compensadas, orientando al ajuste justificado.
- [ ] 11.3 Escribir en `backend/tests/inventory/test_adjustments.py` las pruebas de ajuste de salida por pérdida comprobada al promedio vigente, de entrada con costo inventariable explícito obligatorio y de rechazo por motivo o costo ausente.
- [ ] 11.4 Añadir pruebas del ciclo `PREPARED` → vista previa → confirmación: preparar y cancelar no cambian stock, confirmar revalida existencias y un cambio relevante desde la vista previa exige revisión actualizada.
- [ ] 11.5 Añadir pruebas de salida sobre producto inactivo con stock y de exigencia de producto activo para entradas nuevas.
- [ ] 11.6 Escribir en `backend/tests/inventory/test_corrections.py` las pruebas de reversión exacta del último efecto, de la reversión de una salida que agotó stock restituyendo su residuo y del bloqueo cuando existen movimientos posteriores.
- [ ] 11.7 Añadir la prueba del ajuste vinculado por diferencia física comprobada con `corrects_operation_id` a valoración vigente y la del rechazo de la corrección solo de costo mediante cantidad ficticia.
- [ ] 11.8 Añadir en `backend/tests/inventory/test_idempotency.py` las pruebas de repetición compatible con otra clave que devuelve la operación existente, de reutilización incompatible que responde `idempotency_conflict` y de fallo de auditoría que conserva el saldo previo.
- [ ] 11.9 Implementar los comandos manuales y `InventoryCommand` en `backend/src/inventory/application/commands.py` y `operations.py`.
- [ ] 11.10 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_initial_load.py tests/inventory/test_adjustments.py tests/inventory/test_corrections.py tests/inventory/test_idempotency.py` en verde.

## 12. Consultas de existencias y Kardex estable

- [ ] 12.1 Escribir en `backend/tests/inventory/test_stock_queries.py` las pruebas de la lista de existencias: búsqueda por código interno, código de fabricante y nombre sin distinguir mayúsculas, filtros `category_id`, `is_active` y `stock` combinados por intersección, total correcto y orden estable.
- [ ] 12.2 Añadir pruebas de la consulta inicial que incluye activos e inactivos con saldo o historia, del filtro explícito de inactivos y del producto sin movimientos que proyecta cero real sin crear posición.
- [ ] 12.3 Escribir en `backend/tests/inventory/test_kardex.py` las pruebas del corte: transacción corta `REPEATABLE READ` configurada antes de la primera consulta, `cut_token` firmado ligado a producto, bodega y filtros con expiración de 30 minutos, y conflicto ante token vencido o incompatible.
- [ ] 12.4 Añadir la prueba de saldos del período de la spec: saldo anterior 10, entrada 5, salida 3, saldos de fila 15 y 12 y saldo final 12.
- [ ] 12.5 Añadir la prueba del filtro que oculta una entrada: mostrar la salida con saldo real 12, saldo anterior 10 y final 12, sin presentar 7 como existencia, con `period_totals` y `matching_totals` separados.
- [ ] 12.6 Añadir las pruebas de paginación: segunda página con saldo 14 y `page_opening_quantity` 12; página filtrada con intermedios ocultos que muestra saldo 7 y anterior 3; recorrido completo que devuelve cada coincidencia exactamente una vez.
- [ ] 12.7 Añadir las pruebas de período sin movimientos, de filtro sin coincidencias con período con efectos, de `page_opening_quantity` nulo sin filas y de producto sin movimientos con saldos cero confirmados.
- [ ] 12.8 Añadir pruebas de rangos de fecha inclusivos por día local de America/Guayaquil convertidos a intervalo UTC `[inicio, día posterior al fin)`, de límites unilaterales y de rango invertido, filtro desconocido o paginación inválida que producen error corregible.
- [ ] 12.9 Añadir la prueba de horas coincidentes que conserva el orden por ordinal y la prueba de ausencia de consultas N+1 en filas y resúmenes.
- [ ] 12.10 Implementar `backend/src/inventory/application/queries.py` con las proyecciones por lista blanca y los snapshots históricos de presentación y unidad.
- [ ] 12.11 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_stock_queries.py tests/inventory/test_kardex.py` en verde.

## 13. API HTTP de compras

- [ ] 13.1 Escribir en `backend/tests/purchasing/test_api.py` las pruebas que fallan para `GET`/`POST` `purchases/` y `GET`/`PATCH` `purchases/<id>/` con los permisos `ingresos.ver` e `ingresos.crear`, incluidos los códigos 200 y 201 esperados.
- [ ] 13.2 Añadir pruebas de `POST` `purchases/<id>/preview/` y `confirm/` con `ingresos.confirmar`, exigiendo `idempotency_key`, `expected_version`, `review_token` y `acknowledged_matches` cuando aplique.
- [ ] 13.3 Añadir pruebas de `POST` `purchases/<id>/void-preview/`, `void/` y `replacement/` con sus permisos respectivos y el `reason` obligatorio en las anulaciones.
- [ ] 13.4 Añadir pruebas de `GET` `purchases/tax-options/` con ámbito comercial fijo y `document_date` requerida, comprobando que no modifica configuración.
- [ ] 13.5 Añadir pruebas del contrato de campos: `PATCH` que distingue omitir de vaciar y sustituye la colección completa de líneas conservando orden, máximo de 200 líneas, referencia de 128 caracteres y textos de 2000, y `unknown_field` ante campos ajenos.
- [ ] 13.6 Añadir pruebas de listas `{count,page,page_size,total_pages,results}` con página inicial 1, tamaño 20 y máximo 100, filtros `search`, `supplier_id`, `state`, `date_from`, `date_to` y orden `-document_date,-id`.
- [ ] 13.7 Añadir pruebas de errores con `problem_response`: 400 de validación, 403 por sesión, CSRF o permiso, 404 tras autorizar, y los 409 `stale_record`, `review_required`, `duplicate_supplier_document`, `idempotency_conflict` y `concurrent_operation`, con campos de línea como `lines.2.quantity`.
- [ ] 13.8 Implementar `backend/src/purchasing/api/serializers.py`, `views.py` y `urls.py` delgados y montarlos en `backend/src/config/api/urls.py` bajo `/api/v1/`.
- [ ] 13.9 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/purchasing/test_api.py` en verde.

## 14. API HTTP de inventario y Kardex

- [ ] 14.1 Escribir en `backend/tests/inventory/test_api.py` las pruebas de `GET` `inventory/` e `inventory/products/<id>/` con `inventario.ver`, devolviendo valoración únicamente con `inventario.ver_valorizacion`.
- [ ] 14.2 Añadir pruebas de `GET` `inventory/products/<id>/kardex/` con filtros `date_from`, `date_to`, `movement_type`, `source_type`, `source_id`, `actor_id`, `page`, `page_size` y `cut_token`, y con la envoltura ampliada `{cut, opening_quantity, closing_quantity, period_totals, matching_totals, page_opening_quantity}`.
- [ ] 14.3 Añadir pruebas de `GET`/`POST` `inventory/operations/` y `PATCH` `inventory/operations/<id>/` con `inventario.ajustar`, rechazando `PURCHASE_RECEIPT` y `REVERSAL` enviados libremente y permitiendo editar solo `PREPARED`.
- [ ] 14.4 Añadir pruebas de `POST` `inventory/operations/<id>/preview/`, `confirm/`, `reverse-preview/` y `reverse/`, incluida la que exige que una operación originada en compra rechace el `reverse` manual y remita a la anulación de compra.
- [ ] 14.5 Añadir pruebas de `GET` `inventory/operations/<id>/` con proyección operativa sin datos privados y proyección económica solo con permiso.
- [ ] 14.6 Añadir pruebas de rechazo de cambio de bodega o entidad por el cliente, con `unknown_field`, y de los 409 `insufficient_stock`, `already_initialized`, `unsafe_reversal` e `inventory_inconsistent`.
- [ ] 14.7 Implementar `backend/src/inventory/api/serializers.py`, `views.py` y `urls.py` y montarlos en `backend/src/config/api/urls.py`.
- [ ] 14.8 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_api.py` en verde.

## 15. Autorización, proyecciones y ausencia de filtraciones

- [ ] 15.1 Escribir en `backend/tests/purchasing/test_authorization.py` y `backend/tests/inventory/test_authorization.py` las pruebas de cada método y ruta con los tres roles y sus combinaciones acumuladas.
- [ ] 15.2 Añadir la prueba de sesión invalidada al retirar Administrador a un usuario con varios roles, que exige autenticarse de nuevo y aplica solo los permisos vigentes.
- [ ] 15.3 Añadir pruebas recursivas que recorren toda la respuesta operativa comprobando la ausencia de `unit_cost`, `average_cost`, `inventory_value`, impuestos, totales de compra, `rounding_adjustment` y datos de proveedor, incluidas referencias anidadas, mensajes de error y recibos.
- [ ] 15.4 Añadir la prueba de que `inventario.ver` no concede `ingresos.ver`: el origen operativo muestra tipo y referencia interna, y `origin_url` solo aparece con permiso para abrirlo.
- [ ] 15.5 Añadir la prueba de que ningún parámetro de consulta eleva la proyección y de que la autorización vigente se comprueba antes de cualquier replay idempotente.
- [ ] 15.6 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/purchasing/test_authorization.py tests/inventory/test_authorization.py` en verde.

## 16. Concurrencia real sobre PostgreSQL

- [ ] 16.1 Crear `backend/tests/inventory/test_concurrency.py` y `backend/tests/purchasing/test_concurrency.py` con `pytest.mark.django_db(transaction=True)`, conexiones independientes por worker, cierre explícito de conexiones y barreras con timeout antes de adquirir el recurso competido.
- [ ] 16.2 Escribir la prueba de dos salidas de 4 sobre existencia 5: como máximo una confirma, el saldo queda en 1 y la otra falla por conflicto o insuficiencia sin saldo parcial.
- [ ] 16.3 Escribir la prueba de entrada de 3 y salida de 4 concurrentes sobre existencia 2, que admite saldo 1 o saldo 5 pero nunca negativo.
- [ ] 16.4 Escribir la prueba de dos cargas iniciales simultáneas del mismo producto, que acepta como máximo una.
- [ ] 16.5 Escribir las pruebas de confirmación repetida con la misma clave y con clave distinta, de altas duplicadas simultáneas con igual proveedor, tipo y referencia, y de dos reemplazos del mismo documento anulado.
- [ ] 16.6 Escribir la prueba de anulación y salida simultáneas del mismo producto y la de dos anulaciones competidoras, que producen una sola compensación.
- [ ] 16.7 Escribir las pruebas de baja concurrente de proveedor o producto frente a confirmación, y de edición o sucesión de definiciones fiscales y series frente a confirmación.
- [ ] 16.8 Escribir la prueba de dos operaciones con varios productos solicitados en orden inverso, que demuestra ausencia de ciclos de bloqueo en lugar de apoyarse en la traducción de deadlocks.
- [ ] 16.9 Añadir la prueba del Kardex consultado mientras otro usuario confirma, que mantiene filas y resúmenes del mismo corte, afirmando en todas ellas el número exacto de éxitos y errores, los saldos, valores, movimientos, números, usos y auditoría resultantes.
- [ ] 16.10 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_concurrency.py tests/purchasing/test_concurrency.py` en verde contra PostgreSQL real, con los workers terminados.

## 17. Comando de reconciliación

- [ ] 17.1 Escribir en `backend/tests/inventory/test_reconcile.py` las pruebas que fallan para la reconstrucción de cantidad y valor desde movimientos originales e inversos, la verificación de la cadena anterior/posterior, ordinales, promedio y posición.
- [ ] 17.2 Añadir pruebas de verificación de compras confirmadas con sus efectos y de anulaciones con su compensación, y de posiciones vacías sin movimientos que concilian a cero sin crear stock.
- [ ] 17.3 Añadir la prueba del código de salida distinto de cero cuando existen diferencias y del comportamiento de solo lectura, sin `--fix` ni modificación de historia.
- [ ] 17.4 Implementar `backend/src/inventory/management/commands/reconcile_inventory.py` abriendo una transacción de lectura al comienzo para obtener consistencia.
- [ ] 17.5 Evidencia del grupo: `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_reconcile.py` en verde y ejecución manual del comando sobre datos de prueba con salida registrada.

## 18. Contrato OpenAPI

- [ ] 18.1 Añadir las anotaciones necesarias en las vistas de `purchasing` e `inventory` para que el esquema describa rutas, permisos, parámetros, envolturas paginadas, campos decimales como cadenas y los códigos de error definidos.
- [ ] 18.2 Regenerar `backend/schema.yml` y revisar el diff para confirmar que no cambian contratos de identidad, clientes, configuración ni catálogos.
- [ ] 18.3 Documentar en el esquema los límites publicados de 200 líneas, 128 caracteres de referencia y 2000 de observación o motivo.
- [ ] 18.4 Evidencia del grupo: `cd backend && uv run --frozen python manage.py spectacular --validate` sin errores y diff de `backend/schema.yml` revisado.

## 19. Frontend: base de las funcionalidades

- [ ] 19.1 Crear `frontend/src/features/purchases/types.ts` y `frontend/src/features/inventory/types.ts` con los contratos del backend, conservando los decimales como cadenas y sin convertirlos a `number` para cálculos.
- [ ] 19.2 Escribir pruebas en `frontend/src/features/purchases/api.test.ts` y `frontend/src/features/inventory/api.test.ts` e implementar sus `api.ts` sobre `frontend/src/shared/api/client.ts`.
- [ ] 19.3 Escribir pruebas e implementar `hooks.ts` de ambas funcionalidades con TanStack Query, usando `frontend/src/shared/api/idempotency.ts` para las mutaciones, sin reintentos automáticos y reenviando el mismo payload y clave tras un timeout.
- [ ] 19.4 Añadir la prueba de invalidación tras una mutación propia: compras, operaciones, fichas de inventario y Kardex de los productos afectados, solicitando un corte nuevo.
- [ ] 19.5 Añadir la prueba de que una respuesta de vista previa antigua no reemplaza la revisión de una edición más reciente.
- [ ] 19.6 Añadir las rutas `/purchases`, `/purchases/new`, `/purchases/:id`, `/purchases/:id/edit`, `/inventory`, `/inventory/products/:id/kardex` e `/inventory/operations/:id` en `frontend/src/app/App.tsx` y sus accesos por permiso en `AuthenticatedShell.tsx`, con pruebas de navegación autorizada.
- [ ] 19.7 Evidencia del grupo: `cd frontend && npm test` en verde para los archivos nuevos y `npm run typecheck` sin errores.

## 20. Frontend: pantallas de compras

- [ ] 20.1 Escribir pruebas e implementar `frontend/src/pages/purchases/PurchasesPage.tsx` con `PageHeader`, `ElevatedDataList`, `Pagination`, `StatusBadge` e `InlineNotice`, filtros de proveedor, estado y período en la URL y conservación al volver del detalle.
- [ ] 20.2 Escribir pruebas e implementar el editor de líneas en `frontend/src/features/purchases/`, con `Field`, `Input` y `Select`, clasificación de recuperabilidad por línea y conservación de las cadenas decimales tal como se capturan.
- [ ] 20.3 Añadir el selector de productos y proveedores que consulta todas las páginas necesarias, conserva los seleccionados, etiqueta las referencias inactivas e impide incorporarlas como líneas nuevas explicando el bloqueo de confirmación.
- [ ] 20.4 Escribir pruebas e implementar la revisión previa a confirmar: importes obtenidos del backend, nunca cálculos JavaScript presentados como definitivos, y diálogo que nombra productos, cantidades y efecto sobre el stock.
- [ ] 20.5 Añadir el manejo de `review_required` y `stale_record` que conserva la entrada del usuario y ofrece revisar o recargar sin sobrescritura automática.
- [ ] 20.6 Escribir pruebas e implementar `frontend/src/pages/purchases/PurchaseDetailPage.tsx` con fechas diferenciadas, estado, ámbito fiscal, totales, líneas históricas, enlaces a operaciones, antecedente y reemplazos, y metadatos de anulación.
- [ ] 20.7 Añadir los diálogos de anulación y de reemplazo con motivo obligatorio, vista previa del efecto y explicación del producto y origen que bloquean una anulación insegura.
- [ ] 20.8 Añadir pruebas de estados reales de carga, vacío, error y éxito, de errores asociados a campos, de prevención de envío duplicado y de aviso de cambios sin guardar.
- [ ] 20.9 Evidencia del grupo: `cd frontend && npm test -- src/pages/purchases src/features/purchases` en verde.

## 21. Frontend: pantallas de inventario, ajustes y Kardex

- [ ] 21.1 Escribir pruebas e implementar `frontend/src/pages/inventory/InventoryPage.tsx` con búsqueda, filtros de categoría, estado y existencias en la URL, paginación, presentación y unidad, e identificación clara del stock cero sin umbrales ficticios.
- [ ] 21.2 Añadir la prueba de que un fallo de consulta muestra un error recuperable en lugar de presentar cero como saldo confirmado.
- [ ] 21.3 Escribir pruebas e implementar el formulario de carga inicial y ajuste en un Drawer, con motivo obligatorio, costo explícito solo en entradas, vista previa del efecto y confirmación explícita, sin superponer dos trampas de foco.
- [ ] 21.4 Escribir pruebas e implementar `frontend/src/pages/inventory/KardexPage.tsx` con filtros de período, tipo, origen y usuario, columnas de entrada, salida, saldo y responsable, y distinción visible entre saldos del período y totales de coincidencias.
- [ ] 21.5 Añadir la conservación del corte que el usuario está leyendo hasta un refresco explícito, con aviso de que existen cambios y sin mezclar filas antiguas con resúmenes nuevos.
- [ ] 21.6 Añadir las columnas económicas condicionadas al permiso de valoración y la prueba de que la interfaz operativa nunca las solicita ni las muestra.
- [ ] 21.7 Escribir pruebas e implementar `frontend/src/pages/inventory/InventoryOperationDetailPage.tsx` con el vínculo entre original y compensación y el enlace al origen solo cuando está autorizado.
- [ ] 21.8 Añadir la vista de líneas como grupos etiquetados en ancho móvil, con totales accesibles y targets táctiles existentes.
- [ ] 21.9 Evidencia del grupo: `cd frontend && npm test -- src/pages/inventory src/features/inventory` en verde.

## 22. Frontend: integración con catálogo

- [ ] 22.1 Escribir la prueba e integrar en `frontend/src/pages/products/ProductDetailPage.tsx` la consulta separada de inventario y el enlace autorizado al Kardex, sin ampliar el serializer de catálogo ni habilitar edición de saldo.
- [ ] 22.2 Añadir la prueba de navegación de ida y vuelta entre ficha de producto e inventario que conserva identidad y contexto.
- [ ] 22.3 Corregir los textos de catálogo que afirman que la ficha no ofrece existencias, limitando el cambio a esta integración.
- [ ] 22.4 Añadir la prueba de que las tablas administrativas distinguen visiblemente el precio de compra y la valoración del precio final de venta.
- [ ] 22.5 Verificar que al cerrar sesión se limpian las cachés con costos, con su prueba correspondiente.
- [ ] 22.6 Evidencia del grupo: `cd frontend && npm test -- src/pages/products` en verde, sin regresión de las pruebas de catálogo existentes.

## 23. Pruebas extremo a extremo y accesibilidad

- [ ] 23.1 Crear `frontend/e2e/purchases-inventory.spec.ts` reutilizando `frontend/e2e/helpers.ts` y `frontend/e2e/accessibility.ts`, con el flujo completo contra la API real: borrador, revisión de importes, confirmación y verificación del Kardex.
- [ ] 23.2 Añadir el escenario de doble envío y timeout que no duplica efectos y consulta el estado vigente tras el replay.
- [ ] 23.3 Añadir los escenarios de stock insuficiente y de anulación bloqueada por movimientos posteriores, comprobando los mensajes que identifican producto y dependencia.
- [ ] 23.4 Añadir el escenario de filtros conservados al volver de un detalle y el de cambio de página del Kardex que mantiene el corte.
- [ ] 23.5 Añadir comprobaciones de foco de retorno al cerrar diálogos, navegación por teclado, `reduced-motion` y verificación axe sin violaciones nuevas.
- [ ] 23.6 Capturar evidencia visual a 360, 768, 1024 y 1440 y en los cortes de navegación 1279 y 1280, dejando constancia de que la validación técnica no sustituye la aceptación visual humana de los nuevos baselines.
- [ ] 23.7 Evidencia del grupo: `cd frontend && npm run test:e2e -- e2e/purchases-inventory.spec.ts` en verde, con las capturas registradas.

## 24. Migraciones y tratamiento de datos existentes

- [ ] 24.1 Confirmar al generar las migraciones los nombres reales de las dependencias `catalog`, `supplier_registry`, `workshop_configuration` y del usuario swappable, en lugar de asumir los inspeccionados durante el diseño.
- [ ] 24.2 Ejecutar las migraciones sobre una base PostgreSQL limpia y comprobar tablas, constraints, índices y triggers creados.
- [ ] 24.3 Ejecutar las migraciones sobre una copia desechable con identidad, clientes, configuración y catálogos, comprobando conteos e identidades anteriores intactos y la reversibilidad técnica antes de cualquier dato real.
- [ ] 24.4 Comprobar explícitamente que no se siembran productos, compras, saldos, tarifas, proveedores ni posiciones, y que una ficha sin movimientos proyecta cero real sin migración masiva.
- [ ] 24.5 Documentar el procedimiento de detención, inventario y reconciliación si aparecen tablas o saldos previos ajenos al esquema previsto, sin importarlos automáticamente ni duplicarlos mediante carga inicial.
- [ ] 24.6 Evidencia del grupo: `cd backend && uv run --frozen python manage.py migrate` correcto en ambos ensayos y `uv run --frozen python manage.py makemigrations --check --dry-run` sin cambios pendientes.

## 25. Documentación, trazabilidad y ADR

- [ ] 25.1 Crear `docs/negocio/requisitos/cobertura-compras-inventario.md` y su `cobertura-compras-inventario-glossary-reference.md` con una fila por cada uno de los 105 escenarios, identificada por capacidad, requisito y título, con la prueba exacta, el comando, el resultado y el límite real; no marcar cubierto por la sola existencia de un test.
- [ ] 25.2 Actualizar `docs/arquitectura/modelo-datos.md` con las tablas, restricciones, índices y triggers realmente creados, sin anticipar capacidades futuras.
- [ ] 25.3 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` y `requisitos-funcionales.md` registrando RF-INV-011 y las evidencias adjuntas como cobertura parcial pendiente, sin declarar todo RF-INV implementado.
- [ ] 25.4 Registrar como aprobadas en `docs/negocio/decisiones/decisiones-confirmadas.yaml` las concreciones de IVA por línea, redondeo HALF_UP por línea y fecha documental como fecha operativa tributaria, conservando las demás exclusiones como pendientes.
- [ ] 25.5 Crear `docs/adr/0005-publicacion-transaccional-inventario.md` y su referencia terminológica con el contexto, la decisión, las alternativas descartadas y las consecuencias descritas en el design, complementando ADR-0001 y ADR-0004 sin reemplazarlos.
- [ ] 25.6 Actualizar `docs/tecnico/arquitectura-inicial.md` y `README.md` con las nuevas fronteras internas, corrigiendo la descripción obsoleta de un bootstrap sin dominio; `docs/architecture/` de contenedores no cambia.
- [ ] 25.7 Actualizar los glosarios y referencias terminológicas afectados con los términos incorporados por esta capacidad.
- [ ] 25.8 Evidencia del grupo: `openspec validate gestionar-compras-entradas-inventario-kardex --strict --no-interactive` sin errores y revisión manual de los enlaces locales de los documentos tocados.

## 26. Verificación final y cierre del cambio

- [ ] 26.1 Ejecutar `make check` completo y registrar el resultado real de formato, lint, tipos, `manage.py check`, comprobación de migraciones, pruebas backend, comprobaciones frontend y `compose-check`.
- [ ] 26.2 Ejecutar `make test` y confirmar que la cobertura global no baja; `--no-cov` solo se usó en los ciclos enfocados.
- [ ] 26.3 Ejecutar `make audit` y registrar el resultado, comprobando que no se añadieron dependencias y que `uv.lock` y `package-lock.json` permanecen coherentes.
- [ ] 26.4 Ejecutar la regresión de los módulos anteriores: `cd backend && uv run --frozen pytest tests/identity tests/customer_registry tests/catalog tests/supplier_registry tests/workshop_configuration tests/api` y registrar cualquier fallo preexistente sin atribuirlo a este cambio.
- [ ] 26.5 Ejecutar `openspec validate --all --strict --no-interactive` y `git diff --check`, revisando además que no se versionan secretos, datos, cachés ni artefactos generados.
- [ ] 26.6 Ejecutar `reconcile_inventory` sobre el entorno de prueba y comprobar diferencia cero antes de dar el cambio por aplicado.
- [ ] 26.7 Informar los comandos ejecutados y sus resultados reales, junto con el trabajo pendiente y las limitaciones, y solicitar autorización explícita antes de cualquier operación Git, despliegue o archivo del cambio.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
