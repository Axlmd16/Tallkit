# normativa-de-facturacion-electronica Specification

## Purpose
Mantener una matriz de las normas de la facturación electrónica con su fuente oficial, el cambio que las cubre y un estado de verificación que distingue lo leído en su texto oficial de lo pendiente o sujeto a validación externa, sin certificar el cumplimiento legal ni habilitar por sí sola ninguna emisión.
## Requirements
### Requirement: Matriz de normas con fuente oficial

La documentación SHALL mantener una **matriz de normas** de la **facturación electrónica**. Cada fila SHALL indicar la norma o documento, su tema, lo que exige en lenguaje simple, su fuente oficial, la fecha de consulta, el cambio responsable y el estado de verificación.

Trazabilidad: propuesta §D; `docs/cambios-pendientes.md`, regla para cada cambio.

#### Scenario: Norma leída en su texto oficial
- **DADO** una resolución del **SRI** cuyo texto oficial fue leído
- **CUANDO** se registra en la matriz
- **ENTONCES** SHALL constar con su enlace oficial, la fecha de consulta, la exigencia resumida y el cambio responsable.

#### Scenario: Exigencia sin cambio responsable
- **DADO** una exigencia que ningún cambio del plan cubre
- **CUANDO** se registra en la matriz
- **ENTONCES** SHALL marcarse como sin cambio asignado, sin omitirla.

### Requirement: Estado de verificación fiel a la fuente

Cada fila SHALL tener uno de estos estados: **Verificada**, **Pendiente** o **Requiere validación externa**. Verificada SHALL exigir que se haya leído el texto oficial. Una fuente secundaria SHALL NOT bastar para marcar una fila como Verificada.

Trazabilidad: propuesta §D y riesgos; `docs/cambios-pendientes.md`, validaciones externas.

#### Scenario: Texto oficial sin consultar
- **DADO** una resolución citada por el plan cuyo texto oficial no se ha obtenido
- **CUANDO** se registra en la matriz
- **ENTONCES** SHALL quedar como Pendiente e indicar qué falta obtener.

#### Scenario: Solo existe una fuente secundaria
- **DADO** una exigencia conocida únicamente por la documentación de un proveedor o por una noticia
- **CUANDO** se registra en la matriz
- **ENTONCES** SHALL quedar como Pendiente y SHALL identificar esa fuente como secundaria.

#### Scenario: Texto leído que necesita interpretación
- **DADO** una norma leída cuya aplicación al taller depende de un contador o un abogado
- **CUANDO** se registra en la matriz
- **ENTONCES** SHALL quedar como Requiere validación externa, indicando a quién preguntar, qué preguntar y qué cambia según la respuesta.

#### Scenario: Validación externa recibida
- **DADO** una fila que requiere validación externa
- **CUANDO** el profesional responde
- **ENTONCES** SHALL registrarse quién respondió, la fecha y la conclusión antes de cambiar su estado.

### Requirement: Cobertura mínima de temas

La matriz SHALL cubrir como mínimo: ficha técnica de comprobantes electrónicos; campo `RUC Proveedor` y registro de proveedores de software; momento de transmisión y fecha del comprobante; anulación y nota de crédito; conservación de comprobantes; entrega del comprobante al comprador; consumidor final; leyendas del emisor; calificación artesanal e IVA 0 %; y protección de datos personales con transferencia al extranjero.

Trazabilidad: propuesta §D y pendientes; `DP-031`; `docs/cambios-pendientes.md`, cambios 2, 3, 6, 7 y 13.

#### Scenario: Revisión de cobertura
- **DADO** la matriz lista para archivar este cambio
- **CUANDO** se compara con los temas mínimos
- **ENTONCES** cada tema SHALL tener al menos una fila, aunque esté Pendiente.

#### Scenario: Resoluciones citadas por el plan
- **DADO** la matriz lista para archivar este cambio
- **CUANDO** se buscan `NAC-DGERCGC25-00000014`, `NAC-DGERCGC25-00000017` y `NAC-DGERCGC26-00000027`
- **ENTONCES** cada una SHALL aparecer en una fila propia con su estado.

### Requirement: Vigencia de las normas

Una norma reformada o sustituida SHALL conservarse en la matriz marcada como tal, con la fecha y la norma que la reemplaza. Su reemplazo SHALL registrarse en una fila nueva.

Trazabilidad: propuesta §D; `RN-CON-001`; spec `solicitudes-de-correccion-fiscal`, evaluación con fuente y fecha.

#### Scenario: Versión nueva de la ficha técnica
- **DADO** una ficha técnica registrada en la matriz
- **CUANDO** el SRI publica una versión nueva
- **ENTONCES** SHALL agregarse una fila Pendiente sin borrar la anterior, indicando qué cambios podría afectar.

### Requirement: Uso de la matriz en los cambios de emisión

Los cambios de emisión SHALL citar las filas en las que se apoyan. Una exigencia que no esté Verificada SHALL NOT convertirse en requisito, diseño o código como si estuviera confirmada.

Trazabilidad: propuesta, dependencias y pendientes; `docs/cambios-pendientes.md`, regla para cada cambio.

#### Scenario: Cambio que se apoya en una norma verificada
- **DADO** una exigencia Verificada
- **CUANDO** un cambio de emisión la usa en sus specs
- **ENTONCES** SHALL citar la fila de la matriz que la sustenta.

#### Scenario: Cambio que depende de una norma pendiente
- **DADO** una exigencia Pendiente de la que depende un cambio de emisión
- **CUANDO** se redacta su propuesta
- **ENTONCES** SHALL registrar la dependencia y detenerse hasta verificarla o hasta que el titular decida cómo proceder.

#### Scenario: Fecha del comprobante que esperó sin Internet
- **DADO** que la fecha y el plazo de un comprobante que esperó sin conexión siguen sin verificar
- **CUANDO** se llega al diseño del cambio 3
- **ENTONCES** esa fila SHALL verificarse primero y el diseño SHALL NOT fijar fecha ni plazo sin ella.

### Requirement: Matriz sin valor de certificación

La matriz SHALL indicar que resume normas para orientar el trabajo y que no certifica el cumplimiento legal ni tributario de Tallkit. SHALL NOT habilitar por sí sola ninguna emisión.

Trazabilidad: propuesta, fuera de alcance; `DP-031`; alcance §7.

#### Scenario: Todas las filas verificadas
- **DADO** una matriz con todas sus filas en estado Verificada
- **CUANDO** se consulta
- **ENTONCES** SHALL seguir indicando que no certifica cumplimiento y que la emisión depende de la **activación por RUC**.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

