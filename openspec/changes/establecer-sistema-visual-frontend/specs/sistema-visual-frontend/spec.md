## ADDED Requirements

### Requirement: Lenguaje visual inspirado en SAAS Dashboard y adaptado al taller
La interfaz SHALL aplicar de forma coherente el lenguaje visual aprobado a la navegación, las páginas, los controles y los mensajes: lienzo neutro gris lavanda muy claro, superficies blancas, texto principal azul marino oscuro, violeta como acento primario y acentos pastel para estados o categorías. La adaptación SHALL conservar la identidad y terminología de Sys-Taller y SHALL NOT copiar la marca Base, su logotipo, ilustraciones, textos ni datos demostrativos.

**Trazabilidad:** `RNF-USA-004`, `RNF-USA-006`, `RNF-USA-008`, `RNF-USA-009`, `RNF-MAN-003`; principios 1, 2 y 8 de `interfaz-y-navegacion.md`; referencia visual SAAS Dashboard aprobada en `proposal.md`.

#### Scenario: Pantallas funcionales con una misma identidad
- **WHEN** un usuario recorre acceso, inicio, usuarios, auditoría y estado técnico
- **THEN** SHALL reconocer en todas las pantallas la misma paleta, tipografía, geometría, elevación, iconografía y jerarquía de acciones

#### Scenario: Adaptación sin copiar la identidad de la plantilla
- **WHEN** una pantalla adopta un patrón observado en SAAS Dashboard
- **THEN** SHALL presentar la marca, el vocabulario, los permisos y los datos propios de Sys-Taller sin mostrar elementos demostrativos de la plantilla

### Requirement: Jerarquía mediante lienzo y superficies elevadas
La interfaz SHALL organizar el contenido sobre un lienzo claro mediante superficies blancas de bordes redondeados, separación generosa y elevación suave. Las superficies SHALL agrupar contenido relacionado y facilitar el escaneo sin convertir cada texto o control en una tarjeta ni depender de divisores oscuros o decoración industrial.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-USA-008`; secciones 1, 4, 5 y 8 de `interfaz-y-navegacion.md`; referencia visual aprobada en `proposal.md`.

#### Scenario: Página de consulta con varias regiones
- **WHEN** una página contiene encabezado, filtros, resumen y una lista
- **THEN** SHALL distinguir cada región mediante espacio, superficie o elevación suave y SHALL mantener clara la relación entre los elementos de una misma región

#### Scenario: Densidad de información operativa
- **WHEN** una superficie muestra varios registros o indicadores
- **THEN** SHALL permitir compararlos con rapidez sin presentar ruido decorativo, bordes dominantes ni espacios que oculten la relación entre sus datos

### Requirement: Jerarquía cromática y de acciones consistente
El violeta SHALL identificar la acción principal, la selección activa y el foco destacado sin aplicarse indiscriminadamente a contenido ordinario. Las acciones secundarias SHALL tener menor peso visual y las destructivas SHALL diferenciarse mediante texto, iconografía y tratamiento semántico, no solo mediante color.

**Trazabilidad:** `RNF-USA-003`, `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`; secciones 4, 5 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Jerarquías distintas dentro de una operación
- **WHEN** una pantalla presenta una acción principal, una secundaria y una destructiva
- **THEN** SHALL distinguir claramente su prioridad y efecto sin que compitan por la misma prominencia visual

#### Scenario: Acción equivalente en pantallas diferentes
- **WHEN** una misma clase de acción principal aparece en dos pantallas
- **THEN** ambas SHALL conservar un tratamiento visual e interactivo equivalente

### Requirement: Tipografía amable, legible y jerarquizada
La interfaz SHALL usar una familia tipográfica sans serif de apariencia geométrica y amable, con una escala limitada que distinga títulos, contenido, etiquetas y datos operativos. El texto ordinario SHALL conservar un tamaño legible y los códigos, secuenciales, fechas e importes SHALL poder compararse sin confusión entre caracteres.

**Trazabilidad:** `RNF-USA-008`, `RNF-USA-009`; secciones 1, 4 y 5 de `interfaz-y-navegacion.md`.

#### Scenario: Lectura de información operativa
- **WHEN** un usuario consulta una pantalla con títulos, etiquetas, valores y ayuda contextual
- **THEN** SHALL identificar la jerarquía y asociar cada valor con su etiqueta sin ampliar manualmente la página

#### Scenario: Código o cifra sensible a confusión
- **WHEN** se muestra un identificador, placa, secuencial o importe
- **THEN** su tratamiento tipográfico SHALL preservar la distinción entre caracteres y la alineación necesaria para compararlo

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
Los controles y operaciones SHALL comunicar de manera consistente los estados disponible, enfocado, activo, deshabilitado, procesando, completado, advertencia y error. Los estados semánticos SHALL poder usar fondos pastel, pero SHALL mantener contraste suficiente y SHALL NOT depender únicamente del color. La interfaz SHALL impedir que una acción crítica parezca disponible mientras su envío anterior continúa en proceso.

**Trazabilidad:** `RNF-USA-003` a `RNF-USA-008`; secciones 5 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Operación en proceso
- **WHEN** un usuario inicia una acción que no debe enviarse dos veces
- **THEN** el control SHALL indicar que la operación está en proceso y SHALL impedir un segundo envío hasta recibir un resultado

#### Scenario: Error recuperable
- **WHEN** una operación falla por información que el usuario puede corregir
- **THEN** la interfaz SHALL identificar el campo o acción afectada, explicar la corrección y conservar la información válida ya ingresada

#### Scenario: Estado vacío o fallo de consulta
- **WHEN** una lista no tiene resultados o no puede cargarse
- **THEN** la pantalla SHALL distinguir ambos estados y, cuando el fallo sea recuperable, SHALL ofrecer una acción explícita para reintentar

### Requirement: Estados y ámbitos comprensibles sin depender del color
Los estados del negocio y el ámbito de **RUC comercial** o **RUC artesanal** SHALL comunicarse mediante texto y, cuando resulte útil, iconografía o forma además del color. Los colores semánticos SHALL conservar el mismo significado en todas las pantallas.

**Trazabilidad:** separación fiscal confirmada; `RNF-USA-006`, `RNF-USA-010`; principios 3, 4 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Operación económica con ámbito fiscal
- **WHEN** un usuario abre una operación, documento, cobro o reporte económico
- **THEN** SHALL identificar de forma visible la entidad fiscal correspondiente mediante su nombre y un indicador visual redundante

#### Scenario: Estado comunicado a una persona que no distingue el color
- **WHEN** se muestra un estado como activo, pendiente, confirmado, anulado, éxito o error
- **THEN** SHALL ser comprensible mediante texto o iconografía aunque no se perciba su color

### Requirement: Acceso con composición propia y amable
La pantalla de acceso SHALL priorizar el formulario y, cuando exista espacio suficiente, SHALL complementarlo con una composición visual propia relacionada con el taller. Esa composición SHALL respetar el lenguaje aprobado y SHALL NOT introducir proveedores de acceso, registro público ni funciones que el producto no ofrece.

**Trazabilidad:** `CT-001`, `RNF-SEG-002`, `RNF-USA-001`, `RNF-USA-008`, `RNF-USA-009`; `UI-001`.

#### Scenario: Acceso en pantalla amplia
- **WHEN** un usuario abre el inicio de sesión en una pantalla amplia
- **THEN** SHALL encontrar el formulario claramente delimitado y una composición complementaria que no compita con la tarea de autenticarse

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
Las pantallas existentes de acceso, cambio de contraseña, inicio, usuarios, auditoría y estado técnico SHALL adoptar el sistema visual sin cambiar sus permisos ni resultados funcionales. Toda pantalla funcional posterior SHALL reutilizar la referencia visual aprobada salvo que un cambio posterior justifique una excepción.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-MAN-003`, `RNF-MAN-005`; `UI-001`, `UI-002`, `UI-010`, `UI-011`, `UI-018`, `UI-082`.

#### Scenario: Actualización visual de una pantalla existente
- **WHEN** una pantalla existente adopta el nuevo sistema visual
- **THEN** SHALL conservar las mismas acciones autorizadas, validaciones y resultados observables definidos para esa pantalla

#### Scenario: Usuario sin permiso
- **WHEN** un **Usuario** carece del permiso necesario para una opción de navegación o acción
- **THEN** el nuevo sistema visual SHALL NOT hacerla visible ni alterar la denegación obligatoria del backend
