# sistema-visual-frontend Specification

## Purpose
Establecer el sistema visual aprobado para las superficies presentes y futuras de Sys-Taller.
## Requirements
### Requirement: Jerarquía mediante lienzo y superficies elevadas
La interfaz SHALL organizar el contenido en capas diferenciadas por tono y borde:
- lienzo en neutro cálido claro;
- tarjetas, paneles y tablas blancos con borde fino;
- cabeceras de tabla y fondos de control en neutro suave;
- zonas destacadas en grafito, como la barra lateral y las tarjetas oscuras con el motivo del tacómetro, usadas con moderación;
- espacio de trabajo neutro para los documentos.

La sombra SHALL reservarse a menús flotantes, modales, notificaciones, la hoja del documento y el realce de un elemento que abre otra pantalla cuando el puntero está encima. Las superficies SHALL agrupar contenido relacionado, con una separación de 20 a 28 px entre bloques, sin convertir cada dato en una tarjeta.

**Trazabilidad:** `DP-036`, regla 6; `DESIGN.md`, «Formas, espacio y movimiento»; prototipo de U2; `RNF-USA-001`, `RNF-USA-002`, `RNF-USA-008`; secciones 1, 4, 5 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Página de consulta con varias regiones
- **WHEN** una página contiene encabezado, filtros, resumen y una lista
- **THEN** SHALL distinguir cada región mediante tono de fondo, borde o espacio, y SHALL mantener clara la relación entre los elementos de una misma región

#### Scenario: Información operativa comparable
- **WHEN** una superficie muestra varios registros o indicadores
- **THEN** SHALL permitir compararlos en filas o columnas alineadas, con la jerarquía marcada por el peso de la letra, y SHALL NOT usar sombras ni una tarjeta por registro dentro de una tabla

### Requirement: Jerarquía cromática y de acciones consistente
El cobre SHALL identificar la acción principal y el elemento activo de la navegación. Cada pantalla o modal SHALL tener como máximo una acción en cobre; las acciones secundarias SHALL presentarse con contorno o sin fondo. Los enlaces y el foco SHALL usar su propio token. Los tonos de cada negocio SHALL usarse solo para identificarlo (logo, marca y tintes de sus bloques) y SHALL NOT aplicarse a botones. El cobre SHALL NOT usarse para estados ni para identificar a un negocio. Las acciones destructivas SHALL diferenciarse mediante texto, iconografía y tratamiento de peligro, no solo mediante color.

**Trazabilidad:** `DP-036`, regla 6; `DESIGN.md`, «Principios» y «Paleta»; `RNF-USA-003`, `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`; secciones 4, 5 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Jerarquías distintas dentro de una operación
- **WHEN** una pantalla presenta una acción principal, una secundaria y una destructiva
- **THEN** SHALL distinguir claramente su prioridad y su efecto sin que compitan por la misma prominencia visual

#### Scenario: Una sola acción principal
- **WHEN** una pantalla o un modal ofrece varias acciones
- **THEN** como máximo una SHALL mostrarse en cobre y las demás SHALL tener contorno o ningún fondo

#### Scenario: Acción equivalente en pantallas diferentes
- **WHEN** una misma clase de acción principal aparece en dos pantallas
- **THEN** ambas SHALL conservar un tratamiento visual e interactivo equivalente

#### Scenario: Contraste de los colores de marca
- **WHEN** se evalúa el contraste de textos y controles esenciales, incluido el texto blanco sobre cobre
- **THEN** SHALL alcanzar el nivel AA de WCAG 2.2 y ningún botón SHALL usar el tono de un negocio

### Requirement: Tipografía amable, legible y jerarquizada
La interfaz SHALL usar Montserrat en los pesos 300, 400, 500, 600 y 700, servida desde la instalación. No SHALL usarse una tipografía monoespaciada: códigos, placas, RUC, identificaciones, números internos, importes y cantidades SHALL usar cifras de ancho uniforme, y los códigos y placas un espaciado entre letras que los separe. La escala SHALL ser:
- texto de interfaz de 14 px;
- títulos de página de 28 px en peso 700;
- títulos de bloque de 15 a 16 px en peso 700;
- etiquetas y texto auxiliar de 12 a 12,5 px en peso 500;
- importes destacados de 24 a 40 px en peso 300.

La jerarquía SHALL marcarse con el peso: nombres en 700, datos en 400 con tono de apoyo e importes en 700 dentro de las tablas.

**Trazabilidad:** `DP-036`, regla 6; `DESIGN.md`, «Tipografía»; decisión D2 de la propuesta; `RNF-USA-008`, `RNF-USA-009`, `RNF-DIS-001`; secciones 1, 4 y 5 de `interfaz-y-navegacion.md`.

#### Scenario: Lectura de información operativa
- **WHEN** un usuario consulta una pantalla con títulos, etiquetas, valores y ayuda contextual
- **THEN** SHALL identificar la jerarquía y asociar cada valor con su etiqueta sin ampliar manualmente la página

#### Scenario: Código o cifra sensible a confusión
- **DADO** una placa, un código o un RUC con caracteres parecidos, como 0 y O o 1, I y l
- **CUANDO** se muestra en una lista, una ficha o una pieza del taller
- **ENTONCES** SHALL usar cifras de ancho uniforme y espaciado, los importes SHALL alinearse por sus cifras, y si la revisión del piloto muestra que esos caracteres no se distinguen, SHALL corregirse antes de rediseñar el resto de módulos

### Requirement: Iconografía comprensible y consistente
Los iconos SHALL pertenecer a una familia visual consistente, de trazo o peso equivalente, y SHALL reforzar acciones o conceptos conocidos. Todo icono interactivo SHALL tener un nombre accesible, y las acciones críticas SHALL conservar una etiqueta textual visible cuando el icono por sí solo pueda ser ambiguo.

**Trazabilidad:** `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`; secciones 2, 4 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Acción representada por un icono
- **WHEN** un control utiliza un icono como representación visible
- **THEN** SHALL exponer un nombre comprensible para tecnologías de asistencia y SHALL mostrar ayuda textual cuando su significado no sea evidente

#### Scenario: Acción con efecto crítico
- **WHEN** se presenta una acción que confirma, anula, devuelve, ajusta, desactiva o restaura
- **THEN** SHALL mostrarse una descripción textual del efecto y el icono SHALL ser únicamente un refuerzo

### Requirement: Estados y retroalimentación consistentes
Los controles y las operaciones SHALL comunicar de manera consistente los estados disponible, enfocado, activo, deshabilitado, procesando, completado, advertencia y error. Los estados semánticos SHALL usar fondos suaves con texto de contraste suficiente y un marcador o icono, sin depender únicamente del color. La finalización de una acción SHALL confirmarse con una notificación temporal. Advertencias y errores SHALL permanecer en línea junto a lo afectado. La interfaz SHALL impedir que una acción crítica parezca disponible mientras su envío anterior continúa en proceso.

**Trazabilidad:** `RNF-USA-003` a `RNF-USA-008`; secciones 5 y 8 de `interfaz-y-navegacion.md`; decisión 7 del proposal; `patrones-de-pantalla-frontend` PPF-07 y PPF-08.

#### Scenario: Operación en proceso
- **WHEN** un usuario inicia una acción que no debe enviarse dos veces
- **THEN** el control SHALL indicar que la operación está en proceso y SHALL impedir un segundo envío hasta recibir un resultado

#### Scenario: Error recuperable
- **WHEN** una operación falla por información que el usuario puede corregir
- **THEN** la interfaz SHALL identificar el campo o acción afectada, explicar la corrección y conservar la información válida ya ingresada

#### Scenario: Estado vacío o fallo de consulta
- **WHEN** una lista no tiene resultados o no puede cargarse
- **THEN** la pantalla SHALL distinguir ambos estados y, cuando el fallo sea recuperable, SHALL ofrecer una acción explícita para reintentar

#### Scenario: Acción completada
- **WHEN** una creación o edición termina con éxito
- **THEN** SHALL mostrarse una notificación temporal y SHALL NOT quedar una franja de éxito fija en la página

### Requirement: Estados y ámbitos comprensibles sin depender del color
Los estados del negocio SHALL comunicarse mediante texto y un marcador de forma, además del color. El ámbito **RUC comercial** o **RUC artesanal** SHALL mostrarse con su nombre, un icono propio y un tono propio distinto para cada uno. Los colores semánticos SHALL conservar el mismo significado en todas las pantallas.

**Trazabilidad:** separación fiscal confirmada; `RNF-USA-006`, `RNF-USA-010`; principios 3, 4 y 10 de `interfaz-y-navegacion.md`; tablero «Fundamentos», sección «Estados y ámbitos fiscales».

#### Scenario: Operación económica con ámbito fiscal
- **WHEN** un usuario abre una operación, documento, cobro o reporte económico
- **THEN** SHALL identificar la entidad fiscal mediante su nombre, su icono y su tono

#### Scenario: Estado comunicado a una persona que no distingue el color
- **WHEN** se muestra un estado como activo, pendiente, confirmado, anulado, éxito o error
- **THEN** SHALL ser comprensible por su texto y su marcador aunque no se perciba su color

### Requirement: Acceso con composición propia y amable
La pantalla de acceso SHALL priorizar el formulario y mostrar la marca Tallkit. Cuando exista espacio suficiente, SHALL complementarlo con una composición visual propia relacionada con el taller y construida con el lenguaje Tallkit. La composición SHALL NOT introducir proveedores de acceso, registro público ni funciones que el producto no ofrece.

**Trazabilidad:** `CT-001`, `RNF-SEG-002`, `RNF-USA-001`, `RNF-USA-008`, `RNF-USA-009`; `UI-001`; decisión 4 del proposal.

#### Scenario: Acceso en pantalla amplia
- **WHEN** un usuario abre el inicio de sesión en una pantalla amplia
- **THEN** SHALL encontrar el formulario claramente delimitado, el logotipo Tallkit y una composición complementaria que no compita con la tarea de autenticarse

#### Scenario: Funciones ajenas a la autenticación vigente
- **WHEN** se presenta la pantalla de acceso
- **THEN** SHALL NOT mostrar registro público, acceso social ni acciones no definidas por la capacidad de identidad aprobada

### Requirement: Recursos visuales disponibles en la red local
Las fuentes, iconos, ilustraciones y demás recursos necesarios para operar la interfaz SHALL estar disponibles desde la instalación del sistema y SHALL NOT depender de servicios públicos de terceros durante el uso ordinario.

**Trazabilidad:** `RNF-DIS-001`, `RNF-COM-004`, `RNF-COM-005`; alcance local definido en `vision.md` y `alcance-v1.md`.

#### Scenario: Operación sin acceso a Internet
- **WHEN** la red local funciona pero no existe acceso a Internet
- **THEN** la interfaz SHALL conservar su tipografía, iconografía, controles, composición y contenido esenciales sin solicitudes obligatorias a proveedores externos

### Requirement: Adopción por las superficies existentes y futuras
Todas las pantallas existentes SHALL adoptar el sistema Tallkit sin cambiar sus permisos, rutas, validaciones ni resultados funcionales. Son:
- acceso, cambio de contraseña, inicio y estado técnico;
- usuarios, auditoría y configuración del taller;
- catálogos auxiliares, productos, servicios y proveedores;
- clientes y vehículos;
- ingresos e inventario;
- ventas, cobros y cuentas por cobrar.

Toda pantalla funcional posterior SHALL usar los fundamentos Tallkit y los patrones de `patrones-de-pantalla-frontend`, salvo que un cambio posterior justifique una excepción.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-MAN-003`, `RNF-MAN-005`; sección 6 de `interfaz-y-navegacion.md`.

#### Scenario: Actualización visual de una pantalla existente
- **WHEN** una pantalla existente adopta el sistema Tallkit
- **THEN** SHALL conservar las mismas acciones autorizadas, validaciones y resultados observables definidos para esa pantalla, y sus pruebas funcionales SHALL seguir pasando

#### Scenario: Usuario sin permiso
- **WHEN** un **Usuario** carece del permiso necesario para una opción de navegación o acción
- **THEN** el sistema visual SHALL NOT hacerla visible ni alterar la denegación obligatoria del backend

### Requirement: Identidad visual Tallkit
La interfaz SHALL aplicar a todas sus pantallas el sistema visual propio **Tallkit · Grafito y cobre**, descrito en `DESIGN.md`:
- neutros cálidos en capas: lienzo claro, superficies blancas y fondos de control suaves;
- grafito para la barra lateral y las zonas destacadas, con el motivo del tacómetro;
- cobre como único color de marca, para la acción principal y lo activo;
- un tono propio por negocio: pizarra para la entidad artesanal y arena para la entidad comercial;
- tres estados apagados: correcto, atención y deuda o error;
- radios de 6 a 20 px según el tamaño del elemento;
- elevación reservada a menús, modales, notificaciones y la hoja del documento.

La interfaz SHALL mostrar el nombre **Tallkit** con el logotipo del producto y SHALL NOT reproducir marcas, logotipos, ilustraciones, textos ni datos de plantillas de terceros.

El logotipo de Tallkit identifica al sistema, no al emisor de los documentos internos. En la hoja de un documento interno, el encabezado SHALL pertenecer a la entidad fiscal emisora, conforme a PPF-09, y Tallkit SHALL aparecer solo como la mención discreta «Generado con Tallkit». Los logotipos de las entidades fiscales son contenido configurado por el negocio. SHALL NOT sustituir al logotipo de Tallkit en la navegación, la pantalla de acceso ni el resto de la interfaz.

**Trazabilidad:** `DP-036`, reglas 3 y 6; `DESIGN.md`; prototipo de U2; `RNF-USA-008`, `RNF-USA-009`, `RNF-MAN-003`; propuesta `logotipos-por-ruc` §7 y §9.

#### Scenario: Recorrido por pantallas de distintos módulos
- **WHEN** un usuario recorre acceso, inicio, una lista, una ficha, un formulario y el editor de venta
- **THEN** SHALL reconocer en todas la misma paleta, tipografía, geometría, elevación, iconografía y jerarquía de acciones

#### Scenario: Marca visible
- **WHEN** se muestra el marco autenticado o la pantalla de acceso
- **THEN** SHALL aparecer el logotipo y el nombre «Tallkit», sin elementos de plantillas de terceros ni de la dirección «Banco de trabajo»

#### Scenario: Marca del sistema frente a la del emisor
- **WHEN** las entidades fiscales tienen logotipo y un usuario recorre la navegación y un comprobante interno
- **THEN** la navegación y el acceso SHALL seguir mostrando el logotipo de Tallkit, y el encabezado del comprobante SHALL mostrar el logotipo del emisor con «Generado con Tallkit» solo al pie

### Requirement: Tokens semánticos con bases para tema oscuro
Colores, superficies, bordes, textos, estados, tonos de cada negocio, radios, sombras, espacios y tipografía, incluidos los tamaños y pesos de letra, SHALL definirse como tokens semánticos con nombre (por ejemplo lienzo, superficie, línea, tinta, acción, enlace, éxito, advertencia, error, negocio artesanal o negocio comercial), no como valores sueltos en cada pantalla. Las pantallas SHALL NOT escribir a mano tamaños de letra, colores ni radios. La estructura SHALL permitir definir más adelante un tema oscuro cambiando solo los valores de los tokens. Esta versión SHALL NOT ofrecer un tema oscuro ni un selector de tema.

**Trazabilidad:** `DESIGN.md`, «Paleta»; `docs/cambios-pendientes.md`, U3 (tamaños de letra escritos a mano); `RNF-MAN-003`.

#### Scenario: Cambio de un valor de marca
- **WHEN** se modifica el valor del token de acción principal
- **THEN** todos los botones principales, la opción activa de la navegación y los demás usos de ese token SHALL reflejar el cambio sin editar cada pantalla

#### Scenario: Tamaño de letra en una pantalla
- **DADO** una pantalla del frontend
- **CUANDO** se revisa su código
- **ENTONCES** sus tamaños de letra SHALL provenir de los tokens de la escala y SHALL NOT existir tamaños escritos a mano

#### Scenario: Tema oscuro no disponible
- **WHEN** el dispositivo del usuario prefiere el esquema oscuro
- **THEN** la aplicación SHALL mantener el tema claro y SHALL NOT mostrar un selector de tema

### Requirement: Piezas visuales propias del taller
La interfaz SHALL representar de forma consistente los datos propios del negocio:
- **Placa:** en una pieza oscura con letras claras, espaciadas y con cifras de ancho uniforme; sobre una superficie oscura, la pieza SHALL invertirse.
- **Placa de RUC:** el RUC de una entidad fiscal en una pieza reconocible y contenida, con la etiqueta «RUC» diferenciada del número y el número con cifras de ancho uniforme, sin separadores añadidos que alteren sus 13 dígitos. La etiqueta SHALL formar parte del nombre accesible.
- **Código de repuesto o de servicio:** en una etiqueta propia, en su columna o junto al nombre, que permite copiarlo.
- **Existencias:** cantidad disponible en un marcador, acompañada del estado «Agotado» cuando es cero, sin clasificarla como baja mediante un umbral no decidido.
- **Importes:** con moneda, dos decimales y alineación a la derecha, y guion cuando no existe dato del servidor.
- **Marca de negocio:** el logotipo configurado de la entidad fiscal o, si no lo tiene, sus iniciales sobre su tono y su forma (círculo para la entidad artesanal, cuadrado redondeado para la comercial), con el nombre de la entidad como nombre accesible.

**Trazabilidad:** `DP-002`, `DP-017`; `DP-036`, regla 3; pendiente `RF-INV-011`; separación fiscal confirmada; `RNF-USA-006`, `RNF-USA-009`, `RNF-USA-010`; `DESIGN.md`, «Piezas del taller».

#### Scenario: Producto sin existencias
- **WHEN** un producto tiene existencia cero
- **THEN** SHALL mostrarse su cantidad y el texto «Agotado» con un indicador redundante al color

#### Scenario: Producto con pocas unidades
- **WHEN** un producto tiene pocas unidades disponibles
- **THEN** SHALL mostrarse la cantidad y SHALL NOT mostrarse «Stock bajo» ni otra clasificación basada en un umbral

#### Scenario: Copiar un código
- **WHEN** el usuario activa la acción de copiar de un código de repuesto o de servicio
- **THEN** el código SHALL copiarse al portapapeles y la acción SHALL tener un nombre accesible

#### Scenario: RUC de una entidad fiscal
- **WHEN** se muestra el RUC `1140258475001` de una entidad fiscal en la configuración
- **THEN** SHALL verse en una placa de RUC con la etiqueta «RUC» y los 13 dígitos con cifras de ancho uniforme, y las tecnologías de asistencia SHALL anunciar «RUC 1140258475001»

#### Scenario: Negocio sin logotipo cargado
- **DADO** dos entidades fiscales con nombres que empiezan igual y sin logotipo cargado
- **CUANDO** una pantalla muestra la marca de cada una
- **ENTONCES** cada marca SHALL distinguirse por sus iniciales, su tono y su forma, y SHALL anunciar el nombre de su entidad

### Requirement: Validación visual contra la maqueta Tallkit
La referencia visual SHALL ser el prototipo aprobado en U2 (`docs/prototipo/`) junto con `DESIGN.md`. El rediseño SHALL entregarse en cuatro fases:
1. Fundamentos y marco de la aplicación.
2. Componentes compartidos.
3. Piloto con el Inicio, la lista de mantenimientos, la ficha del mantenimiento, la lista de productos y un formulario en modal.
4. Resto de módulos.

El prototipo fija fundamentos y patrones, no una fidelidad píxel a píxel. Cada pantalla SHALL conservar su contenido actual: las recomposiciones del prototipo que cambian datos, textos, rutas o el menú SHALL NOT incorporarse en este rediseño. El usuario SHALL poder validar cada fase directamente en la aplicación; las capturas comparativas son opcionales y solo se preparan cuando las solicite. La revisión técnica complementa, pero no sustituye, las correcciones que el usuario indique durante su validación directa.

**Trazabilidad:** decisiones D1 y D4 de la propuesta; `DP-036`, regla 8; `RNF-USA-008`, `RNF-MAN-005`; sección 13 de `interfaz-y-navegacion.md`; `docs/cambios-pendientes.md`, U2 a U6.

#### Scenario: Revisión directa del piloto
- **GIVEN** las cinco pantallas del piloto con sus pruebas en verde
- **WHEN** el usuario las revisa directamente en la aplicación o solicita capturas comparativas
- **THEN** el resto de módulos SHALL NOT rediseñarse hasta recibir su aprobación explícita o sus correcciones

#### Scenario: Validación final sin capturas obligatorias
- **GIVEN** el resto de módulos implementado
- **WHEN** el usuario decide comprobarlo directamente en la aplicación
- **THEN** el cambio SHALL poder cerrarse sin producir un paquete adicional de capturas

#### Scenario: Recomposición reservada a otro cambio
- **DADO** una pantalla cuyo diseño en el prototipo muestra datos o columnas que hoy no tiene, como el Inicio con lo que falta cobrar y facturar
- **CUANDO** se rediseña en este cambio
- **ENTONCES** SHALL adoptar el aspecto nuevo con su contenido actual, y la diferencia SHALL registrarse como pendiente del cambio que le corresponde

### Requirement: Indicadores con conteo y gráfico breve

El sistema visual SHALL ofrecer dos piezas reutilizables para resumir datos, construidas únicamente con los tokens semánticos existentes:

- **Indicador con conteo:** un valor (número o importe), su etiqueta y, cuando sea económico, su ámbito fiscal. Cuando conduce a una lista SHALL comportarse como un enlace, con el tratamiento de enlace y foco del sistema. Varios indicadores relacionados SHALL presentarse dentro de un mismo panel, separados por línea o espacio, sin sombra ni una tarjeta elevada por cada uno. El valor cero SHALL mostrarse sin énfasis de advertencia.
- **Gráfico breve:** una serie corta de barras de un solo ámbito, con su total, sin ejes decorativos, leyendas flotantes ni animaciones que no respeten `prefers-reduced-motion`. SHALL usar el tono del ámbito fiscal que representa. Cada barra SHALL exponer su fecha y su importe como texto accesible y por puntero, foco o toque. Un valor cero SHALL distinguirse de la ausencia de dato.

Ninguna de las dos piezas SHALL depender solo del color para comunicar un estado o un ámbito, ni usar el cobre como tono de un ámbito. Los importes SHALL usar la pieza de importes existente. Las dos piezas SHALL incorporarse al catálogo visual con sus estados de carga, vacío, cero y error. Trazabilidad: D2 del cambio `redisenar-pagina-de-inicio`; «Jerarquía mediante lienzo y superficies elevadas», «Estados y ámbitos comprensibles sin depender del color», «Tokens semánticos con bases para tema oscuro» y «Piezas visuales propias del taller» de esta spec; RNF-USA-006/008/010; RNF-MAN-003; `DESIGN.md`, «Paleta».

#### Scenario: Varios indicadores en un panel
- **WHEN** una pantalla muestra cuatro indicadores relacionados
- **THEN** SHALL presentarlos en un mismo panel con borde fino, comparables entre sí, sin sombra ni tarjeta elevada por indicador

#### Scenario: Indicador que conduce a una lista
- **WHEN** un usuario enfoca con el teclado un indicador que conduce a una lista
- **THEN** SHALL mostrar el foco visible del sistema y su nombre accesible SHALL incluir el valor, la etiqueta y el ámbito fiscal cuando lo tenga

#### Scenario: Gráfico de un ámbito fiscal
- **WHEN** se muestra un gráfico breve del RUC artesanal
- **THEN** SHALL usar el tono artesanal, identificar el ámbito con su nombre y su marca, y SHALL NOT combinar valores del RUC comercial en la misma serie

#### Scenario: Valor de una barra
- **WHEN** un usuario señala, enfoca o toca una barra
- **THEN** SHALL conocer la fecha y el importe de esa barra como texto

#### Scenario: Movimiento reducido
- **WHEN** el dispositivo solicita movimiento reducido
- **THEN** el gráfico breve SHALL mostrarse sin animación de entrada

#### Scenario: Cambio de un token
- **WHEN** se modifica el valor del token de tono de un ámbito fiscal
- **THEN** los indicadores y gráficos de ese ámbito SHALL reflejar el cambio sin editar cada pantalla
