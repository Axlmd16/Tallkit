# Integración de mantenimiento, repuestos, ventas y cobros por RUC

Estado: **borrador pendiente de aprobación**. Fecha: 2026-09-24, America/Guayaquil. Rama `develop`, árbol limpio al iniciar (HEAD `6c9c0f4`). Esta propuesta no aprueba specs, diseño, tareas ni implementación y no autoriza operaciones Git.

## Why

Tallkit registra órdenes de mantenimiento con servicios, y vende y cobra repuestos del RUC comercial, pero ambos mundos siguen desconectados. El taller no puede registrar los repuestos que usa en una orden, documentar ni cobrar los servicios del RUC artesanal, ni ver en un solo lugar lo que se debe por cada RUC sin mezclarlo. Esta octava entrega completa RN-TAL-011…014/020, RF-TAL-007…013, RF-VEN-002/016 y RF-PAG-010, que las entregas 6 y 7 dejaron como puntos de extensión.

## What Changes

- **Repuestos en la orden mediante la venta vinculada** (DP-012/021, RN-FIS-007, CU-018). Mientras la orden esté abierta, el Encargado del taller o el Administrador buscan productos activos y vendibles por código o nombre y agregan, modifican o retiran líneas de la **única venta comercial abierta vinculada** a la orden. La venta se crea en la primera línea y se reutiliza después. Esas líneas son la única fuente de verdad: la orden no mantiene otra copia editable. Agregar reserva disponibilidad sin descontar existencia ni generar Kardex ni deuda; retirar libera la reserva. Se muestran existencia, reserva y disponibilidad solo como ayuda.
- **Confirmación de la venta vinculada** por el Vendedor o el Administrador con el mecanismo existente de ventas (CU-012, DP-025…027). En una sola acción atómica se asignan COM-VEN, se consume la reserva, se generan las salidas de Kardex y nace el importe exigible. No se crea un segundo mecanismo de venta. Después de confirmar, un repuesto adicional abre otra venta vinculada: solo una puede estar abierta y pueden coexistir varias confirmadas.
- **Protección de la venta vinculada frente a los endpoints ordinarios.** Cliente, emisor y origen son los de la orden y no se editan en la venta. Las líneas del borrador vinculado solo se modifican desde la orden. Las ventas confirmadas siguen siendo inmutables. Los listados identifican el origen mantenimiento y se navega en ambos sentidos (orden ↔ venta ↔ movimientos) según permisos.
- **La disponibilidad pasa a ser obligatoria en todas las salidas.** La venta directa, los ajustes y cualquier otra salida existente validan disponibilidad (existencia − reservas vigentes), no solo existencia. Así dos órdenes, o una orden y una venta directa, no pueden consumir las mismas últimas unidades.
- **Operación artesanal de servicios** (RF-TAL-007/008, UI-077). Es un documento separado del RUC artesanal, con serie ART-SER. Documenta líneas de servicio concretas de la orden con su precio aplicado, cantidad, descripción y tratamiento tributario artesanal congelados. Cada línea se documenta una sola vez y el documento produce su comprobante interno, que no es una factura del SRI. Nunca produce movimientos de inventario.
- **Pagos artesanales y crédito simple** (RF-TAL-009, RF-PAG-001…012). Los cobros en efectivo, transferencia o ambos se registran contra un solo documento artesanal. Se deriva saldo y estado pendiente/parcial/pagado, el Administrador corrige pagos con motivo y existen cuentas por cobrar artesanales separadas de las comerciales. No es posible pagar una deuda con el importe de otro RUC ni registrar un pago global de la orden.
- **Resumen económico de la orden** (RF-TAL-012, UI-075). Muestra dos bloques separados, repuestos (RUC comercial) y servicios (RUC artesanal). Cada documento aparece con su número, estado, total, pagado y saldo, y se distingue lo pendiente de documentar de lo ya confirmado. El total combinado es solo informativo y no se presenta como deuda ni factura.
- **Finalización y reapertura.** No se puede finalizar mientras la venta abierta tenga líneas (DP-021); se indica qué falta y finalizar nunca confirma ni cobra. Reabrir no anula, no repone stock, no revierte pagos y no desbloquea documentos.
- **Correcciones.** Se reutilizan la anulación y la corrección de pagos existentes. Se bloquean las acciones que simularían devoluciones, reembolsos o reposiciones de repuestos ya instalados.

### Decisiones confirmadas que se conservan

CT-001; DP-001/002/003/004/006/007/012/013/015/017/018/020/021/025/026/027/028; RN-FIS-001…010; RN-TAL-005…021; RN-VEN-001…018; invariantes 1, 2, 6…11, 14…17, 20, 24 y 25 del modelo de dominio. En particular:

- La reserva de la venta abierta de un mantenimiento **sí** es un requisito explícito (DP-012). No es una reserva de proforma ni de venta directa.
- Los repuestos salen **una sola vez**: por la venta vinculada confirmada. No existe una salida separada por «consumo de mantenimiento».
- El precio de los repuestos es el del catálogo, sin edición (DP-026). El precio aplicado editable es exclusivo de los servicios (DP-020) y no se convierte en descuento.
- Los servicios correctivos son sin cargo (DP-015, RN-TAL-019) y no generan documento ni deuda.

### Permisos existentes que se reutilizan

La matriz de `actores-y-roles.md` §3.4/§3.5 ya contiene todos los permisos necesarios, y el catálogo de `identity` ya los define. No se crean roles ni permisos nuevos.

| Acción | Permiso | Admin | Encargado | Vendedor |
|---|---|---|---|---|
| Agregar, modificar o retirar repuestos pendientes | `mantenimientos.gestionar_repuestos` + `ventas.preparar_vinculada` | Sí | Sí | No |
| Ajustar el precio aplicado de servicios | `mantenimientos.cambiar_precio_servicio` | Sí | Sí | No |
| Confirmar la venta vinculada (salida de stock) y elegir contado o crédito | `ventas.confirmar` | Sí | **No** | Sí |
| Cobrar repuestos | pagos comerciales existentes | Sí | No | Sí |
| Confirmar la operación de servicios y su condición | `servicios_economicos.confirmar` | Sí | Sí | No |
| Cobrar servicios | `pagos_artesanales.registrar` | Sí | Sí | No |
| Consultar deudas | `pagos_artesanales.ver` / pagos comerciales `ver` | Sí | Solo artesanales | Solo comerciales |
| Finalizar y reabrir | `mantenimientos.finalizar` / `.reabrir` | Sí | Sí | No |
| Anular documentos o corregir pagos | `ventas.anular`, `servicios_economicos.anular`, `pagos_artesanales.anular` | Sí | No | No |
| Consultar costos y valoración | `productos.ver_costos`, `inventario.ver_valorizacion` | Sí | No | No |

El Encargado **no** obtiene `ventas.confirmar`. El uso real de un repuesto queda registrado desde que se agrega, porque reserva la unidad física y nadie más puede venderla. La salida contable ocurre cuando el Vendedor o el Administrador confirma, y la orden no puede finalizar antes. Esto aplica literalmente CU-018 y DP-021 sin ampliar atribuciones financieras. `mantenimientos.ver` y `ventas.ver` se conceden solo en su forma restringida: el Vendedor ve el origen de una venta vinculada y el Encargado ve las ventas vinculadas a sus órdenes.

## Decisiones pendientes para aprobar la propuesta

Estas recomendaciones no son requisitos aprobados. Cada una indica qué cambia si se elige la alternativa.

| ID | Información insuficiente o discrepancia | Recomendación | Alternativa e impacto |
|---|---|---|---|
| P0 | **Proceso.** Las specs de ventas, pagos, correcciones, existencias, catálogo y clientes solo existen como deltas de cuatro cambios activos sin archivar: compras 202/202, ventas 268/268, catálogo 70/71 y clientes 47/49. Este cambio debe **modificar** `ventas-comerciales`, `existencias-y-ajustes-de-inventario` y `correcciones-de-ventas-y-reembolsos`, que todavía no existen en `openspec/specs/`. | Antes de redactar specs, cerrar la verificación pendiente y archivar (sincronizar) esos cuatro cambios en `master`, mediante sus propios flujos y con tu autorización. Así este cambio escribe deltas `MODIFIED` sobre specs principales reales. | Encapsular todo en capacidades nuevas, sin tocar las anteriores. Repetiría reglas de ventas e inventario en otra spec y dejaría contradicciones al sincronizar. No se recomienda. |
| P1 | **DM-001 abierta:** ¿estructura común o separada para los documentos económicos? `Sale` está acoplada a productos, bodega, Kardex y costo, y ADR-0006 descartó un motor genérico. | **Estructura separada** para la operación artesanal dentro del contexto Taller. Reutiliza sin duplicar las reglas puras de importes, saldos y validación de cobros, la numeración ART-SER de configuración y los patrones de idempotencia. Ventas solo gana el vínculo de origen y el bloqueo de la venta vinculada; las ventas directas no cambian. DM-001 se cierra así para V1 mediante un ADR. | Una estructura común de documentos para ambos RUC exigiría rehacer ventas, pagos y correcciones ya verificados: más riesgo y más alcance. |
| P2 | **Crédito en servicios.** DP-003 y DP-027 definen crédito, contado y cobro solo para ventas comerciales. RF-PAG-001/002/009 y RF-REP-006 (parte artesanal) presuponen condición y cuentas por cobrar artesanales, sin concretarlas. | Extender la política de DP-027 a la operación artesanal. La condición contado o crédito se elige al confirmar, a cargo de Administrador o Encargado (`servicios_economicos.confirmar`). Contado pide después un cobro completo; si se interrumpe, queda confirmada y pendiente, sin convertirse en crédito. Crédito admite abonos sin vencimiento, cuotas ni intereses. La fecha es la del sistema y no hay captura retroactiva. Todo cliente ya tiene identificación obligatoria (DP-008), así que no hace falta un requisito adicional. | Solo contado para servicios: más simple, pero obliga a cobrar completo y deja inservible RF-PAG-009 artesanal. Crédito solo para Administrador: restringe una atribución que la matriz ya concede al Encargado. |
| P3 | **Importes e impuestos de servicios.** DP-025 fija la política de redondeo solo para ventas comerciales. La línea de servicio ya conserva una definición tributaria artesanal, pero la orden no calcula base ni impuesto. | Aplicar a los servicios la misma política de DP-025 con la definición tributaria artesanal de cada línea, resuelta en la fecha efectiva de confirmación: precio final con impuesto incluido, base a centavos HALF_UP, impuesto por diferencia y documento como suma de líneas redondeadas. Una definición sin vigencia es un error, nunca una exención; una tarifa cero debe estar configurada. Si la configuración cambia entre la revisión y la confirmación, se exige una nueva revisión. | Otra política de redondeo para el RUC artesanal: requiere validación contable previa. No se inventa. |
| P4 | **Alcance y momento del documento de servicios.** RF-TAL-008 lo declara independiente del estado; CU-017 8a permite continuar sin confirmarlo. No se define si finalizar exige documentarlo ni cómo tratar los servicios añadidos después. | La operación artesanal se confirma por acción explícita en cualquier estado (registrado, finalizado o reabierto). Toma **todas las líneas de la intervención inicial todavía no documentadas**, y cada línea se documenta una sola vez. Las líneas documentadas quedan bloqueadas; las que se agreguen después, con la orden aún registrada, van a un documento adicional. Se exige total mayor que cero: no hay documentos vacíos ni solo de líneas a USD 0,00, que se incluyen cuando acompañan a otras. Las líneas correctivas nunca se documentan. **Finalizar no exige** documentar servicios; el resumen muestra «pendiente de documentar». Las órdenes anteriores a esta entrega no se documentan por migración: solo mediante la misma acción explícita, con aviso de verificar que no se cobraron fuera del sistema. | Exigir el documento de servicios para finalizar: garantiza el cobro, pero contradice CU-017 8a e impide cerrar operativamente un trabajo mientras se acuerda el cobro. |
| P5 | **Anulaciones de documentos vinculados.** La anulación de ventas (DP-028) restituye inventario, algo ficticio si el repuesto ya está instalado en el vehículo. La anulación artesanal existe en la matriz, pero no tiene reglas. | **Bloquear la anulación de una venta vinculada confirmada** con una explicación; una futura devolución o nota de crédito lo resolverá fuera de esta entrega. Las devoluciones físicas del módulo de ventas siguen disponibles sin cambios, porque ya exigen inspección real, pero no se ofrecen desde la orden. La **operación artesanal** la anula solo el Administrador, con motivo, y **sin pagos efectivos vigentes**: primero se anulan los pagos con el procedimiento trazable. La anulación conserva el número y los vínculos, y libera sus líneas para volver a documentarlas solo mediante una acción explícita que registra la cadena de reemplazo. | Permitir la anulación de ventas vinculadas con restitución: crearía existencias ficticias. Anular documentos con pagos y reembolso automático: implicaría reembolsos, que están fuera de alcance. |
| P6 | **Reapertura y repuestos.** DP-015 y RN-TAL-019 establecen que el trabajo correctivo no se cobra. La reposición sin cargo (CU-024) no está implementada y depende de una validación contable pendiente. | Con la orden **reabierta** no se pueden agregar repuestos cobrables ni abrir ventas vinculadas. Se explica que la reposición por corrección es una operación futura del Administrador. Los documentos y pagos anteriores conservan sus efectos, y las líneas iniciales todavía no documentadas se pueden documentar (P4). | Permitir ventas cobrables durante una reapertura: contradice DP-015. Implementar CU-024 ahora: amplía el alcance hacia inventario con una validación fiscal pendiente. |
| P7 | **Cambio de cliente o vehículo** con documentos. La orden registrada permite hoy cambiar el vehículo dentro del mismo cliente; la venta vinculada toma el cliente de la orden. | Bloquear el cambio de cliente o vehículo en cuanto exista una venta vinculada con líneas o confirmada, o una operación artesanal confirmada no anulada. El resto de la información editable sigue editable. Los documentos conservan sus datos históricos de cliente, vehículo y emisor. | Permitir el cambio propagándolo al borrador: posible solo sin documentos confirmados; añade reglas sin necesidad demostrada. |

## Fuera de alcance

Facturación electrónica y SRI; devoluciones, reembolsos y notas de crédito nuevas; anulación de ventas vinculadas (P5); reposición por corrección (CU-024) y consumo interno; cancelación de mantenimientos (RN-TAL-005, RF-TAL-014, que siguen aplazados); proformas; multibodega, traslados, despachos o entregas parciales; presupuestos y aprobación del cliente; mecánicos, tiempos y comisiones; descuentos, promociones y paquetes; garantías; anticipos, saldos a favor, monederos y compensación entre RUC; cuotas, intereses y vencimientos; pagos a proveedores; caja, cierres diarios (DP-019) y arqueo; conciliación y pasarelas; contabilidad; reportes avanzados, exportaciones y respaldos. No se generan ventas, deudas, cobros ni movimientos mediante migraciones.

## Capabilities

### New Capabilities

- `repuestos-del-mantenimiento`: selección de productos, venta abierta vinculada única, reservas, edición de líneas pendientes, traspaso a confirmación comercial, trazabilidad orden ↔ venta ↔ movimientos y restricciones durante la reapertura.
- `operacion-artesanal-de-servicios`: documento ART-SER por líneas de servicio, importes e impuestos históricos, condición, confirmación idempotente, anulación, cadena de reemplazo y comprobante interno.
- `pagos-artesanales-y-credito-simple`: cobros, correcciones, saldos derivados y cuentas por cobrar del RUC artesanal, separados de los comerciales.
- `resumen-economico-del-mantenimiento`: vista separada por RUC y documento, pendientes frente a confirmados y total combinado informativo.

### Modified Capabilities

- `ordenes-de-mantenimiento`: finalización condicionada por la venta abierta, acciones visibles, bloqueo de cliente y vehículo con documentos, aviso de efectos al reabrir, acceso restringido del Vendedor. Sustituye el requisito «Ausencia de efectos económicos e inventario».
- `servicios-aplicados-al-mantenimiento`: bloqueo de líneas documentadas, estado documentado o pendiente, y presentación del total frente al documento artesanal.
- `ventas-comerciales` *(depende de P0)*: origen mantenimiento, venta vinculada protegida, filtros y navegación, validación de disponibilidad al confirmar.
- `existencias-y-ajustes-de-inventario` *(depende de P0)*: reservas vigentes, disponibilidad no negativa en toda salida y consulta de reservas.
- `correcciones-de-ventas-y-reembolsos` *(depende de P0)*: anulación bloqueada para ventas vinculadas.
- `pagos-comerciales-y-credito-simple` *(depende de P0)*: identificación del origen en cuentas por cobrar comerciales.

## Impact

### Reutilización, modificación y riesgos

- **Se reutiliza** sin reescribir: `sales` (borrador, confirmación, pagos, ledger y reglas puras de saldos), `inventory` (publicación de salidas según ADR-0005, que se amplía con reservas), `workshop_configuration` (serie ART-SER del tipo `SERVICIO`, definiciones tributarias artesanales, contexto de entidad), `identity` (permisos ya catalogados y auditoría), `workshop` (orden, líneas, comprobaciones de finalización en `workshop/domain/finalization.py`, comandos idempotentes) y los componentes Tallkit.
- **Se modifica** lo siguiente: ventas añade vínculo de origen, bloqueo de la vinculada y validación de disponibilidad; inventario añade reservas; taller añade la sección de repuestos, la operación artesanal y sus pagos; la API `/api/v1/` y OpenAPI; las pantallas UI-074/075/076/077 y las cuentas por cobrar artesanales. Tablas, índices y migraciones se deciden en el diseño y serán aditivas, sin tocar datos existentes.
- **Principales riesgos:** doble salida o documentación de una misma línea; carreras entre dos órdenes por las últimas unidades; carrera entre finalizar y agregar repuestos; sobrepago concurrente; mezcla de RUC en cobros; regresiones en ventas directas por la nueva regla de disponibilidad. Las specs cubrirán atomicidad, reintentos y concurrencia sobre PostgreSQL. Se creará o actualizará un ADR para P1 y otro para la coordinación reserva → confirmación → Kardex, candidata según el modelo de dominio §6.

### Contradicciones registradas

- La instrucción de no implementar reservas salvo que sean requisito explícito queda resuelta: DP-012 lo es.
- El texto de «estado actual» en `decisiones-confirmadas.yaml`, `openspec/config.yaml` y el modelo de dominio sigue diciendo que el dominio no está implementado. El código demuestra lo contrario, pero no se modifica aquí.
- La spec de servicios prohíbe hoy mostrar desglose tributario y saldo en la orden. Se sustituye mediante el delta de `servicios-aplicados-al-mantenimiento`, sin cambiar reglas confirmadas.

## Fuentes consultadas

- `AGENTS.md`, `openspec/config.yaml`, CLI `openspec new change`, `status`, `instructions`.
- Leídos completos: `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`.
- Specs principales `ordenes-de-mantenimiento` y `servicios-aplicados-al-mantenimiento`. Deltas activos de `ventas-comerciales`, `pagos-comerciales-y-credito-simple` y `existencias-y-ajustes-de-inventario`. Propuesta y cobertura archivadas de `gestionar-ordenes-mantenimiento`; propuesta de `gestionar-ventas-pagos-credito-simple`; ADR-0006.
- `reglas-negocio.md` (RN-FIS, RN-VEN, RN-TAL, RN-CON), `requisitos-funcionales.md` (RF-VEN, RF-PAG, RF-TAL), `casos-de-uso.md` (CU-017…019), `actores-y-roles.md` §3.4/§3.5, `interfaz-y-navegacion.md` (UI-074…078), `cobertura-mantenimientos.md`.
- Código inspeccionado: `backend/src/sales/models.py`, `sales/application/payments.py`, `ledger.py`, `sales/domain/balances.py`; `inventory/models.py` (sin reservas; `InventoryOperation` con `source_type` y `source_id` únicos); `workshop/models.py`, `workshop/application/transitions.py`; `workshop_configuration/domain/validation.py` (`DocumentType.SERVICIO`); `identity/domain/authorization.py`.
- No se usaron documentos históricos ni la aplicación Flutter. Todavía no se inspeccionaron en detalle el frontend ni los servicios de publicación de inventario; se hará en el diseño.

## Límite de aprobación

Solicito que apruebes o corrijas P0…P7 y el alcance. Después, y con autorización explícita para Git, el artefacto aprobado debe registrarse en `master` antes de redactar specs. No se ha creado código, migración, commit ni rama.

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
