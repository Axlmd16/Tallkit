## ADDED Requirements

### Requirement: Identidad visual Tallkit
La interfaz SHALL aplicar a todas sus pantallas el sistema visual propio **Tallkit · Banco de trabajo**:
- neutros en capas: lienzo gris claro, paneles blancos y cabeceras de sección en gris suave;
- azul Tallkit para la acción principal;
- petróleo para la selección, los enlaces y el foco;
- naranja del logotipo solo como acento de marca;
- bordes finos y radios contenidos;
- elevación reservada a menús, diálogos, notificaciones y la hoja del documento.

La interfaz SHALL mostrar el nombre **Tallkit** con el logotipo del producto y SHALL NOT reproducir marcas, logotipos, ilustraciones, textos ni datos de plantillas de terceros.

**Trazabilidad:** decisiones 1, 2, 4 y 9 del proposal; `RNF-USA-008`, `RNF-USA-009`, `RNF-MAN-003`; maqueta Tallkit, tablero «Fundamentos».

#### Scenario: Recorrido por pantallas de distintos módulos
- **WHEN** un usuario recorre acceso, inicio, una lista, una ficha, un formulario y el editor de venta
- **THEN** SHALL reconocer en todas la misma paleta, tipografía, geometría, elevación, iconografía y jerarquía de acciones

#### Scenario: Marca visible
- **WHEN** se muestra el marco autenticado o la pantalla de acceso
- **THEN** SHALL aparecer el logotipo y el nombre «Tallkit», sin elementos de la plantilla SAAS Dashboard

### Requirement: Tokens semánticos con bases para tema oscuro
Colores, superficies, bordes, textos, estados, radios, sombras y tipografía SHALL definirse como tokens semánticos con nombre (por ejemplo lienzo, superficie, línea, tinta, acción, selección, éxito, advertencia o error), no como valores sueltos en cada pantalla. La estructura SHALL permitir definir más adelante un tema oscuro cambiando solo los valores de los tokens. Esta versión SHALL NOT ofrecer un tema oscuro ni un selector de tema.

**Trazabilidad:** decisión 5 del proposal; `RNF-MAN-003`; tablero «Fundamentos», sección «Tema oscuro».

#### Scenario: Cambio de un valor de marca
- **WHEN** se modifica el valor del token de acción principal
- **THEN** todos los botones principales, la paginación activa y los demás usos de ese token SHALL reflejar el cambio sin editar cada pantalla

#### Scenario: Tema oscuro no disponible
- **WHEN** el dispositivo del usuario prefiere el esquema oscuro
- **THEN** la aplicación SHALL mantener el tema claro y SHALL NOT mostrar un selector de tema

### Requirement: Piezas visuales propias del taller
La interfaz SHALL representar de forma consistente los datos propios del negocio:
- **Placa:** en una pieza reconocible, con tipografía monoespaciada.
- **Código de repuesto:** en una etiqueta monoespaciada que permite copiarlo.
- **Existencias:** cantidad disponible acompañada del estado «Agotado» cuando es cero, sin clasificarla como baja mediante un umbral no decidido.
- **Importes:** con moneda, dos decimales y alineación a la derecha, y guion cuando no existe dato del servidor.

**Trazabilidad:** `DP-002`, `DP-017`; pendiente `RF-INV-011`; `RNF-USA-006`, `RNF-USA-009`; tablero «Fundamentos», sección «Componentes del negocio».

#### Scenario: Producto sin existencias
- **WHEN** un producto tiene existencia cero
- **THEN** SHALL mostrarse su cantidad y el texto «Agotado» con un indicador redundante al color

#### Scenario: Producto con pocas unidades
- **WHEN** un producto tiene pocas unidades disponibles
- **THEN** SHALL mostrarse la cantidad y SHALL NOT mostrarse «Stock bajo» ni otra clasificación basada en un umbral

#### Scenario: Copiar un código
- **WHEN** el usuario activa la acción de copiar de un código de repuesto
- **THEN** el código SHALL copiarse al portapapeles y la acción SHALL tener un nombre accesible

### Requirement: Aceptación visual contra la maqueta Tallkit
El rediseño SHALL entregarse en cuatro fases:
1. Fundamentos y marco de la aplicación.
2. Componentes compartidos.
3. Piloto con una lista, una ficha, un formulario y el editor de venta.
4. Resto de módulos.

Cada fase SHALL presentar capturas de la aplicación en los tamaños representativos junto al tablero correspondiente de la maqueta aprobada, y SHALL registrar las diferencias justificadas. La maqueta fija fundamentos y patrones, no una fidelidad píxel a píxel. Las pruebas técnicas SHALL NOT equivaler a la aprobación visual, y la fase siguiente SHALL NOT comenzar sin la aprobación explícita del usuario sobre el piloto.

**Trazabilidad:** decisión 11 del proposal; `RNF-USA-008`, `RNF-MAN-005`; sección 13 de `interfaz-y-navegacion.md`.

#### Scenario: Revisión del piloto
- **GIVEN** la lista, la ficha, el formulario y el editor de venta del piloto con sus pruebas en verde
- **WHEN** se presentan al usuario junto a los tableros de la maqueta
- **THEN** el resto de módulos SHALL NOT rediseñarse hasta recibir su aprobación explícita o sus correcciones

#### Scenario: Diferencia justificada con la maqueta
- **WHEN** una pantalla difiere de la maqueta porque una función de la maqueta está fuera de alcance
- **THEN** la diferencia SHALL registrarse y la pantalla SHALL NOT simular la función ausente

## MODIFIED Requirements

### Requirement: Jerarquía mediante lienzo y superficies elevadas
La interfaz SHALL organizar el contenido en capas diferenciadas por tono y borde:
- lienzo gris claro;
- paneles blancos con borde fino y radio contenido;
- cabeceras de sección y de tabla en gris suave;
- espacio de trabajo gris para los documentos.

La sombra SHALL reservarse a menús flotantes, diálogos, notificaciones y la hoja del documento. Las superficies SHALL agrupar contenido relacionado y facilitar el escaneo sin convertir cada dato en una tarjeta ni inflar los espacios.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-USA-008`; secciones 1, 4, 5 y 8 de `interfaz-y-navegacion.md`; tablero «Fundamentos», sección «Forma».

#### Scenario: Página de consulta con varias regiones
- **WHEN** una página contiene encabezado, filtros, resumen y una lista
- **THEN** SHALL distinguir cada región mediante tono de fondo, borde o espacio, y SHALL mantener clara la relación entre los elementos de una misma región

#### Scenario: Densidad de información operativa
- **WHEN** una superficie muestra varios registros o indicadores
- **THEN** SHALL permitir compararlos con rapidez con filas compactas, tipografía contenida y sin sombras ni tarjetas repetidas por registro

### Requirement: Jerarquía cromática y de acciones consistente
El azul Tallkit SHALL identificar la acción principal. El petróleo SHALL identificar la selección activa, los enlaces y el foco. Ninguno de los dos SHALL aplicarse a contenido ordinario. Las acciones secundarias SHALL tener menor peso visual. Las destructivas SHALL diferenciarse mediante texto, iconografía y tratamiento de peligro, no solo mediante color. El naranja del logotipo SHALL NOT usarse como color de texto.

**Trazabilidad:** decisión 2 del proposal; `RNF-USA-003`, `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`; secciones 4, 5 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Jerarquías distintas dentro de una operación
- **WHEN** una pantalla presenta una acción principal, una secundaria y una destructiva
- **THEN** SHALL distinguir claramente su prioridad y su efecto sin que compitan por la misma prominencia visual

#### Scenario: Acción equivalente en pantallas diferentes
- **WHEN** una misma clase de acción principal aparece en dos pantallas
- **THEN** ambas SHALL conservar un tratamiento visual e interactivo equivalente

#### Scenario: Contraste de los colores de marca
- **WHEN** se evalúa el contraste de textos y controles esenciales
- **THEN** SHALL alcanzar el nivel AA de WCAG 2.2, y ningún texto SHALL usar el naranja del logotipo

### Requirement: Tipografía amable, legible y jerarquizada
La interfaz SHALL usar IBM Plex Sans en los pesos 400, 500, 600 y 700, e IBM Plex Mono para códigos, placas, RUC, identificaciones y números internos. Ambas tipografías SHALL servirse desde la instalación. La escala SHALL ser contenida:
- títulos de página de unos 22 px;
- títulos de panel de unos 15 px;
- texto de interfaz de unos 13–14 px;
- etiquetas y texto auxiliar de 12 px.

Importes y cantidades SHALL usar cifras de ancho uniforme.

**Trazabilidad:** decisión 3 del proposal; `RNF-USA-008`, `RNF-USA-009`; secciones 1, 4 y 5 de `interfaz-y-navegacion.md`; tablero «Fundamentos», sección «Tipografía».

#### Scenario: Lectura de información operativa
- **WHEN** un usuario consulta una pantalla con títulos, etiquetas, valores y ayuda contextual
- **THEN** SHALL identificar la jerarquía y asociar cada valor con su etiqueta sin ampliar manualmente la página

#### Scenario: Código o cifra sensible a confusión
- **WHEN** se muestra un código de repuesto, placa, RUC, número interno o importe
- **THEN** los códigos SHALL usar IBM Plex Mono y los importes SHALL alinearse con cifras de ancho uniforme, preservando la distinción entre caracteres como 0/O y 1/l

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

## REMOVED Requirements

### Requirement: Fidelidad estructural a los frames Figma y adaptación al taller
**Reason**: El usuario reemplazó la plantilla SAAS Dashboard por el sistema propio Tallkit (decisión 1 del proposal).
**Migration**: La identidad visual queda definida por «Identidad visual Tallkit» y «Tokens semánticos con bases para tema oscuro».

### Requirement: Referencias estructuradas y mapeo obligatorio
**Reason**: El archivo Figma `GRvgnODulXXrLTz4BsaToK` y sus nodos dejan de ser la referencia normativa.
**Migration**: Las pantallas siguen los patrones de `patrones-de-pantalla-frontend` y los tableros de la maqueta Tallkit, sin mapeo por nodo.

### Requirement: Aceptación visual explícita y evidencia por etapa
**Reason**: Las ocho etapas y la comparación contra frames de Figma pertenecían a la corrección de fidelidad cancelada.
**Migration**: La aceptación se rige por «Aceptación visual contra la maqueta Tallkit», con cuatro fases y un piloto aprobado por el usuario.
