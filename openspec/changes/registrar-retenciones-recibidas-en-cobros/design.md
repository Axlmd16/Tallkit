## Context

Los cobros de los dos RUC tienen estructuras separadas (DP-029, ADR-0008) y reglas monetarias compartidas:

- **Comercial** (`backend/src/sales`): `CommercialPayment` con `PaymentPart` por medio, `PaymentCorrection` para anular o sustituir, y `CommercialRefund`. `sales/application/ledger.py` arma el `Ledger` de una venta (exigible, devuelto, pagado, reembolsado) y llama a `compute_balance`. `sales/application/payments.py` registra el cobro bajo `lock_sale`, con `operation_id` como identidad idempotente, revisión firmada (`reviews`) y `execute_write` para permiso, auditoría y recibo de comando.
- **Artesanal** (`backend/src/workshop`): `ArtisanPayment`, `ArtisanPaymentPart` y `ArtisanPaymentCorrection`; `workshop/application/artisan_payments.py` y `service_operations.py` (`paid_total`, saldo y la regla que impide anular con pagos vigentes).
- **Núcleo compartido** (`backend/src/shared/money.py`): `compute_balance(exigible, paid, refunded)` devuelve `BalanceResult(exigible, applied, balance, excess, state)` y `validate_charge(condition, balance, amount)` exige importe positivo, no superar el saldo y, en contado, liquidarlo completo.
- **Clientes** (`backend/src/customer_registry`): `Customer` con `version` y edición por los tres roles.
- **Configuración** (`backend/src/workshop_configuration`): el perfil tributario vive en revisiones inmutables (`ElectronicProfileRevision`) cuyo contenido determina el estado del perfil y se congela en la instantánea fiscal; los valores operativos por entidad viven aparte en `FiscalPreparationDefaults`, con `version`.
- **Permisos** (`identity/domain/authorization.py`): `pagos_comerciales.{ver,registrar,anular}` y `pagos_artesanales.{ver,registrar,anular}`, ya repartidos como exige la spec (registrar: Administrador y Vendedor o Encargado; anular: solo Administrador).

Restricciones: monolito modular sin escrituras directas entre módulos, dominio sin DRF, `Decimal`, TDD, sesiones y CSRF vigentes (ADR-0003), sin dependencias nuevas. El comportamiento no puede depender del régimen, la tarifa ni las condiciones tributarias de la entidad (principio 19 de la propuesta).

## Goals / Non-Goals

**Goals:**

- Registrar la retención recibida como hecho propio que reduce el saldo sin contarse como dinero.
- Permitir cobro y retención en una sola acción atómica, con la misma protección de concurrencia e idempotencia de los cobros.
- Mantener el cobro en lenguaje llano y llevar los datos del comprobante a una pantalla de seguimiento.
- Dejar activación y umbral de advertencia como ajustes por entidad dentro del perfil tributario.
- No reescribir pagos, saldos históricos, revisiones de perfil ni instantáneas.

**Non-Goals:**

- Calcular o validar porcentajes de retención; emitir comprobantes de retención propios.
- Importar XML de retenciones; cierres de caja y reportes.
- Cambiar medios de pago, la preparación fiscal o su instantánea.
- Rediseñar el flujo completo de venta (cambio posterior).

## Decisions

### 1. Tablas propias por ámbito, no un medio de pago

Se añaden `sales.CommercialWithholding` y `workshop.ArtisanWithholding`, con la misma forma:

| Campo | Contenido |
|---|---|
| `operation_id` | UUID único; identidad estable ante reintentos |
| `sale` / `service_operation` | Operación a la que pertenece (PROTECT) |
| `amount` | `Decimal(24, 2)`, restricción `> 0` |
| `effective_at`, `effective_date` | Momento y fecha de America/Guayaquil asignados por el sistema |
| `payment` | Pago registrado en la misma acción, opcional; solo informativo |
| `voucher_number` | `NNN-NNN-NNNNNNNNN`, nulo mientras esté pendiente |
| `voucher_date` | Fecha de emisión del comprobante, nula mientras esté pendiente |
| `income_tax_amount`, `vat_amount` | Desglose opcional; ambos nulos o ambos informados |
| `customer_identification` | Identificación del cliente al registrar, para la unicidad del comprobante |
| `voided_at`, `voided_by`, `void_reason` | Anulación administrativa; nulos mientras esté vigente |
| `created_by`, `created_at` | Autor y registro |

Restricciones de base de datos: importe positivo; desglose coherente (`income_tax_amount + vat_amount = amount` cuando se informa); número y fecha juntos; unicidad parcial de `(fiscal_entity, customer_identification, voucher_number)` para filas vigentes con número. En `sales` la entidad es siempre la comercial y en `workshop` la artesanal, de modo que la unicidad por tabla equivale a la unicidad por entidad.

Las correcciones del comprobante ya completado se conservan en `CommercialWithholdingVoucherChange` / `ArtisanWithholdingVoucherChange` (valores anteriores, motivo, autor, fecha). La anulación se guarda en la propia fila porque es terminal y única, a diferencia de la sustitución de un pago.

*Alternativa descartada:* añadir `RETENCION` a `PaymentMethodChoice`. Contradice D1 y DP-003, obligaría a excluirla en cada suma de dinero presente y futura, y no admite datos de comprobante.

*Alternativa descartada:* una tabla común en `shared`. DM-001 quedó cerrada con estructuras separadas por RUC (DP-029); una tabla común cruzaría la frontera de dos módulos.

### 2. Saldo con un tercer término en el núcleo compartido

`compute_balance` recibe un argumento nuevo con valor por defecto, para no romper a quienes no lo usan:

```
compute_balance(exigible, paid, refunded, withheld=ZERO) -> BalanceResult
```

- `money = paid − refunded` (dinero neto cobrado).
- `applied = money + withheld`.
- `balance = max(exigible − applied, 0)`.
- `total_excess = max(applied − exigible, 0)`.
- `excess = min(total_excess, max(money, 0))` — lo único reembolsable.
- `withheld_excess = total_excess − excess`.
- Estado: `PAID` si `balance == 0`; `PARTIAL` si `applied > 0`; si no, `PENDING`.

`BalanceResult` gana `withheld` y `withheld_excess`. Con `withheld = 0` todos los resultados son idénticos a los actuales, lo que protege las pruebas existentes. `Ledger` (ventas) y el cálculo de saldo de `service_operations.py` suman las retenciones vigentes (`voided_at IS NULL`) y las pasan al núcleo.

El reembolso (`sales/application/refunds.py`) sigue validando contra `ledger.balance.excess`, que ya queda limitado al dinero cobrado: no requiere otra regla.

### 3. Cobro con retención en el mismo comando

Los comandos de cobro existentes (`register_payment` y su revisión previa en ventas; `register_payment` en taller) aceptan un campo opcional `withholding`:

```
{ "operation_id": "…", "parts": [...], "withholding": { "amount": "5.00", "acknowledged": false } }
```

- `parts` pasa a ser opcional cuando hay `withholding`; debe existir al menos uno de los dos.
- La validación compartida se amplía en `shared/money.py` con `validate_settlement(condition, balance, money, withheld)`: cada importe informado es positivo, `money + withheld ≤ balance` y, en contado, `money + withheld == balance`. `validate_charge` se conserva y delega en ella.
- Dentro de la misma transacción y bajo el mismo bloqueo de la operación (`lock_sale` o su equivalente artesanal) se insertan el pago, si hay dinero, y la retención, y se incrementa `version` una vez. Un fallo revierte ambos.
- **Idempotencia:** el `operation_id` identifica la acción completa. El pago, si existe, y la retención comparten ese valor en sus tablas (cada una lo tiene único). Un reintento compara dinero y retención con lo guardado: igual → devuelve el resultado; distinto → `idempotency_conflict`.
- **Revisión firmada (ventas):** el `digest` incluye el importe retenido y `ledger.withheld`, de modo que una retención o un cobro concurrente invalida la revisión, como hoy ocurre con los pagos.
- **Retención sola:** el mismo comando sin `parts`. No se crea un comando distinto, para que haya un único camino protegido hacia el saldo.

*Alternativa descartada:* un comando separado de retención llamado después del cobro. Permitiría dejar un contado con dinero insuficiente entre las dos llamadas y duplicaría bloqueo, revisión e idempotencia.

### 4. Activación y advertencia

Antes de insertar, el comando consulta los ajustes de la entidad mediante un servicio de lectura de `workshop_configuration` (decisión 6):

- Registro desactivado → `validation_error` en `withholding` («Esta entidad no registra retenciones»).
- Advertencia: si `(retenciones vigentes + nueva) > exigible × porcentaje / 100` y `acknowledged` no es verdadero, se responde con un rechazo recuperable `withholding_warning` que incluye el porcentaje y el importe umbral, sin registrar. Con `acknowledged: true` se registra. La comparación usa `Decimal` sin redondear el umbral.

En ventas, la revisión previa devuelve la advertencia entre sus `issues` con un indicador de que es reconocible, para que la interfaz pida la confirmación antes de registrar.

### 5. Completar, corregir, anular y listar

Operaciones nuevas por ámbito, cada una con `execute_write`, permiso, auditoría y `operation_id` propio:

| Acción | Permiso comercial / artesanal | Regla |
|---|---|---|
| Completar comprobante | `pagos_*.registrar` | Solo si está vigente y pendiente; valida formato, fecha no futura y desglose |
| Corregir comprobante completado | `pagos_*.anular` | Motivo obligatorio; guarda el valor anterior en la tabla de cambios |
| Anular retención | `pagos_*.anular` | Motivo obligatorio; terminal; libera el número |
| Listar pendientes | `pagos_*.ver` | Vigentes sin número, paginación estable por `(effective_at, id)`, total del conjunto |

Se reutilizan los permisos existentes: coinciden exactamente con el reparto que pide la spec y evitan una migración de permisos.

Formato y coherencia del comprobante son reglas puras en `shared/withholding.py` (`parse_voucher_number`, `validate_breakdown`), usadas por ambos módulos.

**Bloqueo de anulaciones.** `sales/application/voids.py` y la anulación de la operación artesanal (`service_operations.py`, junto a la regla de pagos vigentes) rechazan con `invalid_state` cuando hay retenciones vigentes, nombrándolas.

### 6. Ajustes en el perfil tributario sin tocar las revisiones

Se añade `workshop_configuration.ReceivedWithholdingSetting`, uno por entidad:

| Campo | Contenido |
|---|---|
| `fiscal_entity` | Uno a uno |
| `registration_enabled` | Booleano, por defecto verdadero |
| `warning_percentage` | `Decimal(5, 2)`, nulo = advertencia desactivada; restricción `> 0` y `≤ 100`; por defecto `20.00` |
| `version`, `updated_by`, `updated_at` | Concurrencia optimista y autoría |

La ausencia de fila equivale a los valores por defecto; no hace falta migración de datos. Un comando administrativo con permiso `entidades_fiscales.editar`, idempotencia y auditoría los modifica.

No se guardan dentro de `ElectronicProfileRevision.conditions` porque esas revisiones determinan el estado del perfil y se congelan en la instantánea fiscal; la spec exige que estos ajustes no cambien el estado ni afecten la preparación. En la interfaz, en cambio, aparecen dentro de la subsección «Perfil tributario» de Facturación electrónica, como un bloque más del mismo apartado, con su propio botón de edición en modal.

`workshop_configuration` expone `withholding_settings(entity_type) -> (enabled, warning_percentage)` como lectura para `sales` y `workshop`, igual que ya exponen otras referencias de configuración.

### 7. Marca del cliente

`Customer.is_withholding_agent` (booleano, por defecto falso), editable con el permiso de edición de clientes existente y auditada con el resto de la ficha. Las proyecciones de venta y de operación artesanal que ya incluyen datos del cliente añaden la marca **vigente** para la pantalla de cobro; no se congela en instantáneas porque solo orienta la interfaz.

### 8. API

Sin rutas nuevas para registrar: los endpoints de cobro existentes aceptan `withholding`. Rutas nuevas bajo `/api/v1/`, por ámbito:

- `POST …/withholdings/{id}/voucher` — completar.
- `POST …/withholdings/{id}/voucher-correction` — corregir (Administrador).
- `POST …/withholdings/{id}/void` — anular (Administrador).
- `GET …/withholdings/pending` — seguimiento.
- `GET`/`PUT` de los ajustes por entidad en configuración.

Las respuestas de detalle, resumen económico y cuentas por cobrar añaden `withheld` y `withheld_excess`, y el historial incluye las retenciones. Se regenera `backend/schema.yml`.

### 9. Frontend

- **Diálogo de cobro** (`features/sales/PaymentDialog.tsx` y su equivalente del taller): se escribe el dinero recibido. Si queda diferencia y la entidad registra retenciones, aparece una sola pregunta («¿El cliente retuvo los USD 5,00 restantes?») con el importe propuesto, editable. Con cliente marcado, la opción se muestra desde el inicio. La advertencia del umbral se presenta como confirmación. Sin números de comprobante ni vocabulario tributario.
- **Detalle de la operación:** «Cobrado», «Retenido» y «Saldo» separados; historial con las retenciones y su situación.
- **Seguimiento:** vista «Retenciones por completar» por ámbito, accesible desde cuentas por cobrar, con modal para completar el comprobante (formulario corto en modal) y confirmación por toast.
- **Cliente:** interruptor «Agente de retención» en el formulario, con ayuda breve.
- **Configuración:** bloque de retenciones dentro de «Perfil tributario», sin pestaña nueva.

Se siguen los patrones vigentes: poco texto visible, avisos como iconos con detalle desplegable, uso de la paleta semántica y ancho completo.

### 10. Pruebas

- **Dominio:** `compute_balance` con retención (incluida la equivalencia exacta con `withheld = 0`), `validate_settlement`, formato de comprobante y desglose.
- **Integración por ámbito:** cobro con retención, retención sola, contado insuficiente, entidad desactivada, advertencia con y sin reconocimiento, completar, duplicado de número, corrección y anulación, bloqueo de anulaciones, permisos positivos y negativos por rol y por ámbito.
- **Transaccionales y de concurrencia:** pago y retención simultáneos sobre el mismo saldo; reintento idéntico y reintento con otro contenido; fallo a mitad de la acción combinada.
- **Devolución con retención:** exceso reembolsable limitado al dinero y retención en exceso visible.
- **Configuración:** valores por defecto sin fila, validación del porcentaje, auditoría y ausencia de efecto en el estado del perfil.
- **Frontend:** pruebas de los diálogos y vistas afectadas; un recorrido E2E por ámbito (cobrar con retención y completar el comprobante).

Conforme a la instrucción vigente del titular, se ejecutan pruebas focalizadas de los módulos tocados y se informa qué no se ejecutó.

## Risks / Trade-offs

- [Cambiar `compute_balance` afecta a todos los saldos] → Argumento con valor por defecto y prueba de equivalencia con `withheld = 0`; las pruebas existentes de saldo deben pasar sin modificarse.
- [Una retención mal digitada cierra una deuda real] → Advertencia configurable, lista de pendientes y anulación con motivo.
- [Dos tablas casi iguales duplican código] → Reglas puras en `shared`; la duplicación de estructura es la consecuencia aceptada de DP-029.
- [La marca del cliente puede quedar desactualizada] → Solo orienta la interfaz; nunca bloquea ni calcula.
- [Retención en exceso tras una devolución exige intervención] → Se muestra separada y se resuelve anulando la retención; caso poco frecuente.
- [Ajustes fuera de las revisiones del perfil no quedan versionados como historia inmutable] → `version` y auditoría de cada cambio; no participan en la instantánea fiscal, por lo que no necesitan congelarse.

## Migration Plan

1. Migraciones aditivas en `sales`, `workshop`, `customer_registry` y `workshop_configuration`; ninguna modifica filas existentes.
2. Desplegar backend y frontend juntos. Sin fila de ajustes, ambas entidades quedan con el registro activado y la advertencia al 20 %.
3. Reversión: al no reescribirse datos, basta volver a la versión anterior; las tablas nuevas quedarían sin uso. Si ya existen retenciones registradas, la reversión volvería a mostrar esos importes como saldo, por lo que debe evaluarse antes de aplicarla.

Se actualizan `docs/arquitectura/modelo-datos.md`, `modelo-dominio.md` (§10 y diagrama), `reglas-negocio.md` (RN-VEN-011), requisitos, casos de uso (CU-013), interfaz, trazabilidad, glosario y una decisión confirmada nueva (DP-032) con D1…D7.

No se requiere un ADR nuevo: el cambio aplica los contratos transaccionales de ADR-0006 y ADR-0008 sin alterarlos.

## Open Questions

- Los porcentajes legales de retención no se confirmaron; el diseño no depende de ellos.
- Queda para el cambio de emisión decidir si una retención se vincula con la factura autorizada y si el XML del comprobante se importa desde el archivo fiscal.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
