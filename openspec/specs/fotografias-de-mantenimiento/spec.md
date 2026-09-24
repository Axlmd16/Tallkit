# fotografias-de-mantenimiento Specification

## Purpose
Adjuntar, consultar de forma privada y retirar fotografías de las órdenes de mantenimiento, con validación de contenido, límites y consistencia de archivos.
## Requirements
### Requirement: Adjuntar fotografías válidas a una orden abierta

Un usuario con `mantenimientos.gestionar_fotos`, es decir Administrador o Encargado del taller, SHALL poder adjuntar fotografías a la intervención abierta de una orden `registrada` o `reabierta`. Cada fotografía SHALL admitir una descripción opcional de hasta 200 caracteres. SHALL registrar la fecha y hora de carga y el usuario que la adjuntó. El servidor SHALL aceptar solo imágenes estáticas JPEG, PNG o WebP. SHALL verificar el contenido real del archivo, no solo su extensión o el tipo declarado. Cada imagen SHALL tener un tamaño máximo de 10 MiB y como máximo 25 megapíxeles. Una orden SHALL tener como máximo 20 fotografías vigentes. Una carga rechazada SHALL NOT crear registros ni archivos. La interfaz SHALL conservar los demás datos y archivos seleccionados. Reintentar la misma carga con la misma clave SHALL NOT duplicar la fotografía. Trazabilidad: RN-TAL-006; RF-TAL-004; CU-017 3a; UI-073; P4.

#### Scenario: Carga válida
- **DADO** una orden registrada y una imagen JPEG de 3 MiB y 12 megapíxeles
- **CUANDO** un Encargado del taller la adjunta con la descripción «Golpe en puerta trasera»
- **ENTONCES** el sistema SHALL guardarla asociada a la intervención abierta, con su descripción, su usuario y su fecha.

#### Scenario: Tipo de archivo no admitido
- **DADO** un archivo PDF, GIF animado o un ejecutable renombrado como «foto.jpg»
- **CUANDO** se intenta adjuntarlo
- **ENTONCES** el sistema SHALL rechazarlo indicando los formatos admitidos, sin crear un registro ni un archivo, y la interfaz SHALL conservar el resto del formulario.

#### Scenario: Tamaño o resolución excedidos
- **DADO** una imagen de 12 MiB o de 30 megapíxeles
- **CUANDO** se intenta adjuntarla
- **ENTONCES** el sistema SHALL rechazarla indicando el límite superado.

#### Scenario: Límite de fotografías por orden
- **DADO** una orden con 20 fotografías vigentes
- **CUANDO** se intenta adjuntar otra
- **ENTONCES** el sistema SHALL rechazarla indicando el límite de 20.

#### Scenario: Reintento de la misma carga
- **DADO** una carga que el servidor completó pero cuya respuesta no llegó al navegador
- **CUANDO** el usuario reintenta con la misma clave
- **ENTONCES** SHALL existir una sola fotografía.

### Requirement: Consulta privada de fotografías

Las fotografías SHALL listarse en el detalle de la orden con miniatura, descripción, usuario y fecha, y SHALL poder verse ampliadas. El acceso a sus datos y archivos SHALL exigir sesión vigente y `mantenimientos.ver` sobre la orden en cada solicitud. SHALL NOT publicarse mediante enlaces públicos permanentes, directorios accesibles sin autenticación ni rutas predecibles que omitan la autorización. Las respuestas SHALL impedir que el contenido se almacene en cachés compartidas. Trazabilidad: RF-TAL-004; RNF-SEG-009; actores-y-roles §3.5; P4.

#### Scenario: Usuario autorizado visualiza una fotografía
- **DADO** un Administrador con sesión vigente
- **CUANDO** abre la fotografía ampliada desde el detalle de la orden
- **ENTONCES** el sistema SHALL entregar la imagen.

#### Scenario: Acceso no autorizado a una fotografía
- **DADO** un usuario con solo el rol Vendedor o una solicitud sin sesión
- **CUANDO** solicita el archivo de una fotografía mediante su dirección directa
- **ENTONCES** el sistema SHALL denegarlo sin entregar el contenido ni confirmar su existencia.

#### Scenario: Consulta desde una orden finalizada
- **DADO** una orden finalizada con fotografías
- **CUANDO** un usuario autorizado consulta su detalle
- **ENTONCES** SHALL poder ver las fotografías, pero no adjuntar ni retirar.

### Requirement: Retiro de fotografías

Un usuario con `mantenimientos.gestionar_fotos` SHALL poder retirar una fotografía de la intervención abierta mientras la orden no esté finalizada, tras una confirmación explícita. Las fotografías de intervenciones ya finalizadas SHALL NOT retirarse, tampoco con la orden reabierta. El retiro SHALL dejar de mostrar la fotografía y liberar su lugar dentro del límite. SHALL registrar en la auditoría el usuario, la fecha y la orden, y SHALL eliminar el archivo mediante una limpieza recuperable. Repetir el retiro SHALL ser inocuo. Trazabilidad: RF-TAL-004; UI-073; P2/P4.

#### Scenario: Retirar una fotografía de una orden registrada
- **DADO** una orden registrada con tres fotografías
- **CUANDO** un Encargado del taller confirma el retiro de una
- **ENTONCES** la orden SHALL mostrar dos fotografías, el retiro SHALL quedar auditado y el archivo SHALL eliminarse sin dejar referencias rotas.

#### Scenario: Retirar una fotografía de la intervención inicial en una orden reabierta
- **DADO** una orden reabierta cuyas fotografías pertenecen a la intervención inicial
- **CUANDO** se intenta retirar una de ellas
- **ENTONCES** el sistema SHALL rechazarlo y SHALL conservar la fotografía.

#### Scenario: Retiro repetido
- **DADO** una fotografía ya retirada
- **CUANDO** llega otra vez la solicitud de retiro
- **ENTONCES** el sistema SHALL responder sin errores internos ni eventos duplicados.

### Requirement: Consistencia de archivos ante fallos y concurrencia

Un registro de fotografía SHALL existir solo si su archivo quedó almacenado por completo. Un fallo durante la carga SHALL NOT dejar registros sin archivo. Un archivo sin registro, por una carga interrumpida o un retiro, SHALL eliminarse mediante un proceso de limpieza recuperable que pueda repetirse sin efectos adversos. Una carga que se procesa al mismo tiempo que la finalización de la orden SHALL aceptarse solo si la orden sigue abierta al confirmarse. En caso contrario SHALL rechazarse y su archivo SHALL descartarse. Las fotografías SHALL almacenarse de forma privada en el servidor local del sistema, incluirse en su procedimiento de respaldo y conservarse mientras exista la orden, sin caducidad automática. Trazabilidad: RF-TAL-004 («se incluye en respaldos»); RNF-DIS-002; P4.

#### Scenario: Falla al guardar el archivo
- **DADO** un error de almacenamiento durante una carga válida
- **CUANDO** la carga falla
- **ENTONCES** SHALL NOT existir un registro de fotografía y la interfaz SHALL permitir reintentar conservando el archivo seleccionado.

#### Scenario: Carga simultánea con la finalización
- **DADO** una carga en curso cuando otro usuario finaliza la orden
- **CUANDO** ambas solicitudes se procesan
- **ENTONCES** la orden finalizada SHALL NOT recibir la fotografía, la carga SHALL rechazarse indicando que la orden fue finalizada y SHALL NOT quedar un archivo huérfano permanente.

#### Scenario: Limpieza repetida
- **DADO** archivos pendientes de limpieza
- **CUANDO** el proceso de limpieza se ejecuta dos veces
- **ENTONCES** SHALL eliminar solo archivos sin un registro vigente y la segunda ejecución SHALL NOT fallar ni afectar a fotografías vigentes.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
