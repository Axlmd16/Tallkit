## ADDED Requirements

### Requirement: Emisor estructurado en la instantánea

La instantánea de toda preparación completada a partir de este requisito SHALL conservar el **perfil del emisor** en campos estructurados propios, tomados de la revisión vigente del perfil al completar:

- régimen tributario y, cuando el régimen la tenga, la leyenda oficial exacta;
- obligación de llevar contabilidad como `SI` o `NO`;
- número de resolución de agente de retención, solo cuando la condición aplica;
- número de resolución de contribuyente especial, solo cuando la condición aplica;
- número de calificación artesanal y su vencimiento, solo cuando la condición aplica.

Una condición que no aplica SHALL omitirse del emisor; SHALL NOT representarse con un texto, un cero ni un valor vacío. Las condiciones del emisor SHALL NOT conservarse como leyendas de texto libre con forma `clave: valor`. La instantánea SHALL identificar su formato con un número posterior al de las preparaciones anteriores.

Las preparaciones completadas antes de este requisito SHALL conservarse sin modificación y SHALL seguir consultándose con su formato original, sin completar los campos que no conservaban. Interpretar el emisor de una instantánea SHALL NOT requerir consultar el perfil vigente.

Una preparación SHALL NOT completarse cuando el perfil vigente esté *Sin configurar*, *Falta completar* o *Requiere revisión*; el impedimento SHALL identificar la condición afectada y dirigirse al Administrador.

Trazabilidad: propuesta §A.6 y D1; DP-018/029; RNF-INT-006/008; XSD de factura 2.1.0 del SRI.

#### Scenario: Taller en régimen general
- **DADO** la entidad artesanal con régimen *General*, contabilidad *No*, sin agente de retención ni contribuyente especial y con calificación artesanal vigente
- **CUANDO** se completa la preparación de una operación artesanal
- **ENTONCES** el emisor de la instantánea SHALL contener la contabilidad `NO`, el número y el vencimiento de la calificación, y SHALL NOT contener leyenda de régimen ni números de resolución.

#### Scenario: Emisor RIMPE Emprendedor
- **DADO** una entidad con régimen *RIMPE Emprendedor*
- **CUANDO** se completa una preparación
- **ENTONCES** el emisor SHALL contener exactamente la leyenda `CONTRIBUYENTE RÉGIMEN RIMPE`.

#### Scenario: Cambio posterior del perfil
- **DADO** una preparación completada con contabilidad `NO`
- **CUANDO** el Administrador declara después que la entidad está obligada a llevar contabilidad
- **ENTONCES** la instantánea previa SHALL conservar `NO` y una preparación nueva SHALL usar `SI`.

#### Scenario: Preparación anterior al formato estructurado
- **DADO** una preparación completada antes de este requisito, con leyendas de texto
- **CUANDO** se consulta su detalle
- **ENTONCES** SHALL mostrarse tal como se conservó, sin convertir sus leyendas ni completar campos del emisor desde el perfil vigente.

#### Scenario: Perfil pendiente de declarar de nuevo
- **DADO** una entidad cuya revisión vigente conserva condiciones en texto libre
- **CUANDO** un Vendedor intenta completar una preparación de esa entidad
- **ENTONCES** SHALL permanecer en borrador con un impedimento dirigido al Administrador que indique declarar de nuevo el perfil, sin completarla con el texto anterior.

### Requirement: Códigos y descripciones de línea dentro del límite del comprobante

Cada línea de una preparación SHALL tener un código de 1 a 25 caracteres y una descripción de 1 a 300 caracteres, ambos sin saltos de línea. El código de una línea de producto SHALL ser el código interno conservado en la instantánea de la operación; el de una línea de servicio SHALL ser el **código de servicio** conservado. SHALL NOT usarse como código de línea un identificador interno de base de datos.

Cuando un código o una descripción excedan su límite, o falten, la preparación SHALL permanecer en borrador con un impedimento que identifique la línea, el producto o servicio, el campo y las longitudes observada y admitida. SHALL NOT truncarse, abreviarse ni sustituirse el valor. El impedimento por código de producto SHALL dirigirse al Administrador indicando que debe acortarse el código en el catálogo.

Corregir el código en el catálogo SHALL NOT modificar la instantánea de la operación ya confirmada. Una operación confirmada con un código excedido SHALL NOT poder prepararse; la corrección del catálogo SHALL aplicar a operaciones posteriores.

Trazabilidad: propuesta §C y D2; DP-017; RN-CAT-001; RF-CAT-001/002/010; XSD de factura 2.1.0 del SRI (`codigoPrincipal`, `descripcion`).

#### Scenario: Código de producto excedido
- **DADO** una venta confirmada con una línea cuyo código conservado tiene 31 caracteres
- **CUANDO** se intenta completar su preparación
- **ENTONCES** SHALL permanecer en borrador con un impedimento que nombre la línea y el producto e indique 31 caracteres observados y 25 admitidos, sin recortar el código.

#### Scenario: Código en el límite
- **DADO** una venta confirmada con una línea cuyo código tiene exactamente 25 caracteres
- **CUANDO** se completa su preparación
- **ENTONCES** SHALL completarse conservando el código íntegro.

#### Scenario: Línea de servicio con código propio
- **DADO** una operación artesanal confirmada con un servicio de código `SRV-000012`
- **CUANDO** se completa su preparación
- **ENTONCES** la línea de la instantánea SHALL tener el código `SRV-000012` y no el identificador interno del servicio.

#### Scenario: Operación artesanal anterior sin código de servicio conservado
- **DADO** una operación artesanal confirmada antes de que los servicios tuvieran código
- **CUANDO** se intenta completar su preparación
- **ENTONCES** SHALL usarse el código que el servicio recibió en la migración si la línea lo referencia, y SHALL bloquearse con un impedimento si no puede determinarse, sin recurrir al identificador interno.

#### Scenario: Descripción excedida
- **DADO** una línea cuya descripción conservada tiene 320 caracteres
- **CUANDO** se intenta completar la preparación
- **ENTONCES** SHALL permanecer en borrador con un impedimento que identifique la línea y las longitudes, sin recortar la descripción.

#### Scenario: Corrección posterior del catálogo
- **DADO** una venta confirmada con un código de 31 caracteres y su preparación bloqueada
- **CUANDO** el Administrador acorta el código del producto en el catálogo
- **ENTONCES** la instantánea de esa venta SHALL conservar el código anterior y su preparación SHALL seguir bloqueada; una venta nueva del mismo producto SHALL poder prepararse.

### Requirement: Coherencia entre calificación artesanal y tarifa preparada

Cuando el emisor declare una **calificación artesanal** vigente en la fecha de referencia, toda línea de la preparación SHALL corresponder a la entrada IVA 0 % del catálogo oficial. Una línea con otra tarifa o tratamiento SHALL dejar la preparación en borrador con un impedimento que identifique la línea y explique que la calificación declarada es incompatible con esa tarifa. SHALL NOT cambiarse la tarifa de la línea, recalcularse la operación ni ajustarse importes.

La ausencia de calificación SHALL NOT bloquear por sí misma una línea con tarifa cero, y la regla SHALL NOT aplicarse a la entidad que no declara calificación. Esta comprobación es local: SHALL NOT presentarse como verificación del beneficio ante el SRI.

Trazabilidad: propuesta §B.9; DP-025/029; RN-FIS-010; RF-ACC-011.

#### Scenario: Servicios a tarifa cero con calificación vigente
- **DADO** la entidad artesanal con calificación vigente y una operación cuyos servicios se confirmaron a IVA 0 %
- **CUANDO** se completa su preparación
- **ENTONCES** SHALL completarse sin impedimento por tarifa.

#### Scenario: Servicio al quince por ciento con calificación vigente
- **DADO** la entidad artesanal con calificación vigente y una operación con un servicio confirmado a IVA 15 %
- **CUANDO** se intenta completar su preparación
- **ENTONCES** SHALL permanecer en borrador con un impedimento que identifique la línea y la incompatibilidad, sin modificar los importes de la operación.

#### Scenario: Entidad sin calificación
- **DADO** la entidad comercial sin calificación artesanal declarada y una venta con líneas a IVA 15 %
- **CUANDO** se completa su preparación
- **ENTONCES** SHALL completarse sin evaluar esta regla.

#### Scenario: Calificación vencida en la fecha de referencia
- **DADO** una entidad cuya calificación venció antes de la fecha de referencia
- **CUANDO** se intenta completar una preparación
- **ENTONCES** SHALL bloquearse por el estado *Requiere revisión* del perfil, y SHALL NOT aplicarse la regla de tarifa cero como si la calificación siguiera vigente.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
