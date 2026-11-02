# impresion-de-etiquetas-de-productos Specification

## Purpose
TBD - created by archiving change imprimir-etiquetas-de-productos. Update Purpose after archive.
## Requirements
### Requirement: Contenido identificativo de la etiqueta

Cada **etiqueta de producto** SHALL identificar un único **Producto** y mostrar:

- el **logotipo de entidad fiscal** comercial vigente cuando exista, sin repetir por separado el nombre que ya forma parte del logotipo;
- como reserva cuando el logotipo no exista o no pueda cargarse, el nombre comercial vigente del **RUC comercial** o su razón social vigente cuando no tenga nombre comercial;
- el código interno en el elemento textual más destacado, con tipografía de máximo peso y cifras tabulares;
- el nombre del producto, limitado visualmente a dos líneas;
- la descripción del producto como texto secundario gris azulado, limitado visualmente a dos líneas;
- el código del fabricante o número de parte cuando exista;
- la marca de producto cuando exista;
- la presentación formada por la cantidad de contenido y la unidad de medida registradas, sin inferir datos desde el nombre o la descripción;
- un código de barras **Code 128** que represente exactamente el código interno.

La etiqueta SHALL usar una plantilla azul oscuro, gris azulado y naranja con un recurso gráfico fijo y original de un camión en la esquina superior derecha. La etiqueta SHALL NOT incluir fotografías ni imágenes del producto ni reservar un área vacía para ellas: la composición SHALL repartir el espacio disponible entre los datos del producto y el código de barras. La etiqueta SHALL NOT mostrar precio, costo, impuesto, existencia, disponibilidad, estado, datos de la entidad artesanal ni el logotipo de Tallkit como emisor. La omisión de número de parte, marca o logotipo SHALL compactar el contenido sin imágenes rotas ni rótulos de datos ausentes. Trazabilidad: DP-009; RN-CAT-001/003/011; RF-CAT-001; UI-030/031; cambio `logotipos-por-ruc`; propuesta D1/D3/D4.

#### Scenario: Producto con identidad comercial completa
- **DADO** un producto con código interno, nombre, descripción, número de parte, marca, cantidad y unidad, y la entidad comercial con logotipo
- **CUANDO** un usuario prepara su etiqueta
- **ENTONCES** SHALL ver esos datos, el logotipo sin nombre duplicado, la presentación y el Code 128 del código interno, sin precio ni información artesanal.

#### Scenario: Datos opcionales ausentes
- **DADO** un producto sin número de parte ni marca y la entidad comercial sin nombre comercial ni logotipo
- **CUANDO** se compone su etiqueta
- **ENTONCES** SHALL mostrarse la razón social como reserva, el código interno, el nombre, la descripción y la presentación sin imágenes rotas ni marcadores para los datos ausentes.

#### Scenario: Nombre largo
- **DADO** un producto cuyo nombre ocupa más de dos líneas
- **CUANDO** se muestra o imprime la etiqueta
- **ENTONCES** SHALL limitarse visualmente a dos líneas sin desplazar el código interno ni el código de barras fuera de la etiqueta.

#### Scenario: Composición sin imagen del producto
- **DADO** cualquier producto del catálogo
- **CUANDO** se compone su etiqueta
- **ENTONCES** SHALL mostrarse sin fotografía del producto, sin zona vacía reservada para ella y con el código de barras integrado en la composición.

### Requirement: Copias y orden del lote

El modal SHALL iniciar cada producto con una copia y permitir asignar una cantidad entera positiva individual. «Aplicar a todos» SHALL copiar una cantidad válida a todos los productos del lote. La hoja SHALL conservar el orden recibido desde la selección manual o desde el filtro y SHALL colocar juntas las copias de un mismo producto antes de continuar con el siguiente. Cambiar cantidades SHALL actualizar el total de etiquetas y la vista previa sin modificar el catálogo.

Trazabilidad: propuesta; RNF-USA-004/007; PPF-04/07; spec `catalogo-de-productos-y-categorias`.

#### Scenario: Cantidades distintas por producto
- **DADO** un lote ordenado con tres productos
- **CUANDO** el usuario asigna dos, una y tres copias respectivamente
- **ENTONCES** SHALL previsualizar seis etiquetas en el mismo orden, agrupando las copias de cada producto.

#### Scenario: Aplicar cantidad a todos
- **DADO** un lote con cantidades diferentes
- **CUANDO** el usuario escribe cuatro y activa «Aplicar a todos»
- **ENTONCES** cada producto SHALL quedar con cuatro copias y el total SHALL actualizarse.

#### Scenario: Cantidad inválida
- **DADO** el modal de preparación abierto
- **CUANDO** una cantidad está vacía, es cero, negativa o no entera
- **ENTONCES** SHALL mostrarse un error corregible junto al control y la impresión SHALL permanecer deshabilitada.

### Requirement: Tamaño y distribución A4

La vista imprimible SHALL usar páginas A4 verticales y un único tamaño fijo de etiqueta de 100 × 55 mm, distribuido en 2 columnas por 5 filas, para 10 posiciones por hoja. El modal SHALL informar ese tamaño y SHALL NOT ofrecer otros tamaños ni permitir editar el ancho o el alto. La cuadrícula SHALL centrar el conjunto de etiquetas en la página. Cada posición SHALL conservar exactamente 100 × 55 mm, incluir líneas de corte finas y no escalarse para llenar el papel. Trazabilidad: RNF-USA-012; RNF-COM-001/005; propuesta D3.

#### Scenario: Hoja de etiquetas
- **CUANDO** el usuario abre el modal
- **ENTONCES** SHALL ver una hoja A4 con 2 columnas, 5 filas y 10 posiciones de 100 × 55 mm.

#### Scenario: Tamaño no configurable
- **CUANDO** el usuario revisa la preparación
- **ENTONCES** SHALL ver el tamaño 100 × 55 mm y las 10 etiquetas por hoja como información, sin selector de tamaño ni campos para escribir ancho o alto.

### Requirement: Posición inicial de la primera hoja

El modal SHALL representar las posiciones de la cuadrícula en orden de lectura, de izquierda a derecha y de arriba abajo, y permitir seleccionar cualquiera como inicio. Las posiciones anteriores SHALL quedar vacías en la primera hoja para aprovechar una hoja parcialmente usada. Solo la primera hoja SHALL respetar ese desplazamiento; toda hoja posterior SHALL comenzar en su primera posición.

Trazabilidad: propuesta D2; RNF-USA-004/007.

#### Scenario: Inicio en una posición intermedia
- **DADO** la cuadrícula predeterminada de 10 posiciones
- **CUANDO** el usuario elige la posición 4 y prepara 12 etiquetas
- **ENTONCES** la primera hoja SHALL dejar vacías las posiciones 1 a 3, colocar 7 etiquetas y la segunda SHALL comenzar en la posición 1 con las 5 restantes.

### Requirement: Vista previa fiel y preparación de la marca

El modal SHALL mostrar una vista previa paginada de las hojas con el tamaño, las posiciones vacías, las líneas de corte y el contenido que se imprimirá. SHALL permitir recorrer todas las páginas y distinguir claramente la página actual y el total. La acción de imprimir SHALL esperar a que la consulta de identidad comercial termine y a que el logotipo cargue o falle; si el logotipo falla, SHALL degradar al nombre sin bloquear indefinidamente.

La vista previa SHALL comunicar carga, error recuperable y producto incompatible sin inventar datos. Deberá ser operable con teclado, conservar el foco dentro del modal y adaptarse desde 360 px. SHALL permitir reducir y aumentar el zoom en varios pasos, indicar el porcentaje y volver a ajustar la hoja; estos controles solo transforman la presentación en pantalla y SHALL conservar la escala física en la salida impresa. Trazabilidad: PPF-07/10; RNF-USA-001/004/006/007/008; `experiencia-adaptable-frontend`; cambio `logotipos-por-ruc`.

#### Scenario: Logotipo listo antes de imprimir
- **DADO** la entidad comercial con logotipo
- **CUANDO** el usuario abre el modal y la imagen termina de cargar
- **ENTONCES** la vista previa SHALL mostrarla y la acción de imprimir SHALL quedar disponible si el resto de los datos es válido.

#### Scenario: Fallo del logotipo
- **DADO** una referencia de logotipo que no puede cargarse
- **CUANDO** termina el intento de carga
- **ENTONCES** la vista previa SHALL mostrar solo el nombre comercial o la razón social y SHALL permitir imprimir sin imagen rota.

#### Scenario: Error al obtener datos del lote
- **CUANDO** falla la lectura de productos o de la identidad comercial
- **ENTONCES** el modal SHALL conservar la selección y las opciones editadas, mostrar el fallo en línea y ofrecer reintentar sin imprimir datos incompletos.

### Requirement: Generación verificable del código de barras

El sistema SHALL generar el Code 128 de cada código interno de manera determinista, con zonas silenciosas, patrón de inicio, datos, suma de control y patrón de parada válidos. SHALL representar los caracteres imprimibles que admita el generador y aprovechar pares numéricos consecutivos cuando ello reduzca el símbolo sin cambiar el valor. La representación SHALL ser SVG nítido en pantalla, impresión y PDF, y SHALL tener un nombre accesible que identifique el código codificado.

Si un código interno existente contiene caracteres que el generador no puede representar con fidelidad, el sistema SHALL identificar el producto y bloquear la impresión del lote; SHALL NOT sustituir, eliminar ni transliterar caracteres, ni modificar el producto. Trazabilidad: RN-CAT-001; RF-CAT-001; RNF-USA-004/007/009; propuesta R2.

#### Scenario: Código alfanumérico
- **DADO** el código interno `FIL-00125`
- **CUANDO** se genera su código de barras
- **ENTONCES** SHALL producirse un Code 128 cuya verificación devuelve exactamente `FIL-00125`.

#### Scenario: Código no representable
- **DADO** un producto con un código que el generador no puede representar fielmente
- **CUANDO** se prepara un lote que lo incluye
- **ENTONCES** SHALL nombrarse el producto y su código en un error, la impresión SHALL quedar bloqueada y el registro SHALL permanecer sin cambios.

### Requirement: Impresión mediante el navegador

La acción «Imprimir» SHALL abrir la impresión del navegador sobre una vista que contenga únicamente las páginas de etiquetas. El CSS de impresión SHALL fijar A4 vertical, medidas en milímetros, saltos entre hojas y colores necesarios; SHALL ocultar navegación, modal, controles y demás interfaz. La vista SHALL advertir que se use escala 100 % y se desactiven encabezados y pies del navegador. Imprimir o guardar como PDF SHALL NOT crear registros, auditoría ni movimientos de inventario.

Si la impresión se cancela, el modal y sus opciones SHALL permanecer disponibles. Trazabilidad: RNF-USA-012; RNF-COM-001/002/005; propuesta.

#### Scenario: Abrir el diálogo de impresión
- **DADO** un lote válido y la marca preparada
- **CUANDO** el usuario activa «Imprimir»
- **ENTONCES** SHALL abrirse el diálogo del navegador con solo las hojas A4 de etiquetas, sin controles de la aplicación.

#### Scenario: Cancelar la impresión
- **CUANDO** el usuario cierra el diálogo de impresión sin imprimir
- **ENTONCES** SHALL volver al modal con el lote, las cantidades y la posición inicial intactos.

#### Scenario: Guardar como PDF
- **CUANDO** el usuario elige el destino PDF del navegador
- **ENTONCES** SHALL obtener las mismas páginas y medidas que en papel, sin que el sistema guarde un trabajo de impresión.
