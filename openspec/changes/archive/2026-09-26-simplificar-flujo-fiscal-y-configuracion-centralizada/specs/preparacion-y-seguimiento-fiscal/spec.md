## ADDED Requirements

### Requirement: Precarga automática desde la operación y la configuración

Al solicitar «Preparar datos fiscales», el sistema SHALL crear el borrador fiscal con los datos ya disponibles, sin pedirlos al usuario:

- la **entidad fiscal** y el RUC emisor de la operación;
- el receptor, tomado de la instantánea histórica del cliente: CI se traduce a cédula `05` y RUC a `04`, junto con nombre o razón social, dirección y correo;
- las líneas, cantidades, precios finales, bases, impuestos, totales y la condición de contado o crédito, tomados de la operación confirmada;
- el establecimiento, el **punto predeterminado**, el ambiente de pruebas, las correspondencias tributarias y las formas de pago habilitadas, tomados de la configuración vigente de esa entidad.

El usuario SHALL NOT poder elegir otra entidad, otro RUC ni otra operación para la preparación. Completar datos en la preparación SHALL NOT modificar la ficha del cliente, la instantánea comercial ni el documento interno.

Trazabilidad: propuesta A1/A3, R1/R2; DP-008/017/018/029; RN-FIS-001…009; RN-CLI-003; CU-012.

#### Scenario: Venta con cliente completo
- **DADO** una venta comercial confirmada cuyo cliente conserva RUC, razón social, dirección y correo en su instantánea
- **CUANDO** un Vendedor pulsa «Preparar datos fiscales»
- **ENTONCES** SHALL crearse un borrador fiscal con receptor tipo `04`, las líneas y totales históricos y el punto predeterminado de la entidad comercial, sin solicitar ningún dato adicional.

#### Scenario: Cliente con cédula
- **DADO** una operación artesanal confirmada cuyo cliente tiene identificación CI de 10 dígitos
- **CUANDO** el Encargado del taller prepara sus datos fiscales
- **ENTONCES** SHALL precargarse el receptor con tipo `05` y la misma identificación, sin cambiar el tipo registrado en la ficha del cliente.

#### Scenario: Entidad determinada por la operación
- **DADO** una operación artesanal confirmada
- **CUANDO** se intenta crear o editar su borrador indicando la entidad comercial o un punto de ella
- **ENTONCES** SHALL rechazarse o ignorarse esa indicación y conservarse la entidad artesanal de la operación.

#### Scenario: Cambio del cliente después de preparar
- **DADO** una preparación completada con el receptor precargado
- **CUANDO** se actualiza la dirección en la ficha del cliente
- **ENTONCES** la preparación SHALL conservar la dirección congelada y una nueva preparación de otra operación SHALL usar la instantánea de esa operación.

### Requirement: Solicitud limitada a los datos faltantes

La preparación SHALL presentar al Vendedor o al Encargado un resumen de la operación (origen, receptor, líneas y totales). Solo SHALL solicitar datos comprensibles que falten o que requieran confirmación, como la dirección del receptor, el correo opcional, la elección explícita de consumidor final o las formas de pago previstas.

Los impedimentos SHALL distinguir dos clases:

- datos que el usuario operativo puede completar;
- impedimentos de configuración, cuyo mensaje SHALL indicar en lenguaje comprensible que debe resolverlos el Administrador.

Un impedimento de configuración SHALL NOT ofrecer al usuario operativo campos para corregirlo en la preparación.

Trazabilidad: propuesta A2; RN-SEG-001…007; CU-012.

#### Scenario: Receptor sin dirección
- **DADO** una venta cuyo cliente no conserva dirección
- **CUANDO** el Vendedor revisa los datos para facturación
- **ENTONCES** SHALL solicitarse únicamente la dirección del receptor, y el resto de datos precargados SHALL mostrarse como resumen no editable.

#### Scenario: Configuración incompleta
- **DADO** una entidad sin punto de emisión activo
- **CUANDO** el Vendedor revisa un borrador fiscal de esa entidad
- **ENTONCES** SHALL mostrarse un impedimento de configuración dirigido al Administrador, sin campos de punto, ambiente ni códigos.

### Requirement: Datos técnicos resueltos por el sistema

El ambiente, el establecimiento, el punto de emisión, los códigos SRI, las revisiones y versiones de configuración y catálogos y la fecha fiscal de referencia SHALL resolverse en el sistema. SHALL NOT aceptarse como datos editables desde la interfaz operativa de preparación.

La API de edición del borrador SHALL rechazar con un error de validación las solicitudes que incluyan esos campos, sin modificar el borrador. La fecha fiscal de referencia SHALL determinarse en la revisión final según el calendario de America/Guayaquil, independientemente de la zona horaria del servidor o del navegador, y SHALL congelarse al completar la preparación.

Trazabilidad: propuesta A3/R2, fecha fiscal; DP-018; RNF-INT-006/008.

#### Scenario: Intento de enviar el ambiente de producción
- **DADO** un borrador fiscal comercial
- **CUANDO** un cliente de la API envía `environment` igual a producción o un `point_id` al editarlo
- **ENTONCES** SHALL rechazarse la solicitud sin modificar el borrador ni su versión.

#### Scenario: Revisión cerca de medianoche
- **DADO** un borrador revisado en el instante `2026-09-27T03:30:00Z`
- **CUANDO** se completa la preparación con esa revisión
- **ENTONCES** SHALL congelarse la fecha fiscal `2026-09-26` de America/Guayaquil, sin usar la fecha UTC ni la del navegador.

#### Scenario: Revisión en otro día
- **DADO** un borrador revisado el día anterior cuya revisión caducó
- **CUANDO** se revisa nuevamente y se completa
- **ENTONCES** SHALL usarse la fecha de la nueva revisión final, sin conservar la del borrador anterior.

### Requirement: Formas de pago habilitadas y combinables

La preparación SHALL ofrecer únicamente las **formas de pago** del catálogo oficial vigente que estén habilitadas para la entidad de la operación. Cada forma SHALL mostrarse con una descripción comprensible, por ejemplo «Efectivo» para `01` y «Transferencia» para `20`. El código SHALL mostrarse solo como información secundaria.

El usuario SHALL poder declarar una o varias formas, y la suma de sus importes SHALL coincidir exactamente con el total del comprobante.

La declaración inicial SHALL presentarse como sugerencia, que el usuario confirma o cambia antes de revisar:

- si la operación tiene cobros internos vigentes, SHALL sugerirse su desglose por medio: efectivo como la forma asociada a efectivo (inicialmente `01`) y transferencia como la asociada a transferencia (inicialmente `20`), por los importes netos cobrados;
- si esos cobros no cubren el total, el importe restante SHALL sugerirse con la **forma de pago predeterminada** de la entidad;
- si la operación está pendiente de pago, SHALL sugerirse la forma predeterminada por el total.

La sugerencia SHALL identificarse como tal en la interfaz. Confirmar o completar la preparación SHALL NOT registrar, modificar ni anular cobros; los cambios posteriores de cobros SHALL NOT alterar preparaciones completadas.

**Crédito** y contado SHALL permanecer como condiciones internas y SHALL NOT traducirse a un código de la Tabla 24. En esta fase, plazo y unidad de tiempo SHALL NOT capturarse, mostrarse ni exigirse en la preparación local, sea de contado o a crédito. La API SHALL rechazarlos si se envían, y los valores que conserve un borrador anterior SHALL NOT incorporarse a la instantánea. La preparación local SHALL NOT bloquearse por la condición de crédito ni inventar vencimientos. La representación de un plazo real para la emisión electrónica queda pendiente de una spec futura. Una forma deshabilitada o fuera de vigencia SHALL rechazarse.

Trazabilidad: propuesta A4, R3/R6; DP-003/013/027; RF-ACC-014.

#### Scenario: Pago combinado
- **DADO** una venta de contado de USD 100 y una entidad con `01` y `20` habilitadas
- **CUANDO** el Vendedor declara USD 40 en efectivo y USD 60 por transferencia
- **ENTONCES** SHALL aceptarse la declaración con ambos códigos y SHALL NOT mostrarse campos de plazo.

#### Scenario: Venta a crédito sin plazo real
- **DADO** una venta a crédito de USD 80 sin plazo acordado
- **CUANDO** el Vendedor declara USD 80 por transferencia y revisa la preparación
- **ENTONCES** SHALL admitirse la preparación local sin plazo ni unidad, sin usar CREDITO como código SRI y sin crear vencimiento.

#### Scenario: Intento de enviar plazo
- **DADO** un borrador fiscal de una venta a crédito
- **CUANDO** un cliente de la API envía plazo y unidad de tiempo en una forma de pago
- **ENTONCES** SHALL rechazarse la solicitud sin modificar el borrador.

#### Scenario: Sugerencia desde cobros registrados
- **DADO** una venta de contado de USD 100 con cobros vigentes de USD 30 en efectivo y USD 70 por transferencia
- **CUANDO** el Vendedor abre la preparación
- **ENTONCES** SHALL sugerirse USD 30 con `01` y USD 70 con `20`, identificados como sugerencia editable, y confirmar la preparación SHALL NOT crear ni modificar cobros.

#### Scenario: Sugerencia con saldo pendiente
- **DADO** una venta a crédito de USD 100 con un abono de USD 40 en efectivo y la forma predeterminada `20`
- **CUANDO** el Vendedor abre la preparación
- **ENTONCES** SHALL sugerirse USD 40 con `01` y USD 60 con `20`.

#### Scenario: Operación pendiente de pago
- **DADO** una operación artesanal de USD 25 sin cobros y la forma predeterminada `01`
- **CUANDO** el Encargado abre la preparación
- **ENTONCES** SHALL sugerirse USD 25 con `01`, que el Encargado puede cambiar a otra forma habilitada.

#### Scenario: Cobro posterior a la preparación
- **DADO** una preparación completada con la forma `01` por el total
- **CUANDO** se registra después un cobro por transferencia
- **ENTONCES** la preparación SHALL conservar su declaración original.

#### Scenario: Suma distinta del total
- **DADO** una operación de USD 50
- **CUANDO** se declaran formas de pago por USD 49,99
- **ENTONCES** SHALL indicarse la diferencia de USD 0,01 como dato por corregir, sin ajustar importes automáticamente.

#### Scenario: Forma no habilitada
- **DADO** la forma `19` (tarjeta de crédito) presente en el catálogo pero deshabilitada
- **CUANDO** una solicitud intenta declararla en una preparación
- **ENTONCES** SHALL rechazarse sin crear un medio de cobro interno.

### Requirement: Instantánea de la configuración utilizada

Al completar la preparación, la instantánea SHALL conservar:

- la revisión del perfil tributario;
- el establecimiento y el punto con sus códigos y versiones;
- el ambiente;
- las versiones y entradas de los catálogos de impuestos y formas de pago;
- las formas de pago declaradas y la fecha fiscal de referencia.

Un cambio posterior de perfil, punto, catálogo, correspondencia o habilitación SHALL NOT modificar preparaciones completadas. Un borrador SHALL resolver la configuración vigente en cada revisión. Si la configuración cambia entre la revisión y la finalización, SHALL exigir una nueva revisión.

Trazabilidad: propuesta A5, fuentes y vigencia; DP-017/018; RNF-INT-006/008/009.

#### Scenario: Cambio del punto predeterminado después de preparar
- **DADO** una preparación completada con el punto `001-001`
- **CUANDO** el Administrador designa `001-002` como predeterminado
- **ENTONCES** la preparación SHALL conservar `001-001` y las preparaciones nuevas SHALL usar `001-002`.

#### Scenario: Nueva versión del catálogo
- **DADO** una preparación completada con una versión del catálogo de formas de pago
- **CUANDO** se incorpora otra versión del catálogo
- **ENTONCES** la preparación SHALL conservar sus códigos, descripciones y versión originales.

#### Scenario: Configuración modificada entre revisión y finalización
- **DADO** un borrador revisado sin impedimentos
- **CUANDO** el Administrador modifica el perfil antes de que se complete la preparación
- **ENTONCES** completar SHALL exigir una nueva revisión con la configuración actual.

### Requirement: Borradores anteriores al flujo simplificado

Las preparaciones completadas o canceladas antes de este cambio SHALL permanecer intactas. Los borradores existentes SHALL seguir siendo editables con el flujo simplificado, y sus antiguos datos técnicos (ambiente, punto, fecha, plazo y unidad) SHALL NOT mostrarse ni usarse como decisión del usuario. Al revisarlos, el sistema SHALL resolver nuevamente la configuración vigente. La falta de configuración SHALL mostrarse como impedimento administrativo. SHALL NOT inventarse datos ni reescribirse instantáneas históricas.

Trazabilidad: propuesta, decisión sobre borradores existentes; DP-018.

#### Scenario: Borrador antiguo con producción
- **DADO** un borrador creado antes de este cambio que guardaba ambiente de producción y otro punto
- **CUANDO** se revisa con el flujo simplificado
- **ENTONCES** SHALL usarse el ambiente de pruebas y el punto predeterminado vigentes, sin mostrar los valores antiguos.

#### Scenario: Preparación antigua completada
- **DADO** una preparación completada antes de este cambio
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrarse su instantánea tal como se congeló, sin completar retroactivamente las referencias de configuración que no conservaba.

### Requirement: Terminología de preparación local

La interfaz SHALL usar «Preparar datos fiscales», «Borrador fiscal», «Revisar datos para facturación», «Preparación local» y «Pendiente de emisión». Toda vista de una preparación SHALL mostrar visiblemente: «Esta preparación todavía no es una factura electrónica. No ha sido firmada ni enviada al SRI.» Ninguna vista, estado, botón, notificación o mensaje SHALL presentar una preparación como factura emitida, factura autorizada, comprobante enviado o comprobante aprobado por el SRI.

Trazabilidad: propuesta A6; DP-018; invariante 25 del modelo de dominio; RN-CON-009/010.

#### Scenario: Preparación completada
- **DADO** una preparación completada localmente
- **CUANDO** el usuario la consulta
- **ENTONCES** SHALL verse «Preparación local» y «Pendiente de emisión» junto con el aviso obligatorio, y SHALL NOT aparecer «factura emitida», «autorizada», «enviada» ni «aprobada».

#### Scenario: Confirmación tras completar
- **DADO** un borrador sin impedimentos
- **CUANDO** el usuario completa la preparación
- **ENTONCES** la notificación SHALL indicar que los datos fiscales quedaron preparados localmente, sin afirmar emisión ni envío.
