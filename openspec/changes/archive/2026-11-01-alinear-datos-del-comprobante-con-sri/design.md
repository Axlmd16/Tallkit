## Context

La preparación fiscal arma una instantánea inmutable en `fiscal/application/snapshot_builder.assemble_snapshot`, bajo bloqueo, tanto al revisar como al completar. Hoy conserva el formato 3 (`fiscal/domain/snapshot.py`). El borrador vive en `FiscalPreparation.draft` (JSON) y lo normaliza `fiscal/application/draft_prefill.py`.

Estado actual de los datos que toca este cambio:

- **Correo:** `parse_receiver` lo valida solo si llega. `_missing_receiver_fields` pide únicamente la dirección.
- **Plazo:** `_check_draft_fields` y `validate_payment_declaration` lo rechazan siempre.
- **Detalle adicional:** `update_draft` lo acepta con forma `{name, value}` y hasta 15 pares, sin más validación, y ninguna pantalla lo muestra.
- **Emisor:** `_issuer_dict` no pasa `trade_name` ni `establishment_address`, aunque `snapshot.py` ya contempla el primero y `FiscalConfiguration` ya tiene el segundo.
- **Perfil:** `ElectronicProfileRevision.conditions` es un JSON en formato 2 de condiciones cerradas. `parse_profile_conditions` valida tanto al guardar como al leer.
- **Taller:** `ServiceLine` y `ServiceOperationLine` no tienen nota; `review_digest` calcula la huella de lo revisado.
- **Saldo:** lo calculan `sales.application.ledger.ledger_for` y `workshop.application.service_operations.balance_of`. Las fuentes fiscales exponen `collected_by_method`, pero no el saldo.

Restricciones: monolito modular, dominio sin DRF, TDD, instantáneas inmutables (`ADR-0010`), sesiones y CSRF vigentes (`ADR-0003`) y sin dependencias nuevas. El sistema sigue solo en pruebas (`DP-034`, regla 8).

## Goals / Non-Goals

**Goals:**

- Exigir al preparar el correo del comprador identificado y el **plazo del comprobante** cuando corresponda, sin afectar ventas, cobros ni el registro del cliente.
- Conservar en la instantánea el emisor completo, las leyendas, el **gran contribuyente**, el **detalle adicional** y el **detalle de servicio**.
- Cerrar las diferencias entre el perfil, la ficha 2.34 y el XSD 2.1.0.
- Conservar sin reescritura las revisiones de perfil, las instantáneas y las operaciones existentes.

**Non-Goals:**

- Generar XML, adaptadores, cola de emisión, ambiente por RUC y comprobación de `RUC Proveedor`: cambios 3 y 4.
- Cambiar la regla de redondeo (`DP-025`).
- Sincronizar el correo de la preparación con la ficha del cliente.
- Actualizar el XSD local o la validación del archivo fiscal.

## Decisions

### 1. Gran contribuyente sin subir el formato del perfil

`CONDITION_KEYS` añade `large_taxpayer`, con estados `UNKNOWN`, `NOT_APPLICABLE` y `APPLICABLE`, y un valor de 1 a 300 caracteres en una línea. `parse_profile_conditions` ya trata una clave ausente como `UNKNOWN`, y `_condition_causes` ya produce `conditions.large_taxpayer.unknown` de clase `MISSING`. Con eso, una revisión existente queda en *Falta completar* pidiendo solo esa condición.

`CURRENT_CONDITIONS_FORMAT` sigue en 2.

*Alternativa descartada:* subir el formato. Dispararía `profile.legacy_format` y obligaría a declarar de nuevo todo el perfil, lo que contradice la spec.

*Alternativa descartada:* una migración que escriba `NOT_APPLICABLE`. Inventaría un dato tributario, y la spec distingue ausencia de no aplicabilidad.

**Corrección a la propuesta:** la propuesta anunció una migración para esta condición. No hace falta, porque el JSON ya la admite. La única migración es la de taller (decisión 8).

### 2. Formatos más estrictos con lectura tolerante

`_WITHHOLDING_RE` pasa a `[1-9][0-9]{0,7}` y `_SPECIAL_TAXPAYER_RE` a `[A-Za-z0-9]{3,13}`.

El riesgo está en la lectura. `evaluate_electronic_status` y `workshop_configuration/application/home_summary.py` reutilizan `parse_profile_conditions`, que lanza una excepción. Un valor guardado que ya no cumple el formato rompería toda consulta del perfil, y con ella la preparación y la página de inicio.

Por eso se separan los dos caminos:

- **Escritura:** `parse_profile_conditions` sigue estricto y acumula errores.
- **Lectura:** `read_stored_conditions(payload)` devuelve las condiciones y las claves inválidas. Una clave inválida se trata como `UNKNOWN` y nunca lanza excepción.

`evaluate_electronic_status` convierte cada clave inválida en la causa `conditions.<clave>.invalid_format`, de clase `MISSING`, que lleva a *Falta completar*. El valor guardado no se toca. `_configuration_message` usa `CONDITION_LABELS` para nombrar la condición afectada, como pide la spec.

### 3. Leyendas derivadas

`regime_legend` pasa de una comparación a un mapa de régimen a leyenda: Emprendedor, Negocio Popular y sin entrada para General. Se corrige el comentario que llama «único valor admitido» a `CONTRIBUYENTE RÉGIMEN RIMPE`.

`build_tax_profile` agrega `large_taxpayer_resolution`. `legends` sigue vacía: el **perfil del emisor** es la única fuente. El cambio 3 traducirá el número al campo `<campoAdicional nombre="Gran Contribuyente">` que muestra el ejemplo del Anexo 24.

La validación del archivo (`fiscal/infrastructure/xml_parser.py`) no cambia. Ver riesgos.

### 4. Instantánea en formato 4

`SNAPSHOT_FORMAT` pasa a 4. Respecto del formato 3:

| Clave | Contenido |
|---|---|
| `issuer.trade_name` | Solo si fue declarado |
| `issuer.establishment_address` | Obligatoria |
| `issuer.tax_profile.regime_legend` | También para Negocio Popular |
| `issuer.tax_profile.large_taxpayer_resolution` | Solo si aplica |
| `payments[*].term_days`, `payments[*].time_unit` | Solo en las formas con plazo |
| `lines[*].service_detail` | Solo si hay texto |
| `additional_info[*]` | `{name, value}` validados |

`FiscalConfiguration` añade `trade_name`. `_issuer_dict` pasa los dos campos y `establishment_address` entra en `REQUIRED_ISSUER_FIELDS`. Todo es aditivo: las claves que lee `fiscal/application/identity.py` no cambian.

Los valores que no aplican se omiten, igual que en el formato 3. Por eso el diccionario de cada forma de pago se arma sin claves nulas. Los formatos 1 a 3 no se migran, y la lectura muestra cada clave solo si existe.

### 5. Correo exigido al armar la instantánea

`FiscalReceiver` añade la propiedad `requires_email`, verdadera salvo para `07`. La regla vive en `assemble_snapshot` como impedimento `receiver.email`, de audiencia `OPERATOR`, y `_missing_receiver_fields` lo incluye para que la pantalla lo pida.

*Alternativa descartada:* exigirlo en `parse_receiver`. Esa función también valida al guardar, y la spec permite guardar un borrador sin correo.

### 6. Saldo pendiente expuesto por el módulo dueño

`CommercialFiscalSource` y `ArtisanFiscalSource` añaden `pending_balance`, tomado de `ledger_for(sale).balance.balance` y `balance_of(operation).balance`. Ya descuenta cobros, reembolsos, devoluciones y retenciones recibidas, y nunca es negativo.

`fiscal` no recalcula saldos: conserva la frontera del monolito y evita una segunda fórmula.

### 7. Plazo del comprobante

El borrador guarda un solo valor en `payments.term_days`, un entero JSON. La unidad no se guarda: la fija el sistema.

Las reglas puras viven en `fiscal/domain/payment_term.py`:

- `term_required(condition, pending_balance)`: verdadero solo con `CREDITO` y saldo mayor que cero.
- `parse_term_days(value)`: entero de 1 a 9999. Rechaza booleanos, decimales y texto.
- `forms_with_term(forms, collected_by_code)`: formas cuyo importe supera lo cobrado con esa forma. `collected_by_code` se obtiene de `collected_by_method` con la correspondencia `V1_ENABLEABLE_PAYMENT_FORMS`.

Si hay saldo pendiente, al menos una forma recibe plazo: lo cobrado es menor que el total y las formas suman el total, así que alguna supera su cobro.

Se aplica en dos momentos:

| Momento | Comportamiento |
|---|---|
| `update_draft` | Lee la fuente sin bloquearla. Rechaza el plazo si no corresponde o tiene un valor inválido. |
| `assemble_snapshot` | Reevalúa bajo bloqueo. Sin plazo cuando corresponde: impedimento `payments.term_days`, de audiencia `OPERATOR`. Con plazo que ya no corresponde: lo ignora. |

Una lectura sin bloqueo en `update_draft` es segura porque la decisión final siempre ocurre bajo bloqueo. El rechazo por condición usa `DraftFieldNotAllowedError`, y el de valor inválido, una excepción nueva `DraftValidationError` con errores por campo, traducida a `validation_error`.

`_check_draft_fields` admite `term_days` en `payments`. Dentro de cada forma, `term_days` y `time_unit` se siguen rechazando. Como `normalized_draft` ya descarta los plazos antiguos de las formas, un borrador anterior vuelve a pedir el plazo.

La respuesta de trabajo añade `term_required` y `missing_fields` incluye `term_days`, de modo que la interfaz no decide la regla.

El plazo no toca `sales` ni `workshop` para escribir, por lo que no puede crear vencimientos ni afectar cobros, cuentas por cobrar o reportes.

### 8. Detalle de servicio en taller

`ServiceLine` y `ServiceOperationLine` añaden `detail`, un `CharField` de 300 caracteres, en blanco por defecto. Migración `workshop/0007`, aditiva.

- **Entrada:** `parse_line_create` y `parse_line_update` aceptan `detail`. Ausente significa sin cambio; vacío, quitarlo. Validan longitud y saltos de línea, sin recortar.
- **Edición:** `update_line` lo trata como un campo más de `changed`. `_open_line`, `ensure_state` y `ensure_version` ya aplican las reglas de línea documentada, orden finalizada y concurrencia. No hace falta un permiso nuevo: basta `mantenimientos.gestionar`.
- **Auditoría:** registra el nombre del campo cambiado, no el texto.
- **Confirmación:** `DocumentableLine` añade `detail`, `review_digest` lo incluye y la creación de `ServiceOperationLine` lo copia. Así, un cambio después de revisar exige una revisión nueva con el mecanismo actual.
- **Fuente fiscal:** `ArtisanFiscalLine` añade `detail`.

*Alternativa descartada:* guardar el texto solo en `ServiceOperationLine`. Obligaría a escribirlo al confirmar y no mientras se trabaja.

### 9. Detalle de servicio en la preparación

El borrador añade `service_details`, una lista de `{position, detail}`:

- `initial_draft` la llena con el valor de cada línea artesanal.
- `normalized_draft` hace lo mismo con un borrador anterior que no tenga la clave. Si la clave existe, respeta lo que el usuario dejó.
- `update_draft` la rechaza en preparaciones comerciales, igual que una posición desconocida o un texto de más de 300 caracteres.
- `assemble_snapshot` agrega `service_detail` a la línea solo si hay texto.

Un reemplazo pasa por `initial_draft`, así que vuelve a precargar el valor de la operación. Nada de esto escribe en `workshop`.

`DRAFT_FORMAT` sube a 3 y `update_draft` usa la constante, porque hoy escribe el `2` literal.

### 10. Detalle adicional

Las reglas puras viven en `fiscal/domain/additional_info.py`: forma `{name, value}`, 1 a 300 caracteres sin saltos de línea, hasta 12 pares, nombres únicos y nombres reservados, comparando con `casefold` tras quitar espacios.

Se invoca en dos sitios: `update_draft` rechaza con errores por campo y `assemble_snapshot` produce impedimentos para los borradores existentes, sin eliminar pares.

`FiscalDraftUpdate` deja de limitar la lista a 15 para que el mensaje venga del dominio.

*Alternativa descartada:* reservar 1 solo campo. La ficha muestra ejemplos con un campo de correo en la información adicional, y un proveedor puede agregarlo junto a `RUC Proveedor` y `Gran Contribuyente`.

### 11. API

| Recurso | Cambio |
|---|---|
| `PATCH` de la preparación | Acepta `payments.term_days` y `service_details`; responde con errores por campo. |
| Lectura de la preparación | Añade `term_required` y muestra los datos nuevos del borrador y la instantánea. |
| Perfil electrónico | Admite `large_taxpayer`, y la leyenda derivada cubre Negocio Popular. |
| Líneas de servicio | `detail` en alta, edición y lectura. |
| Operación artesanal | `detail` en vista previa, detalle y documento. |

Se regenera `backend/schema.yml`. Los cambios son aditivos, salvo que un `PATCH` con pares inválidos ahora falla. El único consumidor es el frontend, que se actualiza en el mismo cambio.

### 12. Frontend

El frontend refleja lo que entrega el backend y no decide reglas.

- **`FiscalPreparationPage.tsx`:**
  - el correo deja de decir «(opcional)»;
  - el campo de plazo aparece junto a las formas de pago solo si `term_required`;
  - el detalle adicional se presenta como filas que se agregan en un modal;
  - cada línea artesanal permite ajustar su detalle;
  - la vista de una preparación completada muestra los datos nuevos cuando existen.
- **`ProfileConditionsSection.tsx`:** añade gran contribuyente con el mismo selector *No aplica / Aplica* y muestra la leyenda de Negocio Popular.
- **`ServiceLines.tsx`:** añade el campo en el modal de la línea y muestra el texto bajo el nombre.
- **`BillingDialogs.tsx`, `ServiceOperationDetailPage.tsx` y `ServiceOperationDocumentPage.tsx`:** muestran el detalle bajo el servicio, sin espacio vacío si no hay.

### 13. Límites transaccionales, concurrencia y seguridad

- No cambia dinero, inventario ni secuencias, y no se agregan transacciones nuevas.
- El borrador sigue protegido por el bloqueo de la preparación y por `expected_version`.
- Las líneas siguen protegidas por `lock_order` y `ensure_version`. La idempotencia de `execute_write` incluye `detail` porque forma parte del `payload`.
- La revisión fiscal sigue atada a la huella de la instantánea: cualquier dato nuevo que cambie invalida el token.
- No hay permisos nuevos. Cada escritura pasa por las autorizaciones existentes.
- Los textos libres pueden contener datos personales. Por eso no van a la auditoría, y la pantalla recuerda incluir solo lo necesario para el comprobante (`RNF-DAT-001`).

### 14. Pruebas

| Criterio | Nivel | Ubicación |
|---|---|---|
| Formatos, leyendas, `large_taxpayer` y lectura tolerante | Unitaria | `backend/tests/workshop_configuration` |
| Estados: revisión sin la condición y valor guardado inválido | Integración | `backend/tests/workshop_configuration` |
| Reglas de plazo y `forms_with_term` | Unitaria | `backend/tests/fiscal/test_payment_term.py` |
| Reglas de detalle adicional | Unitaria | `backend/tests/fiscal/test_additional_info.py` |
| Correo, formato 4 y emisor completo | Unitaria e integración | `backend/tests/fiscal/test_receiver.py`, `test_snapshot.py`, `test_api.py` |
| Instantáneas de formatos 1 a 3 sin cambios | Regresión | `backend/tests/fiscal` |
| Plazo con abono, retención, contado y cobro antes de completar | Integración | `backend/tests/fiscal/test_api.py`, `backend/tests/workshop/test_fiscal_preparation.py` |
| El plazo no cambia saldo, estado de pago ni cuentas por cobrar | Integración | `backend/tests/fiscal` |
| Detalle en líneas: permisos, bloqueo, versión y digest | Unitaria e integración | `backend/tests/workshop` |
| Detalle precargado, ajustado y rechazado en comercial | Integración | `backend/tests/workshop/test_fiscal_preparation.py` |
| Migración de `workshop` y comprobación de migraciones | Migración | `backend/tests/workshop` |
| Fronteras de módulos | Arquitectura | `backend/tests/fiscal/test_boundaries.py` |
| Formularios, plazo condicional y documentos | Vitest | Junto a cada componente |
| Recorrido: operación a crédito con detalle hasta completar | Playwright | `frontend/e2e/fiscal.spec.ts` |

Se ejecutan solo las pruebas relacionadas con el cambio.

### 15. Documentación

- **Decisiones:** `DP-035` y las notas de ajuste en `DP-003`, `DP-027` y `DP-031`.
- **Producto y requisitos:** reglas, requisitos funcionales, casos de uso, interfaz, trazabilidad y cobertura del módulo fiscal.
- **Modelo de dominio:** plazo del comprobante, gran contribuyente y detalle de servicio.
- **Glosario:** cuatro términos nuevos.
- **`matriz-instantanea-fiscal.md`:** formato 4, `nombreComercial`, `dirEstablecimiento`, `plazo`, `unidadTiempo`, `detAdicional` y la leyenda de Negocio Popular.
- **Matriz de normas:** filas `NOR-019`, `NOR-020` y `NOR-021`, y validación `V-6`.
- **Plan:** ambiente al cambio 3, `RUC Proveedor` al cambio 4, redondeo a validaciones externas y la nota corregida del cambio 1.

No se requiere un ADR nuevo: ninguna decisión es transversal ni costosa de revertir. `ADR-0010` sigue vigente sin cambios.

## Risks / Trade-offs

- **[Perfil en *Falta completar* tras desplegar]** → Las operaciones internas no dependen del perfil, la causa dice qué declarar y hoy solo se prepara en pruebas.
- **[Valor guardado que rompe una lectura]** → La decisión 2 separa lectura y escritura, con prueba de regresión para `evaluate_electronic_status` y la página de inicio.
- **[Negocio Popular rechazado por el archivo fiscal]** → Un XML autorizado con esa leyenda fallaría en `xml_parser.py`. Aquí no se cambia porque ningún RUC está en ese régimen; `NOR-020` lo deja registrado y bloquea su activación.
- **[Redondeo del IVA]** → No cambia. La activación del RUC comercial sigue condicionada por `RN-FIS-017`.
- **[Preparaciones completadas sin correo ni plazo]** → Se conservan. El cambio 3 debe decidir si exige reemplazarlas antes de emitir.
- **[`pending_balance` añade consultas a cada fuente]** → Son pocas y ocurren al abrir, revisar y completar una preparación.
- **[Plazo guardado que queda sin efecto]** → Se ignora sin error y la pantalla oculta el campo.

## Migration Plan

1. Aplicar `workshop/0007`, aditiva: los campos nuevos empiezan vacíos.
2. Desplegar backend y frontend juntos.
3. Declarar gran contribuyente en cada perfil. Mientras tanto, esa entidad no prepara facturas.

**Reversión:** la migración se puede revertir, pero borra las notas escritas. El código anterior rechazaría revisiones con `large_taxpayer`, porque `parse_profile_conditions` no admite claves desconocidas, y no entendería el formato 4. Una reversión exige no haber guardado esos datos, o restaurar un respaldo.

## Open Questions

- **`V-6`:** si un crédito sin fecha acordada debe llevar plazo y qué número corresponde. Si la respuesta cambia la regla, se ajusta `term_required`.
- **`NOR-020`:** si manda la ficha o el XSD. Bloquea activar un RUC en Negocio Popular, no este cambio.
- **Representación de `plazo` en Factuplan:** se comprueba en el cambio 4, junto con el detalle por línea.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
