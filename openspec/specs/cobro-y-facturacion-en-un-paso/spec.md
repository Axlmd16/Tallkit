# cobro-y-facturacion-en-un-paso Specification

## Purpose

Permitir confirmar, cobrar y preparar facturas locales en un solo paso («Cobrar y facturar») desde un mantenimiento o una venta comercial (directa o venta rápida), manteniendo estricta separación fiscal y de pagos entre negocios, autorización por rol en el servidor, idempotencia y tolerancia a fallos parciales.

## Requirements

### Requirement: Prevalidación y revisión única de «Cobrar y facturar»

El sistema SHALL ofrecer el flujo «Cobrar y facturar» desde una orden de mantenimiento y desde una venta comercial (directa o venta rápida), reuniendo en una sola revisión los valores calculados por el servidor para las partes que el usuario está autorizado a operar. Antes de ejecutar, el servidor SHALL comprobar permisos efectivos, vigencia y precios de catálogo, disponibilidad y existencias de repuestos, líneas iniciales de servicio pendientes de documentar, saldos vigentes, configuración fiscal del emisor, requisitos de finalización del mantenimiento y validez del correo del receptor. Cada negocio SHALL identificarse por su nombre comercial (o razón social como respaldo) y mostrar sus líneas, subtotal/total y estado de cobro y factura por separado, sin mezclar documentos ni crear un saldo combinado cobrable. Esta pantalla SHALL actuar como confirmación única de las acciones que agrupa, sin diálogos repetidos por paso.

Trazabilidad: `DP-036` reglas 1, 2 y 3; `DP-037` (propuesta U6); `DP-021`; `DP-026`; `DP-029`; `RN-FIS-008/009`; `RNF-USA-003/010`; `interfaz-y-navegacion.md` §6.6 y §8.1.

#### Scenario: Revisión de un mantenimiento con servicios y repuestos
- **DADO** una orden registrada con diagnóstico, un servicio inicial pendiente por USD 20,00 y una venta vinculada abierta con un repuesto por USD 23,00 con stock disponible, para un cliente con correo registrado
- **CUANDO** la usuaria diaria (con los tres roles) abre «Cobrar y facturar» desde la orden
- **ENTONCES** el sistema SHALL mostrar en una sola pantalla dos bloques separados por nombre comercial (mano de obra USD 20,00 y repuestos USD 23,00), el correo precargado del cliente, la casilla para guardar correo en la ficha activada por omisión, la casilla «Cerrar el mantenimiento al cobrar» activada por omisión y el aviso de que se registrarán dos cobros y se prepararán dos facturas locales independientes.

#### Scenario: Prevalidación bloqueada por stock insuficiente o precio desactualizado
- **DADO** una venta en borrador o venta vinculada abierta cuyo producto carece de existencias suficientes o cambió de precio en el catálogo
- **CUANDO** el usuario abre o intenta ejecutar «Cobrar y facturar»
- **ENTONCES** el servidor SHALL impedir la confirmación comercial señalando la causa exacta y los valores vigentes, sin descontar inventario, crear pagos, emitir numeración ni modificar la operación.

### Requirement: Autorización por rol y aislamiento por entidad fiscal

El servidor SHALL decidir qué bloques y acciones del flujo «Cobrar y facturar» puede ver y ejecutar cada usuario según sus permisos efectivos, sin ampliar las atribuciones de los roles fijos. Un Administrador o una usuaria diaria con los tres roles SHALL poder operar ambos negocios. Un Encargado del taller sin rol comercial SHALL operar únicamente la parte artesanal (servicios, su cobro, su preparación fiscal y el cierre del mantenimiento cuando no existan repuestos pendientes) y SHALL NOT confirmar, cobrar ni facturar la venta comercial. Un Vendedor sin rol de taller SHALL operar únicamente la parte comercial (venta, su cobro y su preparación fiscal) y SHALL NOT confirmar operaciones artesanales, cobrar servicios ni finalizar mantenimientos. Ninguna acción SHALL mezclar documentos, secuencias, pagos, saldos ni preparaciones fiscales entre entidades.

Trazabilidad: `CT-001`; `DP-036` regla 1; `actores-y-roles.md` §3, §4 y §5; `RN-FIS-008/009`; `RNF-SEG-003`; invariantes 1 y 2 del modelo de dominio.

#### Scenario: Encargado del taller sin rol comercial
- **DADO** un usuario con solo el rol Encargado del taller y una orden con servicios pendientes y una venta vinculada abierta con repuestos
- **CUANDO** abre «Cobrar y facturar» o intenta ejecutar el bloque comercial directamente en el servidor
- **ENTONCES** el sistema SHALL permitirle operar únicamente el bloque artesanal, SHALL ocultar las acciones comerciales y SHALL rechazar cualquier intento en el servidor de confirmar, cobrar o facturar la venta comercial o de finalizar la orden mientras queden repuestos sin confirmar.

#### Scenario: Vendedor sin rol de taller
- **DADO** un usuario con solo el rol Vendedor y una orden con repuestos pendientes y servicios pendientes
- **CUANDO** abre «Cobrar y facturar» o intenta ejecutar el bloque artesanal o el cierre de la orden en el servidor
- **ENTONCES** el sistema SHALL permitirle operar únicamente la venta comercial y SHALL rechazar cualquier intento en el servidor de confirmar servicios, cobrarlos, prepararlos fiscalmente o cerrar el mantenimiento.

### Requirement: Ejecución separada de confirmación, cobro independiente y preparación fiscal

Al ejecutar «Cobrar y facturar», el sistema SHALL aplicar por separado y en orden, únicamente para los bloques autorizados y solicitados:

1. Confirmación de la operación artesanal con las líneas iniciales pendientes de la orden (documentándolas una sola vez conforme a `DP-029`, si aún no lo están) y/o confirmación de la venta comercial abierta (descontando inventario y generando Kardex atómicamente conforme a `DP-002`).
2. Registro de un pago independiente por cada operación económica que reciba dinero (`DP-013`), usando exclusivamente medios reales permitidos en V1 (`EFECTIVO`, `TRANSFERENCIA` o combinación explícita de ambos por operación, nunca «Tarjeta») y, cuando corresponda y la entidad lo habilite, el registro opcional de retención recibida (`DP-032`). En condición **Crédito («Queda debiendo»)** SHALL confirmarse la operación a crédito sin crear un pago (o registrando solo el abono parcial indicado expresamente por negocio). El vuelto en efectivo SHALL ser solo un cálculo orientativo y nunca alterar el importe aplicado.
3. Preparación local de la factura independiente de cada operación confirmada que tenga datos fiscales completos, usando la instantánea fiscal vigente de formato 4 y el plazo en días (1 a 9999) cuando quede saldo a crédito (`DP-035`), dejándola en estado local **«Factura preparada (sin enviar)»** y sin presentarla como enviada ni autorizada ante el SRI (`DP-034`, regla 8).

Si el usuario elige explícitamente la acción secundaria **«Solo cobrar (facturar después)»** (por ejemplo cuando falta el correo o existe un impedimento fiscal), el sistema SHALL ejecutar los pasos 1 y 2 sin exigir correo ni preparar la factura, dejando las operaciones confirmadas pendientes de facturar.

Trazabilidad: `DP-002`; `DP-003`; `DP-013`; `DP-025`; `DP-027`; `DP-029`; `DP-032`; `DP-034` reglas 5 y 8; `DP-035`; `DP-036` reglas 2 y 4; `DP-037` (decisiones #6, #7, #8 y #9); `RF-PAG-010`; `RF-FIS-001/002`.

#### Scenario: Cobrar y facturar un mantenimiento completo al contado
- **DADO** una orden registrada con un servicio pendiente de USD 20,00 y una venta vinculada abierta de USD 23,00, cliente con correo válido y configuración fiscal lista en ambos negocios
- **CUANDO** la usuaria diaria elige «Efectivo» y ejecuta «Cobrar y facturar»
- **ENTONCES** el servidor SHALL confirmar una operación artesanal (`ART-SER-*`) por USD 20,00 y una venta comercial (`COM-VEN-*`) por USD 23,00 con su salida de Kardex, SHALL registrar un pago artesanal de USD 20,00 y un pago comercial independiente de USD 23,00, y SHALL completar dos preparaciones fiscales locales independientes en estado «Preparada, sin enviar».

#### Scenario: Pago parcial o combinado por negocio y condición a crédito
- **DADO** una orden con servicios por USD 20,00 y repuestos por USD 23,00
- **CUANDO** la usuaria diaria selecciona pago parcial indicando USD 20,00 para servicios y USD 10,00 para repuestos (o elige «Queda debiendo» con plazo de 30 días, o combina efectivo y transferencia indicando el desglose)
- **ENTONCES** el sistema SHALL exigir importes explícitos por negocio sin repartir un monto único en silencio, SHALL registrar pagos independientes por los importes exactos indicados (o ninguno si es a crédito sin abono) y SHALL registrar el plazo en días únicamente en las facturas locales con saldo pendiente, sin crear vencimiento ni mora.

#### Scenario: Solo cobrar cuando falta correo o hay bloqueo fiscal
- **DADO** una venta o mantenimiento de un cliente sin correo en su ficha
- **CUANDO** el usuario intenta «Cobrar y facturar» sin escribir correo y luego elige «Solo cobrar (facturar después)»
- **ENTONCES** «Cobrar y facturar» SHALL permanecer bloqueado por el correo faltante, mientras que «Solo cobrar (facturar después)» SHALL confirmar la operación y registrar el cobro sin exigir correo, dejando la operación visible en «Falta facturar».

#### Scenario: Venta de mostrador en un solo paso
- **DADO** un Vendedor o la usuaria diaria en Venta rápida con un cliente identificado con correo, un producto con stock y condición «Contado»
- **CUANDO** elige el medio de pago y ejecuta «Cobrar y facturar»
- **ENTONCES** el sistema SHALL crear/confirmar la venta comercial, descontar inventario con Kardex, registrar el cobro completo y completar la preparación fiscal local en un solo paso, sin exigir guardar borrador ni abrir otra pantalla.

### Requirement: Cierre opcional del mantenimiento al cobrar

Cuando «Cobrar y facturar» se abre desde una orden de mantenimiento en estado `registrado` y el usuario tiene el permiso `mantenimientos.finalizar`, el sistema SHALL ofrecer la casilla explícita **«Cerrar el mantenimiento al cobrar»**, marcada por omisión si la orden ya tiene diagnóstico no vacío y al menos una línea de servicio. El cierre SHALL ejecutarse únicamente *después* de que la venta vinculada haya quedado confirmada (sin venta abierta con líneas), preservando `DP-021`: el botón «Finalizar» de la ficha sigue sin confirmar ventas automáticamente. Si el usuario desmarca la casilla, o si la orden carece de diagnóstico o de servicios o mantiene repuestos abiertos sin confirmar, la orden SHALL permanecer abierta informando el motivo sin deshacer los cobros ya registrados.

Trazabilidad: `DP-021`; `DP-036` regla 2; `DP-037` (decisión #5); `RN-TAL-004/014`; `RF-TAL-011`; `ordenes-de-mantenimiento` («Finalización explícita y atómica»).

#### Scenario: Cierre automático al cobrar cuando la orden cumple requisitos
- **DADO** una orden registrada con diagnóstico, un servicio y una venta vinculada abierta, con la casilla «Cerrar el mantenimiento al cobrar» marcada
- **CUANDO** la usuaria diaria ejecuta «Cobrar y facturar» y la venta vinculada se confirma correctamente
- **ENTONCES** la orden SHALL finalizarse automáticamente tras confirmar la venta, registrando usuario, fecha y hora, sin pedir una segunda ventana de confirmación.

#### Scenario: Orden sin diagnóstico o con casilla desmarcada
- **DADO** una orden registrada sin diagnóstico (o con la casilla «Cerrar el mantenimiento al cobrar» desmarcada)
- **CUANDO** el usuario ejecuta «Cobrar y facturar»
- **ENTONCES** el cobro y la preparación fiscal SHALL completarse normalmente y la orden SHALL permanecer registrada explicando que no se cerró.

### Requirement: Atomicidad por operación, idempotencia, concurrencia y tolerancia a fallos parciales

Cada paso económico (confirmar venta, confirmar operación artesanal, registrar cada pago, completar cada preparación fiscal, guardar correo del cliente y finalizar la orden) SHALL ejecutarse de forma atómica dentro de su propio límite transaccional, protegiendo inventario, secuenciales y saldos contra concurrencia. El flujo SHALL admitir una clave de idempotencia por solicitud de ejecución para que un reintento de red o doble clic no duplique operaciones, numeraciones, pagos, retenciones ni preparaciones fiscales. Si la preparación fiscal falla por un dato incompleto o un impedimento técnico después de haberse confirmado la operación o registrado el cobro, la operación y el cobro SHALL permanecer en firme (`DP-034`, regla 5), y la respuesta SHALL detallar por negocio qué pasos quedaron completados y cuál falló para permitir reintentar únicamente lo pendiente.

Trazabilidad: `DP-002`; `DP-006`; `DP-013`; `DP-034` regla 5; `DP-037`; `RNF-INT-006/008`.

#### Scenario: Fallo de preparación fiscal tras cobro exitoso
- **DADO** un mantenimiento con configuración fiscal artesanal válida y un impedimento fiscal en el negocio comercial (por ejemplo, código de producto mayor a 25 caracteres)
- **CUANDO** la usuaria diaria ejecuta «Cobrar y facturar»
- **ENTONCES** las operaciones confirmadas y los cobros registrados SHALL quedar en firme sin revertirse, la factura artesanal SHALL quedar preparada, y la pantalla SHALL mostrar claramente que la factura comercial quedó pendiente indicando el motivo corregible.

#### Scenario: Reintento o doble clic con la misma clave de idempotencia
- **DADO** una solicitud de «Cobrar y facturar» ya ejecutada con una clave de idempotencia
- **CUANDO** llega nuevamente la misma solicitud por doble clic o reintento de red
- **ENTONCES** el servidor SHALL devolver el resultado de la ejecución original sin crear segundos documentos, pagos, salidas de inventario ni preparaciones duplicadas.

#### Scenario: Concurrencia sobre el último stock disponible
- **DADO** un producto con 1 unidad disponible usado en dos intentos simultáneos de «Cobrar y facturar»
- **CUANDO** ambos se ejecutan al mismo tiempo
- **ENTONCES** exactamente uno SHALL confirmar la venta y descontar la unidad, y el otro SHALL rechazarse por stock insuficiente sin quedar con existencia negativa ni pago registrado sobre la venta fallida.
