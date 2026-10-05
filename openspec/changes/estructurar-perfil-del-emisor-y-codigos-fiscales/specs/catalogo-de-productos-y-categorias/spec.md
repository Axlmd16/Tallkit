## MODIFIED Requirements

### Requirement: Producto por presentación completa

Cada **Producto** SHALL exigir código interno único (campo `code`), nombre, categoría, cantidad positiva de contenido, unidad de medida y **precio final de catálogo**; descripción, marca de producto y compatibilidades SHALL ser opcionales y el estado inicial SHALL ser activo. El código SHALL quitar espacios exteriores y normalizarse a mayúsculas; su unicidad SHALL incluir inactivos. Después de normalizarse, el código SHALL tener de 1 a 25 caracteres y no contener saltos de línea; un alta o una edición que deje un código más largo SHALL rechazarse con un error asociado al campo. Un producto que ya tenga un código de más de 25 caracteres SHALL conservarse sin truncarlo ni renombrarlo y SHALL seguir operando en ventas e inventario; al editarlo, SHALL poder guardarse sin tocar el código, y cambiar el código SHALL exigir el nuevo límite. Además SHALL admitir un **código del fabricante o número de parte** opcional (`manufacturer_code`), referencia externa que no reemplaza al código interno: SHALL normalizarse igual, vacío equivale a ausente, y su unicidad SHALL evaluarse junto con la marca de producto (misma marca no repite; marcas distintas sí; los productos sin marca comparten un único ámbito), incluyendo inactivos. El código del fabricante SHALL NOT modificar existencias ni crear operaciones de inventario. La **presentación** SHALL conservar cantidad decimal y unidad, sin conversiones automáticas. Diferentes presentaciones vendibles SHALL ser productos distintos. SHALL admitirse una indicación de **kit** comprado sin composición. Crear o editar SHALL validar conjuntamente todos los campos y referencias. Trazabilidad: DP-009/010; RN-CAT-001/005/006/011/012; RF-CAT-001/002/008/009/013/014; UI-030…032; propuesta de estructurar-perfil-del-emisor-y-codigos-fiscales §C y D2; XSD de factura 2.1.0 del SRI (`codigoPrincipal`).

#### Scenario: Producto mínimo persistente
- **GIVEN** categoría y unidad activas y configuración fiscal válida
- **WHEN** se registra un producto con sus campos obligatorios
- **THEN** SHALL persistirse activo y recuperarse la misma ficha al consultarlo

#### Scenario: Código duplicado
- **GIVEN** un producto activo o inactivo con código FIL-01
- **WHEN** se intenta crear otro con « fil-01 »
- **THEN** SHALL rechazarse el código sin crear otro producto

#### Scenario: Código del fabricante repetido en la misma marca
- **GIVEN** un producto de la marca A con código de fabricante BP-1
- **WHEN** se intenta crear o editar otro producto de la marca A con « bp-1 »
- **THEN** SHALL rechazarse con un error asociado al código del fabricante; con la marca B SHALL aceptarse

#### Scenario: Código del fabricante opcional y buscable
- **GIVEN** un producto sin código de fabricante y otro con BP-999
- **WHEN** se busca « bp-99 »
- **THEN** SHALL mostrarse solo el segundo, y la ficha y el listado SHALL mostrar ambos códigos

#### Scenario: Código concurrente
- **GIVEN** dos solicitudes independientes con igual código normalizado
- **WHEN** se procesan simultáneamente
- **THEN** SHALL guardarse como máximo un producto y comunicarse duplicidad al otro

#### Scenario: Datos obligatorios o relaciones inválidas
- **GIVEN** una alta o edición
- **WHEN** falta un campo obligatorio, el contenido no es positivo o una referencia no existe
- **THEN** SHALL rechazarse toda la entrada con errores corregibles por campo

#### Scenario: Presentaciones independientes
- **GIVEN** un producto con contenido de un galón
- **WHEN** se registra otro de medio galón con código propio
- **THEN** SHALL conservarse como otro producto con precio propio sin convertir ni fraccionar el primero

#### Scenario: Edición de ficha
- **GIVEN** un producto persistido
- **WHEN** se cambian nombre, descripción o precio válidamente
- **THEN** SHALL conservarse su identidad y no alterarse valores históricos de operaciones consumidoras

#### Scenario: Kit comprado
- **GIVEN** un producto válido
- **WHEN** se identifica como kit
- **THEN** SHALL seguir siendo un único producto sin crear componentes ni ejecutar desarme

#### Scenario: Código de veintiséis caracteres
- **GIVEN** un alta de producto válida
- **WHEN** el código normalizado tiene 26 caracteres
- **THEN** SHALL rechazarse con un error en el código que indique el máximo de 25, sin crear el producto

#### Scenario: Código en el límite
- **GIVEN** un alta de producto válida
- **WHEN** el código normalizado tiene exactamente 25 caracteres
- **THEN** SHALL persistirse con el código íntegro

#### Scenario: Producto existente con código largo
- **GIVEN** un producto registrado antes de este límite con un código de 40 caracteres
- **WHEN** se edita su precio sin cambiar el código
- **THEN** SHALL guardarse conservando el código de 40 caracteres y el producto SHALL seguir disponible para ventas

#### Scenario: Acortar un código largo
- **GIVEN** un producto con un código de 40 caracteres ya usado en ventas confirmadas
- **WHEN** el Administrador lo cambia por uno único de 12 caracteres
- **THEN** SHALL guardarse el nuevo código y las líneas históricas SHALL conservar el código anterior en su instantánea

#### Scenario: Cambiar un código largo por otro largo
- **GIVEN** un producto con un código de 40 caracteres
- **WHEN** se intenta cambiarlo por otro de 30 caracteres
- **THEN** SHALL rechazarse indicando el máximo de 25, conservando el código anterior

## ADDED Requirements

### Requirement: Localización de productos con código excedido

La consulta de productos SHALL permitir al Administrador filtrar los productos cuyo código interno supera los 25 caracteres, activos e inactivos, con el mismo paginado y orden que el resto de filtros. Cada resultado SHALL mostrar el código y su longitud. El filtro SHALL estar disponible solo para quien puede editar productos y SHALL devolver una lista vacía, no un error, cuando no exista ninguno. El listado SHALL NOT modificar ningún producto ni proponer un código nuevo.

Trazabilidad: propuesta §C.12 y D2; RF-CAT-004; UI-030…032.

#### Scenario: Productos por corregir
- **GIVEN** tres productos con código de más de 25 caracteres, uno de ellos inactivo, y cien con código dentro del límite
- **WHEN** el Administrador aplica el filtro de código excedido
- **THEN** SHALL listarse exactamente los tres, con su código y longitud

#### Scenario: Sin productos por corregir
- **GIVEN** un catálogo en el que todos los códigos tienen 25 caracteres o menos
- **WHEN** el Administrador aplica el filtro
- **THEN** SHALL mostrarse el estado vacío indicando que no hay códigos por corregir

#### Scenario: Vendedor sin permiso de edición
- **GIVEN** un Vendedor que no puede editar productos
- **WHEN** solicita el filtro de código excedido
- **THEN** SHALL denegarse sin revelar el listado

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
