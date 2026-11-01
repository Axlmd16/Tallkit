## Context

La propuesta y las specs `pagina-de-inicio` y `sistema-visual-frontend` (delta) están aprobadas y registradas en `master` (`60929e2`). Este documento decide cómo construirlas. Se inspeccionó el código real antes de proponer nada.

**Estado actual, comprobado en el código**

- `frontend/src/pages/home/HomePage.tsx` solo recorre `visibleGroups()` de `app/navigation.ts`. No consulta al servidor.
- Los datos que el resumen necesita ya existen, cada uno en su módulo:

| Dato | Dónde vive hoy | Permiso que ya exige |
|---|---|---|
| Saldo comercial y ventas con saldo | `sales/application/reads.py` (`annotated_sales`, `receivables`) | `pagos_comerciales.ver` |
| Ventas en borrador | `sales/application/reads.py` (`list_sales`, `state=DRAFT`) | `ventas.ver` |
| Pagos comerciales | `sales.models.CommercialPayment` (`effective_date`, corrección) | `pagos_comerciales.ver` |
| Retenciones comerciales por completar | `sales/application/withholdings.py` (`pending_vouchers`) | `pagos_comerciales.ver` |
| Saldo artesanal y operaciones con saldo | `workshop/application/queries.py` (`_receivable_rows`, `artisan_receivables`) | `pagos_artesanales.ver` |
| Pagos artesanales | `workshop.models.ArtisanPayment` (`effective_date`) | `pagos_artesanales.ver` |
| Retenciones artesanales por completar | `workshop/application/artisan_withholdings.py` (`pending_vouchers`) | `pagos_artesanales.ver` |
| Órdenes abiertas | `workshop.models` (`OPEN_STATE_VALUES`), `list_orders` | `mantenimientos.ver` |
| Proformas vigentes y borradores | `proformas/application/queries.py` (`filter_by_effective_state`) | `proformas.ver` |
| Calificación artesanal | `workshop_configuration/domain/electronic_profile.py` (`qualification_days_left`) | `parametros.gestionar` |
| Si una entidad registra retenciones | `workshop_configuration/application/withholding_settings.py` | — |

- `identity/domain/authorization.py` confirma el reparto: el Vendedor no tiene `mantenimientos.ver` y el Encargado del taller no tiene `ventas.ver` ni `proformas.ver`.
- `require_permission` **registra un evento de auditoría de denegación** cada vez que falla; `has_permission` solo responde sí o no.
- Las listas del frontend (`SalesPage`, `ProformasPage`, `MaintenanceOrdersPage`, las dos de cuentas por cobrar) ya guardan sus filtros en la URL, así que un enlace con parámetros llega filtrado.
- A esas listas les faltan cuatro filtros para que el conteo del inicio coincida con lo que muestran (ver D4).
- El frontend usa React Router 7, TanStack Query 5 (`staleTime` de 30 s y sin recarga al enfocar la ventana, en `app/query-client.ts`), Tailwind 4 con tokens `--color-*` —incluidos `scope-commercial` y `scope-artisan`— y las piezas de `shared/ui` (`PageHeader`, `SectionPanel`, `Money`, `ScopeLabel`, `Tooltip`, estados). No hay ninguna librería de gráficos.
- `frontend/src/dev/visual-catalog/` registra las piezas del sistema (`TK-01`…) y tiene una prueba del registro.

**Restricciones.** Monolito modular con fronteras explícitas (ADR-0001); sin dependencias nuevas sin uso justificado (ADR-0002); sesiones y mismo origen (ADR-0003); cada RUC con estructuras propias y reglas monetarias compartidas (ADR-0008); el backend decide permisos y dinero; TDD.

## Goals / Non-Goals

**Goals:**

- Entregar los cuatro bloques con datos del servidor, filtrados por permisos efectivos.
- Que cada número del inicio coincida con su lista de destino, por construcción y no por coincidencia.
- No tocar datos: sin tablas, migraciones ni cambios en operaciones existentes.
- Seguir el sistema Tallkit con piezas reutilizables, sin estilos sueltos ni librerías nuevas.
- Que un bloque que falla no afecte a los demás.

**Non-Goals:**

- Stock bajo, estado del respaldo, cierre de caja, márgenes, reportes y exportación.
- Caché en servidor, actualización en tiempo real o tareas programadas.
- Cambiar permisos, roles, rutas existentes o la navegación lateral.
- Personalización del inicio por usuario.

## Decisions

### D1. Un módulo `home` que solo compone lecturas, sin modelos

Se crea `backend/src/home/` con `api/` y `application/`, sin `models.py` ni migraciones. No consulta tablas ajenas: llama a funciones públicas de lectura que cada módulo dueño expone en su capa de aplicación.

- `sales.application.home_summary`: contado sin cobrar, borradores, retenciones por completar, saldo y clientes, cobros por día.
- `workshop.application.home_summary`: órdenes abiertas y los equivalentes artesanales.
- `proformas.application.home_summary`: por vencer y borradores.
- `workshop_configuration`: aviso de la calificación artesanal y si cada entidad registra retenciones.

*Por qué.* Cada módulo conserva la definición de sus propios conceptos («saldo», «vigente», «abierta»), que es lo que exige ADR-0001. El inicio solo decide qué mostrar a quién.

*Alternativas descartadas.*
- *Que `home` consulte los modelos directamente:* rompe las fronteras y duplicaría la fórmula del saldo.
- *Que el frontend llame a las listas existentes y lea `total_count`:* cada lista pagina, serializa filas que no se usan y, sobre todo, audita una denegación si el usuario no tiene permiso; además no existe consulta para los cobros por día.

### D2. Tres consultas, una por bloque con datos

| Ruta | Bloque |
|---|---|
| `GET /api/v1/home/pending/` | Pendientes |
| `GET /api/v1/home/receivables/` | Por cobrar |
| `GET /api/v1/home/collections/` | Cobros de los últimos siete días |

Las acciones rápidas no tienen consulta: se derivan de los permisos de la sesión, igual que la navegación, y la pantalla de destino ya valida en el servidor.

*Por qué tres y no una.* La spec pide que cada bloque cargue, falle y se reintente por separado. Con una sola respuesta, un fallo en los cobros dejaría sin datos a los pendientes. Las tres salen en paralelo.

*Alternativa descartada.* Una ruta por indicador (unas quince): demasiadas peticiones para la primera pantalla de cada sesión.

**Forma de las respuestas** (los importes viajan como texto decimal, como en el resto de la API):

```
pending      → { items: [ { key, scope, count } ], qualification: { expires_on, days_left, expired } | null }
receivables  → { items: [ { scope, balance, customers } ] }
collections  → { timezone, items: [ { scope, total, days: [ { date, amount } ] } ] }
```

`scope` es `commercial`, `artisan` o `null`. `key` es un identificador cerrado (`open_orders`, `cash_sales_unpaid`, `cash_services_unpaid`, `proformas_expiring`, `withholdings_pending`, `sale_drafts`, `proforma_drafts`). El servidor no envía rutas del frontend: el frontend asocia cada `key` con su lista. Así la API no depende de cómo se llamen las pantallas.

### D3. Autorización por indicador con `has_permission`, sin auditar denegaciones

Las tres rutas exigen sesión vigente y nada más. Dentro, cada indicador se calcula solo si `has_permission(actor, …)` es verdadero, con el mismo permiso de su lista de destino. Lo no autorizado no se calcula ni aparece en la respuesta. Un usuario sin ningún indicador recibe `200` con la lista vacía.

*Por qué no `require_permission`.* Registraría un evento de «permiso denegado» por cada indicador ajeno cada vez que alguien abre el inicio. Un Vendedor llenaría la auditoría de denegaciones que no son intentos reales.

*Consecuencia para la spec.* El escenario «Consulta directa sin permiso» se cumple porque no existe una dirección por indicador: la respuesta de un Vendedor nunca contiene claves artesanales, las pida como las pida. Las pruebas lo verifican sobre el contenido de la respuesta.

| Indicador | Permiso |
|---|---|
| Mantenimientos abiertos | `mantenimientos.ver` |
| Ventas de contado sin cobrar, retenciones comerciales, saldo y cobros comerciales | `pagos_comerciales.ver` |
| Servicios de contado sin cobrar, retenciones artesanales, saldo y cobros artesanales | `pagos_artesanales.ver` |
| Proformas por vencer y borradores de proforma | `proformas.ver` |
| Borradores de venta | `ventas.ver` |
| Calificación artesanal | `parametros.gestionar` (hoy solo el Administrador) |

### D4. El conteo y la lista comparten el mismo filtro

Cada módulo extrae a una función el filtro que define un pendiente y la usan **tanto** el indicador **como** la lista. No se escribe dos veces la misma condición. Para que el enlace del inicio llegue a la lista equivalente, se añaden cuatro filtros que hoy no existen:

| Lista | Filtro nuevo | Enlace desde el inicio |
|---|---|---|
| Cuentas por cobrar comerciales | `condition` y `only_debt` (excluye filas que solo tienen exceso por reembolsar) | `/sales/receivables?condition=CASH&only_debt=true` |
| Cuentas por cobrar artesanales | `condition` | `/maintenance/receivables?condition=CASH` |
| Órdenes de mantenimiento | `state=OPEN` (registradas y reabiertas) | `/maintenance?state=OPEN` |
| Proformas | `expires_within_days` (con `state=VALID`) | `/proformas?state=VALID&expires_within_days=1` |

Los demás enlaces ya funcionan: `/sales?state=DRAFT`, `/proformas?state=DRAFT`, `/sales/withholdings`, `/maintenance/withholdings` y las dos cuentas por cobrar sin filtros.

Cada lista muestra el filtro nuevo en su barra de filtros con el patrón existente, para que la persona vea por qué la lista está acotada y pueda quitarlo.

*Por qué `expires_within_days` y no una fecha.* Un enlace con fecha fija quedaría viejo si se guarda o se deja abierto; el servidor calcula «hoy» con el reloj del negocio en cada consulta.

*Alternativa descartada.* Llevar a la lista sin filtrar: el número del inicio no coincidiría con lo que se ve, que es justo lo que la spec prohíbe.

### D5. Cada bloque se lee en una instantánea coherente

Cada ruta ejecuta sus consultas dentro de una transacción corta `REPEATABLE READ`, con el `read_snapshot` que ya usan ventas e inventario. Así un cobro que entra a mitad de la consulta no produce un saldo que no cuadra con su número de clientes. Son solo lecturas: no hay bloqueos de fila, escrituras ni idempotencia que diseñar.

`read_snapshot` está hoy duplicado en `sales` e `inventory`. Se usa desde cada módulo dueño tal como está; unificarlo es una refactorización ajena a este cambio.

### D6. Cobros por día: suma por `effective_date` de pagos vigentes

Para cada entidad se agrupan los pagos por `effective_date` dentro de la ventana `[hoy − 6, hoy]`, donde «hoy» es la fecha del negocio en America/Guayaquil. Solo cuentan los pagos sin corrección (`correction__isnull=True`), que es la misma definición de «vigente» que ya usa el saldo. Los días sin filas se completan con `0.00` en el servidor, para que el frontend reciba siempre siete días.

- `effective_date` ya se guarda en la zona del negocio al registrar el cobro, así que un pago de las 23:30 cae en su día sin conversiones.
- Las retenciones están en tablas distintas de los pagos; quedan fuera sin esfuerzo.
- Los reembolsos no se restan, como fija la spec.
- Se usa `Decimal` de extremo a extremo; ninguna suma pasa por punto flotante.

No se añade índice ahora. Los pagos tienen índice por operación y fecha, no por fecha sola; con el volumen del taller la consulta es pequeña. Si la medición de D10 no cumple el objetivo, se añadirá un índice por `effective_date` con su migración, como tarea explícita.

### D7. Calificación artesanal: una función que también ve la vencida

`qualification_days_left` devuelve «nada» cuando la calificación ya venció, porque la configuración trata ese caso por otro camino. Se añade en `workshop_configuration` una función pública de lectura que devuelve fecha de fin, días restantes y si está vencida, usando la misma constante de 60 días. La configuración sigue usando la suya sin cambios. El aviso del inicio enlaza a `/configuration`, en *Perfil tributario*.

### D8. Frontend: una funcionalidad `home` y una página compuesta por bloques

```
features/home/        api.ts · hooks.ts · types.ts · quickActions.ts · pendingTargets.ts
pages/home/           HomePage.tsx
                      QuickActionsBlock · PendingBlock · ReceivablesBlock · CollectionsBlock
shared/ui/data/       StatLink.tsx · MiniBarChart.tsx
```

- **Tres consultas independientes** con TanStack Query (`['home','pending']`, etc.), cada una con su carga, error y «Reintentar» dentro de su panel, usando los estados de `shared/ui`.
- **Datos frescos al entrar:** estas consultas usan `staleTime: 0`, de modo que se vuelven a pedir cada vez que se abre el inicio. No hay sondeo periódico. Se respeta la configuración global de no recargar al enfocar la ventana.
- **Sin dato inventado:** mientras hay error, el bloque muestra el error, nunca un `0`.
- **Acciones rápidas:** tabla estática con etiqueta, icono, destino, permiso y ámbito, filtrada con los permisos de la sesión.

| Acción | Destino | Permiso |
|---|---|---|
| Nueva venta | `/sales/new` | `ventas.crear` |
| Nueva proforma | `/proformas/new` | `proformas.gestionar` |
| Nuevo mantenimiento | `/maintenance/new` | `mantenimientos.gestionar` |
| Registrar entrada | `/purchases/new` | `ingresos.crear` |
| Cobrar repuestos | `/sales/receivables` | `pagos_comerciales.registrar` |
| Cobrar servicios | `/maintenance/receivables` | `pagos_artesanales.registrar` |

- **Usuario sin funciones:** se conserva el estado vacío actual, con texto ajustado.
- `navigation.ts` no cambia; `visibleGroups` lo sigue usando el marco de la aplicación.

### D9. Presentación con las piezas y tokens existentes

- **Estructura:** `PageHeader` con el título «Inicio» y la sesión, como hoy. Debajo, los bloques como paneles blancos con borde fino y cabecera en gris suave, sobre el lienzo. Sin sombras.
- **Acciones rápidas:** botones de acción secundaria con icono, en una fila que se ajusta al ancho. Ninguno usa el relleno azul: cinco acciones «principales» juntas anularían la jerarquía que define el sistema visual.
- **Pendientes:** un solo panel con los indicadores en rejilla, separados por líneas, no una tarjeta por dato. Cada indicador económico lleva su `ScopeLabel`.
- **Por cobrar:** un panel con dos mitades, «Repuestos» y «Servicios», cada una con su ámbito, su importe con `Money` y el número de clientes.
- **Cobros:** un gráfico por entidad, lado a lado desde 1024 px y apilados por debajo.
- **Adaptación:** una columna en teléfono, dos en tableta y hasta cuatro indicadores por fila en escritorio; objetivos de 44 px; todo el ancho disponible.

**`StatLink` (indicador con conteo).** Un enlace de React Router con valor, etiqueta y ámbito opcional. Su nombre accesible reúne los tres. El cero se muestra en tono atenuado.

**`MiniBarChart` (gráfico breve).** Una lista ordenada (`<ol>`) de siete elementos; cada barra es un bloque cuya altura es proporcional al máximo de la serie, pintado con `bg-scope-commercial` o `bg-scope-artisan`. Cada elemento contiene su fecha y su importe como texto real —visible con `Tooltip` al señalar, enfocar o tocar, y siempre disponible para lectores de pantalla—. Un día en cero conserva una línea de base mínima, distinta del estado «sin dato». Sin animación cuando el sistema pide movimiento reducido.

*Por qué HTML y CSS y no una librería ni SVG.* El gráfico es de siete barras. Una librería añadiría peso y un estilo propio que habría que domar para que siguiera los tokens; con elementos normales, los colores, la tipografía y el foco salen del sistema sin trabajo extra, y el texto accesible es texto de verdad.

Las dos piezas se exportan desde `shared/ui`, se registran en `dev/visual-catalog/registry.ts` con sus estados (carga, vacío, cero, error) y se añade un tablero «Inicio» al catálogo.

### D10. Estrategia de pruebas

Con TDD: cada prueba se escribe primero y falla por la razón esperada.

- **Backend, por módulo dueño** (`tests/sales`, `tests/workshop`, `tests/proformas`, `tests/workshop_configuration`): cada indicador con los datos de los escenarios de la spec —contado frente a crédito, contado cubierto con retención, proformas hoy/mañana/tres días/vencida, pago anulado, pago combinado, reembolso pendiente, calificación a 45 y 61 días y vencida—.
- **Coincidencia con la lista:** para cada pendiente, una prueba compara el conteo del resumen con el `total_count` de la lista usando el filtro del enlace.
- **Backend, `tests/home`:** matriz de permisos por rol y combinaciones (solo Vendedor, solo Encargado, ambos, Administrador, sin roles, sesión inválida); que la respuesta no contenga claves ajenas; que abrir el inicio **no** cree eventos de auditoría; separación por RUC sin totales conjuntos.
- **Fechas:** borde de medianoche y ventana de siete días con el reloj del negocio fijado.
- **Rendimiento:** un límite de número de consultas por ruta (`assertNumQueries`) y una medición con el volumen objetivo frente a RNF-REN-001.
- **Frontend (Vitest):** `HomePage` por rol; fallo aislado de un bloque con reintento; sin `0` ante un error; estado vacío; enlaces con sus parámetros; `StatLink` y `MiniBarChart` (nombre accesible, cero frente a sin dato, movimiento reducido); registro del catálogo visual; los filtros nuevos de las cuatro listas.
- **Extremo a extremo (Playwright):** un recorrido por rol que abre el inicio, activa un pendiente y comprueba que la lista muestra el mismo número; revisión a 360 px.
- **Contrato:** `backend/schema.yml` se regenera con las tres rutas y los filtros nuevos.

### D11. Sin ADR nuevo

El módulo `home` aplica el patrón ya decidido en ADR-0001 (módulos que colaboran mediante servicios de aplicación). No introduce una decisión transversal ni costosa de revertir: es de solo lectura y no tiene datos propios. Se documenta en `docs/tecnico/arquitectura-inicial.md` y basta.

### Impacto resumido

| Área | Impacto |
|---|---|
| Backend | Módulo nuevo `home`; una función pública de lectura por módulo dueño; cuatro filtros nuevos en listas existentes. |
| Frontend | `features/home`, `pages/home` reescrita, dos piezas en `shared/ui`, catálogo visual, cuatro filtros en listas. |
| Datos | Ninguno. Sin tablas ni migraciones. |
| API | Tres rutas `GET` nuevas y parámetros opcionales nuevos; nada existente cambia de forma. |
| Seguridad y permisos | Sin permisos nuevos. Autorización por indicador en el servidor. Sin datos personales nuevos: solo conteos e importes agregados. |
| Operación | Sin configuración ni tareas nuevas. |
| Documentación | UI-002 en `interfaz-y-navegacion.md`, matriz de trazabilidad, `arquitectura-inicial.md`, un documento de cobertura del cambio y el glosario si entra un término nuevo. |

## Risks / Trade-offs

- **El número del inicio y la lista se desalinean con el tiempo** → comparten la misma función de filtro (D4) y hay una prueba de coincidencia por pendiente.
- **La primera pantalla se vuelve lenta al crecer los datos** → tres consultas en paralelo, solo agregados, límite de consultas en pruebas y medición con el volumen objetivo; índice por fecha de cobro reservado como medida siguiente (D6).
- **Datos de hasta unos segundos de antigüedad si la página queda abierta** → es lo aprobado: se consulta al entrar, sin tiempo real. Volver al inicio los refresca.
- **Fuga de un indicador a un rol que no corresponde** → la decisión está en el servidor por indicador, con matriz de pruebas que inspecciona el contenido de la respuesta.
- **`home` crece hasta ser un tablero de reportes** → la propuesta fija cuatro bloques; un indicador nuevo exige su propio cambio.
- **Las piezas nuevas se desvían del estilo** → solo usan tokens existentes, entran al catálogo visual y se revisan contra la maqueta Tallkit.
- **Los filtros nuevos alteran listas ya probadas** → son opcionales; sin ellos el comportamiento es idéntico, y las pruebas actuales de esas listas deben seguir pasando.
- **`only_debt` añade un caso más a las cuentas por cobrar comerciales** → se acepta: sin él, una venta con exceso por reembolsar aparecería entre las «sin cobrar».

## Migration Plan

No hay migración de datos ni de esquema. El despliegue es el habitual. Para revertir basta volver a la versión anterior: no queda ningún dato que deshacer. El orden de construcción es backend por módulo dueño, luego `home`, luego las piezas visuales y por último la página, para no montar la pantalla sobre contratos inestables.

## Open Questions

- **Estado «cancelado» de las órdenes.** La spec lo menciona en un escenario, pero el código todavía no lo tiene (RF-TAL-014 está pendiente). No bloquea: «abierta» se define por los dos estados que sí existen, y cuando llegue la cancelación quedará excluida sin cambios. La prueba de ese escenario se escribirá con los estados existentes.
- **Destino exacto del aviso de calificación.** Se enlaza a `/configuration`; el parámetro que abre directamente *Perfil tributario* del RUC artesanal se confirmará al implementar, leyendo cómo esa página lee su URL.
- No queda ninguna decisión de negocio, fiscal ni contable abierta para este diseño.

Estado: diseño aprobado por el usuario el 2026-10-06 mediante «está bien, haz commit y continúa», después de su presentación para revisión. Autoriza registrarlo en `master` y redactar las tareas; no autoriza implementación.

### Ajustes durante la aplicación (2026-10-06)

- **Valores de la condición.** El código usa `CONTADO` y `CREDITO`, no `CASH`. Los enlaces reales son `/sales/receivables?condition=CONTADO&only_debt=true` y `/maintenance/receivables?condition=CONTADO`.
- **Autorización dentro del módulo dueño.** Cada función de `home_summary` recibe al actor y devuelve «nada» si no tiene el permiso, en lugar de que `home` decida. Así el permiso de cada indicador vive junto a su lista.
- **Interfaces publicadas.** `home` importa cada `home_summary` por su ruta completa, y las pruebas de fronteras de taller y proformas lo registran como único consumidor de esa interfaz.
- **Aviso de calificación.** La respuesta incluye `entity_id` para enlazar a `/configuration?tab=facturacion&entidad=<id>`, que resuelve la pregunta abierta sobre el destino.
- **Presupuesto de consultas.** `pending/` hace hasta 22 consultas pequeñas, casi la mitad para comprobar permisos; con 5 000 ventas y cobros el resumen comercial respondió en 0,12 s, así que no se añadió índice.
- **Pendientes en teléfono.** La rejilla usa dos columnas también en teléfono, no una, para que el panel no resulte demasiado largo.
- **Título del gráfico.** Dentro del panel «Cobrado en 7 días» el gráfico no repite el título a la vista; lo conserva como nombre accesible.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
