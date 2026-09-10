## Context

El frontend de identidad ya es funcional, pero su presentación es provisional: usa un esquema oscuro `slate/cyan`, clases de Tailwind repetidas directamente en pantallas y formularios, una navegación horizontal y diálogos construidos sin una abstracción común. No existe todavía una biblioteca visual, una familia de iconos ni una referencia duradera para las futuras capacidades.

El usuario aprobó la dirección **Hoja de taller de precisión** mediante la exploración de `ui-ux-pro-max`, `frontend-design` e `impeccable`. La dirección toma de las hojas de inspección, manuales de servicio y fichas de repuestos su orden, precisión y lectura rápida; no intenta imitar papel, metal ni controles físicos de forma decorativa. Las capturas aportadas fijan limpieza, luminosidad y baja ornamentación como referencias, pero no se copiarán.

La computadora es el dispositivo principal para trabajo denso; la tableta es un dispositivo operativo de primera clase y el teléfono debe conservar los flujos esenciales desde 360 px. El sistema se instala inicialmente en una red local, por lo que fuentes e iconos no pueden depender de Internet durante el uso.

### Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`.
- `docs/negocio/producto/vision.md`, `alcance-v1.md` y `glosario.md`.
- `docs/negocio/requisitos/actores-y-roles.md`, `interfaz-y-navegacion.md`, `requisitos-no-funcionales.md` y `matriz-trazabilidad.md`.
- `docs/tecnico/arquitectura-inicial.md`, diagramas C4 y ADR-0002 sobre dependencias reproducibles.
- `openspec/specs/modelo-dominio-taller/spec.md`.
- `proposal.md` y las specs `sistema-visual-frontend` y `experiencia-adaptable-frontend` de este cambio.
- `PRODUCT.md`, creado como contexto resumido para el proceso visual sin sustituir las fuentes canónicas bajo `docs/`.
- Implementación y pruebas vigentes bajo `frontend/src/` y `frontend/e2e/`.

### Precedencia, contradicciones e información insuficiente

- Se conserva `CT-001`: el backend decide permisos. Ocultar navegación o acciones en el frontend es adaptación de la experiencia, no autorización.
- La separación fiscal confirmada exige mostrar **RUC comercial** o **RUC artesanal** mediante texto e indicador redundante en futuras superficies económicas.
- La apariencia oscura vigente contradice la dirección clara aprobada, pero es solamente un estilo temporal y no una decisión arquitectónica; será sustituida.
- No hay nombre comercial, logotipo ni manual de marca definitivos. El sistema reservará una región de identidad reemplazable y usará el nombre configurado sin inventar marca.
- Las futuras pantallas económicas todavía no existen. Se diseñará ahora el patrón de ámbito fiscal, pero su aplicación funcional corresponderá a los cambios que implementen esas capacidades.

### Impacto por área técnica

| Área | Impacto |
|---|---|
| Backend y API | Ninguno. No cambian contratos, sesiones, CSRF, permisos ni respuestas. |
| Datos y migraciones | Ninguno. No se crean modelos, tablas ni datos de configuración persistentes. |
| Frontend | Tokens semánticos, recursos locales, primitivas compartidas, marco adaptable y actualización de las pantallas existentes. |
| Seguridad | Se preservan `PermissionGuard` y la navegación filtrada por permisos. Las acciones críticas mantienen texto explícito y estado de envío único. |
| Operación | La aplicación pasa a una interfaz clara, densa y táctil; no cambia el resultado de ningún flujo funcional. |

No se requiere un ADR: las decisiones son internas, reversibles y limitadas a presentación. El ADR-0002 sí obliga a fijar exactamente y bloquear cualquier dependencia nueva.

## Goals / Non-Goals

**Goals:**

- Convertir **Hoja de taller de precisión** en un sistema visual semántico y reutilizable.
- Lograr una jerarquía sobria, luminosa y operativa sin producir otro dashboard SaaS genérico.
- Mantener densidad útil en computadora y adaptar navegación, formularios, acciones y datos a tableta y teléfono.
- Hacer visibles foco, estado, resultado, ámbito fiscal y jerarquía de acciones sin depender solo del color.
- Centralizar patrones de presentación para que las siguientes capacidades no repitan combinaciones arbitrarias de clases.
- Conservar comportamiento, permisos, rutas y contratos ya verificados.

**Non-Goals:**

- Añadir o modificar funciones del negocio, backend, API, autenticación, permisos o persistencia.
- Crear tema oscuro, personalización por usuario, modo sin conexión o aplicación móvil nativa.
- Adoptar un kit de componentes completo, un framework de estado o una biblioteca de animación.
- Definir logotipo, fotografía, identidad corporativa completa o contenido promocional.
- Diseñar anticipadamente todas las pantallas de inventario, ventas o mantenimiento.

## Decisions

### 1. Lenguaje visual: hoja operativa, no colección de tarjetas

La interfaz usará un lienzo gris claro, superficies blancas, tinta grafito, divisores finos y azul técnico como acento de interacción. La composición se organizará como una hoja continua: encabezado de página, contexto, controles y región de trabajo. Las tarjetas se reservarán para agrupaciones reales, resúmenes autocontenidos y estados; no envolverán cada párrafo o fila.

La influencia del taller aparecerá en la precisión de la retícula, numerales tabulares, etiquetas operativas, separadores y respuesta táctil. No se usarán texturas literales, engranajes decorativos, franjas de peligro, fondos oscuros, neón, vidrio, degradados ni sombras profundas.

**Alternativas consideradas:**

- **Panel administrativo estándar:** familiar, pero indistinguible y propenso a abusar de tarjetas.
- **Banco de control táctil:** comunica herramienta y certeza, pero el relieve permanente reduce espacio y puede volverse temático.
- **Plano modular desplegable:** aporta adaptación por módulos; se conserva esa disciplina responsive sin adoptar diagonales ni animaciones de pliegue.

### 2. Tokens semánticos como única fuente visual

Los valores se declararán como propiedades CSS en `frontend/src/shared/styles/index.css` y se expondrán a Tailwind 4 mediante `@theme`. Los componentes consumirán roles semánticos (`canvas`, `surface`, `text`, `border`, `primary`, `danger`) y no nombres de colores de la paleta (`slate-700`, `blue-600`).

La base aprobada es:

| Rol | Valor inicial | Uso |
|---|---:|---|
| `canvas` | `#F4F6F5` | Fondo general de bajo contraste. |
| `surface` | `#FFFFFF` | Hoja y superficies elevadas. |
| `surface-subtle` | `#E9EEEB` | Cabeceras, selecciones neutras y regiones secundarias. |
| `text` | `#181C1B` | Texto principal. |
| `text-muted` | `#59625E` | Texto secundario; no para información deshabilitada sobre fondos inciertos. |
| `border` | `#CDD5D1` | Divisiones y contornos. |
| `primary` | `#1D4ED8` | Acción principal, enlace y ubicación activa. |
| `primary-strong` | `#1E3A8A` | Hover o énfasis compatible. |
| `focus` | `#2563EB` | Anillo de foco de 2 px con separación. |
| `success` | `#137A4A` | Resultado satisfactorio. |
| `warning` | `#8A5700` | Advertencia y atención. |
| `danger` | `#B42318` | Error o acción destructiva. |

Cada rol semántico tendrá fondo tenue y tinta compatible cuando se use en avisos o insignias. La combinación final se comprobará para WCAG 2.2 AA; un color no se aprobará únicamente por parecerse a esta tabla.

La escala espacial parte de 4 px y usa principalmente 4, 8, 12, 16, 24, 32 y 48 px. Los radios serán 6 px para controles, 8 px para agrupaciones y 12 px para diálogos; la forma de píldora se limita a estados o etiquetas. Las sombras se reservan para elementos superpuestos; la jerarquía normal depende de espacio, borde y tipografía.

**Alternativas consideradas:** mantener utilidades cromáticas directas perpetuaría inconsistencias; añadir un motor de temas no aporta valor porque V1 tendrá un solo tema claro.

### 3. Tipografía local y preparada para datos operativos

Se usará **IBM Plex Sans Variable** para interfaz y contenido, con **IBM Plex Mono** únicamente para placas, códigos, secuenciales, identificadores técnicos y credenciales temporales. Ambas se incorporarán al paquete compilado mediante paquetes Fontsource fijados exactamente, incluyendo solamente pesos y subconjuntos utilizados. La pila de respaldo será `ui-sans-serif, system-ui, sans-serif` y `ui-monospace, monospace`.

La escala será limitada: 12 px para metadatos excepcionales, 14 px para texto secundario y tablas densas, 16 px para contenido y controles, 20/24 px para títulos de sección y 28/32 px para título de página según el ancho. El texto común conservará una altura de línea cercana a 1.5. Cantidades y columnas comparables usarán cifras tabulares; el monoespaciado no se aplicará a párrafos ni a toda la interfaz.

**Alternativas consideradas:**

- La pila del sistema elimina dependencias, pero no ofrece la misma consistencia entre equipos ni una voz técnica reconocible.
- Inter es legible, pero reproduce la apariencia genérica de muchas referencias SaaS.
- Fuentes remotas de Google Fonts incumplen la operación autónoma en la red local.

### 4. Una familia de iconos, siempre subordinada al texto

Se incorporará `@phosphor-icons/react` con versión exacta. Se usarán iconos `regular` de 20 px en navegación y controles; tamaños de 16 px quedan para metadatos, y 24 px para estados o acciones táctiles aisladas. El estado seleccionado podrá reforzarse con peso `fill` solo cuando también exista texto, contraste y `aria-current` o estado equivalente.

Las acciones críticas conservarán etiqueta visible. Los botones solo con icono se limitarán a acciones universales y repetidas, tendrán nombre accesible y ayuda visible al foco/hover. No se usarán emoji, caracteres Unicode sueltos ni iconos provenientes de varias familias.

**Alternativas consideradas:** SVG manual reduce una dependencia, pero multiplica activos y dificulta mantener trazo, tamaño y nombres coherentes. Una biblioteca de componentes completa sería desproporcionada.

### 5. Primitivas compartidas sin ocultar el HTML semántico

Se crearán piezas pequeñas bajo `frontend/src/shared/ui/` para las repeticiones que ya existen o serán necesarias en las superficies del cambio:

- `Button`, `IconButton` y `ButtonGroup` con jerarquías primaria, secundaria, discreta y destructiva.
- `Field`, `Input`, `Select`, `Checkbox` y `FieldError`, preservando `label`, ayuda, obligatoriedad y errores mediante relaciones nativas.
- `PageHeader`, `Section`, `Toolbar` y `FilterPanel` para la composición de hoja operativa.
- `StatusBadge`, `FiscalScopeBadge`, `InlineNotice`, `EmptyState` y `LoadingState`.
- `Dialog` con foco inicial, contención del foco, cierre por teclado cuando sea seguro y retorno al control de origen.
- `ResponsiveDataView`, `Pagination` y `RowActions` para comparación tabular en escritorio y detalle progresivo en teléfono.

Las primitivas aceptarán variantes cerradas y propiedades semánticas; no serán envoltorios universales que reciban combinaciones arbitrarias de estilos. Los componentes de `features` conservarán estado y comportamiento funcional. No se moverá acceso HTTP a componentes de presentación.

**Alternativas consideradas:** mantener cadenas de clases por pantalla es más rápido al inicio, pero no satisface consistencia. Adoptar shadcn/ui o un sistema completo introduciría más superficie, convenciones y dependencias de las que este producto necesita.

### 6. Marco adaptable por capacidad, no por dispositivo declarado

Se usarán consultas por ancho y espacio disponible; no detección de dispositivo.

- **Desde 1200 px:** navegación lateral persistente de aproximadamente 240 px, encabezado de página y región de contenido con máximo legible amplio. Las tablas aprovechan el ancho para comparar filas.
- **Entre 768 y 1199 px:** navegación lateral contraída de aproximadamente 72 px cuando haya espacio, con texto accesible mediante expansión o ayuda; en orientación vertical estrecha podrá comportarse como panel superpuesto. El contenido no se reduce a una réplica de escritorio.
- **Por debajo de 768 px:** barra superior compacta y panel lateral modal. El contenido usa una columna, los grupos de botones se reordenan y las acciones adicionales pasan a un menú visible y etiquetado. La ruta activa no cambia al redimensionar.

El marco respetará áreas seguras cuando el navegador las exponga. Los controles esenciales medirán al menos 44 por 44 px en contextos táctiles y tendrán 8 px de separación activable. No habrá acciones disponibles solo por `hover`.

En teléfono, `ResponsiveDataView` mostrará identificación, dato principal, estado y acción prioritaria. El resto aparecerá en un detalle expandible por fila o en una región de datos con desplazamiento horizontal propio cuando la comparación tabular sea indispensable. Nunca se permitirá desplazamiento horizontal de la página completa.

**Alternativas consideradas:** convertir cada tabla en tarjetas independientes pierde comparación y densidad; conservar una tabla ancha con desplazamiento de toda la página impide operar a 360 px.

### 7. Estados, ámbitos fiscales y acciones críticas son redundantes al color

Los estados se expresarán con texto, icono cuando aporte significado y color semántico estable. Los mensajes distinguirán carga, vacío, error recuperable, advertencia y éxito. Un envío no idempotente quedará bloqueado mientras esté pendiente y mostrará verbo en progreso.

El patrón futuro `FiscalScopeBadge` combinará:

- **Comercial:** etiqueta “RUC comercial”, icono de comercio y acento azul.
- **Artesanal:** etiqueta “RUC artesanal”, icono de herramienta y acento ocre.

El nombre y número fiscal reales provendrán del contexto funcional cuando esa capacidad exista; no se codificarán en el sistema visual. En una operación económica el ámbito aparecerá junto al título o identificador del documento, no escondido en un pie o únicamente dentro de un selector.

Las acciones de confirmar, anular, devolver, ajustar, desactivar o restaurar mostrarán verbo y efecto. Los diálogos destructivos identificarán objeto y consecuencia. Los avisos fugaces no serán el único registro de un resultado importante.

### 8. Movimiento breve, funcional y reducible

Se usarán transiciones de 120 a 180 ms para foco visual, apertura de panel, selección y confirmación local. No se animarán propiedades costosas ni se retrasará una operación para exhibir movimiento. `prefers-reduced-motion: reduce` eliminará transiciones no esenciales y mostrará directamente el estado final.

La respuesta “táctil” de la dirección aprobada se limita a cambios breves de fondo, borde o desplazamiento máximo de 1 px al presionar; no se simularán teclas tridimensionales.

### 9. Accesibilidad integrada a componentes y pruebas

El foco visible tendrá anillo de 2 px y separación suficiente; no se eliminará `outline` sin sustitución. El orden del DOM seguirá el orden visual. Los diálogos gestionarán entrada, contención y devolución del foco. Los errores incluirán resumen cuando existan varios y se asociarán a sus campos. Las regiones de estado usarán `aria-live` solo con la prioridad necesaria.

Se añadirá `@axe-core/playwright` como dependencia de desarrollo fijada exactamente para comprobaciones automáticas de las rutas representativas. No reemplazará las pruebas de teclado, contraste ni revisión visual manual.

### 10. Migración incremental conservando comportamiento

La migración seguirá este orden:

1. Incorporar fuentes, iconos y tokens; crear las primitivas con pruebas aisladas.
2. Sustituir el marco autenticado y validar navegación, ruta activa, permisos y cierre de sesión.
3. Migrar acceso y cambio de contraseña.
4. Migrar inicio, usuarios, auditoría y estado técnico, una superficie por vez.
5. Eliminar clases cromáticas provisionales solo cuando no queden consumidores.
6. Escribir `DESIGN.md` como referencia final del sistema construido y sincronizar los requisitos de interfaz y trazabilidad afectados.

Durante la migración no coexistirán dos temas completos: los tokens se introducirán primero y las superficies pasarán a ellos progresivamente. Cada pantalla conservará sus pruebas funcionales antes de modificar la siguiente.

### 11. Verificación proporcional al riesgo visual

La implementación aplicará TDD a primitivas y comportamientos. La cobertura incluirá:

- Variantes, estados deshabilitados y nombres accesibles de controles.
- Navegación autorizada y ruta activa en el marco adaptable.
- Foco de diálogos, recorrido por teclado, errores de formularios y prevención de doble envío.
- Estados de carga, vacío, error, éxito y contenido largo.
- Capturas Playwright estables de las superficies modificadas en 360 × 800, 768 × 1024, 1024 × 768 y 1440 × 900.
- Auditoría automática con axe en rutas representativas y revisión manual de contraste, zoom, orientación, lector de pantalla básico y movimiento reducido.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` y `npm run test:e2e` dentro del flujo oficial del repositorio.

No se modifican límites transaccionales, concurrencia ni idempotencia del backend. En frontend se conserva el bloqueo local de envíos ya existente y se normaliza visualmente mediante las primitivas.

## Risks / Trade-offs

- **[La interfaz clara puede mostrar suciedad visual en pantallas densas]** → usar divisores, alineación y estados de superficie antes que añadir tarjetas o sombras.
- **[IBM Plex y Phosphor incrementan el paquete]** → importar solo los pesos, subconjuntos e iconos utilizados; comprobar el resultado de `vite build` y conservar fallbacks locales.
- **[Una abstracción prematura puede producir componentes demasiado genéricos]** → extraer únicamente patrones usados por al menos una superficie real y mantener variantes cerradas.
- **[La navegación contraída puede depender de iconos ambiguos]** → conservar nombre accesible y ofrecer expansión o ayuda visible; el teléfono usa un panel con etiquetas completas.
- **[La adaptación móvil puede ocultar información secundaria importante]** → declarar prioridades por vista y ofrecer detalle expandible accesible; probar datos largos y estados reales.
- **[Dos ámbitos fiscales pueden confundirse pese al color]** → exigir siempre texto, icono y ubicación consistente; verificar escenarios sin percepción del color.
- **[Las capturas visuales pueden volverse frágiles]** → limitar screenshots a superficies y tamaños representativos, controlar datos/tiempo y mantener aserciones funcionales independientes.
- **[La migración puede alterar permisos accidentalmente]** → reutilizar el cálculo actual de permisos, probar cada rol y no usar las primitivas visuales como guardas de autorización.
- **[Un futuro logotipo puede no encajar]** → reservar una zona de identidad de proporciones moderadas y permitir marca textual o símbolo sin cambiar la estructura.

## Migration Plan

1. Registrar dependencias exactas y licencias compatibles en `package.json` y `package-lock.json`.
2. Añadir tokens, fuentes locales y primitivas sin retirar todavía estilos usados.
3. Migrar y verificar cada superficie en el orden definido en la decisión 10.
4. Ejecutar la matriz responsive, accesibilidad, pruebas funcionales y build.
5. Actualizar `DESIGN.md`, documentación de interfaz y trazabilidad con el resultado realmente construido.
6. Retirar estilos temporales y confirmar que no queden referencias directas a la paleta `slate/cyan` fuera de casos expresamente justificados.

El despliegue no requiere migración de datos ni coordinación con backend. El rollback consiste en revertir el cambio frontend completo y sus dependencias; rutas, API y persistencia permanecen compatibles.

## Open Questions

No existen preguntas bloqueantes para crear las tareas.

Quedan deliberadamente aplazados el nombre comercial, logotipo, fotografías, tema oscuro y personalización visual. Las razones fiscales y números de RUC reales se incorporarán cuando las capacidades económicas definan su contexto de presentación; el patrón visual ya exige que permanezcan explícitos y separados.

## Trazabilidad

| Decisión | Especificaciones y fuentes |
|---|---|
| Lenguaje, tokens y componentes | `sistema-visual-frontend`: lenguaje coherente, tipografía, iconografía y estados; `RNF-USA-004`, `RNF-USA-006`, `RNF-USA-008`. |
| Adaptación por ancho | `experiencia-adaptable-frontend`: dispositivos objetivo, navegación, acciones, formularios y listas; `RNF-USA-001`, `RNF-USA-002`, `RNF-COM-001`, `RNF-COM-002`. |
| Accesibilidad | Ambas specs: teclado, foco, tacto, color redundante y movimiento; `RNF-USA-003` a `RNF-USA-010`. |
| Ámbito fiscal | Separación fiscal confirmada en decisiones y modelo de dominio; escenario de operación económica de `sistema-visual-frontend`. |
| Recursos locales | Requisito de recursos disponibles en red local; `RNF-DIS-001`, `RNF-COM-004`, `RNF-COM-005`. |
| Preservación funcional | `CT-001`, arquitectura inicial, escenarios de adopción y usuario sin permiso. |
