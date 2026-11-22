# Cobertura — Cobrar y facturar en un paso (U6)

| Requisito / Regla | Comportamiento verificado | Evidencia de prueba |
|---|---|---|
| `DP-036` regla 2 · `DP-037` · `RN-FIS-008/009` | Flujo único «Cobrar y facturar» con dos bloques separados, dos cobros independientes y dos preparaciones fiscales locales sin mezclar RUC | `backend/tests/checkout/test_checkout_flow.py::test_maintenance_checkout_full_cash_closes_order_and_prepares_two_invoices`, `frontend/src/pages/checkout/CheckoutPage.test.tsx` |
| `DP-034` regla 5 · `ADR-0014` | Fallo de preparación fiscal conserva confirmaciones y cobros en firme, devolviendo `overall_status: "partial"` | `backend/tests/checkout/test_checkout_flow.py::test_partial_fiscal_failure_keeps_payments_intact_dp034_rule5` |
| `DP-036` regla 4 · `RN-CLI-003` | Guardado opcional del correo del receptor en la ficha del cliente con permiso `clientes.gestionar` y auditoría sin PII | `backend/tests/customer_registry/test_customer_email_update.py`, `backend/tests/sales/test_fiscal_prepare_flow.py::test_prepare_saves_email_to_customer_when_opted_in` |
| `DP-003` · `DP-013` · `DP-037` (#6, #8) | Solo Efectivo/Transferencia/Combinado/Crédito (sin Tarjeta); «Solo cobrar (facturar después)» sin exigir correo | `backend/tests/checkout/test_checkout_flow.py::test_quick_sale_one_step_and_solo_cobrar_without_email`, `frontend/src/pages/checkout/CheckoutPage.test.tsx` |
| `CT-001` · `DP-021` · `actores-y-roles.md` | Encargado del taller sin rol comercial solo opera servicios y no puede cerrar la orden con repuestos pendientes ni cobrar comercial | `backend/tests/checkout/test_checkout_flow.py::test_manager_cannot_confirm_or_pay_commercial_parts` |
| `DP-034` regla 8 · `RF-FIS-002` | Columna «Falta facturar» en Inicio separada por negocio, filtrada por permisos y sin estados de autorización SRI | `backend/tests/home/test_unbilled.py`, `backend/tests/home/test_boundaries.py`, `frontend/src/pages/home/HomePage.test.tsx` |
| `ADR-0001` · `ADR-0014` | Fronteras AST del módulo `checkout` (solo servicios públicos, sin modelos ajenos, nadie importa `checkout`) | `backend/tests/checkout/test_boundaries.py` |

## Medición de objetivos de rapidez (`RNF-USA-013…016`)

Método aplicado (`RNF-USA-016`): sesión iniciada en Inicio, cliente registrado con correo y un solo vehículo, catálogos y configuración fiscal completos; cada clic, campo escrito y elección cuenta como 1 acción.

| Requisito | Línea base | Objetivo | Recorrido medido en U6 | Total U6 | Estado |
|---|---:|---:|---|---:|---|
| `RNF-USA-013` Servicio simple, cobrado, factura preparada y orden cerrada | 25 | 8 a 10 | 1) Nuevo mantenimiento → 2) Buscar cliente/placa (preselecciona vehículo único) → 3) Kilometraje → 4) Chip motivo → 5) Abrir mantenimiento → 6) Buscar servicio → 7) Elegir servicio → 8) Diagnóstico → 9) Cobrar y facturar → 10) Pulsar «Cobrar y facturar» (Efectivo, correo y cierre marcados por omisión) | **10** | Cumplido |
| `RNF-USA-014` Venta de mostrador, cobrada y con factura preparada | 16 | 5 a 6 | 1) Venta rápida → 2) Buscar cliente → 3) Elegir cliente → 4) Buscar producto → 5) Elegir producto → 6) Pulsar «Cobrar y facturar» (Efectivo por defecto) | **6** | Cumplido |
| `RNF-USA-015` Mantenimiento con 1 servicio y 1 repuesto, cobrado, 2 facturas preparadas y orden cerrada | 47 | 12 a 14 | Los 8 pasos previos del servicio simple + 9) Buscar repuesto → 10) Elegir repuesto → 11) Abrir «Cobrar y facturar» → 12) Pulsar «Cobrar y facturar» (2 cobros, 2 facturas locales y cierre en 1 clic) | **12** | Cumplido |
