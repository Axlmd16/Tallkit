## Context

La propuesta y las specs aprobadas sustituyen la compra documentada por una **entrada de stock** que el Vendedor registra y confirma en una acción, con proveedor, referencia y costo opcionales (D1…D5, R1…R6).

Estado actual inspeccionado:

- `purchasing` coordina el documento. `Purchase` exige `document_identity` (proveedor, tipo y referencia únicos) y `document_date`; `PurchaseLine` exige `unit_cost`, `tax_definition` y `tax_treatment`. El flujo es borrador → revisión con token → confirmación, más reemplazos (`purchases.py`, 1196 líneas). Las escrituras pasan por `execute_write` con recibo idempotente `PurchaseCommand`.
- `inventory` es propietario de posiciones, operaciones y movimientos (ADR-0005). `valuation.py` modela `Position(quantity, value, average)`; `post_operation` trata una línea de entrada sin valor como valor cero. `InventoryMovement.applied_unit_cost` es obligatorio y los movimientos son inmutables por modelo y por trigger.
- `sales` congela el costo de salida en `SaleCostAllocation` (`published_unit_cost`, `applied_value`, ambos obligatorios) y las devoluciones reingresan a ese costo.
- `identity/domain/authorization.py` concede `ingresos.*` y `proveedores.*` solo a Administrador. `supplier_registry/application/purchase_references.py` ya ofrece una lectura de referencias de proveedor para compras.
- Frontend: `/purchases`, `/purchases/new`, `/purchases/:id` y `/purchases/:id/edit`, con `PurchaseEditorPage`, `LinesEditor` (impuestos), `ReviewDialog` y `ReplacementDialog`. La navegación muestra «Ingresos» según `ingresos.ver`.

Restricciones: monolito modular sin mutar persistencia ajena; backend como autoridad de permisos, inventario y secuencias; historia inmutable; sin dependencias nuevas; TDD.

## Goals / Non-Goals

**Goals:**

- Un único flujo de entrada, de un paso, utilizable por el Vendedor sin conocer costos ni impuestos.
- Valoración coherente cuando falta el costo, sin fingir valores cero y sin romper la conciliación ni la anulación exacta.
- Conservar intactas y legibles las compras anteriores.
- Mantener atomicidad, idempotencia, numeración COM-ING y orden de bloqueos de ADR-0005.
- Pantalla mínima: buscar, ajustar cantidad, confirmar.

**Non-Goals:**

- Completar costos después, revalorar historia o corregir retroactivamente productos sin costo.
- Reporte de margen, cuentas por pagar, adjuntos, conteo físico, alertas y salidas especiales.
- Convertir compras anteriores al formato nuevo.
- Lectura de códigos por cámara o integración con lectores más allá de la entrada por teclado.

## Decisions

### 1. Un solo modelo de ingreso con discriminador de flujo

`Purchase` se conserva y gana `flow` (`LEGACY` | `SIMPLE`, por defecto `LEGACY`). Para `SIMPLE`: `document_identity` y `document_date` pasan a admitir nulo; se añaden `supplier` (FK opcional), `external_reference` (texto libre), `content_signature` y `confirmed_on`. En `PurchaseLine`, `unit_cost`, `tax_definition` y `tax_treatment` admiten ausencia. Restricciones CHECK por flujo: `SIMPLE` exige identidad y fecha documental nulas, sin `replaces` y estado distinto de borrador; `LEGACY` conserva las exigencias actuales.

*Por qué:* una sola tabla da una sola lista, un solo detalle, una sola anulación y un solo `source_type` en inventario, y la numeración COM-ING sigue siendo única por la restricción existente.
*Alternativa descartada:* modelos nuevos `StockEntry`. Obligaría a unir dos tablas en lista, Kardex y anulación, y duplicaría la protección de historia.

### 2. Valoración con costo ausente en el dominio de inventario

`Position` gana `valued: bool`. `valuation.py` concentra las reglas, sin Django:

| Entrada | Posición previa | Resultado |
|---|---|---|
| Con costo | Valorada o vacía | Como hoy: suma valor y recalcula el promedio. |
| Con costo | Sin costo, con existencia | Regulariza: las unidades previas se valoran a ese costo; el importe se devuelve como `regularization_value`. |
| Sin costo | Valorada, con existencia | Suma `cantidad × promedio`; el promedio publicado no cambia y el residuo permanece en el valor. |
| Sin costo | Vacía con último promedio conocido | Se valora a ese promedio. |
| Sin costo | Vacía sin promedio previo, o sin costo | Queda `valued = False`, valor y promedio en cero sin significado económico. |

Una salida de una posición sin costo aplica valor cero y marca el movimiento como sin costo; al agotarse, la posición vuelve a vacía.

El **último promedio conocido** no se almacena: se deriva del movimiento vigente más reciente de la posición con promedio positivo (antes o después). Como la reversión solo procede sobre el último movimiento, la historia vigente se comporta como una pila y la derivación es exacta también tras anular.
*Alternativa descartada:* cachearlo en la posición. Exigiría guardar su valor previo en cada movimiento para restituirlo al revertir.

### 3. Persistencia aditiva en inventario

- `InventoryPosition.valued` (por defecto verdadero).
- `InventoryMovement`: `cost_known` (el movimiento tuvo costo aplicable), `valued_before`, `valued_after` y `regularization_value` (por defecto 0). No se vuelve nulo ningún campo existente; los movimientos sin costo guardan ceros y la bandera indica que no deben leerse como costo.
- `EntryLine.value` admite `None`; `prepare_operation` lo acepta solo para `PURCHASE_RECEIPT` y `CUSTOMER_RETURN_IN`. Carga inicial y ajustes siguen exigiendo costo.
- `reverse_exactly` compara y restituye también `valued`, de modo que anular una entrada sin costo o una regularización devuelve el estado previo exacto.
- `reconciliation.py` reproduce las cuatro reglas; las consultas de valoración excluyen posiciones sin costo e informan cuántas quedan fuera.

*Por qué banderas y no nulos:* las filas existentes quedan válidas con valores por defecto, las restricciones `>= 0` se mantienen y no hay que reescribir historia protegida por triggers.

### 4. Coordinación de la entrada en `purchasing`

Nuevo caso de uso `register_entry` que, en una transacción y con el orden total de ADR-0005 (recibo, proveedor si existe, productos por ID, posiciones, contexto de configuración y número, inserciones):

1. Autoriza `ingresos.crear` e `ingresos.confirmar` y reclama el recibo idempotente.
2. Valida líneas: producto activo, sin repetidos, cantidad entera positiva, costo ausente o ≥ 0 con hasta seis decimales.
3. Calcula `content_signature` (hash de pares producto–cantidad ordenados) y busca entradas `SIMPLE` confirmadas vigentes con la misma firma y el mismo `confirmed_on` (día de America/Guayaquil). Si existen y no están en `acknowledged_entry_ids`, responde conflicto `possible_duplicate` con sus números, sin efectos.
4. Crea el ingreso confirmado con instantáneas, publica la operación `PURCHASE_RECEIPT`, asigna COM-ING y audita.

No se usan tokens de revisión: la revisión es una llamada de solo lectura y la confirmación revalida todo dentro de la transacción.
*Alternativa descartada:* conservar borrador más token. Contradice el flujo de un paso y mantiene estado sin valor.

Se elimina el código de escritura del flujo anterior (crear y editar borrador, vista previa, confirmar, reemplazo, opciones de impuesto). Se conserva la lectura de lo almacenado y `void_purchase`, que sirve a ambos flujos.

### 5. Contrato de API

| Método y ruta | Permiso | Uso |
|---|---|---|
| `POST /api/v1/purchases/entries/review/` | `ingresos.crear` | Valida sin escribir; devuelve resumen y posibles duplicados. |
| `POST /api/v1/purchases/entries/` | `ingresos.crear` + `ingresos.confirmar` | Registra y confirma. Cuerpo: `idempotency_key`, `lines[{product_id, quantity, unit_cost?}]`, `supplier_id?`, `reference?`, `observation?`, `acknowledged_entry_ids?`. |
| `GET /api/v1/purchases/` y `/{id}/` | `ingresos.ver` | Lista y detalle de ambos flujos; filtros `state`, período de confirmación, `registered_by` y búsqueda. La lista devuelve los usuarios que han registrado entradas para poblar el filtro sin exigir `usuarios.ver`. |
| `GET|POST /api/v1/purchases/{id}/void-preview/`, `/void/` | `ingresos.anular` | Sin cambios de contrato. |
| `GET /api/v1/suppliers/options/` | `ingresos.crear` | Identificador y nombre de proveedores activos, con búsqueda. Reutiliza `list_supplier_references`. |

Se retiran `POST /purchases/`, `PATCH /purchases/{id}/`, `/preview/`, `/confirm/`, `/replacement/` y `tax-options/`. `schema.yml` se regenera.

### 6. Proyección por rol en el servidor

Los serializadores de lista y detalle omiten costos, valores, impuestos, totales e identificación del proveedor cuando el actor carece de `productos.ver_costos`; no se envían como nulos ni se ocultan en el cliente. El costo que el Vendedor informa se acepta en la escritura y no vuelve en la respuesta. Kardex y ventas aplican la misma regla con `inventario.ver_valorizacion`. `ROLE_PERMISSIONS[VENDEDOR]` gana `ingresos.ver`, `ingresos.crear` e `ingresos.confirmar`.

### 7. Costo ausente en ventas y devoluciones

`SaleCostAllocation` gana `cost_known` (por defecto verdadero), copiado del movimiento de salida. Las lecturas administrativas muestran «sin costo registrado» cuando es falso. Una devolución apta de una línea con costo desconocido reingresa con `EntryLine.value = None`, lo que aplica la regla de la decisión 2. La conciliación de ventas no cambia: los valores son cero en ambos lados.

### 8. Frontend: una pantalla, tres gestos

- **Rutas:** `/purchases` (lista), `/purchases/new` (registro) y `/purchases/:id` (detalle). Se elimina `/purchases/:id/edit`. La navegación pasa a llamarse «Entradas».
- **Registro (`EntryPage`), página de ancho completo:** un buscador con foco inicial y, debajo, la lista de productos elegidos. Cada fila muestra código, nombre y un control de cantidad con botones de más y menos. Enter con un código interno exacto agrega el producto y devuelve el foco al buscador, lo que permite usar un lector sobre las etiquetas existentes. Elegir un producto ya presente suma uno.
- **Detalles opcionales:** un único desplegable cerrado por defecto con proveedor, referencia y observación, y un interruptor «Registrar costos» que añade un campo de costo por fila. Nada lleva marca de obligatorio.
- **Revisión (`EntryReviewDialog`):** «Entran N productos, M unidades», los detalles informados y, si el servidor detecta un posible duplicado, un aviso con el número existente y una casilla de reconocimiento.
- **Resultado:** toast con el número asignado; el formulario se vacía y el foco vuelve al buscador.
- **Lista:** número, momento, usuario, productos, unidades y estado; filtros por estado, período y usuario. **Detalle:** líneas y movimientos; costos, sección de compra anterior y acción de anular solo para Administrador.
- Se eliminan `PurchaseEditorPage`, `LinesEditor`, `ReplacementDialog`, `draft.ts` y los selectores de impuesto. Se reutilizan `Combobox`, `Dialog`, `Toast`, `DataTable` y los tokens semánticos del sistema visual; no se añaden dependencias.

*Por qué página y no modal:* la lista crece con cada producto y se usa de forma repetida; el modal queda para la revisión.

### 9. Decisión arquitectónica duradera

Se crea **ADR-0011 «Valoración de inventario con costo ausente»**, que complementa a ADR-0005 sin reemplazarlo: registra las reglas de la decisión 2, las banderas de la decisión 3 y la derivación del último promedio. ADR-0005 recibe solo una nota de referencia.

### 10. Estrategia de pruebas

- **Dominio:** `valuation.py` con las cinco combinaciones, salidas sin costo, agotamiento y reversión exacta.
- **Inventario:** publicación, reversión, conciliación y Kardex con movimientos sin costo y regularización; concurrencia de dos entradas del mismo producto.
- **Compras:** matriz de permisos por rol y unión de roles; validaciones; idempotencia y conflicto; duplicado con y sin reconocimiento; numeración continua; anulación incluida la de entradas sin costo; compras y borradores anteriores de solo lectura; ausencia de costos en respuestas al Vendedor.
- **Proveedores y ventas:** selección mínima; venta, venta mixta y devolución con costo ausente.
- **Frontend:** registro, revisión, detalles plegados, código exacto, repetición de producto, toast y proyección por rol; E2E `purchases-inventory.spec.ts` reescrito para el flujo del Vendedor.

Conforme a la preferencia del usuario, durante la aplicación se ejecutan las pruebas focalizadas de `purchasing`, `inventory`, `supplier_registry`, `sales` e `identity` y las del frontend afectado, y se informa qué no se ejecutó.

## Risks / Trade-offs

- [Una persona registra entradas y ventas sin aprobación] → Usuario y momento en cada movimiento, auditoría de éxito y fallo, filtro por usuario en la lista y anulación solo administrativa.
- [Regularizar asigna a unidades antiguas un costo que no fue el suyo] → Es la mejor estimación disponible; queda trazada en `regularization_value` y visible en Kardex. Aceptado por R1.
- [Inventario parcialmente valorado] → El total excluye e informa los productos sin costo; nunca muestra cero.
- [Filtración de costos al Vendedor] → Proyección en el servidor y pruebas negativas por cada endpoint, incluidos errores y referencias anidadas.
- [Banderas más ceros pueden leerse como costo cero por descuido] → Las lecturas pasan por funciones de proyección únicas; pruebas que distinguen costo cero de costo ausente.
- [El aviso de duplicado solo detecta coincidencias exactas del mismo día] → Aceptado; evita el doble clic lógico sin bloquear recepciones legítimas.
- [Los triggers de historia de `purchasing` e `inventory` pueden rechazar las columnas nuevas] → Revisar ambos `0002_history_protection` y ajustar sus listas de columnas en la misma migración.
- [Retirar endpoints rompe clientes antiguos] → Solo existe el frontend propio, que se actualiza en el mismo cambio.

## Migration Plan

1. `inventory` 0006: columnas `valued`, `cost_known`, `valued_before`, `valued_after` y `regularization_value` con valores por defecto; ajuste de triggers si procede. Sin relleno de datos.
2. `purchasing` 0003: `flow`, campos opcionales, `supplier`, `external_reference`, `content_signature`, `confirmed_on`, restricciones por flujo e índice por firma y día. Las filas existentes quedan como `LEGACY`.
3. `sales`: columna `cost_known` en `SaleCostAllocation`.
4. Permisos del Vendedor, API, frontend y documentación en el mismo despliegue.

Los borradores anteriores no se modifican ni eliminan: quedan como `LEGACY` en borrador, sin acciones.

**Reversión:** las migraciones son reversibles mientras no existan entradas `SIMPLE` ni movimientos sin costo. Si ya existen, la reversión exige restaurar el respaldo previo al despliegue; debe tomarse uno antes de aplicar.

**Documentación a sincronizar al aplicar:** `decisiones-confirmadas.yaml` (nueva decisión que sustituye DP-011, DP-022, DP-023 en compras y DP-024, y roles), `modelo-dominio.md`, `alcance-v1.md`, `reglas-negocio.md`, `glosario.md` («Entrada de stock», «Sin costo registrado»), `requisitos-funcionales.md`, `casos-de-uso.md`, `actores-y-roles.md`, `interfaz-y-navegacion.md`, matriz de trazabilidad, `cobertura-compras-inventario.md`, ADR-0011 y OpenAPI.

## Open Questions

- Validación externa con un contador sobre dejar de registrar el IVA de compras y mantener existencias sin valor. No bloquea la implementación; debe resolverse antes de operar con datos reales.
- Ninguna decisión técnica pendiente bloquea las tareas.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
