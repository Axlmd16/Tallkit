<!--
Tareas para revisión. El usuario aprobó la propuesta (b66cf0f), las specs (12b7ac6) y el
design (f43c39f) el 2026-09-21. Este artefacto no autoriza la implementación: apply requiere
aprobación explícita posterior, conforme a openspec/config.yaml y AGENTS.md. Tampoco autoriza
commits, ramas ni merges.

Aplicar TDD en cada tarea de comportamiento:
1. prueba que falla por la razón esperada;
2. implementación mínima;
3. refactorización.

Solo se cambian frontend y documentación; backend, API, permisos y datos quedan intactos.
Frontend con npm exclusivamente, desde `frontend/`. Las rutas existentes se confirmaron por
inspección y los archivos nuevos provienen del design. Las capturas de evidencia se guardan
fuera del repositorio. Toda evidencia debe ser un resultado real ejecutado.

La fase 3 termina en un punto de control: la fase 4 no empieza sin la aprobación visual
explícita del usuario.
-->

## 1. Preparación y línea base

- [x] 1.1 Confirmar que `gestionar-ventas-pagos-credito-simple` está integrado en `master` y que proposal, specs y design de este cambio están en `master`. Crear la rama de trabajo desde `master` solo con autorización del usuario y registrar el commit de partida.
- [x] 1.2 Ejecutar `make frontend-check`, `cd frontend && npm run test` y `cd frontend && npm run test:e2e`. Registrar los fallos preexistentes separados de los que introduzca este cambio.
  - Línea base registrada el 2026-09-21 sobre el árbol parcial: `npm run test` pasó 773/773 pruebas; `make frontend-check` llegó a 773/773 pruebas pero falló por cobertura global (82.48 % statements, 74.95 % branches, 79.43 % functions y 83.87 % lines); `npm run test:e2e` no arrancó porque `127.0.0.1:8001/api/v1/health/` ya estaba ocupado.
- [x] 1.3 Inventariar con `grep` los consumidores de `Drawer`, `EditorDrawer`, `ReferencePicker`, `Dialog`, `InlineNotice tone="success"`, `text-primary`, `bg-surface-selected` y `ring-primary` en `frontend/src/{app,pages,features}`. Clasificar cada uso de `primary` como acción o como selección, enlace o foco. Guardar la tabla fuera del repositorio para guiar las fases 2 a 4.

## 2. Fase 1 — Tokens y tipografía

- [x] 2.1 Escribir en `frontend/src/shared/styles/tokens.test.ts` las pruebas que fallan comprobando:
  - que `tokens.css` declara `--tk-canvas`, `--tk-surface`, `--tk-line`, `--tk-ink`, `--tk-primary`, `--tk-accent`, `--tk-brand`, `--tk-scope-commercial` y `--tk-scope-artisan` con los valores del design D1;
  - que el bloque `[data-theme='dark']` existe;
  - que ningún archivo de `src/` asigna `data-theme` ni usa `prefers-color-scheme: dark`.
- [x] 2.2 Crear `frontend/src/shared/styles/tokens.css` con los tokens claros, radios, sombras y el bloque oscuro documentado. Sustituir en `frontend/src/shared/styles/index.css` el bloque `@theme static` por `@theme inline`, que referencia las variables `--tk-*`, y añadir las utilidades `accent*`, `brand`, `line-strong`, `scope-*` y `workspace`. `frontend/src/shared/ui/catalog-tokens.css` solo lo usa el catálogo interno; se integra o retira al reescribirlo en la tarea 6.1. Verificar con `npm run test -- tokens` y `npm run build`.
- [x] 2.3 Sustituir `@fontsource/nunito` por `@fontsource/ibm-plex-sans` y `@fontsource/ibm-plex-mono` con `npm install --save-exact`. Actualizar las `@font-face` de `index.css` (Sans 400, 500, 600 y 700; Mono 400, 500 y 600; subconjunto latino) y los tokens `--font-sans` y `--font-mono`, y eliminar Nunito. Verificar que `package-lock.json` solo cambia en esas dependencias, y ejecutar `npm run build` y `npm audit --omit=dev`.
- [x] 2.4 Añadir en `frontend/src/shared/styles/legacy-guard.test.ts` una prueba de guarda que detecta `Nunito`, `#605BFF`, `#4F4AE8`, `#EFEEFF` o importaciones de `@/assets/figma` en `src/`. Registrar los archivos con restos actuales como deuda explícita: la prueba falla si aparece uno nuevo o si uno ya limpio sigue en la lista, y la lista debe quedar vacía en la tarea 11.3. Se prefirió a una prueba en rojo permanente para no romper `npm test` en cada fase.
- [x] 2.5 Actualizar las reglas base de `index.css`:
  - tipografía y escala de D1;
  - foco visible con `accent`;
  - cifras tabulares en importes;
  - `prefers-reduced-motion`.

  Verificar con `npm run typecheck`, `npm run lint` y `npm run test`.

## 3. Fase 1 — Marco autenticado y acceso

- [x] 3.1 Escribir en `frontend/src/app/AuthenticatedShell.test.tsx` las pruebas que fallan:
  - barra de 240 px con logotipo Tallkit y grupos de `navigation.ts` desde 1280 px;
  - barra de iconos de 72 px con nombre accesible y ayuda emergente entre 768 y 1279 px;
  - barra superior con menú y panel temporal por debajo de 768 px, que se cierra al elegir;
  - opción activa con `aria-current`;
  - solo opciones permitidas por `session.permissions` para cada rol;
  - usuario y cierre de sesión al pie.
- [x] 3.2 Implementar el marco en `frontend/src/app/AuthenticatedShell.tsx`, `SidebarNavigation.tsx`, `useExpandedRail.ts`, `shared/ui/navigation/Sidebar.tsx` y `NavigationItem.tsx`, con el logotipo de `frontend/src/assets/brand/`. Añadir la barra superior de escritorio con la ruta de migas y la marca de ámbito fiscal en pantallas económicas, sin búsqueda global. Verificar con las pruebas de 3.1 y `app/*.test.tsx`.
- [x] 3.3 Rediseñar `frontend/src/pages/login/` y `frontend/src/pages/change-password/` con formulario delimitado, logotipo Tallkit y composición propia, sin registro público ni acceso social. Ajustar sus pruebas solo en selectores de presentación. Verificar con `npm run test -- login change-password`.
- [x] 3.4 **Evidencia de fase 1:** capturar con Playwright acceso, inicio y una lista a 360, 768, 1024, 1280 y 1440 px fuera del repositorio, ejecutar `axe` en esos anchos y presentarlas al usuario junto al tablero «Fundamentos».

## 4. Fase 2 — Componentes compartidos ajustados

- [x] 4.1 Ajustar, con pruebas de estilos computados que fallan primero en `controls.test.tsx`, los componentes `Button` (variantes principal, secundaria, discreta, peligro y peligro sólido), `IconButton` (44 × 44 táctil y `Tooltip`), `ButtonGroup`, `Field`, `Input`, `Select`, `Checkbox`, `Textarea`, `SearchInput`, `PasswordInput`, `DateControl` y `FormSection` en `frontend/src/shared/ui/`. Todos quedan en altura de 40 px, borde `line-strong`, foco `accent` y estado inválido con mensaje asociado.
- [x] 4.2 Ajustar `Tabs`, `SegmentedControl`, `Tooltip` y `DropdownMenu` (sombra de menú y teclado) y verificar su navegación por teclado en sus pruebas.
- [x] 4.3 Ajustar `DataTable`, `DataList`, `Pagination` y `RowActions`:
  - tabla contenida en un panel;
  - encabezado fijo en `surface-subtle`;
  - filas compactas;
  - importes alineados a la derecha;
  - filas de dos líneas por debajo de 640 px.

  Verificar con sus pruebas y `layout.test.tsx`.
- [x] 4.4 Ajustar `StatusBadge` (rectangular con marcador), `FiscalScopeBadge` (tono e icono propios por ámbito), `InlineNotice`, `LoadingState` y los estados de `feedback/`: vacío, sin resultados, error con reintentar, sin permiso y marcadores de carga (PPF-07). Verificar con `StatusBadge.test.tsx` y `states.test.tsx`.
- [x] 4.5 Ajustar `PageHeader`, `Toolbar`, `FilterPanel`, `Surface`, `DetailCard`, `Divider`, `FormLayout`, `Avatar` y `ConfirmationPanel`. Verificar con `npm run test -- shared/ui`.

## 5. Fase 2 — Componentes nuevos

- [x] 5.1 Escribir las pruebas que fallan de `frontend/src/shared/ui/feedback/Toast.test.tsx`:
  - duración de 6 s con temporizadores simulados;
  - pausa con el puntero y con el foco;
  - cierre con Escape y con el botón;
  - máximo tres, con la más antigua retirada primero;
  - región `role="status"` y `aria-live="polite"`;
  - foco sin mover;
  - enlace «Ver»;
  - sin animación con movimiento reducido.

  Implementar `ToastProvider` y `useToast` (`success` e `info`) y montarlos en `AuthenticatedShell`.
- [x] 5.2 Escribir las pruebas que fallan de `frontend/src/shared/ui/overlays/FormModal.test.tsx`:
  - nombre accesible, foco inicial y contención de foco;
  - aviso «Seguir editando / Descartar» con cambios, al pulsar Escape, cierre o Cancelar;
  - «Guardar y crear otro» limpia el formulario y enfoca el primer campo;
  - un error del servidor mantiene el modal abierto sin toast;
  - ancho completo por debajo de 640 px.

  Implementar `FormModal` sobre `Modal` y `modal-utils`.
- [x] 5.3 Mover `frontend/src/features/sales/SaleCombobox.tsx` a `frontend/src/shared/ui/forms/Combobox.tsx` con pruebas: patrón ARIA, flechas, Enter, Escape, AvPág/RePág, inactivos no seleccionables, limpiar y resultados en portal. Conservar la interfaz `PickerResults` de `features/purchases/ReferencePicker.tsx`.
- [x] 5.4 Crear con pruebas `PlateTag`, `PartCode` (copiar al portapapeles con nombre accesible), `StockIndicator` (cantidad y «Agotado» en cero, nunca «Stock bajo») y `Money` (importe USD o guion, sin aritmética de coma flotante) en `frontend/src/shared/ui/business/`, y exportarlos en `shared/ui/index.ts`.
- [x] 5.5 Extraer de `frontend/src/features/sales/SalesDocument.tsx` un `DocumentSheet` compartido: hoja A4, marca Tallkit, «COMPROBANTE INTERNO», estado, número pendiente y aviso del SRI. Conservar la impresión y las pruebas de `SaleDocumentPage.test.tsx`.
- [x] 5.6 Rehacer `frontend/src/shared/ui/Dialog.tsx` sobre `Modal`, sin ilustraciones de `assets/figma/` y con la variante de peligro. Ajustar sus 12 consumidores solo en presentación. Verificar con `Dialog.test.tsx` y `npm run test`.

## 6. Fase 2 — Catálogo visual interno

- [x] 6.1 Reescribir `frontend/src/dev/visual-catalog/registry.ts` y `registry.test.ts` con las familias Tallkit (fundamentos, acciones, campos, combobox, tablas, estados, piezas del taller, superposiciones, toasts, navegación y patrones de pantalla), cada una con su tablero de origen o marca de adaptación. Eliminar los estados de evidencia Figma.
- [x] 6.2 Reescribir `previews.tsx` y `CatalogApp.tsx` con ejemplos deterministas y restablecibles. Mantener `visual-catalog.html` fuera de la compilación productiva y verificarlo con `npm run build` más la inspección de `dist/`.
- [x] 6.3 Eliminar las pruebas `frontend/e2e/catalog/phase11-charts`, `phase12-calendar`, `phase13-timeline-board` y `phase14-conversation`. Ajustar las demás de `e2e/catalog/` a las familias Tallkit y ejecutar `npm run test:e2e:catalog`.
- [x] 6.4 **Evidencia de fase 2:** capturas del catálogo en los cinco anchos y `axe`, presentadas al usuario.

## 7. Fase 3 — Piloto (punto de control)

- [x] 7.1 Lista de ventas (`frontend/src/pages/sales/SalesPage.tsx`) con PPF-01:
  - encabezado y acción «Nueva venta» según permiso;
  - estados por segmentos, filtros y tabla con `Money` y `StatusBadge`;
  - filtros y página conservados al volver de la ficha;
  - toast tras confirmar;
  - sin indicadores de resumen sin dato del servidor.

  Actualizar `SalesPage.test.tsx`.
- [x] 7.2 Ficha de vehículo (`frontend/src/pages/vehicles/VehicleDetailPage.tsx`) con PPF-02: volver, resumen con `PlateTag` y estado, bloques y columna lateral con acciones según permiso, que se reubica debajo en pantallas estrechas. Actualizar sus pruebas.
- [x] 7.3 Página de producto con PPF-03 y D6. Escribir primero en `frontend/src/app/catalog-routes.test.tsx` las pruebas que fallan de `/products/new` y `/products/:id/edit`: permiso de creación y edición actuales, casos positivos y negativos por rol, y rutas existentes intactas. Crear la página con `ProductForm` por secciones, barra de acciones fija, aviso de cambios sin guardar mediante el bloqueo de `react-router`, y navegación a la ficha con toast al guardar. Retirar `ProductEditorDrawer`.
- [x] 7.4 Modal de marcas de vehículo (`frontend/src/pages/vehicle-brands/VehicleBrandsPage.tsx`; es una página propia, no usa `AuxiliaryCatalogPage`, que se migra en la 8.2) con `FormModal`, «Guardar y crear otra» y toast. Reemplazar la franja de éxito persistente. Actualizar `AuxiliaryCatalogPage.test.tsx`.
- [x] 7.5 Editor de venta (`frontend/src/pages/sales/SaleEditorPage.tsx`, `features/sales/SaleLinesEditor.tsx`, `SaleViewer.tsx` y `sales.css`) con PPF-05, en su versión Tallkit:
  - `Combobox`, `PartCode`, `StockIndicator` y `Money`;
  - condición como selección segmentada;
  - total junto a las acciones;
  - visor con `DocumentSheet`.

  Conservar todas las pruebas funcionales de `SaleEditorPage.test.tsx`.

  Desviación registrada: `StockIndicator` no se muestra en el editor porque la API de opciones de producto para ventas no entrega existencias y este cambio no modifica el backend; `PartCode` no se añade porque el código ya figura en el combobox y en la hoja.
- [x] 7.6 Aplicar PPF-06 a `SaleReviewDialog`, `PaymentDialog` y `VoidSaleDialog`:
  - textos breves como «Confirmar venta», «Registrar cobro» y «Anular venta»;
  - efecto explicado en el cuerpo;
  - peligro sólido en anular;
  - «Conservar venta» como salida segura.

  Ajustar `dialogs.test.tsx` y `SaleReviewDialog.test.tsx`.
- [x] 7.7 Ejecutar `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` y `npx playwright test e2e/sales-payments.spec.ts e2e/catalogs.spec.ts e2e/customers-vehicles.spec.ts`, actualizando los selectores de `list/Elegir` a `combobox/option`.
- [x] 7.8 **Punto de control:** presentar al usuario las capturas de las cinco pantallas del piloto en 360, 1024 y 1440 px junto a los tableros «Lista de ventas», «Ficha de vehículo», «Nuevo producto», «Formulario corto en modal» y «Nueva venta», con las diferencias justificadas. Detenerse hasta recibir su aprobación o sus correcciones.

## 8. Fase 4 — Resto de módulos

- [x] 8.1 **Identidad y administración:** usuarios en `FormModal` (`pages/users/UsersPage.tsx`, `features/users/UserForm.tsx`, con roles), auditoría, configuración del taller (página por secciones) y estado técnico, conservando sus avisos informativos en línea. Actualizar sus pruebas.
- [x] 8.2 **Catálogos auxiliares restantes:** marcas de producto, categorías y unidades de medida en `FormModal`, mediante `AuxiliaryCatalogPage`.
- [x] 8.3 **Servicios:** lista, ficha y `ServiceForm` en `FormModal`. Retirar `ServiceEditorDrawer`.
- [x] 8.4 **Proveedores:** lista, ficha y página `/suppliers/new` y `/suppliers/:id/edit` con pruebas de ruta y permisos por rol, que fallan primero. Retirar `SupplierEditorDrawer`.
- [x] 8.5 **Clientes y vehículos:** listas, ficha de cliente y páginas `/customers/new`, `/customers/:id/edit`, `/vehicles/new` y `/vehicles/:id/edit` con pruebas de ruta y permisos, que fallan primero. Retirar los drawers de `CustomersPage`, `CustomerDetailPage`, `VehiclesPage` y `VehicleDetailPage`.
- [x] 8.6 **Compras e inventario:**
  - lista de ingresos y editor de ingreso con PPF-05 y `Combobox` en lugar de `ReferencePicker`;
  - ficha de ingreso;
  - inventario y Kardex;
  - ajuste de inventario en `FormModal`, retirando `AdjustmentDrawer` y conservando su confirmación reforzada.

  Resultado (2026-09-23): lista con segmentos de estado y `Money`; editor con la estructura del editor de venta (barra de acciones fija con total del servidor) y ficha PPF-02 con toast al anular; diálogos de revisión y anulación con PPF-06 («Conservar ingreso», peligro sólido, entidad fiscal en el cuerpo); inventario con `StockIndicator` («Agotado» en cero) y toast; `AdjustmentDrawer.tsx` renombrado a `AdjustmentModal.tsx`. Se corrigieron dos defectos hallados en e2e: la migración a `FormModal` había perdido el bloqueo de «Confirmar operación» con impedimentos y la salida «Abandonar sin confirmar» (nuevas props `saveDisabled` y `cancelLabel`), y el editor podía crear un segundo ingreso si se revisaba antes de aplicarse la navegación al borrador creado. Ambos con prueba de regresión.
- [x] 8.7 **Ventas y cobros restantes:** ficha de venta, comprobante con `DocumentSheet`, cuentas por cobrar y diálogos de devolución, reembolso y corrección (`RefundDialog`, `ReturnDialog`, `CorrectionDialog`, `MoneyDialog`) con PPF-06, conservando en línea el aviso de registro ya guardado.

  Resultado (2026-09-23): ficha de venta con PPF-02 (resumen de estados, tabla de productos, historial de cobros y devoluciones, columna con acciones e importes); comprobante con encabezado de ficha sobre el espacio de trabajo; cuentas por cobrar con `Combobox` de cliente, totales del servidor como cifras y `Money`; `MoneyDialog` nombra la venta con su número y la entidad fiscal en todos sus diálogos, y corregir un pago ofrece «Conservar pago». El aviso «Este registro ya se guardó» sigue en línea.
- [x] 8.8 **Inicio:** conservar solo los indicadores respaldados por datos del servidor y aplicar el marco y los estados, sin inventar métricas.

  Resultado (2026-09-23): se retiraron los indicadores sin dato del servidor («Sesión local», «Área de trabajo», los contadores decorativos) y los gráficos vacíos. El inicio muestra el usuario y sus roles de la sesión y los accesos agrupados por área según `visibleGroups(session.permissions)`, la misma política de la navegación. `roleLabels` pasa a `features/auth/types.ts`.
- [x] 8.9 Reemplazar los usos restantes de `InlineNotice tone="success"` que confirman acciones terminadas por `useToast().success`, según la clasificación de 1.3, y comprobar con `grep` que las franjas persistentes que quedan son solo informativas.

  Resultado (2026-09-23): pasan a `useToast().success` las confirmaciones de servicios, proveedores (lista y ficha), clientes (lista y ficha), vehículos (lista), inventario e ingresos. Se retiraron además restos de la tarea 8.5: el modal de edición de cliente y de vehículo abierto desde la vista previa de la lista (ahora navega a `/customers/:id/edit` y `/vehicles/:id/edit`), y los modales de formulario sin uso de `CustomerDetailPage` y `VehicleDetailPage`. La foto de ejemplo de la vista previa de vehículo (commit 441d14b) se conserva por ser una decisión del usuario, aunque no corresponde a un dato del servidor; queda para su revisión. `grep` final: las franjas `tone="success"` que quedan son informativas (disponibilidad en estado técnico, «Este registro ya se guardó» y «Revisión lista» dentro de `MoneyDialog`). La configuración del taller no tenía confirmaciones de éxito que reemplazar.
- [x] 8.10 Migrar a `accent` los usos de `primary` clasificados en 1.3 como selección, enlace o foco, con pruebas de estilos computados en navegación, pestañas, enlaces y filas seleccionadas.

  Resultado (2026-09-23): la tabla de la tarea 1.3 no se conservó y se rehízo con `grep`. Pasan a `accent` los enlaces de clientes, vehículos, productos, proveedores, servicios, compras y ventas; la opción activa y su contador en `NavigationItem`; el chip de marca elegida de `VehicleBrandPicker`; las selecciones y el foco de `sales.css` y `.catalog-editor-form`; y los controles propios de la configuración del taller, que usaban un foco violeta de la plantilla y ahora usan `getControlClasses()`. El icono de cada entidad fiscal usa los tokens `scope-*`. Conservan `primary` los botones, los enlaces con forma de botón y la marca «Tallkit». Pruebas de clases en pestañas, filas seleccionadas, navegación y enlaces. Las familias `calendar/`, `board/`, `conversation/`, `timeline/` y `MetricCard` no se migran porque se retiran en 9.2.

## 9. Retiro de legado

- [x] 9.1 Confirmar con `grep` que no hay consumidores fuera de `shared/ui` y `dev/`, y eliminar `Drawer.tsx`, `Drawer.test.tsx`, `features/catalog-common/EditorDrawer.tsx` y `features/purchases/ReferencePicker.tsx`, junto con su reexportación en `features/sales/ReferencePicker.tsx`, conservando `PickerResults` donde lo use `Combobox`.

  Resultado (2026-09-23): el único consumidor fuera de `shared/ui` era el panel de navegación móvil de `AuthenticatedShell`, que D8 permite por no ser un formulario. Se sustituyó por `shared/ui/navigation/NavigationPanel` (panel temporal sin aviso de cambios, con sus pruebas), también usado por `Sidebar`. Se eliminaron `Drawer.tsx`, `Drawer.test.tsx`, `DrawerVariants.test.tsx`, `EditorDrawer.tsx`, `features/purchases/ReferencePicker.tsx` con su prueba y `features/sales/ReferencePicker.tsx`. `PickerResults` tenía la misma forma que `ComboboxResults`, que ahora devuelven directamente los hooks de selección; las pruebas de anidación y retorno de foco usan `Modal`.
- [x] 9.2 Eliminar los componentes sin consumidor funcional del design D3 (`MetricCard`, `StatCard`, `DetailPanel`, los layouts de la plantilla y las familias `charts/`, `calendar/`, `board/`, `conversation/` y `timeline/`) con sus pruebas y exportaciones, y el directorio `frontend/src/assets/figma/`.

  Resultado (2026-09-23): confirmado con `grep` que ninguno tenía consumidores fuera de `shared/ui`; se eliminaron con sus pruebas y exportaciones, y `assets/figma/`. Los iconos `category`, `chart` y `document` de `shared/ui/icons` usaban esos SVG y pasan a Phosphor (`SquaresFour`, `ChartBar`, `FileText`). La prueba de `FormLayout`, que compartía archivo con `MasterDetailLayout`, se conserva en `layout/FormLayout.test.tsx`. `Progress` no figura en D3 y se conserva: se sustituyeron su violeta de la plantilla, sus colores de paleta y sus variantes `dark:` por tokens, y sus pruebas pasan a `data/Progress.test.tsx`. La deuda de la prueba de guarda queda solo en `index.css`, que limpia la 9.3.
- [x] 9.3 Eliminar de `index.css` las clases de página heredadas que queden sin uso y los tokens pastel sin consumidores. Verificar con `npm run build` y con la prueba de guarda de 2.4.

  Resultado (2026-09-23): un recorrido de clases contra `src/` señaló 35 sin uso; se conservaron `avatar-0…3` y `role-*`, que se construyen dinámicamente, y se eliminaron las demás (`access-*`, `chart-*`, `dashboard-*`, `data-list`, `drawer-*`, `empty-*`, `preview-*`, `session-*`, `stat-*`) con sus bloques `@media` vacíos; `index.css` pasa de 1376 a unas 920 líneas. Los tokens pastel (`cyan`, `yellow`, `coral`, `pink`, `orange`, `green` y sus `-soft`) se retiraron; los estilos de avatar y rol que los usaban apuntan ahora a los tokens Tallkit de igual valor. `npm run build` correcto y la prueba de guarda en verde con la lista de deuda vacía.

## 10. Pruebas e2e y accesibilidad

- [x] 10.1 Eliminar `frontend/e2e/figma-fidelity.spec.ts`, `catalogs-styles.spec.ts` y `visual-evidence.spec.ts`. Reescribir `visual-system.spec.ts` para comprobar los estilos computados de los tokens Tallkit, que IBM Plex se carga sin solicitudes externas (bloqueándolas con `page.route`) y que no existe tema oscuro activo.

  Resultado (2026-09-23): eliminadas las tres pruebas. `visual-system.spec.ts` comprueba lienzo, tinta, tipografía, acción principal y foco `accent`; que IBM Plex Sans y Mono se cargan desde 127.0.0.1 con todas las solicitudes externas bloqueadas por `page.route`; y que con `prefers-color-scheme: dark` se mantiene el tema claro, sin `data-theme` ni selector. `npx playwright test e2e/visual-system.spec.ts`: 3 aprobadas.
- [x] 10.2 Actualizar `responsive.spec.ts` y `e2e/accessibility.ts` para ejecutar `axe` y la comprobación de desplazamiento horizontal en 360, 768, 1024, 1280 y 1440 px sobre acceso, inicio, una lista, una ficha, un formulario en página, un modal, el editor de venta y un diálogo.

  Resultado (2026-09-23): `accessibility.ts` añade `REPRESENTATIVE_WIDTHS`, `expectNoHorizontalOverflow` y `expectAdaptableAndAccessible`. `responsive.spec.ts` se reescribió: panel de navegación en 360 px, barra de 72 px entre 768 y 1279 px y de 240 px desde 1280 px, y en los cinco anchos `axe` y desplazamiento horizontal sobre acceso, inicio, lista de ventas, ficha de proveedor, formulario de producto en página, modal de marca, editor de venta y diálogo de desactivación. Se retiraron los casos que abrían clientes y vehículos en modal. `npx playwright test e2e/responsive.spec.ts`: 13 aprobadas.
- [x] 10.3 Añadir en e2e los flujos de toast (aparece tras guardar y no roba el foco) y de modal (cierre con cambios sin guardar) sobre datos reales del servidor de pruebas.

  Resultado (2026-09-23): `e2e/feedback.spec.ts` crea una marca real con «Guardar y crear otra» y comprueba el toast, el foco en el primer campo, el registro en la lista y la desaparición a los 6 s; y cierra un modal con cambios mediante Escape y Cancelar, con «Seguir editando» (conserva el valor) y «Descartar» (no crea nada). La prueba reveló un defecto: con un modal abierto el aislamiento de `modal-utils` volvía inerte la región de notificaciones, que no se anunciaba. La región se monta ahora en un portal sobre `body` con `data-modal-exempt`, que el aislamiento respeta; prueba de regresión en `Toast.test.tsx`. 2 aprobadas.

- [x] 10.4 Ejecutar todos los e2e con `npm run test:e2e` y `npm run test:e2e:catalog` y registrar los resultados reales.

  Resultado (2026-09-23): primera ejecución completa con 67 aprobadas y 6 fallidas, todas en pruebas que esperaban formularios de cliente, vehículo, producto y proveedor en modal. Se actualizaron `catalogs-quality`, `catalogs` y `customers-vehicles` (páginas completas, menú de acciones por fila, barra de 72/240 px, apertura de la ficha al pulsar la fila). Las pruebas revelaron y se corrigieron tres defectos de la aplicación, con prueba de regresión: desbordamiento horizontal con nombres largos en los formularios por secciones (columna de rejilla sin `minmax(0, 1fr)` en `ProductForm` y `FormSection`), foco que no volvía al disparador al cerrar un modal (`useModalOpen` captura ahora el control de origen durante el render de apertura, antes de `autoFocus` y del aislamiento `inert`), y la región de notificaciones inerte con un modal abierto (tarea 10.3). Por decisión del usuario se retiró la columna «Existencias» que se había añadido a la lista de productos fuera del alcance, y se restituyeron sus columnas «Presentación» (UI-030) y «Estado» (PPF-01). Ejecución final: `npm run test:e2e` 79 aprobadas; `CATALOG_EVIDENCE_DIR=<fuera del repositorio> npm run test:e2e:catalog` 24 aprobadas.

## 11. Documentación y trazabilidad

- [x] 11.1 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md`:
  - 2.1: marco Tallkit, barra por tamaño y zona de notificaciones temporales;
  - 8.1: textos breves de botones con el efecto en el cuerpo del diálogo;
  - 8.2: éxito mediante toast;
  - 10: modal para formularios cortos y filas compactas en teléfono.

  Resultado (2026-09-23): actualizadas las secciones 2.1 (marco Tallkit, barra por tamaño, migas, ámbito fiscal en la barra superior y zona de notificaciones temporales), 8.1 (textos breves con el efecto en el cuerpo y salida segura), 8.2 (éxito mediante toast; información, advertencias y errores siempre en línea) y 10 (modal o página por tamaño de formulario, sin paneles laterales, y filas compactas en teléfono), además de la cabecera y la nota sobre `DESIGN.md`. `DESIGN.md` se reescribió para Tallkit porque describía la plantilla retirada, y `revision-visual-frontend.md` queda marcado como histórico.
- [x] 11.2 Actualizar el nombre visible «Tallkit» en `docs/negocio/producto/vision.md` conservando el nombre técnico, `docs/negocio/requisitos/matriz-trazabilidad.md` con los requisitos PPF y los modificados, y `docs/tecnico/glosario-tecnico.md` con «toast» y «combobox», con sus archivos `*-glossary-reference.md`.

  Resultado (2026-09-23): `vision.md` muestra «Tallkit» como nombre visible y conserva el nombre técnico. `matriz-trazabilidad.md` actualiza la fila del sistema visual y sustituye la sección del cambio cancelado por la trazabilidad de PPF-01…PPF-08 y de los requisitos modificados hacia sus pruebas. `glosario-tecnico.md` añade «Combobox», «Modal» y «Notificación temporal (toast)», y marca «Drawer» y «Referencia Figma» como retirados; se actualizaron las referencias terminológicas de `interfaz-y-navegacion`, `matriz-trazabilidad`, `revision-visual-frontend` y de las specs del cambio.
- [x] 11.3 Confirmar que la prueba de guarda de 2.4 está en verde y que `README.md` no menciona Nunito ni la referencia Figma retirada.

  Resultado (2026-09-23): `legacy-guard.test.ts` en verde con la lista de deuda vacía (`npx vitest run src/shared/styles`: 16 aprobadas) y `README.md` sin menciones de Nunito, Figma ni SAAS Dashboard.

## 12. Verificación final

- [ ] 12.1 Ejecutar `make check`, `make test` y `make audit`, más `cd frontend && npm run test:coverage` (umbral 85/85/80/85), `npm run build`, `npm run test:e2e` y `npm run test:e2e:catalog`. Registrar los comandos y resultados reales.

  Resultado (2026-09-23, pendiente de verificación final por el usuario): se añadieron pruebas del módulo de configuración del taller y de fichas relacionadas. `make frontend-check` es correcto con 137 archivos y 817 pruebas; la cobertura supera todos los mínimos: statements 87,38 %, branches 80,02 %, functions 85,84 % y lines 88,82 %. `make test` es correcto (backend 1526; frontend 817), `make audit` no encuentra vulnerabilidades, `npm run build` es correcto y `CATALOG_EVIDENCE_DIR=<fuera del repositorio> npm run test:e2e:catalog` aprueba 24 pruebas. Una corrida completa de `npm run test:e2e` obtuvo 73 aprobadas, 2 fallos intermitentes y 4 no ejecutadas; los dos casos fallidos aprobaron al repetirlos de forma aislada (2/2). La repetición completa fue detenida por indicación del usuario, que realizará después la comprobación final. `make check` sigue bloqueado por deuda previa del backend: 13 errores Ruff y 95 errores mypy en 9 archivos sin cambios de esta spec; `ruff format`, `manage.py check`, `makemigrations --check` y `docker compose config --quiet` son correctos.
