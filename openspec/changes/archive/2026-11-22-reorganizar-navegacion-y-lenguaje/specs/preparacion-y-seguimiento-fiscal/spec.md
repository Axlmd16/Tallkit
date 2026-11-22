## ADDED Requirements

### Requirement: Lista de preparaciones locales de factura

El sistema SHALL ofrecer una consulta paginada, de solo lectura, de las preparaciones locales de factura de las entidades fiscales que el usuario pueda consultar según sus permisos fiscales (`fiscal.comercial.ver`, `fiscal.artesanal.ver`). SHALL devolver por fila la entidad fiscal, el origen (venta comercial u operación artesanal), su número interno, el cliente, el total, la fecha y el estado local (borrador, preparada o cancelada), y SHALL poder filtrarse por entidad y por estado, con orden estable, total y paginación en el servidor. El servidor SHALL omitir las filas de la entidad que el usuario no pueda consultar y SHALL rechazar un filtro por esa entidad. La consulta SHALL NOT crear, modificar ni cancelar preparaciones, no SHALL transmitir nada ni exigir configuración de emisión, y SHALL NOT presentar un estado local como enviado, autorizado o emitido.

Trazabilidad: `DP-034`, regla 8; `DP-036`, regla 8; `RN-FIS-009`; `RF-FIS-002`; `RNF-SEG-003`; `navegacion-de-uso-diario` («Facturas antes de la emisión real»); propuesta, decisión 3.

#### Scenario: Consulta con los dos negocios
- **DADO** preparaciones de ambas entidades y un usuario con los dos permisos de consulta
- **CUANDO** consulta la lista sin filtros
- **ENTONCES** SHALL recibir todas, paginadas y con su total, cada una con su entidad y su estado local.

#### Scenario: Filtro por una entidad no permitida
- **DADO** un usuario que solo puede consultar la entidad artesanal
- **CUANDO** consulta la lista o filtra directamente por la entidad comercial
- **ENTONCES** SHALL recibir solo filas de la artesanal, y el filtro por la comercial SHALL rechazarse sin revelar si existen preparaciones.

#### Scenario: Consulta sin efectos
- **DADO** cualquier consulta de la lista
- **CUANDO** se repite varias veces
- **ENTONCES** SHALL NOT cambiar preparaciones, numeración, inventario ni cobros.
