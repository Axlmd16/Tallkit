## ADDED Requirements

### Requirement: Marca opcional de agente de retención

La ficha del **cliente** SHALL admitir una marca opcional «Agente de retención», desactivada por defecto y compartida por las dos entidades fiscales. Quien puede editar clientes SHALL poder activarla o desactivarla; el cambio SHALL quedar auditado. La marca SHALL ser una declaración manual: SHALL NOT consultarse ni afirmarse verificada ante el SRI, bloquear operaciones, calcular valores ni modificar cobros, retenciones o documentos anteriores. Trazabilidad: propuesta de retenciones C11…C13, D5; RN-CLI-001; RF-CLI-004.

#### Scenario: Cliente existente sin marca
- **DADO** los clientes registrados antes de este cambio
- **CUANDO** se consulta cualquiera de ellos
- **ENTONCES** SHALL mostrarse sin la marca de agente de retención.

#### Scenario: Activar la marca
- **DADO** un cliente sin la marca
- **CUANDO** un usuario con permiso de edición la activa
- **ENTONCES** SHALL guardarse y verse en ambas entidades, sin alterar sus operaciones ni saldos.

#### Scenario: La marca no bloquea
- **DADO** un cliente sin la marca y una entidad que registra retenciones
- **CUANDO** se registra una retención sobre una operación suya
- **ENTONCES** SHALL admitirse igual que para un cliente marcado.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
