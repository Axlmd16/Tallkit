# Matriz de trazabilidad de requisitos

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.4 |
| Estado | Identidad implementada; demás capacidades en análisis |
| Fecha | 2026-09-09 |

> Esta matriz conecta decisiones, reglas, requisitos, casos de uso, interfaz y el modelo conceptual. La evidencia de identidad está detallada en [cobertura de identidad](cobertura-identidad.md) y la de catálogos en [cobertura de catálogos](cobertura-catalogos.md); las demás capacidades no se consideran implementadas.

## 1. Convenciones

| Prefijo | Artefacto |
|---|---|
| `RN-*` | Regla de negocio. |
| `DP-*`, `CT-*`, `DM-*`, `DA-*` | Decisión confirmada o pendiente, según la fuente prioritaria. |
| `RF-*` | Requisito funcional. |
| `RNF-*` | Requisito no funcional. |
| `CU-*` | Caso de uso. |
| `UI-*` | Pantalla o elemento conceptual de interfaz. |
| `CP-*` | Caso de prueba futuro. |
| `SPEC-*` | Especificación OpenSpec futura. |

Un rango con puntos suspensivos es inclusivo. La fuente de precedencia es `../decisiones/decisiones-confirmadas.yaml` y el modelo conceptual es `../../arquitectura/modelo-dominio.md`.

## 2. Cobertura funcional

| Capacidad | Decisiones | Reglas | Requisitos | Casos de uso | Interfaz | Modelo |
|---|---|---|---|---|---|---|
| Identidad, roles y autorización | CT-001 | RN-SEG-001…007 | RF-ACC-001…009; RF-AUD-001, 003, 005 | CU-001, CU-002 | UI-001…002, UI-010…011, UI-018 | Usuario, Rol; implementado por `gestion-usuarios-autenticacion-roles` |
| Sistema visual y experiencia adaptable | CT-001 | RNF-USA-001…012; RNF-COM-001…005; RNF-DIS-001; RNF-MAN-003, RNF-MAN-005 | Sin cambio funcional | Recorridos existentes | Todas las pantallas implementadas (UI-001…002, UI-010…011, UI-014…018, UI-020…025, UI-030…037, UI-040…045, UI-053…063) | Sistema propio Tallkit, implementado por `redisenar-sistema-visual-tallkit` (sustituye a `establecer-sistema-visual-frontend`); referencia en `DESIGN.md` |
| Separación de los dos RUC | CT-001 | RN-FIS-001…010 | RF-ACC-010…014; RF-PAG-004, RF-PAG-009…010; RF-REP-008 | CU-003, CU-012…013, CU-017…020, CU-026 | UI-014…017, UI-053…063, UI-070…084 | EntidadFiscal, DocumentoInterno, CierreDiario |
| Clientes compartidos | DP-008 (Cliente) | RN-CLI-001…003, RN-CLI-008 | RF-CLI-001…005, RF-CLI-012 | CU-004 | UI-020…022 | Cliente |
| Vehículos y propiedad | DP-008 (Vehículo); DM-003 V1 | RN-CLI-004…009 | RF-CLI-006…011 | CU-005 | UI-021, UI-023…025 | Vehiculo, PeriodoPropiedad |
| Marcas de vehículo | DP-008 (Marcas) | RN-CLI-006 | RF-CLI-013 | CU-005 | UI-033 | MarcaVehiculo |
| Productos, presentaciones y marcas | DP-009, DP-017 | RN-CAT-001…004, RN-CAT-006…007, RN-CAT-011…013, RN-CAT-016 | RF-CAT-001…007, RF-CAT-009, RF-CAT-013…016 | CU-006 | UI-030…033 | Producto, Presentacion, Cantidad, catálogos de marca |
| Servicios referenciales | DP-020 | RN-CAT-008…009 | RF-CAT-010…011; RF-TAL-005…006 | CU-016, CU-017 | UI-034…035, UI-071…072 | Servicio, ServicioAplicado |
| Proveedores e ingresos | DP-011 | RN-CAT-010, RN-CAT-015; RN-INV-003…007 | RF-CAT-012; RF-INV-001…005, RF-INV-014 | CU-007 | UI-036…042 | Proveedor, IngresoMercaderia, LineaIngreso |
| Existencia y Kardex | DP-001, DP-002 | RN-INV-001…002, RN-INV-008, RN-INV-010…016 | RF-INV-006…014; RF-REP-001…002 | CU-008, CU-009, CU-012 | UI-031, UI-043…046, UI-054…055 | PosicionInventario, MovimientoKardex, AjusteInventario |
| Kits comprados y desarme | DP-010 | RN-CAT-005…006, RN-CAT-014; RN-INV-019…020 | RF-CAT-008; RF-INV-016 | CU-006, CU-022 | UI-031…032, UI-047 | DesarmeKit, ComponenteObtenido |
| Reserva de mantenimiento | DP-012, DP-021 | RN-INV-017…018; RN-TAL-011…014, RN-TAL-020 | RF-INV-012, RF-INV-015; RF-TAL-010…013 | CU-018, CU-019 | UI-043, UI-054, UI-074…076 | ReservaInventario, Venta, Mantenimiento |
| Proformas | DP-004 | RN-PRO-001…008; RN-VEN-017 | RF-PRO-001…011; RF-VEN-014 | CU-010, CU-011 | UI-050…052 | Proforma, LineaProforma |
| Ventas e historia económica | DP-004, DP-017 | RN-VEN-001…007, RN-VEN-017…018 | RF-VEN-001…010, RF-VEN-014…016 | CU-011, CU-012, CU-015 | UI-053…055, UI-058 | Venta, LineaVenta, ImpuestoAplicado, DocumentoInterno |
| Crédito, pagos y saldos | DP-003, DP-013 | RN-VEN-008…014, RN-VEN-019 | RF-PAG-001…012 | CU-013, CU-015 | UI-060…063 | ImporteExigible, Pago, PartePago |
| Devoluciones y reembolsos | DP-014 | RN-INV-012; RN-VEN-015…016, RN-VEN-019…021 | RF-VEN-011…013, RF-VEN-017…018; RF-PAG-008 | CU-014, CU-015 | UI-056…057, UI-063 | DevolucionCliente, LineaDevolucionCliente, Reembolso |
| Mantenimientos e intervenciones | DP-007, DP-015, DP-020, DP-021 | RN-TAL-001…020 | RF-TAL-001…020 | CU-017…019, CU-024 | UI-070…078 | Mantenimiento, Intervencion, OperacionArtesanal |
| Consumo interno y repuesto aportado | DP-016 | RN-INV-021; RN-TAL-021 | RF-INV-017; RF-TAL-021 | CU-017, CU-023 | UI-048, UI-071 | ConsumoInterno; observación del mantenimiento |
| Reposición por corrección | DP-015 | RN-INV-022; RN-TAL-017…020 | RF-INV-018; RF-TAL-016, RF-TAL-020 | CU-019, CU-024 | UI-048, UI-075, UI-078 | ReposicionCorreccion, Intervencion correctiva |
| Devolución a proveedor | DP-011 | RN-INV-023 | RF-INV-019 | CU-025 | UI-049 | DevolucionProveedor |
| Documentos internos y futura referencia SRI | DP-006, DP-018 | RN-CON-001…003, RN-CON-009…010 | RF-PRO-010; RF-VEN-015; RF-REP-014 | CU-003, CU-010, CU-012, CU-017 | UI-016, UI-058, UI-077 | DocumentoInterno, ReferenciaFiscalFutura |
| Auditoría, cierres y reportes | DP-019 | RN-CON-004…008, RN-CON-011…013 | RF-REP-001…013; RF-AUD-001…006 | CU-020, CU-026 | UI-018, UI-080…084 | CierreDiario y eventos de negocio |

## 3. Requisitos no funcionales

| Grupo | Procesos afectados | Evidencia futura |
|---|---|---|
| RNF-SEG-001…012 | Autenticación, permisos, archivos, configuración y despliegue | Pruebas de seguridad y autorización. |
| RNF-INT-001…010 | Ingresos, reservas, kits, ventas, pagos, devoluciones, secuencias y correcciones | Pruebas transaccionales, de idempotencia y concurrencia. |
| RNF-REN-001…007 | Consultas, reportes y archivos | Pruebas con datos representativos. |
| RNF-DIS-001…008 | Servidor local, base de datos, archivos y actualizaciones | Evidencia de respaldo, restauración y recuperación. |
| RNF-USA-001…012 | Pantallas y documentos internos | Validación de usabilidad y accesibilidad. |
| RNF-COM-001…006 | Navegadores, API y configuración | Matriz de compatibilidad. |
| RNF-MAN-001…010 | Código, documentación, API, pruebas y ADR | Revisión, análisis estático y cobertura futura. |
| RNF-AUD-001…006 | Auditoría funcional y registros técnicos | Pruebas de trazabilidad y retención. |
| RNF-DAT-001…005 | Datos personales, exportaciones y pruebas | Revisión de minimización, permisos y anonimización. |

## 4. Decisiones confirmadas y pendientes

| Clasificación | Elementos | Consecuencia documental |
|---|---|---|
| Confirmadas | DP-001…004, DP-006…021, CT-001 y DM-003 V1 | Se aplican como línea base; no deben figurar como preguntas abiertas. |
| Pendientes | DA-002, DA-003, DM-001 | Se conservan sin inventar una solución técnica. |
| Validación externa | tratamiento fiscal de consumos y reposiciones; tarifas, clasificación, redondeo y facturación futura | Debe resolverlo un contador o la normativa ecuatoriana aplicable antes de especificar el comportamiento fiscal. |

## 5. Capacidades OpenSpec

| Código | Capacidad | Cobertura principal |
|---|---|---|
| SPEC-IDENTIDAD | Identidad y acceso (implementada; pendiente de verificación final y archivo) | RF-ACC-001…009; RF-AUD-001, 003, 005 |
| SPEC-CONFIG | Entidades y parámetros | RF-ACC-010…014 |
| SPEC-CLIENTES | Clientes, vehículos, propiedad y marcas de vehículo (implementados en el alcance de `gestionar-clientes-y-vehiculos`; excluyen el historial de mantenimientos y documentos, `RF-CLI-011` —el historial de mantenimientos lo cubre `gestionar-ordenes-mantenimiento`—, y saldos por RUC de `UI-021`); evidencia en [cobertura-clientes-vehiculos.md](cobertura-clientes-vehiculos.md) | RF-CLI-001…013 |
| SPEC-CATALOGOS | Productos, servicios y proveedores (implementados en el alcance de catálogos; excluyen existencias, costos y disponibilidad) | RF-CAT-001…016; evidencia en [cobertura-catalogos.md](cobertura-catalogos.md) |
| SPEC-INVENTARIO | Ingresos, existencias, reservas y Kardex (implementados parcialmente en `gestionar-compras-entradas-inventario-kardex`: cobertura de RF-INV-001…010, 012…014; pendientes RF-INV-011 y las evidencias adjuntas, RF-INV-015…019); evidencia en [cobertura-compras-inventario.md](cobertura-compras-inventario.md) | RF-INV-001…019 |
| SPEC-PROFORMAS | Proformas | RF-PRO-001…011 |
| SPEC-VENTAS | Ventas, devoluciones y reembolsos (implementados en `gestionar-ventas-pagos-credito-simple` para ventas directas comerciales: RF-VEN-001, 003…015, 017, 018; pendientes RF-VEN-002 y RF-VEN-016); evidencia en [cobertura-ventas-pagos.md](cobertura-ventas-pagos.md) | RF-VEN-001…018 |
| SPEC-PAGOS | Pagos y cuentas por cobrar (implementados en el alcance comercial: RF-PAG-001…009, 011, 012 y RF-REP-006 comercial; pendiente RF-PAG-010, que depende de taller) | RF-PAG-001…012 |
| SPEC-TALLER | Servicios, mantenimientos y correcciones (implementados en `gestionar-ordenes-mantenimiento` para órdenes, intervenciones correctivas, servicios con precio aplicado, fotografías e historial: RF-TAL-001…007, 013, 015…021 y RF-CLI-011; pendientes RF-TAL-008…012 y RF-TAL-014); evidencia en [cobertura-mantenimientos.md](cobertura-mantenimientos.md) | RF-TAL-001…021 |
| SPEC-REPORTES | Reportes, documentos y cierres | RF-REP-001…014 |
| SPEC-AUDITORIA | Auditoría y correcciones | RF-AUD-001…006 |

El cambio activo `openspec/changes/archive/2026-09-13-gestion-usuarios-autenticacion-roles/` implementa únicamente identidad, autenticación, roles, autorización y su auditoría. No constituye implementación de clientes, catálogos, inventario, ventas ni mantenimiento.

El cambio activo `openspec/changes/gestionar-ordenes-mantenimiento` implementa las capacidades `ordenes-de-mantenimiento`, `servicios-aplicados-al-mantenimiento`, `fotografias-de-mantenimiento` e `historial-de-mantenimientos` (29 requisitos y 88 escenarios). No implementa cancelación, repuestos, ventas vinculadas, operación artesanal económica, pagos ni facturación. Su evidencia está en [cobertura-mantenimientos.md](cobertura-mantenimientos.md); su archivo y la sincronización de specs principales quedan para el flujo autorizado.

El cambio activo `openspec/changes/gestionar-compras-entradas-inventario-kardex` implementa las capacidades `compras-e-ingresos-de-mercaderia`, `existencias-y-ajustes-de-inventario` y `kardex-de-productos` (29 requisitos y 105 escenarios). No implementa alertas de umbral, adjuntos, ventas, mantenimientos ni pagos. Su evidencia está en [cobertura-compras-inventario.md](cobertura-compras-inventario.md); su archivo y la sincronización de specs principales quedan para el flujo autorizado.

El cambio activo `openspec/changes/gestionar-catalogos-productos-servicios-proveedores` implementa las capacidades `catalogo-de-productos-y-categorias`, `catalogo-de-servicios` y `catalogo-de-proveedores` (24 requisitos y 126 escenarios). No implementa inventario, compras, ventas, mantenimientos ni costos. Su inventario de escenarios y evidencia está en [cobertura-catalogos.md](cobertura-catalogos.md); su archivo y la sincronización de specs principales quedan para el flujo autorizado.

El cambio activo `openspec/changes/gestionar-ventas-pagos-credito-simple` implementa las capacidades `ventas-comerciales`, `pagos-comerciales-y-credito-simple` y `correcciones-de-ventas-y-reembolsos` (24 requisitos y 105 escenarios). No implementa proformas, ventas vinculadas a mantenimiento, reservas, cobros artesanales, cierres diarios, contabilidad ni facturación electrónica. Su evidencia está en [cobertura-ventas-pagos.md](cobertura-ventas-pagos.md); su archivo y la sincronización de specs principales quedan para el flujo autorizado.

## 6. Controles de cobertura

Antes de implementar una capacidad:

1. cada regla aplicable debe estar conectada con un requisito y un escenario verificable;
2. los permisos positivos y negativos deben estar definidos;
3. dinero, inventario y secuencias deben cubrir atomicidad, concurrencia e idempotencia;
4. no debe quedar una decisión de negocio abierta que cambie materialmente el flujo;
5. la futura API, el modelo de datos y las pruebas deben trazarse sin cambiar el significado conceptual aprobado.


## Rediseño visual Tallkit

El cambio `redisenar-sistema-visual-tallkit` sustituye la dirección SAAS Dashboard y cancela `aplicar-catalogo-visual-frontend`. Solo cambia la presentación: permisos, rutas previas, API y datos no cambian. Las rutas nuevas de formulario (`/products`, `/customers`, `/vehicles` y `/suppliers` con `/new` y `/:id/edit`) reutilizan el permiso de la acción existente.

| Requisito | Origen | Evidencia |
|---|---|---|
| PPF-01 Patrón de lista | RNF-USA-002, 006, 011; sección 4 | `SalesPage.test.tsx`, `PurchasesPage.test.tsx`, `InventoryPage.test.tsx`; `e2e/responsive.spec.ts` |
| PPF-02 Ficha de detalle | RNF-USA-006, 010; secciones 6 y 9 | `VehicleDetailPage.test.tsx`, `PurchaseDetailPage.test.tsx`, `SaleDetailPage.test.tsx` |
| PPF-03 Formulario por secciones en página | RNF-USA-004, 005, 007; sección 5 | `catalog-routes.test.tsx` y pruebas de ruta y permisos de las páginas nuevas; `ProductEditorPage.test.tsx` |
| PPF-04 Formulario corto en modal | RNF-USA-004, 005, 007 | `FormModal.test.tsx`, `VehicleBrandsPage.test.tsx`, `UsersPage.test.tsx`; `e2e/feedback.spec.ts` |
| PPF-05 Editor con vista previa | DP-004, DP-017, DP-018, DP-025, DP-026; RNF-USA-010, 012 | `SaleEditorPage.test.tsx`, `PurchaseEditorPage.test.tsx`, `DocumentSheet.test.tsx` |
| PPF-06 Diálogos de confirmación | RNF-USA-003, 006; sección 8.1; DP-027, DP-028 | `dialogs.test.tsx`, `SaleReviewDialog.test.tsx`, `PurchaseDetailPage.test.tsx` |
| PPF-07 Estados de contenido | RNF-USA-004, 006; sección 4 | `states.test.tsx`, pruebas de carga, error, vacío y sin resultados de cada lista |
| PPF-08 Notificación temporal | RNF-USA-004, 006, 007; sección 8.2 | `Toast.test.tsx`; `e2e/feedback.spec.ts` |
| Identidad, tokens y piezas del taller (`sistema-visual-frontend`) | RNF-USA-008, 009; RNF-MAN-003 | `tokens.test.ts`, `legacy-guard.test.ts`, `business.test.tsx`; `e2e/visual-system.spec.ts` |
| Navegación, modales, listas y formularios adaptables (`experiencia-adaptable-frontend`) | RNF-USA-001, 002, 007; RNF-COM-001, 002 | `AuthenticatedShell.test.tsx`, `NavigationPanel.test.tsx`; `e2e/responsive.spec.ts` con `axe` en 360, 768, 1024, 1280 y 1440 px |
| Catálogo de componentes y patrones Tallkit (`catalogo-visual-reutilizable`) | RNF-MAN-005 | `registry.test.ts`, `CatalogApp.test.tsx`; `e2e/catalog/` |

Secciones de `interfaz-y-navegacion.md` modificadas: 2.1 (marco y navegación por tamaño), 8.1 (textos breves de botones), 8.2 (éxito mediante toast) y 10 (modal o página, filas compactas). La aceptación visual final del usuario sigue pendiente.
