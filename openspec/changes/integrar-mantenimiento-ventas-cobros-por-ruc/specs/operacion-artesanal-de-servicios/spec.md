# Operación artesanal de servicios

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con P1 (estructura separada, DM-001 para V1), P2 (condición contado/crédito), P3 (importes e impuestos), P4 (alcance y momento), P5 (anulación) y P7; decisiones DP-003/004/006/015/017/018/020/025/027, CT-001; modelo de dominio §5.3, §6, §7 e invariantes 1, 2, 14, 15, 20, 21, 24 y 25; RN-FIS-003/005/006/008/009/010; RN-TAL-008…010/019; RN-VEN-018; RN-CON-007/009; RF-TAL-007/008; CU-017 6/8; UI-077; actores-y-roles §3.5; specs `servicios-aplicados-al-mantenimiento`, `configuracion-operativa-y-fiscal` y `ventas-comerciales` (política de desglose reutilizada).

La **operación artesanal de servicios** es el documento económico del RUC artesanal que convierte líneas de servicio concretas de una orden en un importe exigible. No existe en borrador persistido: las líneas de servicio no documentadas de la orden son el detalle pendiente, y la operación nace confirmada. Nunca afecta inventario. No es una factura electrónica autorizada por el SRI.

## ADDED Requirements

### Requirement: Documento separado del RUC artesanal

Cada operación artesanal SHALL pertenecer exclusivamente al **RUC artesanal**, SHALL referenciar una sola orden y SHALL tener como cliente el cliente de esa orden. SHALL contener únicamente líneas de servicio de esa orden; SHALL NOT contener productos, repuestos ni conceptos de otro emisor, ni combinarse con una venta comercial. Una orden SHALL poder tener varias operaciones artesanales a lo largo de su vida. La operación SHALL NOT generar movimientos de inventario, reservas ni salidas de Kardex. Trazabilidad: RN-FIS-003/005/006/008; RN-TAL-010; invariantes 1 y 2; RF-TAL-007; propuesta P1.

#### Scenario: Operación con solo servicios
- **DADO** una orden registrada con dos líneas de servicio de la intervención inicial y sin repuestos
- **CUANDO** un Encargado del taller confirma la operación artesanal
- **ENTONCES** SHALL existir una operación del RUC artesanal con esas dos líneas, y existencias, reservas y Kardex SHALL permanecer sin cambios.

#### Scenario: Intento de incluir un producto
- **DADO** una solicitud de operación artesanal que referencia un producto o una línea de la venta vinculada
- **CUANDO** se procesa
- **ENTONCES** el sistema SHALL rechazarla sin crear la operación.

### Requirement: Líneas documentables y documentación única

Al confirmar una operación, el sistema SHALL tomar todas las líneas de servicio de la **intervención inicial** de la orden que todavía no estén documentadas en una operación vigente. Cada línea de servicio SHALL identificarse por su propia identidad, no por el servicio del catálogo, y SHALL documentarse como máximo en una operación artesanal vigente. Las líneas de intervenciones correctivas SHALL NOT documentarse porque son sin cargo. Confirmar SHALL exigir al menos una línea documentable y un total mayor que cero; las líneas con precio aplicado USD 0,00 SHALL incluirse cuando acompañen a otras con importe. Si no hay líneas pendientes o su total es cero, la confirmación SHALL rechazarse sin crear un documento. La operación SHALL poder confirmarse con la orden `registrada`, `finalizada` o `reabierta`. Trazabilidad: RN-TAL-019; RF-TAL-008/020; CU-017 8/8a; propuesta P4.

#### Scenario: Servicio repetido documentado como líneas independientes
- **DADO** una orden con dos líneas de «Alineación» de USD 25,00 y USD 30,00
- **CUANDO** se confirma la operación artesanal
- **ENTONCES** la operación SHALL contener dos líneas independientes y un total de USD 55,00.

#### Scenario: Líneas añadidas después de una primera operación
- **DADO** una orden registrada cuya operación `ART-SER-000004` documentó «Alineación» por USD 25,00
- **CUANDO** se agrega «Balanceo» por USD 15,00 y se confirma otra operación
- **ENTONCES** la nueva operación SHALL contener solo «Balanceo», SHALL NOT volver a incluir «Alineación» y la orden SHALL relacionar ambas operaciones.

#### Scenario: Sin líneas pendientes o con total cero
- **DADO** una orden cuyas líneas iniciales ya están documentadas, o cuyas líneas pendientes suman USD 0,00
- **CUANDO** se solicita confirmar una operación artesanal
- **ENTONCES** el sistema SHALL rechazarlo explicando que no hay importe por documentar y SHALL NOT consumir numeración.

#### Scenario: Servicios correctivos no se documentan
- **DADO** una orden reabierta con la intervención inicial documentada y una intervención correctiva con «Ajuste de frenos» sin cargo
- **CUANDO** se solicita confirmar una operación artesanal
- **ENTONCES** el sistema SHALL rechazarlo porque no hay líneas documentables, y la línea correctiva SHALL permanecer sin documento ni deuda.

#### Scenario: Documentar servicios de una orden finalizada
- **DADO** una orden finalizada con líneas iniciales no documentadas por USD 80,00
- **CUANDO** un Encargado del taller confirma la operación artesanal
- **ENTONCES** SHALL crearse la operación por USD 80,00 sin cambiar el estado de la orden.

### Requirement: Importes e impuestos históricos de servicios

Para cada línea, el total SHALL ser cantidad × precio aplicado. La base SHALL obtenerse como total / (1 + tarifa/100), redondeada a centavos con HALF_UP, y el impuesto como total − base. Los totales del documento SHALL sumar las líneas ya calculadas. La tarifa SHALL resolverse con la definición tributaria artesanal conservada en la línea y la configuración vigente en la fecha efectiva de confirmación en America/Guayaquil, asignada por el sistema y sin retrofecha. La ausencia de una vigencia única SHALL ser un error corregible, nunca una exención ni una tarifa cero implícita; una tarifa cero SHALL aplicarse solo si está configurada. SHALL NOT fijarse tarifas en el código ni equipararse tratamientos distintos por producir un impuesto igual a cero. La operación SHALL conservar por línea el servicio, la descripción, la cantidad, el precio referencial y el precio aplicado, la definición tributaria, la tarifa, la base, el impuesto y el total, además del emisor, el cliente y el vehículo vigentes al confirmar. Los cambios posteriores del catálogo, la configuración, el cliente o el vehículo SHALL NOT modificarla. Trazabilidad: DP-017/020/025 (política extendida por P3); RN-FIS-010; RF-TAL-007; invariantes 14 y 15.

#### Scenario: Desglose con tarifa de ejemplo
- **DADO** una tarifa artesanal configurada de prueba de 15 % y una línea de 2 × USD 11,50
- **CUANDO** se confirma la operación
- **ENTONCES** la línea SHALL tener un total de USD 23,00, una base de USD 20,00 y un impuesto de USD 3,00, y la tarifa del ejemplo SHALL NOT convertirse en predeterminada.

#### Scenario: Tarifa cero configurada frente a vigencia ausente
- **DADO** una línea cuya definición artesanal tiene configurada una tarifa de 0 % y otra línea cuya definición carece de vigencia en la fecha de confirmación
- **CUANDO** se solicita confirmar
- **ENTONCES** SHALL rechazarse toda la operación identificando la línea sin vigencia, sin tratarla como tarifa cero y sin consumir numeración.

#### Scenario: Cambio del catálogo después de confirmar
- **DADO** una operación confirmada con «Alineación» a USD 25,00
- **CUANDO** cambian el precio referencial, el nombre o la definición tributaria del servicio, o los datos del cliente
- **ENTONCES** la operación y su comprobante SHALL conservar los valores confirmados.

#### Scenario: Importes enviados por el cliente
- **DADO** una solicitud de confirmación que incluye subtotales, impuestos o totales distintos
- **CUANDO** el servidor la procesa
- **ENTONCES** SHALL ignorarlos o rechazarlos y SHALL conservar los importes que calculó.

### Requirement: Revisión explícita antes de confirmar

Antes de confirmar, el sistema SHALL presentar una vista previa sin efectos con las líneas que se documentarán, sus importes e impuestos, el emisor artesanal, el cliente, la condición elegida y los efectos: numeración ART-SER, nacimiento del saldo y ausencia de efectos de inventario. Confirmar SHALL exigir esa revisión. Si después de revisar cambian las líneas pendientes, sus precios o cantidades, la tarifa aplicable, la condición o la fecha efectiva, la confirmación SHALL rechazarse exigiendo una nueva revisión con los valores actuales. La vista previa SHALL NOT consumir numeración, crear deuda ni bloquear líneas. Trazabilidad: DP-025/026 (revisión explícita); RF-TAL-008; UI-077; propuesta P3.

#### Scenario: Línea modificada después de la revisión
- **DADO** una vista previa con «Alineación» a USD 25,00
- **CUANDO** otro usuario cambia su precio aplicado a USD 28,00 y se intenta confirmar con la revisión anterior
- **ENTONCES** SHALL exigirse revisar los valores actuales, sin crear la operación.

### Requirement: Confirmación atómica, numeración e idempotencia

Un usuario con `servicios_economicos.confirmar` (Administrador o Encargado del taller) SHALL confirmar la operación eligiendo la condición CONTADO o CREDITO. En una sola acción atómica SHALL asignarse el siguiente número de la serie activa del ámbito artesanal de servicios (inicialmente ART-SER), congelarse los valores, vincularse cada línea documentada, crearse el importe exigible y registrarse la auditoría. Si falla cualquier paso, SHALL NOT quedar número, documento, vínculo ni deuda de ese intento, y las líneas SHALL seguir pendientes. SHALL NOT consumirse la serie ART-OT, series comerciales ni secuencias de facturación electrónica. Repetir una confirmación con la misma identidad de intento y contenido compatible SHALL devolver el resultado existente; reutilizar la identidad con otro contenido SHALL responder conflicto. Dos confirmaciones simultáneas sobre la misma orden SHALL NOT documentar dos veces una misma línea. Confirmar SHALL NOT registrar pagos. Trazabilidad: DP-006/027; RN-VEN-018; RF-TAL-008; RNF-INT-001/003/004/009; ADR-0004.

#### Scenario: Primera operación artesanal
- **DADO** una serie artesanal activa ART-SER sin uso y una orden con servicios pendientes
- **CUANDO** se confirma la primera operación
- **ENTONCES** SHALL recibir el número `ART-SER-000001` y SHALL NOT avanzar ART-OT, COM-VEN ni otras series.

#### Scenario: Doble clic en confirmar
- **DADO** una operación que se está confirmando
- **CUANDO** llega la misma solicitud otra vez con la misma identidad de intento
- **ENTONCES** SHALL existir una sola operación, un solo número y un solo saldo.

#### Scenario: Dos usuarios documentan la misma orden a la vez
- **DADO** una orden con tres líneas pendientes
- **CUANDO** dos usuarios confirman al mismo tiempo una operación sobre esa orden con intentos distintos
- **ENTONCES** SHALL confirmarse como máximo una operación con esas líneas, y la otra SHALL rechazarse por conflicto o por falta de líneas pendientes, sin número ni deuda.

#### Scenario: Falla un paso de la confirmación
- **DADO** una operación válida
- **CUANDO** falla la asignación del número o cualquier escritura posterior
- **ENTONCES** SHALL NOT quedar operación, vínculo, número consumido ni saldo, y las líneas SHALL seguir pendientes de documentar.

### Requirement: Bloqueo de líneas documentadas

Una línea de servicio documentada en una operación vigente SHALL NOT modificarse ni retirarse por ninguna acción ordinaria de la orden o de sus servicios, para ningún rol, aunque la orden siga `registrada`. Su precio aplicado, cantidad, definición tributaria y servicio SHALL permanecer iguales a los documentados. La orden SHALL identificar cada línea como documentada, con su número de operación, o como pendiente de documentar. Trazabilidad: RN-VEN-006 (por analogía confirmada en P4); invariante 20; propuesta P4.

#### Scenario: Intento de cambiar el precio de una línea documentada
- **DADO** una orden registrada con «Alineación» documentada en `ART-SER-000004`
- **CUANDO** un Encargado del taller intenta cambiar su precio aplicado o retirarla
- **ENTONCES** el sistema SHALL rechazarlo explicando que la línea pertenece a una operación confirmada.

### Requirement: Anulación de la operación artesanal

Solo un usuario con `servicios_economicos.anular` (Administrador) SHALL anular una operación artesanal confirmada, con motivo no vacío, revisión vigente y como acción atómica e idempotente. La anulación SHALL exigir que la operación no tenga pagos efectivos vigentes; si los tiene, SHALL bloquearse explicando que primero deben corregirse los pagos registrados por error mediante el procedimiento administrativo, y que la devolución de dinero realmente recibido (reembolso) no forma parte de esta entrega. La anulación SHALL conservar la operación, sus líneas, su número, sus importes y sus vínculos, SHALL dejar su exigible en cero y SHALL registrar motivo, usuario y fecha. Tras la anulación, sus líneas SHALL volver a estar pendientes de documentar. Una nueva operación que las incluya SHALL registrar que reemplaza a la anulada y la revisión previa SHALL advertirlo; SHALL NOT existir otra forma de volver a documentarlas. La anulación SHALL NOT afectar inventario, ventas comerciales ni el estado de la orden. Trazabilidad: RN-VEN-016 (por analogía); RN-CON-007; RF-PAG-008; invariante 20; propuesta P5.

#### Scenario: Anular una operación sin pagos
- **DADO** una operación `ART-SER-000004` confirmada sin pagos
- **CUANDO** el Administrador la anula con el motivo «precio aplicado equivocado»
- **ENTONCES** SHALL quedar anulada con exigible cero, número conservado y motivo registrado, y sus líneas SHALL quedar pendientes de documentar.

#### Scenario: Anulación bloqueada por pagos efectivos
- **DADO** una operación con un pago vigente de USD 30,00
- **CUANDO** el Administrador intenta anularla
- **ENTONCES** SHALL rechazarse explicando que debe corregirse primero el pago registrado por error y que no existe reembolso en esta entrega, sin cambiar la operación ni el pago.

#### Scenario: Volver a documentar después de anular
- **DADO** la operación anulada `ART-SER-000004` y la orden todavía registrada
- **CUANDO** se corrige el precio aplicado de la línea y se confirma una nueva operación
- **ENTONCES** la nueva operación SHALL recibir otro número, SHALL registrar que reemplaza a `ART-SER-000004` y ambas SHALL permanecer consultables desde la orden.

#### Scenario: Encargado del taller intenta anular
- **DADO** un usuario con solo el rol Encargado del taller
- **CUANDO** solicita anular una operación artesanal
- **ENTONCES** el sistema SHALL denegarlo sin efectos.

### Requirement: Consulta y comprobante interno artesanal

Un usuario con `servicios_economicos.ver` (Administrador o Encargado del taller) SHALL consultar la operación desde la orden y la orden desde la operación. El detalle SHALL mostrar número, estado, fecha, emisor artesanal, cliente y vehículo conservados, condición, líneas con su desglose, totales, pagado, saldo, estado de pago, la cadena de reemplazo y la anulación cuando existan. El **documento interno** imprimible SHALL identificar el RUC artesanal, el cliente, el vehículo, los servicios, los importes, los pagos y el número, y SHALL declarar que no constituye una factura electrónica autorizada por el SRI. Estado del documento, estado de pago y futura referencia fiscal SHALL ser independientes. Un Vendedor sin rol de taller SHALL NOT consultarla. Trazabilidad: DP-018; RN-CON-009; RN-FIS-009; RF-TAL-012; UI-077; modelo de dominio §5.3.

#### Scenario: Imprimir el comprobante artesanal
- **DADO** una operación confirmada con un pago parcial
- **CUANDO** un Encargado del taller solicita su comprobante
- **ENTONCES** SHALL mostrarse el RUC artesanal, los servicios, el total, lo pagado, el saldo y el aviso de documento no autorizado por el SRI, sin repuestos ni importes comerciales.

#### Scenario: Vendedor intenta consultar una operación artesanal
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** accede directamente a una operación artesanal
- **ENTONCES** el sistema SHALL denegarlo sin revelar su existencia ni sus datos.

### Requirement: Órdenes anteriores a esta entrega

Las órdenes existentes antes de esta entrega SHALL conservar su historial sin cambios. SHALL NOT crearse automáticamente operaciones artesanales, deudas ni pagos para ellas mediante migraciones o procesos en segundo plano. Sus líneas iniciales SHALL mostrarse como pendientes de documentar y SHALL documentarse únicamente mediante la misma acción explícita de confirmación. En esas órdenes, la revisión previa SHALL advertir que se verifique que los servicios no se cobraron fuera del sistema. Trazabilidad: propuesta P4; límites de V1.

#### Scenario: Orden finalizada antes de la entrega
- **DADO** una orden finalizada antes de esta entrega con servicios por USD 120,00
- **CUANDO** se despliega la entrega
- **ENTONCES** SHALL NOT existir una operación ni un saldo para esa orden hasta que un usuario autorizado la confirme explícitamente tras la advertencia.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
