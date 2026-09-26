## Why

Sys-Taller ya gestiona operaciones comerciales y artesanales, pero sus **documentos internos** no contienen toda la información ni el ciclo necesarios para la futura **facturación electrónica**. Se necesita preparar una capacidad fiscal propia, basada en las reglas del **SRI**, que permita incorporar después un emisor externo o directo sin reconstruir ventas, servicios ni historia.

Estado: propuesta pendiente de aprobación; no autoriza implementación ni emisión real. Fecha: 2026-09-25.

## What Changes

El objetivo de esta entrega es completar la preparación y trazabilidad fiscal local. No se declara cumplimiento integral para facturar en producción: la firma, transmisión, autorización y entrega efectiva se abordarán posteriormente.

1. **Perfil del emisor.** Completar por **entidad fiscal** la identidad y direcciones, régimen y condiciones tributarias aplicables, obligación contable, calificación artesanal o designaciones cuando correspondan; establecimientos y puntos de emisión de tres dígitos, ambiente y antecedentes del certificado. Diferenciar datos capturados de datos efectivamente comprobados. Un perfil incompleto impide declarar preparada una operación fiscal, sin inventar RUC, régimen o tarifas para completarlo.
2. **Numeración e identidad fiscal.** Preparar un **secuencial** de nueve dígitos por emisor, tipo de comprobante, establecimiento y punto, con separación entre pruebas y producción, y generación/validación de claves de acceso de 49 dígitos. Los borradores no consumen números; los reintentos no duplican identidad. Esta fase permite comprobar el comportamiento en pruebas, pero no asignar nuevas identidades productivas para acumular documentos sin transmitir. Los números existentes del facturador del maestro se conservan como antecedentes, sin reiniciar una serie usada ni incrementar contadores al importar un archivo.
3. **Catálogos tributarios.** Relacionar las definiciones internas con códigos oficiales, vigencias y tratamientos distintos, incluidos tarifa cero, exento y no objeto. Mapear la **forma de pago** fiscal sin convertir **crédito** en un medio de cobro ni inventar un pago realizado. Comprobar la representación fiscal de cantidades, precios sin impuesto, bases, tributos y totales sin cambiar silenciosamente los importes comerciales históricos.
4. **Receptor fiscal.** Validar los datos exigibles según identificación y documento, sin aplicar un algoritmo universal de RUC. Separar el receptor del comprobante de la ficha operativa de **cliente**: consumidor final no crea un cliente ficticio, no sustituye al propietario del vehículo y no elimina la identidad de la operación. Su elegibilidad y restricciones se evalúan antes de preparar el documento; no se presume que sea obligatorio utilizarlo. Datos ausentes o inconsistentes se muestran como impedimentos corregibles.
5. **Historia y archivo.** Conservar una instantánea fiscal completa de emisor, receptor, líneas, tributos, condiciones y origen, independiente de futuras ediciones. Preparar un archivo propio de XML y evidencias, con acceso autorizado, integridad, exportación y conservación mínima de siete años para los comprobantes que corresponda archivar, sin eliminación automática al alcanzar ese plazo. Un enlace de un proveedor no sustituye el archivo. Incorporar un XML externo no demuestra por sí solo autenticidad ni estado vigente ante el SRI.
6. **Preparación y estados.** Mantener independientes la operación, el **estado de pago** y la situación fiscal. Registrar una intención de emisión identificable y durable, con **idempotencia**, historial y cancelación local distinguible de una anulación fiscal. Sin conexión habilitada no se envía ni se marca autorizado un documento. El futuro procesamiento externo no debe mantener bloqueadas las operaciones comerciales mientras espera respuestas de red.
7. **Correcciones fiscales.** Preparar solicitudes locales de anulación y de nota de crédito, con motivo, original y vínculo con la corrección comercial cuando exista. Distinguir borrador, solicitud y resultado oficial. Cancelar una preparación no anula una factura; una **devolución** o un **reembolso** tampoco equivalen a una nota de crédito. Esta capacidad no altera por sí sola stock, deuda ni pagos.

La configuración, preparación, consulta y archivo tendrán controles de permiso y auditoría por acción y ámbito. La capacidad fiscal conserva sus propios conceptos y resultados; nombres de campos, estados, identificadores o errores de un proveedor no se convierten en reglas del negocio. No se escoge ni contrata proveedor.

### Decisiones confirmadas y recomendaciones para aprobación

**Confirmado por el usuario:** independencia de FactuPlan, AutorizadorEC, Invoca o cualquier otro proveedor; ninguna integración externa en esta fase; cobertura de los siete bloques anteriores. Se preservan dos RUC independientes, documentos internos, estados económicos e historia aprobada (`DP-006/008/017/018/025/027/029`, `CT-001`).

Las siguientes recomendaciones concretan límites todavía no aprobados; deben resolverse al aprobar esta propuesta, antes de crear specs:

| ID | Recomendación | Consecuencia y alternativa |
|---|---|---|
| P1 | Administrador configura emisores, catálogos fiscales, antecedentes de numeración, certificados y archivo. Administrador/Vendedor preparan y consultan documentos comerciales; Administrador/Encargado del taller, artesanales. Las solicitudes de corrección fiscal quedan reservadas al Administrador. | Reutiliza los tres roles y su separación; no amplía la consulta limitada de ventas vinculadas del Encargado ni crea rol Contador. |
| P2 | Preparación fiscal explícita desde una operación confirmada, sin crear automáticamente intenciones para el historial ni bloquear confirmaciones internas por la falta de configuración fiscal adicional. Máximo una preparación activa de factura por operación, con reemplazos trazables. | Evita duplicar lo emitido fuera del sistema. El disparador de emisión real y su oportunidad legal deberán aprobarse al integrar; esta decisión no autoriza retrasar obligaciones fiscales actuales. La facturación parcial o agrupada queda fuera. |
| P3 | Registrar datos y vigencia del certificado; aplazar almacenamiento del archivo privado, contraseña y firma criptográfica. | Permite completar el perfil sin decidir aún quién firma. Custodiar y usar la clave privada localmente exige ampliar expresamente el alcance y resolver seguridad y operación. |
| P4 | Mantener en Sys-Taller el control previsto de identidad y numeración, ensayable sin consumir numeración productiva. | El proveedor futuro deberá respetar ese contrato o requerirá una revisión explícita de la decisión. No se admiten dos asignadores autónomos ni se garantiza compatibilidad con cualquier API. |
| P5 | Incluir incorporación manual de XML existentes como archivo y evidencia suministrada, con validación de estructura, emisor, ambiente, identidad, duplicados y coherencia al vincular a una operación. Conservar procedencia y condición de no verificado ante el SRI. | Da utilidad al archivo mientras el maestro utiliza su facturador actual. No crea ventas, pagos, secuencias ni autorizaciones nuevas; tampoco permite marcar una solicitud local como oficialmente ejecutada por una simple carga. La alternativa es posponer toda incorporación hasta la integración, dejando el archivo sin uso productivo en esta entrega. |

### Fuera de alcance

- Consumir APIs de proveedores o servicios del SRI, consultar datos tributarios en línea, enviar documentos, recibir notificaciones externas o ejecutar anulaciones oficiales.
- Generar y firmar nuevos XML para emisión real, generar RIDE fiscales nuevos o enviar comprobantes por correo. La generación completa de XML y su validación XSD para emisión se definirá con el mecanismo de emisión; no se presupone que deba hacerla el proveedor ni que deba hacerla Sys-Taller.
- Cargar o custodiar claves privadas y contraseñas, conforme a P3; registrar metadatos no acredita vigencia criptográfica comprobada.
- Emitir en producción, presentar pruebas o preparaciones como autorizaciones, o usar esta fase como permiso para acumular facturas reales sin transmitir.
- Elegir las obligaciones del futuro RUC comercial o certificar el beneficio artesanal. La etiqueta interna ARTESANAL no determina por sí sola una tarifa legal.
- Implementar todos los tipos documentales del SRI: se prepara factura y correcciones asociadas; retenciones, guías, liquidaciones y notas de débito requieren alcance propio según necesidad real.
- Rediseñar devoluciones, cobros, inventario, contabilidad, declaraciones, reportes o implementar íntegramente el módulo general de respaldos. Sí se exige resolver conservación y recuperación del archivo fiscal que se incorpore.
- Cambiar `COM-VEN`/`ART-SER`, recalcular operaciones confirmadas, facturar retroactivamente el historial, emitir facturas agrupadas o parciales, o generar documentos entre RUC como consecuencia automática de una misma orden.

## Capabilities

### New Capabilities

- `identidad-y-numeracion-fiscal`: ámbitos de numeración, antecedentes, claves, separación de ambientes y restricciones de uso en esta fase.
- `preparacion-y-seguimiento-fiscal`: datos del receptor, instantánea, coherencia económica, intención durable, estados locales, permisos, auditoría e independencia de proveedores.
- `archivo-de-comprobantes-fiscales`: incorporación manual propuesta en P5, evidencia, integridad, consulta, exportación, conservación y recuperación, sin atribuir verificación oficial inexistente.
- `solicitudes-de-correccion-fiscal`: solicitudes locales y referencias al original, restricciones aplicables y separación de efectos comerciales y resultados oficiales.

### Modified Capabilities

- `configuracion-operativa-y-fiscal`: ampliar perfiles, establecimientos/puntos/ambientes, metadatos de certificado y correspondencia con catálogos SRI, preservando configuración y numeración internas.
- `ventas-comerciales`: acceso autorizado desde la venta a su preparación y situación fiscal, sin cambiar confirmación, cobro, historia ni naturaleza del comprobante interno.
- `operacion-artesanal-de-servicios`: acceso equivalente desde la operación artesanal, conservación de su historia y separación del documento fiscal.

La identificación fiscal adicional pertenece a la preparación: esta propuesta no amplía silenciosamente los tipos de identificación ni cambia los obligatorios del registro general de clientes de `DP-008`. Si las specs necesitan hacerlo, deberá revisarse este alcance.

## Impact

**Reutilización:** configuración por entidad y vigencia en `backend/src/workshop_configuration/`; clientes de `backend/src/customer_registry/`; operaciones y snapshots de `backend/src/sales/` y `backend/src/workshop/`; reglas monetarias puras de `backend/src/shared/money.py`; autorización, auditoría e idempotencia existentes. Decimal y snapshots actuales son una base, no una certificación fiscal.

**Modificación:** extensión de la configuración y consultas comerciales/artesanales, contratos internos y OpenAPI, y pantallas de configuración, preparación y archivo. Backend valida permisos e invariantes. Frontend distingue preparación, evidencia aportada y hechos oficiales; nunca deduce autorización de una carga o un número. Los contratos futuros de integración se definirán desde el sistema, sin copiar una API comercial.

**Sustitución:** ninguna plataforma, motor monetario, documento interno ni módulo comercial. El **monolito modular** y las escrituras por servicios conservan sus fronteras. Datos fiscales y archivo requerirán un diseño y plan de migración posteriores, sin crear ahora modelos ni tablas, sin completar registros existentes con valores fiscales ficticios y sin introducir dependencias sin uso aprobado.

**Operación y seguridad:** permisos por RUC, protección de datos personales y archivos, tratamiento seguro de XML, registro de cambios sin secretos y recuperación conjunta de archivo y referencias. Si se aprueba P5, su uso productivo exige copias y una restauración comprobada; un campo de retención no garantiza siete años de disponibilidad.

**Documentación:** actualizar en las fases correspondientes decisiones y alcance de la preparación fiscal, modelo conceptual, producto, requisitos, casos de uso, trazabilidad y glosarios. El diseño deberá justificar un ADR sobre la independencia fiscal e integraciones futuras, complementando ADR-0001/0004/0006/0008 sin adelantarlo aquí.

### Dependencias, contradicciones y asuntos pendientes

- El maestro ya emite al 0 % en el facturador del SRI según el usuario; faltan comprobación de perfil/calificación, certificado y antecedentes de serie. El RUC comercial todavía no existe. No se convierten esos testimonios en datos verificados ni se exige inventarlos para desarrollar con datos de prueba.
- `DP-018` y el alcance V1 excluyen emisión real. Se propone habilitar preparación fiscal manteniendo esa exclusión; la independencia entre operación, pago y referencia fiscal se conserva. Aprobar esta propuesta no aprueba el conector futuro.
- El modelo conceptual conserva DM-001 y redondeo como asuntos abiertos, pero `DP-025/029` ya concretan el comportamiento interno. Prevalecen las decisiones posteriores; la compatibilidad fiscal de los cálculos debe comprobarse y cualquier incompatibilidad material exige decisión, no ajuste silencioso.
- Las frases de AGENTS/configuración que describen un dominio aún no implementado están desactualizadas frente al código y las specs. Esta propuesta reutiliza el dominio real y no reconstruye sus capacidades.
- La conservación fiscal toca `DA-003`, todavía abierta. Se acota al archivo y sus referencias; el resto de la instalación y respaldo general no queda resuelto por esta entrega.
- Antes de specs se deben aprobar P1…P5, precisar los datos/códigos oficiales admitidos y las reglas fiscales verificables sin conexión. El régimen comercial, las tarifas reales, el tratamiento de retenciones recibidas y la oportunidad de emisión real quedan pendientes de validación del responsable tributario antes de habilitar emisión; no se sustituyen por suposiciones.
- La investigación detectó discrepancias oficiales sobre un transitorio de registro de proveedores de 2026. No se fija aquí su vencimiento ni una exención para software propio; su alcance se verificará antes de integrar o comercializar la solución.

### Trazabilidad y fuentes consultadas

Fuentes internas leídas durante la definición de este cambio y su investigación previa:

- `AGENTS.md`, `openspec/config.yaml`, `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`: precedencia, separación por RUC, `CT-001`, `DP-006/008/017/018/025/027/029` y `DA-003`.
- `docs/negocio/producto/alcance-v1.md`, `reglas-negocio.md` y `glosario.md`: `RN-FIS-001…010`, `RN-CLI-003`, `RN-SEG-001…007`, `RN-CON-001/002/003/007/009/010`.
- `docs/negocio/requisitos/requisitos-funcionales.md`, `requisitos-no-funcionales.md` y `casos-de-uso.md`: `RF-ACC-010…014`, `RF-VEN-015`, `RF-TAL-008`, `RF-AUD-001…006`, `RNF-INT-001/003/004/006/008/009`, `RNF-DIS-002…006`, `CU-003/012/014/015`.
- Specs principales `configuracion-operativa-y-fiscal`, `gestion-de-clientes`, `ventas-comerciales`, `operacion-artesanal-de-servicios` y `correcciones-de-ventas-y-reembolsos`; arquitectura inicial y ADR-0001/0004/0006/0008; modelos y servicios de las áreas enumeradas en Impact. Los glosarios de producto y técnico aportan la terminología existente.

Base externa de la investigación del 24–25 de septiembre de 2026, a concretar por requisito en specs, sin convertir información comercial de proveedores en norma:

- [SRI: facturación electrónica, ficha técnica 2.34 y esquemas oficiales](https://www.sri.gob.ec/facturacion-electronica): datos, ambientes, identificación, XML, numeración y clave.
- [SRI: conservación de comprobantes](https://www.sri.gob.ec/detalle-noticias?idnoticia=1021&marquesina=1) y [transmisión inmediata](https://www.sri.gob.ec/detalle-noticias?idnoticia=1240&marquesina=1).
- [Resolución 25-14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf) y [reforma 25-17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf): correcciones y distinción entre solicitud y efecto oficial.
- [SRI: regímenes RIMPE](https://www.sri.gob.ec/rimpe), [comunicado sobre registro de proveedores](https://www.sri.gob.ec/detalle-noticias?idnoticia=1318&marquesina=1) y [Reglamento de protección de datos](https://spdp.gob.ec/wp-content/uploads/2024/12/04.pdf.pdf): obligaciones condicionadas al perfil y futura integración.

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
