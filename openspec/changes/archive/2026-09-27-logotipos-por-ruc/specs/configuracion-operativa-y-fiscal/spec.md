## ADDED Requirements

### Requirement: Logotipo opcional por entidad fiscal

Cada **entidad fiscal** SHALL admitir como máximo un **logotipo** vigente, opcional e independiente del de la otra entidad. Toda entidad SHALL comenzar sin logotipo, y la ausencia de logotipo SHALL NOT bloquear ninguna operación ni confirmación. El logotipo identifica visualmente al emisor en sus documentos internos. SHALL NOT confundirse con el logotipo de Tallkit, que identifica al sistema y no se configura en esta capacidad.

Solo un Administrador con `entidades_fiscales.editar` SHALL poder subir, reemplazar o quitar un logotipo. Ocultar la acción en la interfaz SHALL NOT sustituir la autorización del backend. Una solicitud denegada SHALL NOT cambiar el logotipo ni dejar archivos.

Trazabilidad: propuesta §1–2; CT-001; RN-FIS-001…005 y RN-FIS-009; RF-ACC-010; CU-003.

#### Scenario: Entidades sin logotipo al desplegar
- **DADO** las dos entidades fiscales configuradas antes de esta entrega
- **CUANDO** se despliega la capacidad
- **ENTONCES** ambas SHALL quedar sin logotipo, y las ventas, las operaciones artesanales y los ingresos SHALL confirmarse como antes.

#### Scenario: Logotipos independientes
- **DADO** la entidad comercial con logotipo y la artesanal sin logotipo
- **CUANDO** el Administrador sube un logotipo para la entidad artesanal
- **ENTONCES** la entidad artesanal SHALL tener su nuevo logotipo y la comercial SHALL conservar el suyo sin cambios.

#### Scenario: Usuario sin permiso intenta subir un logotipo
- **DADO** un Vendedor o un Encargado del taller, aunque acumule los dos roles, sin el rol Administrador
- **CUANDO** envía una imagen válida como logotipo de una entidad
- **ENTONCES** el sistema SHALL denegarlo sin cambiar el logotipo vigente ni conservar el archivo.

### Requirement: Validación del archivo del logotipo

El servidor SHALL aceptar como logotipo solo imágenes estáticas PNG, JPEG o WebP, de hasta 2 MiB y como máximo 25 megapíxeles. SHALL verificar el contenido real del archivo, no solo su extensión o el tipo declarado. SHALL rechazar SVG, imágenes animadas, archivos dañados y cualquier otro formato. Cada rechazo SHALL indicar el formato o el límite incumplido.

Una carga rechazada SHALL conservar el logotipo vigente, o su ausencia, y SHALL NOT dejar registros ni archivos. El archivo guardado SHALL NOT conservar metadatos incrustados, como ubicación o datos de la cámara.

Trazabilidad: propuesta §3 y D2; R3; RNF-SEG-009; spec `fotografias-de-mantenimiento` («Adjuntar fotografías válidas a una orden abierta»).

#### Scenario: Logotipo PNG válido
- **DADO** una imagen PNG de 300 KiB, 1200 × 400 px, con fondo transparente
- **CUANDO** el Administrador la sube como logotipo de la entidad comercial
- **ENTONCES** el sistema SHALL guardarla como logotipo vigente y conservar su transparencia.

#### Scenario: SVG rechazado
- **DADO** un archivo SVG, incluso renombrado como «logo.png»
- **CUANDO** se intenta subir como logotipo
- **ENTONCES** el sistema SHALL rechazarlo indicando los formatos admitidos y SHALL conservar el logotipo vigente.

#### Scenario: Imagen animada o archivo no admitido
- **DADO** un GIF, un WebP animado, un PDF o un ejecutable con extensión «.jpg»
- **CUANDO** se intenta subir como logotipo
- **ENTONCES** el sistema SHALL rechazarlo sin crear registros ni archivos.

#### Scenario: Tamaño o resolución excedidos
- **DADO** una imagen de 2,5 MiB o de 30 megapíxeles
- **CUANDO** se intenta subir como logotipo
- **ENTONCES** el sistema SHALL rechazarla indicando el límite superado, 2 MiB o 25 megapíxeles.

### Requirement: Reemplazo y retiro del logotipo

Subir un logotipo a una entidad que ya tiene uno SHALL reemplazarlo: el anterior SHALL dejar de entregarse y su archivo SHALL eliminarse mediante la limpieza recuperable. Quitar el logotipo SHALL dejar la entidad sin logotipo. Repetir el retiro sobre una entidad sin logotipo SHALL ser inocuo, sin errores internos ni eventos duplicados.

La carga, el reemplazo y el retiro SHALL ser comandos administrativos con clave de idempotencia, conforme a «Idempotencia de comandos administrativos». Un reintento con la misma clave y el mismo archivo SHALL devolver el resultado conservado sin repetir efectos. Una clave reutilizada con un archivo distinto SHALL responder conflicto.

Cada carga, reemplazo, retiro o rechazo relevante SHALL auditarse conforme a «Auditoría de cambios de configuración». La auditoría SHALL registrar la entidad, la acción, el resultado y el usuario, sin incluir el contenido de la imagen.

Trazabilidad: propuesta §5; RNF-INT-003…005; RF-AUD-001…003; RNF-AUD-001…005.

#### Scenario: Reemplazar un logotipo
- **DADO** la entidad artesanal con un logotipo vigente
- **CUANDO** el Administrador sube otra imagen válida
- **ENTONCES** SHALL entregarse únicamente la nueva imagen como logotipo, y el archivo anterior SHALL eliminarse sin dejar referencias rotas.

#### Scenario: Quitar el logotipo
- **DADO** la entidad comercial con logotipo
- **CUANDO** el Administrador lo quita
- **ENTONCES** la entidad SHALL quedar sin logotipo, el retiro SHALL quedar auditado y sus documentos internos SHALL mostrar solo el nombre del emisor.

#### Scenario: Reintento de la misma carga
- **DADO** una carga que el servidor completó pero cuya respuesta no llegó al navegador
- **CUANDO** el Administrador la reintenta con la misma clave y el mismo archivo
- **ENTONCES** SHALL existir un solo logotipo vigente y un solo evento de auditoría de la carga.

#### Scenario: Retiro repetido
- **DADO** una entidad cuyo logotipo ya fue quitado
- **CUANDO** llega otra solicitud de retiro
- **ENTONCES** el sistema SHALL responder sin error interno y la entidad SHALL seguir sin logotipo.

### Requirement: Entrega privada del logotipo

El logotipo SHALL almacenarse de forma privada en el servidor local del sistema, con nombres no predecibles, e incluirse en su procedimiento de respaldo. SHALL entregarse solo mediante la API, a usuarios con sesión vigente. No SHALL exigirse un permiso adicional, porque los tres roles necesitan el logotipo para consultar e imprimir los documentos internos que ya pueden ver. SHALL NOT publicarse mediante enlaces públicos permanentes, directorios accesibles sin autenticación ni rutas que omitan la sesión. Las respuestas SHALL impedir el almacenamiento en cachés compartidas y la interpretación del contenido como un tipo distinto del declarado.

Trazabilidad: propuesta §4 y R1; RNF-SEG-009 aplicado por coherencia; ADR-0003; ADR-0007.

#### Scenario: Vendedor consulta el logotipo comercial
- **DADO** un Vendedor con sesión vigente
- **CUANDO** abre el comprobante de una venta y se solicita el logotipo comercial
- **ENTONCES** el sistema SHALL entregar la imagen.

#### Scenario: Solicitud sin sesión
- **DADO** una solicitud sin sesión vigente
- **CUANDO** pide el logotipo de una entidad mediante su dirección directa
- **ENTONCES** el sistema SHALL denegarla sin entregar el contenido ni confirmar si existe un logotipo.

#### Scenario: Entidad sin logotipo
- **DADO** una entidad sin logotipo
- **CUANDO** un usuario autenticado consulta sus datos
- **ENTONCES** SHALL obtener que la entidad no tiene logotipo, sin una referencia a un archivo inexistente.

### Requirement: Consistencia del logotipo ante fallos y concurrencia

Un logotipo vigente SHALL existir solo si su archivo quedó almacenado por completo. Un fallo durante la carga o el reemplazo SHALL conservar el logotipo anterior y SHALL NOT dejar un registro sin archivo. Un archivo sin registro vigente, sea de una carga interrumpida, un reemplazo o un retiro, SHALL eliminarse mediante la limpieza recuperable, que puede repetirse sin efectos adversos y sin tocar logotipos vigentes ni fotografías.

Si dos cargas o una carga y un retiro sobre la misma entidad se procesan a la vez, SHALL aplicarse una después de la otra. Al terminar, la entidad SHALL tener un único logotipo vigente con su archivo completo, o ninguno, y SHALL NOT quedar archivos huérfanos permanentes.

Trazabilidad: propuesta §5; RNF-DIS-008; ADR-0007.

#### Scenario: Falla al guardar el archivo
- **DADO** la entidad comercial con un logotipo vigente y un error de almacenamiento durante el reemplazo
- **CUANDO** la carga falla
- **ENTONCES** SHALL seguir vigente el logotipo anterior, SHALL NOT existir un registro del nuevo y la interfaz SHALL permitir reintentar.

#### Scenario: Dos cargas simultáneas
- **DADO** dos administradores que suben imágenes distintas para la entidad artesanal al mismo tiempo
- **CUANDO** ambas solicitudes se procesan
- **ENTONCES** la entidad SHALL terminar con una sola de las dos imágenes como logotipo vigente, y el archivo de la otra SHALL quedar sujeto a limpieza.

#### Scenario: Limpieza repetida
- **DADO** archivos de logotipos reemplazados pendientes de limpieza
- **CUANDO** el proceso de limpieza se ejecuta dos veces
- **ENTONCES** SHALL eliminar solo archivos sin registro vigente, y la segunda ejecución SHALL NOT fallar ni afectar logotipos vigentes o fotografías.

## MODIFIED Requirements

### Requirement: Historia de los datos fiscales

El sistema SHALL aplicar los cambios de identificación de una entidad fiscal solo a operaciones futuras. Un **documento interno** confirmado SHALL conservar la copia histórica de los datos fiscales usados al confirmarse y SHALL NOT cambiar cuando se edite la ficha vigente.

El **logotipo** de la entidad SHALL quedar fuera de esa copia histórica. Es identidad visual y no afecta importes, impuestos, numeración ni datos de identificación. Todo documento interno, incluidos los confirmados antes de un cambio de logotipo, SHALL mostrar el logotipo vigente de su entidad al consultarse o imprimirse, o ninguno si la entidad ya no tiene. El logotipo SHALL NOT versionarse.

Trazabilidad: `RN-FIS-008`, `RN-CON-002`, `RF-ACC-010`, `RNF-DAT-003`; propuesta D3.

#### Scenario: Cambio posterior de razón social
- **WHEN** el Administrador actualiza la razón social de una entidad fiscal que ya tiene documentos confirmados
- **THEN** el sistema SHALL usar el nuevo dato en operaciones futuras y SHALL conservar intactos los documentos históricos

#### Scenario: Eliminación de una entidad configurada
- **WHEN** el Administrador intenta eliminar o desactivar una de las dos entidades fiscales obligatorias
- **THEN** el sistema SHALL rechazar la acción y SHALL mantener disponible la configuración del RUC comercial y del RUC artesanal

#### Scenario: Cambio de logotipo con documentos confirmados
- **WHEN** el Administrador reemplaza el logotipo comercial y luego se reimprime una venta confirmada el mes anterior
- **THEN** el comprobante SHALL mostrar el logotipo nuevo junto con la razón social, el RUC, los importes y el número históricos sin cambios

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
