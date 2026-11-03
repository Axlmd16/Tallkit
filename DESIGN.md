# Sistema visual Tallkit · Banco de trabajo

> **En reemplazo por `DP-036`** (`docs/negocio/decisiones/decisiones-confirmadas.yaml`). Esta dirección visual sigue vigente hasta U3 de `docs/cambios-pendientes.md`; la dirección nueva se escribe al aprobar el prototipo de U2. Hasta entonces, las pantallas que se toquen siguen esta guía.

## Propósito

Esta guía resume el lenguaje visual implementado en el frontend. **Tallkit** es el nombre visible del producto; «Sys-Taller»/«Sys-Inventario» se conserva como nombre técnico del repositorio. La guía no define reglas del negocio ni sustituye las especificaciones OpenSpec:

- `openspec/specs/sistema-visual-frontend/spec.md`: fundamentos, tokens, piezas del taller y aceptación visual.
- `openspec/specs/patrones-de-pantalla-frontend/spec.md`: patrones PPF-01…PPF-08.
- `openspec/specs/experiencia-adaptable-frontend/spec.md`: navegación, modales, listas y formularios por tamaño.
- `openspec/specs/catalogo-visual-reutilizable/spec.md`: catálogo interno de desarrollo.

Estas especificaciones están aprobadas y archivadas en `openspec/specs/`; el cambio `redisenar-sistema-visual-tallkit` quedó en `openspec/changes/archive/2026-09-23-redisenar-sistema-visual-tallkit/`.

## Dirección visual

Sistema propio, pensado para jornadas largas de mostrador y taller; no reproduce plantillas de terceros. Su referencia aprobada es la maqueta «Tallkit — Sistema visual» (2026-09-21), que fija fundamentos y patrones, no pantallas cerradas ni fidelidad píxel a píxel.

- Neutros en capas: lienzo gris claro, paneles blancos y cabeceras de sección en gris suave.
- Azul Tallkit para la acción principal; petróleo para selección, enlaces y foco; naranja del logotipo solo como acento de marca, nunca como texto.
- Bordes finos, radios contenidos y elevación reservada a menús, diálogos, notificaciones y la hoja del documento.
- Densidad alta: filas compactas y sin una tarjeta por registro.

## Recursos locales

- Tipografía: IBM Plex Sans 400, 500, 600 y 700 para la interfaz, e IBM Plex Mono 400, 500 y 600 para códigos, placas, RUC, identificaciones y números internos. Subconjunto latino con tildes y ñ, servido desde la instalación.
- Iconos: Phosphor en peso regular, siempre con nombre accesible cuando no son decorativos.
- Logotipo: `frontend/src/assets/brand/` (principal, secundario e isotipo).
- Ningún recurso visual esencial depende de Internet; una prueba e2e bloquea las solicitudes externas y comprueba que las fuentes cargan.

Versiones exactas en el lockfile: `@fontsource/ibm-plex-sans@5.3.0` y `@fontsource/ibm-plex-mono@5.3.0` (OFL-1.1), `@phosphor-icons/react@2.1.10` (MIT) y, solo para pruebas, `@axe-core/playwright@4.13.0` (MPL-2.0).

## Tokens

Dos capas: los valores crudos `--tk-*` viven en `frontend/src/shared/styles/tokens.css`, y `index.css` los expone a Tailwind con `@theme inline` bajo nombres semánticos. Cambiar un valor actualiza todas las pantallas sin editarlas una a una.

| Token | Valor claro | Uso |
|---|---|---|
| `canvas` | `#F3F4F6` | Lienzo de la aplicación. |
| `surface` / `surface-subtle` / `surface-muted` | `#FFFFFF` / `#F8F9FA` / `#EEF0F3` | Panel, cabecera de sección o tabla, fondo de control. |
| `workspace` | `#E6E9ED` | Fondo del visor de documentos. |
| `line` / `line-strong` | `#E2E5E9` / `#CBD1D8` | Borde de panel y borde de campo. |
| `ink` / `ink-muted` | `#15233A` / `#5B6474` | Texto principal y de apoyo. |
| `primary` / `primary-strong` / `primary-soft` | `#224368` / `#1A3453` / `#E6EDF6` | Acción principal (azul Tallkit). |
| `accent` / `accent-strong` / `accent-soft` | `#0F6B6F` / `#0A5255` / `#E1F0EF` | Selección, enlaces y foco (petróleo). |
| `brand` | `#E58439` | Acento de marca; nunca texto. |
| `scope-commercial` / `-soft` | `#224368` / `#E6EDF6` | RUC comercial. |
| `scope-artisan` / `-soft` | `#94460B` / `#FCEEE2` | RUC artesanal. |
| `success`, `warning`, `danger`, `info` y sus `-soft` | ver `tokens.css` | Estados, con contraste AA sobre su fondo. |

- Radios: `chip` 4 px, `control` 6 px, `panel` 8 px y `dialog` 10 px.
- Sombras: `menu`, `dialog`, `sheet` y `toast`; los paneles ordinarios no tienen sombra.
- Tipografía: títulos de página de unos 22 px, títulos de panel de unos 15 px, texto de interfaz de 13–14 px y etiquetas de 12 px. Importes y cantidades con cifras tabulares.
- Foco visible: contorno de 2 px en `accent`.

### Tema oscuro

`tokens.css` documenta un bloque `[data-theme='dark']` con los valores de la maqueta. Ningún código asigna ese atributo ni responde a `prefers-color-scheme`: el tema claro es el único disponible y no hay selector de tema. Una prueba unitaria y otra e2e lo verifican.

## Marco y composición adaptable

- Desde 1280 px: barra lateral de 240 px con logotipo, grupos de navegación, opción activa en `accent-soft` y usuario, roles y cierre de sesión al pie. Barra superior con ruta de migas y marca de ámbito fiscal en las pantallas económicas; sin búsqueda global.
- De 768 a 1279 px: barra de iconos de 72 px con nombre accesible y ayuda emergente.
- Por debajo de 768 px: barra superior con menú y `NavigationPanel`, un panel temporal que se cierra al elegir.
- El contenido usa todo el ancho disponible.

## Patrones de pantalla

- **Lista (PPF-01):** encabezado con acción principal según permiso; estados por segmentos y filtros en la franja superior del panel; tabla compacta con encabezado visible, importes con `Money` alineados a la derecha y estado con `StatusBadge`. En teléfono, filas de dos líneas. Los filtros viven en la URL y se conservan al volver de la ficha.
- **Ficha (PPF-02):** volver, resumen con la identificación principal (placa, código o número interno en monoespaciada) y el estado, bloques con título y una columna lateral de acciones y datos relacionados que en pantallas estrechas pasa debajo.
- **Formulario en página (PPF-03):** producto, cliente, vehículo, proveedor y configuración del taller, por secciones, con barra de acciones fija y advertencia al abandonar con cambios.
- **Formulario corto en modal (PPF-04):** `FormModal` para marcas, categorías, unidades de medida, servicio, ajuste de inventario y usuario, con «Guardar y crear otro» cuando procede. No se usan paneles laterales para crear ni editar.
- **Editor con vista previa (PPF-05):** venta e ingreso; líneas editables fila por fila, importes solo del servidor (guion si faltan), total junto a las acciones y hoja A4 `DocumentSheet` con el aviso del SRI.
- **Diálogos de confirmación (PPF-06):** objeto y número interno, entidad fiscal, efecto en el cuerpo y valores revisados por el servidor; botón breve que nombra la acción, peligro sólido en las destructivas y salida segura con nombre.
- **Estados de contenido (PPF-07):** carga con marcadores, vacío con acción de creación, sin resultados con «Limpiar filtros», error con «Reintentar» y sin permiso; nunca datos inventados.
- **Página de configuración:** una sola hoja blanca con borde y sin sombra, de alto completo desde `md` (`flex-1` sobre `calc(100dvh - 100px)`); `SectionNav` (enlaces con `aria-current`, rótulo «Secciones», vertical desde 1024 px con marca petróleo y fondo suave, barra horizontal por debajo) y contenido en modo de consulta con `SheetHeading`, `FactList`/`FactRow`, tablas con `sheetTableHead`/`sheetTableCell` agrupadas por entidad, `StateMark` para estados y `AdvancedInfo` para datos técnicos. Toda edición se abre en `FormModal`. En facturación, el título es la subsección actual; `EntitySwitch` es un selector segmentado compacto a su derecha; `HintPopover` despliega el aviso de preparación local y los pendientes con puntero, foco o toque, y `StateChip` muestra los estados con los tonos semánticos. Los modales con vista previa usan el tamaño `large` (860 px).
- **Notificaciones temporales (PPF-08):** `ToastProvider`/`useToast` abajo a la derecha, 6 s, pausa con puntero o foco, cierre con Escape, hasta tres y enlace «Ver». La región se monta fuera de la aplicación y queda exenta del aislamiento de los modales para anunciarse aunque haya uno abierto. Los errores y advertencias permanecen en línea.

## Piezas del taller

- `PlateTag`: placa en una pieza reconocible y monoespaciada.
- `PartCode`: código de repuesto monoespaciado con acción de copiar accesible.
- `StockIndicator`: cantidad disponible y «Agotado» en cero; nunca «Stock bajo», porque el umbral (`RF-INV-011`) sigue sin decidir.
- `Money`: importe USD con dos decimales o guion, sin aritmética de coma flotante.
- `FiscalScopeBadge`: «RUC comercial» o «RUC artesanal» con icono y tono propios.
- `ScopeLabel`: rótulo en mayúsculas con icono y tono del ámbito que encabeza fichas y grupos de tabla.
- `RucPlate`: placa de RUC con la etiqueta «RUC» sobre tinta y los 13 dígitos monoespaciados, sin separadores.
- `DocumentSheet`: hoja A4 común a la vista previa, el comprobante y la impresión.

## Componentes compartidos

`frontend/src/shared/ui/` agrupa acciones, campos (incluido `Combobox`, que sustituye al antiguo selector de referencias), navegación, superposiciones (`Modal`, `FormModal`, `Dialog`, `ConfirmationPanel`, `DropdownMenu`, `Tooltip`), datos, estados, notificaciones, superficies y piezas del taller. `Drawer` se conserva sin exportación pública ni consumidores funcionales para una capacidad futura; no se usa como formato de creación o edición. Se retiraron las familias de gráficos, calendario, tablero, conversación y cronología, y los layouts y tarjetas de métricas de la plantilla anterior; volverán solo cuando una capacidad aprobada los necesite.

El frontend oculta opciones según los permisos efectivos, pero el backend conserva la autoridad sobre toda acción.

## Accesibilidad e interacción

- Objetivos táctiles de al menos 44 px en controles esenciales.
- Errores asociados a sus campos; estados comprensibles por texto y marcador, sin depender del color.
- Modales, diálogos y el panel de navegación contienen el foco, cierran con Escape y lo devuelven al disparador. Cerrar un modal con cambios pide «Seguir editando» o «Descartar».
- Movimiento breve y desactivado con `prefers-reduced-motion`.
- `axe` y la comprobación de desplazamiento horizontal se ejecutan en 360, 768, 1024, 1280 y 1440 px (`frontend/e2e/responsive.spec.ts`); las infracciones serias o críticas bloquean la suite.

## Catálogo visual interno

`frontend/visual-catalog.html` (puerto 55175 en desarrollo) muestra los componentes y patrones Tallkit por familias —fundamentos, acciones, campos, combobox, tablas, estados, piezas del taller, superposiciones, notificaciones, navegación y patrones de pantalla—, cada uno con su tablero de origen o marca de adaptación, variantes o estados reproducibles en los cinco anchos, criterios de aceptación y diferencias conocidas. Queda fuera de la compilación productiva y se prueba con `npm run test:e2e:catalog`.

## Aceptación visual

El usuario valida el rediseño directamente en la aplicación y puede apoyarse en el catálogo reproducible. Las capturas comparativas son opcionales y solo se preparan cuando las solicita. Las diferencias justificadas siguen registradas, por ejemplo las funciones de la maqueta fuera de alcance como la búsqueda global o los indicadores sin dato del servidor.
