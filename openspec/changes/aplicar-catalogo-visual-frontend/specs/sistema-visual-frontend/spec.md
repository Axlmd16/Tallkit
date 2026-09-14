## MODIFIED Requirements

### Requirement: Fidelidad estructural a los frames Figma y adaptación al taller
La interfaz SHALL aplicar de forma coherente el lenguaje visual aprobado a la navegación, las páginas, los controles y los mensajes: lienzo neutro gris lavanda muy claro, superficies blancas, texto principal azul marino oscuro, violeta como acento primario y acentos pastel para estados o categorías. Cada componente derivado de Figma SHALL conservar las dimensiones, el orden visual, la geometría, los colores y la elevación observables de sus nodos registrados, salvo una adaptación accesible o de contenido documentada. La adaptación SHALL conservar la identidad y terminología de Sys-Taller y SHALL NOT copiar la marca Base, su logotipo, ilustraciones, textos ni datos demostrativos.

**Trazabilidad:** `RNF-USA-004`, `RNF-USA-006`, `RNF-USA-008`, `RNF-USA-009`, `RNF-MAN-003`; principios 1, 2 y 8 de `interfaz-y-navegacion.md`; referencia visual SAAS Dashboard aprobada; solicitud correctiva del 2026-09-14.

#### Scenario: Pantallas funcionales con una misma identidad
- **WHEN** un usuario recorre acceso, inicio, usuarios, auditoría, clientes, vehículos y estado técnico
- **THEN** SHALL reconocer en todas las pantallas la misma paleta, tipografía, geometría, elevación, iconografía y jerarquía de acciones

#### Scenario: Adaptación sin copiar la identidad de la plantilla
- **WHEN** una pantalla adopta un patrón observado en SAAS Dashboard
- **THEN** SHALL presentar la marca, el vocabulario, los permisos y los datos propios de Sys-Taller sin mostrar elementos demostrativos de la plantilla

#### Scenario: Componente con nodos estructurados registrados
- **GIVEN** un componente asociado con uno o más node IDs de Figma
- **WHEN** se representa en la aplicación o en el catálogo visual
- **THEN** SHALL mantener la jerarquía, geometría, color y elevación de esos nodos, o SHALL identificar de forma explícita cualquier adaptación vigente

#### Scenario: Tarjeta métrica derivada de Dashboard
- **GIVEN** la tarjeta métrica referenciada por `4:508`, `4:510` y `4:511`
- **WHEN** se muestra un indicador con valor y etiqueta
- **THEN** SHALL presentar primero el valor principal de 22 px y debajo su etiqueta, sin añadir un borde dominante no presente en la referencia

#### Scenario: Menú contextual derivado de Invoice List-Dropdown
- **GIVEN** el menú contextual referenciado por `4:1498`
- **WHEN** el menú está abierto
- **THEN** SHALL usar superficie blanca, radio de 10 px y elevación equivalente a `0 10px 20px rgba(0,0,0,0.1)` sin contorno oscuro dominante

### Requirement: Jerarquía mediante lienzo y superficies elevadas
La interfaz SHALL organizar el contenido sobre un lienzo claro mediante superficies blancas de bordes redondeados, separación medida en Figma y elevación únicamente donde la referencia la declara. Las superficies SHALL agrupar contenido relacionado y facilitar el escaneo sin convertir cada texto o control en una tarjeta ni depender de divisores oscuros o decoración industrial. Todo valor visual consumido SHALL producir el color, radio o elevación esperado en la interfaz resultante; un valor ausente o no aplicado SHALL NOT degradarse silenciosamente al color de texto ni a la geometría predeterminada del navegador.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-USA-008`; secciones 1, 4, 5 y 8 de `interfaz-y-navegacion.md`; frames `4:2`, `4:660`, `4:1140`, `4:5455`; solicitud correctiva del 2026-09-14.

#### Scenario: Página de consulta con varias regiones
- **WHEN** una página contiene encabezado, filtros, resumen y una lista
- **THEN** SHALL distinguir cada región mediante espacio, superficie o elevación suave y SHALL mantener clara la relación entre los elementos de una misma región

#### Scenario: Densidad de información operativa
- **WHEN** una superficie muestra varios registros o indicadores
- **THEN** SHALL permitir compararlos con rapidez sin presentar ruido decorativo, bordes dominantes ni espacios que oculten la relación entre sus datos

#### Scenario: Superficie sin borde declarado por Figma
- **GIVEN** una tarjeta, calendario, gráfico o layout cuya referencia no declara un borde dominante
- **WHEN** se representa sobre el lienzo aprobado
- **THEN** SHALL conservar una separación sutil mediante espacio, superficie o elevación y SHALL NOT mostrar un contorno azul marino heredado del texto

### Requirement: Iconografía comprensible y consistente
Los iconos SHALL pertenecer a una familia visual consistente, de trazo o peso equivalente, y SHALL reforzar acciones o conceptos conocidos. Cuando un nodo Figma sea la fuente declarada de un icono, la interfaz SHALL usar los bytes exportados de ese nodo o un recurso local cuya geometría haya sido verificada como equivalente; SHALL NOT atribuir a Figma un vector reconstruido manualmente. Todo icono interactivo SHALL tener un nombre accesible, y las acciones críticas SHALL conservar una etiqueta textual visible cuando el icono por sí solo pueda ser ambiguo.

**Trazabilidad:** `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`, `RNF-DIS-001`; secciones 2, 4 y 8 de `interfaz-y-navegacion.md`; nodos `4:645`, `4:622`, `4:637`, `4:323`.

#### Scenario: Acción representada por un icono
- **WHEN** un control utiliza un icono como representación visible
- **THEN** SHALL exponer un nombre comprensible para tecnologías de asistencia y SHALL mostrar ayuda textual cuando su significado no sea evidente

#### Scenario: Acción con efecto crítico
- **WHEN** se presenta una acción que confirma, anula, devuelve, ajusta, desactiva o restaura
- **THEN** SHALL mostrarse una descripción textual del efecto y el icono SHALL ser únicamente un refuerzo

#### Scenario: Icono atribuido a un nodo Figma
- **GIVEN** un icono cuya ficha declara un node ID de Figma
- **WHEN** se inspecciona el recurso servido por la aplicación
- **THEN** SHALL corresponder a la exportación local verificable de ese nodo o a una equivalencia documentada y SHALL permanecer disponible sin acceso a Internet

### Requirement: Referencias estructuradas y mapeo obligatorio
La corrección SHALL usar las propiedades estructuradas del archivo `GRvgnODulXXrLTz4BsaToK`, consultando individualmente los 22 frames `4:344`, `4:2`, `4:660`, `4:1140`, `4:1635`, `4:2246`, `4:2803`, `4:3258`, `4:4239`, `4:4567`, `4:4981`, `4:5455`, `4:5816`, `4:6241`, `4:6577`, `4:3637`, `4:3942`, `4:8584`, `4:7725`, `4:9302`, `4:9333` y `4:7438`, además de nodos auxiliares cuando un frame exceda el contexto disponible. Cada componente SHALL registrar los node IDs usados como fuente y las adaptaciones SHALL carecer de node ID inventado. Antes del código SHALL existir una comparación entre valores actuales y extraídos y una enumeración de componentes afectados.

**Trazabilidad:** instrucciones correctivas del usuario del 2026-09-10 y 2026-09-14; `RNF-USA-002`, `RNF-USA-008`; `UI-001`, `UI-002`, `UI-010`, `UI-011`, `UI-018`, `UI-020`, `UI-023`; `catalogo-visual-reutilizable` CVR-01/02/11.

#### Scenario: Mapeo de las superficies existentes
- **GIVEN** los 22 frames consultados y sus propiedades disponibles
- **WHEN** se corrigen las pantallas y los componentes existentes
- **THEN** cada pieza SHALL indicar los node IDs que determinan su geometría, jerarquía, color, tipografía, iconografía o elevación
- **AND** SHALL preservar rutas, permisos, API, validaciones y pruebas de comportamiento; Recover SHALL NOT introducir envío de correo ni recuperación pública

#### Scenario: Sustitución del contenido demostrativo
- **GIVEN** una región de la referencia cuyo módulo todavía no existe en Sys-Taller
- **WHEN** se reproduce su composición
- **THEN** SHALL conservar sus dimensiones, densidad y proporciones con contenido real disponible o placeholders neutrales identificados como sin datos, sin inventar métricas, personas, productos ni rutas

#### Scenario: Variante sin referencia estructurada
- **GIVEN** una variante adaptable o un estado requerido por el proyecto sin nodo equivalente en Figma
- **WHEN** se incorpora al catálogo o a la aplicación
- **THEN** SHALL identificarse como adaptación y SHALL NOT presentarse como una propiedad extraída del diseño

### Requirement: Aceptación visual explícita y evidencia por etapa
La corrección SHALL ejecutarse por lotes verificables de tokens, navegación, componentes básicos, datos, superposiciones, layouts y patrones especializados. Cada lote SHALL ejecutar pruebas, capturar la aplicación y comparar las regiones equivalentes contra Figma al mismo viewport antes de continuar. Cada componente SHALL conservar estado pendiente o divergente mientras no exista evidencia propia reproducible; el estado verificado SHALL NOT asignarse globalmente ni derivarse solo de que una prueba técnica termine sin errores. Las pruebas técnicas SHALL NOT equivaler a aprobación visual.

**Trazabilidad:** instrucciones correctivas del usuario del 2026-09-10 y 2026-09-14; `RNF-USA-008`, `RNF-MAN-003`, `RNF-MAN-005`; `catalogo-visual-reutilizable` CVR-01/10/11.

#### Scenario: Revisión final por el usuario
- **GIVEN** las pruebas y capturas de todos los lotes
- **WHEN** se presenta el resultado visual
- **THEN** SHALL mostrar referencias Figma y capturas de la aplicación al mismo viewport, junto con diferencias, máscaras o adaptaciones de contenido declaradas
- **AND** el cambio SHALL permanecer sin aceptación visual ni archivo hasta recibir aprobación visual explícita del usuario

#### Scenario: Componente sin comparación equivalente
- **GIVEN** un componente que dispone solo de una captura de la implementación o de una referencia textual
- **WHEN** se consulta su estado de evidencia
- **THEN** SHALL aparecer pendiente o divergente y SHALL NOT aparecer verificado

#### Scenario: Regresión visual detectada
- **GIVEN** una referencia aprobada y una nueva captura comparable
- **WHEN** la comparación supera la tolerancia documentada o altera una propiedad estructurada
- **THEN** la verificación SHALL fallar y SHALL conservar la diferencia abierta hasta corregirla o recibir aceptación explícita

[Referencia terminológica](spec-glossary-reference.md).
