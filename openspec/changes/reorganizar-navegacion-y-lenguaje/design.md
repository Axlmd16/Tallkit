## Context

U3 renovó el aspecto; U4 reorganiza el menú y el lenguaje (propuesta y specs de este cambio). El código actual se inspeccionó antes de decidir:

- **Menú:** `frontend/src/app/navigation.ts` define 6 grupos plegables y 18 opciones (`navigationGroups`, `visibleGroups`, `findLocation`, `groupScopes`). `SidebarNavigation.tsx` y `AuthenticatedShell.tsx` los consumen; el ámbito fiscal de la barra superior sale del grupo (`groupScopes`). Las rutas viven en `app/App.tsx` y **no cambian**.
- **Nombres de negocio:** `GET /api/v1/workshop-configuration/entity-logos/` ya entrega `display_name` (nombre comercial con reserva a la razón social) y logotipo a **cualquier usuario autenticado**. El hook `useIssuerBrand` (`shared/api/entity-logos.ts`) ya lo consume.
- **Listas por cliente:** `sales` ya filtra ventas y cuentas por cobrar por `customer_id` y devuelve `receivable_total`; `workshop` ya filtra órdenes por `customer_id` y `artisan_receivables` acepta `customer_id` con sumas de todas las coincidencias. Cada una exige su permiso (`ventas.ver`, `pagos_comerciales.ver`, `mantenimientos.ver`, `pagos_artesanales.ver`).
- **Existencias:** `inventory.application.queries.list_stock` ya combina catálogo y posiciones. El módulo `catalog` tiene prohibido importar `inventory` y usar palabras como `stock` o `cost` en sus campos (`tests/catalog/test_boundaries.py`).
- **Órdenes:** `workshop.application.queries.list_orders` ya admite `state=OPEN` (registrada o reabierta). El código solo tiene los estados `REGISTERED`, `FINALIZED` y `REOPENED`; el estado «cancelado» del dominio no existe todavía.
- **Fiscal:** `GET fiscal/preparations/` solo consulta la preparación activa de una operación; no hay lista. Los permisos `fiscal.comercial.ver` y `fiscal.artesanal.ver` ya existen. `FiscalPreparation` referencia la venta o la operación artesanal de origen.
- **Textos:** `FiscalScopeBadge` (`shared/ui/states.tsx`), `StatLink`, `MiniBarChart`, y ~20 pantallas escriben «RUC comercial» y «RUC artesanal»; `formatMoney` (`shared/ui/business/Money.tsx`) solo acepta hasta dos decimales y devuelve «—» con más; las tarifas se escriben crudas (`{line.tax_rate} %`).

Fuentes: `proposal.md`, `specs/` de este cambio, `DP-036`, `docs/analisis-del-sistema.md` §8.1, `docs/prototipo/` (Menú, Cuentas, Ajustes, Cliente, Productos), ADR-0001, ADR-0003 y ADR-0010.

## Goals / Non-Goals

**Goals:**
- Menú plano de nueve entradas que respeta los permisos, sin perder ninguna ruta.
- Un solo lugar (`navigation.ts`) que defina entradas, pestañas y ámbito fiscal.
- Nombre del negocio en lugar del RUC, desde una sola fuente, sin duplicar la regla del nombre en el frontend.
- Ficha del cliente, existencias, contadores, lista de facturas locales y listas del inicio con la **menor** cantidad de endpoints nuevos.

**Non-Goals:**
- Cambiar rutas, permisos, roles, modelos o migraciones.
- Búsqueda global (U5), «Cobrar y facturar» (U6), emisión real.
- Una capa de composición nueva en el backend para la ficha del cliente o el inicio.

## Decisions

**D1. Menú plano definido por entradas y secciones.** `navigation.ts` pasa de `NavGroup[]` a `NavEntry[]`: cada entrada tiene `id`, icono, etiqueta y una lista de **secciones** (`label`, `to`, `permission` o `anyOf`, `alsoMatches`, `excludes`, `scope` opcional). La entrada se muestra si alguna sección está permitida y enlaza a la primera permitida. Se retiran los grupos plegables de `SidebarNavigation.tsx` y `useExpandedRail`.
- Entradas y secciones: Mantenimientos (`/maintenance`); Ventas (`/sales`, `/proformas`); Facturas (`/invoices`, nueva); Clientes (`/customers`, `/vehicles`); Productos (`/products`, `/purchases`, `/inventory`); Servicios (`/services`); Cuentas (comercial: `/sales/receivables`, `/sales/withholdings`; artesanal: `/maintenance/receivables`, `/maintenance/withholdings`); Ajustes (`/settings`, nueva, con proveedores, marcas, categorías, unidades, usuarios, auditoría, estado técnico y configuración).
- *Alternativa descartada:* redirigir las rutas a otras nuevas. Se descarta porque rompe enlaces guardados y no aporta nada: la entrada resuelve el resaltado con `alsoMatches`.

**D2. Pestañas del mismo sitio con el componente existente.** Cuando la entrada activa tiene dos o más secciones permitidas, `AuthenticatedShell` muestra encima del contenido un `SectionNav` en disposición horizontal (ya existe en `shared/ui/navigation`), sin tocar las páginas. «Cuentas» usa pestañas por negocio, con el nombre del negocio como etiqueta, y un segundo nivel «Por cobrar» y «Retenciones» dentro de cada una. «Ajustes» **no** usa pestañas: su ruta `/settings` es una página de entrada con las opciones permitidas, como en el prototipo (pantalla 14); las rutas hijas conservan la entrada «Ajustes» resaltada y la ruta de migas «Ajustes › Usuarios».
- *Alternativa descartada:* pestañas ARIA nuevas o un menú desplegable. Duplican un componente que ya se probó con teclado y táctil.

**D3. Ámbito fiscal por sección, no por grupo.** `groupScopes` se reemplaza por el `scope` de cada sección. La insignia de la barra superior (`FiscalScopeBadge`) muestra el nombre del negocio de la sección activa. Las secciones compartidas (Clientes, Servicios en el sentido de catálogo, Ajustes) no llevan insignia, como hoy.

**D4. Nombre del negocio desde una sola fuente.** Se agrega `useBusinessName(scope)` y `<BusinessName>` sobre `useIssuerBrand`. Mientras la consulta no termina, muestran «Repuestos» o «Servicios» (el texto breve que U3 ya usa), nunca «RUC». Se reemplazan los textos literales de `states.tsx`, `StatLink`, `MiniBarChart`, las pantallas del taller y de ventas, y los títulos de acciones («Cobrar repuestos», «Cobrar servicios»). El RUC permanece en `FiscalConfigurationSection`, `WorkshopConfigurationPage`, los comprobantes y las facturas. **No hay endpoint nuevo ni cambio de permisos:** `entity-logos` solo entrega nombre y logotipo.
- Pruebas: `states.test.tsx` deja de fijar el texto «RUC comercial»; verifica el nombre recibido y el icono. Los avisos legales siguen fijados.

**D5. Ficha del cliente compuesta en el frontend, con los endpoints que ya existen.** `CustomerDetailPage` pasa a pestañas (ficha con mucho contenido): «Datos», «Vehículos», «Compras» y «Deuda». «Compras» y «Deuda» muestran un bloque por negocio, cada uno consultando su lista con `customer_id` y `page_size` corto; el bloque se omite si el usuario no tiene el permiso de ese negocio, y el servidor sigue rechazando la llamada directa. La deuda de cada negocio sale de `receivable_total` (suma de todas las coincidencias) y **nunca se suma con la del otro**. Se elimina la fila «Versión de registro»; `expectedVersion` sigue enviándose.
- *Alternativa descartada:* un endpoint agregador `customers/{id}/activity` en el backend. Obligaría a `customer_registry` a importar `sales` y `workshop` (dirección inversa de las fronteras actuales) y a mezclar permisos de dos negocios en una sola respuesta.

**D6. Existencia: lectura del inventario, no del catálogo.** El catálogo sigue sin exponer existencias (frontera y prueba existentes). Se añade en `inventory` una lectura nueva, `GET /api/v1/inventory/stock/quantities/?product_ids=1,2,3` (máximo 100 identificadores, permiso `inventario.ver`), que devuelve solo `{product_id, quantity}`, sin costo ni valoración y sin crear posiciones. La lista de productos pide las cantidades de la página visible tras cargarla; la ficha usa el `GET inventory/products/{id}/` existente. Sin el permiso la pantalla no pide ni muestra la columna, y la llamada directa recibe 403. «Movimientos» enlaza al Kardex del producto (`/inventory/products/:id/kardex`).
- *Alternativas descartadas:* agregar `stock` a la respuesta del catálogo (viola `FORBIDDEN_FIELD_WORDS` y crea un ciclo de importación); reutilizar `list_stock` con filtros (pagina por su cuenta y desordenaría la lista de productos).
- **Ajuste a las specs:** el escenario «Usuario sin permiso de inventario» de `catalogo-de-productos-y-categorias` decía que la respuesta del catálogo omite la existencia; se corrige para que lo rechace la lectura del inventario (ver «Ajustes a las specs»).

**D7. Contador por segmento en la lista de mantenimientos.** `list_orders` agrega `status_counts` (`all`, `open`, `finalized`) calculado con la misma búsqueda, fechas, cliente y vehículo, **sin** el filtro de estado, en una sola consulta agregada. Los segmentos de la pantalla son «Todas», «Abiertas» (`OPEN`) y «Finalizadas». No hay segmento «Canceladas» porque ese estado no existe en el código (ver «Ajustes a las specs»).

**D8. Lista de preparaciones locales de factura.** `GET /api/v1/fiscal/preparations/list/` (ruta distinta de la consulta por operación), paginada, con filtros `entity` (`COMERCIAL` o `ARTESANAL`) y `state`. El servicio de `fiscal` autoriza por entidad con los permisos existentes, filtra las filas y rechaza con 403 un filtro por la entidad no permitida. Cliente, número y total de cada fila los pide a las interfaces publicadas de origen (`sales.application.fiscal_source` y `workshop.application.fiscal_source`), con una función por lote nueva en cada una, para no tocar sus tablas desde `fiscal`. Orden estable por fecha de creación y desempate por identificador. Es de solo lectura: no crea, edita, numera ni cancela. La pantalla `/invoices` usa los filtros en la URL como las demás listas y enlaza cada fila a `/fiscal/preparations/:id`. Textos de estado: «Borrador», «Preparada, sin enviar» y «Cancelada»; ninguno dice autorizada.
- *Alternativa descartada:* dejar la entrada vacía (opción B de la propuesta). Quedó aprobada la A.

**D9. Inicio: dos listas con los endpoints existentes.** «En el taller» consulta `maintenance/orders/?state=OPEN&page_size=5`; «Falta cobrar» consulta las cuentas por cobrar de cada negocio permitido (`page_size=5`, solo con deuda) y mezcla las filas por fecha de confirmación **solo para ordenarlas**; cada fila lleva su negocio y su saldo, y no hay total. Cada lista es un bloque con su propio estado de carga y error, como los demás. No se cambia `home/application/summary.py`.
- *Alternativa descartada:* ampliar el resumen del inicio en el backend. Mantiene la composición de permisos en un solo lugar, pero obliga a `home` a conocer listas de filas y no aporta nada al usuario.

**D10. Presentación de importes y tarifas.** `formatMoney` y `Money` aceptan ceros sobrantes más allá del segundo decimal (los recortan) y conservan los decimales distintos de cero tal como llegan, sin redondear en silencio. Los costos que ve el Administrador usan un componente con `precision="cost"` (hasta seis decimales). Un helper único `formatRate` (basado en el recorte que ya usa `TaxLine`) escribe las tarifas, y se usa en `ServiceOperationDetailPage`, `FiscalPreparationPage`, `TaxesSection` y demás lugares que hoy escriben la tarifa cruda. «Registrar cobro» pasa a ser el texto por omisión en `BillingDialogs.tsx` y en el diálogo equivalente de ventas.

**D11. Términos.** Una constante única de términos visibles (`shared/ui/terms.ts`) evita repetir «Mantenimiento», «Recibo», «Total a pagar» y «Movimientos» en cada pantalla. Los textos de los comprobantes (impresos) se actualizan junto con sus avisos legales, que no se tocan.

**D12. Avisos que no tapan el total.** El `ToastProvider` pasa a posicionarse debajo de la barra superior y fuera del pie de las pantallas con acción principal fija; en teléfono se ancla arriba. Es una corrección de maquetación sin lógica.

**D13. Nombre comercial en la configuración inicial.** `InitializeView`/la pantalla de configuración inicial agregan el campo de nombre comercial por entidad, con ayuda que explica su uso; sigue opcional y se guarda con el mismo comando que ya acepta `trade_name`. No hay cambio de esquema.

**Sin ADR nuevo:** las decisiones son de presentación y composición dentro de las fronteras vigentes (ADR-0001, ADR-0003); no se introduce un patrón duradero ni una dependencia.

## Risks / Trade-offs

- **[Perder acceso a una pantalla al aplanar el menú]** → cada ruta actual queda en alguna sección o en `/settings`; una prueba recorre `App.tsx` y comprueba que toda ruta de lista tiene entrada o sección.
- **[Mezclar deuda de los dos negocios en la ficha del cliente o en «Falta cobrar»]** → cada bloque consulta su propio endpoint, no hay total conjunto y hay pruebas negativas con un usuario de un solo negocio.
- **[Inicio más lento por más consultas]** → cada bloque carga por separado, con `page_size=5` y los mismos caches que las demás pantallas.
- **[Nombre de negocio sin cargar o repetido]** → texto breve de reserva mientras carga; el logotipo y el icono distinguen dos negocios con el mismo nombre.
- **[El texto de «Facturas» parece una factura emitida]** → solo estados locales, sin la palabra «autorizada», y una prueba que lo verifica.
- **[Pruebas de pantalla que fijan textos]** → se limpian las que dependen de «RUC comercial» y de los nombres de menú; no se fijan los nuevos textos, salvo avisos legales.
- **[Rutas de migas y `findLocation`]** → se reescriben con las secciones; se cubren con las pruebas de `AuthenticatedShell`.

## Migration Plan

No hay migraciones ni datos que convertir. Se entrega por grupos independientes: (1) términos, nombres y formatos; (2) menú, pestañas y `/settings`; (3) ficha del cliente y existencias; (4) contadores, inicio y facturas locales; (5) documentación. Cada grupo es reversible con un `git revert` porque no cambia datos. Los dos endpoints nuevos son de solo lectura; el esquema OpenAPI (`backend/schema.yml`) se regenera con ellos.

## Pruebas

| Riesgo | Alcance | Pruebas |
|---|---|---|
| Estricto (TDD) | Lista de preparaciones locales, lectura de cantidades, filtrado de entradas por permisos, aislamiento por negocio en la ficha y el inicio | Backend: permisos por rol y combinación, filtro por entidad no permitida, sin efectos, sin costos, límite de identificadores. Frontend: filtrado de entradas por permisos (`navigation.ts`), bloques de la ficha por permiso |
| Al final del grupo | Pestañas, `/settings`, contadores, listas de inicio, ficha, formatos, texto del botón | Una prueba por flujo (`AuthenticatedShell`, `HomePage`, `CustomerDetailPage`, `ProductsPage`, `MaintenanceOrdersPage`, `InvoicesPage`) |
| Sin prueba nueva | Posición de avisos, textos, colores, espaciado | `make check` y revisión visual a 360, 768, 1024 y 1440 px |

Cobertura por requisito: una fila por requisito en `docs/negocio/requisitos/` (documentación) al cerrar el cambio. Prueba E2E solo del recorrido menú → ficha del cliente → cuentas, al cerrar.

## Ajustes a las specs (hallados al inspeccionar el código)

1. `catalogo-de-productos-y-categorias`: la existencia no viaja en la respuesta del catálogo, sino en la lectura del inventario (D6). El requisito conserva su regla de mostrar la existencia real de solo lectura; cambia solo qué responde el servidor sin permiso.
2. `ordenes-de-mantenimiento`: los segmentos son «Todas», «Abiertas» y «Finalizadas»; no existe «Canceladas» porque el estado `cancelado` del dominio todavía no está implementado. La brecha queda registrada, no resuelta aquí.

## Open Questions

Resueltas por el titular al aprobar el diseño:

- `/settings` se construye como en el prototipo (`docs/prototipo/Ajustes.dc.html`, pantalla 14): una página de entrada con las opciones permitidas, cada una con su icono y una descripción breve.
- La lista de preparaciones locales se ordena por la más reciente primero (fecha de creación descendente) y, a igual fecha, por identificador, para que el orden sea estable. Se comprueba al implementar D8 que `FiscalPreparation` tenga el campo de fecha; si no lo tiene, se usa la fecha de preparación o la de origen sin cambiar el esquema.
