# Matriz de normas de la facturación electrónica

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Versión del documento | 0.1 |
| Estado | Creada por el cambio `incorporar-facturacion-electronica-en-v1`; filas pendientes por verificar |
| Fecha de consulta | 2026-11-01 |
| Decisión que la origina | `DP-034` |

> Esta matriz resume normas para orientar el trabajo. **No certifica el cumplimiento legal ni tributario de Tallkit** y no habilita por sí sola ninguna emisión: cada RUC se activa según [`DP-034`](../decisiones/decisiones-confirmadas.yaml) y sus condiciones. Lo legal y lo tributario se confirman con la norma oficial, un contador o un abogado.

## 1. Cómo usar esta matriz

- Cada fila tiene un identificador estable `NOR-NNN`. Los cambios de emisión citan la fila en la que se apoyan. Una fila sustituida conserva su identificador.
- Una exigencia que no esté **Verificada** no puede pasar a requisito, diseño o código como si estuviera confirmada. Un cambio que dependa de una fila pendiente registra la dependencia y se detiene hasta verificarla o hasta que el titular decida cómo proceder.
- Si el SRI publica una versión nueva de la ficha técnica, se agrega una fila Pendiente sin borrar la anterior.

| Estado | Significado |
|---|---|
| **Verificada** | Se leyó el texto oficial. Una fuente secundaria nunca basta. |
| **Pendiente** | El texto oficial no se ha leído, o las fuentes oficiales se contradicen. Indica qué falta. |
| **Requiere validación externa** | Se leyó el texto, pero aplicarlo al taller depende de un contador, un abogado o una consulta al SRI. |

## 2. Cómo se leyeron las fuentes

Los documentos se descargaron del sitio del SRI el 2026-11-01. La ficha técnica y las resoluciones `NAC-DGERCGC25-00000014` y `NAC-DGERCGC25-00000017` tenían texto y se leyeron completas, salvo los apartados de la ficha que cada fila indica. La resolución `NAC-DGERCGC18-00000233` es una imagen escaneada del **texto original del 17-05-2018**, sin las reformas incorporadas: se leyó por reconocimiento óptico de caracteres, que puede alterar tildes o palabras sueltas, por lo que una cita textual debe contrastarse con el PDF. Las reformas que se conocen son las que hace `NAC-DGERCGC25-00000014`; no se han buscado otras. La ficha tiene 142 páginas y no se leyó entera: cada fila nombra el apartado que respalda.

## 3. Matriz

| ID | Norma o documento | Tema | Qué exige | Fuente | Cambio | Estado |
|---|---|---|---|---|---|---|
| NOR-001 | Ficha técnica de comprobantes electrónicos, esquema offline, v2.34 (27-07-2026), apartados 4 y 7 | Ficha técnica | El comprobante se genera, se firma y se envía al SRI, que responde *en procesamiento*, *autorizado* o *no autorizado* en un máximo de 24 horas. Un comprobante en procesamiento no se reenvía ni se vuelve a emitir con otra clave de acceso o secuencial hasta recibir respuesta. Uno no autorizado se corrige y se reenvía. Cada comprobante debe enviarse al receptor por correo electrónico. | [Ficha 2.34](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%cc%81CNICA%20COMPROBANTES%20ELECTRO%cc%81NICOS%20ESQUEMA%20OFFLINE%20Versio%cc%81n%202.34.pdf) | 2, 3 | Verificada |
| NOR-002 | Ficha 2.34, Anexo 22 | Leyendas del emisor: RIMPE | Los comprobantes de un contribuyente RIMPE llevan la leyenda `CONTRIBUYENTE RÉGIMEN RIMPE` o, para Negocio Popular, `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE`. Con esto queda confirmado el texto de la leyenda de Negocio Popular que `DP-031` dejó por confirmar. | Ficha 2.34 | 2 | Verificada |
| NOR-003 | Ficha 2.34, Anexos 21 y 24 | Leyendas del emisor: agente de retención y gran contribuyente | El agente de retención lleva la leyenda `Agente de Retención` y el gran contribuyente lleva `Gran Contribuyente` con el número de su resolución. Son condiciones del emisor, no de la operación. | Ficha 2.34 | 2 | Verificada |
| NOR-004 | Ficha 2.34, Anexo 26 | `RUC Proveedor` | Un emisor que usa un sistema de facturación de terceros incluye en la información adicional de cada comprobante un campo llamado `RUC Proveedor` (texto, hasta 300 caracteres) con el RUC del proveedor. | Ficha 2.34 | 2, 4 | Verificada |
| NOR-005 | Resolución `NAC-DGERCGC26-00000027` | Registro de proveedores y plazo del `RUC Proveedor` | Crea el registro de proveedores de sistemas o servicios de facturación electrónica. Los proveedores registran en su RUC un establecimiento y una actividad exclusivos, y el emisor incluye el `RUC Proveedor` en un plazo contado desde la publicación. **Las fuentes oficiales se contradicen:** el Boletín 042 dice 60 días hábiles y la ficha 2.34 dice 60 días calendario. Con publicación el 28-07-2026 (dato de una fuente secundaria), ambos cómputos terminan antes del 2026-11-01. No se leyó el texto de la resolución. | [Boletín 042 del SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/86f1f377-1ea4-4ecf-9f80-03bb8209c358/BOLETI%CC%81N%20042%20-%20PROVEEDORES%20DE%20SISTEMAS%20DE%20FACTURACI%C3%93N%20ELECTR%C3%93NICA%20DEBER%C3%81N%20REGISTRARSE%20ANTE%20EL%20SRI.pdf) y ficha 2.34. Falta el texto de la resolución y su fecha de publicación en el Registro Oficial. | 4 | Pendiente |
| NOR-006 | Resolución `NAC-DGERCGC26-00000027` | ¿Debe registrarse el desarrollador de Tallkit? | Falta saber si ceder Tallkit a un solo taller convierte a su desarrollador en proveedor de sistemas, y qué RUC va en `RUC Proveedor` cuando Tallkit usa a su vez un proveedor de emisión. Ver V-2. | Boletín 042 y ficha 2.34 | 4 | Requiere validación externa |
| NOR-007 | Resolución `NAC-DGERCGC18-00000233`, arts. 3 y 4 | Autorización de emisión, puntos y firma | El contribuyente solicita al SRI, por cada RUC, autorización para emitir en ambiente de pruebas y luego en producción; solo los de producción tienen validez tributaria. Los puntos de emisión de esta modalidad son exclusivos. El comprobante lo firma únicamente el emisor, que debe mantener vigente su certificado. Se leyó el texto original de 2018; faltan sus reformas posteriores. | [Resolución](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/32be159b-8d66-47ad-86da-4d674321da7a/NAC-DGERCGC18-00000233.pdf) (original de 2018, leída por OCR) | 3, 4 | Pendiente |
| NOR-008 | Resolución `NAC-DGERCGC18-00000233`, arts. 7, 8 y 9 | Momento de transmisión, fuerza mayor y rectificación | El emisor transmite el comprobante al SRI «en el momento mismo de realizarse la transacción». Solo quien emite de forma masiva puede agruparlos dentro de 24 horas. Si por fuerza mayor no puede generar el comprobante electrónico, puede emitir uno bajo otra forma. Un comprobante rechazado se rectifica y se retransmite en 24 horas. Se leyó el texto original de 2018. `NAC-DGERCGC25-00000014` eliminó del primer inciso del art. 7 la frase «o hasta dentro de un máximo de cuatro días hábiles de haberse generado el mismo», con efecto desde el 01-01-2026 según `NAC-DGERCGC25-00000017`; otras reformas no se han consultado. **Esto tensiona la regla 6 de `DP-034`** (el comprobante espera en Tallkit sin Internet) y deja sin respuesta qué fecha lleva un comprobante generado después. Ver V-1. | Resolución `NAC-DGERCGC18-00000233` (leída por OCR) y `NAC-DGERCGC25-00000014` | 3 | Requiere validación externa |
| NOR-009 | Resolución `NAC-DGERCGC18-00000233`, arts. 5 y 6; ficha 2.34, apartado 4.7 | Entrega al comprador | El emisor necesita el consentimiento del comprador y entrega enviando el XML y el RIDE al correo del comprador. Solo imprime y entrega el RIDE si no puede enviarlos, si no identificó al comprador o si este lo pide. Si solo llega uno de los dos archivos, se considera no entregado. Transmitir al SRI no sustituye la entrega. `NAC-DGERCGC25-00000014` agregó al art. 5 la obligación de informar al receptor cualquier modificación del estado del comprobante. Se leyó el texto original de 2018; faltan otras reformas. | Resolución (original de 2018, leída por OCR), `NAC-DGERCGC25-00000014` y ficha 2.34 | 5 | Pendiente |
| NOR-010 | Resolución `NAC-DGERCGC25-00000014` | Anulación de comprobantes | Se anulan los comprobantes emitidos con errores o cuya operación no se produjo. Las ventas se anulan en línea o con nota de crédito; los comprobantes de retención y complementarios, solo en línea. Pasado el plazo, la venta solo se corrige con nota de crédito. No se anulan los comprobantes que sustentan una devolución de impuestos ni las facturas comerciales negociables ya negociadas. Rige desde el 01-08-2025. | [Resolución](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf) | 7 | Verificada |
| NOR-011 | Resolución `NAC-DGERCGC25-00000017` | Reforma del plazo y de la nota de crédito | Reduce el plazo de anulación en línea del día 10 al día 7 del mes siguiente al de la emisión. Reemplaza el art. 5: la nota de crédito se emite solo en los casos del Reglamento de Comprobantes de Venta, y desaparece el límite de 12 meses. Rige para comprobantes emitidos desde el 01-08-2025. Fue dictada el 29-07-2025. | [Resolución](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf) | 7 | Verificada |
| NOR-012 | Reglamento de Comprobantes de Venta, Retención y Documentos Complementarios, art. 15 | Casos de la nota de crédito | La nota de crédito sirve para anular operaciones, aceptar devoluciones y conceder descuentos o bonificaciones, y cita el comprobante original. Solo se conoce por lo que citan los considerandos de `NAC-DGERCGC25-00000014` y `NAC-DGERCGC25-00000017`. | Falta el texto del reglamento | 7 | Pendiente |
| NOR-013 | Reglamento de Comprobantes de Venta, Retención y Documentos Complementarios, art. 50 | Conservación | Los comprobantes, incluidos los anulados, se conservan siete años en original, con todas las copias y ordenados cronológicamente. Solo se conoce por los considerandos de `NAC-DGERCGC25-00000014`. | Falta el texto del reglamento | 13 | Pendiente |
| NOR-014 | Ficha 2.34, apartado de identificación del comprador; `NAC-DGERCGC25-00000014`, art. 3 y disposición general primera | Consumidor final: identificación y corrección | La venta a consumidor final se identifica con el tipo `07` y trece nueves. Una factura a consumidor final, ya emitida y transmitida, no se anula ni se corrige con nota de crédito, también cuando es física. | Ficha 2.34 y resolución | 6, 7 | Verificada |
| NOR-015 | Reglamento de Comprobantes de Venta; ficha 2.34, apartado 9.10 | Consumidor final: tope de monto | La ficha menciona 50 USD solo en el Facturador gratuito del SRI y no en la regla general, que está en el reglamento. El historial de la ficha indica que el tope se actualizó en la versión 2.22. | Falta el texto del reglamento | 6 | Pendiente |
| NOR-016 | Calificación artesanal e IVA 0 % | Tarifa de los servicios artesanales | La ficha no trata este asunto y no se consultó la ley del artesano. Ver V-3. | Sin fuente oficial leída | 2 | Requiere validación externa |
| NOR-017 | Ley Orgánica de Protección de Datos Personales y su reglamento | Datos personales y transferencia al extranjero | Falta saber qué consentimiento y qué contrato necesita el taller para enviar datos de clientes a un proveedor con servidores fuera del Ecuador, y cómo se concilia con la conservación de siete años. Ver V-4. | El repositorio cita el [Reglamento de la LOPDP](https://spdp.gob.ec/wp-content/uploads/2024/12/04.pdf.pdf); no se leyó en este cambio | 13 | Requiere validación externa |
| NOR-018 | Redondeo del IVA incluido en el precio | Cálculo de importes | La ficha 2.34 no contiene reglas de redondeo (no aparece la palabra «redondeo»). El SRI valida que los cálculos del XML cuadren, por lo que el redondeo de `DP-025` puede producir diferencias. Afecta al RUC comercial; el artesanal factura a 0 %. Ver V-5. | Ficha 2.34 y `EXT-002` | 2 | Requiere validación externa |

## 4. Exigencias que condicionan la activación por RUC

Según `DP-034`, estas exigencias se suman a las condiciones de activación de cada entidad fiscal.

| Exigencia | Fila | Condición |
|---|---|---|
| Solicitud de autorización de emisión ante el SRI, en pruebas y en producción, por cada RUC | NOR-007 | Falta confirmar si el proveedor de emisión la gestiona o si la hace cada contribuyente. Verificar en el cambio 4. |
| Punto de emisión exclusivo para la modalidad electrónica | NOR-007 | Impide usar el mismo punto que el Facturador del SRI y obliga a fijar la numeración en el cambio 4. |
| Campo `RUC Proveedor` en cada comprobante | NOR-004, NOR-005 | Es obligatorio y su plazo ya venció, según cualquiera de los dos cómputos. |
| Certificado de firma vigente del emisor | NOR-007 | El emisor responde por mantenerlo vigente. |
| Respuesta a la validación sobre el comprobante en espera sin Internet | NOR-008 | Hasta recibirla, el cambio 3 no puede fijar fecha ni plazo. |
| Registro del desarrollador, si corresponde | NOR-006 | Depende de V-2. |

## 5. Validaciones externas

| ID | Fila | A quién preguntar | Qué preguntar | Qué cambia según la respuesta |
|---|---|---|---|---|
| V-1 | NOR-008 | Contador, que puede hacer una consulta formal al SRI | Si la falta de Internet en el taller es *fuerza mayor* del art. 8, qué comprobante se emite entonces, y qué fecha lleva un comprobante electrónico generado cuando vuelve la conexión | Si se admite esperar, el cambio 3 define la espera y la fecha. Si no, el taller emitiría otro comprobante durante la caída y Tallkit solo lo registraría, o el sistema no dejaría cerrar la venta sin comprobante. Habría que ajustar la regla 6 de `DP-034` con una decisión nueva. |
| V-2 | NOR-006 | Abogado o contador | Si entregar Tallkit a un solo taller obliga a su desarrollador a registrarse como proveedor, y si en `RUC Proveedor` va el RUC del proveedor de emisión, el del desarrollador o ambos | Si debe registrarse, pasa a ser condición de activación. El RUC que se escriba en el campo se programa en el cambio 4. |
| V-3 | NOR-016 | Contador | Si la calificación artesanal vigente sustenta la tarifa 0 % de todos los servicios del taller, y qué ocurre con los servicios cuando vence | Define si Tallkit puede bloquear la preparación con calificación vencida y qué tarifa lleva un servicio sin calificación. |
| V-4 | NOR-017 | Abogado | Qué aviso y qué contrato exige el envío de datos de clientes a un proveedor con servidores en el extranjero, y cómo se concilia con la conservación de siete años | Determina el aviso de privacidad, el contrato con el proveedor y si la prueba real exige condiciones antes de emitir. |
| V-5 | NOR-018 | Contador | Qué regla de redondeo debe seguir un precio con IVA incluido para que el SRI acepte el XML | Si difiere de `DP-025`, el cambio 2 propone una decisión nueva que la sustituya. |

Las respuestas se registran aquí con quién respondió, la fecha y la conclusión antes de cambiar el estado de una fila.

## 6. Pendientes de lectura

- Texto de la resolución `NAC-DGERCGC26-00000027` y fecha de su publicación en el Registro Oficial.
- Reformas de la resolución `NAC-DGERCGC18-00000233` posteriores a 2018, además de las de `NAC-DGERCGC25-00000014`.
- Reglamento de Comprobantes de Venta, Retención y Documentos Complementarios (arts. 15 y 50 y la regla de consumidor final).
- Resto de la ficha técnica 2.34, según lo requiera cada cambio.
- Resolución `NAC-DGERCGC26-00000024`, que la ficha cita en otro anexo y aún no se ha leído.

Referencia terminológica: [matriz-normas-facturacion-electronica-glossary-reference.md](matriz-normas-facturacion-electronica-glossary-reference.md).
