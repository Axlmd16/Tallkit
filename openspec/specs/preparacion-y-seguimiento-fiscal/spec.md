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

La preparación SHALL conservar por separado el **cliente** operativo de origen y el receptor declarado para el comprobante. SHALL admitir los tipos SRI RUC `04`, cédula `05`, pasaporte `06`, consumidor final `07` e identificación del exterior `08` conforme a los formatos oficiales; los demás tipos SHALL rechazarse como no soportados en esta entrega. RUC y cédula SHALL contener respectivamente 13 y 10 dígitos ASCII conservando ceros iniciales; documentos extranjeros SHALL conservar su representación alfanumérica admitida. SHALL NOT rechazarse un RUC por un algoritmo universal ni afirmarse comprobación de existencia sin consulta oficial. Completar o corregir datos fiscales SHALL exigir trazabilidad y no editar la instantánea comercial ni la ficha maestra por efecto implícito. La información requerida y sus límites SHALL validarse contra la versión oficial identificada del documento; el correo, cuando se informe, SHALL ser válido y no constituir evidencia de entrega. Trazabilidad: propuesta §4/5; DP-008/017; RN-CLI-003; RN-CON-002; ficha y advertencia SRI de validación de RUC.

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

Fuentes: [SRI: ficha y validación de identificaciones](https://www.sri.gob.ec/facturacion-electronica); [circular 24-05](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=6549b576-12c9-4d2f-a7cd-6e42d4cb887e&nombre=NAC-DGECCGC24-00000005.pdf); resoluciones enlazadas en `solicitudes-de-correccion-fiscal`. Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

