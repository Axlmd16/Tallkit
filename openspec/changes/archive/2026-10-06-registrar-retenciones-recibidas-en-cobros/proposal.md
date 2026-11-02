## Why

Algunos clientes del taller son **agentes de retención**: el **SRI** los obliga a quedarse con una parte del pago de cada factura y a entregarla al fisco a nombre del emisor. El cliente paga menos que el total y emite un comprobante de retención electrónico por la diferencia. Ese valor no es un descuento ni una deuda: es un impuesto del titular ya pagado por anticipado.

El titular lo confirmó el 2026-10-04 y el 2026-10-05 con datos reales del RUC artesanal: la consulta pública de RUC muestra clientes que son agentes de retención, y la consulta de comprobantes recibidos del taller registra seis comprobantes de retención de cinco clientes distintos solo en enero de 2026, incluidas personas naturales. Hoy las facturas del taller se emiten en el facturador gratuito del SRI, fuera de este sistema.

El sistema no sabe representar ese hecho. Un **pago** solo admite EFECTIVO y TRANSFERENCIA y nunca puede cerrarse con menos dinero que el **saldo pendiente**, de modo que una operación de USD 250 cobrada con USD 245 y una retención de USD 5 queda para siempre con USD 5 de deuda. Las **cuentas por cobrar** muestran entonces deudas que no existen, y el único modo de cerrarlas sería registrar un cobro en efectivo que nunca ocurrió, lo que falsearía la caja.

Este cambio permite registrar la retención recibida como un hecho propio que reduce el saldo sin contarse como dinero cobrado. No emite, no firma, no transmite y no depende de ningún proveedor ni de que la factura se haya preparado en este sistema.

Fuentes consultadas: `docs/negocio/decisiones/decisiones-confirmadas.yaml` (DP-003, DP-013, DP-014, DP-019, DP-027, DP-028, DP-029, DP-031 y decisiones abiertas), `docs/arquitectura/modelo-dominio.md` (§5.3, §6, §8, §10 y §11.6), specs `pagos-comerciales-y-credito-simple`, `pagos-artesanales-y-credito-simple`, `correcciones-de-ventas-y-reembolsos`, `gestion-de-clientes` y `preparacion-y-seguimiento-fiscal`, `docs/negocio/producto/reglas-negocio.md` (RN-VEN-008…016), `docs/negocio/requisitos/requisitos-funcionales.md` (RF-PAG-001…012), `casos-de-uso.md` (CU-013), ADR-0006 y ADR-0008, y el código de `sales`, `workshop`, `shared/money.py` y `customer_registry`.

Contradicciones e información insuficiente registradas:

- El modelo de dominio (§10) define el saldo como importe exigible menos pagos netos. La retención añade un tercer término; el modelo y RN-VEN-011 deberán actualizarse al aplicar el cambio.
- No se confirmaron los porcentajes de retención vigentes. El cambio no los necesita: registra el valor que el cliente retuvo, no lo calcula.

## What Changes

### A. Retención recibida como hecho propio

1. Una **retención recibida** se registra sobre exactamente una venta comercial o una operación artesanal confirmada y vigente, con importe positivo en USD de hasta dos decimales, usuario, entidad fiscal y fecha del sistema.
2. La retención **reduce el saldo pendiente** de esa operación, igual que un pago, pero **no es un pago ni un medio de pago**: no suma al dinero cobrado, no aparece como efectivo ni como transferencia y no entrará en los futuros cierres de caja.
3. Puede registrarse **junto con un cobro**, en la misma acción (por ejemplo USD 245 en transferencia y USD 5 de retención para cerrar USD 250), o **sola**, cuando el dinero ya se cobró antes.
3a. **Cobro sencillo.** Quien cobra solo escribe el dinero que recibió. Si es menor que el saldo, la pantalla pregunta en lenguaje llano si la diferencia la retuvo el cliente y propone ese valor ya calculado; la persona solo confirma o lo deja como saldo pendiente. En el cobro no se muestran términos tributarios, números de comprobante ni desgloses.
4. La suma de pagos y retenciones de una operación nunca supera su importe exigible. No hay anticipos ni sobrepagos, como hoy.
5. Una venta de contado se considera cobrada por completo cuando el dinero más la retención cubren el total.
6. Las estructuras siguen separadas por RUC, como ordena DP-029: la retención comercial pertenece a la venta y la artesanal a la operación artesanal; las reglas de cálculo son compartidas y puras.

### B. Comprobante de retención que llega después

7. El **número del comprobante de retención** (formato `NNN-NNN-NNNNNNNNN`) y su fecha de emisión **no se piden al cobrar**, porque el comprobante electrónico suele llegar días después del pago y quien cobra no tiene por qué conocerlo.
8. Una retención sin número queda marcada como **comprobante pendiente**. El Administrador, o quien cobra en ese ámbito, puede completar después, desde una pantalla aparte, el número, la fecha y el desglose entre impuesto a la renta e IVA, cuya suma debe coincidir con el importe registrado.
9. Una lista de **retenciones con comprobante pendiente**, separada por entidad fiscal, permite buscarlas en SRI en línea y completarlas.
10. El mismo número de comprobante no puede registrarse dos veces para el mismo cliente dentro de una entidad fiscal.

### C. Cliente que retiene

11. La ficha del **cliente** admite una marca opcional «Agente de retención», declarada a mano con base en la consulta pública de RUC. El dato es compartido por los dos RUC.
12. Al cobrar a un cliente con esa marca, la pantalla de cobro ofrece la retención de forma visible. Sin la marca, la retención sigue disponible pero no se sugiere.
13. La marca no bloquea nada ni calcula valores: solo orienta a la persona que cobra.

### D. Correcciones e historia

14. Una retención registrada no se edita ni se borra. El Administrador puede **anularla con motivo**, y el saldo vuelve a mostrar ese importe. Completar los datos del comprobante pendiente no es una corrección.
15. La operación muestra por separado el dinero cobrado, las retenciones y el saldo, con el historial de cada hecho.
16. Una retención nunca genera un reembolso al cliente: el taller no recibió ese dinero. Si una devolución deja un exceso, el reembolso se limita al dinero efectivamente cobrado y la retención sobrante se muestra como diferencia que el Administrador resuelve anulándola cuando el cliente corrige su comprobante.

### E. Relación con la preparación fiscal

17. La retención **no es una forma de pago de la factura**. La preparación fiscal sigue declarando formas de pago por el total del comprobante; una retención registrada no cambia esa declaración ni se presenta como forma de pago del SRI.
18. Registrar una retención no exige que exista una preparación fiscal ni un comprobante archivado: sirve desde hoy para las facturas emitidas en el facturador del SRI.

### F. Configuración por entidad fiscal

20. No se crea una pestaña ni una sección nueva. El **perfil tributario** de cada entidad fiscal, que ya existe dentro de «Facturación electrónica» en la página de Configuración, incorpora los ajustes de **retenciones recibidas**, que solo el Administrador modifica: si la entidad registra retenciones (activado o desactivado) y el porcentaje de la advertencia de D4.
21. Con el registro desactivado, las pantallas de cobro de esa entidad no ofrecen la retención y no cambia nada de su comportamiento actual. Las retenciones ya registradas se conservan y siguen descontando del saldo.
22. Los cambios de esta configuración quedan auditados y no alteran retenciones ni cobros anteriores.

### Principio de configuración

19. Ninguna regla de este cambio depende de la situación tributaria actual de las entidades (régimen, tarifa de IVA, calificación artesanal o condición de agente de retención). Los datos reales del titular motivan el cambio y sirven de caso de prueba, pero el comportamiento es el mismo para cualquier entidad fiscal y cualquier configuración futura.

### Decisiones que requieren aprobación

Las siguientes son recomendaciones. La propuesta se detiene aquí hasta que el titular las apruebe o las cambie.

- **D1 — La retención es un hecho distinto del pago.** No se añade RETENCION como tercer medio de pago. Así DP-003 se conserva intacta (los medios siguen siendo EFECTIVO y TRANSFERENCIA) y la caja nunca cuenta dinero que no entró. *Alternativa descartada:* tratarla como medio de pago, más rápida de construir pero que mezclaría un impuesto con el dinero cobrado en cada total y cierre futuro.
- **D2 — El comprobante se completa después y fuera del cobro.** El cobro solo pide el dinero recibido y confirma la diferencia como retención (punto 3a); número, fecha y desglose se completan en la lista de pendientes (puntos 7 a 9). *Alternativa:* exigirlos siempre, más ordenada pero impracticable, porque al cobrar casi nunca se tiene el comprobante.
- **D3 — Quién registra y quién anula.** Registra y completa quien ya puede cobrar en cada ámbito (Administrador y Vendedor en el comercial; Administrador y Encargado del taller en el artesanal). Solo el Administrador anula, como ocurre con los pagos.
- **D4 — El sistema no calcula ni valida porcentajes.** Se registra el valor que el cliente retuvo, sea cual sea el régimen o la tarifa de la entidad. Se recomienda una **advertencia sin bloqueo** cuando la retención supere un porcentaje del total de la operación. Ese porcentaje es un **parámetro configurable por entidad fiscal**, con valor inicial de 20 %, que el Administrador puede cambiar o desactivar; no queda fijo en el sistema.
- **D5 — Marca manual en el cliente.** «Agente de retención» se declara a mano y no se consulta al SRI (puntos 11 a 13). *Alternativa:* no guardar la marca y ofrecer siempre la retención, más simple pero que no ayuda a recordar qué clientes retienen.
- **D6 — Desglose renta/IVA opcional.** Al cobrar solo se pide el total retenido; el desglose se completa con el comprobante. Sirve a quien prepara la declaración del titular. El desglose está disponible en los dos ámbitos y no depende de la tarifa que la entidad tenga configurada hoy.

- **D7 — Registro activable por entidad.** Cada entidad fiscal decide en su perfil tributario si registra retenciones (puntos 20 a 22). Se recomienda que empiece **activado** en ambas, porque desactivado deja deudas falsas en cuanto un cliente retiene. *Alternativa:* dejarlo siempre disponible sin interruptor, más simple pero que muestra una opción inútil a una empresa cuyos clientes nunca retienen.

### Fuera de alcance

- Emitir comprobantes de retención propios. Corresponde a una entidad que se declare agente de retención en su perfil del emisor y requiere su propio cambio; este no lo impide ni lo adelanta.
- Calcular porcentajes o bases de retención, o validar los que aplicó el cliente.
- Importar el XML del comprobante de retención para llenar los datos; queda como mejora posterior sobre el archivo de comprobantes.
- Cierres de caja y reportes, que todavía no existen; este cambio solo garantiza que la retención no se cuente como dinero cuando se construyan.
- Generación de XML, firma, transmisión, notas de crédito y cualquier integración con un proveedor.
- Cambios en medios de pago, condición de contado o crédito, precios, impuestos, inventario o numeración.
- La regla de redondeo del IVA incluido (DP-025) y el tope de consumidor final.

## Capabilities

### New Capabilities

- `retenciones-recibidas-en-cobros`: registro, completado, consulta y anulación de retenciones recibidas sobre operaciones confirmadas de cada entidad fiscal, con comprobante pendiente y lista de seguimiento.

### Modified Capabilities

- `pagos-comerciales-y-credito-simple`: el saldo y el estado de pago descuentan las retenciones vigentes; un cobro puede acompañarse de una retención; la consulta de deuda las muestra separadas del dinero cobrado.
- `pagos-artesanales-y-credito-simple`: lo mismo para la operación artesanal y sus cuentas por cobrar.
- `correcciones-de-ventas-y-reembolsos`: el exceso reembolsable se limita al dinero efectivamente cobrado; la retención sobrante se muestra aparte.
- `gestion-de-clientes`: marca opcional «Agente de retención» en la ficha del cliente.
- `configuracion-operativa-y-fiscal`: el perfil tributario de cada entidad fiscal añade los ajustes de retenciones recibidas (registro activado y porcentaje de advertencia).

## Impact

**Usuarios afectados.** El Vendedor y el Encargado del taller registran retenciones al cobrar y completan comprobantes pendientes en su ámbito. El Administrador además las anula. La marca del cliente la declara quien ya puede editar clientes. Ningún rol gana permisos sobre el otro RUC.

**Reutilización, modificación y sustitución.**
- *Se reutiliza:* las reglas monetarias puras de `shared/money.py`, la identidad estable ante reintentos de los cobros, los bloqueos y la atomicidad de ADR-0006 y ADR-0008, la corrección administrativa con motivo y la auditoría.
- *Se modifica:* el cálculo de saldo y estado de pago de ventas y operaciones artesanales, los comandos y pantallas de cobro, las cuentas por cobrar de ambos ámbitos, el cálculo del exceso reembolsable y la ficha del cliente.
- *Se sustituye:* nada.

**Datos.** Migraciones aditivas: registros de retención en `sales` y en `workshop`, y la marca en `customer_registry`. No se reescriben pagos, saldos históricos ni instantáneas. Los clientes existentes quedan sin marca.

**API y contrato.** Nuevas operaciones para registrar, completar, anular y listar retenciones por ámbito; el cobro admite una retención opcional; las respuestas de saldo y de cuentas por cobrar añaden el total retenido; la ficha del cliente añade la marca. Se actualiza el contrato OpenAPI. El único consumidor es la interfaz propia.

**Frontend.** Retención en el diálogo de cobro comercial y artesanal, detalle de la operación con dinero cobrado, retenciones y saldo separados, lista de comprobantes pendientes y marca en el formulario de cliente.

**Dependencias.** Ninguna dependencia nueva. No depende de otro cambio activo. El cambio futuro de emisión podrá vincular la retención con la factura autorizada.

**Riesgos.**
- Una retención registrada por error cierra una deuda real. Lo mitigan la advertencia de D4, la lista de comprobantes pendientes y la anulación con motivo.
- Dos personas pueden registrar a la vez un cobro y una retención sobre el mismo saldo; debe resolverse con el mismo bloqueo que hoy protege los cobros concurrentes.
- El importe retenido no se contrasta con el SRI: el sistema registra lo declarado por la persona y no acredita que el comprobante exista.
- La regla del exceso tras una devolución (punto 16) cubre un caso poco frecuente y deja una diferencia visible que exige intervención del Administrador.

**Trazabilidad.** DP-003, DP-013, DP-014, DP-019, DP-027, DP-028, DP-029, DP-031; RN-VEN-009…014, RN-VEN-016, RN-FIS-001…009, RN-CLI-001; RF-PAG-002…009, RF-PAG-011; CU-013; ADR-0006, ADR-0008. Decisión abierta relacionada, que este cambio no cierra: «Tarifas y clasificación tributaria reales, reglas de redondeo y requisitos futuros de consumidor final y facturación electrónica».
