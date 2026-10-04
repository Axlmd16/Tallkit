## 1. Preparación y línea base focalizada

Dependencias: propuesta, specs y diseño aprobados y registrados en `master`, conforme a `AGENTS.md`.

Por instrucción del usuario se ejecutan solo pruebas focalizadas. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde. No se ejecutan `make check`, `make test`, pytest completo, Vitest completo ni Playwright completo; el resumen final indica qué no se ejecutó.

- [x] 1.1 Comprobar `git status --short`, la rama vigente y que este cambio esté en `master` sin modificaciones pendientes. Registrar cambios ajenos en las rutas afectadas; no crear ramas ni merges sin autorización.
- [x] 1.2 Tomar un respaldo de la base de desarrollo antes de migrar y anotar su ubicación, porque la reversión deja de ser posible cuando existan entradas `SIMPLE` o movimientos sin costo (diseño, Migration Plan).
- [x] 1.3 Ejecutar y registrar la línea base: `cd backend && uv run --frozen pytest --no-cov tests/purchasing tests/inventory tests/supplier_registry tests/sales/test_confirm.py tests/sales/test_allocation.py tests/sales/test_returns.py tests/identity/test_authorization.py` y `cd frontend && npx vitest run src/pages/purchases src/features/purchases src/app/purchases-inventory-routes.test.tsx`.
- [x] 1.4 Leer `backend/src/purchasing/migrations/0002_history_protection.py` e `inventory/migrations/0002_history_protection.py` y anotar qué columnas protegen los triggers, para decidir en 2.x y 4.x si las migraciones deben ajustarlos.
- [x] 1.5 Añadir a `docs/negocio/requisitos/cobertura-compras-inventario.md` una matriz pendiente que relacione cada requirement y escenario de las cinco specs delta con los grupos y archivos de prueba de este checklist.

Evidencia del grupo: estado Git, respaldo anotado, comandos de línea base con resultado real, hallazgos de los triggers y matriz de cobertura pendiente.

## 2. Valoración con costo ausente (dominio e inventario)

Dependencias: grupo 1. Diseño 2, 3 y 9; spec `existencias-y-ajustes-de-inventario`, «Valoración por promedio ponderado y conservación de valor».

- [x] 2.1 Escribir primero en `backend/tests/inventory/test_valuation.py` casos rojos para `Position.valued` y `apply_entry`: con costo sobre posición valorada o vacía (sin regresión), con costo sobre posición sin costo (regularización y `regularization_value`), sin costo sobre posición valorada (promedio intacto, residuo conservado), sin costo sobre vacía con último promedio y sin costo sin promedio previo.
- [x] 2.2 Añadir casos rojos para `apply_exit` desde una posición sin costo (valor cero, permanece sin costo, vuelve a vacía al agotarse) y para `reverse_exactly` comparando y restituyendo `valued`.
- [x] 2.3 Implementar las reglas en `backend/src/inventory/domain/valuation.py` sin dependencias de Django; hacer pasar 2.1–2.2 y refactorizar.
- [x] 2.4 Crear la migración `inventory` 0006: `InventoryPosition.valued` e `InventoryMovement.cost_known`, `valued_before`, `valued_after` y `regularization_value`, con valores por defecto y sin relleno; ajustar los triggers según 1.4. Ampliar `tests/inventory/test_models.py` y `test_history_protection.py`.
- [x] 2.5 Escribir primero en `tests/inventory/test_posting.py` casos rojos: `EntryLine.value = None` aceptado solo para `PURCHASE_RECEIPT` y `CUSTOMER_RETURN_IN` y rechazado en carga inicial y ajustes; movimientos con las banderas correctas; derivación del último promedio conocido desde el movimiento vigente más reciente; y reversión exacta de una entrada sin costo y de una regularización.
- [x] 2.6 Implementar en `backend/src/inventory/application/posting.py` la entrada sin costo, la derivación del último promedio y el registro de banderas y regularización; hacer pasar 2.5.
- [x] 2.7 Extender `reconciliation.py` y `tests/inventory/test_reconcile.py` para reproducir las reglas, y `tests/inventory/test_concurrency.py` con dos entradas simultáneas del mismo producto, una con costo y otra sin costo.
- [x] 2.8 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/inventory`, Ruff sobre los archivos tocados y mypy sobre `src/inventory`.

Evidencia del grupo: rojo y verde registrados, migración aplicada y revertida en desarrollo, conciliación sin discrepancias y regresión de inventario en verde.

## 3. Consultas de existencias y Kardex con costo ausente

Dependencias: grupo 2. Diseño 3 y 6; specs `existencias-y-ajustes-de-inventario` y `kardex-de-productos`, «Costos de Kardex según autorización».

- [x] 3.1 Escribir primero en `tests/inventory/test_stock_queries.py` casos rojos: el Administrador identifica productos sin costo registrado; el valor total los excluye e informa cuántos quedan fuera; el Vendedor y el Encargado no reciben ninguna indicación de costo.
- [x] 3.2 Escribir primero en `tests/inventory/test_kardex.py` casos rojos: movimiento sin costo mostrado como tal y no como cero, saldo valorizado no disponible en ese tramo, regularización visible para el Administrador y ausencia de campos económicos para roles operativos.
- [x] 3.3 Implementar la proyección en `backend/src/inventory/application/queries.py` y `api/serializers.py` mediante una única función que distinga costo cero de costo ausente; hacer pasar 3.1–3.2.
- [x] 3.4 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/inventory/test_stock_queries.py tests/inventory/test_kardex.py tests/inventory/test_api.py tests/inventory/test_authorization.py`.

Evidencia del grupo: proyecciones por rol probadas en positivo y negativo, sin filtración en resúmenes ni errores.

## 4. Modelo y permisos de la entrada de stock

Dependencias: grupo 1. Diseño 1 y 6; spec `compras-e-ingresos-de-mercaderia`, «Autorización de compras por operación» y «Compras anteriores de solo lectura».

- [x] 4.1 Escribir primero en `tests/purchasing/test_models.py` casos rojos para `flow`, los campos opcionales, `supplier`, `external_reference`, `content_signature`, `confirmed_on` y las restricciones CHECK por flujo (`SIMPLE` sin identidad, fecha documental, reemplazo ni borrador; `LEGACY` con sus exigencias actuales).
- [x] 4.2 Crear la migración `purchasing` 0003 con esos cambios, el índice por firma y día y `flow = LEGACY` para las filas existentes; ajustar los triggers según 1.4 y ampliar `tests/purchasing/test_history_protection.py`.
- [x] 4.3 Escribir primero en `tests/identity/test_authorization.py` casos rojos: el Vendedor posee `ingresos.ver`, `ingresos.crear` e `ingresos.confirmar` y no `ingresos.anular`, `productos.ver_costos` ni `inventario.ver_valorizacion`; el Encargado del taller no posee ninguno de `ingresos.*`. Después actualizar `backend/src/identity/domain/authorization.py`.
- [x] 4.4 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/purchasing/test_models.py tests/purchasing/test_history_protection.py tests/identity/test_authorization.py tests/identity/test_api_permissions.py`.

Evidencia del grupo: migración aplicada y revertida en desarrollo con las compras existentes intactas, y matriz de permisos por rol en verde. Deuda de tipos que se saldó en los grupos 5 y 6: al admitir nulo `document_date`, `document_identity`, `unit_cost`, `tax_definition` y `tax_treatment`, `mypy` falla en `purchasing/application/purchases.py` y `queries.py`; se salda al retirar el código de escritura (5.7) y reescribir las lecturas (6.4), y no se registra un commit hasta que `mypy` vuelva a pasar.

## 5. Registro, revisión y anulación de entradas (backend)

Dependencias: grupos 2 y 4. Diseño 4 y 5; spec `compras-e-ingresos-de-mercaderia`.

- [x] 5.1 Crear `backend/tests/purchasing/test_entries.py` con casos rojos del flujo principal: entrada mínima sin proveedor ni costo, entrada con proveedor, referencia, observación y costos, líneas con y sin costo, costo cero explícito distinto de ausente, numeración COM-ING continua tras una compra anterior y momento efectivo asignado por el sistema.
- [x] 5.2 Añadir casos rojos de validación sin efectos parciales: sin líneas, producto repetido, cantidad cero o fraccionaria, costo negativo o con siete decimales, producto inactivo, servicio, proveedor inactivo o inexistente, campos desconocidos y configuración ausente de bodega o serie.
- [x] 5.3 Añadir casos rojos de idempotencia y concurrencia: reintento compatible devuelve la misma entrada, misma clave con otro contenido responde conflicto, falla intermedia no deja número ni movimientos, dos entradas simultáneas del mismo producto y baja concurrente de un producto.
- [x] 5.4 Añadir casos rojos de duplicado: coincidencia exacta el mismo día de America/Guayaquil sin reconocimiento responde `possible_duplicate` sin efectos; con `acknowledged_entry_ids` confirma; una entrada anulada o de otro día no coincide; la advertencia no revela costos.
- [x] 5.5 Implementar `register_entry` y `review_entry` en `backend/src/purchasing/application/` con el orden total de bloqueos de ADR-0005 y el recibo `PurchaseCommand`; hacer pasar 5.1–5.4 y refactorizar.
- [x] 5.6 Ampliar `tests/purchasing/test_void.py` con casos rojos: anulación de una entrada sin costo restituye existencia y estado sin costo; anulación de una regularización; el Vendedor no puede anular; compras anteriores siguen anulándose. Ajustar `void_purchase` hasta el verde.
- [x] 5.7 Retirar el código de escritura del flujo anterior (crear y editar borrador, vista previa, confirmación, reemplazo y opciones de impuesto) y sus pruebas (`test_drafts.py`, `test_review.py`, `test_confirm.py`, `test_replacement.py`, `test_document_identity.py`, `test_amounts.py`), conservando o trasladando las aserciones que sigan vigentes. Añadir pruebas de que un borrador anterior no puede confirmarse ni editarse.
- [x] 5.8 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/purchasing`, Ruff sobre los archivos tocados y mypy sobre `src/purchasing`.

Evidencia del grupo: rojo y verde registrados, atomicidad e idempotencia probadas y ausencia de rutas de escritura del flujo anterior.

## 6. API de entradas y proyección por rol

Dependencias: grupo 5. Diseño 5 y 6; specs `compras-e-ingresos-de-mercaderia` («Consulta y experiencia de compras») y `kardex-de-productos` («Acceso al origen y correcciones enlazadas»).

- [x] 6.1 Escribir primero en `tests/purchasing/test_api.py` y `test_authorization.py` casos rojos para `POST /api/v1/purchases/entries/review/` y `POST /api/v1/purchases/entries/` por rol, incluida la unión de roles y la sesión invalidada, y para la respuesta 404 o 405 de las seis rutas retiradas.
- [x] 6.2 Añadir casos rojos de lista y detalle: filtros `state`, período de confirmación, `registered_by` y búsqueda; orden estable del más reciente al más antiguo; usuarios disponibles para el filtro sin `usuarios.ver`; y columnas de número, momento, usuario, productos, unidades y estado.
- [x] 6.3 Añadir casos rojos de proyección: el Vendedor no recibe costos, valores, impuestos, totales ni identificación del proveedor en lista, detalle, compras anteriores, advertencias o errores, ni el costo que él mismo informó; el Administrador distingue línea sin costo de costo cero; los borradores anteriores solo son visibles para el Administrador.
- [x] 6.4 Implementar vistas, serializadores, rutas y consultas en `backend/src/purchasing/api/` y `application/queries.py`; hacer pasar 6.1–6.3.
- [x] 6.5 Ampliar las pruebas de origen del Kardex: el Vendedor abre la entrada sin costos y el Encargado recibe denegación; ajustar la consulta si hace falta.
- [x] 6.6 Actualizar el **contrato OpenAPI**, ampliar `backend/tests/api/test_openapi.py` y regenerar `backend/schema.yml` con `cd backend && uv run --frozen python manage.py spectacular --file schema.yml --validate`.
- [x] 6.7 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/purchasing tests/inventory/test_kardex.py tests/api/test_openapi.py`.

Evidencia del grupo: matriz de permisos completa por endpoint, pruebas negativas de filtración y OpenAPI validado.

## 7. Selección mínima de proveedores

Dependencias: grupo 4. Diseño 5; spec `catalogo-de-proveedores`, «Acceso exclusivo de administración a proveedores».

- [x] 7.1 Escribir primero casos rojos en `backend/tests/supplier_registry/` para `GET /api/v1/suppliers/options/`: exige `ingresos.crear`; devuelve solo identificador y nombre de activos; busca por nombre; excluye inactivos, identificación y contacto; deniega al Encargado y a la sesión inválida; y el catálogo completo sigue vedado al Vendedor.
- [x] 7.2 Implementar la vista y la ruta reutilizando `list_supplier_references`, sin escrituras; hacer pasar 7.1 y actualizar OpenAPI.
- [x] 7.3 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/supplier_registry tests/api/test_openapi.py`.

Evidencia del grupo: proyección mínima probada y catálogo de proveedores sin nuevas concesiones.

## 8. Costo ausente en ventas y devoluciones

Dependencias: grupo 2. Diseño 7; spec `ventas-comerciales`, «Venta de productos sin costo registrado».

- [ ] 8.1 Escribir primero en `tests/sales/test_confirm.py` y `test_allocation.py` casos rojos: venta de un producto sin costo confirma con sus importes habituales y `cost_known` falso; venta mixta en una sola confirmación; un costo registrado después no reescribe la venta.
- [ ] 8.2 Crear la migración de `sales` que añade `SaleCostAllocation.cost_known` y copiarlo del movimiento en `record_allocations`; hacer pasar 8.1.
- [ ] 8.3 Escribir primero en `tests/sales/test_returns.py` un caso rojo: la devolución apta de una línea con costo desconocido reingresa como entrada sin costo. Ajustar `returns.py` hasta el verde.
- [ ] 8.4 Ampliar `tests/sales/test_queries.py` y `test_authorization.py`: el Administrador ve «sin costo registrado» y el Vendedor no percibe diferencia alguna. Ajustar `reads.py`.
- [ ] 8.5 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/sales/test_confirm.py tests/sales/test_allocation.py tests/sales/test_returns.py tests/sales/test_queries.py tests/sales/test_authorization.py tests/sales/test_reconcile.py tests/sales/test_void.py`.

Evidencia del grupo: ventas y devoluciones con costo ausente en verde y conciliación de ventas sin discrepancias.

## 9. Frontend: registro sencillo de entradas

Dependencias: grupos 6 y 7. Diseño 8; spec `compras-e-ingresos-de-mercaderia`, «Registro sencillo de entradas» y «Registro directo de entradas con revisión».

- [ ] 9.1 Actualizar `frontend/src/features/purchases/types.ts`, `api.ts` y `hooks.ts` al contrato nuevo, con pruebas rojas previas en `api.test.ts` y `hooks.test.tsx`; añadir la consulta de opciones de proveedor.
- [ ] 9.2 Escribir primero `frontend/src/pages/purchases/EntryPage.test.tsx` con casos rojos: foco inicial en el buscador; producto agregado con cantidad 1; elegirlo de nuevo suma uno; código interno exacto con Enter agrega y devuelve el foco; botones de más y menos; quitar una fila; detalles opcionales plegados; ningún campo marcado como obligatorio; ausencia de impuestos, fechas y totales.
- [ ] 9.3 Implementar `EntryPage` de ancho completo con el buscador, la lista de filas y el desplegable de detalles con proveedor, referencia, observación e interruptor «Registrar costos»; hacer pasar 9.2.
- [ ] 9.4 Escribir primero `EntryReviewDialog.test.tsx` con casos rojos: resumen «Entran N productos, M unidades», detalles solo si se informaron, aviso de posible duplicado con número y casilla de reconocimiento, cancelación que conserva lo escrito y prevención de doble envío. Implementar el diálogo hasta el verde.
- [ ] 9.5 Añadir casos rojos e implementar el resultado: toast con el número asignado, formulario vacío, foco en el buscador, errores asociados a sus campos sin perder lo escrito y aviso de cambios sin guardar al salir.
- [ ] 9.6 Eliminar `PurchaseEditorPage`, `LinesEditor`, `ReplacementDialog`, `draft.ts` y los selectores de impuesto junto con sus pruebas; actualizar `frontend/src/app/App.tsx` (sin `/purchases/:id/edit`), `navigation.ts` (etiqueta «Entradas») y `purchases-inventory-routes.test.tsx`.
- [ ] 9.7 Verificar con `cd frontend && npx vitest run src/pages/purchases src/features/purchases src/app/purchases-inventory-routes.test.tsx src/app/AuthenticatedShell.test.tsx`, `npx tsc --noEmit`, ESLint y Prettier sobre los archivos tocados.

Evidencia del grupo: rojo y verde registrados, flujo mínimo completado sin abrir detalles y navegación visible para el Vendedor.

## 10. Frontend: lista, detalle y pantallas relacionadas

Dependencias: grupo 9. Diseño 6 y 8; specs `compras-e-ingresos-de-mercaderia`, `kardex-de-productos` y `existencias-y-ajustes-de-inventario`.

- [ ] 10.1 Escribir primero casos rojos en `PurchasesPage.test.tsx`: columnas de número, momento, usuario, productos, unidades y estado; filtros por estado, período y usuario conservados al volver del detalle; estados de carga, vacío y error. Implementar hasta el verde.
- [ ] 10.2 Escribir primero casos rojos en `PurchaseDetailPage.test.tsx`: el Administrador ve costos, «sin costo registrado» distinto de cero, la sección de compra anterior y la acción de anular; el Vendedor ve solo productos y cantidades; un borrador anterior aparece como sin efecto y sin acciones. Implementar hasta el verde.
- [ ] 10.3 Ajustar con pruebas previas las pantallas de inventario y Kardex (`frontend/src/pages/inventory`, `features/inventory`) para mostrar «sin costo registrado», el aviso de productos fuera del valor total y la regularización, solo al Administrador.
- [ ] 10.4 Ajustar con pruebas previas las lecturas administrativas de costo de venta para mostrar «sin costo registrado» cuando corresponda.
- [ ] 10.5 Reescribir `frontend/e2e/purchases-inventory.spec.ts` para el flujo del Vendedor: entrada mínima, entrada con detalles, aviso de duplicado, consulta sin costos y anulación por el Administrador. Ejecutar solo ese archivo con `cd frontend && npx playwright test e2e/purchases-inventory.spec.ts`.
- [ ] 10.6 Verificar con `cd frontend && npx vitest run src/pages/purchases src/pages/inventory src/features/inventory`, `npx tsc --noEmit`, ESLint y Prettier sobre los archivos tocados.

Evidencia del grupo: proyección por rol visible en pantalla, E2E del cambio en verde y revisión visual en ancho de escritorio y de teléfono.

## 11. Documentación, decisiones y trazabilidad

Dependencias: grupos 2 a 10.

- [ ] 11.1 Registrar en `docs/negocio/decisiones/decisiones-confirmadas.yaml` la nueva decisión que sustituye DP-011, DP-022, DP-023 en compras y DP-024, con fecha y origen en esta propuesta, y actualizar reglas esenciales y roles (el Vendedor registra entradas). Actualizar su referencia de glosario.
- [ ] 11.2 Actualizar `docs/arquitectura/modelo-dominio.md` (§5.1, §6, §7, §10 y trazabilidad): proveedor opcional, ingreso sin borrador en el flujo nuevo y costo ausente.
- [ ] 11.3 Actualizar `docs/negocio/producto/alcance-v1.md` §3.4, `reglas-negocio.md` (RN-INV-003/004/006, RN-CAT-010) y `glosario.md` con «Entrada de stock» y «Sin costo registrado», junto con sus referencias de glosario.
- [ ] 11.4 Actualizar `docs/negocio/requisitos/`: `requisitos-funcionales.md` (RF-INV-001…006 y estado de implementación), `casos-de-uso.md` (CU-007, CU-015), `actores-y-roles.md` §3.3 y matriz de roles, `interfaz-y-navegacion.md` (UI-040…042) y `matriz-trazabilidad.md`.
- [ ] 11.5 Crear `docs/adr/0011-valoracion-de-inventario-con-costo-ausente.md` con su referencia de glosario y añadir a ADR-0005 una nota de referencia sin reemplazarlo.
- [ ] 11.6 Completar en `cobertura-compras-inventario.md` la matriz de 1.5 con los archivos de prueba reales, los comandos ejecutados, sus resultados y lo que no se ejecutó.
- [ ] 11.7 Dejar constancia, como asunto externo pendiente, de la validación con un contador sobre el IVA de compras y las existencias sin valor.

Evidencia del grupo: documentos sin contradicciones con las decisiones vigentes, glosarios sincronizados y ADR aceptado.

## 12. Verificación final focalizada

Dependencias: grupos 1 a 11.

- [ ] 12.1 Ejecutar `cd backend && uv run --frozen pytest --no-cov tests/purchasing tests/inventory tests/supplier_registry tests/sales tests/identity/test_authorization.py tests/api/test_openapi.py`, Ruff, formato y mypy sobre los módulos tocados, y `uv run --frozen python manage.py makemigrations --check --dry-run`.
- [ ] 12.2 Ejecutar `cd frontend && npx vitest run src/pages/purchases src/features/purchases src/pages/inventory src/features/inventory src/app`, `npx tsc --noEmit`, ESLint, Prettier y `npx playwright test e2e/purchases-inventory.spec.ts`.
- [ ] 12.3 Ejecutar la conciliación de inventario y de ventas sobre la base de desarrollo y registrar que no hay discrepancias.
- [ ] 12.4 Ejecutar `openspec validate simplificar-entradas-de-stock-por-vendedor --strict` y registrar en el resumen los comandos ejecutados, sus resultados y las suites completas no ejecutadas, para que el usuario decida si quiere la verificación completa antes de integrar.

Evidencia del grupo: resultados reales de cada comando y lista explícita de lo no ejecutado.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
