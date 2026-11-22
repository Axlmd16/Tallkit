# preparacion-y-seguimiento-fiscal Specification

## Purpose
Preparar localmente la factura de una venta comercial o de una operación artesanal confirmada mediante una instantánea fiscal versionada e inmutable, revisada bajo bloqueo y coherente con los importes históricos, con receptor propio, historia de intentos y discrepancias visibles, sin transmitir, autorizar, cobrar ni alterar la operación de origen.
## Requirements
### Requirement: Preparación explícita de una operación vigente

El sistema SHALL permitir preparar una factura local desde exactamente una venta comercial o una operación artesanal confirmada y vigente, conservando su emisor y origen. SHALL NOT agrupar operaciones, facturar parcialmente ni crear preparaciones retrospectivas automáticas. Administrador y Vendedor SHALL preparar y consultar en ámbito comercial; Administrador y Encargado del taller, en artesanal. La unión de roles SHALL respetarse sin ampliar permisos de consulta limitada de ventas vinculadas. Solo una preparación activa de factura SHALL existir por operación. Trazabilidad: propuesta P1/P2; DP-018/029; RN-FIS-001…009; CU-012.

#### Scenario: Preparar una operación sin cobrar
- **DADO** una venta confirmada vigente y pendiente de pago
- **CUANDO** un Vendedor solicita preparar su factura
- **ENTONCES** SHALL crearse una preparación comercial vinculada sin cobrar, alterar deuda, mover inventario o consumir número productivo.

#### Scenario: Operación no elegible
- **DADO** una operación en borrador o anulada
- **CUANDO** se solicita una nueva preparación de factura
- **ENTONCES** SHALL rechazarse explicando su estado, sin reactivar la operación.

#### Scenario: Creación simultánea sobre el mismo origen
- **DADO** una operación sin preparación activa
- **CUANDO** dos usuarios autorizados solicitan prepararla a la vez
- **ENTONCES** SHALL existir una sola preparación activa y el otro intento SHALL recuperar la existente si es compatible o informar conflicto.

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

### Requirement: Consumidor final como decisión explícita y restringida

Consumidor final SHALL ser una elección explícita del receptor fiscal para factura, permitida únicamente dentro de las condiciones legales de la operación y con total no superior a USD 50. SHALL utilizar la identificación oficial de consumidor final y mostrar antes de preparar la restricción de anulación y notas de crédito una vez emitido y transmitido. SHALL NOT inferirse por ausencia de datos, crear un cliente ficticio, cambiar al propietario del vehículo ni eliminar la identidad operativa. Identificar al adquirente SHALL seguir disponible para importes menores o iguales al límite. Trazabilidad: propuesta §4; DP-008; circular SRI 24-05; resoluciones 25-14/25-17.

#### Scenario: Importe sobre el límite
- **DADO** una factura preparada por USD 50,01
- **CUANDO** se selecciona consumidor final
- **ENTONCES** SHALL rechazarse solicitando identificación del receptor sin dividir la operación.

#### Scenario: Límite admitido sin perder cliente operativo
- **DADO** una operación de USD 50 cuyo caso admite consumidor final
- **CUANDO** el usuario lo elige y revisa la advertencia
- **ENTONCES** SHALL conservarse ese receptor fiscal y el cliente operativo original, sin crear otra ficha de cliente.

### Requirement: Revisión de coherencia e instantánea fiscal completa

La transición a preparada SHALL exigir revisión vigente del emisor, receptor, origen, líneas, versión de catálogos, tratamientos, condiciones y totales. SHALL conservar una instantánea de esos datos con fecha de referencia, moneda USD y desglose histórico de cantidades, precios finales, bases e impuestos; SHALL comprobar su representación fiscal sin descuentos ni conceptos inventados. Diferencias de total, precisión o clasificación SHALL bloquear la preparación e identificar la causa; SHALL NOT recalcular silenciosamente la venta ni actualizar su deuda. Una edición relevante concurrente SHALL invalidar la revisión. Los documentos preparados SHALL ser inmutables; correcciones locales exigirán cancelación y reemplazo trazable, sin perder la instantánea previa. Trazabilidad: propuesta §3/5/6; DP-004/017/025/029; RN-CON-001/002; RNF-INT-006/008/009.

#### Scenario: Diferencia de un centavo
- **DADO** una operación de USD 23 y una representación fiscal que suma USD 23,01
- **CUANDO** se intenta preparar
- **ENTONCES** SHALL bloquearse indicando la diferencia sin cambiar el total interno ni añadir una línea de ajuste.

#### Scenario: Cambio tras revisar
- **DADO** una revisión de datos fiscales antes de que se modifique el receptor
- **CUANDO** se intenta completar la preparación con esa revisión
- **ENTONCES** SHALL exigirse revisar nuevamente los datos actuales sin conservar una mezcla de versiones.

#### Scenario: Cambio de datos maestros posterior
- **DADO** una preparación completada
- **CUANDO** cambia la razón social o dirección del emisor
- **ENTONCES** SHALL conservarse la instantánea previa sin modificaciones; una nueva preparación SHALL usar la información que le corresponda.

### Requirement: Suficiencia y precisión verificables de la instantánea

La instantánea preparada SHALL contener los valores fiscales necesarios del emisor y receptor, domicilios, condiciones tributarias y leyendas aplicables, fecha de referencia, líneas con códigos, cantidades, precios unitarios sin impuestos, bases, tratamientos, impuestos por línea y agrupados, moneda, total y condiciones de pago. SHALL conservar la versión de las reglas usadas y la información adicional pertinente, sin copiar datos personales ajenos a la finalidad fiscal. Los campos técnicos con valor cero exigidos por la representación, como descuento o propina cuando corresponda, SHALL NOT habilitar nuevos conceptos comerciales. La futura identidad fiscal se incorporará como vínculo inmutable cuando se asigne según su propia capacidad. Interpretar una instantánea preparada SHALL NOT requerir consultar datos maestros vigentes ni una API. Trazabilidad: propuesta §3/5, P3/P4 y fuera de alcance; DP-004/017/025; RNF-INT-006/008; RNF-DAT-001; ficha y XSD SRI.

La verificación de esta capacidad SHALL incluir una matriz documental de correspondencia con los campos y condiciones del esquema oficial de factura soportado: valor conservado, regla de derivación determinista o no aplicabilidad justificada. Deberá distinguir los datos propios del comprobante de firma y autorización, que quedan fuera de esta entrega. SHALL NOT considerarse suficiente una preparación con un dato obligatorio sin representación definida. Esta comprobación no exige implementar generación de XML, firma ni transmisión.

Los cálculos SHALL usar decimales y reglas explícitas de escala y redondeo, distinguiendo cantidades, precios unitarios, bases, impuestos y totales según el esquema soportado. La representación SHALL conservar los importes comerciales históricos y comprobar coherencia de detalles y agrupación por impuesto y tarifa. SHALL NOT recalcular la operación aplicando unilateralmente otra regla, añadir ajustes ni distribuir diferencias sin regla aprobada. Si los importes históricos no admiten representación compatible, SHALL bloquearse la preparación con los campos y diferencias afectados. La aceptación SHALL cubrir precios con impuestos incluidos, fracciones de cantidad, varias líneas de una tarifa, tratamientos distintos y diferencias de centavos; la conformidad estructural por sí sola no acredita corrección tributaria.

#### Scenario: Dato obligatorio sin representación
- **DADO** un borrador al que le falta un dato exigido por la versión de factura soportada
- **CUANDO** se verifica su suficiencia para pasar a preparada
- **ENTONCES** SHALL permanecer en borrador indicando el dato pendiente, sin completarlo con valores ficticios o consultarlo a un proveedor.

#### Scenario: Representación independiente de datos maestros
- **DADO** una preparación completa cuyos catálogos y datos del emisor se modificaron después
- **CUANDO** se consulta su desglose fiscal
- **ENTONCES** SHALL reconstruirse exclusivamente con sus valores y reglas conservados, manteniendo los importes y condiciones originales.

#### Scenario: Agrupación de tratamientos distintos
- **DADO** una preparación con líneas de tarifa cero y líneas no objeto de IVA
- **CUANDO** se verifica el resumen de impuestos
- **ENTONCES** SHALL conservarse cada tratamiento en su grupo, con bases e impuestos coherentes con sus líneas, aunque ambos impuestos resulten cero.

#### Scenario: Precisión insuficiente para un precio unitario
- **DADO** una línea cuyo precio unitario fiscal no puede representarse con la escala admitida preservando sus importes históricos y las reglas del esquema
- **CUANDO** se intenta completar la preparación
- **ENTONCES** SHALL bloquearse indicando la línea y diferencia, sin alterar el precio comercial ni añadir un ajuste.

### Requirement: Estados locales distintos de autorización y pago

La preparación SHALL distinguir borrador, preparada y cancelada. Borrador será editable; pasar a preparada registrará una intención local durable sin transmisión; cancelada conservará historia y motivo y no se reactivará. Ninguno de esos estados equivaldrá a enviada, recibida, autorizada, rechazada por el SRI o anulada oficialmente. El **estado de pago** y los estados comerciales SHALL mostrarse independientemente. Preparación, consulta, numeración y cancelación SHALL funcionar sin configuración ni llamadas a proveedores. La ausencia de un resultado oficial SHALL mostrarse como tal, no como autorización pendiente efectivamente solicitada. Los futuros intentos de transmisión y resultados oficiales SHALL constituir información vinculada e independiente del estado local; SHALL NOT sustituir borrador, preparada o cancelada ni convertir códigos de un proveedor en estados propios de preparación. En esta fase SHALL NOT crearse intentos de transmisión ficticios. Trazabilidad: propuesta §6; DP-018/027; RN-CON-009/010.

#### Scenario: Preparación sin proveedor
- **DADO** una operación con datos fiscales suficientes y ninguna integración configurada
- **CUANDO** se completa la preparación
- **ENTONCES** SHALL mostrarse preparada localmente y no enviada, sin producir solicitud de red ni factura autorizada.

#### Scenario: Pago posterior
- **DADO** una preparación asociada a una operación pendiente de pago
- **CUANDO** se registra un cobro válido por el procedimiento comercial
- **ENTONCES** SHALL cambiar únicamente la información económica correspondiente, sin autorizar la preparación.

#### Scenario: Cancelar preparación numerada de prueba
- **DADO** una preparación de prueba con número
- **CUANDO** un usuario autorizado cancela con motivo
- **ENTONCES** SHALL conservarse su número e historia como cancelación local, sin afirmar una anulación fiscal ni modificar inventario o saldo.

### Requirement: Recuperación y separación de responsabilidades

Toda escritura fiscal crítica SHALL conservar identidad de intento, contenido compatible y resultado para repetirla sin duplicar efectos. Un fallo SHALL dejar un resultado completo recuperable o ningún efecto parcial. Se SHALL comprobar el permiso también al recuperar resultados. Confirmar, preparar, cancelar o archivar SHALL NOT ejecutar operaciones de red ni mutar directamente hechos económicos ajenos. Usuarios operativos SHALL cancelar sus preparaciones en el ámbito autorizado; las solicitudes de corrección de comprobantes externos quedan reservadas al Administrador. Trazabilidad: propuesta P1/§6; RF-AUD-001…006; RNF-INT-001/003/004; ADR-0004.

#### Scenario: Reintento con contenido diferente
- **DADO** un intento que ya creó una preparación para una operación
- **CUANDO** se repite su identidad con otro emisor o importe
- **ENTONCES** SHALL rechazarse por conflicto sin crear otra preparación ni alterar la existente.

#### Scenario: Recuperación sin permiso actual
- **DADO** una preparación creada por un usuario que perdió su rol
- **CUANDO** intenta recuperar el resultado anterior
- **ENTONCES** SHALL denegarse sin revelar los datos protegidos.

### Requirement: Historia de intentos y operaciones diferentes

La recuperación de escrituras locales SHALL conservar el resultado y las incidencias necesarias para explicar cada intento lógico, con fecha, responsable y relación con su preparación; SHALL NOT registrar secretos ni copias innecesarias de datos personales. Repetir un intento compatible SHALL recuperar su resultado sin reemplazar el historial por el último intento. Cancelar y reemplazar una preparación SHALL preservar instantánea, identidad asignada e historia anteriores y enlazar el reemplazo. El futuro mecanismo de emisión SHALL respetar esta conservación sin depender de que un tercero mantenga sus errores o archivos; esto no incorpora transmisión en esta fase. La igualdad de cliente, fecha, líneas e importe SHALL NOT identificar por sí sola dos operaciones diferentes como duplicadas. Trazabilidad: propuesta §5/6, P2/P4; RF-AUD-003/004/006; RNF-INT-003/004; RNF-MAN-010.

#### Scenario: Dos compras iguales realmente distintas
- **DADO** dos ventas confirmadas diferentes del mismo cliente, fecha, productos e importe
- **CUANDO** se preparan con identidades de intento propias
- **ENTONCES** SHALL mantenerse dos preparaciones vinculadas a sus respectivos orígenes, sin rechazar la segunda por igualdad de contenido económico.

#### Scenario: Reemplazo conserva antecedentes
- **DADO** una preparación cancelada tras detectar un dato incorrecto
- **CUANDO** se crea su reemplazo con los datos corregidos
- **ENTONCES** SHALL conservarse la preparación anterior con su motivo e historia y el vínculo al reemplazo, sin sobrescribirla ni reutilizar su identidad fiscal.

### Requirement: Cambios comerciales y evidencia externa visibles

Si el origen sufre una corrección posterior, la preparación SHALL conservarse y mostrar la discrepancia con enlace autorizado a la corrección; SHALL NOT actualizar sus importes ni cancelar oficialmente el documento. Antes de nuevas acciones locales SHALL revalidarse la elegibilidad del origen. Una factura externa vinculada SHALL impedir crear otra preparación ordinaria para la misma operación mientras mantenga ese vínculo; corregir una vinculación errónea exigirá acción administrativa motivada con historia, sin eliminar el archivo. Trazabilidad: propuesta P2/P5/§7; RN-CON-002/007/010; RF-AUD-004.

#### Scenario: Devolución después de preparar
- **DADO** una preparación con el total original de la venta
- **CUANDO** se confirma una devolución comercial
- **ENTONCES** SHALL conservarse el total fiscal previo y señalarse la corrección pendiente de evaluar, sin generar una nota de crédito ni cobrar nuevamente.

#### Scenario: Operación ya documentada fuera del sistema
- **DADO** una operación vinculada a una factura externa archivada
- **CUANDO** se intenta crear una preparación ordinaria nueva
- **ENTONCES** SHALL bloquearse con referencia a esa evidencia, sin afirmar que su autorización fue verificada.

Fuentes: [SRI: ficha y validación de identificaciones](https://www.sri.gob.ec/facturacion-electronica); [circular 24-05](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=6549b576-12c9-4d2f-a7cd-6e42d4cb887e&nombre=NAC-DGECCGC24-00000005.pdf); resoluciones enlazadas en `solicitudes-de-correccion-fiscal`.

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

### Requirement: Negocio Popular sin IVA y continuidad ante un cambio de régimen

Cuando el emisor declare el régimen *RIMPE Negocio Popular*, que no cobra IVA, toda línea de la preparación SHALL corresponder a la entrada IVA 0 % del catálogo oficial (tratamiento `ZERO`; no objeto y exento no cuentan). Una línea con otra tarifa SHALL dejar la preparación en borrador con un impedimento dirigido al Administrador que identifique la línea y la tarifa, sin modificar los importes de la operación. SHALL NOT bloquearse una preparación únicamente por el régimen.

Un cambio de régimen o de tarifa SHALL NOT alterar las preparaciones completadas: cada instantánea conserva el régimen, la leyenda y la tarifa con que se preparó. Después del cambio, las preparaciones nuevas SHALL usar el régimen y la tarifa vigentes en su fecha de referencia, siempre que el Administrador haya declarado el nuevo régimen y programado la tarifa y su correspondencia.

Trazabilidad: propuesta §A.5 y §D; DP-017/025; RN-FIS-010; RF-FIS-007.

#### Scenario: Negocio popular con producto a tarifa cero
- **DADO** una entidad en régimen *RIMPE Negocio Popular* y una venta cuyas líneas están a IVA 0 %
- **CUANDO** se completa su preparación
- **ENTONCES** SHALL completarse con el régimen *RIMPE Negocio Popular* en el emisor, impuesto 0,00 y código de tarifa `0`.

#### Scenario: Negocio popular con una línea a IVA 15 %
- **DADO** una entidad en régimen *RIMPE Negocio Popular* y una venta con una línea a IVA 15 %
- **CUANDO** se intenta completar su preparación
- **ENTONCES** SHALL permanecer en borrador con un impedimento que indique que ese régimen no cobra IVA, sin modificar los importes de la venta.

#### Scenario: Paso de Negocio Popular a Emprendedor
- **DADO** una entidad que prepara a IVA 0 % como Negocio Popular, con su tarifa interna y su correspondencia sucesoras de 15 % programadas
- **CUANDO** llega la fecha del cambio y el Administrador declara el régimen *RIMPE Emprendedor*
- **ENTONCES** las preparaciones nuevas SHALL usar IVA 15 %, código de tarifa `4` y la leyenda del régimen Emprendedor, y las anteriores SHALL conservar el régimen *RIMPE Negocio Popular* y el IVA 0 %.

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

### Requirement: Lista de preparaciones locales de factura

El sistema SHALL ofrecer una consulta paginada, de solo lectura, de las preparaciones locales de factura de las entidades fiscales que el usuario pueda consultar según sus permisos fiscales (`fiscal.comercial.ver`, `fiscal.artesanal.ver`). SHALL devolver por fila la entidad fiscal, el origen (venta comercial u operación artesanal), su número interno, el cliente, el total, la fecha y el estado local (borrador, preparada o cancelada), y SHALL poder filtrarse por entidad y por estado, con orden estable, total y paginación en el servidor. El servidor SHALL omitir las filas de la entidad que el usuario no pueda consultar y SHALL rechazar un filtro por esa entidad. La consulta SHALL NOT crear, modificar ni cancelar preparaciones, no SHALL transmitir nada ni exigir configuración de emisión, y SHALL NOT presentar un estado local como enviado, autorizado o emitido.

Trazabilidad: `DP-034`, regla 8; `DP-036`, reglas 3 y 8; `RN-FIS-009`; `RF-FIS-002`; `RNF-SEG-003`; `navegacion-de-uso-diario` («Facturas antes de la emisión real»); propuesta, decisión 3.

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
