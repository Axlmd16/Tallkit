# ADR-0014: Orquestación por pasos de «Cobrar y facturar» con tolerancia a fallos parciales

- **Estado:** Aceptada el 2026-11-22 al aplicar el cambio `cobrar-y-facturar-en-un-paso` (U6).
- **Fecha:** 2026-11-22

## Contexto

`DP-036` (regla 2) y `RNF-USA-013…015` exigen una sola pantalla **«Cobrar y facturar»** capaz de confirmar servicios artesanales y ventas comerciales, registrar cobros independientes por negocio, preparar facturas locales (y en el cambio 3 emitirlas), guardar opcionalmente el correo del cliente y cerrar la orden de mantenimiento, sin mezclar RUC (`ADR-0008`) ni acoplar transacciones comerciales a la emisión fiscal (`ADR-0010`, `DP-034` regla 5).

Colocar esta coordinación en `sales`, `workshop` o `fiscal` violaría las fronteras AST verificadas (`test_boundaries.py`) o crearía ciclos de importación (`fiscal` ya lee `sales` y `workshop`). Orquestar 6 a 8 llamadas HTTP desde el navegador deja la atención vulnerable a cierres de pestaña o cortes de red a mitad del flujo.

## Decisión

1. **Módulo orquestador delgado `backend/src/checkout/`:** se incorpora un módulo de aplicación montado en `/api/v1/checkout/` que importa únicamente servicios públicos de `sales`, `workshop`, `fiscal`, `customer_registry`, `workshop_configuration` e `identity`. Ningún otro módulo importa `checkout` (verificado por `backend/tests/checkout/test_boundaries.py`).
2. **Sin tablas económicas conjuntas:** `checkout` conserva únicamente la tabla técnica `checkout_receipt` (`CheckoutReceipt`) para idempotencia de solicitudes compuestas. Todos los hechos económicos, pagos y preparaciones fiscales siguen viviendo en sus módulos propietarios.
3. **Transacciones independientes por paso e idempotencia determinista:** cada paso reutiliza su servicio atómico (`confirm_sale`, `confirm_operation`, `register_payment`, `prepare_from_checkout`, `update_customer_email`, `finalize_order`) con claves derivadas determinísticamente de la cabecera `Idempotency-Key`. Así:
   - Se respeta el orden global de bloqueos (`ADR-0009`) sin bloqueos cruzados entre RUC.
   - Un fallo en la preparación fiscal nunca revierte ventas ni cobros (`DP-034`, regla 5) y devuelve `overall_status: "partial"` con el detalle exacto por negocio.
   - Un reintento con la misma `Idempotency-Key` reproduce el resultado original sin duplicar documentos, movimientos de Kardex ni pagos.

## Alternativas consideradas

- **Orquestación en frontend:** frágil ante cierres de navegador y dificulta la prevalidación atómica e idempotencia compuesta.
- **Transacción única abarcando ambos RUC y fiscal:** contradice `DP-034` regla 5 (un fallo fiscal desharía cobros) y aumenta contención de bloqueos.
- **Ubicar el flujo en `workshop` o `fiscal`:** rompe las fronteras de módulos y genera importaciones circulares.

## Consecuencias

- Las reglas monetarias, de inventario, de autorización y fiscales permanecen en una sola fuente de verdad (sus módulos dueños).
- El cambio 3 (`emitir-comprobantes-electronicos`) podrá reemplazar o extender el paso 4 (`prepare_from_checkout`) por la solicitud de emisión mediante el adaptador neutral sin modificar la pantalla ni los módulos de ventas, taller o cobros.

## Referencias

- [Propuesta U6](../../openspec/changes/cobrar-y-facturar-en-un-paso/proposal.md) y [Diseño U6](../../openspec/changes/cobrar-y-facturar-en-un-paso/design.md).
- [ADR-0001](0001-monorepositorio-y-monolito-modular.md), [ADR-0008](0008-documentos-artesanales-separados-y-nucleo-monetario.md), [ADR-0009](0009-reservas-inventario-y-ventas-vinculadas.md) y [ADR-0010](0010-modulo-fiscal-independiente-y-archivo-transaccional.md).
