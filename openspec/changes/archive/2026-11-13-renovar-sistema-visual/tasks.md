Rutas relativas a `frontend/` salvo indicación. Todos los grupos son de presentación: **sin prueba nueva** para colores, tipografía y maquetación (solo se actualizan las guardias y las pruebas que fijan clases), y **prueba al final** para los componentes nuevos `BusinessMark` y `MasterDetail` (`AGENTS.md`). En cada grupo se ejecutan solo las pruebas relacionadas, nunca la suite completa.

## 1. Fundamentos: fuentes, tokens y guardias (fase 1)

- [x] 1.1 Instalar `@fontsource/montserrat@5.3.0` con versión exacta (`npm install --save-exact @fontsource/montserrat@5.3.0`); `package.json` y `package-lock.json` quedan actualizados juntos (ADR-0002).
- [x] 1.2 En `src/shared/styles/index.css`, declarar `@font-face` locales de Montserrat (latín 300, 400, 500, 600 y 700) y conservar las de IBM Plex Sans y Mono solo para impresión.
- [x] 1.3 En `src/shared/styles/tokens.css`:
  - cambiar los valores según la tabla de la decisión 1 del diseño;
  - agregar `--tk-graphite`, `--tk-graphite-raised`, `--tk-graphite-line`, `--tk-graphite-ink`, `--tk-scope-artisan-ink`, `--tk-scope-commercial-ink` y `--tk-line-dashed`;
  - hacer `--tk-brand` alias de `--tk-primary`;
  - definir `--tk-font-sans` (Montserrat) y `--tk-font-print` (IBM Plex);
  - dar valores provisionales coherentes al bloque `[data-theme='dark']`, sin activarlo.
- [x] 1.4 En el bloque `@theme inline` de `index.css`:
  - exponer los tokens nuevos;
  - declarar la escala `--text-micro` … `--text-display` de la decisión 2;
  - cambiar los radios (`chip`, `control`, `group`, `panel`, `card` y `dialog`) y las sombras (`menu`, `dialog`, `toast` y `hover`);
  - crear `@utility code` (`tabular-nums` y `letter-spacing: 0.04em`);
  - fijar el `body` en `text-body` (14 px).
- [x] 1.5 Hacer que `src/shared/ui/business/document-sheet.css`, `src/features/product-labels/product-label.css` y `product-label-print.css` usen `var(--tk-font-print)`, sin cambiar sus tamaños ni su maquetación.
- [x] 1.6 Actualizar `src/shared/styles/tokens.test.ts` con los valores nuevos, la escala `--text-*` y la utilidad `code`.
- [x] 1.7 Ampliar `src/shared/styles/legacy-guard.test.ts` con una guardia de dirección visual que prohíba, fuera de las hojas impresas, `IBM Plex` (salvo en `--tk-font-print`), `font-mono`, `text-[Npx]` y los valores crudos de la paleta anterior. Su lista `PENDING` empieza con los archivos actuales que la incumplen y debe vaciarse en el grupo 5.
- [x] 1.8 Actualizar `e2e/visual-system.spec.ts`: Montserrat en la interfaz, IBM Plex solo en la hoja impresa y todas las fuentes servidas desde `127.0.0.1`. Se ejecuta en el grupo 6.
- [x] 1.9 **Verificación:** `npx vitest run src/shared/styles` en verde, más `npm run lint`, `npm run typecheck` y `npm run build`.

## 2. Marco de la aplicación (fase 1)

- [x] 2.1 Crear `src/shared/ui/brand/GaugeMotif.tsx` y su `index.ts`: un SVG decorativo del tacómetro (`aria-hidden`, `pointer-events: none`) que use solo tokens y tenga variantes para la barra lateral y para las tarjetas oscuras.
- [x] 2.2 Pasar `src/app/SidebarNavigation.tsx`, `src/app/AuthenticatedShell.tsx` y `src/shared/ui/navigation/` (`Sidebar.tsx`, `NavigationItem.tsx` y `NavigationPanel.tsx`) al aspecto grafito:
  - opción activa con fondo `graphite-raised`, texto blanco y barra cobre;
  - ancho de escritorio de unos 264 px;
  - barra compacta de 768 a 1279 px con objetivos de 44 px;
  - `GaugeMotif` al pie.

  No se tocan `navigation.ts`, los grupos ni los permisos.
- [x] 2.3 Ajustar la barra superior de `AuthenticatedShell.tsx` (migas, usuario, avatar cobre y salida) con los tokens y la escala nuevos, sin cambiar textos.
- [x] 2.4 Ampliar `PageHeader` en `src/shared/ui/layout.tsx` con icono en cuadro suave, antetítulo opcional, título `text-page`, una línea de descripción y ranura de acciones. Las llamadas existentes deben seguir funcionando.
- [x] 2.5 Ajustar las pruebas que fijan clases del marco (`src/app/AuthenticatedShell.test.tsx`, `src/shared/ui/navigation/Sidebar.test.tsx`, `NavigationPanel.test.tsx` y `src/shared/ui/layout.test.tsx`), conservando las aserciones de ruta activa, permisos y nombre accesible.
- [x] 2.6 **Verificación:** `npx vitest run src/app src/shared/ui/navigation src/shared/ui/layout.test.tsx src/shared/styles` en verde, más `npm run lint` y `npm run typecheck`.

## 3. Componentes compartidos y catálogo (fase 2)

- [x] 3.1 Botones en `src/shared/ui/controls.tsx` y `src/shared/ui/actions/`: principal en cobre con texto blanco, secundario con contorno de tinta y fantasma sin fondo, con la escala y los radios nuevos.
- [x] 3.2 Navegación interna: `SegmentedControl.tsx` en píldora con la opción activa blanca y contador, `Tabs.tsx` con subrayado de 2 px y `SectionNav.tsx` con tokens.
- [x] 3.3 Formularios: variante subrayada de `src/shared/ui/forms/SearchInput.tsx`, y campos, `Combobox`, `DateControl` y `Textarea` con los radios, líneas y escala nuevos.
- [x] 3.4 Estados y datos:
  - `StatusBadge` y estados de `src/shared/ui/states.tsx` en píldora con punto, con estados neutros en `info`;
  - `src/shared/ui/data/` (`DataTable`, `DataList`, `Pagination`, `RowActions`, `StatLink`, `MiniBarChart`, `Progress`) con cabecera `surface-subtle`, filas en la escala nueva, columnas estables y ámbito con `scope-*`, nunca cobre.
- [x] 3.5 Superposiciones y avisos:
  - `src/shared/ui/overlays/` (`Modal`, `FormModal`, `Dialog`, `ConfirmationPanel`, `DropdownMenu`, `Tooltip` y `HintPopover`) con radio `dialog`, sombras nuevas y un tamaño `xl` de 980 px en `Modal`;
  - `src/shared/ui/feedback/Toast.tsx` en grafito con icono, abajo a la derecha (PPF-08).
- [x] 3.6 Superficies: `src/shared/ui/surfaces/` (`DetailCard` con variante oscura y `GaugeMotif`, `SectionPanel`, `Sheet`, `FactList` y `AdvancedInfo`) con los tokens nuevos.
- [x] 3.7 Piezas del taller en `src/shared/ui/business/`: `PlateTag` (pieza oscura, `code`, invertida sobre fondo oscuro), `PartCode` y `RucPlate` con `code` y `StockIndicator` con marcador, sin `font-mono`.
- [x] 3.8 Crear `src/shared/ui/business/BusinessMark.tsx`: logotipo configurado o iniciales con la forma y el tono de cada entidad fiscal, y el nombre de la entidad como nombre accesible. `ScopeLabel.tsx` lo usa sin cambiar su texto visible. Se exporta en `business/index.ts`.
- [x] 3.9 Crear `src/shared/ui/layout/MasterDetail.tsx` (PPF-11): lista y detalle, selección accesible con barra de acento, filtro que oculta el elegido y apilado en teléfono con acción para volver. Se exporta en `layout/index.ts`. Ninguna pantalla lo adopta.
- [x] 3.10 Pruebas al final: `BusinessMark.test.tsx` (logotipo, iniciales distintas para nombres que empiezan igual y nombre accesible) y `MasterDetail.test.tsx` (elegir con teclado, filtro que oculta el elegido y teléfono).
- [x] 3.11 Catálogo visual (`src/dev/visual-catalog/registry.ts` y `previews.tsx`): fundamentos nuevos, `GaugeMotif`, `BusinessMark`, `MasterDetail`, segmentos con contador y búsqueda subrayada, con contenido de ejemplo. Se actualiza `CVR-02`.
- [x] 3.12 Quitar `font-mono` y `text-[Npx]` de `src/shared/` y `src/dev/`, retirar esos archivos de `PENDING` y ajustar las pruebas de `src/shared/ui/**` que fijan clases, conservando lo que verifican.
- [x] 3.13 **Verificación:** `npx vitest run src/shared src/dev` en verde, más `npm run lint`, `npm run typecheck` y `npm run build`.

## 4. Piloto (fase 3, con punto de aprobación)

- [x] 4.1 Inicio (`src/pages/home/HomePage.tsx`, `QuickActionsBlock.tsx`, `PendingBlock.tsx`, `ReceivablesBlock.tsx`, `CollectionsBlock.tsx` y `BlockStates.tsx`): `PageHeader`, indicadores y bloques con el aspecto nuevo y su contenido actual.
- [x] 4.2 Lista de mantenimientos (`src/pages/maintenance/MaintenanceOrdersPage.tsx`): patrón PPF-01 nuevo con su contenido actual.
- [x] 4.3 Ficha del mantenimiento (`src/pages/maintenance/MaintenanceOrderDetailPage.tsx` y los componentes de `src/features/maintenance/` que usa): encabezado, bloques económicos por negocio con `BusinessMark` y piezas del taller.
- [x] 4.4 Lista de productos (`src/pages/products/ProductsPage.tsx` y lo que use de `src/features/products/`): tabla con códigos en `code` y columnas estables.
- [x] 4.5 Formulario en modal: el de servicio en `src/pages/services/ServicesPage.tsx` y su `FormModal`.
- [x] 4.6 En las cinco pantallas, dejar una sola acción en cobre, quitar `font-mono` y `text-[Npx]` y retirarlas de `PENDING`.
- [x] 4.7 Anotar en `docs/cambios-pendientes.md`, bajo U4, U5 o U6, las diferencias de contenido con el prototipo de estas pantallas, por ejemplo las columnas «falta cobrar» y «falta facturar» del Inicio y las nuevas columnas de productos.
- [x] 4.8 **Verificación:**
  - `npx vitest run src/pages/home src/pages/maintenance src/pages/products src/pages/services src/features/maintenance src/features/products src/shared/styles` en verde, más `npm run lint`, `npm run typecheck` y `npm run build`;
  - `npx playwright test e2e/responsive.spec.ts e2e/home.spec.ts e2e/maintenance.spec.ts` en verde, sin infracciones serias ni críticas de `axe`.
- [x] 4.9 **Punto de aprobación:** detenerse para la revisión directa del titular en la aplicación y la comprobación D2, que 0/O y 1/I/l se distingan en placas y códigos reales. Si no se distinguen, ajustar `@utility code` y repetir 4.8. El grupo 5 no empieza sin aprobación explícita.

## 5. Resto de pantallas (fase 4)

Para cada módulo se aplican el aspecto nuevo y `PageHeader`, se deja una sola acción en cobre, se sustituyen `font-mono` y `text-[Npx]`, se retiran sus archivos de `PENDING`, se ajustan las pruebas que fijan clases y se ejecutan las del módulo.

- [x] 5.1 Mantenimiento restante: `src/pages/maintenance/` (`MaintenanceOrderEditorPage`, `ArtisanReceivablesPage`, `ServiceOperationDetailPage`, `ServiceOperationDocumentPage` (solo la pantalla, no la hoja) y `CommercialOrderViewPage`) y `src/features/maintenance/`. **Verificación:** `npx vitest run src/pages/maintenance src/features/maintenance`.
- [x] 5.2 Ventas, proformas y retenciones: `src/pages/sales`, `src/pages/proformas`, `src/pages/withholdings`, `src/features/sales` y `src/features/proformas`, dejando la hoja impresa con `--tk-font-print`. **Verificación:** `npx vitest run src/pages/sales src/pages/proformas src/pages/withholdings src/features/sales src/features/proformas`.
- [x] 5.3 Clientes y vehículos: `src/pages/customers`, `src/pages/vehicles`, `src/pages/vehicle-brands`, `src/features/customers`, `src/features/vehicles` y `src/features/vehicle-brands`. **Verificación:** `npx vitest run` sobre esas carpetas.
- [x] 5.4 Catálogo e inventario: `src/pages/products` (ficha y editor), `src/pages/inventory`, `src/pages/purchases`, `src/pages/suppliers`, `src/pages/product-brands`, `src/pages/product-categories`, `src/pages/measurement-units` y sus `features`, incluida la pantalla de `product-labels` sin tocar sus hojas `.css` de impresión. **Verificación:** `npx vitest run` sobre esas carpetas.
- [x] 5.5 Configuración y sistema: `src/pages/fiscal`, `src/pages/workshop-configuration`, `src/pages/users`, `src/pages/audit`, `src/pages/technical-status`, `src/pages/login`, `src/pages/change-password` y sus `features` (`fiscal`, `users`, `auth`, `audit` y `workshop-configuration`). **Verificación:** `npx vitest run` sobre esas carpetas.
- [x] 5.6 Dejar vacía la lista `PENDING` de la guardia de dirección visual. **Verificación:** `npx vitest run src/shared/styles` en verde, y `rg -n "font-mono|text-\[[0-9.]+px\]" src -g '!*.test.*'` solo devuelve las hojas impresas.

## 6. Documentación, trazabilidad y cierre

- [x] 6.1 `DESIGN.md`: el aviso pasa a «vigente desde U3», el toast se corrige a abajo a la derecha y se anotan los tokens y utilidades reales (`text-*`, `code`, `GaugeMotif`, `BusinessMark` y `MasterDetail`).
- [x] 6.2 `PRODUCT.md` y `docs/negocio/requisitos/interfaz-y-navegacion.md` (nota inicial, §10 y §13): la dirección vigente es «Grafito y cobre».
- [x] 6.3 `docs/negocio/requisitos/requisitos-no-funcionales.md` (`RNF-USA-016`) y `docs/negocio/requisitos/matriz-trazabilidad.md`:
  - quitar la observación previa con la usuaria y el Facturador del SRI;
  - actualizar la fila del sistema visual y la sección del rediseño con la evidencia de este cambio, a razón de una fila por requisito.
- [x] 6.4 `docs/tecnico/revision-visual-frontend.md`: nota de que la dirección vigente es «Grafito y cobre» (U3). Además, `docs/cambios-pendientes.md`: casillas de U3 y choques resueltos.
- [x] 6.5 **Verificación final:**
  - `npm run format:check`, `npm run lint`, `npm run typecheck` y `npm run build`;
  - las pruebas relacionadas de los grupos 1 a 5;
  - `npx playwright test e2e/visual-system.spec.ts e2e/responsive.spec.ts` y `npm run test:e2e:catalog`;
  - `openspec validate renovar-sistema-visual --strict`.

  La suite completa solo si el titular la pide.
