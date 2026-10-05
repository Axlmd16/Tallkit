## MODIFIED Requirements

### Requirement: Perfil fiscal adicional sin alterar la configuración operativa

El sistema SHALL permitir al Administrador completar por **entidad fiscal** razón social, RUC, nombre comercial opcional, dirección matriz y direcciones de establecimientos. También SHALL permitirle declarar el **perfil del emisor** mediante valores cerrados, nunca texto libre:

- **Régimen tributario**: exactamente uno entre *General*, *RIMPE Emprendedor* y *RIMPE Negocio Popular*. La leyenda oficial del régimen SHALL derivarse del valor elegido y SHALL NOT escribirse ni declararse como una condición separada.
- **Obligado a llevar contabilidad**: *Sí* o *No*, conservado como `SI` o `NO`.
- **Agente de retención**: *No aplica* o *Aplica*; cuando aplica SHALL exigirse el número de resolución, compuesto solo por dígitos ASCII y de 1 a 8 caracteres.
- **Contribuyente especial**: *No aplica* o *Aplica*; cuando aplica SHALL exigirse el número de resolución, alfanumérico ASCII y de 1 a 13 caracteres.
- **Calificación artesanal**: según su propio requisito.

Cada condición SHALL tener ayuda contextual que explique su significado y que se declara con base en el certificado de RUC y la documentación vigente. Un valor fuera de las opciones o con formato distinto SHALL rechazarse identificando el campo, sin guardar una revisión parcial.

Las condiciones SHALL distinguir la ausencia de información de la no aplicabilidad, y conservar fundamento, vigencia y responsable de su registro. SHALL NOT inferirse una condición o beneficio por el tipo COMERCIAL/ARTESANAL, por textos como «artesano calificado» ni por consulta a registros externos.

El perfil SHALL mostrar uno de estos estados, siempre con su causa en texto y nunca solo con color o etiqueta:

- *Sin configurar*: no existe un perfil guardado. SHALL mostrarse en lugar de un número de revisión cero.
- *Falta completar*: faltan datos necesarios para preparar, o la revisión vigente conserva condiciones declaradas como texto libre antes de este requisito.
- *Lista para preparación local*: contiene lo necesario para preparar en ambiente de pruebas.
- *Requiere revisión*: una condición tributaria o correspondencia necesaria está fuera de vigencia.

Una revisión anterior con condiciones en texto libre SHALL conservarse como historia sin modificarse y SHALL NOT convertirse automáticamente a los valores cerrados. Mientras sea la vigente, el perfil SHALL mostrarse como *Falta completar* indicando que debe declararse de nuevo.

El régimen *RIMPE Negocio Popular* SHALL poder declararse y SHALL NOT impedir por sí mismo la preparación de facturas electrónicas, que el SRI permite a ese régimen de forma voluntaria. Su leyenda del comprobante SHALL NOT derivarse mientras no esté confirmada con la ficha técnica; el régimen SHALL conservarse en la instantánea.

Ningún estado SHALL afirmar validación, habilitación o declaración ante el SRI. El certificado opcional SHALL NOT afectar el estado. La información incompleta SHALL impedir preparar, sin bloquear operaciones internas que satisfagan su configuración actual. Antes de una emisión en producción, la configuración deberá revisarla el responsable tributario; esta capacidad no realiza esa habilitación.

Trazabilidad: propuesta §A y D1; propuesta de simplificación B7, R4; DP-018/029; RN-FIS-001…010; RF-ACC-010/011; CU-003; XSD de factura 2.1.0 del SRI (`obligadoContabilidad`, `contribuyenteRimpe`, `agenteRetencion`, `contribuyenteEspecial`).

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
- **CUANDO** el Administrador declara régimen *General*, contabilidad *No*, agente de retención *No aplica* y contribuyente especial *No aplica*, cada uno con fundamento y vigencia
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
- **CUANDO** informa como resolución `NAC-0012` o un número de nueve dígitos
- **ENTONCES** SHALL rechazarse indicando que se admiten de 1 a 8 dígitos, sin crear una revisión.

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

## ADDED Requirements

### Requirement: Calificación artesanal con número y vencimiento

La **calificación artesanal** SHALL declararse como *No aplica* o *Aplica*. Cuando aplica SHALL exigir número de calificación, organismo que la otorgó, fundamento, fecha de inicio y fecha de vencimiento; la fecha de vencimiento SHALL ser obligatoria y posterior a la de inicio. El número SHALL conservarse tal como figura en el documento, sin espacios exteriores, con un máximo de 50 caracteres. SHALL poder declararse para cualquier entidad fiscal y SHALL NOT deducirse del tipo ARTESANAL.

El sistema SHALL advertir al Administrador, en la configuración de la entidad, cuando falten 60 días o menos para el vencimiento, mostrando la fecha y los días restantes calculados con el calendario de America/Guayaquil. La advertencia SHALL ser independiente del estado del perfil y SHALL NOT bloquear la preparación. Desde el día siguiente al vencimiento, el perfil SHALL mostrarse *Requiere revisión* identificando la calificación y su fecha de fin.

El sistema SHALL NOT afirmar que la calificación fue verificada ante el organismo que la otorga ni ante el SRI, ni que el beneficio tributario es legalmente aplicable.

Trazabilidad: propuesta §B, D4 y D5; DP-029; RN-FIS-010; RF-ACC-010/011; CU-003.

#### Scenario: Calificación vigente declarada
- **DADO** la entidad artesanal con perfil completo
- **CUANDO** el Administrador declara la calificación con número, organismo, inicio y un vencimiento dentro de 400 días
- **ENTONCES** SHALL guardarse, el perfil SHALL mostrarse *Lista para preparación local* y SHALL NOT mostrarse advertencia de vencimiento.

#### Scenario: Calificación sin vencimiento
- **DADO** un Administrador que marca *Aplica* en la calificación artesanal
- **CUANDO** guarda sin fecha de vencimiento
- **ENTONCES** SHALL rechazarse indicando que el vencimiento es obligatorio.

#### Scenario: Vencimiento próximo
- **DADO** una calificación que vence dentro de 45 días
- **CUANDO** el Administrador consulta la configuración de la entidad
- **ENTONCES** SHALL verse una advertencia con la fecha y «45 días», el perfil SHALL seguir *Lista para preparación local* y la preparación SHALL seguir permitida.

#### Scenario: Límite exacto del aviso
- **DADO** una calificación que vence dentro de 61 días
- **CUANDO** se consulta la configuración
- **ENTONCES** SHALL NOT mostrarse la advertencia; al día siguiente, con 60 días restantes, SHALL mostrarse.

#### Scenario: Calificación vencida
- **DADO** una calificación cuyo vencimiento fue ayer
- **CUANDO** se consulta el perfil
- **ENTONCES** SHALL mostrarse *Requiere revisión* identificando la calificación artesanal y su fecha de fin.

#### Scenario: Usuario operativo no ve la advertencia de configuración
- **DADO** un Encargado del taller sin rol Administrador
- **CUANDO** intenta consultar o modificar la calificación artesanal de la entidad
- **ENTONCES** SHALL denegarse sin revelar el número ni las fechas.

### Requirement: Cambio programado del código del SRI de una correspondencia

El Administrador SHALL poder programar el cambio de una correspondencia tributaria **abierta** (sin fecha de fin): el sistema SHALL cerrarla el día anterior al inicio elegido y abrir una sucesora con la tarifa oficial indicada, en una sola operación atómica. El inicio SHALL ser estrictamente posterior a hoy (America/Guayaquil) y posterior al inicio de la correspondencia vigente. La tarifa oficial sucesora SHALL concordar con la tarifa interna vigente en su intervalo, por lo que la tarifa interna sucesora SHALL programarse antes. Una correspondencia ya cerrada SHALL NOT admitir otra sucesión. Un rechazo SHALL NOT modificar la correspondencia actual. La operación SHALL auditarse y SHALL NOT alterar las preparaciones ya completadas, que conservan la tarifa que usaron. Solo el Administrador SHALL poder programarla.

Trazabilidad: continuidad ante un cambio de régimen (propuesta §D); DP-017/025; RN-FIS-010; RF-ACC-011/016; CU-003.

#### Scenario: Cambio de IVA 0 % a IVA 15 %
- **DADO** una correspondencia abierta a IVA 0 % y una tarifa interna sucesora de 15 % programada para dentro de 30 días
- **CUANDO** el Administrador programa el código de IVA 15 % para esa fecha
- **ENTONCES** la correspondencia actual SHALL terminar el día anterior, la nueva SHALL regir desde esa fecha, y las resoluciones anteriores a ella SHALL seguir devolviendo el código de IVA 0 %.

#### Scenario: Tarifa interna aún no programada
- **DADO** una correspondencia abierta a IVA 0 % sin tarifa interna sucesora
- **CUANDO** se intenta programar el código de IVA 15 %
- **ENTONCES** SHALL rechazarse por contradecir la tarifa interna vigente, sin cerrar la correspondencia actual.

#### Scenario: Fecha no futura
- **DADO** una correspondencia abierta
- **CUANDO** se intenta programar un cambio que inicia hoy o antes
- **ENTONCES** SHALL rechazarse con un error en la fecha, sin modificar la correspondencia.

#### Scenario: Correspondencia ya cerrada
- **DADO** una correspondencia que ya tiene sucesora programada
- **CUANDO** se intenta programar otro cambio sobre ella
- **ENTONCES** SHALL rechazarse por no estar abierta.

#### Scenario: Usuario sin permiso
- **DADO** un Vendedor
- **CUANDO** intenta programar el cambio
- **ENTONCES** SHALL denegarse sin modificar ninguna correspondencia.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
