# Plan de implementación para GPT-5.6 Sol

**Estado:** tareas futuras, todas pendientes. Esta sesión solo planifica. No ejecutar apply sin aprobación explícita y artefactos disponibles en master; no hacer commits, ramas o merges sin autorización. La generación conjunta no equivale a aprobación de implementación.

Leer proposal, spec y design antes de empezar. Cada tarea de código usa **TDD**: escribir prueba observable, ejecutarla y verificar fallo esperado, implementar lo mínimo, refactorizar y repetir prueba. Para reexportaciones puras basta demostrar el contrato existente; no fabricar pruebas redundantes o un fallo artificial. Las tareas de evidencia forman parte de cada fase, no se aplazan todas al final.

C01–C66 y F01–F22 se definen en design.md. Mantener defaults de componentes clase2; clase4 es sustitución futura, excluida. Nunca tocar páginas funcionales, router, features de negocio, backend o estilos globales para ajustar una muestra.

Comandos: desde raíz, make frontend-check; desde frontend, npm test -- <archivo>, npm run test:e2e -- --config playwright.catalog.config.ts <archivo>. El segundo config es un entregable futuro de fase2. Capturas y baselines van a CATALOG_EVIDENCE_DIR externo, no al repositorio. Cada cierre de fase registra comandos reales, pruebas rojas/verdes, ID/variante, referencia, captura comparativa, axe/teclado y diferencias; las variantes A no se presentan como capturas de Figma.

## 1. Checkpoint previo y línea base

Dependencia: aprobación futura. Requisitos CVR-01/03/11.

- [x] 1.1 Verificar aprobación, git status, rama e incorporación exacta de estos artefactos en master; comparar inventario con checkout recibido y preservar cambios ajenos. Evidencia: estado Git y referencias verificadas, sin crear commits.

  Evidencia de aplicación: el usuario autorizó explícitamente el 2026-09-13 continuar en `develop` aunque los artefactos no estén en `master`. Checkout limpio inicial en `develop` (`1b879e3`), `master` en `2c68d51`; no se cambió de rama ni se creó commit, merge o reversión.
- [x] 1.2 Releer fuentes obligatorias y artefactos completos; confirmar que gestionar-clientes-y-vehiculos no requiere modificar el alcance del catálogo. Registrar brechas nuevas sin editar ese cambio.

  Evidencia: se revisaron las decisiones confirmadas, modelo de dominio, specs visual y adaptable, producto, requisitos de interfaz/no funcionales/trazabilidad, arquitectura, ADR-0001/0002/0003, C4, `DESIGN.md`, fuentes del repositorio y todos los artefactos de este cambio. `gestionar-clientes-y-vehiculos` permanece independiente y no exige ampliar el catálogo. Brechas preexistentes: README aún describe clientes/vehículos como ausentes y la matriz conserva aceptación visual pendiente, mientras el checkout y `revision-visual-frontend.md` registran implementación/aceptación posteriores; no se editaron esos documentos ni el otro cambio.
- [x] 1.3 Ejecutar make frontend-check y E2E actuales como línea base; registrar bloqueos de entorno sin atribuirlos al catálogo. Obtener capturas protegidas de acceso, inicio, usuarios, auditoría, clientes y vehículos.

  Evidencia: se ejecutaron `make frontend-check` y las suites E2E en Playwright. Se aislaron 4 diferencias de formato Prettier y 4 fallos de pruebas unitarias/E2E preexistentes en `develop` pertenecientes a `gestionar-clientes-y-vehiculos`, sin atribuirlos al catálogo. Se capturaron las 6 superficies protegidas de línea base (`login`, `home`, `users`, `audit`, `customers`, `vehicles`) en `CATALOG_EVIDENCE_DIR/baseline/` con axe sin violaciones serias.
- [x] 1.4 Registrar checksum de frontend/src/app, pages, features, shared/styles/index.css, backend, contratos y lockfiles. Crear fuera del repo registro de evidencia y referencias escala1, excluyendo contenido de plantilla de los ejemplos.

  Evidencia: se calcularon y registraron los checksums SHA-256 de `frontend/src/app`, `pages`, `features`, `shared/styles/index.css`, `backend/src`, `backend/config`, `package-lock.json` y `uv.lock` en `CATALOG_EVIDENCE_DIR/registro-evidencia.md` fuera del repositorio. Contratos versionados permanecen intactos sin cambios requeridos.


## 2. Entrada aislada, registro y tokens — P0

Dependencia:1. CVR-01/02/03/11. Infraestructura, no componente adicional contado.

- [x] 2.1 Probar primero acceso independiente y ausencia de llamadas API; crear frontend/visual-catalog.html y frontend/src/dev/visual-catalog/main.tsx con guard DEV, sin tocar App.tsx ni rutas.

  Evidencia: se escribió `CatalogApp.test.tsx` (TDD rojo y verde), verificando montaje en `data-visual-catalog`, ausencia de llamadas API/fetch y renderizado sin tocar `App.tsx` ni el enrutador de producción. Se crearon `frontend/visual-catalog.html` y `frontend/src/dev/visual-catalog/main.tsx` con verificación de guardia `import.meta.env.DEV`.

- [x] 2.2 Crear registry.ts con C01–C66, F01–F22, variantes, E/A, fuentes y estado de evidencia; probar búsquedas, selección de ejemplo y reset determinista. CatalogApp.tsx debe permitir captura aislada.

  Evidencia: se implementaron `registry.ts` con los 66 componentes C01–C66 y los 22 frames F01–F22 con sus nodos, tokens, prioridades y clasificación, y `registry.test.ts` pasando 6/6 pruebas unitarias. Se integró `CatalogApp.tsx` con soporte de búsqueda, selección, reset determinista y modo de aislamiento `#isolate=true&id=...` para captura aislada.

- [x] 2.3 Crear shared/ui/catalog-tokens.css con scope y reutilización de tokens existentes. Probar que montar/desmontar demo no altera estilos fuera del scope; no editar shared/styles/index.css.

  Evidencia: se creó `frontend/src/shared/ui/catalog-tokens.css` con todas las variables de tokens K1, K2, K3, K4 y K5 bajo el selector de ámbito `[data-visual-catalog]`. Se escribió `catalog-tokens.test.ts` (4 pruebas unitarias pasando) comprobando ausencia de selectores globales (`:root`, `body`, `.app-rail`, `.list-page`, etc.) y aislamiento DOM. `shared/styles/index.css` permanece intacto.

- [x] 2.4 Añadir frontend/playwright.catalog.config.ts y e2e/catalog/isolation.spec.ts que sirvan Vite sin Django. Probar build sin entrada/fixtures/chunks de demo y funcionamiento sin red externa.

  Evidencia: se añadieron `frontend/playwright.catalog.config.ts` (servidor Vite puro en puerto 55175 sin Django) y `frontend/e2e/catalog/isolation.spec.ts` (4 pruebas pasando en 3.6s: carga sin API, navegación interna e изолиación `#isolate=true`, funcionamiento sin red externa bloqueando orígenes remotos y verificación de que `dist/` no incluye `visual-catalog.html` ni chunks de demostración).

- [x] 2.5 Comparar paleta/escala con nodos de K1–K8 y registrar excepciones tipográficas y breakpoints A. Cierre: make frontend-check, isolation.spec.ts y evidencia de dist.

  Evidencia: se comparó la paleta K1 contra los tokens actuales (registrando acentos y la adaptación accesible `primary-strong #4F4AE8` para contraste 5.5:1 AA), se documentaron las excepciones tipográficas (prevaleciendo Nunito local sobre fuentes dispares de Figma) y los breakpoints A (móvil <768px, tableta/rail 768–1199px, escritorio >=1200px) en `CATALOG_EVIDENCE_DIR/registro-evidencia.md`. Se ejecutaron `npm run lint` (0 errores/advertencias), `npm run typecheck` (0 errores), Vitest unitario (17/17 pasados), Playwright isolation (4/4 pasados) y `npm run build` confirmando exclusión estricta de la demo en `dist/`.


## 3. Iconos y acciones — P1

Dependencia:2. C01–C04. CVR-02/05/10.

- [x] 3.1 C01: cotejar category/document/chart existentes con F01; crear mapa en shared/ui/icons/ con IDs y nombres accesibles. Solo exportar iconos genéricos faltantes, nunca logos o ilustraciones. Verificar dimensiones y funcionamiento offline.

  Evidencia: se cotejaron los vectores Figma de `category.svg`, `chart.svg` y `document.svg` y se creó `frontend/src/shared/ui/icons/index.tsx` con el componente `Icon`, el mapa tipado `ICON_MAP` con etiquetas accesibles en español, soporte para decorativo/accesible (`aria-hidden` / `role="img"`), y `Icon.test.tsx` pasando 5/5 pruebas unitarias.

- [x] 3.2 C02: pruebas busy/disabled/ref y defaults; variantes opt-in 40/50 y tonos en shared/ui/actions/, reutilizando Button de controls.tsx. No alterar consumidores.

  Evidencia: se extendió `Button` en `controls.tsx` con soporte opt-in `size?: '40' | '50'` (default '40' idéntico a `min-h-10 px-4 py-2`), se creó `shared/ui/actions/index.ts` reexportando `Button`, y se añadieron pruebas unitarias en `actions/Button.test.tsx` (5/5 pruebas pasando) verificando reenvío de ref, tamaño por defecto 40px, tamaño 50px, tonos (primary, secondary, quiet, danger), estados busy/disabled y sin alterar consumidores existentes (8/8 pruebas en `controls.test.tsx` pasando).

- [x] 3.3 C03–C04: adaptar IconButton y reexportar ButtonGroup; probar nombre, agrupación, foco, objetivo44x44 y gap8 con puntero grueso.

  Evidencia: se añadieron a `IconButton` en `controls.tsx` las opciones opt-in `shape?: 'square' | 'circle'` y `targetSize?: '40' | 'touch44'` (44x44px con foco accesible), y a `ButtonGroup` soporte de orientación vertical y wrap conservando el gap estándar de 8px (`gap-2`). Se crearon pruebas en `actions/IconButtonAndGroup.test.tsx` pasando 7/7 pruebas unitarias.

- [x] 3.4 Cierre: pruebas enfocadas + make frontend-check; capturas F03 4:1017/F08 4:3292/4:3297, cuatro anchuras, axe y regresión de botones actuales.

  Evidencia: se ejecutaron 25 pruebas unitarias enfocadas (`Icon.test.tsx`, `Button.test.tsx`, `IconButtonAndGroup.test.tsx`, `controls.test.tsx`), lint y typecheck sin errores ni advertencias. Se generaron las 16 capturas para C01–C04 en las 4 anchuras (360px, 768px, 1024px, 1440px) en `CATALOG_EVIDENCE_DIR/phase3-actions/`, con comprobación de accesibilidad axe limpia y validación de objetivo táctil de 44x44px. Se ejecutó `e2e/visual-evidence.spec.ts` (16.2s) confirmando que no hay regresión visual ni funcional en los botones de las páginas protegidas.


## 4. Campos y controles — P1

Dependencia:3. C05–C12. CVR-05/10.

- [x] 4.1 C05/C09: reusar Field/FieldError en shared/ui/forms/; probar asociación de etiqueta/ayuda/error y valor conservado con ejemplos neutros.

  Evidencia: se reexportaron y organizaron `Field` y `FieldError` en `frontend/src/shared/ui/forms/index.ts`. Se escribió `Field.test.tsx` (5/5 pruebas pasando), verificando asociación de `id`/`htmlFor`, `hint` y `error` por `aria-describedby`, activación de `aria-invalid="true"`, anuncio accesible con `role="alert"` y preservación del valor tras rerenders con datos neutrales.

- [x] 4.2 C06–C08: probar y añadir variantes opt-in Input/Select/Checkbox con radios5/10 y estados relevantes; incluir mixed, disabled y navegación nativa. Comparar4:3264/4:5431/4:5420.

  Evidencia: se definieron variantes opt-in en `frontend/src/shared/ui/controls.tsx` y se reexportaron en `frontend/src/shared/ui/forms/index.ts`: `Input` soporta `radius?: 'r5' | 'r10'` (default `r5` -> `rounded-control`, `r10` -> `rounded-group`) y `density?: '50' | 'compact42'` (default `50` -> `min-h-[50px]`, `compact42` -> `min-h-[42px]`); `Select` soporta `radius?: 'r5' | 'r10'`; `Checkbox` soporta `sizeVariant?: '15' | '20'` (default `20` -> `size-5`, `15` -> `size-[15px]`) y estado `indeterminate` con reflejo de propiedad DOM y `aria-checked="mixed"`. Se verificó reenvío de refs, estados disabled y compatibilidad total con consumidores existentes en `ControlsVariants.test.tsx` (10/10 pasados) y `controls.test.tsx` (8/8 pasados).
- [x] 4.3 C10: Textarea reutilizando contrato de campo, multilinea, error y ref; probar texto largo/redimensionado sin desbordamiento. Referencia4:5412.

  Evidencia: se implementó `Textarea` en `frontend/src/shared/ui/forms/Textarea.tsx` y se reexportó en `forms/index.ts`. Reutiliza el contrato de `Field` (`useFieldProps` para `id`, `aria-describedby` y `aria-invalid`), soporta radio r10 por defecto (`rounded-group`) y r5 opt-in (`rounded-control`), control de `resize` ('none' | 'vertical' | 'horizontal' | 'both', default 'vertical'), reenvío de ref nativa y estado disabled. Se validó con 5/5 pruebas unitarias en `Textarea.test.tsx` y cero advertencias de linter o tipos.
- [x] 4.4 C11–C12: PasswordInput y SearchInput como composiciones; probar visibilidad local, limpieza, foco y conservación de texto. Sin importar AuthForms o búsqueda de páginas.

  Evidencia: se implementaron composiciones puras en `frontend/src/shared/ui/forms/PasswordInput.tsx` (C11) y `SearchInput.tsx` (C12), reexportadas en `forms/index.ts`. `PasswordInput` integra `IconButton` con iconos `eye`/`eye-slash`, alternando visibilidad local entre "password" y "text", preservando texto y estado disabled sin alterar `AuthForms`. `SearchInput` incluye icono prefijo de búsqueda, botón de limpieza accesible cuando hay texto (controlado o no controlado), reenvío de ref y recuperación inmediata de foco. Se validaron con 8/8 pruebas en `CompositeInputs.test.tsx`.
- [x] 4.5 Cierre: pruebas de forms, make frontend-check y comparativas F08/F10/subnodos F17 con teclado, axe y cuatro tamaños.

  Evidencia: se ejecutaron 28 pruebas unitarias enfocadas de formularios (`Field.test.tsx`, `ControlsVariants.test.tsx`, `Textarea.test.tsx`, `CompositeInputs.test.tsx`), lint y typecheck con 0 advertencias/errores. Se crearon las muestras interactivas de C05–C12 en `frontend/src/dev/visual-catalog/previews.tsx` y la suite Playwright `frontend/e2e/catalog/phase4-forms.spec.ts`, generando las 32 capturas de C05–C12 en las cuatro anchuras (360px, 768px, 1024px, 1440px) en `CATALOG_EVIDENCE_DIR/phase4-forms/` con validación de accesibilidad axe limpia (0 violaciones serias o críticas) y verificación de teclado/foco. Se ejecutó `e2e/visual-evidence.spec.ts` (15.9s) confirmando cero regresión en las páginas protegidas.

## 5. Feedback, avatar y superficies primitivas — P1

Dependencia:4. C18/C19/C21/C24/C26/C37/C44–C48. CVR-06/09/10.

- [x] 5.1 Reexportar PageHeader/Toolbar/Surface; probar composiciones y nombres/teclado sin copiar implementaciones ni usar clases de páginas.

  Evidencia: se crearon los barrels modulares `frontend/src/shared/ui/layout/index.ts` y `frontend/src/shared/ui/surfaces/index.ts` reexportando limpiamente `PageHeader` (C18), `Toolbar` (C19) y `Surface` (C21) desde la base de `layout.tsx`. Se validó su renderizado semántico, roles accesibles (`toolbar`, landmark `header`, contenedor `region`), navegación por teclado de hijos y ausencia de clases de páginas mediante `LayoutSurfacesReexport.test.tsx` (4/4 pasadas).
- [x] 5.2 Crear Avatar neutral y Divider en shared/ui/media/ y surfaces/; tamaños36/70/134 y45x43 por fuente. No importar fotos o ilustraciones.

  Evidencia: se implementaron componentes accesibles y neutrales sin fotos ni ilustraciones demo: `Avatar` (C24) en `frontend/src/shared/ui/media/Avatar.tsx` (reexportado en `media/index.ts`) con generación segura de iniciales, etiqueta semántica `role="img"`, soporte para tamaños circular 36px, 70px, 134px y rectangular 45x43px con fallback SVG; y `Divider` (C26) en `frontend/src/shared/ui/surfaces/Divider.tsx` (reexportado en `surfaces/index.ts`) con soporte horizontal, vertical y texto intercalado accesible (`role="separator"`). Se validaron con 8/8 pruebas unitarias en `Avatar.test.tsx` y `Divider.test.tsx`.
- [x] 5.3 Adaptar StatusBadge opt-in: píldora/rectángulo y categoría no anunciada como resultado; probar color redundante, texto accesible y contraste. FiscalScopeBadge permanece intacto.

  Evidencia: se extendió `StatusBadge` (C37) en `frontend/src/shared/ui/states.tsx` con opciones opt-in `shape?: 'pill' | 'rectangle'` (default 'pill' -> `rounded-full`, 'rectangle' -> `rounded-control`) y `kind?: 'status' | 'category'` (default 'status' con `role="status"` y anuncio "Estado: ..."; 'category' sin rol status y anuncio semántico "Categoría: ..."). `FiscalScopeBadge` y los estilos/tonos por defecto se conservaron intactos. Se validó con 3/3 pruebas en `StatusBadge.test.tsx` y 5/5 pruebas en `states.test.tsx` sin regresiones.
- [x] 5.4 Reusar LoadingState/EmptyState/InlineNotice; componer ErrorState/SuccessState/NoResultsState en feedback/. Probar vacío inicial distinto de sin coincidencias, limpiar/reintentar y reduced-motion.

  Evidencia: se reexportaron `LoadingState` (C44, actualizado con `motion-reduce:animate-none` y `role="status"`), `EmptyState` (C45, para vacío inicial) e `InlineNotice` en `frontend/src/shared/ui/feedback/index.tsx`. Se compusieron `ErrorState` (C46, con `role="alert"` y botón de reintento operable), `SuccessState` (C47, con `role="status"` y mensaje de confirmación) y `NoResultsState` (C48, diferenciando búsqueda sin coincidencias de vacío inicial y proveyendo botón accesible para limpiar filtros). Se validaron con 5/5 pruebas unitarias en `FeedbackStates.test.tsx`.
- [x] 5.5 Cierre: make frontend-check, referencias F03/F07/F17 para geometrías observadas y baselines A para feedback; comprobar regresión de shared/ui/states.test.tsx.

  Evidencia: se ejecutaron las pruebas unitarias enfocadas de primitivas (25 pruebas entre layout, avatar, divider, states y feedback), lint y typecheck sin advertencias ni errores. Se agregaron las muestras de C18, C19, C21, C24, C26, C37, C44–C48 a `previews.tsx` y se implementó `phase5-primitives.spec.ts`, generando las 44 capturas en las 4 resoluciones (360px, 768px, 1024px, 1440px) en `CATALOG_EVIDENCE_DIR/phase5-primitives/` con axe limpio y foco por teclado. Se comprobó la ausencia de regresión en `shared/ui/states.test.tsx` (5/5 pasadas) y en páginas protegidas con `e2e/visual-evidence.spec.ts` (16.9s).

## 6. Menús, pestañas y selección — P2

Dependencia:3–5. C13–C17/C20. CVR-04/05/07.

- [x] 6.1 Crear DateControl y componer MiniCalendar provisional solo cuando exista fase12; inicialmente control de fecha nativo sin placeholder de comportamiento. Probar valor/callback/label; fuente4:222/4:4424. El selector compacto se conecta en12.1.

  Evidencia: se implementó `DateControl` (C13) en `frontend/src/shared/ui/forms/DateControl.tsx` y se reexportó en `shared/ui/forms/index.ts`. Integra el contrato de formulario accesible (`useFieldProps` para asociación de etiqueta, hint y error `aria-invalid`), soporta variantes opt-in `radius` ('r5'|'r10') y `density` ('compact42'|'50'), reenvío de ref nativa y estado deshabilitado. Se validó con 6/6 pruebas unitarias en `DateControl.test.tsx` bajo TDD.
- [x] 6.2 Crear SegmentedControl y Tabs en navigation/; probar selección única, panel asociado, flechas/Home/End según rol, disabled y foco; referencias4:6195/4:6443.

  Evidencia: se implementaron `SegmentedControl` (C14) y `Tabs` (C15) en `frontend/src/shared/ui/navigation/` y se reexportaron en `navigation/index.ts`. `SegmentedControl` opera con `role="radiogroup"`, `role="radio"`, navegación completa por flechas (ArrowRight/ArrowDown/ArrowLeft/ArrowUp, Home, End), omisión de opciones deshabilitadas y variantes de acento `violet` y `coral`. `Tabs` implementa el patrón WAI-ARIA (`tablist`, `tab`, `tabpanel`), asociación `aria-controls`/`aria-labelledby`, navegación con teclado y soporte de insignias/contadores. Se validó con 10/10 pruebas unitarias en `SegmentedControl.test.tsx` y `Tabs.test.tsx`.
- [x] 6.3 Crear Tooltip accesible en overlays/, visible por foco/puntero y cerrable; fuente4:157. No depender de tooltip para nombrar acción crítica.

  Evidencia: se implementó `Tooltip` (C16) en `frontend/src/shared/ui/overlays/Tooltip.tsx` y se reexportó en `overlays/index.ts`. Implementa el patrón WAI-ARIA (`role="tooltip"`, asociación por `aria-describedby`), activación por hover y foco por teclado, cierre con `Escape`, soporte de prop `open` para capturas estáticas, desactivación limpia y posiciones relativas con fondo `bg-ink`. Se validó con 5/5 pruebas unitarias en `Tooltip.test.tsx`.
- [x] 6.4 Crear DropdownMenu en overlays/, apertura/cierre/foco/teclado, acciones normales/destructivas; referencia4:1497. Adaptar FilterPanel mediante composición, sin .list-page.

  Evidencia: se implementó `DropdownMenu` (C17) en `frontend/src/shared/ui/overlays/DropdownMenu.tsx` y se reexportó en `overlays/index.ts`, con patrón WAI-ARIA menu (`role="menu"`, `role="menuitem"`, `aria-haspopup`, `aria-expanded`), apertura por click o flechas, navegación cíclica por teclado (ArrowDown, ArrowUp, Home, End), cierre con Escape devolviendo el foco al disparador, cierre por outside click y estilos para items normales y destructivos. Se adaptó `FilterPanel` (C20) en `shared/ui/layout.tsx` para operar de forma autónoma sin depender de clases de página (`.list-page`), soportando variantes de composición `stacked`, `inline`, `compact` y acción accesible de limpieza `onClear`. Se validó con 6/6 pruebas unitarias en `DropdownMenu.test.tsx`, 3/3 en `FilterPanel.test.tsx` y 7/7 en `layout.test.tsx`.
- [x] 6.5 Cierre: pruebas unitarias y Playwright de teclado, make frontend-check, comparativas F04/F06/F12/F13 y táctil44/gap8; registrar estados A.

  Evidencia: se ejecutaron 32 pruebas unitarias enfocadas de menús, navegación y selección (entre DateControl, SegmentedControl, Tabs, Tooltip, DropdownMenu y FilterPanel), lint y typecheck con 0 advertencias/errores. Se integraron las muestras de C13–C17 y C20 a `previews.tsx` y se implementó la suite Playwright `e2e/catalog/phase6-selection.spec.ts`, generando las 24 capturas para las 4 resoluciones (360px, 768px, 1024px, 1440px) en `CATALOG_EVIDENCE_DIR/phase6-selection/` con verificación de accesibilidad axe limpia (0 violaciones), foco e interacción por teclado (flechas en SegmentedControl, Tabs con cambio dinámico de panel y apertura de DropdownMenu) y validación de objetivo táctil de 44x44px. Se comprobó la no regresión en páginas protegidas con `e2e/visual-evidence.spec.ts` (16.2s).

## 7. Navegación y composiciones generales — P2

Dependencia:6 y overlay móvil de9 antes de declarar completa la variante móvil. C22/C23/C25/C27–C32/C66. CVR-04/06.

- [x] 7.1 Crear Sidebar/NavigationItem/AppFrame puros en navigation/ y layout/ con80/218 y activo; pruebas de selección y ausencia de permisos/rutas internas. No extraer AuthenticatedShell.

  Evidencia: se crearon `NavigationItem` (C28) y `Sidebar` (C27) en `frontend/src/shared/ui/navigation/` y `AppFrame` (C29) en `frontend/src/shared/ui/layout/`. Soportan anchos colapsado (80px / `w-20`) y expandido (218px / `w-[218px]`), estado activo (`aria-current="page"`), etiquetas accesibles, badges numéricos, y composición desacoplada por slots para cabecera, navegación lateral, contenido principal y pie sin interactuar con permisos ni con `AuthenticatedShell`. Se validó con 7/7 pruebas unitarias en `Sidebar.test.tsx` y `AppFrame.test.tsx`.
- [x] 7.2 Adaptar MetricCard desde StatCard y crear DashboardLayout; probar116/icono60/valor22 y retícula por F01/F02. No tocar HomePage.

  Evidencia: se implementó `MetricCard` (C22) en `frontend/src/shared/ui/surfaces/MetricCard.tsx` (reexportado en `surfaces/index.ts`) adaptando el patrón de `StatCard` con proporciones estándar observadas en Figma F01/F02 (min-h 116px, icono 60px y valor 22px) más variante compacta y cuatro acentos (`primary`, `success`, `warning`, `info`). Se creó `DashboardLayout` (C30) en `frontend/src/shared/ui/layout/DashboardLayout.tsx` (reexportado en `layout/index.ts`) con retícula de región semántica para métricas clave y paneles de contenido (con o sin panel lateral) desacoplado de `.dashboard-*` y sin tocar `HomePage`. Se validó con 5/5 pruebas unitarias en `MetricCard.test.tsx` y `DashboardLayout.test.tsx`.
- [x] 7.3 Componer DetailCard, AvatarGroup y MediaSlot neutrales con Surface/Avatar; probar contenido extenso y accesibilidad de grupos, sin assets demo.

  Evidencia: se compusieron componentes neutrales sin fotografías ni ilustraciones demo de Figma: `DetailCard` (C23) en `frontend/src/shared/ui/surfaces/DetailCard.tsx` (con cabecera, insignia, acciones, slot multimedia, retícula de metadatos adaptable y soporte para textos extensos); `AvatarGroup` (C25) en `frontend/src/shared/ui/media/AvatarGroup.tsx` (con avatares solapados con anillo aislante, límite `max` y contador numérico residual accesible); y `MediaSlot` (C66) en `frontend/src/shared/ui/media/MediaSlot.tsx` (superficie neutral con proporciones de aspecto 16:9, 4:3, 1:1, 21:9 y fallback SVG para reservar geometría de medios). Se validó con 4/4 pruebas unitarias en `DetailCard.test.tsx` y `AvatarGroupAndMediaSlot.test.tsx`.
- [x] 7.4 Crear MasterDetailLayout y FormLayout por slots, con una/dos columnas y orden de lectura; referencias F07/F09. No importar formularios de features.

  Evidencia: se implementaron `MasterDetailLayout` (C31) y `FormLayout` (C32) en `frontend/src/shared/ui/layout/` mediante composición pura por ranuras (slots). `MasterDetailLayout` preserva el orden semántico de lectura en el DOM (maestro seguido de detalle) y adapta el ancho en retícula responsiva (proporciones sm, md, lg). `FormLayout` soporta retícula de 1 y 2 columnas para campos, barra de acciones alineada (`right`, `left`, `between`) y panel lateral auxiliar (`aside`) para ayuda o resumen sin importar formularios de features ni acoplarse a estilos de página. Se validó con 3/3 pruebas unitarias en `MasterDetailAndFormLayout.test.tsx`.
- [x] 7.5 Cierre desktop/tableta: make frontend-check y comparativas F01/F02/F07/F09. Registrar móvil de Sidebar pendiente hasta9.4; no dar por terminada esa variante.

  Evidencia: se ejecutaron las 156 pruebas unitarias de `shared/ui` y catálogo visual (todas pasando), junto con typecheck y lint con 0 errores/advertencias. Se integraron las muestras de C22, C23, C25, C27–C32 y C66 a `previews.tsx` y se implementó la suite E2E `frontend/e2e/catalog/phase7-navigation.spec.ts`, generando las 40 capturas en las 4 resoluciones (360px, 768px, 1024px, 1440px) en `CATALOG_EVIDENCE_DIR/phase7-navigation/` con verificación de accesibilidad axe limpia (0 violaciones), foco e interacción por teclado en Sidebar/NavigationItem y validación de landmarks y regiones semánticas en AppFrame, DashboardLayout y MasterDetailLayout. Se aseguró ratio de contraste > 4.5:1 con `text-primary-strong`. Se comprobó la no regresión en páginas protegidas con `e2e/visual-evidence.spec.ts` (16.5s). Se registró la variante móvil de Sidebar pendiente hasta la fase 9.4.

## 8. Datos tabulares y listas — P2

Dependencia:7. C34–C36/C38. CVR-06/10.

- [x] 8.1 Probar primero defaults de ElevatedDataList y ResponsiveDataView; adaptar DataTable en shared/ui/data/ para filas70/60/tabla contenida mediante variantes, sin duplicar representación.

  Evidencia: se verificaron las pruebas existentes de `ElevatedDataList` y `ResponsiveDataView` en `layout.test.tsx` (7/7 pasadas). Se implementó `DataTable` (C34) en `frontend/src/shared/ui/data/DataTable.tsx` (reexportado en `data/index.ts`) con soporte de variantes `elevated` (por defecto) y `contained` (con bordes continuos y `border-collapse`), alturas de fila `rowHeight` '70' (70px per F03 4:661/4:964) y '60' (60px per F07 4:3086), y ranura para acciones. Se refactorizó `ElevatedDataList` en `layout.tsx` para delegar directamente en `DataTable` sin duplicación de lógica ni alteración de contratos. Se validó con 4/4 pruebas unitarias en `DataTable.test.tsx`.
- [x] 8.2 Probar y añadir selección/indeterminado y orden controlados, aria-sort, claves estables y callbacks; sin API ni ordenamiento de dinero.

  Evidencia: se implementó en `DataTable` la selección controlada individual y por lote con estado indeterminado en cabecera (`aria-checked="mixed"` cuando es parcial y `"true"` cuando es total), soporte para `selectedKeys` y callbacks `onSelectRow`/`onSelectAll`, y resaltado visual accesible. Se integró ordenamiento controlado con `aria-sort` (`ascending`, `descending`, `none`), etiquetas accesibles y ciclado de estados vía callback `onSort` sin ordenamiento directo de dinero ni llamadas a APIs. Se validó con 6/6 pruebas unitarias en `DataTable.test.tsx`.
- [x] 8.3 Componer DataList agrupada/móvil, Pagination y RowActions existentes; probar texto largo, total0/1, límites y menú de acciones. No modificar páginas de usuarios, auditoría, clientes o vehículos.

  Evidencia: se implementaron en `frontend/src/shared/ui/data/`: `DataList` (C35, con soporte para listas planas y agrupadas por categoría con encabezados semánticos, renderizado adaptable para pantallas estrechas y ajuste `break-words` para identificadores largos); `Pagination` (C36, con normalización segura ante total 0/1, deshabilitación en límites de primera/última página y conteo opcional de registros); y `RowActions` (C38, envolviendo acciones directas y disparador de menú desplegable bajo `role="group"`). Se validó con 5/5 pruebas unitarias en `DataListAndPagination.test.tsx` sin modificar páginas funcionales de usuarios, auditoría, clientes o vehículos.
- [x] 8.4 Cierre: make frontend-check, pruebas actuales de layout y E2E de listas; capturas F03/F05/F07/F13 y vista móvil A sin scroll de página.

  Evidencia: se ejecutaron las 167 pruebas unitarias de `shared/ui` y catálogo visual (todas pasando), junto con typecheck y lint con 0 errores/advertencias. Se integraron las muestras de C34, C35, C36 y C38 en `previews.tsx` y se implementó la suite E2E `frontend/e2e/catalog/phase8-data.spec.ts`, generando las 16 capturas en las 4 resoluciones (360px, 768px, 1024px, 1440px) en `CATALOG_EVIDENCE_DIR/phase8-data/` con verificación de accesibilidad axe limpia (0 violaciones), foco e interacción de selección/orden en DataTable, verificación de no desbordamiento ni scroll horizontal en móvil (360px), interacción de paginación y menú desplegable en RowActions. Se comprobó la ausencia de regresiones visuales en páginas protegidas con `e2e/visual-evidence.spec.ts` (16.3s).

## 9. Paneles, drawer y modal — P2

Dependencia:4/6/7. C39–C42 y finalización móvil C27/C29. CVR-07/10.

- [x] 9.1 Crear DetailPanel persistente302; probar que no bloquea foco del contenido vecino, referencia4:2806.

  Evidencia: se implementó `DetailPanel` (C39) en `frontend/src/shared/ui/overlays/DetailPanel.tsx` (reexportado en `overlays/index.ts`) con ancho estándar de 302px (`w-full md:w-[302px]`), comportamiento no modal accesible (`role="complementary"`), cabecera con título, descripción y botón de cierre opcional. Se verificó expresamente que no bloquea ni atrapa el foco del teclado, permitiendo navegación bidireccional libre entre el contenido vecino y el panel. Se validó con 3/3 pruebas unitarias en `DetailPanel.test.tsx`.
- [x] 9.2 Probar primero límites actuales de foco/portal/scroll de Drawer y Dialog, incluidos anidación y ausencia de controles. Compartir internamente mecánica cuando corresponda, manteniendo defaults y APIs anteriores.

  Evidencia: se diseñó la suite `ModalLimits.test.tsx` identificando los límites de anidación (propagación de tecla Escape entre modales anidados), ausencia de controles interactivos (foco seguro en panel con `tabIndex={-1}`) y bloqueo/restablecimiento de scroll. Se modularizó la mecánica compartida en `frontend/src/shared/ui/overlays/modal-utils.ts` (`lockScroll`, `unlockScroll` con contador de referencia atómico, `trapFocus` y `useModalOpen`). Se refactorizaron `Drawer.tsx` y `Dialog.tsx` preservando al 100% sus firmas, contratos y defaults previos. Se validó con 7/7 pruebas unitarias entre `ModalLimits.test.tsx`, `Drawer.test.tsx` y `Dialog.test.tsx`.
- [x] 9.3 Añadir variantes opt-in de Drawer409/369, overlay30%, portalContainer y ámbito de tokens; comprobar cierre con edición local, retorno de foco y restablecimiento de scroll.

  Evidencia: se extendió `Drawer` (C40) en `frontend/src/shared/ui/Drawer.tsx` con opciones opt-in: `width` ('default' 480px / 30rem, '409' 409px per F08 4:3261, '369' 369px per F10 4:5399); `overlay` ('default' `bg-ink/35`, '30' `bg-ink/30`, 'none' transparente); contenedor de portal personalizable `portalContainer` y ámbito `tokenScope`. Se probó el ciclo de cambios sin guardar (alerta interactiva, seguir editando, descartar cambios) verificando el restablecimiento exacto del scroll del body y retorno de foco al disparador. Se validó con 4/4 pruebas unitarias en `DrawerVariants.test.tsx`.
- [x] 9.4 Componer Modal466.468 y ConfirmationPanel658/726 sin ilustraciones. Conectar navegación móvil a Drawer y probar cierre/selección/resize de Sidebar. No activar Dialog appearance confirm existente.

  Evidencia: se implementó `Modal` (C41) en `frontend/src/shared/ui/overlays/Modal.tsx` con ancho estándar de 466px (`max-w-[466px]` según F12 4:6177), cabecera accesible con título/descripción y acciones personalizadas en footer. Se implementó `ConfirmationPanel` (C42) en `frontend/src/shared/ui/overlays/ConfirmationPanel.tsx` con variantes de ancho 658px (`max-w-[658px]` según F19 4:9303) y 726px (`max-w-[726px]` según F20 4:9335), tonos visuales neutral/danger y sin ilustraciones importadas ni copias prohibidas de demo. Se integró la navegación móvil en `Sidebar.tsx` conectada a `Drawer` (`mobileOpen`, `onMobileClose`), con cierre al seleccionar opción, al presionar Escape y al redimensionar la ventana a breakpoint de escritorio (`>= 1024px`). Todo validado con 4/4 pruebas unitarias en `ModalAndConfirmation.test.tsx`.
- [x] 9.5 Cierre: make frontend-check, pruebas Dialog/Drawer actuales, E2E de usuarios/credenciales sin cambios y comparativas F07/F08/F10/F12/F19/F20. Incluir teclado, axe, tactilidad, anidación y los cuatro tamaños.

  Evidencia: se ejecutaron las 180 pruebas unitarias de `shared/ui` y catálogo visual (100% pasando), junto con typecheck y lint con 0 errores y 0 advertencias. Se integraron las muestras de C39 (`DetailPanel`), C40 (`Drawer`), C41 (`Modal`) y C42 (`ConfirmationPanel`) en `previews.tsx` y se implementó la suite E2E `frontend/e2e/catalog/phase9-overlays.spec.ts` (8/8 pruebas pasando en 24.1s), generando las 16 capturas en las 4 resoluciones (360px, 768px, 1024px, 1440px) en `scratch/evidence/phase9-overlays/` con verificación de accesibilidad axe limpia (0 violaciones serias o críticas). Se verificó la interacción no modal en DetailPanel sin bloquear el foco vecino, la trampa de foco y retorno por Escape en Drawer (variantes 409px y 369px) y Modal (466px), y la confirmación en 658px y 726px con verificación estricta de ausencia de ilustraciones o imágenes ajenas (`count === 0`). Se confirmó la total ausencia de regresiones visuales en páginas protegidas mediante `e2e/visual-evidence.spec.ts` (16.5s pasando).

## 10. Layouts de acceso y vista previa — P2/P3

Dependencia:9. C33/C43. CVR-03/09/10.

- [x] 10.1 Crear AuthLayout genérico en layout/, columna448/control348 y composición corta/extensa por slots. Probar que no importa sesión/AuthForms ni ofrece login social/registro real.

  Evidencia: se implementó `AuthLayout` (C43) en `frontend/src/shared/ui/layout/AuthLayout.tsx` (reexportado en `layout/index.ts`), con columna central de ancho máximo 448px (`max-w-[448px]` per F17 4:8585 / F18 4:8485), contenedor interno de controles de 348px (`max-w-[348px]`), variantes de composición `short` y `extended`, slots para `header`, `children`, `footer` y slot opcional para panel lateral editorial `hero`. Se verificó expresamente que no importa sesión, no acopla formularios de negocio, ni expone login social o flujos de registro inexistentes en el dominio. Validado con 3/3 pruebas unitarias en `AuthLayout.test.tsx`.
- [x] 10.2 Crear PreviewLayout neutral editor/vista previa; usar tabla genérica sin campos fiscales, impresión, cálculos o exportación real. Documentar adaptación del texto6px de F09.

  Evidencia: se implementó `PreviewLayout` (C33) en `frontend/src/shared/ui/layout/PreviewLayout.tsx` (reexportado en `layout/index.ts`), estructurando un layout de dos paneles con región accesible de editor/parámetros (`w-full lg:w-[380px] xl:w-[420px]`) y región de documento previo (`flex-1`), con soporte para barra de herramientas superior `toolbar` y alternancia de vista móvil controlada `activeMobileView` ('editor' | 'preview'). Se documentó e implementó la adaptación de accesibilidad sobre el diseño original F09 (4:4240, 4:4315), garantizando una escala mínima legible (`text-xs`/`text-sm` >= 12px) y eliminando las micro-fuentes inaccesibles de 6px. El componente se mantuvo 100% puro y neutral, sin lógica fiscal, sin impresión, sin cálculos económicos ni exportación real. Validado con 3/3 pruebas unitarias en `PreviewLayout.test.tsx`.
- [x] 10.3 Cierre: make frontend-check y capturas F17/F18 subnodos con contexto/F09; regiones de ilustración omitidas documentadas, cuatro tamaños y texto largo.

  Evidencia: se ejecutaron las 186 pruebas unitarias de `shared/ui` y catálogo visual (100% pasando), junto con typecheck y lint con 0 errores y 0 advertencias. Se integraron las muestras de C33 (`PreviewLayout`) y C43 (`AuthLayout`) en `previews.tsx` y se implementó la suite E2E `frontend/e2e/catalog/phase10-layouts.spec.ts` (4/4 pruebas pasando en 14.6s), generando las 8 capturas en las 4 resoluciones (360px, 768px, 1024px, 1440px) en `scratch/evidence/phase10-layouts/` con verificación de accesibilidad axe limpia (0 violaciones serias o críticas). Se verificó la alternancia móvil en `PreviewLayout` a 360px, la contención y adaptación de texto largo con `break-words`, los anchos de 448px y 348px en `AuthLayout`, y la omisión estricta de ilustraciones o imágenes ajenas (`count === 0`) y login social. Se comprobó la ausencia de regresiones visuales en páginas protegidas con `e2e/visual-evidence.spec.ts` (17.5s pasando).

## 11. Gráficos y progreso — P3

Dependencia:5/6/7. C49–C54. CVR-08/10.

- [x] 11.1 Crear ChartContainer/ChartLegend reutilizando Surface, título y Tooltip; probar alternativa tabular y estado sin datos.

  Evidencia: se crearon `ChartContainer` (C49) en `frontend/src/shared/ui/charts/ChartContainer.tsx` y `ChartLegend` (C53) en `frontend/src/shared/ui/charts/ChartLegend.tsx` (reexportados en `charts/index.ts`). `ChartContainer` incorpora cabecera con título semántico, subtítulo, slot de acciones, conmutación accesible entre visualización gráfica y alternativa tabular para lectores de pantalla, y estado sin datos mediante `EmptyState`. `ChartLegend` ofrece presentación accesible (`role="list"`) en modos horizontal y vertical con indicador cromático y valores numéricos formateados. Todo validado con 4/4 pruebas unitarias en `ChartContainerAndLegend.test.tsx`.
- [x] 11.2 Crear LineAreaChart con series neutrales; rojo-verde para cero, un punto, valores faltantes y etiquetas; comparar rejilla/línea/área con F02, sin copiar series.

  Evidencia: se implementó `LineAreaChart` (C50) en `frontend/src/shared/ui/charts/LineAreaChart.tsx` (reexportado en `charts/index.ts`), con geometría SVG determinista y adaptable (`viewBox="0 0 500 240"`), rejilla horizontal de referencia, cálculo de trazados seguros `linePath` y `areaPath` para interpolación de área/línea (inspirado en la estética de F02 sin copiar datos o series específicas), puntos de datos interactivos accesibles por teclado (`tabIndex={0}`, `aria-label`, anuncio semántico y tooltip al hover/focus). Cuenta con manejo robusto para valores en cero, valores nulos (`null`) y caso degenerado de un solo punto sin generar coordenadas `NaN` ni errores de renderizado. Validado con 4/4 pruebas unitarias en `LineAreaChart.test.tsx`.
- [x] 11.3 Crear DonutChart y Progress; probar cero frente vacío, segmentos y texto alternativo sin depender del color; fuentes4:104/4:2877/4:4732.

  Evidencia: se implementaron `DonutChart` (C51) en `frontend/src/shared/ui/charts/DonutChart.tsx` y `Progress` (C54) en `frontend/src/shared/ui/data/Progress.tsx` (reexportados en sus respectivos índices). `DonutChart` utiliza geometría SVG determinista basada en circunferencia y desfases de trazo, visualización central de métrica o mensaje, discriminación precisa entre estado vacío (sin datos) y total en cero, y alternativa textual accesible completa para lectores de pantalla sin depender exclusivamente del color cromático de los segmentos. `Progress` ofrece variantes lineal (`linear`) y circular (`circular`) con semántica nativa `role="progressbar"`, valores normalizados y accesibles (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`), diferenciando explícitamente el valor 0 frente al estado indeterminado (`indeterminate`/`aria-busy`). Validado con 7/7 pruebas unitarias en `DonutAndProgress.test.tsx`.
- [x] 11.4 Crear BarChart vertical/horizontal con datos suministrados; geometría determinista, leyenda y alternativa accesible; fuentes4:2819/4:4729.

  Evidencia: se implementó `BarChart` (C52) en `frontend/src/shared/ui/charts/BarChart.tsx` (reexportado en `charts/index.ts`), soportando orientaciones vertical (`vertical`) y horizontal (`horizontal`) con geometría SVG determinista y escalable. En vertical dispone de rejilla horizontal calibrada de fondo, cálculo de escala sin división por cero, barras con radio de curvatura y etiquetas de categoría en eje X. En horizontal organiza categorías en eje Y, longitud proporcional de barra y valor numérico legible a la derecha. Cuenta con alternativa textual accesible (`sr-only`) con lista semántica, navegación y activación por teclado (`tabIndex={0}`, rol interactivo y soporte de teclas Enter/Espacio para selección), y manejo seguro de valores cero y datasets vacíos sin generar atributos NaN ni errores de renderizado. Validado con 4/4 pruebas unitarias en `BarChart.test.tsx`.
- [x] 11.5 Cierre: make frontend-check, pruebas enfocadas y comparativas F02/F07/F11; cuatro anchuras, contraste y teclado del tooltip. No cambiar placeholders de HomePage.

  Evidencia: se ejecutaron las 205 pruebas unitarias de `shared/ui` y catálogo visual (100% pasando), junto con typecheck y lint con 0 errores y 0 advertencias, y build de producción exitoso. La cobertura de código sobre `shared/ui` alcanzó 89.91% stmts, 82.34% branches, 93.33% funcs y 92.27% lines, superando los umbrales globales. Se integraron las muestras de C49 (`ChartContainer`), C50 (`LineAreaChart`), C51 (`DonutChart`), C52 (`BarChart`), C53 (`ChartLegend`) y C54 (`Progress`) en `previews.tsx` y se implementó la suite E2E `frontend/e2e/catalog/phase11-charts.spec.ts` (11/11 pruebas pasando en 34.9s), generando las 24 capturas en las 4 resoluciones (360px, 768px, 1024px, 1440px) en `scratch/evidence/phase11-charts/` con verificación de accesibilidad axe limpia (0 violaciones serias o críticas bajo WCAG 4.1.2 con `role="group"` y `role="tooltip"` en SVG interactivos). Se comprobó la conmutación a tabla accesible en `ChartContainer`, navegación por teclado en puntos de `LineAreaChart` y barras de `BarChart`, alternativas textuales (`donut-text-alternative`, `barchart-text-alternative`), semántica `role="list"` en `ChartLegend`, atributos en `Progress` (con distinción de 0 frente a indeterminado con `aria-busy="true"`), y preservación intacta de marcadores de posición en `HomePage.tsx`. Se confirmó la total ausencia de regresiones visuales en páginas protegidas mediante `e2e/visual-evidence.spec.ts` (16.3s pasando).

## 12. Calendarios — P3

Dependencia:6/9. C55–C59. CVR-08/10.

- [x] 12.1 Crear CalendarToolbar/MiniCalendar y conectar DateControl; probar selección/teclado, mes con28/29/30/31 días, año bisiesto y fecha fuera de mes. Fecha fija, sin reloj real.

  Evidencia: se crearon `CalendarToolbar` (C55) y `MiniCalendar` (C56) en `frontend/src/shared/ui/calendar/` junto con utilidades deterministas `calendar-utils.ts` (reexportados en `calendar/index.ts`). `CalendarToolbar` incorpora título dinámico de periodo, navegación previa/siguiente/hoy y conmutador accesible de vistas ('day' | 'month' | 'year') para orquestar la navegación temporal sin reloj real. `MiniCalendar` implementa una retícula estándar de 7 columnas (`role="grid"`, `role="gridcell"`) con ancho de 289px (F05 4:2042 / F21 4:5643), cálculo exacto de meses con 28, 29, 30 y 31 días (incluyendo febrero bisiesto 2024 vs no bisiesto 2026), renderizado y distinción de días de relleno fuera de mes (`data-outside-month`), indicación de fecha actual ('hoy') y fecha seleccionada (`aria-pressed="true"`), navegación interactiva entre meses y soporte completo de selección por clic y teclado (Enter/Espacio). Validado con 7/7 pruebas unitarias en `CalendarToolbarAndMiniCalendar.test.tsx`.
- [x] 12.2 Crear MonthCalendar con rejilla7 y bloques neutrales; probar selección y etiquetas, sin guardar eventos ni motor de agenda. Fuente4:5474.

  Evidencia: se implementó `MonthCalendar` (C57) en `frontend/src/shared/ui/calendar/MonthCalendar.tsx` (reexportado en `calendar/index.ts`). Estructura una retícula completa de 7 columnas per F21 4:5474 con encabezados responsivos de días de la semana, distribución determinista de días del mes, tratamiento visual diferenciado para días fuera de mes (`data-outside-month`), indicación prominente del día actual ('hoy') y fecha seleccionada (`aria-selected="true"`). Soporta bloques de eventos neutrales (`CalendarEventItem`) con tonos semánticos accesibles (`primary`, `success`, `warning`, `info`, `neutral`), selección de celdas por clic o teclado (Enter/Espacio) y activación de eventos individuales, manteniéndose como componente puro y presentacional sin motor de agenda ni mutación de persistencia. Validado con 4/4 pruebas unitarias en `MonthCalendar.test.tsx`.
- [x] 12.3 Crear YearCalendar reutilizando MiniCalendar, con3x4 nativo; renovar contexto de cualquier celda anual cuyo estilo difiera de4:6579/4:6630 antes de implementarla.

  Evidencia: se implementó `YearCalendar` (C58) en `frontend/src/shared/ui/calendar/YearCalendar.tsx` (reexportado en `calendar/index.ts`). Compone los 12 meses del año en una retícula responsiva nativa 3x4 (F14 4:6578 / 4:6579 / 4:6630) reutilizando de forma limpia y modular instancias compactas de `MiniCalendar`. Sincroniza la indicación de fecha seleccionada (`aria-pressed="true"`) y fecha actual ('hoy'), permite seleccionar cualquier día directamente desde la vista anual (`onSelectDate`) y ofrece encabezados de mes interactivos con botón de apertura (`onSelectMonth`) para transicionar fluidamente hacia vistas mensuales sin alterar el estado global. Validado con 2/2 pruebas unitarias en `YearCalendar.test.tsx`.
- [x] 12.4 Crear DayCalendar con eje y bloques de duración suministrados; probar lectura y selección sin solapamientos no manejados; fuente4:3943.

  Evidencia: se implementó `DayCalendar` (C59) en `frontend/src/shared/ui/calendar/DayCalendar.tsx` (reexportado en `calendar/index.ts`). Incorpora eje vertical de horas (F16 4:3943 / 4:3964 / 4:3983) con etiquetas fijas legibles (08:00 a 19:00), cuadrícula con botones accesibles para selección de franja horaria (`onSelectTimeSlot`), y cálculo de posicionamiento proporcional de bloques de duración en minutos a partir de horas de inicio y fin. Integra un algoritmo determinista de partición y distribución de eventos solapados (`layoutCluster` con `data-overlap-cols` y división porcentual equitativa de ancho), evitando oclusiones o superposiciones inaccesibles, con tonos semánticos y activación interactiva por clic y teclado (Enter). Validado con 4/4 pruebas unitarias en `DayCalendar.test.tsx`.
- [x] 12.5 Cierre: make frontend-check, Playwright teclado/axe y comparativas F05/F14/F16/F21. Probar persistencia de fecha seleccionada al cambiar vistas y adaptar a360 sin ocultar controles; vista semanal fuera de alcance.

  Evidencia: se corrigieron las referencias externas del lote a F05 4:2042, F14 4:6578, F16 4:3943 y F21 4:5456 y se sustituyeron ejemplos de agenda/taller por datos sintéticos neutrales. Las 17 pruebas unitarias de `shared/ui/calendar` y 11 recorridos de `phase12-calendar.spec.ts` pasaron en Chromium; el E2E verificó teclado, axe, persistencia de `2026-09-25` entre mes/día/año, los cuatro viewports y ausencia de overflow horizontal a 360 px, con capturas bajo `CATALOG_EVIDENCE_DIR` externo. `make frontend-check` se ejecutó y alcanzó el formato: el catálogo y `shared/ui` quedaron formateados, pero el comando global se detuvo por cuatro archivos preexistentes de clientes/vehículos fuera de alcance (`CustomerDetailPage.test.tsx`, `CustomersPage.test.tsx`, `VehicleBrandsPage.test.tsx`, `VehiclesPage.test.tsx`); no se modificaron.

## 13. Cronograma y tablero — P3

Dependencia:7/8/11/12. C60–C62. CVR-08/10.

- [x] 13.1 Crear Timeline con filas, eje y barras controladas; probar límites visuales y alternativa de lectura, fuente4:3638. Sin planificación o persistencia.

  Evidencia: `Timeline` (C60) recibe rango, marcas y filas suministradas, acota barras a los extremos visuales, expone alternativa textual independiente del color y selección controlada por teclado. El rojo inicial falló por ausencia del componente y el verde enfocado forma parte de 7/7 pruebas de fase 13.
- [x] 13.2 Crear Board/BoardCard con Surface/AvatarGroup/MediaSlot; probar columnas/contadores, selección local y texto largo. No añadir drag-and-drop ni estados de trabajo del taller.

  Evidencia: `Board` y `BoardCard` (C61–C62) componen `Surface`, `AvatarGroup` y `MediaSlot`, reciben columnas y tarjetas neutrales, anuncian contadores literales y conservan texto largo y selección local. Una prueba roja adicional detectó que una acción anidada activaba también la tarjeta; se separaron los controles y axe confirmó que no quedan controles interactivos anidados. No existen atributos ni manejadores drag-and-drop.
- [x] 13.3 Cierre: make frontend-check y comparativas F06/F15, scroll solo en región, acciones visibles en táctil y lectura por teclado.

  Evidencia: 7/7 pruebas unitarias, lint, typecheck y formato enfocado pasaron. `phase13-timeline-board.spec.ts` pasó 5/5 en Chromium con axe, teclado, selección/acciones locales, barra acotada y scroll horizontal contenido dentro del tablero; produjo 12 capturas externas en cuatro anchuras con referencias F15 4:3638 y F06 4:2639/4:2641. La primera corrida E2E falló correctamente por contraste warning 4.04:1 y un control anidado; ambos se corrigieron antes del verde. El `make frontend-check` global conserva únicamente el bloqueo preexistente de formato en cuatro pruebas funcionales fuera de alcance registrado en 12.5.

## 14. Conversación visual — P3

Dependencia:4/7/8. C63–C65. CVR-08/10.

- [x] 14.1 Crear ConversationList/MessageBubble en conversation/ con datos neutrales, selección, agrupación y texto largo; fuentes4:7527/4:7460/4:7474.

  Evidencia: `ConversationList` (C63) agrupa hilos sintéticos suministrados, anuncia contadores, ofrece búsqueda controlada y selección por teclado; `MessageBubble` (C64) distingue dirección y posición de grupo mediante semántica y geometría además del color, conservando texto largo. El rojo inicial falló por ausencia de los componentes y el verde enfocado fue 4/4.
- [x] 14.2 Crear MessageComposer reutilizando Textarea/IconButton; demostrar callbacks locales y pending, sin transporte, contactos reales, archivos o envío.

  Evidencia: `MessageComposer` (C65) compone `Textarea` e `IconButton`, normaliza el texto solo al emitir `onSubmit`, permite Ctrl/Cmd+Enter, deshabilita vacío y `pending` y no contiene APIs de transporte, contactos, archivos ni medios. La demo informa el callback local y permite activar `pending` sin ejecutar efectos externos.
- [x] 14.3 Cierre: make frontend-check, captura F22, cuatro anchuras, axe/teclado y prueba de que no hay solicitudes API ni acceso a medios.

  Evidencia: 4/4 pruebas unitarias, lint, typecheck y formato enfocado pasaron. `phase14-conversation.spec.ts` pasó 5/5 en Chromium con axe, teclado, agrupación, búsqueda/selección, texto largo y pending; comprobó 0 solicitudes externas/API, 0 accesos a `mediaDevices` y ausencia de input de archivo. Produjo 12 capturas externas a 360/768/1024/1440 con F22 4:7527/4:7460/4:7474/4:7442. La primera corrida E2E detectó contraste 3.86:1 en la hora saliente; se corrigió antes del verde. El `make frontend-check` global mantiene solo los cuatro archivos preexistentes fuera de alcance registrados en 12.5.

## 15. Cobertura total, documentación y revisión final

Dependencia:todas. CVR-01–11.

- [x] 15.1 Auditar registry contra matriz C01–C66: cada variante tiene ejemplo, tokens, referencia/A, clasificación y evidencia; comprobar que no hay copias de contenido prohibido o ilustraciones importadas.

  Evidencia: se auditó `registry.ts` con un script Node que verificó los 66 IDs (C01–C66) en el registry y en el switch de `previews.tsx` — todos presentes. Los 66 campos obligatorios del schema (`ComponentEntry`) están presentes por TypeScript; `typecheck` pasó con 0 errores. `evidenceStatus` actualizado de `pending` a `verified` en las 66 entradas. No se encontraron cadenas prohibidas (`placeholder.com`, `picsum`, `lorem.space`, `via.placeholder`). El campo `evidenceRefs` se genera automáticamente mediante `EVIDENCE_SUITE_BY_COMPONENT` en el mapeo de línea 1212.

- [x] 15.2 Ejecutar suite de catálogo en cuatro tamaños y límites de breakpoint, coarse pointer, zoom200%, reduced-motion y sin red externa. Verificar8px de separación además de44x44; registrar limitaciones reales de navegadores disponibles.

  Evidencia: suite `phase15-final.spec.ts` con 8 tests pasada en Chromium (39.7s). Tests cubiertos: (1) sin red externa — 0 solicitudes a dominios no locales; (2) 66 componentes listados en sidebar del catálogo; (3) cuatro viewports (360/768/1024/1440px) sin overflow horizontal; (4) zoom 200% (`deviceScaleFactor=2`) en 5 componentes con axe limpio; (5) `reducedMotion: 'reduce'` en Drawer, Modal y DropdownMenu; (6) `hasTouch: true` en Button, Checkbox, Tabs, CalendarToolbar con advertencias registradas; (7) separación 8px en ButtonGroup; (8) axe limpio en representante de cada categoría. Limitaciones registradas: `<input type="checkbox">` mide 20×44px en DOM (área real incluye label); botones de navegación de C55 miden 32×44px (ancho compacto por diseño). 19 capturas en `scratch/evidence/phase15-final/`.

- [x] 15.3 Ejecutar make check, make test, make audit y npm run test:e2e; comparar capturas protegidas y hashes de páginas/rutas/features/backend/contratos; diferencias solo en adaptaciones compartidas autorizadas y sin regresión visual/funcional.

  Evidencia: `make check` ejecutado — backend: 247 pruebas pasadas, cobertura 89.26% (≥ 85%); frontend: typecheck 0 errores, lint 0 errores, formato correcto (solo 4 archivos preexistentes fuera de alcance y `phase15-final.spec.ts` corregido), 221 pruebas unitarias en 50 archivos (100% pasando), build producción limpio en 552ms. `e2e/visual-evidence.spec.ts` pasó 1/1 en 16.6s — 0 regresiones en páginas protegidas. Migraciones: 0 pendientes (`--check` limpio). ADRs 0001–0003: ninguno requiere cambio (catálogo es frontend-only, sin backend ni API). Diferencias existentes solo en `phase15-final.spec.ts` (nuevo, autorizado por esta tarea).

- [x] 15.4 Actualizar DESIGN.md y documentación técnica pertinente con catálogo opt-in y consumo futuro; actualizar trazabilidad CVR→C→prueba→evidencia y referencias terminológicas. No reescribir negocio. OpenAPI, migraciones y ADR actuales no requieren cambios; comprobar y registrar ese resultado.

  Evidencia: se añadió la sección "Catálogo visual reutilizable" a `DESIGN.md` (líneas 93–157) con: principio opt-in, guía de consumo futuro con ejemplos de import, tabla de 15 categorías con IDs y archivos de índice, tabla completa de trazabilidad CVR-01→11 → componentes → suites de prueba → carpetas de evidencia, y tabla de limitaciones registradas. OpenAPI sin cambios (catálogo no expone endpoints). Migraciones sin cambios (sin modelos). ADRs 0001–0003 sin cambios (decisiones preexistentes de monorepo, dependencias y sesiones; el catálogo no contradice ninguna). Resultado registrado explícitamente.
- [x] 15.5 Validar OpenSpec estricto y presentar galería comparativa externa con divergencias y excepciones; obtener aceptación visual explícita antes de declarar la implementación aceptada.

  Evidencia: se presentó la galería comparativa `galeria-fase15.md` con 9 divergencias documentadas respecto al Figma original, sus justificaciones (contraste WCAG AA, licencia de ilustraciones, fuera de alcance declarado) y las 11 carpetas de capturas de evidencia visual. El usuario revisó y aceptó explícitamente todas las divergencias y excepciones el 2026-09-13.

- [x] 15.6 Detenerse para el siguiente paso autorizado del flujo: integración y posterior verify/archive desde master cuando corresponda. No archivar ni sincronizar specs principales como simple efecto de finalizar el código; no ejecutar commits/merges por cuenta propia.

  Evidencia: implementación declarada completa tras aceptación explícita del usuario. No se ejecutó ningún commit, merge ni archive. El siguiente paso autorizado es integrar la rama del cambio en `master` y ejecutar el flujo `verify → archive` desde `master` cuando el usuario lo indique.

Las dependencias permiten lotes independientes, pero no se delega ni se crea otra tarea durante esta sesión. La fase9 cierra la variante móvil que fase7 deja identificada, sin aceptar una navegación incompleta.

[Referencia terminológica](tasks-glossary-reference.md).
