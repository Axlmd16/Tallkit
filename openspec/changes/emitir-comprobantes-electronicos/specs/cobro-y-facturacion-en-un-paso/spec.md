## MODIFIED Requirements

### Requirement: Ejecución separada de confirmación, cobro independiente y preparación fiscal

Al ejecutar «Cobrar y facturar», el sistema SHALL aplicar por separado y en orden, únicamente para los bloques autorizados y solicitados:

1. Confirmación de la operación artesanal con las líneas iniciales pendientes de la orden (documentándolas una sola vez conforme a `DP-029`, si aún no lo están) y/o confirmación de la venta comercial abierta (descontando inventario y generando Kardex atómicamente conforme a `DP-002`).
2. Registro de un pago independiente por cada operación económica que reciba dinero (`DP-013`), usando exclusivamente medios reales permitidos en V1 (`EFECTIVO`, `TRANSFERENCIA` o combinación explícita de ambos por operación, nunca «Tarjeta») y, cuando corresponda y la entidad lo habilite, el registro opcional de retención recibida (`DP-032`). En condición **Crédito («Queda debiendo»)** SHALL confirmarse la operación a crédito sin crear un pago (o registrando solo el abono parcial indicado expresamente por negocio). El vuelto en efectivo SHALL ser solo un cálculo orientativo y nunca alterar el importe aplicado.
3. Preparación local de la factura independiente de cada operación confirmada que tenga datos fiscales completos, usando la instantánea fiscal vigente de formato 4 y el plazo en días (1 a 9999) cuando quede saldo a crédito (`DP-035`).
4. Cuando la **entidad fiscal** de esa operación tenga la **emisión electrónica activada** (en esta entrega, únicamente en ambiente de *Pruebas* `1` con el adaptador simulado, conforme a `DP-034` regla 8), solicitud automática de emisión del comprobante preparado a través de la interfaz neutral del proveedor, **fuera** de la transacción de confirmación y cobro (`ADR-0010`, `ADR-0014`). Si la entidad fiscal no tiene la emisión activada, la factura SHALL permanecer con estado local **«Factura preparada (sin enviar)»** y referencia fiscal `no_solicitada`. Todo comprobante emitido en ambiente de pruebas SHALL identificarse expresamente como de **Pruebas (sin validez tributaria)** y nunca como factura productiva autorizada.

Si el usuario elige explícitamente la acción secundaria **«Solo cobrar (facturar después)»** (por ejemplo cuando falta el correo o existe un impedimento fiscal), el sistema SHALL ejecutar los pasos 1 y 2 sin exigir correo, preparar factura ni solicitar emisión, dejando las operaciones confirmadas pendientes en «Falta facturar».

Trazabilidad: `DP-002`; `DP-003`; `DP-013`; `DP-025`; `DP-027`; `DP-029`; `DP-032`; `DP-034` reglas 4, 5 y 8; `DP-035`; `DP-036` reglas 2 y 4; `DP-037`; `RF-PAG-010`; `RF-FIS-001/002/008/009/013`; `ADR-0010`; `ADR-0014`.

#### Scenario: Cobrar y facturar con emisión en pruebas activa en un negocio e inactiva en el otro
- **DADO** una orden registrada con un servicio pendiente de USD 20,00 (negocio artesanal con emisión en pruebas activada) y una venta vinculada abierta de USD 23,00 (negocio comercial con configuración fiscal lista pero emisión inactiva), para un cliente con correo válido
- **CUANDO** la usuaria diaria elige «Efectivo» y ejecuta «Cobrar y facturar»
- **ENTONCES** el servidor SHALL confirmar ambas operaciones y sus dos pagos independientes, completar las dos preparaciones fiscales de formato 4, emitir en ambiente de pruebas la factura artesanal mediante el adaptador simulado (archivando su XML y RIDE de prueba y mostrando «Autorizada en pruebas») y dejar la factura comercial en «Factura preparada (sin enviar)».

#### Scenario: Pago parcial o combinado por negocio y condición a crédito
- **DADO** una orden con servicios por USD 20,00 y repuestos por USD 23,00
- **CUANDO** la usuaria diaria selecciona pago parcial indicando USD 20,00 para servicios y USD 10,00 para repuestos (o elige «Queda debiendo» con plazo de 30 días, o combina efectivo y transferencia indicando el desglose)
- **ENTONCES** el sistema SHALL exigir importes explícitos por negocio sin repartir un monto único en silencio, SHALL registrar pagos independientes por los importes exactos indicados (o ninguno si es a crédito sin abono) y SHALL registrar el plazo en días únicamente en las facturas con saldo pendiente, sin crear vencimiento ni mora.

#### Scenario: Solo cobrar cuando falta correo o hay bloqueo fiscal
- **DADO** una venta o mantenimiento de un cliente sin correo en su ficha
- **CUANDO** el usuario intenta «Cobrar y facturar» sin escribir correo y luego elige «Solo cobrar (facturar después)»
- **ENTONCES** «Cobrar y facturar» SHALL permanecer bloqueado por el correo faltante, mientras que «Solo cobrar (facturar después)» SHALL confirmar la operación y registrar el cobro sin exigir correo, dejando la operación visible en «Falta facturar».

#### Scenario: Venta de mostrador en un solo paso
- **DADO** un Vendedor o la usuaria diaria en Venta rápida con un cliente identificado con correo, un producto con stock y condición «Contado»
- **CUANDO** elige el medio de pago y ejecuta «Cobrar y facturar»
- **ENTONCES** el sistema SHALL crear/confirmar la venta comercial, descontar inventario con Kardex, registrar el cobro completo, completar la preparación fiscal local y, si la entidad comercial tiene emisión en pruebas activa, solicitar su emisión en un solo paso.

### Requirement: Atomicidad por operación, idempotencia, concurrencia y tolerancia a fallos parciales

Cada paso económico (confirmar venta, confirmar operación artesanal, registrar cada pago, completar cada preparación fiscal, guardar correo del cliente y finalizar la orden) y la solicitud posterior de emisión electrónica SHALL ejecutarse de forma atómica dentro de su propio límite transaccional, protegiendo inventario, secuenciales y saldos contra concurrencia. El flujo SHALL admitir una clave de idempotencia por solicitud de ejecución para que un reintento de red o doble clic no duplique operaciones, numeraciones, pagos, retenciones, preparaciones fiscales ni envíos al proveedor de emisión. Si la preparación fiscal o la solicitud de emisión electrónica falla o queda en `en_proceso`, `error_temporal` o `no_autorizada` después de haberse confirmado la operación o registrado el cobro, la operación y el cobro SHALL permanecer en firme (`DP-034`, regla 5), y la respuesta SHALL detallar por negocio qué pasos quedaron completados y el estado exacto de la factura para permitir consultar o reintentar únicamente lo pendiente.

Trazabilidad: `DP-002`; `DP-006`; `DP-013`; `DP-034` regla 5; `DP-037`; `RF-FIS-009`; `RNF-DIS-009`; `RNF-INT-006/008`; `ADR-0010`; `ADR-0014`.

#### Scenario: Fallo de preparación o error de emisión tras cobro exitoso
- **DADO** un mantenimiento u operación donde las confirmaciones y los cobros se completan, pero la preparación fiscal de un negocio tiene un impedimento o la solicitud de emisión al adaptador devuelve `error_temporal` o `no_autorizada`
- **CUANDO** la usuaria diaria ejecuta «Cobrar y facturar»
- **ENTONCES** las operaciones confirmadas y los cobros registrados SHALL quedar en firme sin revertirse, y la pantalla SHALL mostrar claramente que el cobro quedó registrado y que la factura de ese negocio quedó pendiente o con error de emisión para reintentar o corregir después.

#### Scenario: Reintento o doble clic con la misma clave de idempotencia
- **DADO** una solicitud de «Cobrar y facturar» ya ejecutada con una clave de idempotencia
- **CUANDO** llega nuevamente la misma solicitud por doble clic o reintento de red
- **ENTONCES** el servidor SHALL devolver el resultado de la ejecución original sin crear segundos documentos, pagos, salidas de inventario, preparaciones ni emisiones duplicadas.

#### Scenario: Concurrencia sobre el último stock disponible
- **DADO** un producto con 1 unidad disponible usado en dos intentos simultáneos de «Cobrar y facturar»
- **CUANDO** ambos se ejecutan al mismo tiempo
- **ENTONCES** exactamente uno SHALL confirmar la venta y descontar la unidad, y el otro SHALL rechazarse por stock insuficiente sin quedar con existencia negativa ni pago registrado sobre la venta fallida.
