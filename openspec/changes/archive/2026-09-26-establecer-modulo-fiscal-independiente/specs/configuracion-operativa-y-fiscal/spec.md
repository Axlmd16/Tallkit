## ADDED Requirements

### Requirement: Perfil fiscal adicional sin alterar la configuración operativa

El sistema SHALL permitir al Administrador completar por **entidad fiscal** razón social, RUC, nombre comercial opcional, dirección matriz y direcciones de establecimientos; régimen, obligación de llevar contabilidad y las condiciones aplicables de contribuyente especial, agente de retención, RIMPE y calificación artesanal. Las condiciones SHALL distinguir ausencia de información de no aplicabilidad y conservar fundamento, vigencia y responsable de su registro. SHALL NOT inferirse un beneficio por el tipo COMERCIAL/ARTESANAL ni consultar registros externos. La información adicional incompleta SHALL impedir declarar un perfil listo para preparación fiscal, sin bloquear operaciones internas que satisfagan su configuración actual. Trazabilidad: propuesta §1, P1/P2; DP-018/029; RN-FIS-001…010; RF-ACC-010/011; CU-003.

#### Scenario: Nuevo contribuyente aún no definido
- **DADO** un perfil sin régimen ni condiciones tributarias confirmadas por el responsable
- **CUANDO** el Administrador guarda su avance
- **ENTONCES** SHALL conservarse como incompleto con los campos pendientes, sin inventar datos, ni asignar automáticamente tarifa cero o tarifa general.

#### Scenario: Artesanal no equivale a beneficio comprobado
- **DADO** una entidad artesanal sin antecedentes de calificación
- **CUANDO** se evalúa su preparación fiscal
- **ENTONCES** SHALL indicarse la falta de fundamento cuando se pretenda aplicar el beneficio, sin marcarlo verificado ante el SRI.

#### Scenario: Usuario operativo intenta configurar otro emisor
- **DADO** un Vendedor sin rol Administrador
- **CUANDO** intenta modificar el régimen de cualquiera de las entidades
- **ENTONCES** SHALL denegarse sin modificar información ni revelar datos restringidos.

### Requirement: Establecimientos y puntos fiscales con vigencia e historia

El Administrador SHALL gestionar establecimientos y puntos de emisión por entidad, preservando códigos de tres dígitos ASCII y ceros iniciales; `000` SHALL rechazarse para ambos. Los ambientes de pruebas y producción SHALL identificarse separadamente. SHALL impedirse duplicar un establecimiento dentro de una entidad o un punto dentro del establecimiento; una dirección de establecimiento será obligatoria para preparación. Un ámbito usado SHALL conservar identidad e historia y deshabilitarse prospectivamente, nunca reasignarse a otro RUC ni renombrarse para reutilizar números. Los códigos no prueban registro ante el SRI. Trazabilidad: propuesta §1/2, P4; DP-006/018; RN-FIS-008; RF-ACC-012; ficha técnica SRI, tabla 1.

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

### Requirement: Metadatos de certificado sin custodia de firma

El sistema SHALL permitir al Administrador registrar titular, entidad certificadora, referencia del certificado, inicio y fin de vigencia declarados y procedencia de esos datos. SHALL exigir fin posterior a inicio y mostrar vigente por fechas, futuro o vencido como evaluación local, sin afirmar comprobación criptográfica o ausencia de revocación. SHALL NOT aceptar archivos P12/PFX, claves privadas o contraseñas ni usarlos para firmar. La falta o caducidad SHALL quedar visible como impedimento para la futura emisión, sin impedir preparar borradores o archivar documentos existentes. Trazabilidad: propuesta P3; RN-SEG-005/007; DP-018.

#### Scenario: Certificado vencido
- **DADO** un certificado cuya fecha final ya pasó
- **CUANDO** se consulta la preparación del emisor
- **ENTONCES** SHALL mostrarse vencido por fechas y la necesidad de renovación, sin afirmar que se consultó al certificador.

#### Scenario: Intento de cargar la firma
- **DADO** un Administrador
- **CUANDO** intenta adjuntar un P12 o una contraseña a los metadatos
- **ENTONCES** SHALL rechazarse sin conservar el secreto ni reproducirlo en auditoría.

### Requirement: Correspondencias tributarias explícitas y versionadas

El sistema SHALL mantener un catálogo oficial de referencia con fuente, versión y vigencia, y permitir al Administrador asociar cada definición tributaria interna usada para preparación con impuesto, tratamiento y código de porcentaje del SRI. SHALL diferenciar tarifa cero, no objeto y exento aunque su resultado monetario coincida. Para IVA se reconocerán los códigos oficiales 0, 6 y 7 respectivamente; un código de tarifa porcentual SHALL concordar con su porcentaje. Una correspondencia no determina por sí misma que el beneficio sea legalmente aplicable. SHALL rechazarse ausencia, contradicción o solapamiento de correspondencias para una fecha; cambiar el catálogo SHALL NOT reinterpretar instantáneas ya preparadas. Combinaciones tributarias no soportadas SHALL bloquear la preparación indicando el motivo, sin omitirse ni transformarse en IVA. Trazabilidad: propuesta §3; DP-017/025; RN-FIS-010; RN-CON-001/002; RF-ACC-011; ficha técnica SRI, tablas de impuestos.

#### Scenario: Tres tratamientos con impuesto cero
- **DADO** tres definiciones con tarifa cero, no objeto y exento
- **CUANDO** se prepara un documento con esas líneas
- **ENTONCES** SHALL conservarse la clasificación y agrupación independiente de cada tratamiento.

#### Scenario: Porcentaje incompatible
- **DADO** una definición con una tarifa distinta de la representada por el código oficial seleccionado
- **CUANDO** se intenta habilitar su correspondencia
- **ENTONCES** SHALL rechazarse sin cambiar la tarifa interna ni redondearla para hacerla coincidir.

#### Scenario: Actualización posterior del catálogo
- **DADO** una preparación que conserva la versión usada del catálogo
- **CUANDO** se publica otra correspondencia prospectiva
- **ENTONCES** SHALL conservarse el documento previo y usarse la nueva versión solo para preparaciones a las que corresponda.

### Requirement: Correspondencia fiscal de las formas de pago

La preparación SHALL distinguir la **forma de pago** declarada para el comprobante de los cobros efectivos internos. El catálogo inicial SHALL relacionar efectivo con código SRI `01` y transferencia con `20`, conservar versión y fuente y no habilitar otros medios de cobro internos. **Crédito** SHALL seguir siendo una condición, nunca un código de medio; los datos fiscales adicionales de plazo y unidad, si son exigibles para el caso, SHALL señalarse como pendientes sin inventar vencimientos ni crear planes de deuda. La declaración de formas e importes prevista para el comprobante SHALL cubrir su total; pagos parciales registrados SHALL NOT presentarse como la totalidad de las condiciones del documento. Trazabilidad: propuesta §3; DP-003/013/027; RF-ACC-014; ficha técnica SRI, tabla de formas de pago.

#### Scenario: Pago combinado declarado
- **DADO** una operación de USD 100 y una declaración fiscal de USD 40 en efectivo y USD 60 por transferencia
- **CUANDO** se valida la preparación
- **ENTONCES** SHALL conservarse el desglose con códigos `01` y `20`, sin registrar cobros nuevos.

#### Scenario: Crédito pendiente de datos fiscales
- **DADO** una venta a crédito sin datos suficientes para las condiciones fiscales elegidas
- **CUANDO** se solicita declararla preparada
- **ENTONCES** SHALL indicarse qué dato falta, sin usar CREDITO como código SRI, ni inventar pago o vencimiento comercial.

Fuentes normativas: [ficha y catálogos oficiales](https://www.sri.gob.ec/facturacion-electronica). Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
