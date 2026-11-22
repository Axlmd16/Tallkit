## Context

Tallkit es un monolito modular Django/DRF + React/TypeScript/Vite sobre PostgreSQL (`ADR-0001`, `ADR-0003`). Los módulos existentes mantienen fronteras verificadas por pruebas AST (`test_boundaries.py`):

- `workshop`: órdenes de mantenimiento, líneas de servicio, operaciones artesanales (`ART-SER-*`), pagos/retenciones artesanales y finalización (`ADR-0008`, `ADR-0009`).
- `sales`: ventas comerciales (`COM-VEN-*`), reservas vinculadas al mantenimiento, pagos/retenciones comerciales y devoluciones (`ADR-0006`, `ADR-0009`).
- `fiscal`: preparaciones locales de factura, instantáneas de formato 4, validación de receptor/emisor/plazo/detalles y archivo XML (`ADR-0010`, `DP-035`).
- `customer_registry`: ficha compartida de clientes y vehículos con auditoría.
- `home`: módulo estrictamente de solo lectura (`home/test_boundaries.py`) que compone resúmenes publicados (`*.application.home_summary`) para Inicio y búsqueda global (U5).

Hoy, el frontend ya dispone de la ficha del mantenimiento (U4b), el modal «Nuevo mantenimiento» (`NewMaintenanceDialog.tsx`) y «Venta rápida» (`QuickSalePage.tsx` + `quickSale.ts`, que encadena crear → confirmar → cobrar desde el navegador pero todavía no prepara factura). El botón «Cobrar y facturar» de la ficha del mantenimiento todavía redirige a los cobros separados, y la columna «Falta facturar» de Inicio (`HomePage.tsx`) aún no existe.

Este diseño resuelve la coordinación de **U6 (`cobrar-y-facturar-en-un-paso`)** respetando la separación fiscal estricta, el orden global de bloqueos (`ADR-0009`) y la independencia del módulo fiscal (`ADR-0010`, `DP-034` regla 5 y regla 8).

## Goals / Non-Goals

**Goals:**
- Coordinar en el servidor el flujo único **«Cobrar y facturar»** para mantenimiento (servicios + repuestos) y para venta comercial (directa o venta rápida), reutilizando exclusivamente los servicios de aplicación existentes de cada módulo.
- Garantizar límites transaccionales independientes por operación económica (sin transacciones gigantes que mezclen RUC ni reviertan cobros si falla la preparación fiscal), con idempotencia de extremo a extremo.
- Implementar el guardado opcional del correo del receptor en la ficha del cliente (`DP-036` regla 4) con permiso `clientes.editar`, aviso previo ante reemplazo y auditoría, tanto desde «Cobrar y facturar» como desde la preparación fiscal individual.
- Habilitar la columna **«Falta facturar»** en Inicio respetando la naturaleza de solo lectura de `home` y los permisos efectivos por negocio.
- Alcanzar los objetivos de rapidez `RNF-USA-013` (8–10 acciones), `RNF-USA-014` (5–6) y `RNF-USA-015` (12–14) medidos con `RNF-USA-016`, y ejecutar al cierre la verificación diferida de `alinear-datos-del-comprobante-con-sri` (cambio 2).
- Documentar la frontera transversal de orquestación en **`ADR-0014`**.

**Non-Goals:**
- Emitir, firmar o transmitir comprobantes al SRI ni conectar con Factuplan (cambios 3 y 4).
- Soportar ventas sin cliente registrado (cambio 6) ni medio de pago «Tarjeta» (`DP-003`).
- Crear tablas económicas conjuntas entre RUC comercial y RUC artesanal (`ADR-0008`).
- Modificar las reglas de permisos (`CT-001`) ni los servicios internos de inventario/Kardex.

## Decisions

### D1. Nuevo módulo orquestador `checkout` en el backend (`ADR-0014`)
- **Decisión:** crear un módulo delgado `backend/src/checkout/` montado en `/api/v1/checkout/` que coordina la prevalidación y ejecución por pasos de «Cobrar y facturar», llamando únicamente a servicios públicos de aplicación de `workshop`, `sales`, `fiscal`, `customer_registry`, `workshop_configuration` e `identity`. Ningún otro módulo importa `checkout` (se añade `backend/tests/checkout/test_boundaries.py`).
- **Por qué:** evita ciclos de dependencias (`fiscal` ya lee `workshop` y `sales`), preserva las fronteras AST de `sales`, `workshop`, `fiscal` y `home`, y concentra en un solo lugar la semántica de orquestación, idempotencia y respuesta estructurada por negocio.
- **Alternativas descartadas:**
  - *Orquestar desde el frontend (como hace `quickSale.ts`):* deja el estado parcial vulnerable a cierres de pestaña o cortes de red a mitad de 6–8 llamadas HTTP, dificulta la prevalidación atómica y obliga a exponer lógica de secuencia en el cliente.
  - *Colocarlo dentro de `workshop` o `fiscal`:* viola `ADR-0008`/`ADR-0010` y produce importaciones circulares.

### D2. Límites transaccionales por paso e idempotencia compuesta
- **Decisión:** cada paso de dominio se ejecuta en su propia transacción atómica ya probada (`confirm_operation`, `confirm_sale`, `register_payment`, `create_draft`/`update_draft`/`review`/`prepare`, `update_customer_email`, `finalize_order`), nunca en una sola transacción global entre dos RUC.
- **Idempotencia:** `checkout` define un único modelo técnico `CheckoutReceipt` (`actor`, `action`, `idempotency_key`, `input_fingerprint`, `response_payload`, `response_status`, `created_at`) con unicidad `(actor, action, idempotency_key)`. Cada paso interno deriva una clave determinista a partir de la clave de `checkout` (p. ej. `uuid5(NAMESPACE_URL, f"{key}:commercial-confirm")`, `:artisan-confirm`, `:commercial-pay`, `:artisan-pay`, `:commercial-fiscal`, `:artisan-fiscal`, `:finalize`).
  - Si llega un reintento con la misma `Idempotency-Key` e igual `input_fingerprint`, `checkout` devuelve el `response_payload` guardado (`replayed=True`) sin reejecutar nada.
  - Si un reintento ocurre tras una caída del proceso a mitad de ejecución, las claves deterministas por paso hacen que los pasos ya completados se recuperen idempotentemente sin duplicar documentos, salidas de inventario ni pagos.
  - Si la clave se reutiliza con distinto payload, responde `409 Conflict`.
- **Orden de ejecución:**
  1. **Prevalidación** (permisos efectivos por negocio, existencia de borradores/líneas pendientes, precios y stock de venta comercial, configuración fiscal si se pidió facturar, formato de correo, coherencia de importes y requisitos de cierre). Si falla una prevalidación crítica de negocio (p. ej., stock insuficiente, precio desactualizado o permiso denegado), aborta antes de mutar nada (`409`/`422`/`403`).
  2. **Confirmaciones económicas (independientes por RUC):**
     - Comercial (si hay venta en borrador o venta vinculada abierta y el usuario tiene `ventas.confirmar`): `sales.application.sales.confirm_sale` (revisa y confirma con consumo atómico de reservas/Kardex).
     - Artesanal (si hay líneas iniciales pendientes en la orden y el usuario tiene `servicios_economicos.confirmar`): `workshop.application.service_operations.confirm_operation`.
  3. **Cobros independientes por RUC (si el modo no es crédito sin abono):**
     - Comercial (si el usuario tiene `pagos_comerciales.registrar` y hay importe comercial > 0 o retención): `sales.application.payments.register_payment`.
     - Artesanal (si el usuario tiene `pagos_artesanales.registrar` y hay importe artesanal > 0 o retención): `workshop.application.artisan_payments.register_payment`.
  4. **Preparación fiscal local independiente por RUC (solo si `include_invoices=True`):**
     - Para cada operación confirmada del negocio autorizado, invoca un servicio público en `fiscal.application.preparations` (`prepare_from_checkout`) que crea o reutiliza el borrador activo, aplica receptor (cliente o consumidor final explícito si ≤ USD 50 y no crédito), correo, plazo en días (si hay saldo pendiente a crédito) y formas de pago SRI derivadas, revisa y completa la instantánea de formato 4.
     - **Tolerancia a fallos parciales (`DP-034`, regla 5):** si falla este paso (p. ej. impedimento de emisor, código > 25 caracteres o correo faltante), se captura el error estructurado en el bloque de resultado fiscal correspondiente; los pasos 2 y 3 quedan **en firme** y la respuesta devuelve `200 OK` con `overall_status: "partial"` y el detalle exacto por negocio.
  5. **Guardado opcional del correo en la ficha del cliente (`DP-036`, regla 4):** si se completó al menos una preparación identificada con `save_email_to_customer=True`, el receptor no es consumidor final y el usuario tiene `clientes.editar`, invoca `customer_registry.application.customers.update_customer_email(...)`. Si el usuario carece de `clientes.editar`, simplemente no muta la ficha y lo informa en el resultado (nunca falla el cobro ni la factura).
  6. **Cierre opcional del mantenimiento (`DP-021`, `DP-037`):** solo para origen mantenimiento, si `close_order=True`, el usuario tiene `mantenimientos.finalizar`, no quedan líneas abiertas sin confirmar en la venta vinculada y la orden cumple diagnóstico + al menos un servicio, invoca `workshop.application.transitions.finalize_order`. Si no cumple, la orden permanece abierta y se informa el motivo en `order_closure`.

```mermaid
sequenceDiagram
    participant UI as Pantalla "Cobrar y facturar"
    participant CO as checkout (orquestador)
    participant S as sales (RUC comercial)
    participant W as workshop (RUC artesanal)
    participant F as fiscal (preparación local)
    participant C as customer_registry

    UI->>CO: GET /api/v1/checkout/maintenance/{id}/ (o /sales/{id}/)
    CO->>W: leer orden, líneas pendientes, operaciones, requisitos cierre
    CO->>S: leer venta abierta/confirmadas, preview stock/precios
    CO->>F: leer estado fiscal, preparación activa y bloqueos por entidad
    CO-->>UI: resumen separado por negocio + flags de permiso y cierre

    UI->>CO: POST /api/v1/checkout/execute/ (Idempotency-Key)
    Note over CO: 1. Prevalidación estricta (sin mutar si falla stock/precio/permiso)
    CO->>S: 2a. confirm_sale (tx atómica comercial + Kardex)
    CO->>W: 2b. confirm_operation (tx atómica artesanal)
    CO->>S: 3a. register_payment comercial (tx atómica)
    CO->>W: 3b. register_payment artesanal (tx atómica)
    CO->>F: 4a. prepare comercial (tx atómica; fallo no revierte 2/3)
    CO->>F: 4b. prepare artesanal (tx atómica; fallo no revierte 2/3)
    CO->>C: 5. update_customer_email (si marcado + permiso + auditado)
    CO->>W: 6. finalize_order (si marcado + sin repuestos abiertos + diagnóstico)
    CO-->>UI: resultado por paso y negocio (completed / partial)
```

### D3. Contratos de API (`/api/v1/checkout/` y `/api/v1/home/unbilled/`)
- **`GET /api/v1/checkout/maintenance/<int:order_id>/`**: devuelve el estado de revisión para «Cobrar y facturar» de una orden:
  - `origin`: tipo (`MAINTENANCE`), id, número, estado, cliente (`id`, `name`, `identification_type`, `identification`, `email`, `is_withholding_agent`), vehículo (`plate`, `label`).
  - `artisan`: `visible`, `can_confirm`, `can_collect`, `can_prepare_fiscal`, `business_name`, `pending_lines`, `operation` (si ya existe confirmada), `total`, `balance`, `fiscal` (`state`, `preparation_id`, `can_prepare`, `impediments`, `can_use_final_consumer`), `withholding_enabled`.
  - `commercial`: `visible`, `can_confirm`, `can_collect`, `can_prepare_fiscal`, `business_name`, `pending_sale` (borrador vinculado con preview de stock/precios), `confirmed_sales`, `total`, `balance`, `fiscal` (`state`, `preparation_id`, `can_prepare`, `impediments`, `can_use_final_consumer`), `withholding_enabled`.
  - `email`: `customer_email`, `can_save_to_customer` (`clientes.editar`).
  - `closure`: `can_close`, `default_checked`, `missing_requirements` (p. ej. diagnóstico faltante o repuestos abiertos sin permiso para confirmarlos).
- **`GET /api/v1/checkout/sales/<int:sale_id>/`**: misma estructura enfocada en el bloque `commercial` (para ventas directas en borrador o confirmadas con saldo o sin factura local).
- **`POST /api/v1/checkout/execute/`** (exige cabecera `Idempotency-Key` y CSRF):
  - Admite `origin_kind`: `"MAINTENANCE"` (con `order_id`), `"SALE"` (con `sale_id`) o `"QUICK_SALE"` (con `customer_id` y `lines`, creando y confirmando la venta comercial en el mismo flujo sin requerir borrador previo desde la UI).
  - Parámetros: `payment_mode` (`"CASH" | "TRANSFER" | "MIXED" | "CREDIT"`), `partial` (bool), desglose explícito por negocio (`commercial_payment` / `artisan_payment`: `parts` con `EFECTIVO`/`TRANSFERENCIA` y `withholding` opcional), `include_invoices` (bool: `true` para «Cobrar y facturar», `false` para «Solo cobrar»), `receiver_mode` (`"CUSTOMER" | "FINAL_CONSUMER"`), `receiver_email`, `save_email_to_customer` (bool), `credit_term_days` (entero 1..9999 opcional cuando queda saldo), `close_order` (bool).
  - Respuesta: `overall_status` (`"completed" | "partial"`), `commercial` (resultado de confirmación, cobro, preparación fiscal y errores si los hubo), `artisan` (ídem), `customer_email_updated` (bool + nota), `order_closure` (`closed`, `reason`).
- **Extensión en `POST /api/v1/fiscal/preparations/<uuid:preparation_id>/prepare/`:** acepta opcionalmente `save_email_to_customer: bool` (por defecto `false` en llamadas legadas para no romper compatibilidad; la interfaz lo envía `true` cuando la casilla está marcada), delegando a `customer_registry.application.customers.update_customer_email`.
- **`GET /api/v1/home/unbilled/`**: endpoint de solo lectura en `home` que consulta `sales.application.home_summary`, `workshop.application.home_summary` y `fiscal.application.home_summary`, devolviendo operaciones confirmadas vigentes sin preparación fiscal en estado `PREPARED`, separadas por negocio y filtradas estrictamente por los permisos fiscales/comerciales/artesanales del usuario (`fiscal.preparar_comercial`/`ventas.ver` y `fiscal.preparar_artesanal`/`servicios_economicos.ver`).

### D4. Guardado del correo en `customer_registry` (`DP-036` regla 4)
- **Decisión:** añadir `update_customer_email(*, actor: User, customer_id: int, email: str, source_reference: str)` en `backend/src/customer_registry/application/customers.py`.
- Exige permiso `clientes.editar`, valida el correo con las reglas de dominio de `customer_registry`, evita escrituras si el valor normalizado ya coincide, actualiza `Customer.email` y registra un evento de auditoría (`clientes.actualizar_correo`) con `previous_email`, `new_email` y `source_reference`.
- Se agrega `customer_registry.application.customers` a la lista permitida de `fiscal/test_boundaries.py` únicamente para este servicio explícito (sin importar `customer_registry.models`).

### D5. Diseño de frontend y presupuesto de acciones (`RNF-USA-013…015`)
- **Rutas nuevas/actualizadas en `frontend/src/app/App.tsx`:**
  - `/maintenance/:id/checkout` → `CheckoutPage` (mantenimiento).
  - `/sales/:id/checkout` → `CheckoutPage` (venta).
- **Nuevo módulo `frontend/src/features/checkout/`** (`api.ts`, `hooks.ts`, `types.ts`, componentes de bloque por negocio, selector de pago, bloque receptor/correo con aviso cuando el correo escrito difiere del guardado en la ficha, resultado parcial/completo con reintento dirigido y acceso a recibos).
  - Fiel al prototipo aprobado `docs/prototipo/Cobrar.dc.html` con dos ajustes normativos ya aprobados: sin botón «Tarjeta» (`DP-003`) y con etiquetas locales **«Factura preparada (sin enviar)»** + aviso de pruebas (`DP-034` regla 8).
  - Ofrece opción desplegable para **pago combinado (Efectivo + Transferencia)** y **retención recibida** (`DP-032`), manteniendo el flujo habitual en un clic.
  - Cuando falta el correo o hay un bloqueo fiscal, mantiene deshabilitado «Cobrar y facturar» explicando el motivo y habilita el botón secundario **«Solo cobrar (facturar después)»**.
- **Integración con pantallas existentes:**
  - `MaintenanceOrderDetailPage.tsx` / `OrderPanels.tsx`: el botón «Cobrar y facturar» navega directamente a `/maintenance/:id/checkout`.
  - `SaleDetailPage.tsx`: añade acceso «Cobrar y facturar» hacia `/sales/:id/checkout` cuando la venta está en borrador, tiene saldo o carece de factura preparada.
  - `QuickSalePage.tsx`: reemplaza el encadenado manual en cliente por `POST /api/v1/checkout/execute/` (`origin_kind: "QUICK_SALE"`), incorporando en la misma pantalla el correo precargado del cliente, la casilla de guardar correo y la acción secundaria «Solo cobrar».
  - `NewMaintenanceDialog.tsx`: cuando el usuario selecciona o encuentra un cliente que tiene un único vehículo, lo preselecciona automáticamente sin clic extra.
  - `HomePage.tsx`: agrega `UnbilledColumn.tsx` («Falta facturar») junto a `WorkshopColumn` y `OwedColumn`, cargando y fallando de forma independiente y conduciendo a `/sales/:id/checkout` o `/maintenance/:id/checkout`.
- **Presupuesto esperado de acciones (`RNF-USA-016`, cliente registrado con correo y 1 vehículo):**
  - **`RNF-USA-013` Servicio simple (objetivo 8–10):** 1) Nuevo mantenimiento → 2) Buscar cliente/placa → 3) Elegir coincidencia (preselecciona vehículo) → 4) Chip/motivo → 5) Abrir mantenimiento → 6) Buscar servicio → 7) Elegir servicio → 8) Cobrar y facturar (abre pantalla con Efectivo, correo y «Cerrar al cobrar» listos) → 9) Pulsar «Cobrar y facturar» = **9 acciones** (dentro de 8–10).
  - **`RNF-USA-014` Venta de mostrador (objetivo 5–6):** 1) Venta rápida → 2) Buscar cliente → 3) Elegir cliente (precarga correo) → 4) Buscar producto → 5) Elegir producto → 6) Pulsar «Cobrar y facturar» (Efectivo por defecto) = **6 acciones** (dentro de 5–6).
  - **`RNF-USA-015` Mantenimiento con servicio y repuesto (objetivo 12–14):** los 7 pasos del servicio simple + 8) Buscar repuesto → 9) Elegir repuesto → 10) Abrir «Cobrar y facturar» → 11) Pulsar «Cobrar y facturar» = **11–12 acciones** (dentro de 12–14, incluso contando 1 campo de diagnóstico o kilometraje si se llena explícitamente: **12–13 acciones**).

### D6. Migraciones y compatibilidad
- **Única migración nueva:** `checkout/migrations/0001_initial.py` creando la tabla técnica `checkout_receipt` para idempotencia de solicitudes compuestas.
- **Sin migraciones destructivas** en `sales`, `workshop`, `fiscal` ni `customer_registry`. Todos los datos y preparaciones existentes conservan plena compatibilidad.
- **Rollback:** deshabilitar las rutas `/api/v1/checkout/` y revertir la migración `checkout` sin afectar ningún documento económico ni preparación fiscal ya creados (porque viven en sus módulos originales).

### D7. Estrategia de pruebas y verificación
- **Nivel alto (TDD en backend):**
  - `backend/tests/checkout/test_boundaries.py`: verifica fronteras AST del nuevo módulo.
  - `backend/tests/checkout/test_authorization.py`: pruebas positivas y negativas por rol único (`VENDEDOR`, `ENCARGADO_TALLER`, `ADMINISTRADOR`) y combinaciones (usuaria diaria), verificando aislamiento entre RUC y permiso `clientes.editar`.
  - `backend/tests/checkout/test_execute_flow.py`: mantenimiento completo contado/parcial/crédito/combinado/retención, venta rápida en un paso, cierre opcional respetando `DP-021`, «Solo cobrar» sin correo, guardado de correo con auditoría y aviso de reemplazo, y fallo parcial fiscal con cobro en firme (`DP-034` regla 5).
  - `backend/tests/checkout/test_idempotency_concurrency.py`: reintentos con misma `Idempotency-Key`, conflicto con payload distinto y concurrencia sobre la última unidad de stock.
  - `backend/tests/home/test_unbilled.py`: separación por RUC, permisos y exclusión de operaciones ya preparadas o anuladas.
- **Nivel medio (prueba al final en frontend):**
  - Pruebas de `CheckoutPage.test.tsx` (flujo completo, pago parcial por negocio, sin correo + «Solo cobrar», fallo parcial, aviso de cambio de correo, permisos parciales), `QuickSalePage.test.tsx`, `HomePage.test.tsx` (columna «Falta facturar») y `NewMaintenanceDialog.test.tsx` (preselección de vehículo único).
- **Verificaciones de cierre de U6:**
  - Regenerar y validar OpenAPI (`backend/schema.yml`).
  - Registrar `DP-037`, `ADR-0014` y sincronizar documentación, cobertura y trazabilidad.
  - Ejecutar la verificación diferida de `alinear-datos-del-comprobante-con-sri` (cambio 2) y la medición documentada de `RNF-USA-013…015`.

## Risks / Trade-offs

- **[Fallo entre confirmación y cobro o entre los dos RUC] →** Mitigación: prevalidación exhaustiva antes de mutar (stock, precios, permisos, vigencia tributaria), transacciones atómicas por operación e idempotencia determinista por paso; la pantalla muestra el estado real de cada bloque y permite completar lo pendiente sin duplicar.
- **[Bloqueo accidental del cierre de orden si falta diagnóstico] →** Mitigación: el endpoint de revisión indica explícitamente `closure.missing_requirements` antes de cobrar; si falta diagnóstico, la casilla de cierre aparece deshabilitada explicando el motivo (o permite escribirlo antes sin perder el flujo) y nunca bloquea el cobro.
- **[Diferencia entre `RNF-USA-013…015` y diagnóstico obligatorio en `ordenes-de-mantenimiento`] →** Mitigación: el modal «Nuevo mantenimiento» ya llena las observaciones con los chips de motivo; al medir `RNF-USA-013` y `RNF-USA-015` se verificará si el diagnóstico se completa en 1 acción en la ficha o requiere ajuste, registrando el conteo exacto con transparencia conforme a `RNF-USA-016`.
- **[Confusión de estado fiscal local antes del cambio 3] →** Mitigación: todas las respuestas y etiquetas dicen explícitamente «Preparada, sin enviar» / «Facturación de prueba» y una prueba automatizada verifica ausencia de términos de autorización SRI (`autorizad*`, `emitida`).
