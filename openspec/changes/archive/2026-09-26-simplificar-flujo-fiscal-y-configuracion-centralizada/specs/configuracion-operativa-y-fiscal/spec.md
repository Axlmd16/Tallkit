## MODIFIED Requirements

### Requirement: Perfil fiscal adicional sin alterar la configuración operativa

El sistema SHALL permitir al Administrador completar por **entidad fiscal** razón social, RUC, nombre comercial opcional, dirección matriz y direcciones de establecimientos. También SHALL permitirle declarar régimen, obligación de llevar contabilidad y las condiciones aplicables de contribuyente especial, agente de retención, RIMPE y calificación artesanal. Cada condición SHALL tener ayuda contextual que explique su significado y que se declara con base en el certificado de RUC y la documentación vigente.

Las condiciones SHALL distinguir la ausencia de información de la no aplicabilidad, y conservar fundamento, vigencia y responsable de su registro. SHALL NOT inferirse una condición o beneficio por el tipo COMERCIAL/ARTESANAL, por textos como «artesano calificado» ni por consulta a registros externos.

El perfil SHALL mostrar uno de estos estados, siempre con su causa en texto y nunca solo con color o etiqueta:

- *Sin configurar*: no existe un perfil guardado. SHALL mostrarse en lugar de un número de revisión cero.
- *Falta completar*: faltan datos necesarios para preparar.
- *Lista para preparación local*: contiene lo necesario para preparar en ambiente de pruebas.
- *Requiere revisión*: una condición tributaria o correspondencia necesaria está fuera de vigencia.

Ningún estado SHALL afirmar validación, habilitación o declaración ante el SRI. El certificado opcional SHALL NOT afectar el estado. La información incompleta SHALL impedir preparar, sin bloquear operaciones internas que satisfagan su configuración actual. Antes de una emisión en producción, la configuración deberá revisarla el responsable tributario; esta capacidad no realiza esa habilitación.

Trazabilidad: propuesta §1, P1/P2; propuesta de simplificación B7, R4; DP-018/029; RN-FIS-001…010; RF-ACC-010/011; CU-003.

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
- **DADO** un perfil listo cuya condición RIMPE declarada terminó su vigencia ayer
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

### Requirement: Establecimientos y puntos fiscales con vigencia e historia

El Administrador SHALL gestionar establecimientos y puntos de emisión por entidad, preservando códigos de tres dígitos ASCII y ceros iniciales; `000` SHALL rechazarse para ambos. SHALL impedirse duplicar un establecimiento dentro de una entidad o un punto dentro de su establecimiento. La dirección del establecimiento será obligatoria para preparar. Un ámbito usado SHALL conservar identidad e historia y deshabilitarse prospectivamente; nunca SHALL reasignarse a otro RUC ni renombrarse para reutilizar números. Los códigos no prueban registro ante el SRI.

Una entidad puede tener varios puntos activos, pero SHALL existir un **punto predeterminado** para preparar:

- si hay un único punto activo en un establecimiento activo, SHALL usarse automáticamente;
- si hay varios, el Administrador SHALL designar uno;
- sin designación determinable, la preparación SHALL bloquearse con un impedimento dirigido al Administrador.

El punto predeterminado SHALL pertenecer a la misma entidad y estar activo. Designarlo SHALL NOT afectar preparaciones completadas.

El único ambiente disponible SHALL ser *Pruebas*. La configuración SHALL mostrarlo como estado actual y explicar que la emisión real todavía no está disponible. SHALL rechazarse todo intento de configurar o preparar en producción mientras no exista un cambio aprobado para firma, emisión y transmisión.

Trazabilidad: propuesta §1/2, P4; propuesta de simplificación B8/B12, R1/R2; DP-006/018; RN-FIS-008; RF-ACC-012; ficha técnica SRI, tabla 1.

#### Scenario: Códigos con ceros iniciales
- **DADO** un establecimiento `001` de una entidad
- **CUANDO** se registra su punto `002`
- **ENTONCES** SHALL conservarse `001-002` sin convertirlo en `1-2` ni compartir su configuración con la otra entidad.

#### Scenario: Alta duplicada concurrente
- **DADO** un punto que no existe todavía en un establecimiento
- **CUANDO** dos administradores intentan crearlo simultáneamente
- **ENTONCES** SHALL existir un único punto y el otro intento SHALL informar el conflicto sin datos parciales.

#### Scenario: Deshabilitar un punto utilizado
- **DADO** un punto con documentos de prueba o evidencias archivadas
- **CUANDO** se deshabilita
- **ENTONCES** SHALL bloquearse su uso en nuevas preparaciones y conservarse la consulta de sus documentos anteriores.

#### Scenario: Único punto activo
- **DADO** una entidad con un solo punto activo `001-001` y ninguna designación
- **CUANDO** se prepara una operación de esa entidad
- **ENTONCES** SHALL usarse `001-001` sin pedir selección.

#### Scenario: Varios puntos sin designación
- **DADO** una entidad con los puntos activos `001-001` y `001-002` y ninguno designado
- **CUANDO** se revisa una preparación
- **ENTONCES** SHALL bloquearse con un impedimento que indique al Administrador designar el punto predeterminado.

#### Scenario: Designar un punto de otra entidad
- **DADO** un punto de la entidad comercial
- **CUANDO** el Administrador intenta designarlo como predeterminado de la entidad artesanal
- **ENTONCES** SHALL rechazarse sin modificar ninguna designación.

#### Scenario: Deshabilitar el punto predeterminado
- **DADO** un punto designado como predeterminado
- **CUANDO** el Administrador lo deshabilita
- **ENTONCES** la designación SHALL dejar de ser utilizable y las revisiones nuevas SHALL mostrar el impedimento o usar el único punto activo restante.

#### Scenario: Intento de configurar producción
- **DADO** un Administrador
- **CUANDO** intenta habilitar o seleccionar el ambiente de producción para una entidad
- **ENTONCES** SHALL rechazarse explicando que la emisión real no está habilitada, sin cambiar la configuración.

### Requirement: Metadatos de certificado sin custodia de firma

El sistema SHALL permitir al Administrador registrar, de forma opcional, los metadatos del certificado de firma electrónica que podría usarse en una emisión futura. Cada campo SHALL tener nombre y ayuda contextual comprensibles:

- referencia o identificador;
- titular;
- entidad emisora del certificado;
- fuente de la información;
- fecha de inicio;
- fecha de vencimiento.

La interfaz SHALL explicar que estos metadatos no equivalen a firma, autorización ni capacidad de emitir. SHALL permitirse dejarlos vacíos. Si se informan fechas, SHALL exigirse vencimiento posterior al inicio y mostrarse vigente por fechas, futuro o vencido como evaluación local, sin afirmar comprobación criptográfica o ausencia de revocación.

SHALL NOT aceptarse archivos P12/PFX, claves privadas ni contraseñas, ni usarse para firmar. La falta o el vencimiento SHALL mostrarse como advertencia independiente para la futura emisión. SHALL NOT cambiar el estado del perfil, bloquear la preparación local ni impedir archivar documentos existentes. El formulario SHALL mostrarse solo al Administrador.

Trazabilidad: propuesta P3; propuesta de simplificación B11, R4; RN-SEG-005/007; DP-018.

#### Scenario: Certificado vencido
- **DADO** un certificado cuya fecha de vencimiento ya pasó
- **CUANDO** se consulta la configuración del emisor
- **ENTONCES** SHALL mostrarse vencido por fechas como advertencia, sin afirmar que se consultó al certificador y sin cambiar el estado *Lista para preparación local*.

#### Scenario: Certificado sin declarar
- **DADO** un perfil listo sin metadatos de certificado
- **CUANDO** un Vendedor prepara una venta de esa entidad
- **ENTONCES** la preparación local SHALL completarse sin impedimento por certificado.

#### Scenario: Intento de cargar la firma
- **DADO** un Administrador
- **CUANDO** intenta adjuntar un P12 o una contraseña a los metadatos
- **ENTONCES** SHALL rechazarse sin conservar el secreto ni reproducirlo en auditoría.

### Requirement: Correspondencias tributarias explícitas y versionadas

El sistema SHALL mantener catálogos oficiales de impuestos y tarifas como datos versionados. Cada entrada SHALL conservar código, descripción oficial, fuente, versión del catálogo o de la ficha técnica, fecha de vigencia, estado activo o inactivo y fecha de incorporación al sistema. Los códigos y tarifas SHALL NOT fijarse permanentemente en el código de la aplicación ni escribirse libremente.

El Administrador SHALL asociar cada definición tributaria interna usada para preparar con una entrada del catálogo, elegida por su nombre comprensible (por ejemplo IVA 0 %, IVA 15 %, no objeto de IVA, exento). El código oficial SHALL mostrarse solo como información avanzada. El campo «Fundamento» SHALL explicarse como «Fuente o referencia que justifica esta correspondencia tributaria».

La presentación del formulario SHALL seguir estas reglas:

- si la entidad no tiene definiciones tributarias, SHALL mostrarse «Primero debe configurarse el catálogo tributario de esta entidad»;
- si solo existe una definición interna, SHALL presentarse como dato fijo y no como selector;
- las correspondencias vigentes e históricas SHALL listarse.

SHALL diferenciarse tarifa cero, no objeto y exento aunque su resultado monetario coincida. El código de tarifa porcentual SHALL concordar con su porcentaje. Una correspondencia no determina por sí misma que el beneficio sea legalmente aplicable. SHALL rechazarse la ausencia, contradicción o solapamiento de correspondencias para una fecha.

Actualizar o desactivar una entrada de catálogo SHALL NOT modificar preparaciones completadas. Las combinaciones tributarias no soportadas SHALL bloquear la preparación indicando el motivo, sin omitirse ni transformarse en IVA. La fuente primaria SHALL ser la ficha técnica vigente del SRI. Cada entrada incorporada SHALL identificar la versión exacta de la ficha, la fecha de descarga y el archivo o manifiesto utilizado. Esta spec y los documentos de proveedores SHALL NOT constituir la fuente de los códigos, descripciones o tarifas.

Trazabilidad: propuesta §3; propuesta de simplificación B9, fuentes y vigencia; DP-017/025; RN-FIS-010; RN-CON-001/002; RF-ACC-011; ficha técnica SRI, tablas de impuestos.

#### Scenario: Tres tratamientos con impuesto cero
- **DADO** tres definiciones con tarifa cero, no objeto y exento
- **CUANDO** se prepara un documento con esas líneas
- **ENTONCES** SHALL conservarse la clasificación y agrupación independiente de cada tratamiento.

#### Scenario: Porcentaje incompatible
- **DADO** una definición con una tarifa distinta de la representada por la entrada oficial seleccionada
- **CUANDO** se intenta habilitar su correspondencia
- **ENTONCES** SHALL rechazarse sin cambiar la tarifa interna ni redondearla para hacerla coincidir.

#### Scenario: Actualización posterior del catálogo
- **DADO** una preparación que conserva la versión usada del catálogo
- **CUANDO** se incorpora otra versión o se desactiva una entrada
- **ENTONCES** SHALL conservarse el documento previo y usarse la nueva versión solo para preparaciones a las que corresponda.

#### Scenario: Selección por nombre comprensible
- **DADO** un Administrador que registra la correspondencia de una definición del 15 %
- **CUANDO** abre el selector del catálogo
- **ENTONCES** SHALL ver «IVA 15 %» con su vigencia y fuente, y el código oficial solo en la información avanzada, sin campo de texto libre para el código.

#### Scenario: Entidad sin definiciones tributarias
- **DADO** una entidad sin definiciones tributarias internas
- **CUANDO** el Administrador abre «Impuestos y catálogo SRI»
- **ENTONCES** SHALL mostrarse «Primero debe configurarse el catálogo tributario de esta entidad» sin formulario de correspondencia.

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

**Crédito** y contado SHALL seguir siendo condiciones internas y nunca un código de la Tabla 24. La declaración SHALL admitir una o varias formas habilitadas cuyos importes sumen exactamente el total del comprobante. En esta fase SHALL NOT capturarse plazo ni unidad de tiempo, SHALL NOT inventarse vencimientos ni crearse planes de deuda, y la preparación local SHALL NOT bloquearse por la condición de crédito. La representación de un plazo real para la emisión electrónica queda pendiente de una spec futura. Los pagos parciales registrados SHALL NOT presentarse como la totalidad de las condiciones del documento.

Trazabilidad: propuesta §3; propuesta de simplificación B10, R3/R6; DP-003/013/019/027; RF-ACC-014; ficha técnica SRI vigente, Tabla 24.

#### Scenario: Pago combinado declarado
- **DADO** una operación de USD 100 y una declaración fiscal de USD 40 en efectivo y USD 60 por transferencia
- **CUANDO** se valida la preparación
- **ENTONCES** SHALL conservarse el desglose con códigos `01` y `20`, sin registrar cobros nuevos.

#### Scenario: Crédito sin plazo
- **DADO** una venta a crédito
- **CUANDO** se declara su forma de pago prevista y se solicita completar la preparación
- **ENTONCES** SHALL admitirse sin plazo ni unidad, sin usar CREDITO como código SRI ni inventar pago o vencimiento comercial.

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
