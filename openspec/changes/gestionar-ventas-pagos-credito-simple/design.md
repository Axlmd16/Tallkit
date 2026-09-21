## Context

La propuesta registrada en `master` (`b527d68`) y sus recomendaciones fueron aprobadas. Las tres specs, registradas en `master` (`c393e13`), contienen 24 requisitos y 105 escenarios; el usuario aprobó expresamente avanzar a diseño mediante «si esta bien, continua». Este diseño fue aprobado expresamente por el usuario el 2026-09-20, sobre el contenido registrado en `master` en `0ef91f6`, junto con el ADR-0006 propuesto; la aprobación habilita únicamente la creación de tareas. Se redacta en `develop`, sin autorización para commits, merges ni implementación.

Existen identidad, configuración, clientes, catálogo, compras e inventario. La descripción general de «dominio sin implementar» sigue obsoleta: las rutas y los módulos reales demuestran esas capacidades, pero no ventas ni cobros. Se conservan las decisiones confirmadas y el modelo conceptual, la separación fiscal, sesiones/CSRF y el monolito modular de ADR-0001/0003/0004/0005. Las specs previas y sus referencias terminológicas son dependencias de este diseño.

Hallazgos relevantes de la inspección:

- `inventory/application/posting.py` publica entradas/salidas agrupadas por producto y revierte exactamente el último movimiento. `OperationKind` solo contiene compra, carga inicial, ajustes y reversión; faltan tipos comerciales. `valuation.py` conserva valor a seis decimales y absorbe residuos al agotar existencias.
- `catalog/application/inventory_references.py` entrega DTO de producto sin precio de venta. `customer_registry/application/catalog_references.py` solo expone marcas de vehículo. Ventas necesita referencias públicas nuevas, no importar modelos ajenos.
- `workshop_configuration/application/operation_context.py`, `configuration_resolver.py` y `numbering.py` ya exigen transacción exterior para sus escrituras. Hay que consumir sus contratos y verificar el orden conjunto, no copiar la vieja brecha del diseño de compras como si siguiera vigente.
- `purchasing/application/commands.py` implementa recibos idempotentes y autorización anterior al replay; su patrón sirve de referencia, pero sus servicios y modelos siguen perteneciendo a compras.
- `frontend/src/shared/api/idempotency.ts` conserva una intención incierta en memoria; `latest-review.ts` protege contra respuestas de revisión obsoletas. `features/purchases` muestra integración con consultas, cachés y confirmaciones. El seguimiento actual por sí solo no resuelve un cobro incierto después de recargar la página.

## Goals / Non-Goals

**Goals:** completar ventas directas, cobros y crédito comercial, devoluciones, reembolsos y anulación conservadora; garantizar **transacción atómica**, **idempotencia**, historia reproducible, permisos y protección de costos; integrar consultas y comprobantes accesibles; preservar datos existentes y probar concurrencia real.

**Non-Goals:** proformas, mantenimiento, reservas, cobros artesanales, cierres, contabilidad, SRI, nuevas series fiscales, descuentos, pasarelas de pago, cambios generales del sistema visual y reconstrucción de módulos existentes. No se diseña todavía una abstracción universal de documentos o pagos para ambos RUC: DM-001 permanece abierto fuera del alcance comercial concreto.

## Decisions

### 1. Un módulo comercial con responsabilidades internas explícitas

Crear `backend/src/sales/` como propietario de ventas, devoluciones y registros de dinero comerciales. Dentro de `application`, separar `sales.py`, `payments.py`, `returns.py`, `refunds.py`, `voids.py`, `reviews.py`, `queries.py` y `commands.py`; `domain` contiene cálculos puros y validaciones sin Django/HTTP. `api` traduce contratos y errores, sin cálculos monetarios ni escrituras ajenas. Los nombres son rutas propuestas, no archivos existentes.

La raíz de consistencia es la venta: toda acción que cambie su exigible, pagos o cantidades devueltas bloquea primero la misma venta. Los servicios internos de pagos no abren transacciones independientes ni vuelven a reclamar otro recibo durante una anulación coordinada. El código futuro de taller no importa estos modelos; necesitará su propio cambio e interfaz aprobada.

Alternativas: un módulo genérico `payments` para ambos RUC anticiparía contratos artesanales todavía no definidos; tablas universales de documentos resolverían DM-001 prematuramente; escribir saldos desde views produciría reglas duplicadas. Se elige un módulo comercial con servicios internos separados y frontera pública estrecha. La decisión duradera queda propuesta en [ADR-0006](../../../docs/adr/0006-coordinacion-transaccional-ventas-comerciales.md).

### 2. Interfaces entre capacidades

| Propietario | Reutilización o ampliación propuesta | Contrato |
|---|---|---|
| `customer_registry` | Nuevo `application/sales_references.py` | Búsqueda paginada y consulta/bloqueo de cliente; DTO inmutable de identidad, contacto y estado; no entrega vehículos ni permite escribir clientes. |
| `catalog` | Nuevo `application/sales_references.py` | Referencias actuales con precio final y elección tributaria, búsqueda paginada y bloqueo por ID; conserva interfaz de inventario sin añadir precios a consumidores que no los necesitan. |
| `inventory` | `posting.py`, `queries.py`, `reconciliation.py` | Nuevos tipos `SALE_OUT` y `CUSTOMER_RETURN_IN`, publicación y consulta de efectos históricos; reversión exacta existente para anulación. |
| `workshop_configuration` | `operation_context.py`, `configuration_resolver.py`, `numbering.py` | Contexto comercial/bodega, vigencia en fecha efectiva, uso fiscal y numeración de VENTA dentro de la transacción exterior. |
| `identity` | Autorización y auditoría públicas existentes | Comprobar permisos antes de ejecutar/repetir, registrar resultado sin secretos; reembolsos exigen Administrador y permiso administrativo comercial, sin permisos personalizables nuevos. |

Las variantes bloqueantes son internas al proceso y exigen transacción activa. La API no las importa ni acepta DTO de bloqueo desde HTTP. Las referencias nuevas comparten helpers privados dentro de su propio módulo si conviene, sin reutilizar funciones privadas de otro propietario. Los modelos comerciales usan referencias protegidas por `PROTECT`, declaradas por nombre; ningún servicio de ventas consulta o modifica modelos ajenos directamente.

El cliente se valida mediante su módulo conforme al contrato vigente: identidad registrada y seleccionable para nuevas ventas; una desactivación posterior no impide consultar o corregir la historia. Las correcciones de inventario consultan productos históricos con `require_active=False`.

### 3. Persistencia propuesta y protección histórica

| Registro dentro de `sales` | Responsabilidad y restricciones |
|---|---|
| `Sale` | Cliente, entidad comercial, condición, estado, versión, fechas, número/asignación, copias históricas y operación de salida. Número único cuando existe; borrador sin número. La versión aumenta también ante cobros/correcciones para invalidar revisiones. |
| `SaleLine` | Posición, producto, cantidad y, al confirmar, precio/base/tarifa/impuesto/total históricos y vínculo a la asignación de costo. Cantidad entera positiva y posición única por venta. |
| `SaleCostAllocation` | Vínculo entre línea comercial y movimiento agrupado de inventario; cantidad, costo publicado y valor realmente aplicado a seis decimales, incluidos residuos. Inmutable. |
| `CommercialPayment`, `PaymentPart` | Identidad UUID estable del hecho, venta, importe, fecha efectiva, actor y una parte por medio. Partes positivas, suma exacta; no reutilizar un UUID para otra venta o entrada. |
| `PaymentCorrection` | Anulación lógica del pago original, motivo y reemplazo opcional; una corrección vigente por original. El estado del pago se deriva de este registro, sin sobrescribir sus datos históricos. |
| `SaleReturn`, `SaleReturnLine` | UUID, venta, motivo, fecha, actor, líneas originales, cantidades aptas/no aptas, importes y asignaciones históricas. Una devolución confirmada no admite edición ordinaria. |
| `CommercialRefund`, `RefundPart` | Desembolso efectivo, UUID, venta, origen devolución/anulación, medios, importe, fecha y actor. Inmutable; no representa una orden al banco. |
| `SaleVoid` | Una anulación por venta, motivo, actor, fecha y referencias a reversión y tratamiento de pagos. |
| `SalesCommand` | Recibo actor/acción/clave, huella canónica, identidad de resultado, estado HTTP y momento; sin duplicar datos sensibles de la respuesta. |

No almacenar saldo, exceso ni estado de pago como valores editables. E se obtiene de total histórico menos devoluciones válidas o cero si anulada; P de pagos menos pagos corregidos; R de reembolsos efectivos. Calcular saldo y exceso con las fórmulas aprobadas y estado derivado. Los agregados deben evitar multiplicación por joins entre líneas, pagos y partes; usar agregados independientes y probar sus resultados.

Restricciones locales en base: importes no negativos o positivos según concepto, cantidades enteras, estados/medios válidos, unicidad de UUID/número/corrección, referencias `PROTECT`, partes sin medio repetido. Las reglas que suman filas y cantidades acumuladas se verifican bajo bloqueo de `Sale`; añadir triggers diferidos para sumas de partes y pertenencia a la misma venta cuando involucren varias filas. Triggers de historia impiden UPDATE/DELETE de hechos confirmados y cambios en snapshots; la transición autorizada de `Sale` solo puede modificar estado/versión/campos de anulación, nunca sus importes originales. Borradores conservan edición optimista mediante `expected_version`.

Valores monetarios de venta/pago: `Decimal(24,2)`; valor de costo asignado `Decimal(38,6)`, costo publicado `Decimal(24,6)` y cantidades compatibles con inventario `Decimal(18,6)`, restringidas a enteros. El dominio rechaza valores fuera de los máximos antes de persistir. No convertir números monetarios a `float` ni multiplicar importes con `Number` en la interfaz.

### 4. Cálculo y distribución histórica

`domain/amounts.py` implementa las fórmulas de venta aprobadas con contexto decimal local de precisión suficiente (60, como inventario), HALF_UP explícito y validación de desbordamientos. Una tarifa cero debe existir configurada; ausencia de tarifa es error. El total de línea conserva precio final por cantidad; base a centavos, impuesto por diferencia, documento por suma de líneas.

Inventario agrupa por producto y devuelve un movimiento por producto. Se permiten líneas comerciales repetidas; distribuir el valor de salida realmente aplicado entre sus líneas por cantidad y posición estable, usando diferencias de valor proporcional acumulado a seis decimales. La última línea absorbe el residuo. Guardar cada asignación, no reconstruirla después con el promedio actual ni solo con `cantidad × costo publicado`.

Devoluciones: por línea original, base acumulada a devolver = HALF_UP(base original × cantidad acumulada devuelta / cantidad vendida, 2); importe de esta devolución = diferencia contra acumulado anterior. Total por precio histórico y cantidad; impuesto por diferencia. Para costos, asignar a cada tramo devuelto su proporción acumulada del valor histórico con seis decimales, aun si el tramo no es apto. Solo el valor de la cantidad apta se publica como entrada; el valor asignado a no aptos no se redistribuye a productos aptos posteriores. Dentro de una devolución mixta ordenar tramos de forma canónica (apto y después no apto) y guardar la asignación; no depender del orden recibido. El último tramo devuelto agota el residuo de su línea. Así, devolver todo apto restituye exactamente el valor de salida y una devolución mixta nunca reintegra el costo de unidades no aptas.

Alternativa descartada: multiplicar cada devolución por el promedio publicado perdería residuos y podría crear valor. Tampoco recalcular impuestos con la tarifa actual.

### 5. Transacciones, bloqueos y reloj operativo

Una transacción exterior por comando contiene documento, historia, efectos de inventario/configuración, dinero, auditoría de éxito y recibo. Los savepoints internos no constituyen commits independientes. No se ejecuta red, impresión ni renderizado bajo bloqueo.

Orden total para ventas; se omiten grupos no usados, nunca se adquieren en orden inverso:

1. Recibo del comando por actor/acción/clave; autorización vigente antes de replay.
2. `Sale` y hechos comerciales necesarios en orden de tipo e ID estable; para creación, su nueva raíz antes de referencias externas. La identidad UUID de una nueva acción se reclama dentro de esta transacción y su unicidad resuelve carreras entre claves.
3. Operación de inventario original si se anula o se leen efectos originales para devolver, mediante su interfaz pública.
4. Cliente mediante su interfaz, después productos por ID ascendente mediante catálogo. Correcciones monetarias no vuelven a bloquear datos maestros.
5. Posiciones de inventario por producto/bodega en el mismo orden usado por compras. Posiciones faltantes solo se crean bajo el bloqueo del producto.
6. Entidad fiscal, bodega y definiciones tributarias por ID/periodos; después ámbito de numeración y serie activa conforme a ADR-0004. No volver a bloquear recursos de grupos anteriores.
7. Inserciones y actualizaciones propias, publicaciones, auditoría y cierre del recibo.

Antes de aplicar, probar este orden contra compras, ajustes, edición de clientes/productos y sucesiones tributarias. Ningún servicio de los módulos anteriores puede adquirir después una venta; no se introduce dependencia circular. Una corrección administrativa de pago toma la venta antes del pago, igual que el resto de acciones; jamás pago → venta. El bloqueo de la venta serializa el dinero sin un bloqueo global de todas las ventas.

Capturar hora del servidor tras los bloqueos relevantes. Para confirmación, resolver la fecha fiscal con esa hora en America/Guayaquil; después de adquirir los bloqueos de configuración/numeración, comprobar otra vez la fecha. Si cambió el día o la configuración revisada, abortar con `review_required`, sin consumir número. No sustituirlo por la hora de inicio de una transacción que estuvo esperando. Los movimientos respetan además el momento no decreciente y ordinal de cada posición existentes. Cobros y reembolsos toman su fecha al ejecutar bajo bloqueo de venta.

Un interbloqueo o fallo serializable revierte el comando entero y permite reintento de la misma identidad; no reintentar solo la numeración o el movimiento. Los rechazos esperados se auditan fuera de la transacción revertida; indisponibilidad de base deja solo el registro técnico correlacionado, nunca éxito inventado.

### 6. Idempotencia y revisión previa

Separar `idempotency_key` de transporte (formato existente de 8…128 caracteres) de `operation_id` UUID estable para pagos, devoluciones, reembolsos y correcciones. Venta y anulación tienen además identidad natural estable por venta. Dos cobros legítimos del mismo importe llevan UUID distintos; repetir un UUID con otra venta o contenido responde conflicto. No conservar un pago exitoso dos veces aunque cambie la clave HTTP.

Autorizar en cada solicitud antes de buscar/devolver un resultado. Guardar huella canónica normalizada de los datos significativos, resultado e identidad del hecho dentro de la transacción; al repetir, proyectar respuesta con permisos actuales para no devolver costos previamente visibles a otro estado de roles. Sin caducidad automática de identidades en V1.

Las revisiones son de solo lectura y devuelven token firmado de 15 minutos, ligado a actor, acción, venta, versión y huella del contenido/efectos: líneas y cantidades, condición, cliente relevante, precios/tarifas, fecha operativa, cantidades disponibles, saldo, devoluciones/reembolsos existentes y valoración cuando corresponda. Cada acción incluye solo sus dependencias relevantes. En escritura, recalcular bajo bloqueo y comparar; si cambió, `review_required`. Reutilizar un resultado ya aplicado no exige que el token siga vigente, pero sí firma válida y coincidencia con el intento histórico, como el patrón de compras.

Para dinero, una revisión caducada nunca obliga a repetir la entrega física: se revisan nuevamente los datos y se registra el mismo hecho con el mismo `operation_id`. Una clave con contenido ya registrado incompatible se rechaza, mientras que un intento fallido completamente revertido puede volver a validarse. Ofrecer consulta autorizada de estado por UUID antes de iniciar otra intención ante resultado incierto.

### 7. Flujos coordinados

**Confirmación:** bloquear venta y referencias, calcular importes y disponibilidad, validar revisión, resolver uso fiscal como consumidor `sale`, asignar número del ámbito VENTA, preparar/publicar `SALE_OUT`, guardar asignaciones históricas, snapshots y confirmación, auditar y completar recibo. No crear pagos. Contado conduce después al formulario de cobro completo; cero total no crea pago ficticio.

**Cobro:** bloquear venta, validar estado confirmado y calcular E/P/R; importe ≤ saldo, y en contado igual a saldo. Insertar pago/partes, aumentar versión, auditar. Corregir un pago crea registro compensatorio y reemplazo opcional juntos; recalcular el resultado neto y rechazar dependencias de reembolsos incompatibles. No importar funciones de anulación como si hubieran devuelto dinero real.

**Devolución:** bloquear venta, obtener línea y costo históricos, validar cantidad acumulada y revisión, registrar devolución y reducir exigible derivado. Publicar `CUSTOMER_RETURN_IN` solo si hay cantidad apta; el origen referencia la devolución y `corrects_operation` la salida original. No usar `REVERSAL` ni `reverses_movement` (relación uno a uno existente), porque hay devoluciones parciales múltiples y movimientos posteriores. Una devolución totalmente no apta no necesita operación física vacía. El exceso se deriva y permanece pendiente hasta registrar dinero devuelto.

**Reembolso de devolución:** bloquear venta y corrección, calcular exceso vigente y registrar importe/partes efectivos, sin invocar un banco. Validar además que sus importes acumulados no excedan la obligación atribuible a su corrección ni el exceso global actual. Mantener la asignación a la devolución explícita para consultas y detección de dependencias; no compensar ventas entre sí.

**Anulación de venta:** comprobar ausencia de devoluciones, último movimiento de cada producto y revisión actual; resolver los pagos erróneos mediante corrección previa, sin permitir borrar hechos reales. El comando de anulación recibe, cuando hay dinero real recibido, los datos del desembolso expresamente confirmado por el Administrador y su UUID. Registra ese reembolso de anulación, la reversión exacta, `SaleVoid` y el estado anulada juntos; neto aplicado final y exigible deben ser cero. No se registra un reembolso genérico anticipado mientras la venta conserva exigible, ni se finge que la transacción devuelve físicamente el dinero. Si el registro falla, la interfaz explica que debe reintentarse el registro del mismo desembolso, nunca entregar dinero otra vez.

### 8. Integración de inventario y reconciliación

Añadir los tipos a `OperationKind`, restricciones de operación/movimiento y a `ENTRY_KINDS` cuando corresponda. Mantener las reglas y triggers de historia existentes. `operations.py` seguirá aceptando solo carga y ajustes manuales; no admitir ventas/devoluciones a través de endpoints administrativos genéricos ni permitir revertirlas por ese acceso.

Publicar en inventario una consulta inmutable de efectos de salida y un resultado de publicación suficiente para las asignaciones de ventas. Si `operation_effects` ya entrega esos datos, reutilizarlo; si falta el valor aplicado, extender su DTO sin devolver modelos de persistencia. Ventas no calcula ni escribe `InventoryPosition`.

Kardex debe incorporar etiquetas y referencias autorizadas de venta/devolución; los cortes ordinales existentes siguen siendo válidos. Inspeccionar y ajustar `get_operation` para no tratar todo origen no PURCHASE como ajuste libre. Ver movimiento no concede permiso para abrir la venta ni acceder a costos. El catálogo visual no gana información económica por un enlace anidado.

Mantener `reconcile_inventory` como reconciliación física y de valor. Añadir `sales/management/commands/reconcile_sales.py`, solo lectura y salida no cero ante diferencias, para número/configuración, movimientos/asignaciones, cantidades devueltas, E/P/R, partes, reembolsos y ausencia de pagos huérfanos. Ventas consulta inventario por interfaz pública, inventario no importa ventas. No añadir `--fix` ni corregir saldos silenciosamente.

### 9. API y errores

Montar `sales.api.urls` desde `backend/src/config/api/urls.py`. Rutas propuestas relativas a `/api/v1/`:

| Métodos y ruta | Uso |
|---|---|
| GET/POST `sales/`; GET/PATCH `sales/{id}/` | Lista, creación, detalle y edición optimista del borrador. Sin DELETE. |
| POST `sales/draft-preview/`; POST `sales/{id}/preview/`, `confirm/` | Previsualización de captura sin persistir; revisión y confirmación del borrador guardado separadas. |
| GET `sales/{id}/document/` | Datos históricos autorizados para comprobante imprimible, sin costos. |
| GET/POST `sales/{id}/payments/`; POST `payments/preview/` | Historial, registro y revisión de cobro. |
| POST `sales/{id}/payments/{payment_id}/correction-preview/`, `correct/` | Anular pago erróneo o sustituirlo; acción explícita y motivo. |
| GET/POST `sales/{id}/returns/`; POST `returns/preview/` | Historia, devolución confirmada y revisión sin efectos. |
| GET/POST `sales/{id}/refunds/`; POST `refunds/preview/` | Desembolsos de devoluciones; reembolso por anulación solo dentro de `void/`. |
| POST `sales/{id}/void-preview/`, `void/` | Anulación con su tratamiento de dinero. |
| GET `sales/receivables/` | Deuda comercial y exceso separados, filtros/totales coherentes. |
| GET `sales/operations/{operation_id}/` | Consultar hecho comercial ya registrado tras incertidumbre, con permisos de su venta. |
| GET `sales/customer-options/`, `product-options/` | Selectores autorizados paginados por referencias públicas. |

Todas las escrituras exigen sesión y CSRF; previas POST son de solo lectura sin recibo ni asignación. Payloads declarados en OpenAPI, sin campos desconocidos: borrador contiene cliente, condición, notas y líneas con producto/cantidad; no recibe precio editable, descuento, fecha fiscal, impuesto, total, costo ni saldo. Dinero contiene UUID, importe y partes por medio; fecha efectiva es del servidor. Correcciones incluyen motivo y referencias; confirmaciones incluyen `expected_version`, `review_token` y `idempotency_key`.

Decimales viajan como cadenas ordinarias, sin exponente, coma, booleanos ni números binarios JSON. Hasta 200 líneas por venta o devolución, una parte por cada uno de los dos medios, notas hasta 2000 caracteres y motivos de 1…500 tras quitar espacios exteriores, en coherencia con inventario. Validar cantidad acumulada de entradas repetidas antes de efectos. Listas usan página ≥1 y tamaño 1…100 (predeterminado 20), orden estable con ID de desempate; filtros de fechas inclusivos en zona de negocio.

Errores `application/problem+json` con `X-Request-ID`: 400 campos/escala, 403 permiso, 404 recurso no visible, 409 versión/revisión/idempotencia/estado/dependencia/disponibilidad. No revelar existencia de documentos ajenos, costos ni datos de infraestructura. Mantener el comportamiento de autenticación de la API vigente en lugar de introducir otro mecanismo.

### 10. Lecturas, seguridad y frontend

Consultas de detalle y cuentas por cobrar toman un snapshot de lectura consistente para filas, recuento y totales de una respuesta, sin bloquear escrituras. Paginación ordenada por fecha e ID; no prometer una fotografía estable entre páginas cuando hay nuevas operaciones. Filtros de cliente/estado/antigüedad se aplican antes de agregados; devolver total de todas las coincidencias, no de la página. Separar `receivable_total` y `refund_due_total`; no restarlos. Antigüedad se calcula por fechas locales de confirmación y consulta, no por horas UTC ni vencimiento.

Proyecciones explícitas de lectura omiten costos para Vendedor y Encargado; la representación administrativa añade costos solo tras permiso de valoración. Recibos/replay, impresión, errores y enlaces usan la misma política. Un Administrador con rol adicional sigue sin poder mezclar RUC. La auditoría registra IDs y campos cambiados, nunca datos bancarios innecesarios ni credenciales.

Crear `frontend/src/features/sales/` con tipos, API, hooks y formularios de operaciones; `pages/sales/` para lista, editor, detalle, cuentas por cobrar y comprobante. Integrar rutas en `app/App.tsx` y permisos en `app/navigation.ts`. Reutilizar `shared/ui`, `ApiClient`, `latest-review`, TanStack Query y `DESIGN.md`: Nunito, `FiscalScopeBadge`, listas adaptables, `Field`, `InlineNotice`, `Dialog`, `Drawer` y estados accesibles. No se rediseña el kit ni se añaden dependencias.

#### Editor de ventas con vista previa en vivo

La referencia visual aportada por el usuario el 2026-09-20 define la composición del editor: dos superficies blancas amplias, alineadas arriba, sobre el fondo suave del marco existente; formulario a la izquierda y vista previa del documento a la derecha. Se toma exclusivamente la distribución de la página, no sus campos, textos, marcas, botones ni contenido económico. Conservar Nunito, tokens, radios y espaciados de `DESIGN.md`, sin reproducir el chrome de Figma ni sustituir la navegación del sistema.

En escritorio desde 1280 px, disponer dos columnas de peso comparable con separación de 30 px; el formulario ocupa aproximadamente la mitad del contenido y la vista previa la otra mitad. El panel izquierdo contiene la captura aprobada para ventas, las líneas editables y las acciones Guardar borrador/Revisar y confirmar. El derecho tiene título «Vista previa» y una representación de hoja del comprobante: cabecera, identidad fiscal, cliente, líneas y totales organizados como en el documento imprimible. Evitar convertirlo en otra tarjeta de métricas o un resumen lateral reducido: debe permitir reconocer cómo va quedando el documento completo.

```text
┌────────────────────────────┐  ┌────────────────────────────┐
│ Nueva venta / Editar venta │  │ Vista previa               │
│                            │  │ ┌────────────────────────┐ │
│ Formulario                 │  │ │ Cabecera del documento │ │
│                            │  │ │                        │ │
│ Líneas editables           │  │ │ Líneas                 │ │
│                            │  │ │                        │ │
│ Acciones de la venta       │  │ │ Totales y pie          │ │
└────────────────────────────┘  │ └────────────────────────┘ │
                                └────────────────────────────┘
```

La vista previa permanece próxima al área visible con posicionamiento sticky cuando cabe en altura; con documentos largos permite recorrer todas las líneas y páginas sin recortar contenido ni atrapar el desplazamiento. La hoja mantiene jerarquía y proporciones de impresión, con adaptación al ancho disponible y sin reducir el texto hasta hacerlo ilegible. Bajo 1280 px, apilar formulario primero y vista previa después, a ancho completo; ofrecer un enlace «Ver vista previa» y retorno al formulario, sin perder datos ni montar una segunda copia editable. No comprimir ambas columnas en móvil ni forzar desplazamiento horizontal de toda la página.

Los datos descriptivos válidos se reflejan inmediatamente desde el borrador en memoria. Cada cambio relevante de cliente/líneas/cantidades dispara, tras 300 ms sin cambios, `POST sales/draft-preview/` con la captura actual: una consulta autenticada y protegida por CSRF, sin guardar borrador, crear recibos, reservar inventario, numerar ni registrar usos fiscales. Devuelve proyección documental y cálculos del backend, con incidencias por campo para entradas incompletas. El frontend cancela solicitudes anteriores o descarta respuestas que no correspondan a la versión local actual mediante el patrón `latest-review`; nunca calcula importes definitivos con coma flotante.

Durante el cálculo se muestra «Actualizando importes»; los valores anteriores quedan identificados como pendientes de actualización. Si falta información o falla la consulta, mostrar guiones o advertencias en los bloques afectados, nunca ceros inventados ni una vista antigua presentada como vigente. La región de estado anuncia cambios de forma discreta sin mover el foco ni volver a leer toda la hoja a cada pulsación.

Mientras se edita, el documento se identifica como «Borrador · Vista previa» y «Número pendiente de confirmación»; no anticipa un secuencial ni simula autorización fiscal. La previsualización de captura no habilita confirmar por sí sola: primero guardar y obtener la revisión autorizada del borrador persistido. El comprobante confirmado usa exclusivamente snapshots históricos y el número asignado. Reutilizar una presentación `SalesDocument` para vista previa y comprobante, con proyecciones separadas para captura e historia; impresión disponible sobre el documento confirmado, sin añadir envío por correo o descarga no aprobados. Mantener siempre el aviso de documento interno no autorizado por el SRI.

Cobro y corrección de pago siguen siendo formularios contextuales; devoluciones muestran cantidades originales/devueltas, aptitud y efectos; anulación usa diálogo con consecuencias y motivo. El detalle mantiene venta, documento, pago, deuda y exceso en campos separados. Selectores recorren todas las páginas necesarias y conservan entradas tras error. La pantalla imprimible usa datos históricos y CSS de impresión, sin PDF ni motor nuevo; oculta navegación/acciones y muestra aviso SRI y estado.

Cada intención monetaria conserva UUID hasta resolución, no solo mientras dura el componente. Reutilizar tracker existente para transporte y añadir recuperación mediante identificador opaco en `sessionStorage` ligado a usuario/venta/acción, sin guardar importes, cliente, motivo ni token allí; al recargar consultar el estado del UUID antes de ofrecer otra operación. Si no hay resultado, no afirmar que el dinero no se entregó: permitir registrar/reintentar el mismo hecho y revisión. No reintentos automáticos; conservar payload en memoria ante incertidumbre, bloquear cambios accidentales y explicar cuándo se registra frente a cuándo se entrega dinero. Limpiar identificadores/cachés al cerrar sesión o invalidarla.

Mutaciones invalidan venta, listas y cuentas por cobrar; cambios físicos invalidan inventario y eliminan cortes de Kardex como compras. Una respuesta antigua no sustituye una revisión más reciente. El frontend conserva cadenas decimales y muestra cálculos del servidor; sus validaciones son ayuda, no autoridad.

### 11. Pruebas y trazabilidad

Crear durante apply `docs/negocio/requisitos/cobertura-ventas-pagos.md` con una fila por cada uno de los 105 escenarios, ruta y nombre de prueba, comando/evidencia real y estado. Los escenarios documentales no se marcan cubiertos solo por existir. La matriz se mantiene si la implementación descubre un ajuste que requiera volver a specs.

| Grupo de specs | Evidencia necesaria |
|---|---|
| Ventas: acceso, borradores y precios | Permisos por los tres roles y combinaciones; inactivos; campos inesperados; precio/descuento manipulados; versión obsoleta; borrador sin número/deuda/reserva; kit intacto. |
| Ventas: cálculo y confirmación | Unitarias de ejemplos, cero y desbordamiento; revisión obsoleta; cruce de medianoche; configuración faltante; rollback inyectado en cada efecto; historia tras cambiar maestros. |
| Ventas: numeración e inventario | PostgreSQL concurrente para último producto, varias líneas en orden inverso, venta versus compra/ajuste y sucesión de serie; resultado exacto de números, movimientos, usos y recibos. |
| Pagos: condición, medios y saldo | Contado completo/interrumpido, crédito parcial, E/P/R, cero, exceso, datos falsos, entidades ajenas, partes y precisión, dos ventas sin compensación. |
| Pagos: correcciones y concurrencia | Sustitución atómica, reembolsos dependientes, claves iguales/diferentes, UUID estable, dos cobros por último saldo, cobro contra devolución/anulación. |
| Correcciones: anulación y devolución | Último movimiento, historial intermedio aunque compensado, devoluciones previas, inspección mixta, productos inactivos, devolución con compra posterior y asignaciones con residuos. |
| Correcciones: reembolso y auditoría | Doble desembolso registrado, exceso insuficiente, fallo tras dinero real, nuevo intento compatible, historia protegida mediante ORM y SQL, proyección sin costos. |
| API y frontend | Contrato OpenAPI, filtros/totales con varias páginas, sesión/CSRF, estados vacíos/error/carga, teclados/foco, timeout/recarga, caché al logout, impresión y rutas autorizadas. Editor en dos columnas a 1280/1440 px y apilado a 360/768/1024 px; vista previa reactiva sin persistencia ni numeración, respuestas fuera de orden, importes pendientes/inválidos, documento largo y correspondencia entre hoja e impresión. |

Pruebas de dominio en `backend/tests/sales/`, integración y concurrencia PostgreSQL con conexiones independientes, barreras con timeout antes del recurso competido y cierre de conexiones. Afirmar número de éxitos/conflictos, finalización de workers y estado completo; no pruebas que solo comprueben ausencia de excepción. Adaptar pruebas de frontera inspiradas en `tests/purchasing/test_boundaries.py` para prohibir imports de persistencia ajena y dependencias desde dominio hacia framework. Agregar regresión a inventario/configuración sin duplicar sus suites completas.

Durante implementación: TDD por comportamiento; después `make check`, `make test`, `make audit`, validación OpenSpec, generación/comparación de OpenAPI y reconciliaciones. Backend siempre `uv run`; frontend npm. Ejecutar recorridos E2E de Playwright y axe con API real en 360/768/1024/1440 px, sin marcar aprobación visual automática. En esta fase documental no se ejecutan ni se afirman pruebas de software, cobertura, build o migraciones.

## Risks / Trade-offs

- [Dinero físico fuera de la transacción] → El sistema registra hechos, no mueve efectivo ni invoca bancos. UUID estable, consulta de resultado y mensajes de reintento evitan pedir un segundo desembolso; no se promete rollback físico.
- [Reembolso y corrección de pago incompatibles] → Recalcular bajo la misma venta y bloquear cambios que dejen sin respaldo el desembolso; conservar la dependencia visible.
- [Contención] → Bloqueo por venta/productos, secciones cortas, límite de líneas y orden común con compras; configuración puede serializar parcialmente el ámbito comercial conforme al contrato existente.
- [Valor devuelto erróneo por promedio redondeado] → Guardar valor aplicado por línea y asignación acumulada a tramos aptos/no aptos; reconciliación y pruebas adversariales de residuos.
- [Nuevo origen interpretado como ajuste manual] → Revisar operaciones, filtros, enlaces, triggers, reconciliación y autorización por origen; probar acceso cruzado explícitamente.
- [Artefactos de inventario aún activos] → No duplicar sus deltas en specs principales ni archivar otros cambios. Verificar integración del contrato dependiente antes de apply.
- [Límite conservador de anulación] → Mostrar dependencia y diferenciar devolución física; nunca inventar un retorno para corregir solo datos.

## Migration Plan

1. Antes de apply, aprobar diseño y ADR propuesto y registrarlos en `master` con autorización Git explícita; verificar dependencias y tareas aprobadas. No inferir ese permiso de la autorización para redactar en `develop`.
2. Migraciones aditivas para `sales`, claves/índices/protección histórica y nuevos tipos/checks de inventario. No crear tablas genéricas para servicios ni migrar datos Flutter. No tocar saldos previos ni renumerar documentos existentes. Mantener triggers antiguos y extender únicamente los casos permitidos.
3. Crear índices para venta por cliente/fecha/ID y estado/fecha/ID, pagos/devoluciones/reembolsos por venta/fecha/ID, y UUID/número únicos. Añadir el módulo a settings y rutas solo junto a los contratos y controles probados.
4. Antes de desplegar: respaldo verificable y ensayo de migración con datos de compras/inventario existentes; comparar reconciliación antes/después y confirmar que no se crearon movimientos comerciales ficticios. Ejecutar `make migrate` por el procedimiento local autorizado y reconciliaciones de solo lectura. Los comandos concretos de fixtures/entorno se fijan en tasks tras aprobación.
5. Reversión: antes del primer uso, retirar rutas y revertir migraciones solo si las tablas nuevas están vacías y no hay tipos comerciales usados. Después de registrar ventas, no revertir destructivamente migraciones ni borrar hechos: detener nuevas escrituras comerciales, conservar esquema/historia, corregir hacia adelante o restaurar un respaldo completo mediante procedimiento autorizado y conciliación de dinero recibido desde ese respaldo. Una versión anterior de inventario no debe operar sobre tipos que desconoce.

## Open Questions

No quedan decisiones de negocio bloqueantes para este diseño: las cuatro recomendaciones y las specs fueron aprobadas. DM-001 sigue abierto para una abstracción común futura; este diseño no lo resuelve para el RUC artesanal. Las tarifas reales y clasificación tributaria se configuran y validan antes de operación real, sin inferirlas de los ejemplos de prueba.

El ADR-0006 sigue **propuesto**: su aceptación se registra durante apply, conforme a la tarea correspondiente. La fecha de aprobación de estas specs se registra en sus encabezados; esta constancia no autoriza commits. El diseño y el ADR fueron aprobados y están registrados en `master`, de modo que las tareas ya pueden redactarse; aplicar el cambio requiere una aprobación posterior y explícita de esas tareas, conforme a `openspec/config.yaml` y AGENTS.

## Fuentes consultadas

Decisiones confirmadas y modelo de dominio completos; propuesta y las tres specs con sus referencias; specs principales de dominio, configuración y autorización; producto (visión, alcance, reglas y glosario); requisitos de roles, ventas/pagos/correcciones, casos CU-012…015, interfaz y RNF-INT; arquitectura inicial y C4 de contenedores; ADR-0001/0003/0004/0005; diseño y contrato de existencias del cambio de compras/inventario como dependencia; `DESIGN.md` y Makefile.

Inspección técnica: modelos, posting, consultas, valoración y reconciliación de inventario; comandos/confirmación de compras; referencias de catálogo y clientes; resolvedor/contexto/numeración de configuración; rutas de composición; fronteras probadas de compras; cliente HTTP, idempotencia, revisión, hooks de compras, navegación y router del frontend. Algunas rutas exploratorias (`document_numbers.py`, `inventory/domain/types.py`, `inventory/application/receipts.py`) no existen; no se proponen como dependencias reales. Los nombres nuevos de este documento están identificados como propuestos.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
