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

- [ ] 1.1 Confirmar que `gestionar-ventas-pagos-credito-simple` está integrado en `master` y que proposal, specs y design de este cambio están en `master`. Crear la rama de trabajo desde `master` solo con autorización del usuario y registrar el commit de partida.
- [ ] 1.2 Ejecutar `make frontend-check`, `cd frontend && npm run test` y `cd frontend && npm run test:e2e`. Registrar los fallos preexistentes separados de los que introduzca este cambio.
- [ ] 1.3 Inventariar con `grep` los consumidores de `Drawer`, `EditorDrawer`, `ReferencePicker`, `Dialog`, `InlineNotice tone="success"`, `text-primary`, `bg-surface-selected` y `ring-primary` en `frontend/src/{app,pages,features}`. Clasificar cada uso de `primary` como acción o como selección, enlace o foco. Guardar la tabla fuera del repositorio para guiar las fases 2 a 4.

## 2. Fase 1 — Tokens y tipografía

- [ ] 2.1 Escribir en `frontend/src/shared/styles/tokens.test.ts` las pruebas que fallan comprobando:
  - que `tokens.css` declara `--tk-canvas`, `--tk-surface`, `--tk-line`, `--tk-ink`, `--tk-primary`, `--tk-accent`, `--tk-brand`, `--tk-scope-commercial` y `--tk-scope-artisan` con los valores del design D1;
  - que el bloque `[data-theme='dark']` existe;
  - que ningún archivo de `src/` asigna `data-theme` ni usa `prefers-color-scheme: dark`.
- [ ] 2.2 Crear `frontend/src/shared/styles/tokens.css` con los tokens claros, radios, sombras y el bloque oscuro documentado. Sustituir en `frontend/src/shared/styles/index.css` el bloque `@theme static` por `@theme inline`, que referencia las variables `--tk-*`, y añadir las utilidades `accent*`, `brand`, `line-strong`, `scope-*` y `workspace`. Integrar `frontend/src/shared/ui/catalog-tokens.css` y ajustar `catalog-tokens.test.ts`. Verificar con `npm run test -- tokens` y `npm run build`.
- [ ] 2.3 Sustituir `@fontsource/nunito` por `@fontsource/ibm-plex-sans` y `@fontsource/ibm-plex-mono` con `npm install --save-exact`. Actualizar las `@font-face` de `index.css` (Sans 400, 500, 600 y 700; Mono 400, 500 y 600; subconjunto latino) y los tokens `--font-sans` y `--font-mono`, y eliminar Nunito. Verificar que `package-lock.json` solo cambia en esas dependencias, y ejecutar `npm run build` y `npm audit --omit=dev`.
- [ ] 2.4 Añadir una prueba de guarda que falla si el CSS o el TSX de la aplicación contienen `Nunito`, `#605BFF`, `#4F4AE8`, `#EFEEFF` o importaciones de `@/assets/figma`. Mantenerla en rojo como lista de trabajo pendiente hasta la tarea 11.3.
- [ ] 2.5 Actualizar las reglas base de `index.css`:
  - tipografía y escala de D1;
  - foco visible con `accent`;
  - cifras tabulares en importes;
  - `prefers-reduced-motion`.

  Verificar con `npm run typecheck`, `npm run lint` y `npm run test`.

## 3. Fase 1 — Marco autenticado y acceso

- [ ] 3.1 Escribir en `frontend/src/app/AuthenticatedShell.test.tsx` las pruebas que fallan:
  - barra de 240 px con logotipo Tallkit y grupos de `navigation.ts` desde 1280 px;
  - barra de iconos de 72 px con nombre accesible y ayuda emergente entre 768 y 1279 px;
  - barra superior con menú y panel temporal por debajo de 768 px, que se cierra al elegir;
  - opción activa con `aria-current`;
  - solo opciones permitidas por `session.permissions` para cada rol;
  - usuario y cierre de sesión al pie.
- [ ] 3.2 Implementar el marco en `frontend/src/app/AuthenticatedShell.tsx`, `SidebarNavigation.tsx`, `useExpandedRail.ts`, `shared/ui/navigation/Sidebar.tsx` y `NavigationItem.tsx`, con el logotipo de `frontend/src/assets/brand/`. Añadir la barra superior de escritorio con la ruta de migas y la marca de ámbito fiscal en pantallas económicas, sin búsqueda global. Verificar con las pruebas de 3.1 y `app/*.test.tsx`.
- [ ] 3.3 Rediseñar `frontend/src/pages/login/` y `frontend/src/pages/change-password/` con formulario delimitado, logotipo Tallkit y composición propia, sin registro público ni acceso social. Ajustar sus pruebas solo en selectores de presentación. Verificar con `npm run test -- login change-password`.
- [ ] 3.4 **Evidencia de fase 1:** capturar con Playwright acceso, inicio y una lista a 360, 768, 1024, 1280 y 1440 px fuera del repositorio, ejecutar `axe` en esos anchos y presentarlas al usuario junto al tablero «Fundamentos».

## 4. Fase 2 — Componentes compartidos ajustados

- [ ] 4.1 Ajustar, con pruebas de estilos computados que fallan primero en `controls.test.tsx`, los componentes `Button` (variantes principal, secundaria, discreta, peligro y peligro sólido), `IconButton` (44 × 44 táctil y `Tooltip`), `ButtonGroup`, `Field`, `Input`, `Select`, `Checkbox`, `Textarea`, `SearchInput`, `PasswordInput`, `DateControl` y `FormSection` en `frontend/src/shared/ui/`. Todos quedan en altura de 40 px, borde `line-strong`, foco `accent` y estado inválido con mensaje asociado.
- [ ] 4.2 Ajustar `Tabs`, `SegmentedControl`, `Tooltip` y `DropdownMenu` (sombra de menú y teclado) y verificar su navegación por teclado en sus pruebas.
- [ ] 4.3 Ajustar `DataTable`, `DataList`, `Pagination` y `RowActions`:
  - tabla contenida en un panel;
  - encabezado fijo en `surface-subtle`;
  - filas compactas;
  - importes alineados a la derecha;
  - filas de dos líneas por debajo de 640 px.

  Verificar con sus pruebas y `layout.test.tsx`.
- [ ] 4.4 Ajustar `StatusBadge` (rectangular con marcador), `FiscalScopeBadge` (tono e icono propios por ámbito), `InlineNotice`, `LoadingState` y los estados de `feedback/`: vacío, sin resultados, error con reintentar, sin permiso y marcadores de carga (PPF-07). Verificar con `StatusBadge.test.tsx` y `states.test.tsx`.
- [ ] 4.5 Ajustar `PageHeader`, `Toolbar`, `FilterPanel`, `Surface`, `DetailCard`, `Divider`, `FormLayout`, `Avatar` y `ConfirmationPanel`. Verificar con `npm run test -- shared/ui`.

## 5. Fase 2 — Componentes nuevos

- [ ] 5.1 Escribir las pruebas que fallan de `frontend/src/shared/ui/feedback/Toast.test.tsx`:
  - duración de 6 s con temporizadores simulados;
  - pausa con el puntero y con el foco;
  - cierre con Escape y con el botón;
  - máximo tres, con la más antigua retirada primero;
  - región `role="status"` y `aria-live="polite"`;
  - foco sin mover;
  - enlace «Ver»;
  - sin animación con movimiento reducido.

  Implementar `ToastProvider` y `useToast` (`success` e `info`) y montarlos en `AuthenticatedShell`.
- [ ] 5.2 Escribir las pruebas que fallan de `frontend/src/shared/ui/overlays/FormModal.test.tsx`:
  - nombre accesible, foco inicial y contención de foco;
  - aviso «Seguir editando / Descartar» con cambios, al pulsar Escape, cierre o Cancelar;
  - «Guardar y crear otro» limpia el formulario y enfoca el primer campo;
  - un error del servidor mantiene el modal abierto sin toast;
  - ancho completo por debajo de 640 px.

  Implementar `FormModal` sobre `Modal` y `modal-utils`.
- [ ] 5.3 Mover `frontend/src/features/sales/SaleCombobox.tsx` a `frontend/src/shared/ui/forms/Combobox.tsx` con pruebas: patrón ARIA, flechas, Enter, Escape, AvPág/RePág, inactivos no seleccionables, limpiar y resultados en portal. Conservar la interfaz `PickerResults` de `features/purchases/ReferencePicker.tsx`.
- [ ] 5.4 Crear con pruebas `PlateTag`, `PartCode` (copiar al portapapeles con nombre accesible), `StockIndicator` (cantidad y «Agotado» en cero, nunca «Stock bajo») y `Money` (importe USD o guion, sin aritmética de coma flotante) en `frontend/src/shared/ui/business/`, y exportarlos en `shared/ui/index.ts`.
- [ ] 5.5 Extraer de `frontend/src/features/sales/SalesDocument.tsx` un `DocumentSheet` compartido: hoja A4, marca Tallkit, «COMPROBANTE INTERNO», estado, número pendiente y aviso del SRI. Conservar la impresión y las pruebas de `SaleDocumentPage.test.tsx`.
- [ ] 5.6 Rehacer `frontend/src/shared/ui/Dialog.tsx` sobre `Modal`, sin ilustraciones de `assets/figma/` y con la variante de peligro. Ajustar sus 12 consumidores solo en presentación. Verificar con `Dialog.test.tsx` y `npm run test`.

## 6. Fase 2 — Catálogo visual interno

- [ ] 6.1 Reescribir `frontend/src/dev/visual-catalog/registry.ts` y `registry.test.ts` con las familias Tallkit (fundamentos, acciones, campos, combobox, tablas, estados, piezas del taller, superposiciones, toasts, navegación y patrones de pantalla), cada una con su tablero de origen o marca de adaptación. Eliminar los estados de evidencia Figma.
- [ ] 6.2 Reescribir `previews.tsx` y `CatalogApp.tsx` con ejemplos deterministas y restablecibles. Mantener `visual-catalog.html` fuera de la compilación productiva y verificarlo con `npm run build` más la inspección de `dist/`.
- [ ] 6.3 Eliminar las pruebas `frontend/e2e/catalog/phase11-charts`, `phase12-calendar`, `phase13-timeline-board` y `phase14-conversation`. Ajustar las demás de `e2e/catalog/` a las familias Tallkit y ejecutar `npm run test:e2e:catalog`.
- [ ] 6.4 **Evidencia de fase 2:** capturas del catálogo en los cinco anchos y `axe`, presentadas al usuario.

## 7. Fase 3 — Piloto (punto de control)

- [ ] 7.1 Lista de ventas (`frontend/src/pages/sales/SalesPage.tsx`) con PPF-01:
  - encabezado y acción «Nueva venta» según permiso;
  - estados por segmentos, filtros y tabla con `Money` y `StatusBadge`;
  - filtros y página conservados al volver de la ficha;
  - toast tras confirmar;
  - sin indicadores de resumen sin dato del servidor.

  Actualizar `SalesPage.test.tsx`.
- [ ] 7.2 Ficha de vehículo (`frontend/src/pages/vehicles/VehicleDetailPage.tsx`) con PPF-02: volver, resumen con `PlateTag` y estado, bloques y columna lateral con acciones según permiso, que se reubica debajo en pantallas estrechas. Actualizar sus pruebas.
- [ ] 7.3 Página de producto con PPF-03 y D6. Escribir primero en `frontend/src/app/catalog-routes.test.tsx` las pruebas que fallan de `/products/new` y `/products/:id/edit`: permiso de creación y edición actuales, casos positivos y negativos por rol, y rutas existentes intactas. Crear la página con `ProductForm` por secciones, barra de acciones fija, aviso de cambios sin guardar mediante el bloqueo de `react-router`, y navegación a la ficha con toast al guardar. Retirar `ProductEditorDrawer`.
- [ ] 7.4 Modal de marcas de vehículo (`frontend/src/pages/vehicle-brands/VehicleBrandsPage.tsx` mediante `features/catalog-common/AuxiliaryCatalogPage.tsx`) con `FormModal`, «Guardar y crear otra» y toast. Reemplazar la franja de éxito persistente. Actualizar `AuxiliaryCatalogPage.test.tsx`.
- [ ] 7.5 Editor de venta (`frontend/src/pages/sales/SaleEditorPage.tsx`, `features/sales/SaleLinesEditor.tsx`, `SaleViewer.tsx` y `sales.css`) con PPF-05, en su versión Tallkit:
  - `Combobox`, `PartCode`, `StockIndicator` y `Money`;
  - condición como selección segmentada;
  - total junto a las acciones;
  - visor con `DocumentSheet`.

  Conservar todas las pruebas funcionales de `SaleEditorPage.test.tsx`.
- [ ] 7.6 Aplicar PPF-06 a `SaleReviewDialog`, `PaymentDialog` y `VoidSaleDialog`:
  - textos breves como «Confirmar venta», «Registrar cobro» y «Anular venta»;
  - efecto explicado en el cuerpo;
  - peligro sólido en anular;
  - «Conservar venta» como salida segura.

  Ajustar `dialogs.test.tsx` y `SaleReviewDialog.test.tsx`.
- [ ] 7.7 Ejecutar `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` y `npx playwright test e2e/sales-payments.spec.ts e2e/catalogs.spec.ts e2e/customers-vehicles.spec.ts`, actualizando los selectores de `list/Elegir` a `combobox/option`.
- [ ] 7.8 **Punto de control:** presentar al usuario las capturas de las cinco pantallas del piloto en 360, 1024 y 1440 px junto a los tableros «Lista de ventas», «Ficha de vehículo», «Nuevo producto», «Formulario corto en modal» y «Nueva venta», con las diferencias justificadas. Detenerse hasta recibir su aprobación o sus correcciones.

## 8. Fase 4 — Resto de módulos

- [ ] 8.1 **Identidad y administración:** usuarios en `FormModal` (`pages/users/UsersPage.tsx`, `features/users/UserForm.tsx`, con roles), auditoría, configuración del taller (página por secciones) y estado técnico, conservando sus avisos informativos en línea. Actualizar sus pruebas.
- [ ] 8.2 **Catálogos auxiliares restantes:** marcas de producto, categorías y unidades de medida en `FormModal`, mediante `AuxiliaryCatalogPage`.
- [ ] 8.3 **Servicios:** lista, ficha y `ServiceForm` en `FormModal`. Retirar `ServiceEditorDrawer`.
- [ ] 8.4 **Proveedores:** lista, ficha y página `/suppliers/new` y `/suppliers/:id/edit` con pruebas de ruta y permisos por rol, que fallan primero. Retirar `SupplierEditorDrawer`.
- [ ] 8.5 **Clientes y vehículos:** listas, ficha de cliente y páginas `/customers/new`, `/customers/:id/edit`, `/vehicles/new` y `/vehicles/:id/edit` con pruebas de ruta y permisos, que fallan primero. Retirar los drawers de `CustomersPage`, `CustomerDetailPage`, `VehiclesPage` y `VehicleDetailPage`.
- [ ] 8.6 **Compras e inventario:**
  - lista de ingresos y editor de ingreso con PPF-05 y `Combobox` en lugar de `ReferencePicker`;
  - ficha de ingreso;
  - inventario y Kardex;
  - ajuste de inventario en `FormModal`, retirando `AdjustmentDrawer` y conservando su confirmación reforzada.
- [ ] 8.7 **Ventas y cobros restantes:** ficha de venta, comprobante con `DocumentSheet`, cuentas por cobrar y diálogos de devolución, reembolso y corrección (`RefundDialog`, `ReturnDialog`, `CorrectionDialog`, `MoneyDialog`) con PPF-06, conservando en línea el aviso de registro ya guardado.
- [ ] 8.8 **Inicio:** conservar solo los indicadores respaldados por datos del servidor y aplicar el marco y los estados, sin inventar métricas.
- [ ] 8.9 Reemplazar los usos restantes de `InlineNotice tone="success"` que confirman acciones terminadas por `useToast().success`, según la clasificación de 1.3, y comprobar con `grep` que las franjas persistentes que quedan son solo informativas.
- [ ] 8.10 Migrar a `accent` los usos de `primary` clasificados en 1.3 como selección, enlace o foco, con pruebas de estilos computados en navegación, pestañas, enlaces y filas seleccionadas.

## 9. Retiro de legado

- [ ] 9.1 Confirmar con `grep` que no hay consumidores fuera de `shared/ui` y `dev/`, y eliminar `Drawer.tsx`, `Drawer.test.tsx`, `features/catalog-common/EditorDrawer.tsx` y `features/purchases/ReferencePicker.tsx`, junto con su reexportación en `features/sales/ReferencePicker.tsx`, conservando `PickerResults` donde lo use `Combobox`.
- [ ] 9.2 Eliminar los componentes sin consumidor funcional del design D3 (`MetricCard`, `StatCard`, `DetailPanel`, los layouts de la plantilla y las familias `charts/`, `calendar/`, `board/`, `conversation/` y `timeline/`) con sus pruebas y exportaciones, y el directorio `frontend/src/assets/figma/`.
- [ ] 9.3 Eliminar de `index.css` las clases de página heredadas que queden sin uso y los tokens pastel sin consumidores. Verificar con `npm run build` y con la prueba de guarda de 2.4.

## 10. Pruebas e2e y accesibilidad

- [ ] 10.1 Eliminar `frontend/e2e/figma-fidelity.spec.ts`, `catalogs-styles.spec.ts` y `visual-evidence.spec.ts`. Reescribir `visual-system.spec.ts` para comprobar los estilos computados de los tokens Tallkit, que IBM Plex se carga sin solicitudes externas (bloqueándolas con `page.route`) y que no existe tema oscuro activo.
- [ ] 10.2 Actualizar `responsive.spec.ts` y `e2e/accessibility.ts` para ejecutar `axe` y la comprobación de desplazamiento horizontal en 360, 768, 1024, 1280 y 1440 px sobre acceso, inicio, una lista, una ficha, un formulario en página, un modal, el editor de venta y un diálogo.
- [ ] 10.3 Añadir en e2e los flujos de toast (aparece tras guardar y no roba el foco) y de modal (cierre con cambios sin guardar) sobre datos reales del servidor de pruebas.
- [ ] 10.4 Ejecutar todos los e2e con `npm run test:e2e` y `npm run test:e2e:catalog` y registrar los resultados reales.

## 11. Documentación y trazabilidad

- [ ] 11.1 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md`:
  - 2.1: marco Tallkit, barra por tamaño y zona de notificaciones temporales;
  - 8.1: textos breves de botones con el efecto en el cuerpo del diálogo;
  - 8.2: éxito mediante toast;
  - 10: modal para formularios cortos y filas compactas en teléfono.
- [ ] 11.2 Actualizar el nombre visible «Tallkit» en `docs/negocio/producto/vision.md` conservando el nombre técnico, `docs/negocio/requisitos/matriz-trazabilidad.md` con los requisitos PPF y los modificados, y `docs/tecnico/glosario-tecnico.md` con «toast» y «combobox», con sus archivos `*-glossary-reference.md`.
- [ ] 11.3 Confirmar que la prueba de guarda de 2.4 está en verde y que `README.md` no menciona Nunito ni la referencia Figma retirada.

## 12. Verificación final

- [ ] 12.1 Ejecutar `make check`, `make test` y `make audit`, más `cd frontend && npm run test:coverage` (umbral 85/85/80/85), `npm run build`, `npm run test:e2e` y `npm run test:e2e:catalog`. Registrar los comandos y resultados reales.
- [ ] 12.2 Presentar al usuario las capturas finales de todos los módulos en los cinco anchos y la lista de diferencias justificadas con la maqueta. El cambio queda sin aceptación visual, merge ni archivo hasta su aprobación explícita.
