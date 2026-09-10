## ADDED Requirements

### Requirement: Lenguaje visual coherente
La interfaz SHALL aplicar un lenguaje visual coherente a navegación, contenido, controles y mensajes mediante roles semánticos definidos para color, tipografía, espaciado, forma, borde, elevación y movimiento. Un mismo significado o nivel de jerarquía SHALL conservar una presentación equivalente entre pantallas.

**Trazabilidad:** `RNF-USA-004`, `RNF-USA-006`, `RNF-USA-008`, `RNF-MAN-003`; principios 1, 2 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Acción equivalente en pantallas diferentes
- **WHEN** una misma clase de acción principal aparece en dos pantallas del sistema
- **THEN** ambas SHALL comunicar la misma jerarquía y estado interactivo conforme al sistema visual aprobado

#### Scenario: Jerarquías distintas dentro de una operación
- **WHEN** una pantalla presenta una acción principal, una secundaria y una destructiva
- **THEN** cada acción SHALL distinguirse por su jerarquía y significado sin depender únicamente del texto o de una diferencia de color difícil de percibir

### Requirement: Tipografía legible y jerarquizada
La interfaz SHALL usar una escala tipográfica limitada y documentada que distinga títulos, contenido, etiquetas y datos operativos, mantenga el texto ordinario en un tamaño legible y evite que códigos o cifras se confundan entre sí.

**Trazabilidad:** `RNF-USA-008`, `RNF-USA-009`; secciones 1, 4 y 5 de `interfaz-y-navegacion.md`.

#### Scenario: Lectura de información operativa
- **WHEN** un usuario consulta una pantalla con títulos, etiquetas, valores y ayuda contextual
- **THEN** SHALL poder identificar la jerarquía y asociar cada valor con su etiqueta sin ampliar manualmente la página

#### Scenario: Código o valor sensible a confusión
- **WHEN** se muestra un identificador, placa, secuencial o importe
- **THEN** su tratamiento tipográfico SHALL preservar la distinción entre caracteres y la alineación necesaria para compararlo

### Requirement: Iconografía comprensible
Los iconos SHALL pertenecer a una familia visual consistente y SHALL reforzar acciones o conceptos conocidos. Todo icono interactivo SHALL tener un nombre accesible, y las acciones críticas SHALL conservar una etiqueta textual visible cuando el icono por sí solo pueda ser ambiguo.

**Trazabilidad:** `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`; secciones 2, 4 y 8 de `interfaz-y-navegacion.md`.

#### Scenario: Acción representada por un icono
- **WHEN** un control utiliza un icono como representación visible
- **THEN** SHALL exponer un nombre comprensible para tecnologías de asistencia y SHALL mostrar ayuda textual cuando su significado no sea evidente

#### Scenario: Acción con efecto crítico
- **WHEN** se presenta una acción que confirma, anula, devuelve, ajusta, desactiva o restaura
- **THEN** SHALL mostrarse una descripción textual del efecto y el icono SHALL ser únicamente un refuerzo

### Requirement: Estados y retroalimentación consistentes
Los controles y operaciones SHALL comunicar de manera consistente los estados disponible, enfocado, activo, deshabilitado, procesando, completado, advertencia y error. La interfaz SHALL impedir que una acción crítica parezca disponible mientras su envío anterior continúa en proceso.

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

### Requirement: Recursos visuales disponibles en la red local
Las fuentes, iconos y demás recursos necesarios para operar la interfaz SHALL estar disponibles desde la instalación del sistema y SHALL NOT depender de servicios públicos de terceros durante el uso ordinario.

**Trazabilidad:** `RNF-DIS-001`, `RNF-COM-004`, `RNF-COM-005`; alcance local definido en `vision.md` y `alcance-v1.md`.

#### Scenario: Operación sin acceso a Internet
- **WHEN** la red local funciona pero no existe acceso a Internet
- **THEN** la interfaz SHALL conservar su tipografía, iconografía, controles y contenido esenciales sin solicitudes obligatorias a proveedores externos

### Requirement: Adopción por las superficies existentes y futuras
Las pantallas existentes de acceso, cambio de contraseña, inicio, usuarios, auditoría y estado técnico SHALL adoptar el sistema visual sin cambiar sus permisos ni resultados funcionales. Toda pantalla funcional posterior SHALL reutilizar la referencia visual aprobada salvo que un cambio posterior justifique una excepción.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-MAN-003`, `RNF-MAN-005`; `UI-001`, `UI-002`, `UI-010`, `UI-011`, `UI-018`, `UI-082`.

#### Scenario: Actualización visual de una pantalla existente
- **WHEN** una pantalla existente adopta el nuevo sistema visual
- **THEN** SHALL conservar las mismas acciones autorizadas, validaciones y resultados observables definidos para esa pantalla

#### Scenario: Usuario sin permiso
- **WHEN** un **Usuario** carece del permiso necesario para una opción de navegación o acción
- **THEN** el nuevo sistema visual SHALL NOT hacerla visible ni alterar la denegación obligatoria del backend
