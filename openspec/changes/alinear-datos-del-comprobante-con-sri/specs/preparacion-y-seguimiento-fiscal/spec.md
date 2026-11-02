## MODIFIED Requirements

### Requirement: Receptor fiscal sin mutación del cliente histórico

La preparación SHALL conservar por separado el **cliente** operativo de origen y el receptor declarado para el comprobante. SHALL admitir los tipos SRI RUC `04`, cédula `05`, pasaporte `06`, consumidor final `07` e identificación del exterior `08` conforme a los formatos oficiales; los demás tipos SHALL rechazarse como no soportados en esta entrega. RUC y cédula SHALL contener respectivamente 13 y 10 dígitos ASCII conservando ceros iniciales; documentos extranjeros SHALL conservar su representación alfanumérica admitida. SHALL NOT rechazarse un RUC por un algoritmo universal ni afirmarse comprobación de existencia sin consulta oficial. Completar o corregir datos fiscales SHALL exigir trazabilidad y no editar la instantánea comercial ni la ficha maestra por efecto implícito. La información requerida y sus límites SHALL validarse contra la versión oficial identificada del documento; el correo SHALL ser válido y no constituir evidencia de entrega.

Para completar la preparación de un receptor identificado (tipos `04`, `05`, `06` y `08`), el correo SHALL ser obligatorio, porque el comprobante debe enviarse al comprador. Un borrador SHALL poder guardarse sin correo. El tipo consumidor final `07` SHALL conservar el correo como dato opcional. Exigirlo al preparar SHALL NOT cambiar el registro del cliente, donde sigue siendo opcional, ni bloquear la confirmación o el cobro de la operación. El correo completado en la preparación SHALL conservarse en ella sin escribirse en la ficha del cliente. Las preparaciones completadas antes de esta regla SHALL conservarse sin cambios.

Trazabilidad: propuesta §4/5; propuesta `alinear-datos-del-comprobante-con-sri` §A.1; DP-008/017/035 regla 1; RN-CLI-003; RN-CON-002; `NOR-001`; ficha y advertencia SRI de validación de RUC.

#### Scenario: Completar dirección fiscal faltante
- **DADO** una operación cuyo cliente histórico carece de dirección
- **CUANDO** se completa el receptor de su preparación
- **ENTONCES** SHALL conservarse el dato fiscal nuevo y su responsable sin cambiar el documento interno confirmado.

#### Scenario: RUC sin algoritmo general aplicable
- **DADO** un RUC de formato admitido de una sociedad
- **CUANDO** no coincide con un algoritmo pensado para cédulas
- **ENTONCES** SHALL NOT rechazarse por esa razón ni etiquetarse como validado oficialmente.

#### Scenario: Cliente interno de longitud correcta pero no numérico
- **DADO** una identificación interna que contiene letras en un tipo CI
- **CUANDO** se intenta declarar preparada su información fiscal como cédula
- **ENTONCES** SHALL bloquearse señalando el formato incorrecto, sin corregirlo ni cambiar de tipo silenciosamente.

#### Scenario: Receptor identificado sin correo
- **DADO** un borrador de factura cuyo receptor es una cédula o un RUC, sin correo
- **CUANDO** se intenta completar la preparación
- **ENTONCES** SHALL permanecer en borrador con un impedimento que el usuario operativo puede completar y que pide el correo del receptor.

#### Scenario: Correo completado en la preparación
- **DADO** una operación cuyo cliente no tiene correo en su ficha
- **CUANDO** el usuario informa el correo del receptor y completa la preparación
- **ENTONCES** la instantánea SHALL conservar ese correo y la ficha del cliente y la instantánea comercial SHALL seguir sin correo.

#### Scenario: Guardar un borrador sin correo
- **DADO** un borrador de un receptor identificado que aún no tiene correo
- **CUANDO** el usuario guarda sus cambios
- **ENTONCES** SHALL guardarse el borrador, y el correo SHALL exigirse solo al completar.

#### Scenario: Consumidor final sin correo
- **DADO** una operación de USD 30 cuyo receptor es consumidor final, elegido de forma explícita
- **CUANDO** se completa la preparación sin correo
- **ENTONCES** SHALL completarse sin impedimento por el correo.

#### Scenario: Correo con formato inválido
- **DADO** un receptor con el correo «cliente-sin-dominio»
- **CUANDO** se guarda el borrador
- **ENTONCES** SHALL rechazarse identificando el campo, sin corregir el valor.

#### Scenario: Operación de un cliente sin correo
- **DADO** un cliente sin correo en su ficha
- **CUANDO** se confirma y se cobra una venta a su nombre
- **ENTONCES** ambas acciones SHALL completarse, porque el correo solo se exige al preparar la factura.

#### Scenario: Preparación completada antes de exigir el correo
- **DADO** una preparación completada antes de esta regla, con un receptor sin correo
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrarse tal como se conservó, sin pedir el correo ni cambiar su estado.

### Requirement: Solicitud limitada a los datos faltantes

La preparación SHALL presentar al Vendedor o al Encargado un resumen de la operación (origen, receptor, líneas y totales). Solo SHALL solicitar datos comprensibles que falten o que requieran confirmación, como la dirección del receptor, su correo, la elección explícita de consumidor final, las formas de pago previstas o el **plazo del comprobante**.

Los impedimentos SHALL distinguir dos clases:

- datos que el usuario operativo puede completar;
- impedimentos de configuración, cuyo mensaje SHALL indicar en lenguaje comprensible que debe resolverlos el Administrador.

Un impedimento de configuración SHALL NOT ofrecer al usuario operativo campos para corregirlo en la preparación.

Trazabilidad: propuesta A2; DP-035 reglas 1 y 2; RN-SEG-001…007; CU-012.

#### Scenario: Receptor sin dirección
- **DADO** una venta cuyo cliente conserva correo pero no dirección
- **CUANDO** el Vendedor revisa los datos para facturación
- **ENTONCES** SHALL solicitarse únicamente la dirección del receptor, y el resto de datos precargados SHALL mostrarse como resumen no editable.

#### Scenario: Configuración incompleta
- **DADO** una entidad sin punto de emisión activo
- **CUANDO** el Vendedor revisa un borrador fiscal de esa entidad
- **ENTONCES** SHALL mostrarse un impedimento de configuración dirigido al Administrador, sin campos de punto, ambiente ni códigos.

#### Scenario: Receptor sin correo
- **DADO** una venta cuyo cliente conserva dirección pero no correo
- **CUANDO** el Vendedor revisa los datos para facturación
- **ENTONCES** SHALL solicitarse únicamente el correo del receptor, sin presentarlo como opcional.

### Requirement: Formas de pago habilitadas y combinables

La preparación SHALL ofrecer únicamente las **formas de pago** del catálogo oficial vigente que estén habilitadas para la entidad de la operación. Cada forma SHALL mostrarse con una descripción comprensible, por ejemplo «Efectivo» para `01` y «Transferencia» para `20`. El código SHALL mostrarse solo como información secundaria.

El usuario SHALL poder declarar una o varias formas, y la suma de sus importes SHALL coincidir exactamente con el total del comprobante.

La declaración inicial SHALL presentarse como sugerencia, que el usuario confirma o cambia antes de revisar:

- si la operación tiene cobros internos vigentes, SHALL sugerirse su desglose por medio: efectivo como la forma asociada a efectivo (inicialmente `01`) y transferencia como la asociada a transferencia (inicialmente `20`), por los importes netos cobrados;
- si esos cobros no cubren el total, el importe restante SHALL sugerirse con la **forma de pago predeterminada** de la entidad;
- si la operación está pendiente de pago, SHALL sugerirse la forma predeterminada por el total.

La sugerencia SHALL identificarse como tal en la interfaz. Confirmar o completar la preparación SHALL NOT registrar, modificar ni anular cobros; los cambios posteriores de cobros SHALL NOT alterar preparaciones completadas.

**Crédito** y contado SHALL permanecer como condiciones internas y SHALL NOT traducirse a un código de la Tabla 24. El **plazo del comprobante** SHALL tratarse según «Plazo del comprobante en operaciones a crédito»; fuera de ese caso, plazo y unidad de tiempo SHALL NOT capturarse, mostrarse ni exigirse, y la API SHALL rechazarlos. Los valores que conserve un borrador anterior al flujo simplificado SHALL NOT incorporarse a la instantánea. La preparación SHALL NOT inventar vencimientos. Una forma deshabilitada o fuera de vigencia SHALL rechazarse.

Trazabilidad: propuesta A4, R3/R6; DP-003/013/027/035 regla 2; RF-ACC-014.

#### Scenario: Pago combinado
- **DADO** una venta de contado de USD 100 y una entidad con `01` y `20` habilitadas
- **CUANDO** el Vendedor declara USD 40 en efectivo y USD 60 por transferencia
- **ENTONCES** SHALL aceptarse la declaración con ambos códigos y SHALL NOT mostrarse campos de plazo.

#### Scenario: Venta a crédito con saldo pendiente
- **DADO** una venta a crédito de USD 80 sin cobros
- **CUANDO** el Vendedor declara USD 80 por transferencia con un plazo de 30 días y revisa la preparación
- **ENTONCES** SHALL admitirse la preparación local sin usar CREDITO como código SRI y sin crear vencimiento.

#### Scenario: Intento de enviar plazo
- **DADO** un borrador fiscal de una venta de contado
- **CUANDO** un cliente de la API envía plazo o unidad de tiempo
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

### Requirement: Emisor estructurado en la instantánea

La instantánea de toda preparación completada a partir de este requisito SHALL conservar el **perfil del emisor** en campos estructurados propios, tomados de la revisión vigente del perfil al completar:

- nombre comercial, solo cuando fue declarado;
- dirección del establecimiento de la emisión, además de la dirección matriz;
- régimen tributario y, cuando el régimen la tenga, la leyenda oficial exacta;
- obligación de llevar contabilidad como `SI` o `NO`;
- número de resolución de agente de retención, solo cuando la condición aplica;
- número de resolución de contribuyente especial, solo cuando la condición aplica;
- número de resolución de **gran contribuyente**, solo cuando la condición aplica;
- número de calificación artesanal y su vencimiento, solo cuando la condición aplica.

Una condición que no aplica SHALL omitirse del emisor; SHALL NOT representarse con un texto, un cero ni un valor vacío. Las condiciones del emisor SHALL NOT conservarse como leyendas de texto libre con forma `clave: valor`. La instantánea SHALL identificar su formato con un número posterior al de las preparaciones anteriores.

Las preparaciones completadas antes de este requisito SHALL conservarse sin modificación y SHALL seguir consultándose con su formato original, sin completar los campos que no conservaban. Interpretar el emisor de una instantánea SHALL NOT requerir consultar el perfil vigente.

Una preparación SHALL NOT completarse cuando el perfil vigente esté *Sin configurar*, *Falta completar* o *Requiere revisión*; el impedimento SHALL identificar la condición afectada y dirigirse al Administrador.

Trazabilidad: propuesta §A.6 y D1; propuesta `alinear-datos-del-comprobante-con-sri` §A.4/5 y diferencias nuevas; DP-018/029/035 reglas 4 y 5; RNF-INT-006/008; `NOR-002`; `NOR-003`; `NOR-020`; XSD de factura 2.1.0 del SRI.

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

#### Scenario: Emisor RIMPE Negocio Popular
- **DADO** una entidad con régimen *RIMPE Negocio Popular*
- **CUANDO** se completa una preparación
- **ENTONCES** el emisor SHALL contener exactamente la leyenda `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE`.

#### Scenario: Emisor gran contribuyente
- **DADO** una entidad que declara gran contribuyente con la resolución `NAC-GCFOIOC21-00000868-E`
- **CUANDO** se completa una preparación
- **ENTONCES** el emisor SHALL conservar ese número y una entidad que no aplica SHALL omitirlo.

#### Scenario: Nombre comercial y dirección del establecimiento
- **DADO** una entidad con nombre comercial declarado y un establecimiento con dirección distinta de la matriz
- **CUANDO** se completa una preparación
- **ENTONCES** el emisor SHALL conservar el nombre comercial, la dirección matriz y la dirección del establecimiento.

#### Scenario: Entidad sin nombre comercial
- **DADO** una entidad sin nombre comercial declarado
- **CUANDO** se completa una preparación
- **ENTONCES** el emisor SHALL omitirlo, sin usar la razón social en su lugar.

### Requirement: Terminología de preparación local

La interfaz SHALL hablar en lenguaje simple, sin términos contables ni técnicos que la persona usuaria no necesita. SHALL llamar «Datos de la factura» a la pantalla, «Preparar factura» a la acción que la inicia, «Completar datos» a la que retoma un borrador y «Ver datos» a la que consulta los ya confirmados; «Por completar», «Datos listos» y «Cancelados» a los estados; «Revisar datos» a la revisión, «Confirmar datos» a la acción que deja los datos listos y «Guardar para después» a la que conserva un borrador. Toda vista de estos datos SHALL mostrar de forma visible y breve «Todavía no se ha enviado al SRI». Ninguna vista, estado, botón, notificación o mensaje SHALL presentar los datos como factura emitida, factura autorizada, comprobante enviado o comprobante aprobado por el SRI. Las explicaciones largas SHALL ofrecerse como ayuda breve desplegable y los datos técnicos del emisor SHALL quedar plegados.

Trazabilidad: propuesta A6; solicitud del titular de lenguaje simple (2026-11-01); DP-018; invariante 25 del modelo de dominio; RN-CON-009/010.

#### Scenario: Preparación completada
- **DADO** una preparación completada localmente
- **CUANDO** el usuario la consulta
- **ENTONCES** SHALL verse «Datos listos» junto con el aviso «Todavía no se ha enviado al SRI», y SHALL NOT aparecer «factura emitida», «autorizada», «enviada» ni «aprobada».

#### Scenario: Confirmación tras completar
- **DADO** un borrador sin impedimentos
- **CUANDO** el usuario completa la preparación
- **ENTONCES** la notificación SHALL indicar «Datos de la factura listos.», sin afirmar emisión ni envío.

#### Scenario: Texto sin jerga
- **DADO** cualquier vista de los datos de la factura
- **CUANDO** el usuario la lee
- **ENTONCES** SHALL NOT aparecer «preparación local», «pendiente de emisión» ni «borrador fiscal», y los datos del emisor SHALL quedar plegados.

### Requirement: Precarga automática desde la operación y la configuración

Al solicitar «Preparar datos fiscales», el sistema SHALL crear el borrador fiscal con los datos ya disponibles, sin pedirlos al usuario:

- la **entidad fiscal** y el RUC emisor de la operación;
- el receptor, tomado de la instantánea histórica del cliente: CI se traduce a cédula `05` y RUC a `04`, junto con nombre o razón social, dirección y correo; si la instantánea no conserva la dirección o el correo, como ocurre en una operación artesanal, se toman de la ficha vigente del cliente solo para precargar, sin modificar la ficha ni la instantánea;
- las líneas, cantidades, precios finales, bases, impuestos, totales y la condición de contado o crédito, tomados de la operación confirmada;
- el establecimiento, el **punto predeterminado**, el ambiente de pruebas, las correspondencias tributarias y las formas de pago habilitadas, tomados de la configuración vigente de esa entidad.

El usuario SHALL NOT poder elegir otra entidad, otro RUC ni otra operación para la preparación. Completar datos en la preparación SHALL NOT modificar la ficha del cliente, la instantánea comercial ni el documento interno.

Trazabilidad: propuesta A1/A3, R1/R2; DP-035 regla 1; DP-008/017/018/029; RN-FIS-001…009; RN-CLI-003; CU-012.

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

#### Scenario: Correo de la ficha en una operación artesanal
- **DADO** una operación artesanal cuyo cliente tiene correo en su ficha, aunque la orden no lo conserva
- **CUANDO** el Encargado inicia los datos de la factura
- **ENTONCES** el correo SHALL llegar precargado y la ficha y la instantánea de la orden SHALL permanecer sin cambios.

#### Scenario: Correo escrito en la preparación
- **DADO** un borrador precargado con el correo de la ficha
- **CUANDO** el usuario lo reemplaza por otro
- **ENTONCES** la factura SHALL usar el escrito y la ficha SHALL conservar el suyo.

## ADDED Requirements

### Requirement: Plazo del comprobante en operaciones a crédito

Al preparar una operación con condición CREDITO y saldo pendiente mayor que cero, el sistema SHALL exigir un **plazo del comprobante**: un número entero de días entre 1 y 9999. Se SHALL declarar un solo plazo por comprobante, y SHALL NOT sugerirse ni completarse automáticamente. La unidad SHALL ser `dias`, resuelta por el sistema y nunca aceptada como dato del usuario.

El plazo SHALL aplicarse a las formas de pago declaradas cuyo importe supere lo cobrado con esa forma. Las formas ya cobradas por completo SHALL conservarse sin plazo.

Sin saldo pendiente, o con condición contado aunque siga pendiente de cobro, el plazo SHALL NOT pedirse ni admitirse. El saldo SHALL evaluarse en la revisión final. Si un borrador conserva un plazo y la operación ya no tiene saldo pendiente, SHALL ignorarse sin incorporarlo a la instantánea.

El plazo es solo un dato del comprobante. SHALL NOT crear vencimiento, cuotas, intereses, mora ni alertas, y SHALL NOT cambiar el saldo, el estado de pago, los cobros, las cuentas por cobrar ni los reportes. Un cobro posterior SHALL NOT modificar la instantánea.

Trazabilidad: propuesta §A.2 y §C; DP-003/027/035 regla 2; RF-PAG-012; RN-VEN-008; `NOR-019`; `V-6`.

#### Scenario: Crédito sin cobros
- **DADO** una operación artesanal a crédito de USD 80 sin cobros
- **CUANDO** el Encargado declara USD 80 por transferencia con un plazo de 30 días y completa la preparación
- **ENTONCES** la forma de pago SHALL conservar 30 `dias`, sin crear un vencimiento.

#### Scenario: Crédito sin plazo declarado
- **DADO** una venta a crédito con saldo pendiente y un borrador sin plazo
- **CUANDO** se intenta completar la preparación
- **ENTONCES** SHALL permanecer en borrador con un impedimento que el usuario operativo puede completar y que pide el plazo en días.

#### Scenario: Abono parcial
- **DADO** una venta a crédito de USD 100 con un abono de USD 40 en efectivo, declarada con USD 40 en `01` y USD 60 en `20`
- **CUANDO** se completa la preparación con un plazo de 15 días
- **ENTONCES** solo la forma `20` SHALL conservar 15 `dias`.

#### Scenario: Crédito ya saldado
- **DADO** una venta a crédito de USD 100 cobrada por completo
- **CUANDO** se revisa la preparación
- **ENTONCES** SHALL NOT pedirse plazo y una solicitud que lo envíe SHALL rechazarse.

#### Scenario: Crédito saldado con una retención recibida
- **DADO** una venta a crédito de USD 100 con USD 98 cobrados y una retención recibida vigente de USD 2
- **CUANDO** se revisa la preparación
- **ENTONCES** SHALL NOT pedirse plazo, porque el saldo pendiente es cero.

#### Scenario: Contado pendiente de cobro
- **DADO** una venta de contado confirmada y todavía sin cobrar
- **CUANDO** se revisa la preparación
- **ENTONCES** SHALL NOT pedirse plazo y la venta SHALL seguir siendo de contado.

#### Scenario: Plazo inválido
- **DADO** una venta a crédito con saldo pendiente
- **CUANDO** se envía un plazo de 0, −1, 1,5 o 10000
- **ENTONCES** SHALL rechazarse con un error de campo, sin redondear ni modificar el borrador.

#### Scenario: Unidad enviada por el usuario
- **DADO** un borrador de una venta a crédito
- **CUANDO** un cliente de la API envía la unidad `meses`
- **ENTONCES** SHALL rechazarse sin modificar el borrador.

#### Scenario: Cobro que salda antes de completar
- **DADO** un borrador a crédito con un plazo de 30 días
- **CUANDO** se registra un cobro que deja el saldo en cero y se completa la preparación
- **ENTONCES** SHALL completarse sin plazo en la instantánea.

#### Scenario: Sin efecto en la cobranza
- **DADO** una venta a crédito con preparación completada y un plazo de 30 días
- **CUANDO** pasan más de 30 días sin cobros
- **ENTONCES** la venta SHALL conservar su saldo y su estado de pago, sin aparecer como vencida ni generar alertas.

#### Scenario: Cobro posterior a completar
- **DADO** una preparación completada con un plazo de 30 días
- **CUANDO** se registra después un abono
- **ENTONCES** la instantánea SHALL conservar el plazo y sus formas de pago sin cambios.

#### Scenario: Borrador anterior con plazo antiguo
- **DADO** un borrador creado antes del flujo simplificado que guardaba un plazo
- **CUANDO** se revisa una operación a crédito con saldo pendiente
- **ENTONCES** SHALL pedirse el plazo de nuevo, sin reutilizar el valor antiguo.

### Requirement: Detalle adicional del comprobante

La preparación SHALL ofrecer una sección opcional de **detalle adicional**, con pares de nombre y valor que completan toda la factura. Se SHALL admitir hasta 12 pares, para que el comprobante no supere los 15 campos del esquema: los demás quedan para los datos que agrega el sistema o el **proveedor de emisión**. Nombre y valor SHALL tener de 1 a 300 caracteres en una sola línea, sin espacios exteriores. Los nombres SHALL ser únicos dentro de la preparación, sin distinguir mayúsculas.

Los nombres `RUC Proveedor` y `Gran Contribuyente` SHALL estar reservados y SHALL rechazarse sin distinguir mayúsculas, porque esos campos no los escribe el usuario.

El detalle adicional SHALL editarse solo en borrador, por quien pueda prepararlo; SHALL mostrarse en la revisión y conservarse en la instantánea. SHALL NOT modificar la operación, la ficha del cliente ni el documento interno, y SHALL NOT crear precios, descuentos ni otros conceptos económicos. Un borrador que conserve pares fuera de estas reglas SHALL mostrar un impedimento, sin recortarlos ni eliminarlos.

Trazabilidad: propuesta §C; DP-035; RN-CON-002; RNF-DAT-001; `NOR-003`; `NOR-004`; `NOR-021`; XSD de factura 2.1.0 (`campoAdicional`).

#### Scenario: Agregar detalle adicional
- **DADO** un borrador de una venta
- **CUANDO** el Vendedor agrega el par «Vehículo» y «Placa PCM4567» y completa la preparación
- **ENTONCES** la instantánea SHALL conservar el par y la venta y la ficha del cliente SHALL seguir sin cambios.

#### Scenario: Preparación sin detalle adicional
- **DADO** un borrador sin pares de detalle adicional
- **CUANDO** se completa la preparación
- **ENTONCES** SHALL completarse sin impedimento y sin campos vacíos en la instantánea.

#### Scenario: Nombre reservado
- **DADO** un borrador
- **CUANDO** se agrega un par con el nombre «ruc proveedor»
- **ENTONCES** SHALL rechazarse explicando que ese dato no lo escribe el usuario.

#### Scenario: Más pares de los admitidos
- **DADO** un borrador con 12 pares
- **CUANDO** se intenta agregar otro
- **ENTONCES** SHALL rechazarse indicando el máximo de 12.

#### Scenario: Nombre repetido
- **DADO** un borrador con un par llamado «Vehículo»
- **CUANDO** se agrega otro llamado «VEHÍCULO»
- **ENTONCES** SHALL rechazarse indicando el nombre repetido.

#### Scenario: Valor excedido
- **DADO** un borrador
- **CUANDO** se agrega un par cuyo valor tiene 301 caracteres
- **ENTONCES** SHALL rechazarse con las longitudes observada y admitida, sin recortarlo.

#### Scenario: Preparación completada
- **DADO** una preparación completada con detalle adicional
- **CUANDO** se intenta modificarlo
- **ENTONCES** SHALL rechazarse, y un cambio SHALL exigir cancelar y reemplazar la preparación.

#### Scenario: Borrador anterior fuera de las reglas
- **DADO** un borrador existente con 14 pares
- **CUANDO** se revisa
- **ENTONCES** SHALL mostrar un impedimento que permita corregirlo, sin eliminar pares.

### Requirement: Detalle de servicio en la preparación

Cada línea de una preparación artesanal SHALL admitir el **detalle de servicio**, precargado con el que conserva la operación. Mientras la preparación sea borrador, quien pueda prepararla SHALL poder ajustarlo o vaciarlo, con hasta 300 caracteres en una sola línea. El valor revisado SHALL conservarse en la instantánea junto a su línea y SHALL interpretarse sin consultar la operación.

Ajustarlo SHALL NOT modificar la operación, su línea ni el documento interno. Un reemplazo de una preparación cancelada SHALL precargar de nuevo el valor de la operación. Las líneas de una venta comercial SHALL NOT admitirlo y una solicitud que lo envíe SHALL rechazarse.

Trazabilidad: propuesta §A.3 y §C; DP-035 regla 3; RN-CON-002; RF-FIS-001; `NOR-021`; XSD de factura 2.1.0 (`detAdicional`).

#### Scenario: Detalle precargado
- **DADO** una operación artesanal cuya línea conserva el detalle «frenos delanteros»
- **CUANDO** el Encargado abre la preparación
- **ENTONCES** la línea SHALL mostrar ese detalle sin que deba escribirlo de nuevo.

#### Scenario: Ajuste sin efecto en la operación
- **DADO** un borrador con el detalle «frenos delanteros»
- **CUANDO** el Encargado lo cambia a «frenos delanteros y rectificado» y completa la preparación
- **ENTONCES** la instantánea SHALL conservar el texto nuevo y la operación y su documento interno SHALL conservar el original.

#### Scenario: Línea sin detalle
- **DADO** una operación artesanal cuya línea no tiene detalle
- **CUANDO** se completa la preparación sin escribirlo
- **ENTONCES** SHALL completarse sin impedimento, y la línea SHALL omitir el detalle.

#### Scenario: Detalle excedido
- **DADO** un borrador artesanal
- **CUANDO** se escribe un detalle de 301 caracteres
- **ENTONCES** SHALL rechazarse con las longitudes observada y admitida, sin recortarlo.

#### Scenario: Línea de venta comercial
- **DADO** un borrador de una venta comercial
- **CUANDO** un cliente de la API envía un detalle en una línea
- **ENTONCES** SHALL rechazarse sin modificar el borrador.

#### Scenario: Reemplazo de una preparación cancelada
- **DADO** una preparación cancelada cuyo detalle se había ajustado
- **CUANDO** se crea su reemplazo
- **ENTONCES** el reemplazo SHALL precargar el detalle de la operación, y la preparación anterior SHALL conservar el suyo.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
