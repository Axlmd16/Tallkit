## MODIFIED Requirements

### Requirement: Perfil fiscal adicional sin alterar la configuración operativa

El sistema SHALL permitir al Administrador completar por **entidad fiscal** razón social, RUC, nombre comercial opcional, dirección matriz y direcciones de establecimientos. También SHALL permitirle declarar el **perfil del emisor** mediante valores cerrados, nunca texto libre:

- **Régimen tributario**: exactamente uno entre *General*, *RIMPE Emprendedor* y *RIMPE Negocio Popular*. La leyenda oficial del régimen SHALL derivarse del valor elegido y SHALL NOT escribirse ni declararse como una condición separada.
- **Obligado a llevar contabilidad**: *Sí* o *No*, conservado como `SI` o `NO`.
- **Agente de retención**: *No aplica* o *Aplica*; cuando aplica SHALL exigirse el número de resolución, compuesto solo por dígitos ASCII, de 1 a 8 caracteres y sin ceros a la izquierda.
- **Contribuyente especial**: *No aplica* o *Aplica*; cuando aplica SHALL exigirse el número de resolución, alfanumérico ASCII y de 3 a 13 caracteres.
- **Gran contribuyente**: *No aplica* o *Aplica*; cuando aplica SHALL exigirse el número de resolución, de 1 a 300 caracteres en una sola línea.
- **Calificación artesanal**: según su propio requisito.

Cada condición SHALL tener ayuda contextual que explique su significado y que se declara con base en el certificado de RUC y la documentación vigente. Un valor fuera de las opciones o con formato distinto SHALL rechazarse identificando el campo, sin guardar una revisión parcial.

Las condiciones SHALL distinguir la ausencia de información de la no aplicabilidad, y conservar fundamento, vigencia y responsable de su registro. SHALL NOT inferirse una condición o beneficio por el tipo COMERCIAL/ARTESANAL, por textos como «artesano calificado» ni por consulta a registros externos.

El perfil SHALL mostrar uno de estos estados, siempre con su causa en texto y nunca solo con color o etiqueta:

- *Sin configurar*: no existe un perfil guardado. SHALL mostrarse en lugar de un número de revisión cero.
- *Falta completar*: faltan datos necesarios para preparar, la revisión vigente conserva condiciones declaradas como texto libre antes de este requisito, o una condición guardada ya no cumple su formato o falta por declarar.
- *Lista para preparación local*: contiene lo necesario para preparar en ambiente de pruebas.
- *Requiere revisión*: una condición tributaria o correspondencia necesaria está fuera de vigencia.

Una revisión anterior con condiciones en texto libre SHALL conservarse como historia sin modificarse y SHALL NOT convertirse automáticamente a los valores cerrados. Mientras sea la vigente, el perfil SHALL mostrarse como *Falta completar* indicando que debe declararse de nuevo.

El régimen *RIMPE Negocio Popular* SHALL poder declararse y SHALL NOT impedir por sí mismo la preparación de facturas electrónicas, que el SRI permite a ese régimen de forma voluntaria. Su leyenda oficial SHALL ser `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE`; la de *RIMPE Emprendedor*, `CONTRIBUYENTE RÉGIMEN RIMPE`; y el régimen *General* SHALL NOT tener leyenda. La leyenda de Negocio Popular sigue la ficha técnica 2.34 aunque el XSD 2.1.0 no la admita; esa contradicción consta en `NOR-020` y SHALL resolverse antes de activar una entidad en ese régimen.

Una revisión guardada antes de la condición de **gran contribuyente** SHALL conservar las demás condiciones y mostrarse *Falta completar*, pidiendo solo declarar esa condición. Un valor guardado de agente de retención o de contribuyente especial que incumpla su formato SHALL NOT corregirse en silencio: el perfil SHALL mostrarse *Falta completar* identificando la condición, y la revisión anterior SHALL conservarse como historia.

Ningún estado SHALL afirmar validación, habilitación o declaración ante el SRI. El certificado opcional SHALL NOT afectar el estado. La información incompleta SHALL impedir preparar, sin bloquear operaciones internas que satisfagan su configuración actual. Antes de una emisión en producción, la configuración deberá revisarla el responsable tributario; esta capacidad no realiza esa habilitación.

Trazabilidad: propuesta §A y D1; propuesta de simplificación B7, R4; propuesta `alinear-datos-del-comprobante-con-sri` §A.4/5 y diferencias nuevas; DP-018/029/031/035 reglas 4 y 5; RN-FIS-001…010; RF-ACC-010/011; CU-003; `NOR-002`; `NOR-003`; `NOR-020`; `NOR-021`; XSD de factura 2.1.0 del SRI (`obligadoContabilidad`, `contribuyenteRimpe`, `agenteRetencion`, `contribuyenteEspecial`).

#### Scenario: Nuevo contribuyente aún no definido
- **DADO** un perfil sin régimen ni condiciones tributarias confirmadas por el responsable
- **CUANDO** el Administrador guarda su avance
- **ENTONCES** SHALL conservarse en estado *Falta completar* con los campos pendientes, sin inventar datos ni asignar automáticamente tarifa cero o tarifa general.

#### Scenario: Entidad sin perfil guardado
- **DADO** una entidad fiscal que nunca guardó perfil electrónico
- **CUANDO** el Administrador consulta la facturación electrónica
- **ENTONCES** SHALL verse «Sin configurar» con la explicación de que aún no existe configuración guardada, sin mostrar «Revisión 0».

#### Scenario: Perfil listo sin certificado
- **DADO** un perfil con condiciones, establecimiento, punto predeterminado y correspondencias vigentes, pero sin metadatos de certificado
- **CUANDO** se evalúa su estado
- **ENTONCES** SHALL mostrarse *Lista para preparación local* y, por separado, una advertencia de certificado sin declarar.

#### Scenario: Condición vencida
- **DADO** un perfil listo cuya condición de agente de retención declarada terminó su vigencia ayer
- **CUANDO** se consulta su estado
- **ENTONCES** SHALL mostrarse *Requiere revisión* identificando la condición y su fecha de fin.

#### Scenario: Artesanal no equivale a beneficio comprobado
- **DADO** una entidad artesanal sin antecedentes de calificación
- **CUANDO** se evalúa su preparación fiscal
- **ENTONCES** SHALL indicarse la falta de fundamento cuando se pretenda aplicar el beneficio, sin marcarlo verificado ante el SRI.

#### Scenario: Usuario operativo intenta configurar otro emisor
- **DADO** un Vendedor sin rol Administrador
- **CUANDO** intenta modificar el régimen de cualquiera de las entidades
- **ENTONCES** SHALL denegarse sin modificar información ni revelar datos restringidos.

#### Scenario: Perfil real del taller
- **DADO** la entidad artesanal sin perfil guardado
- **CUANDO** el Administrador declara régimen *General*, contabilidad *No*, agente de retención *No aplica*, contribuyente especial *No aplica* y gran contribuyente *No aplica*, cada uno con fundamento y vigencia
- **ENTONCES** SHALL guardarse una revisión con `NO` para la contabilidad, sin leyenda de régimen, y sin números de resolución.

#### Scenario: Leyenda derivada del régimen
- **DADO** una entidad cuyo Administrador declara el régimen *RIMPE Emprendedor*
- **CUANDO** se consulta el perfil
- **ENTONCES** SHALL mostrarse la leyenda oficial `CONTRIBUYENTE RÉGIMEN RIMPE` como dato derivado, sin campo para escribirla.

#### Scenario: Contabilidad con texto libre
- **DADO** un Administrador
- **CUANDO** intenta guardar la obligación de llevar contabilidad con el valor «Sí, desde 2024»
- **ENTONCES** SHALL rechazarse indicando el campo y las opciones admitidas, sin crear una revisión.

#### Scenario: Resolución de agente de retención con formato inválido
- **DADO** un Administrador que declara que la entidad es agente de retención
- **CUANDO** informa como resolución `NAC-0012`, un número de nueve dígitos o `00012`
- **ENTONCES** SHALL rechazarse indicando que se admiten de 1 a 8 dígitos sin ceros a la izquierda, sin corregir el valor ni crear una revisión.

#### Scenario: Agente de retención sin número
- **DADO** un Administrador que marca *Aplica* en agente de retención
- **CUANDO** guarda sin número de resolución
- **ENTONCES** SHALL rechazarse indicando que el número es obligatorio cuando la condición aplica.

#### Scenario: Revisión anterior en texto libre
- **DADO** una entidad cuya revisión vigente declara la contabilidad con el texto «no obligado»
- **CUANDO** se consulta el perfil después de aplicar este requisito
- **ENTONCES** SHALL mostrarse *Falta completar* indicando que debe declararse de nuevo, la revisión anterior SHALL seguir consultable sin cambios y SHALL NOT interpretarse su texto como `NO`.

#### Scenario: Régimen de negocio popular
- **DADO** una entidad con régimen *RIMPE Negocio Popular* declarado y el resto del perfil completo
- **CUANDO** se evalúa su estado
- **ENTONCES** SHALL mostrarse *Lista para preparación local*, sin causa por el régimen, y las ventas y cobros internos de la entidad SHALL seguir operando.

#### Scenario: Leyenda derivada de Negocio Popular
- **DADO** una entidad cuyo Administrador declara el régimen *RIMPE Negocio Popular*
- **CUANDO** se consulta el perfil
- **ENTONCES** SHALL mostrarse la leyenda oficial `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE` como dato derivado, sin campo para escribirla.

#### Scenario: Contribuyente especial demasiado corto
- **DADO** un Administrador que declara que la entidad es contribuyente especial
- **CUANDO** informa como resolución un valor de dos caracteres
- **ENTONCES** SHALL rechazarse indicando que se admiten de 3 a 13 letras o dígitos, sin crear una revisión.

#### Scenario: Gran contribuyente declarado
- **DADO** un Administrador con el perfil de una entidad
- **CUANDO** declara gran contribuyente *Aplica* con la resolución `NAC-GCFOIOC21-00000868-E`, fundamento y vigencia
- **ENTONCES** SHALL guardarse una revisión nueva que conserve ese número.

#### Scenario: Gran contribuyente sin número
- **DADO** un Administrador que marca *Aplica* en gran contribuyente
- **CUANDO** guarda sin número de resolución
- **ENTONCES** SHALL rechazarse indicando que el número es obligatorio cuando la condición aplica.

#### Scenario: Revisión anterior sin gran contribuyente
- **DADO** una entidad cuyo perfil estaba *Lista para preparación local* antes de existir la condición
- **CUANDO** se consulta el perfil
- **ENTONCES** SHALL mostrarse *Falta completar* pidiendo solo declarar gran contribuyente, y las demás condiciones SHALL conservarse declaradas.

#### Scenario: Ventas durante el perfil por completar
- **DADO** una entidad cuyo perfil quedó en *Falta completar* por la condición nueva
- **CUANDO** se confirman y se cobran operaciones internas
- **ENTONCES** SHALL completarse con normalidad, y solo la preparación fiscal SHALL quedar bloqueada con un impedimento dirigido al Administrador.

#### Scenario: Valor guardado que ya no cumple el formato
- **DADO** una revisión vigente con la resolución de contribuyente especial `A1`
- **CUANDO** se consulta el perfil
- **ENTONCES** SHALL mostrarse *Falta completar* identificando esa condición, sin cambiar el valor guardado.

### Requirement: Correspondencia fiscal de las formas de pago

La preparación SHALL distinguir la **forma de pago** declarada para el comprobante de los cobros efectivos internos. El catálogo oficial de formas de pago SHALL tener la estructura de la Tabla 24 del SRI. El catálogo inicial SHALL contemplar las ocho formas siguientes:

| Código | Descripción de referencia |
|---|---|
| 01 | Sin utilización del sistema financiero |
| 15 | Compensación de deudas |
| 16 | Tarjeta de débito |
| 17 | Dinero electrónico |
| 18 | Tarjeta prepago |
| 19 | Tarjeta de crédito |
| 20 | Otros con utilización del sistema financiero |
| 21 | Endoso de títulos |

Esta spec no es la fuente oficial del catálogo. Los códigos, descripciones y vigencias que se incorporen SHALL provenir de la ficha técnica vigente del SRI y conservar, con cada entrada:

- la versión exacta de la ficha;
- la fecha de descarga;
- el archivo o manifiesto utilizado;
- la vigencia, el estado y la fecha de incorporación.

Si la ficha vigente difiere de la tabla anterior en descripciones, vigencias o códigos, SHALL prevalecer la ficha y registrarse la diferencia. Descripciones y vigencias SHALL NOT considerarse cerradas hasta cargarse desde esa fuente.

El Administrador SHALL consultar el catálogo completo con código, descripción, fuente, versión, vigencia y estado de habilitación por entidad. En V1 solo SHALL poder habilitarse `01`, asociada a efectivo o pago sin sistema financiero, y `20`, asociada a transferencia. Las demás, incluidas las tarjetas `16` y `19`, SHALL permanecer visibles y deshabilitadas. Habilitarlas requiere otra decisión que actualice pagos, caja, cierres, reportes y conciliación. Esta capacidad SHALL NOT crear medios internos de cobro.

Cada entidad SHALL tener una **forma de pago predeterminada** entre sus formas habilitadas, designada por el Administrador e inicialmente `01`, que la preparación sugiere cuando no hay cobros que cubran el total. Deshabilitar la forma predeterminada SHALL exigir designar otra habilitada.

**Crédito** y contado SHALL seguir siendo condiciones internas y nunca un código de la Tabla 24. La declaración SHALL admitir una o varias formas habilitadas cuyos importes sumen exactamente el total del comprobante. El **plazo del comprobante** SHALL NOT configurarse por entidad ni formar parte del catálogo: se declara en cada preparación, conforme a la capacidad `preparacion-y-seguimiento-fiscal`. SHALL NOT inventarse vencimientos ni crearse planes de deuda. Los pagos parciales registrados SHALL NOT presentarse como la totalidad de las condiciones del documento.

Trazabilidad: propuesta §3; propuesta de simplificación B10, R3/R6; DP-003/013/019/027/035 regla 2; RF-ACC-014; `NOR-019`; ficha técnica SRI vigente, Tabla 24.

#### Scenario: Pago combinado declarado
- **DADO** una operación de USD 100 y una declaración fiscal de USD 40 en efectivo y USD 60 por transferencia
- **CUANDO** se valida la preparación
- **ENTONCES** SHALL conservarse el desglose con códigos `01` y `20`, sin registrar cobros nuevos.

#### Scenario: Crédito con plazo declarado
- **DADO** una venta a crédito con saldo pendiente
- **CUANDO** se declaran su forma de pago prevista y su plazo y se solicita completar la preparación
- **ENTONCES** SHALL admitirse sin usar CREDITO como código SRI ni inventar pago o vencimiento comercial.

#### Scenario: Catálogo completo visible
- **DADO** un Administrador en «Formas de pago SRI»
- **CUANDO** consulta el catálogo
- **ENTONCES** SHALL ver las formas incorporadas con descripción, fuente, versión de la ficha, fecha de descarga y vigencia, con `01` y `20` habilitadas y las demás deshabilitadas.

#### Scenario: Catálogo sin fuente
- **DADO** una entrada de forma de pago sin versión de ficha, fecha de descarga o archivo de origen
- **CUANDO** se intenta incorporar al catálogo
- **ENTONCES** SHALL rechazarse sin crear la entrada.

#### Scenario: Intento de habilitar tarjeta de crédito
- **DADO** la forma `19` deshabilitada
- **CUANDO** un Administrador intenta habilitarla en V1
- **ENTONCES** SHALL rechazarse explicando que requiere una decisión que incorpore ese medio a cobros, caja y cierres.

#### Scenario: Deshabilitar la forma predeterminada
- **DADO** una entidad con `01` y `20` habilitadas y `01` como predeterminada
- **CUANDO** el Administrador intenta deshabilitar `01` sin designar otra
- **ENTONCES** SHALL rechazarse indicando que primero debe designarse otra forma predeterminada habilitada.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
