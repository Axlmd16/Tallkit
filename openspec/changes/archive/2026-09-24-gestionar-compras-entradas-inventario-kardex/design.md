## Context

Diseño para revisión, 2026-09-20. La solicitud de continuar a design llega después de registrar las specs en `master` mediante `ab9adcd`; proposal está en `c17ad64`. Las tres capacidades contienen 29 requisitos y 105 escenarios. Este documento desarrolla esos contratos; no aprueba tasks ni implementación. El árbol estaba limpio al comenzar.

Existen `identity`, `customer_registry`, `catalog`, `supplier_registry` y `workshop_configuration`. No existen compras ni inventario persistente. Producto tiene presentación, precio final de venta y definición tributaria; proveedor tiene identidad, estado y versión. Sus comandos usan recibos idempotentes propios. Configuración publica resolución y numeración, pero la implementación inspeccionada difiere del ADR-0004 en precondiciones y orden de bloqueos. Frontend dispone de cliente HTTP, seguimiento de intenciones, TanStack Query, navegación autorizada y componentes compartidos.

Gobiernan las decisiones confirmadas, el modelo conceptual y las specs aprobadas de este cambio. Se conservan: bodega única, ámbito comercial, presentaciones completas, promedio ponderado, costo de compra sin impuesto, recuperabilidad por línea, redondeo HALF_UP por línea, fecha tributaria documental, contabilización al confirmar y anulación limitada al último efecto de cada producto. Alertas, adjuntos y operaciones futuras siguen fuera de esta entrega.

## Goals / Non-Goals

**Goals:** implementar compras y movimientos con **transacciones atómicas**, **idempotencia**, autorización, historia inmutable, valoración reproducible y consultas consistentes; integrar React/Django existentes; probar concurrencia en PostgreSQL y documentar migración y reconciliación.

**Non-Goals:** ventas, mantenimiento, reservas, pagos, contabilidad, devoluciones físicas, recepciones parciales, multibodega, conversiones, alertas, archivos adjuntos o nuevos frameworks. No modificar aquí modelos Django, migraciones, OpenAPI generado ni `modelo-datos.md`; eso pertenece a apply después de aprobar design y tasks. No refactorizar globalmente módulos anteriores ni cerrar sus cambios activos.

## Decisions

### 1. Fronteras y dependencias

Crear dos aplicaciones, registradas en `config/settings/base.py` y montadas desde `config/api/urls.py`:

| Ruta nueva propuesta | Responsabilidad |
|---|---|
| `backend/src/purchasing/` | Compra, líneas, identidad del documento externo, reemplazos, revisión, confirmación y anulación. |
| `backend/src/inventory/` | Operaciones de inventario, posiciones, movimientos, valoración, carga inicial, ajustes, reversión y Kardex. |

Cada aplicación tendrá `apps.py`, `models.py`, `migrations/`, `domain/`, `application/` y `api/` únicamente con archivos usados. Reglas puras en `domain/validation.py`, `domain/valuation.py` en inventario y `domain/amounts.py` en compras; sin imports de Django, DRF, HTTP ni persistencia. Servicios coordinadores en `purchasing/application/purchases.py`, `inventory/application/operations.py`, consultas en `queries.py`, comandos en `commands.py`; serializadores/vistas/rutas delgados. Errores de dominio se traducen a errores de aplicación y finalmente al formato HTTP existente.

Dependencias de ejecución: purchasing → interfaces de inventory, catalog, supplier_registry, workshop_configuration e identity; inventory → interfaces de catalog, workshop_configuration e identity. Inventory no importa purchasing ni modifica documentos de compra: devuelve resultados al coordinador. No crear un motor genérico de documentos o resolver DM-001 para ventas futuras.

Servicios públicos nuevos, con DTO congelados y decimales, no modelos ORM:

- `catalog/application/inventory_references.py`: referencias actuales por IDs, búsqueda paginada, y `lock_product_references(ids)` dentro de una transacción activa. Devuelve código, nombre, presentación/unidad, estado y elección tributaria; no precio de venta cuando no se necesita. Los bloqueos y consultas de catálogo permanecen dentro de su módulo.
- `supplier_registry/application/purchase_references.py`: referencia de proveedor y `lock_supplier_reference(id)`, sin exponer edición. Devuelve nombre, identificación opcional, estado y versión; no copiar contactos innecesarios al documento histórico.
- `workshop_configuration/application/operation_context.py`: contexto de bodega/entidad comercial, opciones de impuesto para fecha documental y consulta de revisión sin usos; variante bloqueante para confirmación, uso fiscal y ámbito de numeración. Conserva servicios `configuration_resolver.py` y `numbering.py` como propietarios de sus escrituras, con las correcciones de §5.
- `inventory/application/posting.py`: preparación/bloqueo de posiciones, publicación de entradas/salidas y reversión exacta. Recibe origen estable y líneas normalizadas; exige transacción exterior y contexto bloqueado, no confirma por separado ni vuelve a adquirir bloqueos de menor rango. Los DTO de bloqueo son internos al proceso y nunca provienen del cliente HTTP.

Las FK se declaran por nombre de modelo con `PROTECT` y `related_name='+'` cuando crucen módulos, evitando importar persistencia ajena y añadir campos inversos de stock al contrato de catálogo. Ajustar `backend/tests/catalog/test_boundaries.py`: actualmente prohíbe cualquier import de aplicación de catálogo desde consumidores. Sustituir solo esa prohibición absoluta por una lista de interfaces públicas permitidas; conservar prohibición de modelos y escrituras ajenas. Ampliar pruebas de frontera a purchasing/inventory.

Alternativas descartadas: meter compras en proveedores mezcla dato maestro y operación; guardar stock en Producto contradice catálogo; un módulo por tabla introduce capas sin utilidad; SQL o modelos ajenos desde vistas rompe el monolito modular.

### 2. Persistencia de compras e identidad documental

Identificadores internos numéricos, fechas conscientes de zona horaria y versiones positivas. No registrar modelos de operación en un Admin editable. Estados JSON en mayúsculas: DRAFT, CONFIRMED, VOIDED; etiquetas visibles en español.

| Modelo propuesto de purchasing | Datos y restricciones |
|---|---|
| `PurchaseDocumentIdentity` | Proveedor protegido, tipo FACTURA/NOTA_DE_VENTA/OTRO/SIN_DOCUMENTO, referencia original y normalizada. Unicidad `(supplier, document_type, normalized_reference)` para tipos documentados. SIN_DOCUMENTO tiene referencia vacía y una identidad propia por compra raíz. Conserva la identidad externa de toda una cadena. |
| `Purchase` | Identidad externa protegida; fecha documental, observaciones y explicación SIN_DOCUMENTO; estado/version/actor/fechas; `replaces` opcional a antecedente; totales; snapshots fiscales/proveedor; número interno, asignación y operación de inventario confirmada; huella de confirmación y revisión aplicada; datos de anulación y operación compensatoria. Unicidad parcial de identidad externa cuando estado=CONFIRMED. |
| `PurchaseLine` | Compra, posición de línea única, producto protegido, cantidad, costo neto, definición tributaria, recuperabilidad RECOVERABLE/NON_RECOVERABLE. Al confirmar: snapshots de producto/código/contenido/unidad y datos tributarios, base, impuesto, total y valor inventariable. |
| `PurchaseCommand` | Actor, acción, clave, huella canónica, resultado HTTP/JSON y fecha; unicidad actor/acción/clave, siguiendo el patrón actual de recibos. Sin endpoint público ni purga automática. |

El documento externo es una identidad separada del número interno. Un alta independiente que encuentre una identidad ya reclamada falla con `duplicate_supplier_document`, incluso si solo tiene borradores o anulados. Un reemplazo reutiliza explícitamente esa identidad; solo puede confirmar si su antecedente está anulado y no hay otro documento confirmado en la cadena. Se permiten borradores de reemplazo competidores; bloquear la identidad serializa sus confirmaciones y la restricción parcial evita dos vigentes. No reutilizar COM-ING ni borrar el original.

Un borrador raíz puede corregir proveedor/tipo/referencia mientras no haya confirmado ni tenga reemplazos. Actualizar su identidad bajo bloqueo y comprobar unicidad; el reemplazo no puede cambiar la identidad heredada. Conservar identificadores de antecedentes y referencias de auditoría. La normalización es `strip().upper()` sin retirar ceros ni puntuación; verificar equivalencia de comparación Unicode en PostgreSQL, igual que los códigos del catálogo.

Snapshots JSON con esquema de claves versionado y validado, no copias libres de modelos. Los campos usados en cálculos, filtros y restricciones son columnas decimales/fechas/FK; los snapshots contienen la representación histórica. Las compras confirmadas se consultan exclusivamente desde esos valores; catálogo actual solo ofrece enlaces separados.

Índices: `(state, document_date, id)`, `(document_identity_id, id)`, `(document_date, id)`, número interno único cuando informado, líneas `(purchase_id, position)` único y `(product_id, purchase_id)`. La identidad externa indexa proveedor y referencia normalizada. Búsqueda parcial por número/referencia/nombre de proveedor según convenciones; no añadir extensión de búsqueda sin medir necesidad.

No se necesita crear una factura fiscal ni generalizar los cuatro tipos de referencia a todas las operaciones del sistema. Unicidad por texto no valida autenticidad documental ante el SRI.

### 3. Persistencia de inventario y protección histórica

| Modelo propuesto de inventory | Datos y restricciones |
|---|---|
| `InventoryPosition` | Producto y bodega protegidos; cantidad, valor, promedio, versión, último ordinal y último momento efectivo. Par producto/bodega único; cantidad y valor no negativos; cantidad entera; cantidad cero implica valor y promedio cero. Es proyección operativa conciliable, no origen independiente de stock. |
| `InventoryOperation` | Tipo PURCHASE_RECEIPT/INITIAL_LOAD/ADJUSTMENT_IN/ADJUSTMENT_OUT/REVERSAL; estado PREPARED/POSTED/REVERSED; origen estable `(source_type, source_id)` único para compras; motivo, observación, actor, fechas, versión y huella. Relación única opcional `reverses` a original; referencia pública interna `INV-<id>` que no consume serie económica. |
| `InventoryOperationLine` | Operación, posición de línea, producto, cantidad y costo inventariable de entrada si aplica. Para compra, referencia de línea original como dato y valor inventariable enviado por purchasing. Líneas manuales: un producto por operación en esta versión; el núcleo acepta múltiples productos de compra. |
| `InventoryMovement` | Operación, producto/bodega, ordinal por posición, momento efectivo, entrada/salida, costo aplicado, valor firmado, residuo de redondeo, cantidades/valores/promedios anterior y posterior, snapshots de producto/unidad y usuario histórico mínimo. Vínculo `reverses_movement` único para compensación. Únicos `(position, ordinal)` y `(operation, product)`; cantidad positiva en un solo sentido. |
| `InventoryCommand` | Recibo propio con el mismo contrato de idempotencia que compras, para comandos manuales. Purchasing no escribe este recibo ni abre un segundo comando de transporte al llamar al núcleo. |

Agrupar líneas de compra por producto antes de contabilizar: sumar cantidades y valores inventariables ya calculados por línea, generar un movimiento por producto y operación y mantener el detalle en PurchaseLine/InventoryOperationLine. Se obtiene un único promedio de entrada para ese producto y se anula la compra como unidad. El origen del movimiento identifica todas las líneas que lo explican.

Índices: movimientos `(position_id, ordinal)`, `(product_id, effective_at, ordinal)`, `(product_id, movement_type, ordinal)`, `(actor_id, effective_at, id)` y origen/operación; operaciones `(kind, state, created_at, id)` y producto a través de líneas. Una restricción parcial de movimientos INITIAL_LOAD por producto/bodega impide una segunda carga aun después de compensarla; solo el servicio puede producir ese tipo desde su operación válida.

Usar constraints para signos, exclusión entrada/salida simultánea, cantidades enteras y rango, relaciones únicas y coherencia local de estados. Para reglas entre registros: servicio bajo bloqueo y pruebas de integración. No presentar una FK o un CHECK local como garantía suficiente del saldo agregado.

Historia: bloquear UPDATE/DELETE de movimientos mediante trigger PostgreSQL en migración, además de modelos/QuerySets sin mutadores públicos. Proteger PurchaseLine y contenido económico de Purchase después de confirmar mediante triggers que permiten únicamente los metadatos de anulación definidos; proteger líneas de InventoryOperation después de POSTED y permitir solo transición a REVERSED con su relación compensatoria. Nunca borrar borradores por API. La protección no pretende impedir que un administrador de base altere deliberadamente el esquema; sí evita sobrescritura accidental desde ORM, SQL de aplicación o Admin. Probar insert/update/delete directos y operaciones legítimas, sin desactivar triggers en producción.

La FK circular de posición/último movimiento se evita: guardar el último ordinal, no otra raíz propietaria. Para nuevas posiciones, bloquear primero el producto y crear saldo cero dentro de la operación; la unicidad resuelve la ausencia de fila. Consultas no crean posiciones. No hay tabla de reservas ni campo de disponibilidad ficticia en esta entrega.

### 4. Decimales, importes y residuos

Transporte decimal como cadenas ordinarias, sin exponente, NaN, infinito ni coma. No convertir dinero a `number` en TypeScript para cálculos. Cantidad: hasta 999999999999 presentaciones enteras, persistida `numeric(18,6)` con CHECK de parte fraccionaria cero. Costo unitario de captura hasta 999999999999.999999; costo/promedio persistido `numeric(24,6)` para admitir el impuesto no recuperable y la valoración derivada. Importes documentales `numeric(38,2)`; valores de inventario `numeric(38,6)`. Rechazar exceso de escala o rango antes de persistir; comprobar también el saldo agregado resultante. Cálculo puro con `Decimal` y contexto local de precisión 60, sin depender del contexto global.

Compras por línea: `base = Q2(q * costo_neto)`, `impuesto = Q2(base * tarifa / 100)`, `total = base + impuesto`, `valor_entrada = base + (impuesto si NON_RECOVERABLE; 0 en otro caso)`. Q2 y Q6 usan HALF_UP. Totales son sumas de líneas redondeadas; no redondear el costo inventariable derivado para luego multiplicarlo y sustituir su valor original. Guardar valores, tarifa y clasificación históricos. Una selección tributaria sin vigencia puede conservarse en borrador, con importes no calculables explícitos y errores de configuración; nunca mostrar cero como tarifa o total inventado. No habilitar revisión confirmable hasta resolverlo.

Inventario recibe pares `(cantidad, valor_total)` exactos a seis decimales. Sea Q cantidad previa, V valor conservado y A promedio publicado a seis decimales:

- Entrada: `Q' = Q + q`, `V' = V + valor_entrada`, `A' = Q6(V'/Q')`. Al primer ingreso V=Q=0. El pequeño residuo entre V y Q×A se conserva en V, no se pierde.
- Salida parcial: valor nominal `Q6(q*A)`; valor aplicado `min(V, nominal)` para impedir valor negativo cuando la acumulación de redondeos alcance el saldo antes de agotar cantidades. Conservar `rounding_adjustment = aplicado - nominal` y el promedio A, sin recalcular historia. El ajuste es técnico de redondeo, no un descuento ni una operación contable separada.
- Salida total: aplicar exactamente V, registrar su diferencia con el nominal, dejar Q'=V'=A'=0. Cantidades insuficientes siempre fallan antes de valorar.
- Reversión exacta: usar los valores anteriores conservados en el movimiento original; compensar cantidad y valor por su diferencia exacta y restaurar A anterior, sin tratarla como una compra al promedio actual.

Caso exigido: 3 unidades con V=1.000000, A=0.333333; tres salidas de una unidad valen 0.333333, 0.333333 y 0.333334. Agregar pruebas de cantidades grandes y costos muy pequeños que obliguen al límite `min`, y secuencias largas de entradas/salidas; nunca pérdidas ocultas por multiplicar el promedio redondeado. La consulta muestra el residuo a Administrador cuando sea necesario explicar la conciliación.

Alternativas descartadas: float; redondear costos a centavos; reconstruir V como Q×A; valorar toda reversión al costo actual; recalcular retrospectivamente promedios. La precisión elegida conserva costos de seis decimales y valor exacto de entradas aceptadas sin imponer contabilidad general.

### 5. Orden transaccional e integración de configuración

Una compra/ajuste/compensación abre una única transacción exterior. Autorización y validación sintáctica preceden a su recibo; dentro se reclaman recibo, recursos y efectos. Las operaciones internas no hacen commit independiente. Aislamiento de escritura READ COMMITTED con bloqueos explícitos; no usar mutex de proceso, `MAX()+1`, SQLite para demostrar concurrencia ni bloqueo de toda la instalación.

Orden total de recursos, tomando solo los necesarios y IDs ascendentes dentro de cada grupo:

1. Recibo de comando del módulo propietario.
2. Identidad documental de compra, compras afectadas, operación de inventario original/preparada. Inventory nunca adquiere después una compra; las consultas de origen no se ejecutan bajo bloqueos de escritura.
3. Proveedor por su interfaz pública.
4. Referencias de catálogo: categorías, unidades, marcas de producto, marcas de vehículo si realmente hacen falta, productos. Las compras no necesitan compatibilidades; pueden omitir los grupos no leídos. Las referencias históricas de una reversión vienen del original, no necesitan exigir catálogo activo.
5. Posiciones por producto/bodega, creadas bajo bloqueo de producto si no existen.
6. Contexto de configuración: bodega (si se necesita snapshot descriptivo), entidad fiscal, todas las TaxDefinition por ID ascendente y después sus períodos por ID, NumberingScope y DocumentSeries. Dentro de configuración se mantiene el orden del ADR-0004; la bodega precede a esas filas y su editor no adquiere filas posteriores.
7. Inserciones de uso fiscal/numeración, operación/líneas/movimientos, actualización de saldos/estado y auditoría; no adquirir después recursos de los grupos anteriores.

Lecturas preliminares identifican familia, proveedor, productos y referencias. Bajo bloqueo se revalida versión e identidad; si cambió el conjunto, abortar con conflicto y volver a preparar desde fuera, sin añadir un bloqueo de menor rango. Preparar conjuntos de referencias de todos los productos antes de bloquearlos, no iterar todo el orden por cada producto. Las interfaces públicas del dueño garantizan este protocolo.

Cambios mínimos necesarios en configuración, sin modificar sus reglas aprobadas:

- `configuration_resolver.py`: exigir transacción activa antes de cualquier uso confirmado; bloquear TaxDefinition ordenadas por ID antes de períodos; resolver solo una vigencia por fecha; devolver snapshots/DTO inmutables. Separar consulta de preview sin usos de resolución para confirmación. Invocar una sola vez por compra con definiciones únicas, no por línea.
- `taxes.py`: `update_tax_period` y `schedule_successor` leen preliminarmente la definición, bloquean primero esa raíz y después períodos. `create_tax_period` ya parte de definición; unificar el orden de todos los períodos consultados. Revalidar pertenencia/versión y usos dentro del bloqueo. Se corrige el orden actual período → definición, no la regla fiscal.
- `numbering.py`: comprobar transacción exterior antes de abrir cualquier savepoint. Obtener ámbito mediante servicio público, nunca importando sus modelos desde purchasing. Usar identidad estable de compra para consumidor y clave interna `purchase:<id>:confirm`, distinta de la clave arbitraria de transporte. Probar colisiones de clave entre documentos: no devolver número de otro documento aunque una huella coincida.
- `series.py`: edición/sustitución bloquean primero NumberingScope a partir de lectura preliminar y luego DocumentSeries; revalidan relación y versión. El código actual bloquea la serie antes del ámbito en sustitución, incompatible con asignación.

Los tests actuales que llaman `allocate_number` fuera de transacción deberán abrir la transacción consumidora; añadir prueba que exige rechazo fuera de ella. Esto restaura el ADR aceptado; no se cambia la API pública administrativa ni se concede `parametros.gestionar` a consumidores. Savepoints anidados dentro de una transacción exterior sí son válidos.

Errores PostgreSQL de deadlock, serialización o timeout de bloqueo se traducen solo después del rollback completo a conflicto reintentable. No repetir automáticamente fragmentos de numeración/inventario; el cliente conserva la intención incierta y consulta/reintenta la unidad completa. Las pruebas deben demostrar ausencia de ciclos en las carreras previstas, no usar la traducción de deadlocks para aceptar un diseño circular.

### 6. Revisión, confirmación e idempotencia

`PurchaseCommand` e `InventoryCommand` reproducen el patrón de `catalog/application/commands.py`: clave 8–128 ASCII `[A-Za-z0-9._:-]`, única por actor/acción, huella SHA-256 canónica de todo payload relevante (objetivo y versión incluidos, excluyendo clave), reclamo por INSERT único en savepoint y resultado completo antes del commit. No compartir tablas de recibos ni crear un framework general. Reutilizar solo `shared/command_values.py`. Autorización vigente siempre antes de replay. Fallo revierte también recibo provisional; el resultado persistido no caduca automáticamente.

Una revisión es de solo lectura y devuelve totales/efectos y un token firmado por Django con digest de contenido canónico, versión del documento, referencias relevantes, snapshots tributarios/fiscales/bodega y contexto de acción. El token no contiene datos de costos o proveedor en texto codificado: contiene identificadores, digest y vencimiento (15 minutos). Asociarlo a actor y acción. No crea uso fiscal, reserva de secuencial ni movimiento. En compra la revisión no queda invalidada por otra entrada que cambie el promedio, porque el usuario confirma cantidades y costo de esa recepción; el resultado final expone el nuevo promedio. En ajuste/reversión sí incorpora versiones/saldos afectados porque se confirma ese efecto previsto.

Confirmar una compra: bloquear recursos en orden, volver a resolver datos actuales, comparar revisión/draft version, validar referencias, identidad externa y estado, calcular líneas, obtener uso fiscal y número, publicar entradas agrupadas, congelar snapshots y marcar CONFIRMED. Un cambio relevante exige `review_required`; edición ajena da `stale_record`. Precio de venta no forma parte del cálculo ni se modifica. Fechas posteriores al día local se rechazan.

Confirmación repetida con otra clave: bloquear la compra y resolver primero su estado. Si ya confirmó y el digest de contenido/acción coincide con el aplicado, devolver su confirmación sin exigir que el token siga vigente ni que la versión del borrador siga siendo la actual. Con entrada incompatible, conflicto. No permitir que una confirmación repetida de una compra ahora anulada la reactive: devolver estado vigente y su referencia de confirmación original sin movimientos. Guardar por separado la huella semántica del documento y la huella exacta de transporte, que también incluye el token recibido.

SIN_DOCUMENTO: fingerprint orientativo de proveedor, fecha y multiconjunto de líneas normalizadas; la revisión indica coincidencias y exige `acknowledged_matches` con los IDs revisados. Al confirmar, serializar por proveedor y volver a comprobar coincidencias; si aparecieron otras, exigir nueva revisión. No fusionar ni bloquear definitivamente compras legítimas iguales; el reconocimiento es una decisión expresa del Administrador. No usar una unicidad por fingerprint en lugar de identidad documental.

Carga/ajuste manual: POST crea operación PREPARED y líneas válidas sin stock. Editar PREPARED exige versión. Preview compara estado vigente; confirmar con token marca POSTED y genera efectos. Carga inicial consulta historia bajo posición bloqueada y la restricción única impide doble carga. Al repetir confirmación se reconoce la identidad de la operación, incluso con otra clave. PREPARED no participa de Kardex ni puede borrarse por API.

### 7. Anulación y correcciones

Purchase void y InventoryOperation reverse tienen preview y confirmación separados; motivo 1–2000 caracteres no blancos, actor y hora del servidor. Bloquear original y todas sus posiciones; cada `last_ordinal` debe ser el del movimiento original de esa operación. Con múltiples productos comprobar todos antes de escribir; cualquier movimiento posterior, incluso compensado, bloquea todo. Verificar cantidades/valores actuales iguales a los saldos posteriores originales; una discrepancia indica `inventory_inconsistent`, no un caso para parchear el historial.

Crear una operación REVERSAL con relación única al original y un movimiento inverso por producto. Restituir snapshots previos de cantidad, valor y promedio; incrementar ordinal y versión, conservar el número interno y marcar original revertido/anulado. No bajar el ordinal ni borrar movimientos. El siguiente documento de reemplazo es una recepción nueva con nuevo COM-ING y enlaza su antecedente anulado.

Corrección después de movimientos posteriores: el intento de reversión devuelve `unsafe_reversal` con producto y referencia interna del primer efecto bloqueante autorizado. El Administrador puede preparar un ajuste nuevo de diferencia física, con `corrects_operation_id`, motivo y costo vigente: entrada usa el promedio actual como costo documentado de esa corrección, salida el promedio vigente. Si el producto está agotado y no hay promedio actual utilizable, la entrada exige un costo explícitamente documentado, sin recuperar automáticamente el costo histórico erróneo. Una corrección solo de costo, sin diferencia física, sigue bloqueada en esta entrega; no se ofrecen cantidades artificiales ni revaloración retrospectiva.

Las entradas nuevas exigen producto activo; consulta, salida justificada y reversión usan la identidad conservada aunque esté inactiva. Revertir no requiere proveedor activo ni tarifa actual: aplica el original. Reintentos de una reversión ya hecha devuelven esa operación sin nueva compensación; solicitudes incompatibles siguen dando conflicto.

### 8. Contratos HTTP y límites

Rutas bajo `/api/v1/`, sesión y CSRF existentes, JSON en inglés, textos de usuario en español. Todos los POST que modifican estado exigen `idempotency_key`; PATCH además `expected_version`. Preview usa POST protegido por CSRF pero de solo lectura y sin recibo. No PUT, DELETE, edición de estado ni campos desconocidos aceptados silenciosamente.

| Método y ruta propuesta | Permiso / resultado |
|---|---|
| GET/POST `purchases/` | `ingresos.ver` / `ingresos.crear`; lista / borrador 201. |
| GET/PATCH `purchases/<id>/` | `ingresos.ver` / `ingresos.crear`; detalle / edición 200. |
| POST `purchases/<id>/preview/`, `confirm/` | `ingresos.confirmar`; revisión / confirmación 200. |
| POST `purchases/<id>/void-preview/`, `void/` | `ingresos.anular`; efecto compensatorio / resultado 200. |
| POST `purchases/<id>/replacement/` | `ingresos.crear`; borrador de reemplazo 201 con misma identidad documental. |
| GET `purchases/tax-options/` | `ingresos.crear`; ámbito comercial fijo y `document_date` requerida, sin modificar configuración. |
| GET `inventory/`, `inventory/products/<id>/` | `inventario.ver`; lista/ficha de cantidades y valoración solo con permiso. |
| GET `inventory/products/<id>/kardex/` | `inventario.ver`; filas, resúmenes y corte; valoración restringida. |
| GET `inventory/operations/<id>/` | `inventario.ver`; proyección operativa sin datos privados o económica con permiso. |
| GET/POST `inventory/operations/` | `inventario.ajustar`; lista administrativa / PREPARED inicial o ajuste. No acepta PURCHASE_RECEIPT o REVERSAL enviados libremente. |
| PATCH `inventory/operations/<id>/` | `inventario.ajustar`; editar solo PREPARED. |
| POST `inventory/operations/<id>/preview/`, `confirm/`, `reverse-preview/`, `reverse/` | `inventario.ajustar`; acciones manuales. Operaciones originadas en compra rechazan reverse directo y remiten a anulación de compra. |

Campos de borrador: `supplier_id`, `document_type`, `supplier_reference`, `document_date` ISO, `notes`, `no_document_reason`, `lines[]`. Línea: `product_id`, `quantity`, `unit_cost`, `tax_definition_id`, `tax_recoverability`. PATCH distingue omitir de vaciar y sustituye la colección de líneas completa en una transacción; mantiene orden y devuelve IDs/version. Hasta 200 líneas; referencia 128 caracteres, observaciones/motivos 2000. El máximo de líneas limita trabajo bajo bloqueo y se publica en OpenAPI/formulario. No aceptar totales del cliente.

Confirmación: `expected_version`, `review_token`, `acknowledged_matches` cuando aplique e `idempotency_key`. Anulación/reversión añade `reason`. Preparación manual: `kind`, `product_id`, `quantity`, `unit_cost` únicamente para entradas, `reason`, `reference`, `notes`, `corrects_operation_id` opcional. No se acepta cambiar bodega/entidad: se resuelven de configuración; una entrada de campo ajeno responde `unknown_field`.

Listas siguen `{count,page,page_size,total_pages,results}`, página inicial 1, tamaño 20, máximo 100. Compras: `search`, `supplier_id`, `state`, `date_from`, `date_to`, orden `-document_date,-id`. Inventario: `search`, `category_id`, `is_active=true|false|all`, `stock=all|positive|zero`; sin filtro de estado se aplica activos más inactivos con historia/saldo; orden nombre actual/ID. Kardex: `date_from`, `date_to`, `movement_type`, `source_type`, `source_id`, `actor_id`, `page`, `page_size`, `cut_token`; orden ordinal ascendente. Validar combinación origen/ID y filtrar por coincidencia exacta. Rangos son inclusivos por día local, convertidos a intervalo UTC `[inicio, día posterior al fin)`.

Detalle de compra incluye estado/version/número, fechas diferenciadas, snapshots y líneas, totales, links de operaciones/original/reemplazos y metadatos de anulación. Los detalles PREPARED/DRAFT indican si los totales son revisables o no calculables. Inventario operativo solo contiene identidad, presentación actual del catálogo etiquetada como tal, bodega, cantidad, versión y enlaces autorizados; la fila de Kardex usa snapshot de presentación/unidad histórico. Las cantidades cuentan presentaciones del producto, nunca se recalculan desde contenido actual del catálogo.

Proyecciones separadas por lista blanca, no serializar todo y ocultar columnas: el serializer operativo jamás añade `unit_cost`, `average_cost`, `inventory_value`, impuestos, `rounding_adjustment` ni proveedor. Las compras y sus recibos solo son administrativos. No usar query params para elevar la proyección. Origen operativo muestra únicamente tipo y referencia interna; `origin_url` solo si el permiso permite abrirlo. No incorporar motivos con datos privados de proveedor a la proyección operativa de compras.

Errores con `problem_response`: 400 `validation_error`, `unknown_field`, `inactive_reference`, `invalid_tax_scope`; 403 según sesión/CSRF/permisos vigentes; 404 tras autorizar; 409 `stale_record`, `review_required`, `duplicate_supplier_document`, `idempotency_conflict`, `already_initialized`, `insufficient_stock`, `unsafe_reversal`, `inventory_inconsistent`, `configuration_missing`, `configuration_ambiguous`, `concurrent_operation`. Campos de línea en `errors` como `lines.2.quantity`. Usar el `conflict` existente `{type,id}` solo con objetivos autorizados. Fallos inesperados mantienen respuesta 500 correlacionada sin SQL ni datos económicos expuestos. No transformar un error de base desconocido en «duplicado».

### 9. Kardex estable y reconciliación

Ordinal consecutivo por producto/bodega asignado al bloquear InventoryPosition; no usar PK global como orden de commit. `effective_at` se obtiene después de adquirir los bloqueos; para cada posición no retrocede respecto de su último momento, y el ordinal desempata horas iguales. No usar la fecha del proveedor ni el timestamp de comienzo de una transacción que esperó bloqueos. La misma operación puede tener igual hora para varios productos; no se necesita orden global entre productos independientes.

Primera consulta: transacción corta de solo lectura REPEATABLE READ, configurada antes de la primera consulta, sin bloqueos de escritura; capturar `cut_ordinal` del producto y una hora de corte. Todos los agregados/filas se calculan dentro de ese snapshot. Responder `cut_token` firmado ligado a producto, bodega y filtros (excepto página), con ordinal y expiración de 30 minutos, sin costos ni datos personales. Al cambiar filtros solicitar otro corte. Para páginas posteriores limitar todo a `ordinal <= cut_ordinal`; como la publicación se serializa por posición, no puede aparecer tardíamente un ordinal anterior no incluido. Reautorizar cada página. Token vencido o incompatible devuelve conflicto de actualización y no mezcla cortes silenciosamente.

Los saldos anterior/final del período se obtienen del último movimiento anterior al límite y del último hasta el cierre, siempre dentro del corte; nunca aplicar primero filtros de tipo/usuario a esa selección. Agregados `period_totals` abarcan todo el período; `matching_totals` solo coincidencias, ambos independientes de paginación. Filas usan `quantity_after`, y `page_opening_quantity` es `quantity_before` de la primera fila visible; así incluye movimientos ocultos intermedios. Resúmenes análogos de valor solo con autorización. Sin filas de página, `page_opening_quantity=null`, sin inventar un movimiento; resúmenes del período permanecen válidos. Sin movimientos del producto, saldos cero confirmados.

Respuesta añade `{cut, opening_quantity, closing_quantity, period_totals, matching_totals, page_opening_quantity}` a la envoltura paginada. En fechas sin inicio abrir desde origen; sin fin cerrar en corte. Comparar con inventario requiere el mismo `last_ordinal`; la ficha devuelve ordinal/version y permite abrir su Kardex con ese corte, no afirmar igualdad entre dos instantes distintos.

`inventory/management/commands/reconcile_inventory.py` propuesto: solo lectura, salida administrativa con diferencias por producto y código no cero si existen. Reconstruye cantidad/valor con movimientos originales e inversos, verifica cadena anterior/posterior, ordinales, promedio y posición; verifica operaciones de compra confirmadas con efectos y anulaciones con compensación. Para consistencia abre una transacción de lectura al comienzo. No ofrece `--fix` ni modifica historia; una reparación real exige diagnóstico y procedimiento explícito fuera del ajuste ordinario. Crear posiciones vacías sin movimientos no crea stock y debe conciliar a cero.

Alternativas descartadas: OFFSET sobre datos vivos sin corte; sumar solo filas visibles; recalcular todos los saldos desde cero en cada página; corte por MAX(id) global, que no equivale a orden de confirmación concurrente. Los snapshots de movimiento permiten consultas indexadas sin revalorar historia.

### 10. Frontend integrado

Crear `frontend/src/features/purchases/` y `features/inventory/` con `types.ts`, `api.ts`, `hooks.ts`, componentes de revisión y formularios; páginas en `pages/purchases/`, `pages/inventory/`. Rutas `/purchases`, `/purchases/new`, `/purchases/:id`, `/purchases/:id/edit`, `/inventory`, `/inventory/products/:id/kardex`, `/inventory/operations/:id`; accesos por permisos desde `app/App.tsx` y `AuthenticatedShell.tsx`. Ajustes/carga inicial se abren desde Inventario; no agregar accesos a funcionalidades excluidas.

Reutilizar Nunito, tokens y variantes de `DESIGN.md`, `PageHeader`, `FiscalScopeBadge`, `Field`, `Input`, `Select`, `ElevatedDataList`/`ResponsiveDataView`, `Pagination`, `StatusBadge`, `InlineNotice`, Drawer y Dialog. Sin biblioteca nueva. El editor de compra usa una página para líneas múltiples; drawers para selector contextual y ajuste simple. No superponer dos trampas de foco. En móvil, líneas como grupos etiquetados; totales accesibles y confirmación que nombra productos/cantidad y efecto sobre stock.

Selectores consultan todas las páginas necesarias, no solo los primeros 100 productos/proveedores. Conservar seleccionados y referencias inactivas etiquetadas; impedir incorporarlos como nuevas líneas y explicar bloqueo de confirmación. Proveedor puede darse de alta desde su módulo existente sin perder borrador en memoria; no inventar uno genérico. Búsquedas y filtros en URL; no persistir compras o costos en localStorage.

Formulario conserva cadenas decimales y clasificación recuperable por línea. Guardar borrador y solicitar preview al backend para importes exactos; no mostrar cálculos JavaScript como definitivos. Un resultado de preview viejo no debe reemplazar la revisión de una edición más reciente. Confirmación explícita sobre token vigente; tras `review_required` o `stale_record`, conservar entrada y ofrecer revisión/recarga, sin sobrescritura automática. Diálogos de anulación muestran efecto y motivo; bloqueo de valoración identifica producto y origen permitido.

Usar `shared/api/idempotency.ts`: mismo payload y clave tras timeout, sin reintentos automáticos de mutación. Deshabilitar botón durante envío y preservar intención incierta; tras replay consultar estado vigente. Invalidar compras, operaciones, fichas/consultas de inventario y Kardex de productos afectados. Mantener el corte de páginas que el usuario está leyendo hasta refresco explícito y avisar que existen cambios; no fusionar filas antiguas con nuevos resúmenes. Tras una mutación propia solicitar un corte nuevo. Cerrar sesión limpia cachés con costos; permisos backend siguen siendo la autoridad.

`pages/products/ProductDetailPage.tsx` consume la consulta de inventario separada y enlaces autorizados; no ampliar serializer de catálogo con saldos editables. Corregir textos de catálogo que dicen que la ficha no ofrece existencias, limitando el cambio a la integración. Las tablas administrativas muestran precio de compra y valoración de forma distinta del precio final de venta.

Estados reales de carga/vacío/error/éxito; errores asociados a campos; foco de retorno al cerrar diálogos; targets táctiles existentes, teclado y reduced-motion. Capturas/E2E a 360/768/1024/1440 y cortes de navegación 1279/1280. La validación técnica no sustituye aceptación visual humana de nuevos baselines.

### 11. Estrategia de pruebas y trazabilidad

Aplicar **TDD** durante implementación, con fallo esperado antes de cada comportamiento. Crear suites `backend/tests/purchasing/`, `backend/tests/inventory/` y pruebas frontend junto a features/páginas, más `frontend/e2e/purchases-inventory.spec.ts`. Registrar en apply `docs/negocio/requisitos/cobertura-compras-inventario.md` una fila por cada uno de los 105 escenarios, identificada por capacidad/requisito/título, prueba exacta, comando, resultado y límite real. No marcar escenarios cubiertos por la mera existencia de un test.

| Grupo | Evidencia necesaria |
|---|---|
| Decimales e impuestos | HALF_UP por línea, escala/rango, cero, cantidades enteras, IVA por línea, tarifas de prueba explícitas, valor inventariable y ausencia de cambios de precio de venta. |
| Valoración | Ejemplos de specs, residuo terminal y caso límite parcial, entradas repetidas del mismo producto, agotamiento y reingreso, reproducción desde movimientos y reversión exacta. |
| Persistencia | Unicidad documental/confirmada/inicial/reversión, FK protegidas, triggers frente a ORM y SQL, historia independiente de cambios de catálogo, estados válidos. |
| Atomicidad | Fallos después de número, uso fiscal, primer producto, actualización de posición y auditoría; exigir rollback de todos los efectos y recibo, no solo estado del documento. |
| Concurrencia PostgreSQL | Dos salidas de 4 sobre 5; entrada/salida; iniciales simultáneas; confirmación repetida con igual/distinta clave; reemplazos; anulaciones competidoras; baja de proveedor/producto; edición/sucesión fiscal y de series contra confirmación; múltiples productos en orden inverso. |
| Revisión | Token modificado/vencido/otro actor, cambio de tarifa o datos relevantes, versión obsoleta, coincidencia SIN_DOCUMENTO nueva, replay exitoso con token ya expirado. |
| Consultas | Saldo antes de período, página dos, tipos ocultos, rango vacío, inactivos, misma hora, corte estable mientras otro usuario confirma, ausencia de N+1 y reconciliación al mismo corte. |
| Autorización | Todos los métodos con tres roles/combinaciones, sesión invalidada/temporal/CSRF, costos ausentes incluso en errores/orígenes/recibos, reverse de compra por endpoint manual bloqueado. |
| Frontend/E2E | Flujo completo contra API real, revisión de importes, doble envío/timeout, stock insuficiente y anulación bloqueada, filtros al regresar, foco/teclado/axe y tamaños indicados. |
| Regresión y operación | Identidad, clientes, configuración, catálogos, migraciones limpias/con datos, OpenAPI y dependencias sin cambios injustificados. |

Concurrencia: `pytest.mark.django_db(transaction=True)`, conexiones independientes por worker, cierre de conexiones, barreras/eventos con timeout antes de adquirir el recurso competido; nunca barreras que exijan que ambos posean el mismo bloqueo. Afirmar número exacto de éxitos/errores controlados, workers terminados, saldos, valores, movimientos, números, usos y auditoría. No aceptar pruebas vacías o solo «no excepción»; los tests existentes de numeración necesitan endurecer sus aserciones y envoltura transaccional donde corresponda.

Comandos enfocados previstos: `cd backend && uv run pytest --no-cov tests/purchasing tests/inventory tests/workshop_configuration`, suites frontend con `npm test` y E2E con `npm run test:e2e -- e2e/purchases-inventory.spec.ts`. Verificación final: `make check`, `make test`, `make audit`, `make compose-check`, E2E pertinentes, `cd backend && uv run python manage.py spectacular --validate`, chequeo del esquema versionado, `openspec validate --all --strict --no-interactive` y `git diff --check`. `--no-cov` solo para ciclos enfocados; no bajar cobertura global. Estos comandos están previstos, no ejecutados por este diseño.

### 12. Registro de decisión arquitectónica propuesto

**Estado: propuesto dentro de este diseño.** Título para el ADR de implementación: «Publicación transaccional y consulta estable de movimientos de inventario». Complementa ADR-0001 y ADR-0004; no los reemplaza. Se aplica la habilidad architecture-decision-records para conservar contexto, alternativas y consecuencias. Tras aprobar este diseño, materializarlo en `docs/adr/0005-publicacion-transaccional-inventario.md` durante apply, con su referencia terminológica y enlace al diseño aprobado.

Contexto: compras y futuras salidas comparten saldos, costos y correcciones, pero no deben mutar la persistencia de inventario ni confirmar fragmentos independientes. Decisión propuesta: inventory es propietario de posición y movimientos, expone servicios bajo transacción exterior y orden total, conserva historia inmutable y devuelve consultas por corte ordinal. Compras coordina el documento y sus efectos; el catálogo conserva solo datos maestros. Alternativas: saldo en Producto, sumas sin bloqueo, transacciones independientes y event sourcing/mensajería; descartadas por carreras, efectos parciales o complejidad sin necesidad actual. Consecuencias: consultas rápidas y explicables, fronteras comprobables y núcleo reutilizable, a cambio de mantener reconciliación, snapshots, protocolo de bloqueo y pruebas PostgreSQL.

La corrección del orden de bloqueos de configuración es cumplimiento del ADR-0004 existente. No cambiar su estado o reglas para justificar código defectuoso. No adoptar reservas o servicios futuros mediante este ADR; cada nueva capacidad deberá respetar el contrato y justificar sus extensiones.

## Risks / Trade-offs

- [Brecha entre ADR y código fiscal] → Corregir raíces de bloqueo y precondición transaccional antes de integrar compras; pruebas conjuntas con sucesiones, no solo pruebas aisladas de números.
- [Contención en proveedores/productos frecuentes] → Secciones críticas sin red ni renderizado, máximo 200 líneas, orden estable y bloqueo solo de recursos implicados; no ampliar a toda la instalación.
- [Anulación conservadora frustrante] → Mostrar causa y dependencia, permitir reemplazo después de una anulación válida y ajuste físico separado; no prometer revaloración retrospectiva.
- [Redondeos acumulados] → Valor conservado separado del promedio publicado, residuo explícito y pruebas de agotamiento/costos mínimos; no modificar totales históricos para cuadrar visualmente.
- [Filtro interpretado como saldo físico] → Resúmenes del período y coincidencias separados, saldo previo real y corte visible; pruebas numéricas de página filtrada.
- [Datos protegidos en respuestas o caché] → Proyecciones por lista blanca, permisos antes de replay, tokens con digest sin importes, limpieza de sesión y pruebas negativas recursivas.
- [Triggers y snapshots añaden mantenimiento] → Migraciones reversibles ensayadas antes de datos reales, esquema snapshot versionado y pruebas SQL/ORM; no duplicar lógica de cálculo en triggers.
- [Cambios anteriores todavía activos] → No archivar ni afirmar cobertura ajena; correr regresión y registrar fallos preexistentes. La spec de catálogo sigue en su cambio activo, sin duplicar sus deltas aquí.

## Migration Plan

1. Aprobar design y registrarlo en `master` antes de tasks; después aprobar/registrar tasks antes de apply. Este documento no autoriza commits adicionales, despliegue ni archivo.
2. Durante apply generar migraciones aditivas. Dependencias inspeccionadas: `catalog/0002_product_manufacturer_code`, `supplier_registry/0001_initial`, `workshop_configuration/0005_alter_configurationcommand_options_and_more`, usuario swappable; verificar nombres reales de nuevo al generar. Inventory depende de catálogo/configuración/usuario; purchasing de inventario/proveedor/catálogo/configuración. Ninguna FK de inventory hacia purchasing, para evitar dependencia circular.
3. Crear tablas, constraints, índices y triggers propios. No sembrar productos, compras, saldos, tasas, proveedores ni posiciones. Una ficha sin movimientos se proyecta con saldo real cero, sin migración masiva de posiciones. Las correcciones de servicios fiscales no cambian datos históricos ni numeraciones existentes.
4. Ensayar PostgreSQL limpio y copia desechable con identidad, clientes, configuración y catálogos; comprobar conteos e identidades anteriores, restricciones, reversibilidad técnica antes de datos reales y `makemigrations --check --dry-run`. Si se detectan tablas/saldos previos externos al esquema previsto, detener su incorporación, inventariar y reconciliar; no importarlos automáticamente ni duplicarlos mediante carga inicial.
5. Actualizar en apply `backend/schema.yml`, README, `docs/arquitectura/modelo-datos.md`, arquitectura inicial, reglas/requisitos/CU/UI/trazabilidad, cobertura, glosarios/referencias y ADR propuesto. Registrar como aprobadas las concreciones de IVA, redondeo y fechas de esta capacidad; conservar alertas/adjuntos y demás exclusiones como pendientes, sin declarar todo RF-INV implementado. C4 de contenedores no cambia; documentar nuevas fronteras internas.
6. Solo con autorización de despliegue: respaldo probado, backend y `make migrate`, comprobaciones de permisos/reconciliación, frontend. Configuración fiscal y bodega existentes deben estar listas antes de confirmar; las cargas reales se realizan explícitamente por Administrador con cantidades y costos comprobados.
7. Recuperación: preferir corrección hacia adelante. Si se vuelve al código anterior, conservar tablas nuevas y los datos publicados, deshabilitando acceso a las nuevas operaciones durante diagnóstico. No revertir migraciones con movimientos reales ni restaurar respaldos sin autorización; un rollback de código no elimina compras confirmadas.

## Open Questions

No se solicita otra decisión de negocio para redactar tasks: propuesta y specs ya fijaron IVA por línea, redondeo, fechas, documentos, alcance y anulaciones. Límites técnicos, rutas, tokens, almacenamiento y protocolo de publicación aquí propuestos quedan sujetos a aprobación de este diseño. Tarifas reales y clasificación tributaria continúan como datos autorizados del negocio; no se infieren de los ejemplos de prueba. Las correcciones de valoración sin diferencia física y con movimientos posteriores no están habilitadas en esta entrega.

## Fuentes y evidencia de esta fase

Fuentes normativas consultadas en esta tarea: decisiones confirmadas y modelo de dominio completos, proposal y sus referencias, las tres specs y sus referencias; specs principales de modelo, autorización y configuración; RN-INV, RN-FIS, RN-SEG, RF-INV/RF-CAT/RNF-INT, CU-007/008/009/015, UI-031/040…045, roles y glosarios. Se mantienen las brechas de proposal; no se incorporan documentos históricos como requisitos.

Fuentes técnicas: ADR-0001/0003/0004, arquitectura inicial, C4 de contenedores, README, Makefile, DESIGN.md; propuesta/diseño/tareas y contratos pertinentes del catálogo activo. Inspección de modelos de catálogo/proveedor/configuración, servicios de productos/proveedores, recibos, resolvedor/numeración/series/impuestos, autorización y errores uniformes; pruebas de frontera y concurrencia existentes; App, ProductDetailPage/ProductsPage, componentes/exportaciones, cliente HTTP, seguimiento de intenciones y scripts npm. Los nombres de archivos de implementación nuevos son propuestas, no archivos creados.

Validación de este artefacto: OpenSpec, enlaces locales, estructura y revisión del diff. No se ejecutan ni se declaran aprobadas pruebas de software, migraciones o revisión visual por crear este diseño. El siguiente artefacto es tasks, únicamente después de aprobación explícita y registro de design en `master`.
