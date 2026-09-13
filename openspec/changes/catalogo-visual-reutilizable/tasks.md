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
- [ ] 1.3 Ejecutar make frontend-check y E2E actuales como línea base; registrar bloqueos de entorno sin atribuirlos al catálogo. Obtener capturas protegidas de acceso, inicio, usuarios, auditoría, clientes y vehículos.
- [ ] 1.4 Registrar checksum de frontend/src/app, pages, features, shared/styles/index.css, backend, contratos y lockfiles. Crear fuera del repo registro de evidencia y referencias escala1, excluyendo contenido de plantilla de los ejemplos.

## 2. Entrada aislada, registro y tokens — P0

Dependencia:1. CVR-01/02/03/11. Infraestructura, no componente adicional contado.

- [ ] 2.1 Probar primero acceso independiente y ausencia de llamadas API; crear frontend/visual-catalog.html y frontend/src/dev/visual-catalog/main.tsx con guard DEV, sin tocar App.tsx ni rutas.
- [ ] 2.2 Crear registry.ts con C01–C66, F01–F22, variantes, E/A, fuentes y estado de evidencia; probar búsquedas, selección de ejemplo y reset determinista. CatalogApp.tsx debe permitir captura aislada.
- [ ] 2.3 Crear shared/ui/catalog-tokens.css con scope y reutilización de tokens existentes. Probar que montar/desmontar demo no altera estilos fuera del scope; no editar shared/styles/index.css.
- [ ] 2.4 Añadir frontend/playwright.catalog.config.ts y e2e/catalog/isolation.spec.ts que sirvan Vite sin Django. Probar build sin entrada/fixtures/chunks de demo y funcionamiento sin red externa.
- [ ] 2.5 Comparar paleta/escala con nodos de K1–K8 y registrar excepciones tipográficas y breakpoints A. Cierre: make frontend-check, isolation.spec.ts y evidencia de dist.

## 3. Iconos y acciones — P1

Dependencia:2. C01–C04. CVR-02/05/10.

- [ ] 3.1 C01: cotejar category/document/chart existentes con F01; crear mapa en shared/ui/icons/ con IDs y nombres accesibles. Solo exportar iconos genéricos faltantes, nunca logos o ilustraciones. Verificar dimensiones y funcionamiento offline.
- [ ] 3.2 C02: pruebas busy/disabled/ref y defaults; variantes opt-in 40/50 y tonos en shared/ui/actions/, reutilizando Button de controls.tsx. No alterar consumidores.
- [ ] 3.3 C03–C04: adaptar IconButton y reexportar ButtonGroup; probar nombre, agrupación, foco, objetivo44x44 y gap8 con puntero grueso.
- [ ] 3.4 Cierre: pruebas enfocadas + make frontend-check; capturas F03 4:1017/F08 4:3292/4:3297, cuatro anchuras, axe y regresión de botones actuales.

## 4. Campos y controles — P1

Dependencia:3. C05–C12. CVR-05/10.

- [ ] 4.1 C05/C09: reusar Field/FieldError en shared/ui/forms/; probar asociación de etiqueta/ayuda/error y valor conservado con ejemplos neutros.
- [ ] 4.2 C06–C08: probar y añadir variantes opt-in Input/Select/Checkbox con radios5/10 y estados relevantes; incluir mixed, disabled y navegación nativa. Comparar4:3264/4:5431/4:5420.
- [ ] 4.3 C10: Textarea reutilizando contrato de campo, multilinea, error y ref; probar texto largo/redimensionado sin desbordamiento. Referencia4:5412.
- [ ] 4.4 C11–C12: PasswordInput y SearchInput como composiciones; probar visibilidad local, limpieza, foco y conservación de texto. Sin importar AuthForms o búsqueda de páginas.
- [ ] 4.5 Cierre: pruebas de forms, make frontend-check y comparativas F08/F10/subnodos F17 con teclado, axe y cuatro tamaños.

## 5. Feedback, avatar y superficies primitivas — P1

Dependencia:4. C18/C19/C21/C24/C26/C37/C44–C48. CVR-06/09/10.

- [ ] 5.1 Reexportar PageHeader/Toolbar/Surface; probar composiciones y nombres/teclado sin copiar implementaciones ni usar clases de páginas.
- [ ] 5.2 Crear Avatar neutral y Divider en shared/ui/media/ y surfaces/; tamaños36/70/134 y45x43 por fuente. No importar fotos o ilustraciones.
- [ ] 5.3 Adaptar StatusBadge opt-in: píldora/rectángulo y categoría no anunciada como resultado; probar color redundante, texto accesible y contraste. FiscalScopeBadge permanece intacto.
- [ ] 5.4 Reusar LoadingState/EmptyState/InlineNotice; componer ErrorState/SuccessState/NoResultsState en feedback/. Probar vacío inicial distinto de sin coincidencias, limpiar/reintentar y reduced-motion.
- [ ] 5.5 Cierre: make frontend-check, referencias F03/F07/F17 para geometrías observadas y baselines A para feedback; comprobar regresión de shared/ui/states.test.tsx.

## 6. Menús, pestañas y selección — P2

Dependencia:3–5. C13–C17/C20. CVR-04/05/07.

- [ ] 6.1 Crear DateControl y componer MiniCalendar provisional solo cuando exista fase12; inicialmente control de fecha nativo sin placeholder de comportamiento. Probar valor/callback/label; fuente4:222/4:4424. El selector compacto se conecta en12.1.
- [ ] 6.2 Crear SegmentedControl y Tabs en navigation/; probar selección única, panel asociado, flechas/Home/End según rol, disabled y foco; referencias4:6195/4:6443.
- [ ] 6.3 Crear Tooltip accesible en overlays/, visible por foco/puntero y cerrable; fuente4:157. No depender de tooltip para nombrar acción crítica.
- [ ] 6.4 Crear DropdownMenu en overlays/, apertura/cierre/foco/teclado, acciones normales/destructivas; referencia4:1497. Adaptar FilterPanel mediante composición, sin .list-page.
- [ ] 6.5 Cierre: pruebas unitarias y Playwright de teclado, make frontend-check, comparativas F04/F06/F12/F13 y táctil44/gap8; registrar estados A.

## 7. Navegación y composiciones generales — P2

Dependencia:6 y overlay móvil de9 antes de declarar completa la variante móvil. C22/C23/C25/C27–C32/C66. CVR-04/06.

- [ ] 7.1 Crear Sidebar/NavigationItem/AppFrame puros en navigation/ y layout/ con80/218 y activo; pruebas de selección y ausencia de permisos/rutas internas. No extraer AuthenticatedShell.
- [ ] 7.2 Adaptar MetricCard desde StatCard y crear DashboardLayout; probar116/icono60/valor22 y retícula por F01/F02. No tocar HomePage.
- [ ] 7.3 Componer DetailCard, AvatarGroup y MediaSlot neutrales con Surface/Avatar; probar contenido extenso y accesibilidad de grupos, sin assets demo.
- [ ] 7.4 Crear MasterDetailLayout y FormLayout por slots, con una/dos columnas y orden de lectura; referencias F07/F09. No importar formularios de features.
- [ ] 7.5 Cierre desktop/tableta: make frontend-check y comparativas F01/F02/F07/F09. Registrar móvil de Sidebar pendiente hasta9.4; no dar por terminada esa variante.

## 8. Datos tabulares y listas — P2

Dependencia:7. C34–C36/C38. CVR-06/10.

- [ ] 8.1 Probar primero defaults de ElevatedDataList y ResponsiveDataView; adaptar DataTable en shared/ui/data/ para filas70/60/tabla contenida mediante variantes, sin duplicar representación.
- [ ] 8.2 Probar y añadir selección/indeterminado y orden controlados, aria-sort, claves estables y callbacks; sin API ni ordenamiento de dinero.
- [ ] 8.3 Componer DataList agrupada/móvil, Pagination y RowActions existentes; probar texto largo, total0/1, límites y menú de acciones. No modificar páginas de usuarios, auditoría, clientes o vehículos.
- [ ] 8.4 Cierre: make frontend-check, pruebas actuales de layout y E2E de listas; capturas F03/F05/F07/F13 y vista móvil A sin scroll de página.

## 9. Paneles, drawer y modal — P2

Dependencia:4/6/7. C39–C42 y finalización móvil C27/C29. CVR-07/10.

- [ ] 9.1 Crear DetailPanel persistente302; probar que no bloquea foco del contenido vecino, referencia4:2806.
- [ ] 9.2 Probar primero límites actuales de foco/portal/scroll de Drawer y Dialog, incluidos anidación y ausencia de controles. Compartir internamente mecánica cuando corresponda, manteniendo defaults y APIs anteriores.
- [ ] 9.3 Añadir variantes opt-in de Drawer409/369, overlay30%, portalContainer y ámbito de tokens; comprobar cierre con edición local, retorno de foco y restablecimiento de scroll.
- [ ] 9.4 Componer Modal466.468 y ConfirmationPanel658/726 sin ilustraciones. Conectar navegación móvil a Drawer y probar cierre/selección/resize de Sidebar. No activar Dialog appearance confirm existente.
- [ ] 9.5 Cierre: make frontend-check, pruebas Dialog/Drawer actuales, E2E de usuarios/credenciales sin cambios y comparativas F07/F08/F10/F12/F19/F20. Incluir teclado, axe, tactilidad, anidación y los cuatro tamaños.

## 10. Layouts de acceso y vista previa — P2/P3

Dependencia:9. C33/C43. CVR-03/09/10.

- [ ] 10.1 Crear AuthLayout genérico en layout/, columna448/control348 y composición corta/extensa por slots. Probar que no importa sesión/AuthForms ni ofrece login social/registro real.
- [ ] 10.2 Crear PreviewLayout neutral editor/vista previa; usar tabla genérica sin campos fiscales, impresión, cálculos o exportación real. Documentar adaptación del texto6px de F09.
- [ ] 10.3 Cierre: make frontend-check y capturas F17/F18 subnodos con contexto/F09; regiones de ilustración omitidas documentadas, cuatro tamaños y texto largo.

## 11. Gráficos y progreso — P3

Dependencia:5/6/7. C49–C54. CVR-08/10.

- [ ] 11.1 Crear ChartContainer/ChartLegend reutilizando Surface, título y Tooltip; probar alternativa tabular y estado sin datos.
- [ ] 11.2 Crear LineAreaChart con series neutrales; rojo-verde para cero, un punto, valores faltantes y etiquetas; comparar rejilla/línea/área con F02, sin copiar series.
- [ ] 11.3 Crear DonutChart y Progress; probar cero frente vacío, segmentos y texto alternativo sin depender del color; fuentes4:104/4:2877/4:4732.
- [ ] 11.4 Crear BarChart vertical/horizontal con datos suministrados; geometría determinista, leyenda y alternativa accesible; fuentes4:2819/4:4729.
- [ ] 11.5 Cierre: make frontend-check, pruebas enfocadas y comparativas F02/F07/F11; cuatro anchuras, contraste y teclado del tooltip. No cambiar placeholders de HomePage.

## 12. Calendarios — P3

Dependencia:6/9. C55–C59. CVR-08/10.

- [ ] 12.1 Crear CalendarToolbar/MiniCalendar y conectar DateControl; probar selección/teclado, mes con28/29/30/31 días, año bisiesto y fecha fuera de mes. Fecha fija, sin reloj real.
- [ ] 12.2 Crear MonthCalendar con rejilla7 y bloques neutrales; probar selección y etiquetas, sin guardar eventos ni motor de agenda. Fuente4:5474.
- [ ] 12.3 Crear YearCalendar reutilizando MiniCalendar, con3x4 nativo; renovar contexto de cualquier celda anual cuyo estilo difiera de4:6579/4:6630 antes de implementarla.
- [ ] 12.4 Crear DayCalendar con eje y bloques de duración suministrados; probar lectura y selección sin solapamientos no manejados; fuente4:3943.
- [ ] 12.5 Cierre: make frontend-check, Playwright teclado/axe y comparativas F05/F14/F16/F21. Probar persistencia de fecha seleccionada al cambiar vistas y adaptar a360 sin ocultar controles; vista semanal fuera de alcance.

## 13. Cronograma y tablero — P3

Dependencia:7/8/11/12. C60–C62. CVR-08/10.

- [ ] 13.1 Crear Timeline con filas, eje y barras controladas; probar límites visuales y alternativa de lectura, fuente4:3638. Sin planificación o persistencia.
- [ ] 13.2 Crear Board/BoardCard con Surface/AvatarGroup/MediaSlot; probar columnas/contadores, selección local y texto largo. No añadir drag-and-drop ni estados de trabajo del taller.
- [ ] 13.3 Cierre: make frontend-check y comparativas F06/F15, scroll solo en región, acciones visibles en táctil y lectura por teclado.

## 14. Conversación visual — P3

Dependencia:4/7/8. C63–C65. CVR-08/10.

- [ ] 14.1 Crear ConversationList/MessageBubble en conversation/ con datos neutrales, selección, agrupación y texto largo; fuentes4:7527/4:7460/4:7474.
- [ ] 14.2 Crear MessageComposer reutilizando Textarea/IconButton; demostrar callbacks locales y pending, sin transporte, contactos reales, archivos o envío.
- [ ] 14.3 Cierre: make frontend-check, captura F22, cuatro anchuras, axe/teclado y prueba de que no hay solicitudes API ni acceso a medios.

## 15. Cobertura total, documentación y revisión final

Dependencia:todas. CVR-01–11.

- [ ] 15.1 Auditar registry contra matriz C01–C66: cada variante tiene ejemplo, tokens, referencia/A, clasificación y evidencia; comprobar que no hay copias de contenido prohibido o ilustraciones importadas.
- [ ] 15.2 Ejecutar suite de catálogo en cuatro tamaños y límites de breakpoint, coarse pointer, zoom200%, reduced-motion y sin red externa. Verificar8px de separación además de44x44; registrar limitaciones reales de navegadores disponibles.
- [ ] 15.3 Ejecutar make check, make test, make audit y npm run test:e2e; comparar capturas protegidas y hashes de páginas/rutas/features/backend/contratos; diferencias solo en adaptaciones compartidas autorizadas y sin regresión visual/funcional.
- [ ] 15.4 Actualizar DESIGN.md y documentación técnica pertinente con catálogo opt-in y consumo futuro; actualizar trazabilidad CVR→C→prueba→evidencia y referencias terminológicas. No reescribir negocio. OpenAPI, migraciones y ADR actuales no requieren cambios; comprobar y registrar ese resultado.
- [ ] 15.5 Validar OpenSpec estricto y presentar galería comparativa externa con divergencias y excepciones; obtener aceptación visual explícita antes de declarar la implementación aceptada.
- [ ] 15.6 Detenerse para el siguiente paso autorizado del flujo: integración y posterior verify/archive desde master cuando corresponda. No archivar ni sincronizar specs principales como simple efecto de finalizar el código; no ejecutar commits/merges por cuenta propia.

Orden para GPT-5.6 Sol: 1→2→3→4→5→6→7→8→9→10→11→12→13→14→15. Las dependencias permiten lotes independientes, pero no se delega ni se crea otra tarea durante esta sesión. La fase9 cierra la variante móvil que fase7 deja identificada, sin aceptar una navegación incompleta.

[Referencia terminológica](tasks-glossary-reference.md).
