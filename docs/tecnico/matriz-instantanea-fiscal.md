# Matriz de correspondencia de la instantánea fiscal

## Alcance y fuentes

Esta matriz comprueba la suficiencia de `snapshot.schema_version = factura-2.1.0` para una
factura ordinaria de bienes o servicios preparada por Sys-Taller. No define un generador XML ni
afirma firma, transmisión o autorización. Los campos condicionales ajenos a los casos de uso del
taller quedan identificados como no aplicables; si una operación futura los necesita, la
preparación debe bloquearse hasta aprobar su representación.

Fuente principal: paquete **XML y XSD Factura**, versiones 1.0.0, 1.1.0, 2.0.0 y 2.1.0,
publicado por el [SRI](https://www.sri.gob.ec/facturacion-electronica) y descargado el
2026-09-26 desde la URL registrada en
[`manifest.json`](../../backend/src/fiscal/infrastructure/sri_schemas/manifest.json). Para 2.1.0,
el XSD local tiene SHA-256
`5f2c37bc1a58bb40e8bbbc366cabe05d5dc199598aeea1561137370f8bd4eace`; el ZIP de origen,
`ba1ff0c4e329fe759c3f88dc75f2975780b315b6eb3d0069071b77c1f26fec03`. La dependencia de
firma se conserva desde el esquema oficial de W3C, pero no forma parte de la instantánea.

Leyenda:

- **C**: valor conservado literalmente en la instantánea.
- **D**: derivación determinista desde valores conservados.
- **I**: identidad fiscal que se incorpora después mediante la capacidad de numeración.
- **NA**: no aplicable al alcance aprobado; no se inventa un valor.
- **F**: dato de firma o autorización fuera de esta entrega.

## Raíz e información tributaria

| Campo XSD 2.1.0 | Condición | Fuente o regla | Estado |
|---|---|---|---|
| `factura/@id` | Opcional en XSD; requerido por la representación objetivo | Constante técnica `comprobante` al generar | D |
| `factura/@version` | Opcional en XSD | `schema_version`, traducido a `2.1.0` | D |
| `infoTributaria/ambiente` | Obligatorio | `issuer.environment`, resuelto por el sistema (siempre pruebas, `1`) y conservado; también en `configuration.environment` | C |
| `infoTributaria/tipoEmision` | Obligatorio | Solo emisión normal `1`; cualquier otro caso se rechaza | D |
| `infoTributaria/razonSocial` | Obligatorio | `issuer.legal_name` | C |
| `infoTributaria/nombreComercial` | Condicional | `issuer.trade_name`, solo cuando fue declarado; se conserva desde el formato 4 y nunca se sustituye por la razón social | C |
| `infoTributaria/ruc` | Obligatorio | `issuer.ruc` | C |
| `infoTributaria/claveAcceso` | Obligatorio al construir el comprobante | Identidad fiscal inmutable asignada después de preparar | I |
| `infoTributaria/codDoc` | Obligatorio | Constante oficial de factura `01` | D |
| `infoTributaria/estab` | Obligatorio | `issuer.establishment_code` | C |
| `infoTributaria/ptoEmi` | Obligatorio | `issuer.emission_point_code`, del punto predeterminado efectivo; su id y versión en `configuration.point` | C |
| `infoTributaria/secuencial` | Obligatorio | Identidad fiscal inmutable, nueve dígitos | I |
| `infoTributaria/dirMatriz` | Obligatorio | `issuer.address` | C |
| `infoTributaria/agenteRetencion` | Condicional | `issuer.tax_profile.withholding_agent_resolution`, de 1 a 8 dígitos y sin ceros a la izquierda (Anexo 21, `NOR-003`); se omite si no aplica | C/NA |
| `infoTributaria/contribuyenteRimpe` | Condicional | `issuer.tax_profile.regime_legend`, derivada del régimen: `CONTRIBUYENTE RÉGIMEN RIMPE` para RIMPE Emprendedor y `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE` para Negocio Popular (Anexo 22, `NOR-002`); se omite en General. **El XSD 2.1.0 solo admite la primera** (`NOR-020`) | C/NA |

La clave, el secuencial y la fecha usada por la clave pertenecen a la identidad posterior. Su
ausencia en una preparación no vuelve incompleta la instantánea; sí impide construir un XML. La
asignación se valida aparte y nunca se deriva de la numeración comercial.

## Información de factura

| Campo XSD 2.1.0 | Condición | Fuente o regla | Estado |
|---|---|---|---|
| `fechaEmision` | Obligatorio | Fecha local de identidad; debe concordar con `reference_date` o exigir nueva revisión | I/D |
| `dirEstablecimiento` | Condicional | `issuer.establishment_address`, dirección del establecimiento de la revisión fiscal; obligatoria desde el formato 4 y conservada aunque coincida con la matriz | C |
| `contribuyenteEspecial` | Condicional | `issuer.tax_profile.special_taxpayer_resolution`, alfanumérico de 3 a 13 (XSD 2.1.0 y ficha 2.34); se omite si no aplica | C/NA |
| `obligadoContabilidad` | Condicional | `issuer.tax_profile.accounting_obligation`, `SI` o `NO` | C |
| `comercioExterior` | Condicional | Operaciones de comercio exterior fuera del alcance | NA |
| `incoTermFactura` | Condicional | Comercio exterior fuera del alcance | NA |
| `lugarIncoTerm` | Condicional | Comercio exterior fuera del alcance | NA |
| `paisOrigen` | Condicional | Comercio exterior fuera del alcance | NA |
| `puertoEmbarque` | Condicional | Comercio exterior fuera del alcance | NA |
| `puertoDestino` | Condicional | Comercio exterior fuera del alcance | NA |
| `paisDestino` | Condicional | Comercio exterior fuera del alcance | NA |
| `paisAdquisicion` | Condicional | Comercio exterior fuera del alcance | NA |
| `tipoIdentificacionComprador` | Obligatorio | `receiver.identification_type` | C |
| `guiaRemision` | Condicional | No existe guía de remisión en el alcance actual | NA |
| `razonSocialComprador` | Obligatorio | `receiver.legal_name`; consumidor final usa su denominación explícita | C |
| `identificacionComprador` | Obligatorio | `receiver.identification` | C |
| `direccionComprador` | Condicional | `receiver.address`, cuando corresponde | C |
| `totalSinImpuestos` | Obligatorio | `totals.base` | C |
| `totalSubsidio` | Condicional | No se gestionan subsidios | NA |
| `incoTermTotalSinImpuestos` | Condicional | Comercio exterior fuera del alcance | NA |
| `totalDescuento` | Obligatorio | `0.00`; el dominio aprobado no crea descuentos fiscales | D |
| `codDocReembolso` | Condicional | Reembolsos fuera del alcance | NA |
| `totalComprobantesReembolso` | Condicional | Reembolsos fuera del alcance | NA |
| `totalBaseImponibleReembolso` | Condicional | Reembolsos fuera del alcance | NA |
| `totalImpuestoReembolso` | Condicional | Reembolsos fuera del alcance | NA |
| `totalConImpuestos/totalImpuesto[*]` | Obligatorio, uno o más | Un registro por `tax_groups[*]` | D |
| `…/codigo` | Obligatorio | `tax_groups[*].tax_code` de catálogo versionado | C |
| `…/codigoPorcentaje` | Obligatorio | `tax_groups[*].percentage_code` | C |
| `…/descuentoAdicional` | Condicional | No aplicable; no se inventan descuentos | NA |
| `…/baseImponible` | Obligatorio | `tax_groups[*].base_amount` | C |
| `…/tarifa` | Condicional en XSD, necesaria para trazabilidad local | `tax_groups[*].tax_rate` | C |
| `…/valor` | Obligatorio | `tax_groups[*].tax_amount` | C |
| `…/valorDevolucionIva` | Condicional | Devolución de IVA fuera del alcance | NA |
| `compensaciones` | Condicional | Compensaciones fuera del alcance | NA |
| `propina` | Condicional | `0.00` solo si el formato objetivo exige presencia; no crea un concepto comercial | D |
| `fleteInternacional` | Condicional | Comercio exterior fuera del alcance | NA |
| `seguroInternacional` | Condicional | Comercio exterior fuera del alcance | NA |
| `gastosAduaneros` | Condicional | Comercio exterior fuera del alcance | NA |
| `gastosTransporteOtros` | Condicional | Comercio exterior fuera del alcance | NA |
| `importeTotal` | Obligatorio | `totals.grand` | C |
| `moneda` | Condicional en XSD | `currency = USD`, representado como la denominación SRI aplicable | C/D |
| `placa` | Condicional | No aplica a un taller: el Anexo 25 la exige solo a operadoras de transporte comercial. Cualquier placa que el usuario quiera consignar va como dato de `additional_info` | NA |
| `pagos/pago[*]` | Condicional en XSD; requerido por la regla local | Un registro por `payments[*]` | C |
| `…/formaPago` | Obligatorio por pago | `payment_code` oficial habilitado para la entidad, con `description`, `display_name` y `catalog_version` del catálogo de la Tabla 24 | C |
| `…/total` | Obligatorio por pago | `amount`; la suma debe cubrir `totals.grand` | C |
| `…/plazo` | Condicional | `payments[*].term_days`, entero de 1 a 9999 días; solo en las formas que cubren el saldo pendiente de una operación a crédito (`DP-035`, regla 2; `NOR-019`). **La ficha dice «cuando corresponda» y no define cuándo** (validación `V-6`) | C/NA |
| `…/unidadTiempo` | Condicional | `payments[*].time_unit`, siempre `dias` y fijado por el sistema; es el único valor que usan los ejemplos de la ficha | D/NA |
| `valorRetIva` | Condicional | Retenciones recibidas fuera del alcance de preparación | NA |
| `valorRetRenta` | Condicional | Retenciones recibidas fuera del alcance de preparación | NA |

## Detalles

| Campo XSD 2.1.0 | Condición | Fuente o regla | Estado |
|---|---|---|---|
| `detalles/detalle[*]` | Uno o más | Un registro por `lines[*]`, conservando posición | C |
| `codigoPrincipal` | Condicional en XSD; requerido localmente | `lines[*].item_code`: código interno conservado del producto o código de servicio conservado; de 1 a 25 caracteres | C |
| `codigoAuxiliar` | Condicional | No se usa mientras no exista un código auxiliar histórico | NA |
| `descripcion` | Obligatorio | `lines[*].description` conservada; de 1 a 300 caracteres | C |
| `unidadMedida` | Condicional | No se declara sin una unidad histórica aprobada | NA |
| `cantidad` | Obligatorio | `lines[*].quantity` | C |
| `precioUnitario` | Obligatorio | `lines[*].unit_price_without_tax`, seis decimales; debe reconstruir la base | D |
| `precioSinSubsidio` | Condicional | No se gestionan subsidios | NA |
| `descuento` | Obligatorio | `0.00`; no se crean descuentos | D |
| `precioTotalSinImpuesto` | Obligatorio | `lines[*].base_amount` | C |
| `detallesAdicionales/detAdicional` | Condicional | `lines[*].service_detail`, una nota de hasta 300 caracteres en una sola línea que nace en el mantenimiento y puede ajustarse en la preparación (`DP-035`, regla 3); el XSD admite hasta tres por línea y Tallkit usa uno | C/NA |
| `impuestos/impuesto[*]/codigo` | Obligatorio | `lines[*].tax_code` | C |
| `…/codigoPorcentaje` | Obligatorio | `lines[*].percentage_code` | C |
| `…/tarifa` | Obligatorio | `lines[*].tax_rate` | C |
| `…/baseImponible` | Obligatorio | `lines[*].base_amount` | C |
| `…/valor` | Obligatorio | `lines[*].tax_amount` | C |

La instantánea conserva cadenas decimales y comprueba que base más impuesto reproduce cada total,
que el precio unitario a seis decimales reconstruye la base y que detalles, grupos y total general
coinciden. Una diferencia no genera una línea de ajuste.

## Bloques condicionales restantes

| Bloque XSD 2.1.0 | Aplicación actual | Tratamiento |
|---|---|---|
| `reembolsos` y sus impuestos/compensaciones | No se gestionan reembolsos por cuenta de terceros | NA; bloquear un caso que los requiera |
| `retenciones` | No forma parte de factura ordinaria del taller | NA |
| `infoSustitutivaGuiaRemision` y `destinos` | No se sustituye guía de remisión | NA |
| `otrosRubrosTerceros/rubro` | No se gestionan rubros de terceros | NA |
| `tipoNegociable/correo` | Factura negociable fuera del alcance | NA |
| `maquinaFiscal` | No se usa máquina fiscal | NA |
| `infoAdicional/campoAdicional[*]` | `additional_info`: hasta 12 pares de nombre y valor de 1 a 300 caracteres, validados y sin repetir; el XSD admite 15 y los 3 restantes quedan para los que agrega el sistema (`NOR-021`) | C |
| `infoAdicional/campoAdicional[@nombre="Gran Contribuyente"]` | `issuer.tax_profile.large_taxpayer_resolution`, solo si la entidad lo declara (Anexo 24, `NOR-003`); el nombre está reservado y la emisión lo escribe | C/NA |
| `infoAdicional/campoAdicional[@nombre="RUC Proveedor"]` | No se conserva en la instantánea: lo agrega la emisión con el RUC del proveedor (Anexo 26, `NOR-004`); su nombre está reservado. La comprobación pasa al cambio 4 | NA |
| `ds:Signature` | Firma XAdES/XMLDSig | F; no se almacena certificado privado ni se firma en esta fase |
| Envoltorio `autorizacion` | Respuesta externa posterior | F; el archivo solo conserva su declaración como evidencia no verificada |

## Formato 2 de la instantánea

Desde `simplificar-flujo-fiscal-y-configuracion-centralizada`, las preparaciones nuevas conservan `snapshot_format: 2`:

| Clave | Contenido |
|---|---|
| `configuration.entity_id`, `entity_version` | Entidad emisora y versión usadas |
| `configuration.profile_revision` | Revisión del perfil tributario declarado |
| `configuration.defaults_version` | Versión de los valores predeterminados (punto y forma de pago) |
| `configuration.establishment`, `configuration.point` | Id, código y versión del establecimiento y del punto efectivos |
| `configuration.environment` | Siempre `1` (pruebas) |
| `configuration.catalogs` | Versiones de catálogo usadas (`iva`, `payment_forms`) |
| `configuration.tax_mapping_ids`, `enabled_payment_codes` | Correspondencias y formas habilitadas vigentes al preparar |
| `lines[*].catalog_entry_id`, `lines[*].display_name` | Entrada oficial y nombre comprensible de cada tarifa |
| `payments[*].description`, `display_name`, `catalog_version` | Forma de pago tal como figuraba en el catálogo |

Las claves de `issuer` se mantienen sin cambios, porque las consume la identidad de ensayo. Una instantánea sin `snapshot_format` es de formato 1 y se muestra sin completar las referencias que no conservaba. La fecha de referencia se fija en la revisión final con el calendario de America/Guayaquil.

## Formato 3 de la instantánea

Desde `estructurar-perfil-del-emisor-y-codigos-fiscales`, las preparaciones nuevas conservan `snapshot_format: 3`. Respecto del formato 2:

| Clave | Contenido |
|---|---|
| `issuer.tax_profile.regime` | `GENERAL`, `RIMPE_EMPRENDEDOR` o `RIMPE_NEGOCIO_POPULAR` (este último exige líneas a IVA 0 % y su leyenda está por confirmar). Obligatorio |
| `issuer.tax_profile.regime_legend` | Solo para RIMPE Emprendedor; derivada, nunca escrita |
| `issuer.tax_profile.accounting_obligation` | `SI` o `NO`. Obligatorio |
| `issuer.tax_profile.withholding_agent_resolution` | Solo si el emisor es agente de retención |
| `issuer.tax_profile.special_taxpayer_resolution` | Solo si el emisor es contribuyente especial |
| `issuer.tax_profile.artisan_qualification` | `number`, `issuing_body` y `ends_on`, solo si hay calificación declarada |
| `legends` | Siempre vacía: las condiciones del emisor ya no se conservan como texto `clave: valor` |

Una condición que no aplica se omite; nunca se representa con un texto, un cero ni un valor vacío. Las preparaciones de formato 1 y 2 no se migran: se leen tal como se conservaron, con sus `legends`, y no reciben `tax_profile`.

### Límites de longitud verificados

La preparación comprueba antes de completarse los límites del XSD 2.1.0 y bloquea con un impedimento que muestra la longitud observada y la admitida; nunca recorta ni sustituye el valor.

| Campo XSD | Límite | Origen del dato |
|---|---|---|
| `codigoPrincipal` | 25 caracteres, una sola línea | Código interno del producto (editable solo hasta 25) o código de servicio `SRV-######` |
| `descripcion` | 300 caracteres, una sola línea | Nombre del producto o del servicio conservado |
| `agenteRetencion` | 8 dígitos | Resolución declarada en el perfil |
| `contribuyenteEspecial` | 13 caracteres alfanuméricos | Resolución declarada en el perfil |
| `obligadoContabilidad` | `SI` o `NO` | Perfil |

### Negocio Popular y cambio de régimen

Con régimen `RIMPE_NEGOCIO_POPULAR` toda línea debe resolver a IVA 0 % (impedimento `line[n].popular_rate`). El cambio de régimen o de tarifa se programa a futuro con tres piezas independientes: una revisión nueva del perfil, la tarifa interna sucesora y la correspondencia sucesora con el SRI (`POST /fiscal/configuration/tax-mappings/{id}/successor/`). Cada instantánea conserva el régimen, la leyenda y la tarifa con que se preparó.

### Coherencia con la calificación artesanal

Si el emisor declara una calificación artesanal vigente en la fecha de referencia, toda línea debe resolver a la entrada IVA 0 % del catálogo (tratamiento `ZERO`; no objeto y exento no cuentan). Es una comprobación local que no acredita el beneficio legal.

## Formato 4 de la instantánea

Desde `alinear-datos-del-comprobante-con-sri`, las preparaciones nuevas conservan `snapshot_format: 4`. Respecto del formato 3:

| Clave | Contenido |
|---|---|
| `issuer.trade_name` | Nombre comercial, solo si fue declarado |
| `issuer.establishment_address` | Dirección del establecimiento de la emisión. Obligatoria |
| `issuer.tax_profile.regime_legend` | También para RIMPE Negocio Popular |
| `issuer.tax_profile.large_taxpayer_resolution` | Solo si la entidad es gran contribuyente |
| `payments[*].term_days`, `payments[*].time_unit` | Solo en las formas que cubren el saldo pendiente de una operación a crédito; la unidad es `dias` |
| `lines[*].service_detail` | Nota de la línea de servicio, solo si hay texto |
| `additional_info[*]` | Pares `{name, value}` validados |

Un dato que no aplica se omite; nunca se representa con un texto, un cero ni un valor vacío. El correo del receptor ya existía en `receiver.email`: lo que cambia es que se exige al completar la preparación de un receptor identificado. Las preparaciones de los formatos 1 a 3 no se migran y se leen tal como se conservaron.

### Nuevos límites verificados

| Campo XSD | Límite | Origen del dato |
|---|---|---|
| `plazo` | Entero de 1 a 9999 días | Plazo declarado al preparar |
| `unidadTiempo` | `dias` | Fijado por el sistema |
| `campoAdicional` (nombre y valor) | De 1 a 300 caracteres en una sola línea, hasta 12 pares | Detalle adicional |
| `detAdicional` (valor) | Hasta 300 caracteres en una sola línea | Nota de la línea de servicio |
| `contribuyenteEspecial` | De 3 a 13 caracteres alfanuméricos | Perfil |
| `agenteRetencion` | Hasta 8 dígitos sin ceros a la izquierda | Perfil |

## Resultado de suficiencia

La instantánea cubre los campos obligatorios de una factura ordinaria 2.1.0 mediante conservación,
derivación determinista o identidad posterior explícita. Los bloques condicionales marcados **NA**
no pueden activarse por omisión o por valores ficticios. La incorporación de `item_code` y
`description` en cada línea cierra la brecha encontrada al contrastar la implementación con el
XSD: ambos son necesarios para representar `codigoPrincipal` y `descripcion` sin consultar
maestros actuales. Firma, transmisión, consulta al SRI y autorización quedan fuera del alcance de esta
matriz, que solo compara campos del comprobante; `DP-034` las incorpora a V1 mediante otros cambios.
