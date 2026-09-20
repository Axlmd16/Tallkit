## Why

El sistema dispone de identidad, clientes/vehículos y configuración operativa y fiscal, pero aún no ofrece catálogos persistentes de productos, categorías, servicios y proveedores. Esta capacidad prepara los datos maestros necesarios para futuras compras, ventas y mantenimientos sin adelantar sus operaciones económicas ni movimientos de inventario.

Estado: propuesta para revisión; no aprobada. Fecha: 2026-09-20.

## What Changes

- Crear, listar, consultar, editar, desactivar y reactivar categorías planas, productos, servicios y proveedores; conservar identidad y referencias, sin eliminación física ordinaria.
- Categorías con nombre obligatorio, descripción opcional y estado; prevenir duplicados por nombre normalizado, incluidos registros inactivos.
- **Producto** con código único, nombre, descripción opcional, categoría, **presentación** completa expresada mediante cantidad y unidad, **precio final de catálogo** y estado. Cada presentación vendible diferente es otro producto, sin variantes ni conversión automática.
- Incorporar los apoyos que sí exige la documentación: unidades de medida administrables, marcas de producto opcionales y compatibilidades informativas con las marcas de vehículo existentes. Mantener separadas ambas clases de marca. Incluir únicamente la identificación de **kit** comprado como producto completo; no sus componentes ni desarme. No añadir compatibilidad por modelos/años ni código de barras.
- Buscar productos por código y nombre; combinar filtros por categoría, estado, marca de producto y marca de vehículo. Usar paginación del servidor y conservar el contexto de consulta.
- **Servicio** separado del producto: nombre obligatorio, descripción opcional, **precio referencial** y estado; búsqueda por nombre, estado y paginación. No se exige código de servicio porque las fuentes no lo requieren. Su precio final incluye el impuesto aplicable y podrá cambiarse en futuros mantenimientos sin modificar el catálogo ni la historia. No maneja existencias.
- **Proveedor** del ámbito comercial con nombre o razón social obligatorio; identificación y contacto opcionales conforme al modelo aprobado y DP-011. Si se informa identificación, exigir el par tipo/documento, reutilizar CI de 10 caracteres o RUC de 13 y prevenir duplicados del par. Teléfono, correo y dirección son opcionales; no trasladar la obligatoriedad de teléfono de Cliente. Los nombres coincidentes sin identificación producen advertencia, no una falsa identidad única. Búsqueda por nombre/documento, filtro por estado y paginación.
- Reutilizar la **entidad fiscal** y los impuestos configurados, sin copiar RUC, tarifas, bodega ni secuenciales. El catálogo no constituye una operación confirmada ni consume numeración. Cada producto o servicio tendrá una selección tributaria explícita de su ámbito; no se asumirá una tarifa común, ni exención por omisión.
- Aplicar permisos vigentes en servidor y presentación; mantener sesión, CSRF, unión de roles y denegación por defecto. Integrar navegación, formularios, consultas, confirmaciones, errores por campo y estados de carga/vacío/error/éxito con el sistema visual existente.

### Permisos existentes

| Operación | Administrador | Vendedor | Encargado del taller |
|---|---|---|---|
| Consultar productos, categorías, marcas de producto y unidades | Sí | Sí | Sí |
| Crear/editar productos y catálogos auxiliares | Sí | No | No |
| Cambiar precio, desactivar/reactivar productos y auxiliares | Sí | No | No |
| Consultar servicios | Sí | Sí | Sí |
| Crear/editar/desactivar/reactivar servicios y precio referencial | Sí | No | Sí |
| Consultar y administrar proveedores | Sí | No | No |

Los permisos son `productos.ver`, `productos.gestionar`, `productos.cambiar_precio`, `productos.desactivar`, `servicios.ver`, `servicios.gestionar`, `proveedores.ver` y `proveedores.gestionar`. Los auxiliares se administran mediante `productos.gestionar`. No se cambian los permisos de marcas de vehículo aprobados en DP-008. No se exponen costos a roles operativos.

### Decisiones confirmadas

- DP-009: presentaciones completas e independientes; sin fraccionamiento.
- DP-010: kit comprado completo; su operación de desarme queda fuera de esta entrega.
- DP-011 y modelo conceptual §5.1: proveedor liviano; no exigir identificación ni contacto para poder registrarlo.
- DP-017: precios finales con impuestos incluidos cuando apliquen, sin alterar documentos históricos.
- DP-020: precio de servicios referencial y ajustable en la operación artesanal futura.
- CT-001 y matriz de roles: tres roles fijos acumulables y separación comercial/artesanal.

### Recomendaciones para aprobar antes de specs

1. **Precisión de precios:** admitir importes no negativos en USD con hasta dos decimales y rechazar precisión excedida, sin truncar ni redondear silenciosamente. El cero es válido porque RN-CAT-007 prohíbe negativos, no cero. Esta política solo cubre captura de precios; no decide todavía redondeo de bases, impuestos, costos o documentos. Alternativa: permitir más decimales en precios, que exigiría concretar escala y presentación.
2. **Categorías con productos:** impedir desactivar una categoría mientras tenga productos activos. Informar el motivo para que el Administrador los reclasifique o desactive explícitamente. Con productos únicamente inactivos, permitir la baja conservando las asociaciones. Reactivar un producto exige categoría activa. No realizar cambios en cascada. Alternativa: permitir categorías inactivas con productos activos, que complica selección y clasificación.
3. **Otras referencias inactivas:** impedir nuevas selecciones de unidades, marcas o compatibilidades inactivas; conservar referencias existentes al editar campos ajenos y mantenerlas legibles. La baja de estos auxiliares no desactiva productos. Las operaciones futuras deberán validar el estado del producto, servicio o proveedor al seleccionarlo y confirmarlo.
4. **Selección tributaria:** exigir una definición de impuesto configurada para el ámbito correspondiente, admitiendo las definiciones con tarifa cero expresamente configuradas. Guardar la elección del catálogo sin fijar para siempre una vigencia ni generar usos históricos. Cambiar la tarifa no recalcula automáticamente el precio final. Si se necesitan tratamientos sin una definición tributaria, resolverlos explícitamente antes de specs; no convertir ausencia de configuración en exención.

### Fuera de alcance

Compras, recepción, ingresos, salidas, ajustes, reservas, **Kardex**, capturas de stock, existencias iniciales, costo promedio, costos de referencia manuales, disponibilidad y alertas de stock; ventas, proformas, pagos, crédito, descuentos, mantenimientos, consumo de repuestos, desarmes o armado de kits, devoluciones, reportes y facturación electrónica. No se mostrarán existencias cero ficticias ni indicadores simulados. No se crea relación producto-proveedor: el modelo relaciona proveedor con ingreso, no impone proveedor único al producto. No se duplican marcas de vehículo ni se rediseñan funcionalidades previas.

## Capabilities

### New Capabilities

- `catalogo-de-productos-y-categorias`: categorías, productos por presentación, unidades, marcas de producto, compatibilidad por marca de vehículo, consultas, permisos, precios e integración fiscal sin stock.
- `catalogo-de-servicios`: servicios referenciales del ámbito artesanal, estados, búsquedas, permisos e integración fiscal.
- `catalogo-de-proveedores`: proveedores comerciales, datos mínimos, identificación opcional, consultas, duplicados y conservación de referencias.

### Modified Capabilities

Ninguna spec principal cambia sus reglas en esta propuesta. Las nuevas capacidades concretan `modelo-dominio-taller` y consumen `autorizacion-y-navegacion`, `configuracion-operativa-y-fiscal` y el sistema visual. Cualquier modificación normativa necesaria se declarará antes de aprobar specs.

## Impact

### Reutilización e impacto esperado

Se reutilizan `backend/src/identity/` (permisos y sesión), las reglas pertinentes de identificación de `backend/src/customer_registry/`, su catálogo de marcas de vehículo y `backend/src/workshop_configuration/`. No se sustituye ninguna capacidad previa. La inspección no encontró modelos de producto, categoría de producto, servicio o proveedor existentes.

El futuro diseño definirá persistencia, relaciones, restricciones, migraciones que preserven datos y contratos de la API; no se crean tablas ni se modifica el modelo de datos durante la propuesta. Las escrituras entre módulos respetarán el **monolito modular** y sus interfaces públicas. El catálogo debe consultar opciones tributarias sin conceder administración fiscal a roles operativos ni crear efectos de una confirmación económica.

En frontend se integrarán `frontend/src/app/`, pantallas y capacidades nuevas con `shared/ui`, el cliente HTTP y TanStack Query. Se reutilizarán Nunito, tokens, formularios en drawer, confirmaciones, listas adaptables, filtros y paginación de `DESIGN.md`; no se requiere una nueva biblioteca ni una consulta externa de diseño para redactar esta propuesta.

### Dependencias, contradicciones y riesgos

- La rama actual es `develop`; `.opencode/` es un directorio ajeno sin seguimiento que se preserva. Esta propuesta queda como borrador local. No se autorizó commit, rama, merge, push ni despliegue.
- Identidad y configuración tienen cambios archivados. `gestionar-clientes-y-vehiculos` sigue activo con 42/49 tareas, y `aplicar-catalogo-visual-frontend` con 20/28 según `openspec list --json`. Su código existente no demuestra cierre: faltan verificaciones/documentación y aceptación visual en sus respectivos registros. No se marcarán como cerrados desde este cambio; antes del diseño se revisarán íntegramente sus contratos y artefactos relacionados.
- AGENTS, README y arquitectura inicial aún contienen descripciones de capacidades no implementadas que contradicen la presencia de clientes y configuración. Se registra la brecha; no se toma esa descripción como requisito para reconstruirlos.
- El pedido condiciona marcas, compatibilidades y kits a que estén documentados: sí lo están en la spec principal y RF-CAT. Se incluye su parte de catálogo; las operaciones de inventario continúan excluidas. No se presenta como cumplida la totalidad de RF-CAT-004/005 relativa a disponibilidad, existencias y costos.
- El modelo y decisiones dejan pendiente una política monetaria; la precisión de cuatro decimales de `TaxPeriod.rate` es una tarifa, no una política de precios. La recomendación anterior necesita aprobación.
- Las reglas de identificación de clientes validan longitud y conservan ceros iniciales; las de RUC de configuración fiscal exigen dígitos ASCII. Se propone reutilizar el contrato de personas para proveedores, sin afirmar validación ante el SRI ni introducir dígitos verificadores.
- No hay política documentada de baja de categoría con productos: se propone el bloqueo explícito anterior. Tampoco hay una relación obligatoria producto-proveedor que justifique añadirla.
- Riesgos a verificar: duplicados concurrentes, selección de inactivos, pérdida de cambios por edición simultánea, exposición de costos/datos de proveedores, confusión de ámbito fiscal y regresiones visuales. La política tributaria real continúa a cargo del negocio; esta propuesta no fija tasas legales.

### Fuentes consultadas y trazabilidad

- `AGENTS.md`, `AGENTS-glossary-reference.md`, `openspec/config.yaml`, instrucciones reales de `openspec status` e `instructions proposal`; skills de creación/continuación OpenSpec y disciplina Git.
- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`, completos: DP-009/010/011/017/020, CT-001 y fronteras de catálogos/abastecimiento/inventario.
- `openspec/specs/modelo-dominio-taller/spec.md`, `autorizacion-y-navegacion/spec.md`, `configuracion-operativa-y-fiscal/spec.md` y spec activa `catalogo-de-marcas-de-vehiculo`.
- `docs/negocio/producto/alcance-v1.md`, reglas RN-CAT-001…016 y glosario del producto; `actores-y-roles.md`, RF-CAT-001…016, CU-006/CU-016, UI-030…037, matriz de trazabilidad y RNF-INT-005…010, RNF-REN-005…006, RNF-USA-001…011.
- `docs/tecnico/arquitectura-inicial.md`, glosario técnico, ADR-0001, ADR-0003 y ADR-0004; `README.md` y `DESIGN.md`.
- Propuesta y estado de tareas de `gestionar-clientes-y-vehiculos`, tareas de `aplicar-catalogo-visual-frontend`; inspección de modelos y validación de clientes, permisos de identidad, resolución y precisión tributaria, rutas React, exportaciones UI, pantalla de marcas y existencia de suites backend/frontend/E2E. Esto no equivale a ejecutar esas pruebas ni verificar capacidades anteriores.

### Verificación y sincronización previstas

Las specs cubrirán operaciones y errores de cada catálogo, matriz completa de permisos y unión de roles, unicidad concurrente, importes, relaciones, filtros/paginación, inactivos e integración fiscal. El diseño y tareas organizarán **TDD**, migraciones en PostgreSQL, pruebas de API y presentación, prevención de doble envío, ausencia de escrituras de stock y regresión de las tres capacidades anteriores.

Durante las fases aprobadas se actualizarán **Contrato OpenAPI**, documentación, trazabilidad, glosarios y referencias; las specs principales se sincronizarán conforme al flujo autorizado. La verificación final incluirá `make check`, `make test`, `make audit`, chequeo de migraciones, build, E2E pertinentes y `openspec validate --all --strict`, con resultados reales. La propuesta por sí sola no permite ejecutar ni dar por cumplida esa aceptación.

### Aprobación requerida

`openspec/config.yaml` exige aprobación explícita de proposal antes de specs, luego de specs antes de design, design antes de tasks y tasks antes de apply. `AGENTS.md` exige registrar cada artefacto aprobado en `master` antes de depender de él. La solicitud inicial autoriza preparar esta propuesta, pero conserva expresamente estas aprobaciones obligatorias.

Se solicita revisar alcance y recomendaciones, comenzando por la precisión monetaria. Antes de crear specs se requiere aprobación explícita de la propuesta y su registro en `master` mediante una operación Git autorizada. No se crean specs, diseño, tareas, código ni migraciones anticipadamente.

### Evidencia de esta fase

- `openspec status --change gestionar-catalogos-productos-servicios-proveedores --json`: reconoce proposal; 1/4 artefactos creados. El estado `done` significa archivo presente, no aprobación humana. Aunque el esquema genérico habilita design y specs simultáneamente, prevalece el orden de `openspec/config.yaml`.
- `openspec validate gestionar-catalogos-productos-servicios-proveedores --strict --no-interactive --json`: falla con un único error, ausencia de deltas. No se crean specs sin aprobación para evitar ese resultado; el cambio todavía no está validado íntegramente.
- No se ejecutaron pruebas, build ni migraciones porque esta fase solo crea la propuesta y su referencia terminológica.
