## Context

Diseño para revisión, 2026-09-20. La petición explícita de continuar a este artefacto se recibe después de registrar las tres specs en `master`; la comparación de los artefactos entre `master` y el árbol actual no presenta diferencias. La propuesta conserva su etiqueta histórica de borrador, pero las solicitudes posteriores de continuación autorizaron desarrollar sus recomendaciones. Este diseño no está aprobado ni autoriza implementación.

El código real ya dispone de `identity`, `customer_registry` y `workshop_configuration`; no existen productos, categorías, servicios ni proveedores persistentes. Clientes usa servicios, versiones y auditoría transaccional; configuración dispone de `ConfigurationCommand` e impuestos por definición/vigencia. La API de impuestos existente exige `parametros.gestionar`, por lo que no puede consumirse directamente desde los formularios del Encargado del taller. React dispone de `ApiClient`, `ProblemError`, TanStack Query, guards y componentes de listas, campos, paneles y confirmaciones.

Gobiernan las tres specs de este cambio: 24 requisitos y 126 escenarios. Se mantienen precios finales USD con dos decimales, proveedor con solo nombre obligatorio, administración de servicios por Administrador/Encargado, consulta de proveedores exclusiva del Administrador y bloqueo de baja de categorías con productos activos. Las tarifas tributarias configuradas no determinan automáticamente el precio final.

## Goals / Non-Goals

**Goals:** construir catálogos persistentes con límites modulares, contratos completos, referencias protegidas, autorización por acción, auditoría, **idempotencia**, control de **concurrencia** y experiencia visual existente. Preparar consultas públicas para consumidores futuros sin implementar esos consumidores.

**Non-Goals:** compras, inventario, costos, saldos, ventas, mantenimientos, documentos fiscales o internos, desarme, variantes, jerarquías, migración desde Flutter, roles nuevos, dependencias nuevas y refactorización general de funcionalidades anteriores. No se crean modelos, migraciones ni se modifica `modelo-datos.md` durante esta fase.

## Decisions

### 1. Fronteras y rutas de implementación

Crear dos aplicaciones propuestas, siguiendo las fronteras del **modelo de dominio** y el **monolito modular** vigente:

| Ruta nueva | Responsabilidad |
|---|---|
| `backend/src/catalog/` | Productos, categorías, unidades, marcas de producto, compatibilidades y servicios; productos y servicios tienen modelos y casos de uso distintos. |
| `backend/src/supplier_registry/` | Proveedores; no depende del catálogo ni contiene ingresos o cuentas por pagar. |

En cada aplicación: `apps.py`, `models.py`, `migrations/`, `domain/validation.py`, `domain/errors.py`, `application/queries.py`, `application/commands.py`, `api/serializers.py`, `api/views.py` y `api/urls.py`. Casos de uso específicos de catálogo en `application/products.py`, `auxiliaries.py` y `services.py`; proveedores en `application/suppliers.py`. Crear solo archivos con responsabilidad implementada, sin capas vacías.

`config/settings/base.py` registra ambas aplicaciones y `config/api/urls.py` monta sus rutas. Las reglas puras trabajan con valores y no importan Django, DRF ni HTTP; aplicación coordina persistencia, permisos y transacciones. Los adaptadores no deciden invariantes.

Reutilizar `identity.application.authorization.require_permission`, `identity.application.audit.record_audit_event`, `identity.api.permissions.HasBusinessPermission` y `config.api.errors.problem_response`. No escribir directamente usuarios, roles ni eventos ajenos.

Publicar adaptadores estrechos nuevos en `customer_registry/application/catalog_references.py` para consultar/bloquear marcas de vehículo y validar referencias, y en `customer_registry/domain/identification.py` para reexportar las reglas puras CI/RUC existentes. Proveedores reutiliza estas reglas sin exigir `person_type`, teléfono ni crear un Cliente. No mover ni cambiar las validaciones de clientes; los errores se traducen al vocabulario del proveedor en su frontera.

Alternativas descartadas: un módulo universal de cualquier catálogo diluye proveedores/abastecimiento; un módulo por tabla añade capas sin necesidad; duplicar marcas de vehículo rompe referencias. Dos módulos funcionales conservan fronteras sin cambiar los contenedores desplegables.

### 2. Persistencia limitada a las capacidades aprobadas

Todos los registros editables tienen clave numérica autogenerada, `is_active=True`, `version=1`, `created_at` y `updated_at` conscientes de zona horaria. Relaciones de negocio con `PROTECT`; sin registro editable en Django Admin ni operación DELETE. Los nombres se conservan con capitalización de presentación y sin espacios exteriores.

| Modelo propuesto | Datos | Restricciones persistentes |
|---|---|---|
| `catalog.ProductCategory` | `name` 255; `description` opcional 2000 | Nombre no vacío; unicidad de nombre normalizado incluso inactivo. Sin padre. |
| `catalog.MeasurementUnit` | `name` 255; `symbol` opcional 32 | Nombre no vacío y único normalizado. Símbolo descriptivo, no conversión ni precisión de inventario. |
| `catalog.ProductBrand` | `name` 255 | Nombre no vacío y único normalizado, independiente de marcas de vehículo. |
| `catalog.Product` | `code` 64; `name` 255; `description` opcional 2000; categoría y unidad obligatorias; `content_quantity`; marca de producto opcional; `sale_price`; `is_kit=False`; `tax_definition` obligatoria | Código normalizado único incluidos inactivos; nombre/código no vacíos; contenido positivo; precio no negativo; referencias protegidas. |
| `catalog.ProductCompatibility` | producto y marca de vehículo | Par único, ambas referencias protegidas; no modelo/año, composición ni estado propio. |
| `catalog.Service` | `name` 255; `description` opcional 2000; `reference_price`; `tax_definition` obligatoria | Nombre no vacío; precio no negativo. Sin código ni unicidad de nombre. |
| `supplier_registry.Supplier` | `name` 255; tipo/documento opcionales; `phone` 64, `email` 254, `address` 1024 opcionales | Nombre no vacío; ambos campos de identidad ausentes o ambos presentes; CI 10/RUC 13 caracteres; par único solo cuando está informado. |
| `catalog.CatalogCommand` / `supplier_registry.SupplierCommand` | actor protegido, acción 64, clave 128, huella 64, estado HTTP y resultado JSON, fecha | Único por actor/acción/clave; recibos internos no editables ni expuestos por listados. |

Normalización de nombres únicos: `strip` y comparación con `Lower(Trim(name))` en PostgreSQL; no quitar acentos, guiones ni espacios interiores ni usar igualdad difusa. La consulta previa es orientativa; la restricción de base decide la carrera. Código: `strip().upper()`, restricción de unicidad sobre expresión equivalente y validación previa de longitud después de normalizar; no limitarlo a un alfabeto más estrecho que lo aprobado. Casos de Unicode se probarán contra PostgreSQL para que la consulta de duplicados y la restricción coincidan.

Identificación del proveedor: ausencia de ambos campos como NULL; contacto y descripciones ausentes como cadena vacía. No normalizar el documento a número ni a mayúsculas. El tipo se normaliza a CI/RUC. Un `CheckConstraint` comprueba par/longitudes/tipos y la unicidad parcial incluye inactivos. No añadir dígito verificador ni restringir a dígitos ASCII, pues las specs adoptan el contrato de personas. La API admite vacíos como ausencia, pero rechaza un par incompleto.

Precios en `DecimalField(max_digits=14, decimal_places=2)`, intervalo de transporte 0 a 999999999999.99, enviados como cadena decimal ordinaria. Contenido de presentación en `DecimalField(max_digits=18, decimal_places=6)`, mayor que cero, hasta 999999999999.999999. Esta escala es un límite de almacenamiento de contenido, no una política de cantidades vendidas ni una conversión de unidades. Rechazar exceso de escala, números JSON, notación exponencial, NaN/infinito y valores fuera de rango antes de persistir; no delegar redondeo al campo decimal. No calcular importes en JavaScript. Los límites técnicos se publican en OpenAPI y formularios.

El ámbito de Product es siempre COMERCIAL y el de Service ARTESANAL; se deriva del tipo de registro y se valida contra `TaxDefinition.fiscal_entity`, sin duplicar RUC ni una columna fiscal mutable. Supplier es comercial por su capacidad y puede registrarse antes de completar configuración. Categorías/unidades/marcas tampoco requieren inicialización fiscal. Productos/servicios sí requieren la definición correspondiente. No existen columnas de stock, costos, saldos, proveedor único ni bodega en estas tablas.

La base refuerza unicidad y valores locales; reglas entre tablas (categoría activa o ámbito tributario) pertenecen al servicio. La persistencia no se ofrece como interfaz de escritura pública. Pruebas de frontera impiden que otros módulos omitan esos servicios.

Alternativa descartada: precio y contenido como flotantes o texto sin validación, o copiar la tarifa vigente al registro. Se perderían precisión, validación y evolución tributaria.

### 3. Colaboración fiscal de solo lectura

Añadir `workshop_configuration/application/catalog_options.py`, propiedad de configuración, con consultas públicas que devuelvan DTO inmutables:

- `list_catalog_tax_options(entity_type, search, page, page_size, operation_date)`: opciones de una sola entidad; `id`, `code`, `name`, `entity_type`, `rate` textual o NULL y `tax_status` (`applicable`, `missing`, `ambiguous`).
- `validate_catalog_tax_reference(tax_definition_id, expected_entity_type)`: confirma existencia/ámbito; no exige una vigencia hoy para guardar el catálogo.

Solo los servicios de aplicación de catálogo llaman estas interfaces después de autorizar al actor. No se amplían los permisos ni respuestas del endpoint administrativo de configuración. El endpoint de opciones comerciales exige `productos.gestionar`; el de opciones artesanales exige `servicios.gestionar`. Las fichas consultables exponen únicamente la selección tributaria propia y su estado, sin RUC, datos privados ni otras opciones de administración.

La fecha operativa procede del servidor en `America/Guayaquil`, no de un parámetro arbitrario del usuario. Para cada definición se consulta la vigencia con inicio <= fecha y fin ausente o >= fecha; cero es una tarifa válida, NULL con `missing` no lo es. Si aparecen varias, se devuelve `ambiguous` sin elegir una. Usar una consulta coherente/prefetch acotado por página, evitando una consulta por fila.

No llamar a `resolve_configuration` con identidad de consumidor ni a `allocate_number`: esos servicios corresponden a confirmaciones económicas bajo ADR-0004. Estas consultas no crean `ConfigurationUse`, no toman bloqueos de numeración ni afectan impuestos. La API de catálogo valida definiciones existentes cuyo ámbito es inmutable; una vigencia puede cambiar sin invalidar esa selección. La futura operación económica resolverá y congelará su propia tarifa al confirmar.

Alternativa descartada: permitir `parametros.gestionar` al Encargado, duplicar tasas en catálogo o llamar a una confirmación para llenar un selector. Ninguna es necesaria para consultar opciones.

### 4. Transacciones y orden de bloqueos

Cada escritura valida primero sesión/permisos y forma de entrada, reclama su recibo de comando y coordina sus cambios dentro de una única **transacción atómica**. Mutación efectiva incrementa `version`; exige `expected_version` en edición y estados. Fallo de relaciones o auditoría revierte también el recibo.

Orden común para comandos de producto, omitiendo filas no necesarias:

1. Recibo de comando propio.
2. Categorías antigua/nueva por ID ascendente.
3. Unidades antigua/nueva por ID ascendente.
4. Marcas de producto antigua/nueva por ID ascendente.
5. Marcas de vehículo involucradas por ID ascendente, mediante interfaz de `customer_registry`.
6. Producto y sus compatibilidades.

La lectura preliminar de referencias sirve únicamente para preparar el conjunto de bloqueos. Tras bloquear el producto, comprobar versión y referencias nuevamente; si cambiaron, abortar con `stale_record`, sin adquirir una categoría anterior en el orden. No bloquear primero producto para luego buscar su categoría.

La baja de categoría bloquea su fila y consulta si existen productos activos, sin bloquear esos productos. Toda alta, reclasificación o reactivación de producto bloquea las categorías correspondientes antes de validar su actividad y guardar. Esto serializa la carrera sin un bloqueo global. Baja de producto sigue el mismo orden; así una baja concurrente de categoría puede esperar y comprobar el resultado definitivo.

Unidades y marcas se bloquean al modificar su estado; los productos bloquean referencias al asociarlas. Conservar una referencia antigua inactiva al editar otro campo es válido. Nueva asociación exige activo, incluso si el producto se está creando inactivo por un intento de entrada no permitido. La reactivación de producto exige categoría activa; marcas/unidad conservadas pueden seguir inactivas según la regla de conservación aprobada. No se modifica el comportamiento de vehículos al desactivar sus marcas.

Servicios y proveedores bloquean su propia fila después del recibo. No bloquean documentos, inventario, clientes ni configuración fiscal. La creación no tiene fila previa: las restricciones únicas resuelven colisiones.

Comparar versión antes de aplicar una nueva solicitud. Con versión vigente y estado ya solicitado devolver 200 sin incrementar versión ni crear otro evento exitoso. Un reintento identificado se resuelve antes de comparar versión, devolviendo su resultado original. Una solicitud nueva obsoleta responde 409 aunque solicite el estado actual, para no ocultar cambios intermedios.

`IntegrityError` se traduce después de salir del bloque que falló, identificando la restricción concreta; errores desconocidos no se disfrazan de duplicidad. Los rechazos esperados se auditan después del rollback. Una caída de base solo puede dejar evidencia técnica correlacionada; no se promete auditoría persistida sin base disponible.

Alternativas descartadas: comprobar activos sin bloqueo permite carreras; bloquear toda la instalación serializa operaciones independientes; adquirir referencias después del producto puede introducir ciclos con bajas.

### 5. Idempotencia persistente de todos los comandos nuevos

Usar `idempotency_key` en el cuerpo, como configuración, con 8–128 caracteres ASCII `[A-Za-z0-9._:-]`. El alcance es actor, acción y clave; el objetivo, la versión esperada y todos los campos enviados forman la huella SHA-256 canónica, excluida la propia clave. Conservar diferencia entre campo omitido y borrado; ordenar IDs de compatibilidad porque representan un conjunto. No usar `request_id` como clave de negocio.

Al inicio de la transacción intentar insertar un recibo provisional con restricción única dentro de un savepoint. Dos solicitudes iguales compiten por esa restricción: el segundo insert espera al primero; si este confirma, el segundo revierte únicamente su savepoint y lee el recibo completado; si el primero revierte, el segundo puede reclamarlo. No confirmar recibos provisionales. Toda ruta exitosa completa resultado/estado antes del commit; toda excepción revierte la operación y el recibo. Una prueba fuerza el fallo entre creación del recibo y finalización.

Huella coincidente devuelve estado HTTP y respuesta original, aun si el registro cambió después; el frontend invalida y consulta el estado vigente al terminar. Huella diferente responde `409 idempotency_conflict`. La autorización vigente se comprueba también antes de reproducir un recibo para impedir filtraciones tras retirar permisos.

Los resultados almacenados pertenecen a cada módulo y pueden incluir los datos necesarios de la ficha; nunca se copian a auditoría/logs ni se exponen por un endpoint de recibos. Sin caducidad ni purga automática en V1. Proveedores requiere protección especial porque su respuesta contiene contacto. El plan operativo de retención sigue pendiente y no se resuelve aquí.

No se reutiliza ni escribe `ConfigurationCommand` desde otros módulos. Compartir únicamente funciones puras de formato de clave/canonicalización bajo un archivo propuesto `shared/command_values.py` con dos consumidores actuales; cada módulo conserva su recibo y transacción. No crear un motor genérico de CRUD o de comandos. La configuración existente no se refactoriza en esta entrega.

Alternativas descartadas: deduplicar solo por nombre impediría servicios homónimos; bloquear doble clic sin recibo no cubre respuesta perdida; un mutex de proceso no cubre varios workers.

### 6. Contrato HTTP y permisos

Todas las rutas bajo `/api/v1/`, con sesión y CSRF existentes. Los nombres internos/JSON siguen inglés y los textos visibles español.

| Recurso | Ruta base | Lectura | Alta/edición | Activar/desactivar |
|---|---|---|---|---|
| Producto | `products/` | `productos.ver` | `productos.gestionar`; cambiar precio de un producto existente exige además `productos.cambiar_precio` | `productos.desactivar` |
| Categoría | `product-categories/` | `productos.ver` | `productos.gestionar` | `productos.gestionar` |
| Unidad | `measurement-units/` | `productos.ver` | `productos.gestionar` | `productos.gestionar` |
| Marca de producto | `product-brands/` | `productos.ver` | `productos.gestionar` | `productos.gestionar` |
| Servicio | `services/` | `servicios.ver` | `servicios.gestionar` | `servicios.gestionar` |
| Proveedor | `suppliers/` | `proveedores.ver` | `proveedores.gestionar` | `proveedores.gestionar` |

Cada base: GET lista, POST alta; `<id>/`: GET ficha y PATCH parcial; `<id>/activate/` y `<id>/deactivate/`: POST con `expected_version` y `idempotency_key`. No PUT ni DELETE. PATCH no admite `is_active`, identidad fiscal ni metadatos de creación. Los campos desconocidos se rechazan explícitamente, incluidos stock, costos, saldos, categoría padre y proveedor único; DRF no debe descartarlos silenciosamente.

Altas reciben los campos de la tabla de datos y clave; estado se deriva activo. Product usa `category_id`, `unit_id`, `product_brand_id` nullable, `vehicle_brand_ids` lista sin duplicados, `tax_definition_id`, `content_quantity`, `sale_price` y `is_kit`. Service usa `reference_price` y `tax_definition_id`. Supplier usa `identification_type`/`identification`. PATCH distingue omisión de borrado, valida el registro completo resultante y requiere versión; listas de compatibilidad sustituyen el conjunto dentro de la misma transacción.

GET de ficha devuelve datos, ID, estado, versión, fechas, referencias mínimas `{id,name,is_active}` y, en producto/servicio, proyección tributaria `{id,code,name,entity_type,rate,tax_status}`. No incluye costos ni existencias. El precio se serializa a dos decimales como texto; cantidad también viaja como texto. No se consulta ni expone una historia económica inexistente.

Consultas: `search`, `is_active=true|false|all` (omisión = true), `page=1`, `page_size=20`, máximo 100. Producto añade `category_id`, `product_brand_id`, `vehicle_brand_id`. Búsqueda parcial por campos de las specs; OR entre código/nombre o documento/nombre, AND con filtros. Orden por nombre normalizado e ID; compatibilidad mediante EXISTS o consulta equivalente que no duplique productos. Respuesta `{count,page,page_size,total_pages,results}`. Cero resultados: `total_pages=0`; página positiva fuera de rango devuelve lista vacía, conservando el número pedido. Tipo/valor inválido responde 400, sin normalización silenciosa a una página arbitraria. Auxiliares, selectores y opciones también paginan en servidor.

Rutas adicionales:

- GET `products/tax-options/` y `services/tax-options/`, antes de las rutas de detalle: proyecciones fiscales paginadas del ámbito fijo; no aceptan cambiar ámbito.
- POST `suppliers/matches/`: consulta con CSRF y `proveedores.ver`, cuerpo `{name,exclude_id?}`, sin idempotency_key porque no muta; hasta 10 coincidencias de nombre completo normalizado, incluidos inactivos. Respuesta `{results,has_more}` con ID/nombre/estado; no copia contactos. La advertencia no bloquea el guardado ni se transforma en restricción.
- Marcas de vehículo: consumir las rutas existentes; para validar escrituras, usar la interfaz interna de referencias bajo los bloqueos descritos.

Respuestas: 201 alta; 200 lectura/edición/estado/repetición inocua; 400 campos, precisión, referencia inválida o parámetros; 403 permisos/CSRF/sesión conforme al stack actual; 404 inexistente; 405 método prohibido; 409 duplicado, versión, clave incompatible o categoría con productos activos. Usar `application/problem+json`, `code`, `errors` por campo y `request_id`; conservar la estructura vigente de `ProblemError`. Códigos: `validation_error`, `unknown_field`, `duplicate_code`, `duplicate_name`, `duplicate_identification`, `inactive_reference`, `invalid_tax_scope`, `category_has_active_products`, `stale_record`, `idempotency_conflict` y `not_found`. No devolver datos de duplicados sin permiso de consulta.

Una configuración inexistente impide guardar producto/servicio y produce error corregible en `tax_definition_id`; una definición sin vigencia permite guardarlo y comunica configuración pendiente en su proyección. Documentar esta diferencia en el **Contrato OpenAPI** generado mediante drf-spectacular, actualizando `backend/schema.yml` durante apply.

### 7. Auditoría y seguridad

Acciones `catalog.product_created/updated/activated/deactivated`, equivalentes de categoría/unidad/marca/servicio, y `suppliers.supplier_created/updated/activated/deactivated`; rechazos con resultado correspondiente y razón estable. `changed_fields` contiene solo nombres de campos. Los eventos se generan por servicio, no por signals, para conservar semántica y atomicidad.

No duplicar auditoría de permisos entre API y servicio: asignar una única capa responsable por cada rechazo efectivo y cubrirla en pruebas. La lista/detalle de auditoría sigue reservada al Administrador; revisar filtros existentes para admitir las nuevas acciones sin introducir una segunda pantalla.

Validar permisos antes de existencia, duplicados, matches o replay. No habilitar acceso por `is_superuser`, CORS, JWT ni editar la matriz de roles. Una prueba de matriz incluye cada ruta y método con los tres roles, combinaciones, usuario inactivo, contraseña temporal y sesión invalidada. Los endpoints de opciones no aceptan ámbitos manipulados y jamás permiten modificar configuración.

### 8. Presentación y navegación

Crear `frontend/src/features/products/`, `product-categories/`, `measurement-units/`, `product-brands/`, `services/` y `suppliers/`, cada una con contratos `types.ts`, `api.ts`, `hooks.ts` y formulario correspondiente. Páginas bajo `frontend/src/pages/` con los mismos nombres. Las rutas serán `/products`, `/products/:id`, `/product-categories`, `/measurement-units`, `/product-brands`, `/services`, `/services/:id`, `/suppliers` y `/suppliers/:id`; auxiliares muestran su ficha en panel con URL de contexto, sin otra aplicación de administración.

Agregar destinos filtrados a `app/App.tsx` y `AuthenticatedShell.tsx`. Productos, Servicios y Proveedores son entradas principales; auxiliares se alcanzan desde Productos mediante enlaces autorizados. El enlace existente de marcas de vehículo se etiqueta «Marcas de vehículo» para distinguirlo, conservando su ruta y permisos. Ningún nuevo acceso aparece para quien no puede consultarlo.

Listas: código/nombre/categoría/presentación/precio/estado para producto; nombre/precio referencial/estado para servicio; nombre/identificación/contacto/estado para proveedor. Sin columnas de stock, costo, saldo ni métricas ficticias. Mostrar **entidad fiscal** mediante `FiscalScopeBadge`: comercial para productos/proveedores y artesanal para servicios, sin sugerir que las fichas son documentos.

Reutilizar `PageHeader`, `Toolbar`, `FilterPanel`, `ElevatedDataList` o `ResponsiveDataView`, `Pagination`, `Field`, `Input`, `Select`, `Drawer`, `Dialog`, `StatusBadge` y estados existentes. Consultar estilos computados y tokens canónicos, no copiar clases obsoletas de páginas previas. Conservar Nunito y variantes de navegación desplegada >=1280, rail 768–1279 y drawer móvil <768. No rediseñar componentes ni ampliar a toda la auditoría visual pendiente.

Formulario de producto por grupos legibles: identificación, presentación, referencias e importe/impuesto. Marca y compatibilidades opcionales; selector de compatibilidad admite varias marcas y carga paginada, conservando seleccionadas visibles. Si falta un selector reutilizable adecuado, componer controles existentes de búsqueda, lista y selección con pruebas de teclado; no añadir librería. Permitir abrir la administración de auxiliares preservando el borrador en memoria y sin dos trampas de foco simultáneas. Referencias inactivas existentes se muestran etiquetadas, sin habilitarlas como nueva opción.

Servicios muestran «Precio referencial final (USD)» y la explicación de ajuste futuro. Proveedores etiquetan documento y contactos como opcionales; quitar identificación borra el par. Advertencias de coincidencia son consultivas y no impiden nombres repetidos. Los errores monetarios conservan el texto ingresado y nunca redondean automáticamente.

Filtros/página en URL; borradores locales al formulario, sin persistir datos personales en localStorage. Claves TanStack Query por capacidad, filtros e ID. Tras mutación invalidar ficha/listas y proyecciones afectadas: categoría/unidad/marca invalidan productos; marca de vehículo invalida compatibilidades/opciones/productos; cambio tributario desde configuración invalida opciones y proyecciones fiscales de productos/servicios. Además refetch al recuperar foco y al abrir formulario para cambios realizados por otro usuario. No recalcular ni sobrescribir borradores al refrescar.

Generar una clave al iniciar un envío; conservar clave y payload exactos tras timeout/error de red para reintento explícito. Una edición posterior o nueva intención usa nueva clave. No reintentar mutaciones automáticamente ni sustituir la clave de una solicitud incierta. Tras éxito/replay invalidar y consultar ficha vigente. Tras 409 de versión conservar borrador y ofrecer recarga/revisión, sin sobrescritura automática. Reutilizar invalidación de sesión y limpieza de caché existentes.

### 9. Pruebas y trazabilidad

Aplicar **TDD** en implementación: fallo observable, mínimo cambio y refactorización. Crear `backend/tests/catalog/`, `backend/tests/supplier_registry/`, pruebas junto a componentes/features y `frontend/e2e/catalogs.spec.ts`. Datos sintéticos solo en fixtures de prueba/desarrollo.

| Grupo de escenarios | Evidencia necesaria |
|---|---|
| Normalización, obligatorios y decimales | Pruebas puras de dominio con límites, cero, negativos, exceso de escala, exponentes, Unicode, opcionales, par CI/RUC y ceros iniciales. |
| Persistencia e historia | Unicidad de código/nombres/par, múltiples proveedores sin documento, servicios homónimos, PROTECT y conservación de asociaciones/identidad. No crear tablas ficticias de operaciones históricas para probar consumidores futuros. |
| Estado y referencias | Categoría con productos activos; producto inactivo/reactivación; cambios ajenos conservando referencia inactiva; compatibilidades sin duplicación ni cascadas. |
| Transacciones | Fallos inyectados al guardar relación, evento y recibo; ninguna escritura parcial; no-op sin versión/evento adicional. |
| Concurrencia PostgreSQL | Claves iguales con entradas iguales/distintas; códigos/nombres/documentos duplicados; versiones; baja de categoría contra alta/reclasificación/reactivación; baja de auxiliares contra nueva asociación. Usar conexiones independientes y barreras, sin sleeps como sincronización. |
| Integración fiscal | Comercial/artesanal, selección cruzada, tarifa cero/missing/ambiguous y cambio de vigencia; no cambios en ConfigurationUse, NumberAllocation, series, bodega o configuración. |
| API/autorización | Matriz por operación/rol, CSRF/sesión, opciones fiscales mínimas, matches sin exposición, no DELETE ni campos desconocidos, filtros/paginación/errores y esquema generado. |
| Frontend/E2E | CRUD sin eliminación, inactivos, errores/carga/vacío/éxito, búsqueda/retorno, doble envío/replay, formularios sin contacto, conflictos y permisos en API e interfaz. |
| Regresión/visual | Identidad, clientes, vehículos y configuración; keyboard/axe, textos largos y overflow a 360/768/1024/1440; navegación añade 1279/1280. Capturas externas sin declararlas aceptación humana. |

Durante apply crear `docs/negocio/requisitos/cobertura-catalogos.md`: una fila por los 126 escenarios, identificados por capacidad/requisito/título, con prueba exacta, comando, resultado y limitación real. Completar RN/RF/UI/CU y matriz de trazabilidad únicamente según lo entregado; disponibilidad/costos y operaciones futuras permanecen fuera de cobertura.

Verificación final prevista: `make check`, `make test`, `make audit`, `make compose-check`, `cd frontend && npm run test:e2e`, `cd backend && uv run python manage.py spectacular --validate`, `openspec validate --all --strict` y `git diff --check`. `make check` incluye formato, lint, tipos, chequeo de migraciones, cobertura y build. Registrar resultados reales, separar fallos previos y no reducir umbrales.

### 10. Documentación y evaluación arquitectónica

Actualizar en apply `docs/arquitectura/modelo-datos.md` después de aprobar este diseño, OpenAPI, arquitectura inicial, README, reglas/requisitos/interfaz/trazabilidad y referencias terminológicas. No reescribir decisiones conceptuales ni marcar capacidades anteriores cerradas. Registrar la concreción de precios de catálogo sin convertirla en política de redondeo tributario general.

No se requiere un nuevo ADR: las nuevas fronteras siguen ADR-0001; sesiones siguen ADR-0003 y no se modifica el contrato de confirmación de ADR-0004. El recibo local extiende un patrón existente a requisitos explícitos de estas specs, sin imponerlo a módulos previos. Si durante implementación fuera necesario cambiar el orden de bloqueos de una confirmación económica o la arquitectura de autorización, detener esa ampliación y proponer su decisión aparte. No cambia C4 de contenedores.

## Risks / Trade-offs

- [Duplicación menor de recibos entre módulos] → Mantener propiedad de persistencia; compartir solo funciones puras comprobadas y probar la misma semántica en ambos.
- [Lecturas preliminares obsoletas al preparar bloqueos] → Revalidar versión/referencias bajo bloqueo y abortar; nunca completar el conjunto fuera de orden.
- [Listado y tarifa cambian entre consultas] → Consultas informativas con fecha operativa; la confirmación futura volverá a resolver su configuración, sin prometer un snapshot económico del catálogo.
- [Recibos contienen datos de proveedor] → Acceso solo desde servicios autorizados, sin logs ni endpoint; conservarlos conforme al requisito de replay, sin inventar una purga.
- [Normalización Unicode o precisión de contenido] → Pruebas contra PostgreSQL y límites explícitos; no eliminar acentos ni inferir conversiones.
- [Cambios previos todavía abiertos] → Preservar sus artefactos/estados, ejecutar regresión y documentar fallos de base. Este diseño no los declara verificados.
- [Diseño visual con aceptación pendiente] → Reutilizar componentes presentes y registrar adaptaciones; cualquier modificación de fidelidad exige la evidencia y aceptación del flujo visual vigente.

## Migration Plan

1. Aprobar este diseño y registrarlo en `master` antes de tasks; aprobar/registrar tasks antes de apply. No realizar commits, merges ni despliegues sin instrucción explícita.
2. Durante apply, comprobar migraciones reales de dependencias y generar migraciones iniciales de `catalog` y `supplier_registry`. Dependencias: usuario swappable, marca de vehículo existente y definición tributaria existente; fijar nombres reales de migración al generarlas. No alterar tablas de negocio anteriores ni importar datos.
3. Las tablas empiezan vacías; no sembrar unidades, marcas, productos, impuestos, proveedores, stock o precios inventados. Configuración existente permanece intacta. Auxiliares/proveedores pueden cargarse sin configuración; el Administrador debe configurar impuestos antes de registrar productos/servicios.
4. Ensayar migración en PostgreSQL vacío y en copia desechable con identidad/clientes/configuración. Verificar preservación de registros, constraints, ausencia de migraciones pendientes y reversión transaccional ante fallo. Respaldos y evidencia fuera del repositorio.
5. Cuando se autorice despliegue: respaldo probado, backend y migraciones mediante `make migrate`, comprobaciones funcionales y luego frontend. La ampliación es aditiva; el frontend anterior sigue usando contratos existentes.
6. Recuperación: volver al código anterior dejando tablas nuevas conservadas si es necesario; tras registros reales, preferir corrección hacia adelante. No deshacer migraciones destruyendo catálogos ni restaurar sin autorización y respaldo comprobado.

## Open Questions

No se introducen nuevas decisiones de negocio pendientes para redactar tasks. Los límites técnicos de texto/importe/contenido y rutas son propuestas de este diseño sujetas a su revisión. Siguen abiertas fuera de alcance la validación de tarifas reales, el redondeo de documentos/costos y la retención operativa. El cierre documental de clientes y la aceptación del cambio visual deben resolverse en sus propios flujos; no se infieren a partir de código o contadores.

## Fuentes y evidencia de inspección

Fuentes normativas leídas durante esta tarea: decisiones confirmadas y modelo de dominio completos; proposal y las tres specs de este cambio con sus referencias; specs principales de dominio, autorización y configuración; reglas RN-CAT, RF-CAT, roles, CU-006/CU-016, UI-030…037 y RNF relacionados; glosarios; `AGENTS.md` y `openspec/config.yaml`. Se conservaron las brechas identificadas en proposal.

Fuentes técnicas: arquitectura inicial, C4 de contenedores, ADR-0001/0002/0003/0004, `DESIGN.md`, README y Makefile; diseño de clientes y contratos relacionados, propuesta/diseño/tareas y deltas del cambio visual. Inspección real: modelos/validación/servicios de marcas y consultas de clientes, modelos y servicios tributarios/recibos de configuración, autorización/auditoría, composición de rutas, cliente HTTP, APIs de frontend, shell y componentes exportados. Las rutas nuevas se identifican como propuestas, no como implementadas.

La validación de este artefacto comprobará OpenSpec y estado documental; no demuestra ejecución del diseño, migraciones ni pruebas de software. El siguiente artefacto es tasks, únicamente tras aprobación y registro de este diseño.

[Referencia terminológica](design-glossary-reference.md).
