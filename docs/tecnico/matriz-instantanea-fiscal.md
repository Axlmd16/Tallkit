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
| `infoTributaria/nombreComercial` | Condicional | `issuer.trade_name`, solo cuando fue declarado | C |
| `infoTributaria/ruc` | Obligatorio | `issuer.ruc` | C |
| `infoTributaria/claveAcceso` | Obligatorio al construir el comprobante | Identidad fiscal inmutable asignada después de preparar | I |
| `infoTributaria/codDoc` | Obligatorio | Constante oficial de factura `01` | D |
| `infoTributaria/estab` | Obligatorio | `issuer.establishment_code` | C |
| `infoTributaria/ptoEmi` | Obligatorio | `issuer.emission_point_code`, del punto predeterminado efectivo; su id y versión en `configuration.point` | C |
| `infoTributaria/secuencial` | Obligatorio | Identidad fiscal inmutable, nueve dígitos | I |
| `infoTributaria/dirMatriz` | Obligatorio | `issuer.address` | C |
| `infoTributaria/agenteRetencion` | Condicional | Condición tributaria versionada; se omite si no aplica | C/NA |
| `infoTributaria/contribuyenteRimpe` | Condicional | Leyenda tributaria versionada aplicable | C/NA |

La clave, el secuencial y la fecha usada por la clave pertenecen a la identidad posterior. Su
ausencia en una preparación no vuelve incompleta la instantánea; sí impide construir un XML. La
asignación se valida aparte y nunca se deriva de la numeración comercial.

## Información de factura

| Campo XSD 2.1.0 | Condición | Fuente o regla | Estado |
|---|---|---|---|
| `fechaEmision` | Obligatorio | Fecha local de identidad; debe concordar con `reference_date` o exigir nueva revisión | I/D |
| `dirEstablecimiento` | Condicional | Dirección del establecimiento de la revisión fiscal; si difiere de matriz debe conservarse antes de preparar | C |
| `contribuyenteEspecial` | Condicional | Condición tributaria versionada aplicable | C/NA |
| `obligadoContabilidad` | Condicional | Condición tributaria versionada aplicable | C/NA |
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
| `placa` | Condicional | `additional_info` solo si fue pertinente y revisada; no se toma del maestro vigente | C/NA |
| `pagos/pago[*]` | Condicional en XSD; requerido por la regla local | Un registro por `payments[*]` | C |
| `…/formaPago` | Obligatorio por pago | `payment_code` oficial habilitado para la entidad, con `description`, `display_name` y `catalog_version` del catálogo de la Tabla 24 | C |
| `…/total` | Obligatorio por pago | `amount`; la suma debe cubrir `totals.grand` | C |
| `…/plazo` | Condicional | No se captura en la preparación local (formato 2); su representación para la emisión queda pendiente de una spec futura | NA |
| `…/unidadTiempo` | Condicional | No se captura junto con el plazo (formato 2) | NA |
| `valorRetIva` | Condicional | Retenciones recibidas fuera del alcance de preparación | NA |
| `valorRetRenta` | Condicional | Retenciones recibidas fuera del alcance de preparación | NA |

## Detalles

| Campo XSD 2.1.0 | Condición | Fuente o regla | Estado |
|---|---|---|---|
| `detalles/detalle[*]` | Uno o más | Un registro por `lines[*]`, conservando posición | C |
| `codigoPrincipal` | Condicional en XSD; requerido localmente | `lines[*].item_code` del snapshot del producto o servicio | C |
| `codigoAuxiliar` | Condicional | No se usa mientras no exista un código auxiliar histórico | NA |
| `descripcion` | Obligatorio | `lines[*].description` conservada | C |
| `unidadMedida` | Condicional | No se declara sin una unidad histórica aprobada | NA |
| `cantidad` | Obligatorio | `lines[*].quantity` | C |
| `precioUnitario` | Obligatorio | `lines[*].unit_price_without_tax`, seis decimales; debe reconstruir la base | D |
| `precioSinSubsidio` | Condicional | No se gestionan subsidios | NA |
| `descuento` | Obligatorio | `0.00`; no se crean descuentos | D |
| `precioTotalSinImpuesto` | Obligatorio | `lines[*].base_amount` | C |
| `detallesAdicionales/detAdicional` | Condicional | Solo datos fiscales pertinentes conservados en `additional_info` | C/NA |
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
| `infoAdicional/campoAdicional[*]` | `additional_info` y leyendas pertinentes, con nombre/valor conservados | C |
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

## Resultado de suficiencia

La instantánea cubre los campos obligatorios de una factura ordinaria 2.1.0 mediante conservación,
derivación determinista o identidad posterior explícita. Los bloques condicionales marcados **NA**
no pueden activarse por omisión o por valores ficticios. La incorporación de `item_code` y
`description` en cada línea cierra la brecha encontrada al contrastar la implementación con el
XSD: ambos son necesarios para representar `codigoPrincipal` y `descripcion` sin consultar
maestros actuales. Firma, transmisión, consulta al SRI y autorización continúan fuera de alcance.
