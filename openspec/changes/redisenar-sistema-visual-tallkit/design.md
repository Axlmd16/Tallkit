## Context

El proposal y las specs aprobados reemplazan el sistema visual de la plantilla SAAS Dashboard por **Tallkit**. Las decisiones del usuario del 2026-09-21 están en el proposal: IBM Plex, acento petróleo, modal o página, toasts, bases del tema oscuro y entrega por fases con piloto.

Estado actual del frontend (React 19, TypeScript, Vite y Tailwind 4), observado en `develop`:

- **Estilos:** `src/shared/styles/index.css` (1716 líneas) declara:
  - las fuentes Nunito desde `@fontsource/nunito`;
  - un bloque `@theme static` con tokens semánticos (`canvas`, `surface*`, `ink*`, `line`, `primary*`, estados y pasteles);
  - muchas clases de página heredadas de la plantilla (`.catalog-page`, `.list-page`, `.catalog-editor-form`…).

  `src/shared/ui/catalog-tokens.css` añade tokens del catálogo.
- **Uso de tokens:** los componentes usan casi siempre utilidades semánticas. Recuento aproximado: `text-ink-muted` 441, `text-ink` 302, `border-line` 152, `bg-surface` 126, `text-primary` 59, `bg-surface-selected` 45. `primary` hoy significa a la vez acción, selección, enlace y foco.
- **Componentes compartidos:** `src/shared/ui/` tiene 55 componentes. Sin consumidor funcional, solo usados por el catálogo interno, están `MetricCard`, `DetailPanel`, `StatCard`, los layouts `AppFrame`, `AuthLayout`, `DashboardLayout`, `MasterDetailLayout` y `PreviewLayout`, y las familias `charts/`, `calendar/`, `board/`, `conversation/` y `timeline/`.
- **Paneles laterales:** `Drawer` tiene 15 consumidores, entre ellos `EditorDrawer`, `ProductEditorDrawer`, `ServiceEditorDrawer`, `SupplierEditorDrawer`, `AdjustmentDrawer` y las páginas de usuarios, clientes, vehículos, marcas, productos, servicios, proveedores e inventario.
- **Diálogos:** `Dialog` tiene 12 consumidores y carga ilustraciones de `src/assets/figma/`. `Modal` y `ConfirmationPanel` tienen pocos.
- **Selector de referencias:** `ReferencePicker` (12 consumidores) muestra los resultados como una lista fija con botones «Elegir». El editor de ventas en curso añadió `SaleCombobox`, un combobox con resultados flotantes.
- **Confirmaciones de éxito:** no existe un sistema de notificaciones; las confirmaciones son `InlineNotice tone="success"` fijas en 14 archivos.
- **Marco y rutas:** `AuthenticatedShell` implementa la barra desplegada de 218 px del cambio cancelado. Las rutas siguen el patrón `/x/new`, `/x/:id` y `/x/:id/edit` en compras y ventas.
- **Catálogo visual interno:** vive en `src/dev/visual-catalog/` con su propia entrada `visual-catalog.html`, fuera de la compilación productiva. Sus pruebas e2e están en `e2e/catalog/`. Las pruebas `figma-fidelity`, `visual-system`, `catalogs-styles` y `visual-evidence` dependen de la referencia Figma retirada.

Restricciones:
- no se modifican backend, API, permisos ni datos;
- los recursos deben funcionar sin Internet;
- ADR-0002 exige dependencias con uso actual y versiones exactas en el lockfile;
- se aplica TDD y el backend sigue siendo la autoridad.

## Goals / Non-Goals

**Goals:**

- Cambiar la identidad visual de todas las pantallas modificando sobre todo los valores de los tokens semánticos, no cada pantalla.
- Separar en tokens distintos los significados que hoy comparte `primary`: acción, selección, enlace y foco.
- Incorporar tres piezas compartidas nuevas: sistema de notificaciones, modal de formulario y combobox de referencias.
- Retirar los paneles laterales de edición y trasladar cada formulario a modal o a página, según PPF-03 y PPF-04.
- Dejar el tema oscuro preparado en tokens, sin activarlo.
- Entregar por fases verificables, con un piloto que el usuario aprueba antes de extender el cambio.

**Non-Goals:**

- Cambios en backend, API, permisos, modelos o migraciones.
- Funciones de la maqueta fuera de alcance: búsqueda global, indicadores sin dato del servidor, umbrales de stock bajo, atajos nuevos y exportaciones.
- Tema oscuro operativo y selector de tema.
- Reescribir la lógica de hooks, API, validación o idempotencia de las pantallas.
- Gráficos, calendarios, tableros o conversación: se retiran y volverán solo cuando una capacidad los pida.

## Decisions

### D1. Tokens semánticos en dos capas y remapeo de valores

Los valores crudos se declaran como variables CSS `--tk-*` en `:root`, dentro de un nuevo `src/shared/styles/tokens.css`. El bloque `@theme` de Tailwind referencia esas variables con `@theme inline`, de modo que las utilidades existentes (`bg-surface`, `text-ink`, `border-line`…) conservan sus nombres y cambian de valor.

| Token Tailwind | Significado Tallkit | Valor claro |
|---|---|---|
| `canvas` | lienzo | `#F3F4F6` |
| `surface` / `surface-subtle` / `surface-muted` | panel / cabecera / control | `#FFFFFF` / `#F8F9FA` / `#EEF0F3` |
| `line` / `line-strong` (nuevo) | borde / borde de campo | `#E2E5E9` / `#CBD1D8` |
| `ink` / `ink-muted` | texto / texto de apoyo | `#15233A` / `#5B6474` |
| `primary` / `primary-strong` | acción principal (azul Tallkit) | `#224368` / `#1A3453` |
| `accent` / `accent-strong` / `accent-soft` (nuevos) | selección, enlace, foco (petróleo) | `#0F6B6F` / `#0A5255` / `#E1F0EF` |
| `brand` (nuevo) | naranja del logotipo, solo acento | `#E58439` |
| `scope-commercial*` / `scope-artisan*` (nuevos) | ámbitos fiscales | `#224368`/`#E6EDF6` · `#94460B`/`#FCEEE2` |
| `success`, `warning`, `danger`, `info` y sus `-soft` | estados | valores de la maqueta, AA sobre su fondo |
| `workspace` (nuevo) | fondo del visor de documentos | `#E6E9ED` |

Se añaden también radios (`control` 6 px, `chip` 4 px, `panel` 8 px, `dialog` 10 px) y sombras (`menu`, `dialog`, `sheet`, `toast`). Los tokens pastel sin uso (`cyan`, `coral`, `pink`, `yellow`…) se eliminan cuando queden sin consumidores.

Los usos de `primary` que significan selección, enlace o foco se migran a `accent`. La migración se guía por el significado de cada uso, no por un reemplazo global. Los estados de foco usan `accent`.

Un bloque `[data-theme='dark']` en `tokens.css` documenta los valores oscuros de la maqueta. Ningún código asigna ese atributo y ninguna media query lo activa; una prueba lo verifica.

- **Alternativa rechazada:** renombrar todas las utilidades a nombres Tallkit. Obligaría a tocar miles de clases sin beneficio.
- **Alternativa rechazada:** mantener `primary` para la selección. Contradice la spec de jerarquía cromática.

### D2. Tipografía local mediante Fontsource

Se sustituye `@fontsource/nunito` por `@fontsource/ibm-plex-sans` (pesos 400, 500, 600 y 700) e `@fontsource/ibm-plex-mono` (400, 500 y 600), subconjunto latino, que incluye tildes y ñ. Se declaran con `@font-face` apuntando a sus `woff2`, igual que hoy, y `font-display: swap`. Las versiones quedan exactas en `package.json` y `package-lock.json`, y `@fontsource/nunito` se elimina.

- **Alternativa rechazada:** copiar los `woff2` al repositorio. Pierde la trazabilidad de versión y licencia que da el lockfile.
- **Alternativa rechazada:** usar Google Fonts. Viola el requisito de funcionar sin Internet.

### D3. Estrategia por componente compartido

| Acción | Componentes |
|---|---|
| **Ajustar**: mismo API, estilo Tallkit | `Button`, `IconButton`, `ButtonGroup`, `Field`, `Input`, `Select`, `Checkbox`, `Textarea`, `SearchInput`, `PasswordInput`, `DateControl`, `FormSection`, `Tabs`, `SegmentedControl`, `Tooltip`, `DropdownMenu`, `DataTable`, `DataList`, `Pagination`, `RowActions`, `StatusBadge`, `FiscalScopeBadge`, `InlineNotice`, `LoadingState`, estados de `feedback/`, `PageHeader`, `Toolbar`, `FilterPanel`, `Surface`, `DetailCard`, `Divider`, `NavigationItem`, `Sidebar`, `FormLayout`, `Avatar`, `ConfirmationPanel` |
| **Reemplazar** | `Drawer` y `EditorDrawer` → `FormModal` (D5) o página (D6); `ReferencePicker` → `Combobox` (D7); `Dialog` → basado en `Modal`, sin ilustraciones de `assets/figma/` y con la variante de peligro |
| **Nuevos** | `ToastProvider`/`useToast` (D4), `FormModal` (D5), `Combobox` (D7), `PlateTag`, `PartCode` con copiar, `StockIndicator` (cantidad y «Agotado», sin umbral), `Money` (importe o guion), `DocumentSheet` (hoja A4 común a vista previa, comprobante e impresión) |
| **Retirar** (sin consumidor funcional) | `MetricCard`, `StatCard`, `DetailPanel`, `AppFrame`, `AuthLayout`, `DashboardLayout`, `MasterDetailLayout`, `PreviewLayout`, familias `charts/`, `calendar/`, `board/`, `conversation/`, `timeline/` y `assets/figma/` |

Antes de retirar cada pieza se confirma de nuevo que no tiene consumidores fuera de `shared/ui` y `dev/`. Los iconos siguen siendo de `@phosphor-icons/react`, en peso regular.

### D4. Notificaciones temporales propias

`ToastProvider` se monta en el marco autenticado y expone `useToast().success(mensaje, { href?, linkLabel? })` y `info(...)`, sin variante de error, conforme a PPF-08. El provider:
- renderiza una región `role="status"` con `aria-live="polite"`, abajo a la derecha, que ocupa el ancho disponible por debajo de 640 px;
- conserva como máximo tres notificaciones y retira primero la más antigua;
- programa su cierre a los 6 s;
- pausa el temporizador al pasar el puntero o al enfocar la notificación, y la cierra con Escape o con su botón;
- no mueve el foco;
- con movimiento reducido, no anima.

Los 14 usos de `InlineNotice tone="success"` se clasifican uno por uno. Las confirmaciones de una acción terminada pasan a toast. Las informaciones que deben seguir visibles se quedan en línea, por ejemplo el aviso «este registro ya se guardó» de `MoneyDialog` o los estados de `TechnicalStatusPage`.

- **Alternativa rechazada:** una librería de toasts. Añade una dependencia para una pieza pequeña y ya existen utilidades de modal y foco.

### D5. `FormModal` para formularios cortos

`FormModal` se construye sobre `Modal` y reutiliza `modal-utils` (`trapFocus`, `useModalOpen`). Aporta:
- título y descripción;
- cierre;
- pie con Cancelar, acción principal y «Guardar y crear otro» opcional;
- seguimiento de cambios sin guardar.

Con cambios pendientes, Escape, el cierre y Cancelar abren una confirmación «Seguir editando / Descartar». Al guardar con éxito: cierra, invalida la consulta de la lista y emite un toast. Con «crear otro» limpia el formulario y enfoca el primer campo. Los errores del servidor se muestran con el `describeProblem` actual junto al campo. Por debajo de 640 px ocupa el ancho disponible y desplaza solo su cuerpo.

Consumidores, según PPF-04:
- los catálogos auxiliares (marcas de vehículo y de producto, categorías y unidades de medida), por medio de `AuxiliaryCatalogPage` y `RecordForm`;
- servicio (`ServiceForm`);
- ajuste de inventario (`AdjustmentDrawer`);
- usuario (`UserForm`, en `UsersPage`).

Los componentes de formulario existentes conservan su lógica y sus pruebas; cambia el contenedor.

### D6. Páginas completas para formularios largos

Producto, cliente, vehículo y proveedor pasan de panel lateral a página. Se añaden las rutas `/products/new`, `/products/:id/edit`, `/customers/new`, `/customers/:id/edit`, `/vehicles/new`, `/vehicles/:id/edit`, `/suppliers/new` y `/suppliers/:id/edit`, con el mismo patrón que ya usan compras y ventas.

Cada ruta usa el `PermissionGuard` y el permiso que hoy habilita la acción de crear o editar en el panel. Todas las rutas existentes se mantienen. El usuario aprobó estas rutas nuevas junto con el design el 2026-09-21, al entender que conservan las existentes y siguen el patrón de compras y ventas. Las páginas nuevas usan el formulario existente dentro de un layout por secciones (PPF-03) con barra de acciones fija. Al abandonar con cambios, advierten mediante el bloqueo de navegación de `react-router`. Al guardar, navegan a la ficha y muestran un toast.

Los formularios sin secciones (servicio y usuario) no se convierten a página.

### D7. `Combobox` compartido

`SaleCombobox`, del editor de ventas, se generaliza como `shared/ui/forms/Combobox`, conforme al patrón ARIA de combobox editable con lista:
- búsqueda en servidor con espera de 300 ms;
- resultados flotantes en un portal;
- paginación con AvPág/RePág y botones;
- opciones inactivas no seleccionables;
- limpiar selección.

Sustituye a `ReferencePicker` en compras y ventas; la interfaz `PickerResults` se conserva para no tocar los hooks. Los selectores de las pruebas e2e cambian de `list`/`Elegir` a `combobox`/`option`.

### D8. Marco autenticado

`AuthenticatedShell` se reestructura así:
- **Desde 1280 px:** barra lateral de 240 px con el logotipo Tallkit, grupos de `navigation.ts` con título, opción activa en `accent-soft` y usuario con sus roles y el cierre de sesión al pie.
- **De 768 a 1279 px:** barra de iconos de 72 px con `Tooltip` y `aria-label`.
- **Por debajo de 768 px:** barra superior con menú, logotipo y panel temporal de navegación. El panel de navegación no es un formulario, así que no le afecta la prohibición de PPF-04.

La barra superior de escritorio muestra la ruta de migas y, en pantallas con ámbito económico, la marca de ámbito fiscal. No incluye búsqueda global.

### D9. Organización del CSS

`index.css` queda con importaciones, `tokens.css`, fuentes, reglas base (tipografía, foco visible con `accent`, movimiento reducido) y utilidades mínimas. Los estilos de componente pasan a sus componentes como utilidades Tailwind. Las clases de página heredadas se eliminan fase por fase según se migra cada pantalla. `catalog-tokens.css` se integra en `tokens.css`.

Una prueba de guarda falla si el CSS de la aplicación contiene `Nunito`, los hex violetas de la plantilla (`#605BFF`, `#4F4AE8`, `#EFEEFF`) o referencias a `assets/figma`.

### D10. Catálogo visual interno

Se reescriben `registry.ts` y `previews.tsx`:
- familias Tallkit: fundamentos, acciones, campos, combobox, tablas, estados, piezas del taller, superposiciones, toasts, navegación y patrones de pantalla;
- ficha con el tablero de la maqueta o la marca de adaptación;
- sin estados de evidencia Figma.

Se conserva la entrada aislada `visual-catalog.html`, que no forma parte de la compilación productiva. Se eliminan las pruebas `e2e/catalog/phase*` de familias retiradas y se ajustan las demás.

### D11. Estrategia de pruebas

- **Unitarias (Vitest, TDD):**
  - `ToastProvider`: duración, pausa, Escape, máximo de tres y anuncio sin foco;
  - `FormModal`: foco, cambios sin guardar, «crear otro» y error del servidor;
  - `Combobox`: teclado, inactivos y paginación;
  - `StockIndicator`: sin umbral;
  - `Money`: guion;
  - tokens: sin tema oscuro activo y guarda de restos de la plantilla;
  - pruebas existentes de cada pantalla migrada, ajustando solo selectores de presentación.
- **Rutas:** las nuevas de D6 con los permisos correctos por rol, positivos y negativos.
- **e2e (Playwright):**
  - se eliminan `figma-fidelity.spec.ts`, `catalogs-styles.spec.ts` y `visual-evidence.spec.ts`;
  - se reescribe `visual-system.spec.ts` para comprobar estilos computados de tokens y fuentes locales sin red externa;
  - los flujos funcionales existentes se conservan con selectores actualizados;
  - `axe` se ejecuta en 360, 768, 1024, 1280 y 1440 px.
- **Evidencia visual:** capturas por fase fuera del repositorio, presentadas junto a los tableros de la maqueta.

### D12. Documentación

- Se actualizan `interfaz-y-navegacion.md`: secciones 2.1 (marco y navegación), 8.1 (textos breves de botones) y 10 (modal, filas compactas), con la zona de notificaciones.
- Se actualiza el nombre visible en `vision.md`.
- Se actualizan `matriz-trazabilidad.md` y, si aparecen términos nuevos (toast, combobox), `glosario-tecnico.md`.
- No se crea un ADR: el cambio es de presentación, reversible y no altera la arquitectura, las fronteras de módulos ni las dependencias de ejecución del backend.

## Risks / Trade-offs

- **Regresiones funcionales al tocar todas las pantallas.** → Solo se cambia el contenedor y la presentación; hooks, API y validación no se tocan, las pruebas funcionales existentes deben seguir pasando en cada fase, y el piloto se revisa antes de extender el cambio.
- **Migrar `primary` a `accent` según el significado es manual.** → Se hace pantalla por pantalla con pruebas de estilos computados en componentes representativos.
- **Las rutas nuevas de formulario amplían la superficie de permisos.** → Reutilizan exactamente el permiso de la acción actual y tienen pruebas de ruta por rol; el backend sigue denegando.
- **Los toasts pueden pasar inadvertidos.** → Pausa, anuncio accesible, enlace «Ver», y los errores nunca van en toast.
- **Contraste de los tonos suaves y del petróleo.** → `axe` en los cinco anchos y el naranja nunca como texto.
- **Coexistencia con el cambio de ventas en curso.** → Este cambio se aplica desde `master` después de integrar `gestionar-ventas-pagos-credito-simple`; su editor de ventas se reemplaza aquí.
- **Retirar componentes sin consumidor reduce el catálogo.** → Quedan en el historial de git; D3 exige verificar consumidores antes de borrar.

## Migration Plan

1. Integrar en `master` el cambio `gestionar-ventas-pagos-credito-simple` y crear la rama de trabajo desde `master`.
2. **Fase 1:** tokens, fuentes, reglas base, marco autenticado y acceso. Capturas y revisión.
3. **Fase 2:** componentes ajustados y nuevos (toasts, `FormModal`, `Combobox`, piezas del taller, `DocumentSheet`) y el catálogo interno.
4. **Fase 3, piloto:**
   - lista de ventas;
   - ficha de vehículo;
   - página de producto (rutas nuevas);
   - modal de marcas de vehículo;
   - editor de venta.

   Se detiene hasta la aprobación visual explícita del usuario.
5. **Fase 4:** resto de pantallas por módulo, luego la retirada de `Drawer`, `ReferencePicker`, clases heredadas y componentes sin consumidor, y la documentación.
6. Verificación completa: `make check`, `make test`, e2e y `axe`.

**Rollback:** el cambio es solo de frontend y no toca datos; se revierte deshaciendo los commits de la fase afectada. Las fases se integran por separado para poder revertirlas de forma aislada.

## Open Questions

- **Página de inicio.** Si hoy muestra indicadores, se conservan solo los que tienen dato del servidor. Se revisará en la fase 4 sin inventar métricas.
