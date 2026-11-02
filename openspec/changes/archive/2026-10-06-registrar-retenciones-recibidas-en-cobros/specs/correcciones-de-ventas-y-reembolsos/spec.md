## ADDED Requirements

### Requirement: Reembolso limitado al dinero cobrado cuando hay retenciones

Cuando una venta tenga **retenciones recibidas** vigentes, el **reembolso** SHALL limitarse al dinero efectivamente cobrado neto de reembolsos anteriores; un valor retenido SHALL NOT reembolsarse ni convertirse en saldo a favor. La parte del exceso que corresponda a retenciones SHALL mostrarse como retención en exceso, separada de la obligación de reembolso, hasta que el Administrador anule la retención con motivo. Trazabilidad: propuesta de retenciones D16; DP-014/028; RN-VEN-019; RF-VEN-017.

#### Scenario: Devolución total de una venta con retención
- **DADO** una venta de 250.00 con dinero cobrado 245.00 y retención vigente 5.00
- **CUANDO** una devolución reduce el exigible a 0.00
- **ENTONCES** SHALL mostrarse 245.00 pendientes de reembolso y 5.00 de retención en exceso; un intento de reembolsar 250.00 SHALL rechazarse.

#### Scenario: Resolver la retención en exceso
- **DADO** una venta con 5.00 de retención en exceso
- **CUANDO** el Administrador anula esa retención con motivo
- **ENTONCES** SHALL desaparecer la retención en exceso sin crear deuda ni reembolso.

### Requirement: Anulación de la venta con retenciones vigentes

Una venta con retenciones vigentes SHALL NOT anularse. El intento SHALL bloquearse explicando que primero deben anularse sus retenciones con motivo, sin anularlas de forma automática ni inventar un reembolso. Trazabilidad: propuesta de retenciones D14; RN-VEN-016; RF-VEN-011.

#### Scenario: Intento de anular una venta con retención
- **DADO** una venta directa confirmada, por lo demás anulable, con una retención vigente de 5.00
- **CUANDO** el Administrador intenta anularla
- **ENTONCES** SHALL bloquearse identificando la retención, sin movimientos de inventario ni cambios en la venta.
