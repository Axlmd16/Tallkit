## ADDED Requirements

### Requirement: Detalle de servicio conservado en la operación

Al confirmar una operación artesanal, cada línea SHALL conservar una copia histórica de su **detalle de servicio**. La revisión previa SHALL mostrarlo; si cambia después de revisar, la confirmación SHALL exigir una nueva revisión. El detalle de una línea documentada SHALL NOT modificarse por ninguna acción ordinaria, y un cambio posterior en la orden SHALL NOT alterar la copia.

La consulta de la operación y su **documento interno** SHALL mostrar el detalle junto a su línea. Una línea sin detalle SHALL mostrarse sin espacio vacío. Si la operación se anula, la línea SHALL conservar su detalle para volver a documentarse. Las operaciones anteriores SHALL conservarse sin detalle, sin completarlas de forma retroactiva.

Trazabilidad: propuesta §A.3 y §C; DP-035 regla 3; RN-CON-002; RF-TAL-008; UI-077; invariante 20 del modelo de dominio.

#### Scenario: Confirmar conserva el detalle
- **DADO** una orden con «Alineación» y el detalle «incluye rotación de llantas»
- **CUANDO** se confirma la operación artesanal
- **ENTONCES** la línea de la operación SHALL conservar ese detalle.

#### Scenario: Comprobante interno con detalle
- **DADO** una operación confirmada con una línea con detalle y otra sin él
- **CUANDO** un Encargado del taller imprime su comprobante
- **ENTONCES** la primera línea SHALL mostrar su detalle y la segunda SHALL mostrarse sin espacio vacío.

#### Scenario: Detalle cambiado después de revisar
- **DADO** una vista previa con el detalle «frenos delanteros»
- **CUANDO** otro usuario lo cambia y se intenta confirmar con la revisión anterior
- **ENTONCES** SHALL exigirse revisar los valores actuales, sin crear la operación.

#### Scenario: Intento de cambiar una línea documentada
- **DADO** una operación vigente con una línea con detalle
- **CUANDO** un Administrador intenta cambiar el detalle
- **ENTONCES** el sistema SHALL rechazarlo y la operación y su comprobante SHALL conservar el texto confirmado.

#### Scenario: Volver a documentar después de anular
- **DADO** una operación anulada cuya línea tenía detalle
- **CUANDO** se corrige el detalle y se confirma una operación nueva
- **ENTONCES** la operación anulada SHALL conservar el texto original y la nueva SHALL usar el corregido.

#### Scenario: Operación anterior
- **DADO** una operación confirmada antes de existir el detalle de servicio
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrarse sin detalle y sin cambios.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
