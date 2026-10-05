## Context

El perfil electrónico de cada **entidad fiscal** se guarda como revisiones inmutables (`ElectronicProfileRevision`) con un JSON `conditions` de seis claves (`tax_regime`, `accounting_obligation`, `special_taxpayer`, `withholding_agent`, `rimpe`, `artisan_qualification`). Cada condición tiene `status` (`UNKNOWN`, `APPLICABLE`, `NOT_APPLICABLE`), un `value` de texto libre de 1 a 500 caracteres, `source`, `starts_on` y `ends_on` (`workshop_configuration/domain/electronic_profile.py`). El estado del perfil se calcula en `electronic_status.py`: toda causa se convierte en un impedimento de preparación en `fiscal_resolver.py`, y las advertencias (hoy solo del certificado) no bloquean.

La instantánea fiscal (`fiscal/domain/snapshot.py`, formato 2) copia las condiciones aplicables a `legends` como cadenas `clave: valor`. El código de línea se toma del `product_snapshot` de la venta o, en servicios, de `service_id` (`fiscal/application/snapshot_builder.py:164-167`). No se comprueba ninguna longitud.

El catálogo limita el código de producto a 64 caracteres (`catalog/domain/validation.py`, `CODE_MAX`), el mismo valor que usa el código del fabricante. `Service` no tiene código. `ServiceOperationLine` conserva `service_id` como entero y `service_name` como texto.

Restricciones: monolito modular, reglas de dominio sin dependencias de DRF, TDD, sesiones y CSRF vigentes (ADR-0003), instantáneas inmutables (ADR-0010), sin dependencias nuevas. La emisión sigue fuera de alcance y el único ambiente es pruebas.

## Goals / Non-Goals

**Goals:**

- Que el perfil del emisor solo admita valores representables en el esquema de factura 2.1.0.
- Que la calificación artesanal tenga número, vencimiento obligatorio, aviso a 60 días y coherencia con la tarifa preparada.
- Que ninguna línea llegue a una preparación completada con un código de más de 25 caracteres, una descripción de más de 300 o un identificador interno como código.
- Conservar sin reescritura las revisiones de perfil, las instantáneas y los productos existentes.

**Non-Goals:**

- Generar XML, firmar, transmitir o integrar un proveedor.
- Cambiar la regla de redondeo del IVA (DP-025).
- Notas de venta, retenciones, preparación automática al confirmar y notas de crédito.
- Convertir automáticamente perfiles en texto libre o truncar códigos existentes.

## Decisions

### 1. Formato del perfil versionado por revisión

Se añade a `ElectronicProfileRevision` el campo `conditions_format` (entero pequeño, valor por defecto `1`). La migración es aditiva y no toca filas: todas las revisiones existentes quedan en formato 1. Toda revisión nueva se guarda con formato 2.

Forma del JSON `conditions` en formato 2:

| Clave | `status` admitido | `value` |
|---|---|---|
| `tax_regime` | `UNKNOWN`, `APPLICABLE` | `GENERAL`, `RIMPE_EMPRENDEDOR`, `RIMPE_NEGOCIO_POPULAR` |
| `accounting_obligation` | `UNKNOWN`, `APPLICABLE` | `SI`, `NO` |
| `withholding_agent` | `UNKNOWN`, `NOT_APPLICABLE`, `APPLICABLE` | resolución `^[0-9]{1,8}$` |
| `special_taxpayer` | `UNKNOWN`, `NOT_APPLICABLE`, `APPLICABLE` | resolución `^[A-Za-z0-9]{1,13}$` |
| `artisan_qualification` | `UNKNOWN`, `NOT_APPLICABLE`, `APPLICABLE` | número de 1 a 50 caracteres; además `issuing_body` (1 a 200) y `ends_on` obligatorio |

La clave `rimpe` deja de existir en formato 2. `source`, `starts_on` y `ends_on` se conservan igual que hoy. La validación vive en el dominio (`electronic_profile.py`) con un analizador por clave; el analizador de formato 1 se mantiene solo para leer historia.

La leyenda del régimen es una función pura del valor: `RIMPE_EMPRENDEDOR` → `CONTRIBUYENTE RÉGIMEN RIMPE`; `GENERAL` → sin leyenda. No se guarda en el perfil.

*Alternativa descartada:* columnas tipadas por condición. Rompería el historial inmutable por revisiones y exigiría migrar datos que la decisión D1 prohíbe interpretar.

*Alternativa descartada:* detectar el formato por la forma del JSON. Un campo explícito evita heurísticas y permite una restricción de base de datos (`conditions_format` en `{1, 2}`).

### 2. Estado del perfil y avisos

`evaluate_electronic_status` cambia así:

- Revisión vigente en formato 1 → causa `MISSING` con código `profile.legacy_format` y mensaje «Declare de nuevo el perfil con las opciones actuales». No se analizan sus condiciones para producir otras causas. El estado resultante es *Falta completar*.
- Régimen `RIMPE_NEGOCIO_POPULAR`: no genera causa. El SRI permite a un negocio popular emitir comprobantes electrónicos de forma voluntaria; lo que lo distingue es que no cobra IVA, y eso se comprueba al preparar (decisión 6).
- Calificación artesanal `APPLICABLE` cuyo `ends_on` está a 60 días o menos de `on` y no ha vencido → **advertencia** `artisan_qualification_expiring`, con la fecha y los días restantes. Va en `warnings`, que no bloquea, igual que las del certificado. Vencida, la regla general de vigencia ya produce `conditions.artisan_qualification.expired` (`REVIEW`).

El umbral de 60 días es una constante de dominio. El cálculo usa la fecha local que ya recibe la función, que el llamador obtiene con `timezone.localdate()` en America/Guayaquil.

`fiscal_resolver.FiscalConfiguration.future_emission_issues` recibe hoy todas las advertencias. La advertencia de calificación no es un asunto de emisión futura, así que se separan: `warnings` del certificado siguen en `future_emission_issues` y la de calificación se expone solo en el estado de configuración.

### 3. Contrato del perfil

`PUT` del perfil electrónico acepta únicamente el formato 2 y rechaza la clave `rimpe`. La respuesta de consulta añade `conditions_format`, la leyenda derivada (`regime_legend`) y, por condición, las opciones admitidas, para que la interfaz no las fije en su código. Una revisión en formato 1 se devuelve con sus textos originales y `conditions_format: 1`, solo lectura.

Es un cambio incompatible del cuerpo de guardado. El único consumidor es `ProfileConditionsSection.tsx`. Se regenera `backend/schema.yml`.

La idempotencia, el control de `expected_revision`, el recibo y la auditoría de `save_profile` no cambian.

### 4. Emisor estructurado en la instantánea (formato 3)

`SNAPSHOT_FORMAT` pasa a `3`. `issuer` añade el objeto `tax_profile`:

```json
{
  "regime": "GENERAL",
  "regime_legend": null,
  "accounting_obligation": "NO",
  "withholding_agent_resolution": null,
  "special_taxpayer_resolution": null,
  "artisan_qualification": {"number": "…", "issuing_body": "…", "ends_on": "2028-05-31"}
}
```

Las claves que no aplican se omiten (no se escriben como `null`; el ejemplo las muestra solo para nombrarlas). `legends` se conserva como lista vacía en formato 3 para no romper lectores existentes. `configuration.profile_revision` ya identifica la revisión usada.

El ensamble sigue en `snapshot_builder.assemble_snapshot`; la función que traduce condiciones a `tax_profile` es pura y vive en `fiscal/domain`. Las claves actuales de `issuer` (`ruc`, `legal_name`, `address`, códigos, ambiente) no cambian porque las consume la identidad de ensayo.

Las instantáneas de formato 1 y 2 no se migran. La lectura (`fiscal/api/serializers.py` y la página de preparación) muestra `tax_profile` cuando existe y las `legends` cuando no.

### 5. Límites de línea e impedimentos

En `fiscal/domain/snapshot_amounts.build_amounts`, donde hoy se exige código y descripción no vacíos, se añaden:

- `item_code`: de 1 a 25 caracteres, sin saltos de línea;
- `description`: de 1 a 300 caracteres, sin saltos de línea.

Cada incumplimiento agrega un impedimento con `field`, `message`, `expected` y `observed` (longitudes), siguiendo la forma existente. No hay truncado. Las constantes llevan un comentario con el elemento del XSD del que provienen.

`fiscal/application/impediment_messages.py` recibe los textos dirigidos al Administrador.

### 6. Calificación artesanal y tarifa

En `assemble_snapshot`, después de resolver la correspondencia de cada línea (`resolve_mapping` ya devuelve la entrada oficial): si el perfil tiene calificación `APPLICABLE` vigente en `reference_date`, toda línea debe resolver a la entrada con tratamiento `ZERO` del catálogo oficial. Si no, se agrega un impedimento por línea con código `line[n].artisan_rate`. La regla no se evalúa si la calificación no aplica o si el perfil no está listo (en ese caso ya hay impedimentos de configuración).

Se usa el tratamiento del catálogo (`ZERO`) y no el número `0`, para no confundir tarifa cero con *no objeto* o *exento*, que el catálogo distingue.

### 6a. Negocio Popular y cambio de régimen

`snapshot_builder` exige tratamiento `ZERO` en toda línea cuando `tax_profile.regime` es `RIMPE_NEGOCIO_POPULAR` (impedimento `line[n].popular_rate`, mismo tratamiento y destinatario que la regla de calificación artesanal). La leyenda de Negocio Popular no se deriva: el esquema 2.1.0 solo admite `CONTRIBUYENTE RÉGIMEN RIMPE` en `contribuyenteRimpe` y el texto para negocios populares está por confirmar; el régimen sí se guarda en `tax_profile.regime`.

El cambio de régimen se apoya en piezas que ya eran por vigencia: revisión nueva del perfil (la anterior queda como historia), `schedule_successor` para la tarifa interna y una operación nueva, `schedule_mapping_successor`, para la correspondencia con el SRI. Esta última bloquea la entidad y la correspondencia, exige que esté abierta y que el inicio sea futuro, cierra la actual el día anterior y crea la sucesora con `create_mapping`, que ya comprueba que el código no contradiga la tarifa interna. La tarifa interna se programa con la sucesión que ya existía (`POST /workshop-configuration/periods/{id}/schedule-successor/`), que la página de Impuestos conecta ahora a la acción «Programar tarifa» sobre el mismo impuesto: así los productos, que apuntan al impuesto y no a una tarifa, no se tocan. Se descartó mantener un único impuesto activo por entidad y sustituirlo, porque obligaba a reasignar productos, acumulaba impuestos históricos y no admitiría tarifas distintas por producto en Emprendedor o General. La correspondencia con el SRI se expone en `POST /fiscal/configuration/tax-mappings/{id}/successor/` y en un modal «Programar cambio» de la subsección *Impuestos y catálogo SRI*. Sin ella, una correspondencia abierta impedía crear la siguiente por solapamiento y el código de IVA 0 % seguía rigiendo tras el cambio.

### 7. Código de producto

`CODE_MAX` se separa en dos constantes: `PRODUCT_CODE_MAX = 25` y `MANUFACTURER_CODE_MAX = 64`. El código del fabricante no cambia.

Para respetar D2, `validate_product` recibe el código vigente del producto cuando es una edición: si el código normalizado es igual al vigente, no se aplica el límite; si cambia, o es un alta, se exige 25. La columna `Product.code` conserva `max_length=64`: no hay migración ni restricción de base de datos, porque existen filas válidas más largas.

Filtro nuevo en la consulta de productos: `code_over_limit=true`, que añade `Length("code") > 25` al queryset existente (`catalog/application/queries.py`), con el mismo paginado. Exige el permiso de edición de productos; sin él responde 403. El serializador de lista añade `code_length` solo cuando se usa el filtro. En la interfaz es un filtro adicional de `ProductsPage`, visible solo para quien edita.

### 8. Código de servicio

`Service` añade `code` (`CharField`, 25, único). El número proviene de `ServiceCodeCounter`, una fila única bloqueada con `select_for_update` dentro de la transacción del alta, el mismo patrón que `MaintenanceCounter` del taller. Formato: `SRV-` más el número con al menos seis dígitos.

*Alternativa descartada:* derivarlo de la clave primaria. Las secuencias de PostgreSQL dejan huecos al revertir una transacción, y el identificador interno es justo lo que se quiere dejar de exponer.

Migración en tres pasos dentro de `catalog`: añadir `code` anulable y el contador; rellenar por orden de `created_at` e `id` y fijar el contador; volver `code` obligatorio y único. El relleno es idempotente (solo filas sin código).

El alta y la edición rechazan con error de campo cualquier `code` recibido. La búsqueda de servicios incluye el código.

### 9. Código de servicio en las líneas artesanales

`ServiceOperationLine` y `ServiceLine` añaden `service_code` (texto, 25, vacío permitido solo para historia). Se copia junto a `service_name` al crear la línea (`workshop/application/service_lines.py`) y al documentar la operación (`service_operations.py`). La migración del taller rellena las filas existentes consultando el código del servicio por `service_id` mediante una función de lectura del catálogo, sin escribir en tablas ajenas.

`workshop/application/fiscal_source.py` entrega `service_code` como código de línea. `snapshot_builder` deja de usar `service_id`. Si una línea histórica quedara sin código (servicio inexistente), el límite del punto 5 produce el impedimento por código vacío.

La migración de `workshop` depende de la de `catalog`.

### 10. Frontend

- `ProfileConditionsSection.tsx`: selectores para régimen y contabilidad; para agente de retención, contribuyente especial y calificación, un selector *No aplica / Aplica* que revela los campos. Leyenda del régimen como texto de solo lectura. Revisión en formato 1: aviso «Perfil anterior» con detalle desplegable, todas las condiciones como «Sin declarar» y el texto anterior solo de lectura en la información avanzada; se vuelve a declarar con las acciones «Declarar» de cada fila, sin un botón aparte, porque ese botón no añadiría una función distinta. Sigue los patrones vigentes: formulario corto en modal, confirmación con toast, avisos como iconos con detalle.
- Aviso de vencimiento de la calificación en la subsección del perfil, con color de advertencia y texto con fecha y días.
- Servicios: columna y campo de solo lectura con el código; búsqueda por código. La operación artesanal muestra el código junto al nombre.
- Productos: `maxLength` y mensaje del límite; filtro de códigos por corregir.
- Preparación fiscal: muestra el emisor estructurado y los impedimentos nuevos con el texto del backend.

El frontend no decide ninguna de estas reglas: refleja opciones, estados e impedimentos que entrega el backend.

### 11. Pruebas

| Criterio | Nivel | Ubicación |
|---|---|---|
| Valores cerrados y formatos de resolución | Unitaria de dominio | `backend/tests/workshop_configuration` |
| Estados: formato 1, negocio popular, aviso a 60/61 días, vencida | Integración de servicio | `backend/tests/workshop_configuration` |
| Permisos del perfil (Administrador frente a Vendedor y Encargado) | API | `backend/tests/workshop_configuration` |
| `tax_profile`, límites de línea y regla de calificación | Unitaria y de integración | `backend/tests/fiscal` |
| Instantáneas de formato 1 y 2 sin cambios | Regresión | `backend/tests/fiscal` |
| Límite 25, edición sin cambiar código, filtro y permiso | Unitaria y API | `backend/tests/catalog` |
| Código de servicio: asignación, concurrencia, rechazo de `code`, migración | Integración y transaccional | `backend/tests/catalog` |
| `service_code` en líneas y fuente fiscal | Integración | `backend/tests/workshop` |
| Formularios, aviso y filtros | Vitest | junto a cada componente |
| Recorrido: declarar perfil y preparar una operación artesanal | Playwright | `frontend/e2e` (spec fiscal existente) |

La concurrencia del contador se prueba con dos transacciones reales, como las pruebas existentes de numeración.

### 12. Documentación

Se actualizan: `docs/tecnico/matriz-instantanea-fiscal.md` (formato 3 y límites), `docs/negocio/producto/glosario.md` (perfil del emisor, régimen tributario, calificación artesanal, agente de retención, código de servicio, impedimento), requisitos y matriz de trazabilidad afectados, `docs/arquitectura/modelo-datos.md` (columnas y contador nuevos), y `backend/schema.yml`. No se requiere un ADR nuevo: el cambio aplica ADR-0010 sin alterar una decisión duradera.

## Risks / Trade-offs

- **El perfil vigente en formato 1 bloquea la preparación tras desplegar** → El aviso indica exactamente qué hacer y la preparación solo opera hoy en ambiente de pruebas. Las operaciones internas no dependen del perfil.
- **Ventas ya confirmadas con código largo no podrán prepararse nunca** → Es consecuencia de no reescribir instantáneas históricas. El filtro permite corregir el catálogo antes de que se acumulen; el impedimento nombra el producto.
- **El contador de servicios serializa las altas** → El volumen de altas de servicios es mínimo; el bloqueo dura una transacción corta.
- **Dos migraciones encadenadas entre módulos (`catalog` → `workshop`)** → Dependencia declarada en la migración; el relleno es idempotente y se prueba con datos anteriores.
- **Cambio incompatible del contrato del perfil** → Un único consumidor, actualizado en el mismo cambio; OpenAPI regenerado y comprobado.
- **La regla de tarifa cero no acredita el beneficio legal** → Los textos lo dicen y la spec prohíbe presentarla como verificación.
- **Umbral de 60 días fijo** → Aceptado en D4; cambiarlo es editar una constante con su prueba.

## Migration Plan

1. `workshop_configuration`: añadir `conditions_format` con valor por defecto 1 y su restricción.
2. `catalog`: añadir `Service.code` y `ServiceCodeCounter`; rellenar; volver obligatorio y único.
3. `workshop`: añadir `service_code` a las líneas; rellenar desde el catálogo.
4. Desplegar backend y frontend juntos, porque el contrato del perfil cambia.

Reversión: las migraciones son aditivas y reversibles (eliminan columnas nuevas). Las revisiones de formato 2 y las instantáneas de formato 3 creadas después no las entiende el código anterior, así que una reversión de código exige no haber guardado ninguna, o conservar el código nuevo de lectura. No se elimina ni reescribe ningún dato existente en ningún paso.

## Open Questions

- Presentación del número de calificación artesanal en el comprobante (D5): se decide en el cambio de emisión.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
