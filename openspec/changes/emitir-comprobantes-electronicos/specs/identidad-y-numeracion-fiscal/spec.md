## MODIFIED Requirements

### Requirement: Producción sin asignación ni colisión con emisión externa

El sistema SHALL permitir al Administrador registrar antecedentes de numeración externa y el **último secuencial autorizado** por entidad fiscal, tipo documental, establecimiento, punto de emisión y ambiente, con fecha, procedencia y responsable, distinguiendo un punto de emisión electrónico exclusivo (`NOR-007`) de series históricas usadas en otras herramientas como el Facturador gratuito del SRI.

En esta entrega (cambio 3), conforme a `DP-034` regla 8, el sistema SHALL continuar operando únicamente en ambiente de *Pruebas* (`1`) y SHALL NOT asignar identidades ni emitir comprobantes en ambiente de *Producción* (`2`), aunque el perfil del emisor esté completo y los antecedentes productivos estén registrados.

Cuando una emisión en ambiente de pruebas sea autorizada mediante el adaptador configurado, el sistema SHALL conservar la identidad fiscal devuelta o confirmada (secuencial de nueve dígitos y clave de acceso de 49 dígitos) y actualizar atómicamente el **último secuencial autorizado** de esa serie para que la numeración sea portable si se cambia de proveedor de emisión. Una importación al archivo fiscal SHALL conservar la identidad del documento sin retroceder el último secuencial autorizado ni convertir antecedentes en activación productiva.

Trazabilidad: propuesta P2/P4/P5; propuesta `emitir-comprobantes-electronicos` §A.1, §B.4 y §B.6; `DP-006`; `DP-018`; `DP-034`, reglas 3, 4 y 8; `RN-FIS-012`, `RN-FIS-017`; `RF-FIS-003`, `RF-FIS-008`; `NOR-007`; `docs/cambios-pendientes.md` (regla de independencia, punto 9).

#### Scenario: Intento de numerar o emitir en producción durante el cambio 3
- **DADO** un perfil completo con antecedentes productivos y último secuencial externo registrado
- **CUANDO** se solicita asignar una clave o emitir un comprobante en ambiente de producción (`2`)
- **ENTONCES** SHALL rechazarse explicando que la emisión en producción sigue bloqueada hasta completar la conexión y validación del cambio 4, sin consumir número ni llamar a un proveedor productivo.

#### Scenario: Continuidad portable del último secuencial autorizado en pruebas
- **DADO** un ámbito de pruebas cuyo último secuencial autorizado registrado es `000000040`
- **CUANDO** se solicita y autoriza una nueva factura mediante el adaptador simulado
- **ENTONCES** el comprobante SHALL utilizar el siguiente secuencial `000000041` sin colisionar con números anteriores ni con las series internas (`COM-VEN`, `ART-SER`), y el ámbito SHALL actualizar su último secuencial autorizado a `000000041`.

#### Scenario: XML externo con número histórico
- **DADO** un comprobante externo incorporado al archivo con secuencial `000000120`
- **CUANDO** se archiva
- **ENTONCES** SHALL conservarse ese número como dato del archivo sin avanzar automáticamente los contadores internos ni habilitar la emisión en producción.
