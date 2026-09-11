## Context

El frontend React ya implementa acceso, cambio de contraseña, inicio, usuarios, auditoría y estado técnico. La primera aplicación de este cambio creó tokens y primitivas reutilizables, pero siguió la dirección “Hoja de taller de precisión”: IBM Plex, azul técnico, divisores visibles y superficies casi planas. El usuario rechazó esa apariencia y aprobó como nueva autoridad visual su copia de Figma **SAAS Dashboard (Community)** de Jiangyu.

Este diseño sustituye la estética anterior; no intenta mezclar ambas. Conserva el comportamiento funcional, los permisos, las rutas, las pruebas útiles y las fronteras actuales de `frontend/src/app`, `frontend/src/pages`, `frontend/src/features` y `frontend/src/shared`. Las capturas y el archivo Figma gobiernan proporción, jerarquía, color, geometría, elevación y composición. El contenido, la marca y los activos deberán ser propios de Sys-Taller.

### Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`.
- `docs/negocio/producto/vision.md`, `alcance-v1.md` y `glosario.md`.
- `docs/negocio/requisitos/interfaz-y-navegacion.md`, `requisitos-no-funcionales.md` y `matriz-trazabilidad.md`.
- `docs/tecnico/arquitectura-inicial.md`, `docs/architecture/c4-containers.md`, ADR-0002 y ADR-0003.
- `proposal.md` y las specs `sistema-visual-frontend` y `experiencia-adaptable-frontend` de este cambio.
- Código y pruebas actuales de `frontend/`, incluidas las primitivas no comprometidas de la primera implementación.
- Dieciocho capturas aportadas por el usuario y el archivo Figma `GRvgnODulXXrLTz4BsaToK`, inspeccionado visualmente en modo de solo lectura.

### Precedencia, contradicciones y límites

- `CT-001` permanece intacta: el backend decide los permisos. La interfaz solo adapta visibilidad y descubrimiento.
- La separación fiscal exige texto visible para **RUC comercial** y **RUC artesanal** cuando existan superficies económicas; el color será secundario.
- `interfaz-y-navegacion.md`, `DESIGN.md` y parte del código no comprometido todavía describen “Hoja de taller de precisión”. Son evidencia de la implementación rechazada y deberán sincronizarse durante la aplicación.
- La prohibición anterior de filas elevadas y de sombras fuera de superposiciones contradice la referencia aprobada. Se reemplaza por elevación suave y controlada en tarjetas, filas y paneles.
- No existe nombre comercial ni logotipo definitivo. Se conservará una zona de marca reemplazable sin inventar una identidad corporativa.
- No se requieren cambios de backend, API, autenticación, permisos, persistencia ni migraciones de datos.

## Goals / Non-Goals

**Goals:**

- Reproducir de forma cercana el carácter visual de SAAS Dashboard: claro, amable, elegante, redondeado y moderadamente expresivo.
- Convertir ese carácter en tokens y componentes reutilizables, no en estilos aislados por pantalla.
- Aplicarlo a las superficies funcionales existentes con contenido real de Sys-Taller.
- Mantener comparación y densidad operativa en computadora, interacción cómoda en tableta y flujos completos desde 360 px.
- Integrar foco visible, contraste AA, nombres accesibles, estados redundantes al color y movimiento reducible.
- Conservar todos los recursos esenciales dentro del paquete local de la aplicación.

**Non-Goals:**

- Copiar la marca Base, su logotipo, personajes, fotografías, textos, datos o módulos demostrativos.
- Añadir funciones de clientes, productos, inventario, ventas, calendario, mensajería, tareas o mantenimiento.
- Cambiar sesiones Django, CSRF, contratos HTTP, permisos o reglas de negocio.
- Crear tema oscuro, personalización visual, aplicación móvil nativa o funcionamiento sin conexión.
- Adoptar un kit completo de componentes o una biblioteca de animación.
- Definir una identidad corporativa definitiva.

## Decisions

### 1. La referencia de Figma es la autoridad visual

La fidelidad se evaluará contra los rasgos repetidos en las pantallas de la plantilla, no contra la implementación rechazada:

- lienzo gris lavanda casi blanco;
- navegación blanca, estrecha y calmada;
- tinta azul marino de alto contraste;
- violeta como acción principal y selección;
- superficies blancas redondeadas con sombras suaves;
- estados pastel de baja saturación con texto legible;
- iconos compactos contenidos en círculos o cuadrados suaves;
- densidad media: aire suficiente sin perder la lectura rápida de listas.

El archivo Figma sirve como referencia de composición, no como catálogo funcional. Solo se implementarán las pantallas y acciones ya autorizadas por las specs del producto.

**Alternativas consideradas:** conservar elementos de la hoja técnica diluiría la dirección aprobada; copiar pantallas literalmente introduciría contenido ajeno y módulos fuera de alcance.

### 2. Sistema cromático derivado de la referencia

Los colores se declararán como propiedades CSS en `frontend/src/shared/styles/index.css` y se expondrán a Tailwind 4 mediante `@theme`. Los componentes consumirán roles semánticos, nunca nombres de paleta arbitrarios.

| Rol | Valor inicial | Uso |
|---|---:|---|
| `canvas` | `#FAFAFB` | Fondo general gris frío extraído del archivo. |
| `surface` | `#FFFFFF` | Navegación, tarjetas, filas y paneles. |
| `surface-muted` | `#F7F7F8` | Campos, barras y agrupaciones secundarias. |
| `surface-selected` | `#EFEEFF` | Navegación, pestañas y filas seleccionadas. |
| `ink` | `#030229` | Títulos y texto principal del archivo Figma. |
| `ink-muted` | `rgb(3 2 41 / 0.5)` | Texto secundario sobre fondos claros. |
| `line` | `rgb(3 2 41 / 0.08)` | Separadores discretos y contornos necesarios. |
| `primary` | `#605BFF` | Acción principal y selección activa. |
| `primary-hover` | `#4F4AE8` | Hover y énfasis del violeta. |
| `focus` | `#504AEF` | Anillo de foco visible. |
| `info` | `#5B93FF` | Información complementaria. |
| `cyan` | `#26C0E2` | Estado auxiliar y acento de datos. |
| `yellow` | `#FFD66B` | Estado auxiliar y acento de datos. |
| `coral` | `#FF8F6B` | Estado auxiliar y acento de datos. |
| `success` | `#3A974C` | Resultado satisfactorio. |
| `warning` | `#F29339` | Atención o estado pendiente. |
| `danger` | `#D11A2A` | Error o acción destructiva. |

Cada estado tendrá una superficie pastel propia, por ejemplo violeta `#EFEEFF`, azul `#EAF2FF`, verde `#EAF7EE`, amarillo `#FFF6DF` y rojo `#FDECEF`. Texto e icono mantendrán el significado cuando el fondo semántico no se distinga.

El inspector conectado al archivo Figma identifica `#605BFF` como violeta principal. Los valores de tinta con opacidad se materializarán como colores semánticos legibles; la semejanza cromática no justifica texto que incumpla el contraste requerido.

**Alternativas consideradas:** el azul `#1D4ED8` de la implementación anterior no reproduce la referencia; copiar colores como utilidades directas impediría ajustar fidelidad y contraste de forma centralizada.

### 3. Tipografía Nunito local y una sola voz de producto

El inspector conectado identifica **Nunito** como la familia dominante del kit. La interfaz usará Nunito en pesos 400, 600, 700 y 800, servida localmente mediante `@fontsource/nunito@5.3.0` con licencia OFL-1.1. Se retirarán IBM Plex Sans y IBM Plex Mono cuando ya no tengan consumidores.

La elección sigue la construcción geométrica, redondeada y amable de la referencia. La misma familia atenderá títulos, controles y datos; códigos, fechas, secuenciales e importes usarán `font-variant-numeric: tabular-nums` y alineación consistente, no una voz monoespaciada ajena al kit.

Escala base:

| Uso | Tamaño / peso | Altura de línea |
|---|---|---|
| Metadato excepcional | 12 px / 400–500 | 16–18 px |
| Etiqueta y tabla | 13–14 px / 400–500 | 20 px |
| Texto y control | 15–16 px / 400–500 | 22–24 px |
| Título de sección | 18–20 px / 600 | 26–28 px |
| Título de página | 24–28 px / 600 | 32–36 px |

El cuerpo ordinario no bajará de 14 px. Las etiquetas permanecerán en sentence case; no se añadirán rótulos en mayúsculas con espaciado artificial.

**Alternativas consideradas:** IBM Plex conserva la estética técnica rechazada; Poppins fue una estimación anterior a disponer del inspector y no coincide con la familia declarada por el archivo; cargar fuentes remotas incumpliría la operación en red local. Algunos frames aislados declaran Google Sans, pero se normalizan a Nunito para mantener una sola voz local y reproducible.

### 4. Geometría, elevación y ritmo reproducen el carácter del kit

La escala espacial conservará una base de 4 px: 4, 8, 12, 16, 20, 24, 32 y 40 px. Se usarán radios diferenciados:

- 5 px en campos y controles compactos;
- 10 px en botones, tarjetas, filas y paneles;
- radios completos solo en distintivos y controles pequeños que el kit presenta como píldoras.

La elevación será suave y azulada, nunca gris pesada:

- `shadow-row`: `1px 17px 44px 0 rgb(3 2 41 / 0.07)`;
- `shadow-card`: `0 10px 30px rgb(3 2 41 / 0.05)`;
- `shadow-overlay`: `-14px 30px 20px 0 rgb(0 0 0 / 0.05)`.
- `shadow-overlay`: `0 24px 60px rgb(25 27 66 / 0.16)`.

No todos los elementos serán tarjetas. La elevación identifica registros, grupos funcionales o capas; texto, filtros sencillos y acciones no recibirán un contenedor adicional sin necesidad.

**Alternativas consideradas:** superficies planas con divisores dominantes repetirían el diseño rechazado; una sombra idéntica en todo eliminaría jerarquía y produciría ruido.

### 5. Phosphor se conserva con tratamiento más cercano a la referencia

Se mantendrá `@phosphor-icons/react@2.1.10`, ya fijado y compatible con el proyecto. Los iconos usarán normalmente 18–20 px, trazo regular o duotone y color neutro; la selección podrá usar violeta y un fondo suave. Los contenedores de indicadores podrán usar círculos de 36–44 px con fondos pastel.

Las acciones ambiguas o críticas conservarán texto. Los botones solo con icono tendrán nombre accesible y ayuda visible al foco o al puntero. No se mezclarán otras familias, emoji ni caracteres Unicode como iconos.

**Alternativas consideradas:** sustituir la biblioteca solo para acercar algunos glifos aumentaría dependencias sin mejorar la estructura; copiar iconos del archivo Figma dificultaría procedencia, accesibilidad y mantenimiento.

### 6. Primitivas reutilizables, con variantes cerradas

Se conservará la separación actual: las piezas visuales viven bajo `frontend/src/shared/ui/`; el estado funcional permanece en `features` y `pages`. Las primitivas no incorporarán acceso HTTP ni autorización.

Familias previstas:

- Acciones: `Button`, `IconButton`, `ButtonGroup`.
- Formularios: `Field`, `Input`, `Select`, `Checkbox`, `FieldError`.
- Estructura: `PageHeader`, `Toolbar`, `FilterPanel`, `Surface`, `StatCard`.
- Estado: `StatusBadge`, `FiscalScopeBadge`, `InlineNotice`, `LoadingState`, `EmptyState`.
- Datos: `ElevatedDataList`, `ResponsiveDataView`, `Pagination`, `RowActions`.
- Superposición: `Drawer` y `Dialog` con gestión de foco.

Las primitivas de la primera implementación podrán reutilizar su API y pruebas si cumplen las nuevas specs, pero se reemplazarán sus decisiones visuales. No se creará un componente universal que acepte cadenas libres de estilos para resolver cualquier pantalla.

**Alternativas consideradas:** mantener clases repetidas por página favorece nuevas desviaciones; incorporar shadcn/ui o un kit completo introduce convenciones y dependencias innecesarias.

### 7. Marco autenticado fiel al patrón de navegación del kit

`frontend/src/app/AuthenticatedShell.tsx` conservará el filtrado actual por permisos, la sesión y el cierre de sesión, pero cambiará su composición:

- **≥ 1200 px:** barra lateral blanca de 220–240 px, marca arriba, opciones con icono y etiqueta, perfil/cierre de sesión abajo; contenido sobre lienzo claro.
- **768–1199 px:** rail blanco de 72–80 px con iconos, estado activo y nombres accesibles; podrá expandirse cuando el ancho y la interacción lo permitan.
- **< 768 px:** encabezado compacto y drawer temporal de ancho apropiado con etiquetas completas; al navegar se cierra y devuelve el foco correctamente.

La selección activa usará bloque violeta muy claro, icono y texto violeta. La navegación inactiva será gris azulado. No se duplicará la navegación por RUC y no se mostrarán rutas sin permiso.

**Alternativas consideradas:** una barra superior permanente desaprovecha el patrón de la referencia y dificulta crecer por capacidades; mantener el `Dialog` genérico como menú móvil impide representar la relación espacial lateral con claridad.

### 8. Páginas operativas con encabezado claro y superficies específicas

Cada página tendrá un título conciso, descripción solo cuando aporte contexto, acción principal alineada al extremo y controles secundarios próximos a la región que afectan. La composición no generará tarjetas de métricas falsas para llenar espacio.

- **Inicio:** bienvenida breve y accesos permitidos; los indicadores solo mostrarán datos reales disponibles.
- **Usuarios:** cabecera, búsqueda/filtros y filas elevadas comparables; creación y edición en drawer cuando el ancho lo permita.
- **Auditoría:** filtros compactos, lista legible y detalle contextual sin inventar acciones de modificación.
- **Estado técnico:** grupos claros para servicios y versión; sin lenguaje promocional ni exposición de secretos.
- **Cambio de contraseña:** formulario contenido y directo, coherente con la autenticación.

La terminología visible seguirá los documentos del negocio y usará verbos concretos: “Crear usuario”, “Guardar cambios”, “Desactivar usuario” y “Reintentar”.

### 9. Acceso dividido con activo original del taller

`frontend/src/pages/login/LoginPage.tsx` usará dos regiones en pantallas amplias: formulario en una columna contenida y una composición visual propia en la región restante. La composición será un SVG local original, de formas planas, que evoque diagnóstico, vehículo y herramientas mediante la paleta violeta, azul, amarillo y coral de la referencia. No copiará personajes ni ilustraciones del kit.

En teléfono el formulario ocupará la superficie principal; la ilustración se reducirá a un acento discreto o se omitirá. No aparecerán registro público, Google, Facebook ni recuperación autónoma porque no existen en la capacidad aprobada.

El SVG decorativo tendrá `aria-hidden="true"`; no deberá transmitir información necesaria. El formulario conservará etiquetas visibles, mensaje genérico de credenciales inválidas y bloqueo de doble envío.

**Alternativas consideradas:** reutilizar las ilustraciones de la plantilla compromete identidad y procedencia; dejar una tarjeta centrada aislada no reproduce la experiencia dividida aprobada.

### 10. Filas elevadas comparables y transformación móvil explícita

En computadora y tableta, usuarios y auditoría usarán encabezados de columna discretos seguidos por filas blancas elevadas y separadas entre 8 y 12 px. Las columnas conservarán una retícula común para comparar registros. Selección, estado y acciones no desplazarán el contenido.

En teléfono, cada registro se convertirá en una composición vertical priorizada: identidad, dato principal, estado y acción primaria visibles; el detalle secundario se abrirá de forma accesible. Si una futura tabla exige comparación horizontal, el desplazamiento quedará dentro de su región y nunca en la página.

Los textos largos se truncarán únicamente cuando exista acceso al valor completo mediante título, expansión o detalle. La paginación seguirá siendo del servidor cuando corresponda.

**Alternativas consideradas:** una tabla continua contradice el patrón elegido; tarjetas móviles sin jerarquía repiten toda la información y deterioran la velocidad de lectura.

### 11. Drawer para formularios contextuales y diálogo para decisiones

Crear y editar usuario se resolverá como `Drawer` desde el borde derecho en pantallas amplias, preservando la lista como contexto. Bajo 768 px ocupará el ancho disponible. El drawer gestionará foco inicial, contención, Escape cuando sea seguro, advertencia de cambios sin guardar y retorno al disparador.

`Dialog` se reservará para confirmaciones, decisiones críticas y mensajes que requieran bloquear temporalmente la interacción. Desactivar, restaurar o restablecer credencial identificará usuario y consecuencia mediante texto; la estética pastel no reducirá la severidad semántica.

**Alternativas consideradas:** usar modal para toda edición oculta innecesariamente el contexto; editar siempre en página separada hace más lento un flujo breve y se aleja del patrón aprobado.

### 12. Estados completos y accesibles

Cada control interactivo tendrá estados `default`, `hover`, `focus-visible`, `active`, `disabled` y `loading` cuando aplique. Las regiones de datos cubrirán skeleton, vacío, error recuperable y contenido listo. Los estados pastel combinarán texto e icono; no usarán el color como única señal.

Los objetivos táctiles esenciales serán de al menos 44 × 44 px en contextos de puntero grueso, con 8 px de separación activable. El foco será un anillo de 2 px con separación de 2–3 px y contraste visible. El orden del DOM coincidirá con el orden visual.

### 13. Movimiento corto y espacial

Las transiciones de color y sombra durarán 140–180 ms. Drawer y diálogo usarán 180–220 ms para explicar entrada y salida espacial. No habrá secuencias de carga, parallax, pulsos permanentes ni animaciones decorativas. Solo se animarán `transform` y `opacity` cuando exista movimiento.

`prefers-reduced-motion: reduce` eliminará el desplazamiento y presentará directamente el estado final. Las operaciones no esperarán a que termine una animación.

### 14. Dependencias y activos reproducibles

La migración tipográfica sustituirá los paquetes IBM Plex por `@fontsource/nunito@5.3.0`; `package.json` y `package-lock.json` deberán cambiar juntos conforme al ADR-0002. Phosphor y axe se conservan. No se añadirán bibliotecas para drawer, diálogo, animación o gráficos.

El SVG del acceso y cualquier activo futuro vivirán bajo el frontend y serán servidos por Vite/Nginx sin conexión externa. La atribución a **SAAS Dashboard**, Jiangyu y su licencia CC BY 4.0 se conservará en la documentación de diseño o avisos de terceros aplicables, sin sugerir que el autor respalda Sys-Taller.

### 15. Estrategia de pruebas y fidelidad

La implementación seguirá TDD para comportamiento y componentes. Se preservarán las pruebas funcionales actuales y se añadirán o adaptarán pruebas para:

- roles accesibles, etiquetas, estados y prevención de doble envío;
- filtrado de navegación y acciones por permiso;
- foco de drawer y diálogo, Escape y retorno al disparador;
- transformación de listas y acciones a 360 px;
- contenido largo, carga, vacío y error;
- movimiento reducido y objetivos táctiles;
- auditoría axe de rutas representativas.

La evidencia visual estable se capturará en 360 × 800, 768 × 1024, 1024 × 768 y 1440 × 900. Se compararán conjuntamente acceso, marco, usuarios, auditoría y estado técnico contra un checklist derivado del Figma: lienzo, navegación, tipografía, violeta, radios, elevación, densidad y adaptación. Una captura no sustituirá aserciones funcionales.

Los comandos finales serán `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` y `npm run test:e2e`, además de los comandos oficiales `make check` y `make test` cuando correspondan al cambio completo.

## Risks / Trade-offs

- **[La fidelidad al kit puede producir una interfaz SaaS genérica]** → conservar composición y acabado, pero usar contenido, jerarquías, iconografía y activo visual propios del taller.
- **[Nunito puede variar ligeramente entre el render de Figma y el navegador]** → usar los pesos identificados por el inspector, servirlos localmente y validar jerarquía y ajuste de texto en los cuatro tamaños objetivo.
- **[El violeta o los tonos pastel pueden fallar contraste]** → usar tonos oscuros para texto y reservar los pasteles para superficies; verificar combinaciones antes de aprobar tokens.
- **[Las sombras repetidas pueden crear ruido o afectar rendimiento]** → limitar tres niveles, evitar blur excesivo y no elevar controles ordinarios.
- **[Las filas separadas pueden perder comparación]** → mantener una retícula compartida y encabezados alineados en computadora y tableta.
- **[El drawer puede ocultar contexto o perder datos]** → mantener overlay, foco controlado, advertencia de cambios y retorno al punto de origen.
- **[La ilustración propia puede retrasar la implementación]** → limitarla a un SVG estático, decorativo y de una sola escena; el formulario funciona sin ella.
- **[La sustitución estética puede alterar permisos accidentalmente]** → reutilizar `PermissionGuard`, la sesión y el filtrado existentes; probar combinaciones de roles.
- **[Las capturas visuales pueden ser frágiles]** → fijar datos, viewport, tiempo y animaciones; mantener aserciones funcionales independientes.
- **[El árbol contiene una implementación rechazada no comprometida]** → reutilizar solo comportamiento comprobado, revisar cada archivo contra este diseño y no tratar el estado actual como autoridad visual.

## Migration Plan

1. Reconciliar las tareas existentes con este diseño y volver a abrir todas las tareas visuales afectadas.
2. Sustituir IBM Plex por Nunito con versiones exactas y actualizar ambos archivos npm.
3. Reemplazar tokens globales y estados base; verificar contraste antes de migrar páginas.
4. Adaptar las primitivas compartidas y añadir `Surface`, `ElevatedDataList` y `Drawer` mediante pruebas.
5. Migrar el marco autenticado y validar navegación activa, permisos, cierre de sesión y los tres modos responsive.
6. Migrar acceso y cambio de contraseña, incluida la composición SVG propia.
7. Migrar inicio, usuarios, auditoría y estado técnico una superficie por vez.
8. Ejecutar pruebas enfocadas después de cada superficie y la matriz visual/accesible al finalizar.
9. Sincronizar `DESIGN.md`, `interfaz-y-navegacion.md`, trazabilidad y evidencia técnica con lo realmente construido.
10. Eliminar los tokens, fuentes, componentes o estilos de “Hoja de taller de precisión” que hayan quedado sin consumidores.

No existe migración de datos ni coordinación de despliegue con el backend. El rollback consiste en revertir el conjunto frontend y restaurar sus dependencias bloqueadas; las rutas, la API y la persistencia continúan compatibles.

## Open Questions

No existen preguntas bloqueantes para crear las tareas.

El inspector conectado confirmó Nunito como familia dominante. El nombre comercial, el logotipo definitivo, las fotografías, el tema oscuro y la personalización visual permanecen aplazados.

## Trazabilidad

| Decisión | Especificaciones y fuentes |
|---|---|
| Autoridad visual y tokens | `sistema-visual-frontend`: reproducción fiel de las propiedades estructuradas de SAAS Dashboard, jerarquía de superficies y acciones. |
| Marco y adaptación | `experiencia-adaptable-frontend`: dispositivos objetivo, navegación lateral, acciones y controles táctiles. |
| Formularios, drawer y diálogo | Ambas specs: formularios adaptables, paneles laterales, teclado y foco. |
| Filas elevadas | `experiencia-adaptable-frontend`: listas y tablas adaptables con filas elevadas; `RNF-USA-002`, `RNF-REN-005`. |
| Acceso dividido | Ambas specs: acceso propio y adaptable; `UI-001`, `RNF-SEG-002`. |
| Estados y accesibilidad | Ambas specs; `RNF-USA-003` a `RNF-USA-010`. |
| Ámbito fiscal | Decisiones confirmadas, modelo de dominio y requisito de estados y ámbitos sin depender del color. |
| Recursos locales | Requisito de recursos visuales locales; `RNF-DIS-001`, `RNF-COM-004`, `RNF-COM-005`; ADR-0002. |
| Preservación funcional | `CT-001`, ADR-0003 y escenarios de adopción y usuario sin permiso. |


## Corrección normativa del 2026-09-10

La instrucción correctiva del usuario sustituye las estimaciones anteriores de este diseño. La ejecución previa no tiene aceptación visual. Se consultaron individualmente los diez frames mediante get_design_context; Login requirió además subcapas `4:8585`, `4:9216`, `4:9228`, `4:9248`, `4:9285`. Una lectura programática adicional verificó dimensiones, colores y efectos sin modificar Figma.

- Inicio: frame 1366 × 1047; sidebar x/y 30, ancho 80, alto 987 y radio 10; contenido x 140; tarjetas superiores y 98, alto 116; paneles x 140/889, ancho 719/447, y 242/682 y alto 408/335; separación 30.
- Listas: filas 70 px en Invoice List y 60 px en Customer List, separación 10, texto 14, encabezado 12 y título 24/700. Sombras solo en fila destacada, hover/foco o menú. Las tarjetas del dashboard no declaran sombra. Menú: 0 10px 20px rgb(0 0 0 / 0.1).
- Sidebar: se usa la variante estrecha de Inicio también en listas, conforme a la petición, aunque los frames de listas declaran 218 px. Los nombres y roles permanecen accesibles y las etiquetas se conservan para tecnologías de asistencia; el título nativo identifica cada enlace al puntero.
- Nunito 400/600/700/800 ya está en el árbol; no se cambia una dependencia que ya coincide. No hay Poppins ni serif en los consumidores actuales. Títulos 24/700; secciones 18/700; datos 12–14/400–600; indicadores 22/800; espaciado tipográfico cero.
- Acentos originales: #5B93FF, #26C0E2, #FFD66B, #FF8F6B, #F29339, #EF37FF, #3A974C, #D11A2A; se conservan variantes de texto oscuras para contraste. Blanco y #F7F7F8 completan superficies.
- Drawer: variante Add Customer 409 px, padding 30 px, campos 349 × 50, radio 5, botón radio 10. Una columna aunque el formulario existente declarase dos. Su contenido y validaciones se conservan.
- Login: frame 1440 × 1112, columna blanca 448, margen interior 50, marca 92, controles 348 × 50, título 25/600. Las posiciones de las zonas sociales se sustituyen por texto neutral de acceso local; no se crean proveedores, registro ni funcionalidades.
- Recover y Confirm: se aplican a los diálogos administrativos existentes. Superficies centrales de 658 y 726 px, radio 10, fondo #F7F7F8. Se conserva la credencial temporal de una sola visualización y todos los textos y botones funcionales existentes.
- Dashboard: las regiones de información no disponible mantienen estructura con placeholders neutrales explícitos; no muestran cifras, series o porcentajes inventados ni nuevas llamadas API. Los accesos efectivos existentes se conservan por permiso.
- Pruebas de comportamiento existentes: se conservan byte a byte durante esta corrección. Se añaden verificaciones de geometría independientes y capturas por etapa. La aceptación humana queda pendiente.

Las fuentes de negocio, modelo conceptual, spec principal, producto, interfaz, RNF y ADR-0002/0003 se consultaron para preservar límites. Brechas detectadas: design anterior prescribe sidebar ancha y sombras generalizadas, specs usan “inspirado” y “separación generosa”, tasks confunden ejecución con aprobación, y Recover/Confirm no son rutas públicas de V1. Esta corrección registra y resuelve esas discrepancias dentro del alcance visual solicitado.
