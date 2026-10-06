## 1. Preparación y trazabilidad

Base: propuesta, specs y diseño aprobados y registrados en `master` (`60929e2`, `0d94dcf`). Tareas aprobadas por el usuario el 2026-10-06 mediante «haz commit y continúa», que autoriza registrarlas en `master` y aplicarlas. Son archivos nuevos previstos por el diseño: `backend/src/home/`, `backend/tests/home/`, los `home_summary.py` de cada módulo, `frontend/src/features/home/`, los bloques de `frontend/src/pages/home/`, `StatLink.tsx`, `MiniBarChart.tsx` y `docs/negocio/requisitos/cobertura-pagina-de-inicio.md`. Las demás rutas citadas existen en el repositorio inspeccionado.

Cada tarea de comportamiento sigue **TDD**: prueba que falla por la razón esperada → implementación mínima → refactorización → repetir la prueba. Las pruebas se ejecutan **focalizadas** en lo que toca cada grupo, no la suite completa. Los comandos de backend se ejecutan desde `backend` con `uv run`, los de npm desde `frontend` y `make` desde la raíz. No se añaden dependencias ni se modifican `uv.lock` o `package-lock.json`. Este cambio no crea tablas ni migraciones.

- [x] 1.1 Comprobar Git y que propuesta, specs y diseño aprobados están en `master`; preservar cambios ajenos. Evidencia: `git status --short` y revisión del historial; no empezar si falta el registro.
- [x] 1.2 Crear `docs/negocio/requisitos/cobertura-pagina-de-inicio.md` y su referencia de glosario con los 47 escenarios (41 de `pagina-de-inicio` y 6 de `sistema-visual-frontend`), identificados por requisito y nombre, con columnas de tarea, prueba y resultado pendiente. Cierre: ningún escenario omitido ni declarado cumplido sin evidencia.
- [x] 1.3 Confirmar los comandos oficiales y la base de pruebas leyendo `README.md`, `Makefile` y la configuración de cobertura; identificar las fixtures reutilizables de `backend/tests/sales`, `tests/workshop`, `tests/proformas` y `tests/workshop_configuration`. Evidencia: una prueba existente de cada carpeta ejecutada en verde.

Criterio de grupo: registro comprobado y cobertura pendiente trazable; `openspec validate redisenar-pagina-de-inicio --strict` pasa.

## 2. Ventas: filtros y lecturas del resumen comercial

Cubre diseño D1, D4, D5 y D6; requisitos «Pendientes con acceso a su lista», «Saldos por cobrar separados por entidad fiscal» y «Cobros de los últimos siete días por entidad fiscal» en su parte comercial.

- [x] 2.1 Probar y añadir a las cuentas por cobrar comerciales (`backend/src/sales/application/reads.py`, `api/views.py`, `api/serializers.py`) los filtros opcionales `condition` y `only_debt`, extrayendo a una función el filtro «contado con saldo». Cierre: sin los filtros el resultado es idéntico al actual; valor de `condition` no válido rechazado con error de campo; una venta que solo tiene exceso por reembolsar queda fuera con `only_debt`.
- [x] 2.2 Crear `backend/src/sales/application/home_summary.py` con el conteo de ventas de contado sin cobrar, reutilizando la función de 2.1. Pruebas con los escenarios «Venta de contado con cobro interrumpido» y «Contado cubierto con retención». Cierre: el conteo coincide con `total_count` de la lista filtrada.
- [x] 2.3 Añadir a `home_summary.py` el conteo de ventas en borrador y de retenciones comerciales por completar, compartiendo el filtro con `list_sales` y `pending_vouchers`. Cierre: coincidencia con ambas listas probada.
- [x] 2.4 Añadir el saldo comercial por cobrar y el número de clientes con deuda. Pruebas con «Retención que reduce el saldo», «Reembolso pendiente» y «Sin deuda». Cierre: el saldo iguala `receivable_total` de las cuentas por cobrar sin filtros; importes en `Decimal`.
- [x] 2.5 Añadir los cobros comerciales por día de los últimos siete días con el reloj del negocio recibido como dato. Pruebas con «Siete días con un día sin cobros», «Cobro cerca de la medianoche», «Pago con retención» y «Pago anulado». Cierre: siempre siete días, ceros incluidos, sin retenciones ni pagos corregidos.
- [x] 2.6 Ampliar `backend/tests/sales/test_boundaries.py` para que `home_summary` use solo modelos de ventas y contratos públicos. Cierre: prueba de fronteras en verde.

Dependencias: grupo 1. Evidencia: `uv run --frozen pytest tests/sales/ -k "home_summary or receivables or boundaries"`, con rojo y verde anotados por tarea en la cobertura.

## 3. Taller: filtros y lecturas del resumen artesanal

Cubre diseño D1, D4, D5 y D6; los mismos requisitos del grupo 2 en su parte artesanal y «Mantenimientos abiertos».

- [x] 3.1 Probar y añadir a `list_orders` (`backend/src/workshop/application/queries.py` y su vista) el valor `state=OPEN`, que reúne `REGISTERED` y `REOPENED` mediante `OPEN_STATES`. Cierre: los demás valores se comportan igual; el mensaje de estado no válido incluye `OPEN`.
- [x] 3.2 Probar y añadir a las cuentas por cobrar artesanales el filtro opcional `condition`, extrayendo el filtro «contado con saldo». Cierre: sin el filtro el resultado es idéntico al actual.
- [x] 3.3 Crear `backend/src/workshop/application/home_summary.py` con órdenes abiertas, servicios de contado sin cobrar y retenciones artesanales por completar, compartiendo cada filtro con su lista. Pruebas con el escenario «Mantenimientos abiertos» usando los estados existentes. Cierre: los tres conteos coinciden con sus listas.
- [x] 3.4 Añadir el saldo artesanal por cobrar y el número de clientes con deuda. Cierre: el saldo iguala el total de `artisan_receivables` sin filtros.
- [x] 3.5 Añadir los cobros artesanales por día de los últimos siete días. Pruebas con «Efectivo y transferencia combinados» y los bordes de fecha. Cierre: mismas garantías que 2.5.
- [x] 3.6 Añadir la prueba de fronteras del taller para `home_summary`. Cierre: no importa modelos de ventas ni de proformas.

Dependencias: grupo 1. Evidencia: `uv run --frozen pytest tests/workshop/ -k "home_summary or receivables or list_orders or boundaries"`.

## 4. Proformas y configuración: lecturas restantes

Cubre diseño D4 y D7; escenarios de proformas por vencer, borradores, calificación artesanal y entidad que no registra retenciones.

- [x] 4.1 Probar y añadir a `list_proformas` (`backend/src/proformas/application/queries.py` y su vista) el filtro opcional `expires_within_days`, calculado con `clock.today()`. Cierre: valores negativos o no numéricos rechazados; sin el filtro, resultado idéntico.
- [x] 4.2 Crear `backend/src/proformas/application/home_summary.py` con proformas por vencer (hoy o mañana) y borradores, compartiendo los filtros con la lista. Pruebas con «Proformas que vencen hoy o mañana». Cierre: coincidencia con la lista probada.
- [x] 4.3 Añadir en `backend/src/workshop_configuration/` una función pública de lectura del aviso de la calificación artesanal que devuelva fecha de fin, días restantes y si está vencida, con la constante existente de 60 días y sin cambiar `qualification_days_left`. Pruebas a 45, 60 y 61 días, el día del vencimiento y ya vencida. Cierre: la advertencia de la configuración conserva su comportamiento y sus pruebas.
- [x] 4.4 Exponer como lectura pública si cada entidad registra retenciones, reutilizando `withholding_settings`. Cierre: prueba con entidad activada y desactivada.

Dependencias: grupo 1. Evidencia: `uv run --frozen pytest tests/proformas/ tests/workshop_configuration/ -k "home_summary or expires or qualification or withholding_settings"`.

## 5. Módulo `home`: composición, permisos y contrato

Cubre diseño D1, D2, D3 y D5; requisitos «Resumen de inicio limitado por permisos efectivos» y «Resumen calculado y de solo lectura».

- [x] 5.1 Crear `backend/src/home/` (`apps.py`, `application/`, `api/`) sin modelos ni migraciones, registrarlo en la configuración e incluir `home/` en `backend/src/config/api/urls.py`. Añadir la prueba de fronteras: `home` solo importa las funciones públicas de los grupos 2 a 4 y no consulta modelos ajenos. Cierre: `uv run python manage.py makemigrations --check --dry-run` no detecta cambios.
- [x] 5.2 Probar e implementar `GET /api/v1/home/pending/` con autorización por indicador mediante `has_permission`, dentro de una instantánea de lectura. Matriz de pruebas: solo Vendedor, solo Encargado del taller, ambos, Administrador, usuario sin roles y sesión inválida. Cierre: la respuesta nunca contiene claves ajenas; el indicador de retenciones de una entidad desactivada y en cero se omite; la calificación solo llega al Administrador.
- [x] 5.3 Probar e implementar `GET /api/v1/home/receivables/` con la misma matriz. Cierre: una entrada por entidad autorizada, sin total conjunto en ningún campo.
- [x] 5.4 Probar e implementar `GET /api/v1/home/collections/` con la misma matriz. Cierre: siete días por entidad, total por entidad, zona horaria declarada y sin total conjunto.
- [x] 5.5 Probar que consultar las tres rutas no crea eventos de auditoría ni modifica operaciones, existencias, saldos o secuencias, también para un rol sin permisos sobre un indicador. Cierre: conteo de eventos y de filas sin cambios antes y después.
- [x] 5.6 Fijar un límite de consultas por ruta con `assertNumQueries` y medir las tres rutas con el volumen objetivo frente a RNF-REN-001. Cierre: medición registrada en la cobertura; si no se cumple, detenerse y proponer el índice por fecha de cobro del diseño D6 como tarea con su migración, sin añadirlo en silencio.
- [x] 5.7 Documentar las tres rutas y los filtros nuevos con `extend_schema` y regenerar `backend/schema.yml`. Cierre: el esquema generado incluye rutas y parámetros, y la comprobación de esquema del proyecto pasa.

Dependencias: grupos 2, 3 y 4. Evidencia: `uv run --frozen pytest tests/home/`, más `uv run ruff check`, `uv run ruff format --check` y `uv run mypy` sobre los módulos tocados.

## 6. Piezas visuales reutilizables

Cubre diseño D9 y el requisito «Indicadores con conteo y gráfico breve» de `sistema-visual-frontend`.

- [ ] 6.1 Probar e implementar `frontend/src/shared/ui/data/StatLink.tsx`: valor, etiqueta, ámbito opcional con `ScopeLabel`, importe con `Money`, enlace de React Router y cero atenuado. Cierre: escenarios «Varios indicadores en un panel» e «Indicador que conduce a una lista»; nombre accesible con valor, etiqueta y ámbito; foco visible; solo tokens existentes.
- [ ] 6.2 Probar e implementar `frontend/src/shared/ui/data/MiniBarChart.tsx` como lista ordenada con barras en HTML y CSS, tono del ámbito, total, texto de fecha e importe por barra con `Tooltip`, y línea de base para el cero. Cierre: escenarios «Gráfico de un ámbito fiscal», «Valor de una barra», «Movimiento reducido» y «Cambio de un token»; cero distinguible de «sin dato».
- [ ] 6.3 Exportar ambas piezas desde `frontend/src/shared/ui/index.ts`, registrarlas en `frontend/src/dev/visual-catalog/registry.ts` y `previews.tsx` con sus estados de carga, vacío, cero y error, y añadir el tablero «Inicio». Cierre: `registry.test.ts` en verde.

Dependencias: grupo 1; puede avanzar en paralelo con los grupos 2 a 5. Evidencia: `npm run test -- src/shared/ui/data src/dev/visual-catalog`.

## 7. Filtros nuevos en las listas del frontend

Cubre diseño D4: que cada enlace del inicio llegue a su lista ya filtrada y con el filtro a la vista.

- [ ] 7.1 Añadir `condition` y `only_debt` a `frontend/src/pages/sales/ReceivablesPage.tsx` y a la API y tipos de `features/sales`, leídos de la URL y visibles en la barra de filtros con el patrón existente. Cierre: «Limpiar filtros» los retira; las pruebas actuales de la página siguen pasando.
- [ ] 7.2 Añadir `condition` a `frontend/src/pages/maintenance/ArtisanReceivablesPage.tsx` y a `features/maintenance`. Cierre: igual que 7.1.
- [ ] 7.3 Añadir la opción «Abiertas» al filtro de estado de `frontend/src/pages/maintenance/MaintenanceOrdersPage.tsx`. Cierre: `/maintenance?state=OPEN` muestra registradas y reabiertas.
- [ ] 7.4 Añadir «Por vencer» a `frontend/src/pages/proformas/ProformasPage.tsx` mediante `expires_within_days`. Cierre: `/proformas?state=VALID&expires_within_days=1` llega filtrada y el filtro puede quitarse.

Dependencias: grupos 2, 3 y 4. Evidencia: `npm run test -- src/pages/sales/ReceivablesPage src/pages/maintenance src/pages/proformas/ProformasPage`.

## 8. Página de inicio

Cubre diseño D8 y D9; requisitos «Acciones rápidas hacia las operaciones frecuentes», «Estados independientes por bloque», «Inicio sin repetir la navegación» y «Presentación conforme al sistema Tallkit».

- [ ] 8.1 Crear `frontend/src/features/home/` (`api.ts`, `hooks.ts`, `types.ts`) con las tres consultas independientes y `staleTime: 0`. Cierre: pruebas de claves de consulta, de respuesta tipada y de que un fallo no afecta a las otras dos.
- [ ] 8.2 Crear `features/home/quickActions.ts` y `pendingTargets.ts` con las tablas de acciones y de destinos del diseño. Cierre: pruebas por rol de qué acciones resultan y de que cada `key` tiene un destino con sus parámetros.
- [ ] 8.3 Probar e implementar `QuickActionsBlock` con acciones secundarias con icono, sin relleno azul, y un acceso de cobro por entidad. Cierre: escenarios «Accesos de un Vendedor», «Cobrar con las dos entidades» y «Acceso sin efectos».
- [ ] 8.4 Probar e implementar `PendingBlock` en un solo panel con `StatLink`, el aviso de la calificación y el texto de «sin pendientes». Cierre: escenarios «Sin pendientes», «Retenciones separadas por entidad» y los dos de la calificación.
- [ ] 8.5 Probar e implementar `ReceivablesBlock` con dos mitades identificadas por ámbito. Cierre: escenarios «Administrador con deuda en las dos entidades», «Sin deuda» y ausencia de total conjunto.
- [ ] 8.6 Probar e implementar `CollectionsBlock` con un `MiniBarChart` por entidad. Cierre: escenarios «Dos entidades sin total conjunto» y «Lectura sin el gráfico».
- [ ] 8.7 Reescribir `frontend/src/pages/home/HomePage.tsx` componiendo los cuatro bloques bajo `PageHeader`, con carga, error y «Reintentar» por bloque, sin el listado de áreas y con el estado vacío para quien no tiene funciones. Cierre: escenarios «Falla un solo bloque», «Dato no disponible», «Carga», «Usuario sin funciones» e «Inicio de un Administrador»; `navigation.ts` sin cambios y `App.test.tsx` en verde.
- [ ] 8.8 Ajustar la disposición adaptable: una columna en teléfono, dos en tableta, hasta cuatro indicadores por fila en escritorio, gráficos lado a lado desde 1024 px, objetivos de 44 px y orden de foco coherente. Cierre: escenarios «Teléfono de 360 px», «Uso con teclado» y «Persona que no distingue el color».

Dependencias: grupos 5, 6 y 7. Evidencia: `npm run test -- src/features/home src/pages/home src/app/App.test.tsx`, más `npm run typecheck`, `npm run lint` y `npm run format:check`.

## 9. Recorrido completo y revisión visual

- [ ] 9.1 Añadir `frontend/e2e/home.spec.ts` con un recorrido por rol (Vendedor, Encargado del taller y Administrador): abrir el inicio, activar un pendiente y comprobar que la lista muestra el mismo número; cobrar una venta de contado y verificar que el indicador baja al volver. Cierre: `npm run test:e2e -- home.spec.ts` en verde.
- [ ] 9.2 Añadir al recorrido la comprobación de accesibilidad con `e2e/accessibility.ts` y la revisión a 360, 768 y 1280 px sin desplazamiento horizontal de la página. Cierre: sin infracciones nuevas.
- [ ] 9.3 Comparar la página con una lista existente y con el catálogo visual: paneles, cabeceras, tipografía, acciones, tonos de ámbito y ausencia de sombras y de valores visuales propios. Registrar capturas como evidencia visual. Cierre: escenario «Coherencia con el resto de las pantallas» anotado con su evidencia.

Dependencias: grupo 8. Evidencia: salida de Playwright y capturas referenciadas en la cobertura.

## 10. Documentación, trazabilidad y cierre

- [ ] 10.1 Actualizar UI-002 en `docs/negocio/requisitos/interfaz-y-navegacion.md` con los cuatro bloques, dejando expreso que stock bajo y estado del respaldo siguen pendientes y que «Cobrar» conduce a las cuentas por cobrar.
- [ ] 10.2 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` y la nota de estado de implementación de RF-REP-006 en `requisitos-funcionales.md`; añadir el módulo `home` y sus tres rutas a `docs/tecnico/arquitectura-inicial.md`.
- [ ] 10.3 Revisar `docs/negocio/producto/glosario.md` y `docs/tecnico/glosario-tecnico.md`: añadir los términos nuevos que la interfaz muestre y actualizar los archivos de referencia de glosario de cada documento tocado.
- [ ] 10.4 Corregir el comentario desactualizado de `HomePage.tsx` y completar `cobertura-pagina-de-inicio.md` con la prueba y el resultado real de los 47 escenarios, incluida la nota sobre el estado «cancelado» todavía inexistente.
- [ ] 10.5 Ejecutar la verificación de cierre: `make check`, las pruebas focalizadas de los grupos 2 a 9, `make audit` y `openspec validate redisenar-pagina-de-inicio --strict`. Cierre: comandos y resultados reales registrados; ninguna comprobación declarada sin haberse ejecutado.

Dependencias: grupos 2 a 9. Criterio de grupo: documentación sincronizada, cobertura completa y verificación registrada. Estas tareas no autorizan commits, ramas, merges ni el archivado del cambio fuera de los que el usuario solicite.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
