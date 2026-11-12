## MODIFIED Requirements

### Requirement: PPF-01 Patrón de lista
Toda pantalla de consulta de registros SHALL componerse de:
- encabezado con el icono de la sección en un cuadro de tono suave, antetítulo, título, una sola línea de contexto y la acción principal de creación cuando el usuario tenga permiso;
- franja con búsqueda subrayada, segmentos de estado con su contador y acción para limpiar filtros;
- panel con una tabla cuyo encabezado permanece visible y cuyas columnas mantienen su ancho;
- conteo de resultados y paginación del servidor.

Cada fila SHALL mostrar su estado mediante texto y distintivo, y ofrecer sus acciones según estado y permiso. Al volver desde una ficha, la lista SHALL conservar búsqueda, filtros, orden y página.

**Trazabilidad:** `RNF-USA-002`, `RNF-USA-006`, `RNF-USA-011`; sección 4 de `interfaz-y-navegacion.md`; `DESIGN.md`, «Patrones»; prototipo de U2.

#### Scenario: Consulta con filtros y regreso desde la ficha
- **GIVEN** una lista con un filtro de estado aplicado, un texto de búsqueda y la página 3 abierta
- **WHEN** el usuario abre la ficha de un registro y vuelve a la lista
- **THEN** la lista SHALL mostrar el mismo filtro, el mismo texto, el mismo orden y la página 3

#### Scenario: Usuario sin permiso de creación
- **WHEN** un usuario sin permiso para crear abre la lista
- **THEN** SHALL NOT ver la acción principal de creación, y la lista y sus filtros SHALL seguir disponibles

#### Scenario: Importes y códigos en la tabla
- **WHEN** la tabla muestra importes, cantidades, códigos o números internos
- **THEN** los importes y cantidades SHALL alinearse a la derecha con cifras de ancho uniforme, y los códigos y números internos SHALL mostrarse con cifras de ancho uniforme en su propia columna o etiqueta, sin quedar ocultos bajo otro dato

### Requirement: Patrones en reemplazo

Los patrones de esta spec rigen con la dirección «Grafito y cobre» desde este cambio. Queda pendiente solo el ajuste de `PPF-06` en U6: la pantalla «Cobrar y facturar» SHALL valer como confirmación de lo que contiene, sin un diálogo adicional por cada acción.

Trazabilidad: `DP-036`, reglas 2, 6 y 8; `RNF-USA-003`; `interfaz-y-navegacion.md` §8.1; `docs/cambios-pendientes.md`, U3 y U6.

#### Scenario: Confirmación fuera de «Cobrar y facturar»
- **DADO** una anulación, una devolución u otra acción de la sección 8.1 fuera de «Cobrar y facturar»
- **CUANDO** se ejecuta, aun después de U6
- **ENTONCES** SHALL seguir confirmándose con el diálogo de `PPF-06`.

#### Scenario: Diálogo de confirmación antes de U6
- **DADO** U6 sin archivar
- **CUANDO** una acción con efectos económicos pide confirmación
- **ENTONCES** SHALL usar el diálogo de `PPF-06` con el aspecto de la dirección «Grafito y cobre».

## ADDED Requirements

### Requirement: PPF-11 Maestro y detalle
Cuando una pantalla necesite consultar varios registros y revisar uno sin abandonar la lista, SHALL poder componerse como maestro y detalle:
- a la izquierda, la lista con búsqueda, filtros y los registros agrupados cuando ayude, por ejemplo por letra inicial;
- a la derecha, la vista previa del registro elegido con sus datos principales, sus relaciones y sus acciones, incluida una acción para abrir la ficha completa;
- el registro elegido marcado con un fondo suave y una barra de acento, además del color.

En teléfono, la lista y el detalle SHALL mostrarse uno después del otro, con una acción para volver a la lista. Este patrón SHALL NOT sustituir a PPF-01 ni a PPF-02: solo se usa en las pantallas que lo adopten en un cambio aprobado.

**Trazabilidad:** decisión D1 de la propuesta; `DESIGN.md`, «Patrones»; prototipo de U2 (clientes y facturas); `RNF-USA-002`, `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-011`.

#### Scenario: Elegir un registro
- **DADO** una pantalla de maestro y detalle con varios registros
- **CUANDO** el usuario elige uno con el puntero, el toque o el teclado
- **ENTONCES** la vista previa SHALL mostrar ese registro, la lista SHALL marcarlo como elegido sin depender solo del color y el foco SHALL seguir en la lista

#### Scenario: Filtro que oculta el registro elegido
- **DADO** un registro elegido en la vista previa
- **CUANDO** un filtro o una búsqueda lo deja fuera de la lista
- **ENTONCES** la vista previa SHALL indicar que no hay registro elegido o mostrar el primero visible, sin presentar datos de un registro oculto como si estuviera en la lista

#### Scenario: Maestro y detalle en teléfono
- **DADO** un ancho de 360 px
- **CUANDO** el usuario elige un registro de la lista
- **ENTONCES** SHALL ver su detalle a ancho completo y SHALL poder volver a la lista conservando la búsqueda y los filtros
