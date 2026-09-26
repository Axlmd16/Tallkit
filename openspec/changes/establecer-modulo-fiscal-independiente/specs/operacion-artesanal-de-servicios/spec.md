## ADDED Requirements

### Requirement: Acceso fiscal artesanal separado de repuestos

Administrador y Encargado del taller SHALL poder preparar y consultar el expediente fiscal de una operación artesanal confirmada y acceder a evidencias vinculadas según sus permisos. SHALL mostrar por separado **documento interno**, **estado de pago**, preparación y evidencia externa no verificada. Un Vendedor sin rol de taller SHALL NOT consultar ese expediente aunque comparta el cliente o tenga acceso a la venta de repuestos de la misma orden. La preparación SHALL incluir únicamente los servicios de su operación artesanal y conservar el emisor artesanal; SHALL NOT mezclar ni sumar documentos comerciales. Trazabilidad: propuesta P1/P2 y Modified Capabilities; DP-018/029; RN-FIS-003/005/006/009; RF-TAL-008.

#### Scenario: Orden con servicios y repuestos
- **DADO** una orden con una operación artesanal y una venta comercial confirmadas
- **CUANDO** el Encargado prepara el documento fiscal de servicios
- **ENTONCES** SHALL utilizarse únicamente la operación artesanal, sin añadir repuestos, importes ni datos fiscales del otro emisor.

#### Scenario: Vendedor accede por cliente compartido
- **DADO** un Vendedor sin rol de taller que conoce el cliente de la orden
- **CUANDO** intenta consultar el expediente artesanal
- **ENTONCES** SHALL denegarse sin revelar el XML ni sus datos fiscales.

### Requirement: Información fiscal adicional sin reescribir la operación artesanal

La preparación SHALL permitir completar datos fiscales faltantes conservando la instantánea interna de cliente, vehículo, servicios e importes. SHALL NOT cambiar propietario, cliente de la orden, saldo, pagos o estado del mantenimiento como efecto de completar la preparación. Generar una operación artesanal, finalizar o reabrir una orden SHALL NOT transmitir ni autorizar documentos. La falta de perfil fiscal adicional SHALL NOT alterar los requisitos actuales de confirmación; el historial anterior SHALL permanecer sin preparaciones automáticas. Trazabilidad: propuesta §4/5/6 y P2; DP-008/017/018/029; RN-CON-002/010.

#### Scenario: Completar datos que la orden no conservaba
- **DADO** una operación artesanal cuya instantánea de cliente solo contiene nombre e identificación
- **CUANDO** el Encargado completa los datos requeridos en la preparación fiscal
- **ENTONCES** SHALL conservarse una instantánea fiscal separada sin modificar el comprobante interno anterior.

#### Scenario: Anulación artesanal posterior
- **DADO** una operación con preparación fiscal y que cumple las condiciones internas para anularse
- **CUANDO** el Administrador la anula por el procedimiento vigente
- **ENTONCES** SHALL conservarse el expediente fiscal y señalarse la discrepancia para revisión, sin declarar anulación ante el SRI.

#### Scenario: Reapertura del mantenimiento
- **DADO** una orden con operación artesanal documentada
- **CUANDO** se reabre por corrección del taller
- **ENTONCES** SHALL conservarse la historia fiscal y SHALL NOT producirse una nueva factura ni una nota de crédito automática.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
