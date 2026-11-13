## Context

U3 aplica al frontend la dirección «Tallkit · Grafito y cobre» aprobada en U2 (`DESIGN.md`, `docs/prototipo/`), según la propuesta y las specs aprobadas (`492286f`, `2ee7bb0`). Solo cambia la presentación: backend, API, datos, permisos, rutas y textos no cambian (decisión D1).

Estado actual, inspeccionado en `frontend/` el 2026-11-12:

- **Tokens en dos capas.**
  - `src/shared/styles/tokens.css` declara valores crudos `--tk-*`.
  - `src/shared/styles/index.css` los expone a Tailwind 4.3.3 con `@theme inline` bajo nombres semánticos (`primary`, `accent`, `scope-commercial`, `scope-artisan`, `canvas`, `surface`, `ink` y otros) y con radios `chip`, `control`, `panel` y `dialog`.
  - El tema oscuro está declarado y nunca se activa.
- **Tipografía.**
  - IBM Plex Sans (400–700) e IBM Plex Mono (400–600) de `@fontsource/*@5.3.0`, con `@font-face` locales en `index.css`.
  - Hay **153 usos de `font-mono`** en 72 archivos.
  - Hay **298 tamaños escritos a mano** (`text-[13px]` ×161, `text-[12.5px]` ×31, `text-[22px]` ×24, `text-[11px]` ×20, etc.).
  - `document-sheet.css` y `product-label*.css` (hojas impresas, PPF-09 y PPF-10) tienen su propia tipografía en píxeles.
- **Marco.** `src/app/AuthenticatedShell.tsx`, `SidebarNavigation.tsx`, `navigation.ts` y `useExpandedRail.ts`; la opción activa usa hoy `accent-soft`.
- **Componentes.** `src/shared/ui/` agrupa acciones, `business/` (`PlateTag`, `PartCode`, `RucPlate`, `ScopeLabel`, `StockIndicator`, `Money`, `DocumentSheet`), `data/` (`DataTable`, `DataList`, `StatLink`, `MiniBarChart`), `feedback/Toast`, `forms/SearchInput`, `overlays/FormModal`, `layout/` y `surfaces/`.
- **Guardias de estilo.**
  - `tokens.test.ts` fija los valores de los tokens.
  - `legacy-guard.test.ts` impide restos de la plantilla anterior, con una lista `PENDING` que se vacía por fases.
  - `e2e/visual-system.spec.ts` comprueba IBM Plex y la carga local de fuentes.
  - `e2e/responsive.spec.ts` y `e2e/accessibility.ts` ejecutan `axe` y el ancho en cinco tamaños.
  - Unas 20 pruebas unitarias consultan clases o estilos.
- **Catálogo visual.** `frontend/visual-catalog.html` y `src/dev/visual-catalog`.

ADR aplicables: ADR-0001 (monolito modular; el frontend sigue organizado por `features` y `shared`) y ADR-0002 (dependencias directas fijadas exactamente y lockfile al día). Ningún ADR trata el sistema visual, y esta dirección no es una decisión transversal costosa de revertir, porque se concentra en tokens y componentes. Por eso **no se crea ADR**: basta con `DESIGN.md` y las specs.

## Goals / Non-Goals

**Goals:**

- Cambiar paleta, tipografía, radios, sombras y escala a la dirección «Grafito y cobre» modificando sobre todo los tokens y los componentes compartidos.
- Eliminar los 298 tamaños escritos a mano y los 153 `font-mono` de las pantallas y dejar guardias que impidan que vuelvan.
- Renovar el marco: barra lateral grafito con el motivo del tacómetro, opción activa en cobre y encabezado de página con icono.
- Dar el aspecto nuevo a los componentes y añadir `MasterDetail` (PPF-11) y `BusinessMark`.
- Entregar por fases con revisión directa del titular, con `axe` y las pruebas de ancho en verde en cada fase.

**Non-Goals:**

- Cambiar textos, datos, columnas, rutas, permisos o grupos del menú (U4), la búsqueda global (U5) o «Cobrar y facturar» (U6).
- Rediseñar las hojas impresas (`DocumentSheet`, proforma y etiquetas): conservan su tipografía y su maquetación.
- Activar el tema oscuro o hacer un diseño específico para tableta (D3 de la propuesta).
- Tocar backend, API, OpenAPI o migraciones.

## Decisions

### 1. Se conservan los nombres semánticos y se cambian sus valores

Se mantiene la estructura de dos capas y la mayoría de los nombres, para que las pantallas que ya usan `bg-primary`, `text-ink` o `bg-scope-artisan-soft` cambien sin editarlas. Solo se añaden tokens para lo que no existía.

| Token semántico | Valor nuevo | Antes | Uso |
|---|---|---|---|
| `canvas` / `surface` / `surface-subtle` / `surface-muted` | `#F4F3F0` / `#FFFFFF` / `#F8F7F4` / `#EFEEEB` | grises fríos | Lienzo, superficies y fondos de control |
| `line` / `line-strong` / `line-dashed` (nuevo) | `#E4E1DC` / `#D5D1CB` / `#CCC8C1` | `#E2E5E9` / `#CBD1D8` | Bordes y huecos punteados |
| `ink` / `ink-muted` | `#1C1F23` / `#5E6369` | `#15233A` / `#5B6474` | Texto |
| `primary` / `-strong` / `-soft` | cobre `#B5582A` / `#9C4A22` / `#F5E8E0` | azul Tallkit | Acción principal y lo activo |
| `brand` | alias de `primary` | naranja `#E58439` | Acento del logotipo |
| `accent` / `-strong` / `-soft` | `#4A6280` / `#3E546F` / `#E9EDF2` | petróleo | Enlaces y foco (token propio) |
| `scope-artisan` / `-ink` (nuevo) / `-soft` | pizarra `#4A6280` / `#3E546F` / `#E9EDF2` | `#94460B` | Taller (entidad artesanal) |
| `scope-commercial` / `-ink` (nuevo) / `-soft` | arena `#8C6B3F` / `#6E5430` / `#F2ECE2` | `#224368` | Almacén (entidad comercial) |
| `success` / `warning` / `danger` (+ `-soft`) | `#2F6B4A` / `#855E16` / `#A8392F` | similares | Estados |
| `info` (+ `-soft`) | `#44484E` / `#ECEBE8` | petróleo | Estados neutros («Solicitada», «Finalizado») |
| `graphite`, `graphite-raised`, `graphite-line`, `graphite-ink` (nuevos) | `#1E2226`, `#2C3137`, `#30353B`, `#BEC2C7` | — | Barra lateral y tarjetas oscuras |

`accent` y `scope-artisan` comparten hoy el tono pizarra, pero son tokens distintos para poder separarlos sin tocar pantallas. El bloque `[data-theme='dark']` conserva su estructura y recibe valores provisionales coherentes; sigue sin activarse.

*Alternativa descartada:* renombrar todos los tokens (`copper`, `slate` y otros). Habría que editar cientos de clases sin ganar comportamiento.

### 2. La escala de letra pasa a tokens con una correspondencia fija

Se declaran en `@theme inline` tamaños con interlineado (`--text-*`), que Tailwind convierte en utilidades:

| Utilidad | Tamaño | Reemplaza a | Uso |
|---|---|---|---|
| `text-micro` | 11.5 px | `text-[9px]`, `[11px]`, `[11.5px]` | Contadores e iniciales de marca |
| `text-label` | 12.5 px | `[12px]`, `[12.5px]` | Etiquetas y texto auxiliar |
| `text-body` | 14 px | `[13px]`, `[13.5px]`, `[14.5px]` | Texto de interfaz (base del `body`) |
| `text-lead` | 15 px | `[15px]` | Nombres destacados en filas |
| `text-block` | 16 px | `[20px]` en títulos de bloque | Títulos de panel |
| `text-figure` | 24 px | importes destacados | Cifras en indicadores |
| `text-page` | 28 px | `[22px]`, `[28px]` en títulos de página | Títulos de página |
| `text-display` | 36 px | — | Totales grandes |

Los pesos siguen `DESIGN.md`. La correspondencia es mecánica y se revisa a ojo en cada pantalla, porque algunos `13px` deben quedar como `text-label`. Las hojas impresas quedan fuera: sus píxeles responden al papel, no a la pantalla.

### 3. Montserrat local, y las hojas impresas conservan IBM Plex

- **Dependencia y carga.** Se añade `@fontsource/montserrat@5.3.0` (OFL-1.1, publicada el 2026-07-19), fijada exactamente según ADR-0002. Se declaran `@font-face` locales para los pesos 300, 400, 500, 600 y 700, subconjunto latino, como hoy con IBM Plex. `--tk-font-sans` pasa a Montserrat.
- **Hojas impresas.** Se crea `--tk-font-print` con IBM Plex Sans y Mono, y `document-sheet.css` y `product-label*.css` lo usan. Así la hoja A4, la proforma y las etiquetas no cambian, como dicen las specs PPF-09 y PPF-10 y el fuera de alcance. Por eso `@fontsource/ibm-plex-sans` e `ibm-plex-mono` **se conservan** mientras existan esas hojas.
- **Alternativa descartada.** Pasar también las hojas a Montserrat cambiaría documentos entregados al cliente sin aprobación.

### 4. `font-mono` desaparece de las pantallas y llega la utilidad `code`

- **Utilidad nueva.** Se define con `@utility code` en `index.css`: cifras de ancho uniforme (`tabular-nums`) y `letter-spacing: 0.04em`, sin cambiar de familia.
- **Sustitución.** Los 153 usos de `font-mono` fuera de las hojas impresas pasan a `code`, y las piezas `PlateTag`, `PartCode` y `RucPlate` la usan por dentro.
- **Comprobación D2.** En el piloto se revisan placas y códigos reales con 0/O y 1/I/l. Si no se distinguen, se ajusta `code` (por ejemplo, con `font-feature-settings` o un espaciado mayor) antes de la fase 4, como exige la spec.

### 5. Forma: radios y sombras por token

- **Radios.** `chip` 0.375 rem (6 px), `control` 0.625 rem (10 px), `group` 0.75 rem, `panel` 0.875 rem (14 px), `card` 1 rem (16 px, nuevo) y `dialog` 1.125 rem (18 px). Los `rounded-[1–4px]` escritos a mano se revisan uno a uno: se conservan solo si representan un detalle (barras de gráfico o marcas) y no una superficie.
- **Sombras.** `menu`, `dialog` y `toast` pasan a sombras grafito suaves; `card` sigue sin sombra. Se añade `hover` para el realce al pasar el puntero.

### 6. Marco y encabezado de página

- **Barra lateral.** `SidebarNavigation.tsx` y `AuthenticatedShell.tsx` cambian de clases:
  - fondo `graphite`, texto `graphite-ink`, ancho de escritorio de unos 264 px;
  - opción activa con fondo `graphite-raised`, texto blanco y barra cobre de 2,5 px;
  - modo compacto de 768 a 1279 px y panel temporal en teléfono igual que hoy.

  La estructura de `navigation.ts` (grupos, permisos y rutas) no se toca.
- **`GaugeMotif`.** Es un SVG nuevo en `shared/ui/brand/`, solo decorativo (`aria-hidden`, `pointer-events: none`). Lo usan el pie de la barra lateral y la variante oscura de `DetailCard`.
- **`PageHeader`.** Se agrega o se ajusta en `shared/ui/layout` con icono en cuadro suave, antetítulo, título `text-page` y una línea de descripción, más una ranura de acciones. Las páginas que ya tienen encabezado pasan a usarlo sin cambiar sus textos.

### 7. Componentes compartidos

| Componente | Cambio |
|---|---|
| `Button` | Variante principal en cobre con texto blanco; secundaria con contorno de tinta; fantasma sin fondo. Las páginas se revisan para que haya **una sola** principal por pantalla (spec). |
| Segmentos de filtro | Píldora en `surface-muted` con la opción activa blanca y contador. |
| Pestañas | Subrayado de 2 px en tinta o cobre. |
| `SearchInput` | Variante subrayada. |
| `StatusBadge` | Píldora con punto `::before` y tono de estado; los estados neutros usan `info`. |
| `DataTable` y `DataList` | Cabecera `surface-subtle`, filas con la escala nueva y columnas de ancho estable. En teléfono se mantiene la fila de dos líneas. |
| `Modal`, `FormModal` y `Dialog` | Radio `dialog`, sombra nueva y tamaños actuales, más un tamaño `xl` (980 px) para modales de dos columnas. |
| `Toast` | Grafito con icono de éxito, **abajo a la derecha** como manda PPF-08. Se corrige `DESIGN.md`, que decía arriba. |
| `PlateTag`, `PartCode`, `RucPlate`, `StockIndicator`, `Money` | Piezas del taller según la spec, con `code`. |
| `ScopeLabel` | Pasa a apoyarse en `BusinessMark`. |
| `StatLink` y `MiniBarChart` | Solo tokens; el ámbito usa `scope-*`, nunca cobre. |
| `MasterDetail` (nuevo) | Patrón PPF-11 en `shared/ui/layout`, con lista y detalle, selección accesible con barra de acento y apilado en teléfono. **Ninguna pantalla lo adopta en U3** (D1); se demuestra en el catálogo. |

**`BusinessMark` (nuevo, en `shared/ui/business`).** Muestra el logotipo configurado de la entidad fiscal o sus iniciales, en círculo pizarra para la artesanal y cuadrado redondeado arena para la comercial. Su nombre accesible es el de la entidad. Las iniciales salen del nombre que el frontend ya recibe; el texto visible de `ScopeLabel` no cambia hasta U4.

### 8. Pruebas según el riesgo

El cambio es de presentación: nivel **prueba al final** para lógica de componentes nuevos (`MasterDetail`, `BusinessMark`) y **sin prueba nueva** para colores y maquetación, más las guardias.

- **`tokens.test.ts`.** Se actualizan los valores esperados de la tabla de la decisión 1 y se añade la comprobación de la escala `--text-*`.
- **`legacy-guard.test.ts`.** Se amplía con un segundo patrón que prohíbe fuera de las hojas impresas `IBM Plex` (salvo `--tk-font-print`), `font-mono`, `text-\[\d+(\.\d+)?px\]` y los valores crudos de la paleta anterior. Su lista `PENDING` empieza con los archivos actuales y debe quedar vacía al cerrar la fase 4.
- **Pruebas unitarias que fijan clases.** Se ajustan a las clases nuevas conservando lo que verifican (estado, rol y nombre accesible). No se fijan textos de la interfaz.
- **`e2e/visual-system.spec.ts`.** Comprueba Montserrat en la interfaz, IBM Plex solo en la hoja impresa y que ninguna fuente sale de `127.0.0.1`.
- **E2E de accesibilidad y ancho.** `e2e/responsive.spec.ts` y `axe` se ejecutan al cerrar el piloto y al cerrar el cambio, sin infracciones serias ni críticas en 360, 768, 1024, 1280 y 1440 px.
- **Pruebas de componentes nuevos.** `MasterDetail` (selección, filtro que oculta el elegido y teléfono) y `BusinessMark` (logotipo, iniciales y nombre accesible).
- **Por grupo.** Al cerrar cada grupo se ejecutan solo las pruebas relacionadas y `npm run lint`, `typecheck` y `build`. La suite completa, solo si el titular la pide.

### 9. Fases y puntos de aprobación

1. **Fundamentos y marco.** Tokens, fuentes, `code`, escala, radios, `GaugeMotif`, barra lateral y `PageHeader`.
2. **Componentes compartidos.** Los de la decisión 7, más el catálogo visual.
3. **Piloto.** Inicio (`pages/home`), lista de mantenimientos, ficha del mantenimiento, lista de productos y un formulario en modal (servicio). Se detiene para la revisión directa del titular y la comprobación D2.
4. **Resto de pantallas**, por módulos, hasta vaciar `PENDING`.

Las diferencias de contenido con el prototipo se anotan en `docs/cambios-pendientes.md` bajo U4, U5 o U6.

### 10. Documentación

Al cerrar se actualizan:

- `DESIGN.md`: el aviso pasa a «vigente» y se corrige la posición del toast.
- `PRODUCT.md`.
- `interfaz-y-navegacion.md`, §10 y §13.
- La matriz de trazabilidad: fila del sistema visual y `RNF-USA-013…016`.
- `requisitos-no-funcionales.md` (`RNF-USA-016`, sin la observación previa).
- `docs/cambios-pendientes.md` (U3).
- `docs/tecnico/revision-visual-frontend.md`, con la nota histórica.

No hay términos nuevos de negocio. «Grafito y cobre» no entra al glosario porque es el nombre de una dirección visual.

## Risks / Trade-offs

- **Escala mayor en tablas densas (1024 y 1280 px).** Mitigación: prueba de ancho existente, prioridad de columnas de la spec y revisión en el piloto.
- **Confusión de caracteres sin fuente monoespaciada.** Mitigación: comprobación D2 en el piloto, con posibilidad de ajustar la utilidad `code` sin tocar pantallas.
- **Pruebas que fijan clases.** Al actualizarlas se puede perder lo que verificaban. Mitigación: conservar las aserciones de rol, estado y nombre accesible, y cambiar solo la parte visual.
- **Doble tipografía (pantalla y papel).** Implica más peso de fuentes y dos dependencias que mantener. Se acepta para no cambiar documentos entregados al cliente; un cambio futuro de la hoja impresa podrá retirarlas.
- **Aspecto nuevo con textos antiguos hasta U4** (por ejemplo, «RUC comercial»). Es deliberado (D1) y está documentado.
- **`accent` y `scope-artisan` con el mismo tono.** Un enlace puede parecer de taller. Mitigación: los enlaces llevan subrayado al pasar el puntero o en el foco, y las marcas de negocio llevan forma e iniciales.
- **Contraste.** Las parejas de `DESIGN.md` miden entre 4,8:1 y 16,5:1. `axe` lo confirma en la aplicación real en cada cierre de fase.
