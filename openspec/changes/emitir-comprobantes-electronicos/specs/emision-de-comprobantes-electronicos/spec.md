## ADDED Requirements

### Requirement: Interfaz neutral del proveedor de emisión y capacidades declaradas

El sistema SHALL definir un contrato neutral de **proveedor de emisión** dentro del ámbito fiscal que opere exclusivamente con conceptos del dominio y con la instantánea fiscal de formato 4, sin exponer nombres comerciales, códigos internos, estructuras de carga ni errores propios de un proveedor externo en ventas, taller, cobros, clientes, configuración ni interfaz.

Cada **adaptador de emisión** SHALL declarar de forma explícita sus capacidades:

- si envía el comprobante al correo del receptor;
- si asigna el secuencial y la clave de acceso o recibe el último secuencial autorizado para continuarlo;
- si incorpora automáticamente el campo `RUC Proveedor` en la información adicional;
- si admite emitir notas de crédito sobre comprobantes autorizados fuera de ese proveedor.

El sistema SHALL adaptar su flujo a las capacidades declaradas por el adaptador activo de la entidad fiscal. Ningún módulo ajeno al adaptador SHALL importar o referenciar directamente la implementación de un proveedor concreto.

Trazabilidad: `DP-034`, reglas 2 y 3; `RN-FIS-015`, `RN-FIS-016`; `RF-FIS-008`; `ADR-0010`; `docs/cambios-pendientes.md` («Regla de independencia del proveedor», puntos 1, 2, 4 y 7).

#### Scenario: Emisión a través del contrato neutral sin acoplar módulos económicos
- **DADO** una preparación fiscal completada en formato 4 de una entidad fiscal con emisión activa en pruebas
- **CUANDO** el núcleo fiscal solicita su emisión mediante la interfaz neutral
- **ENTONCES** el adaptador configurado SHALL recibir únicamente datos derivados de la instantánea fiscal de Tallkit y devolver un resultado traducido a los estados y conceptos del dominio, sin modificar ventas, operaciones artesanales ni pagos.

#### Scenario: Aislamiento de fronteras de cada adaptador
- **DADO** el código de los módulos de ventas, taller, cobros, inventario, clientes, configuración, orquestación de cobro y vistas del módulo fiscal
- **CUANDO** se verifican las fronteras de arquitectura
- **ENTONCES** ningún archivo fuera de la carpeta propia del adaptador y del registro de adaptadores SHALL importar ni nombrar módulos o clases específicas de un proveedor.

### Requirement: Adaptador simulado local y batería de pruebas de contrato

El sistema SHALL proveer un **adaptador simulado** local que opere sin conexión de red, sin credenciales externas y sin consumir cupo de ningún proveedor, apto para desarrollo, pruebas automatizadas y verificación de extremo a extremo en ambiente de pruebas (`1`).

El adaptador simulado SHALL:

- validar la instantánea recibida y asignar o continuar la identidad fiscal de pruebas con clave de acceso de 49 dígitos válida por módulo 11;
- permitir reproducir de manera determinista los resultados `en_proceso`, `autorizada`, `no_autorizada` y `error_temporal`;
- generar, cuando el resultado sea `autorizada`, un XML de factura válido contra el esquema oficial `factura-2.1.0.xsd` local con su envoltorio de autorización de pruebas y un documento RIDE en formato PDF válido.

Toda implementación de adaptador de emisión SHALL verificarse contra una misma batería de **pruebas de contrato** que compruebe emisión idempotente, consulta de estado, descarga de XML y RIDE, traducción de rechazos y manejo de errores temporales.

Trazabilidad: `DP-034`, reglas 2, 3 y 8; `RN-FIS-016`; `RF-FIS-008…010`; `docs/cambios-pendientes.md` («Regla de independencia del proveedor», puntos 10 y 11).

#### Scenario: Ciclo completo en el adaptador simulado sin red
- **DADO** una entidad fiscal configurada en ambiente de pruebas con el adaptador simulado activo
- **CUANDO** se solicita emitir una preparación completada de formato 4 y se consulta o completa su autorización simulada
- **ENTONCES** el adaptador simulado SHALL devolver la identidad fiscal de pruebas, el XML válido contra `factura-2.1.0.xsd` y los bytes del PDF RIDE sin realizar llamadas HTTP externas.

#### Scenario: Simulación controlada de procesamiento, rechazo y fallo temporal
- **DADO** el adaptador simulado configurado para responder `en_proceso`, `no_autorizada` o `error_temporal` ante casos de prueba determinados
- **CUANDO** el núcleo solicita la emisión o consulta el estado
- **ENTONCES** el adaptador SHALL cumplir todos los invariantes de la batería de pruebas de contrato con la misma estructura de respuesta neutral que cualquier adaptador externo.

### Requirement: Estados canónicos de la referencia fiscal y separación de la referencia externa

Toda preparación fiscal completada SHALL asociarse a una **referencia fiscal** independiente del estado de la operación económica, del estado de pago y del estado local de la preparación (`borrador`, `preparada`, `cancelada`).

La referencia fiscal SHALL transitar únicamente por los siguientes estados canónicos del dominio:

- `no_solicitada`: la preparación está completada localmente, pero aún no se ha solicitado su emisión electrónica;
- `pendiente`: la emisión fue solicitada y registrada en la cola local, pendiente de envío al proveedor;
- `en_proceso`: el comprobante fue recibido por el proveedor o el SRI y espera respuesta oficial de autorización;
- `error_temporal`: la comunicación con el proveedor falló por falta de Internet, tiempo agotado o indisponibilidad transitoria sin confirmación de rechazo tributario;
- `autorizada`: el comprobante fue autorizado con número fiscal, clave de acceso de 49 dígitos, fecha/hora de autorización y copia propia de XML y RIDE archivada;
- `no_autorizada`: el proveedor o el SRI rechazó el comprobante por validación o regla tributaria, conservando el motivo y código traducidos;
- `anulada`: estado reservado para cuando se registre una anulación oficial confirmada sobre un comprobante previamente autorizado.

El identificador del adaptador, la referencia externa del proveedor y los mensajes técnicos crudos SHALL conservarse separados de los datos oficiales del comprobante (número fiscal, clave de acceso, ambiente y fecha de autorización) y SHALL NOT contener claves privadas, contraseñas ni tokens de autenticación.

Trazabilidad: `DP-018`; `DP-034`, reglas 2, 3 y 5; `modelo-dominio.md` §5.3 y §7; `RN-FIS-008`, `RN-FIS-015`, `RN-FIS-016`; `RF-FIS-002`, `RF-FIS-008`, `RF-FIS-009`; `docs/cambios-pendientes.md` (regla de independencia, puntos 3 y 5; propuesta §B.2).

#### Scenario: Transición desde preparación local hasta autorización en pruebas
- **DADO** una preparación en estado local `preparada` cuya referencia fiscal inicia en `no_solicitada`
- **CUANDO** se solicita la emisión y el adaptador confirma la recepción y posterior autorización
- **ENTONCES** la preparación SHALL conservar su estado local `preparada`, mientras la referencia fiscal transita por `pendiente` o `en_proceso` hasta `autorizada`, guardando por separado los datos oficiales del comprobante y la referencia técnica del adaptador.

#### Scenario: Rechazo tributario frente a error temporal de comunicación
- **DADO** dos solicitudes de emisión donde la primera sufre un corte de red y la segunda recibe un rechazo de validación del esquema o del SRI
- **CUANDO** el núcleo registra el resultado de cada intento
- **ENTONCES** la primera SHALL quedar en `error_temporal` habilitada para reintento sobre la misma referencia, y la segunda SHALL quedar en `no_autorizada` con el motivo comprensible, exigiendo corregir o reemplazar la preparación antes de volver a emitir.

### Requirement: Prohibición de reenvío en procesamiento y cola de emisión fuera de las transacciones económicas

La solicitud y el procesamiento de emisión electrónica SHALL ejecutarse **fuera** de las transacciones de confirmación de ventas, confirmación de operaciones artesanales y registro de pagos. Un fallo al solicitar, enviar o consultar la emisión SHALL NOT revertir ni bloquear la venta, la operación artesanal, el movimiento de inventario ni el cobro.

Conforme a `NOR-001`, mientras una referencia fiscal se encuentre en estado `en_proceso` (donde el SRI puede tardar hasta 24 horas en responder):

- el sistema SHALL NOT reenviar una nueva solicitud de emisión para esa preparación ni generar otra clave de acceso o secuencial;
- el sistema SHALL NOT permitir cancelar ni reemplazar la preparación mientras el comprobante siga `en_proceso`;
- toda acción de seguimiento sobre un comprobante `en_proceso` SHALL limitarse a **consultar su estado** ante el adaptador hasta obtener `autorizada`, `no_autorizada` o un `error_temporal` de consulta.

La cola de emisión SHALL procesar de forma concurrentemente segura (con bloqueo sin espera o exclusión por comprobante) las referencias en estado `pendiente`, `error_temporal` o `en_proceso`, usando una referencia de idempotencia estable por intento lógico para que un reintento tras un corte de red recupere el comprobante ya recibido por el proveedor en lugar de duplicarlo.

Trazabilidad: `DP-034`, reglas 5 y 6; `NOR-001`; `RN-FIS-008`, `RN-FIS-015`; `RF-FIS-008`, `RF-FIS-009`; `RNF-DIS-001`, `RNF-DIS-009`; `RNF-INT-003/004`; `ADR-0010`; `ADR-0014`; `CU-031`.

#### Scenario: Intento de reenviar un comprobante en procesamiento
- **DADO** una referencia fiscal en estado `en_proceso`
- **CUANDO** un usuario autorizado o la tarea programada solicita facturar o actualizar ese comprobante
- **ENTONCES** el sistema SHALL ejecutar únicamente la consulta de estado ante el adaptador y SHALL rechazar cualquier nuevo envío o asignación de otro secuencial o clave de acceso.

#### Scenario: Ejecución concurrente de la cola sobre el mismo comprobante pendiente
- **DADO** una referencia fiscal en `pendiente` o `error_temporal`
- **CUANDO** dos procesos de cola o dos solicitudes simultáneas intentan procesarla a la vez
- **ENTONCES** solo uno SHALL ejecutar la llamada al adaptador con la clave de idempotencia del comprobante y el otro SHALL omitirla o recuperar el estado actualizado, sin duplicar el envío.

#### Scenario: Fallo de salida a Internet durante la emisión
- **DADO** una venta o una operación artesanal recién confirmada y cobrada sin conexión a Internet
- **CUANDO** se solicita su emisión electrónica
- **ENTONCES** la venta y el cobro SHALL permanecer confirmados e intactos, y la referencia fiscal SHALL quedar en `pendiente` o `error_temporal` en la cola local, sin presentarse como autorizada.

### Requirement: Vigencia diaria en America/Guayaquil para comprobantes en espera sin Internet

Mientras la validación externa `V-1` sobre `NOR-008` (transmisión en el momento de la transacción tras la reforma de `NAC-DGERCGC25-00000014`) permanezca sin respuesta formal en la matriz de normas, todo comprobante cuya emisión haya quedado en espera (`pendiente` o `error_temporal`) SHALL conservar la fecha fiscal de referencia del día en que se completó su preparación según la zona horaria `America/Guayaquil`, sin retrofechar (`DP-025`).

La cola de emisión y la acción de reintento SHALL enviar automáticamente el comprobante al proveedor únicamente si la fecha actual en `America/Guayaquil` coincide con la fecha fiscal de referencia congelada en la instantánea preparada. Si el comprobante permaneció sin enviarse al proveedor (`pendiente` o `error_temporal` sin recepción confirmada) y ya comenzó un día calendario posterior en `America/Guayaquil`:

- el sistema SHALL NOT enviarlo en silencio con una fecha fiscal de un día anterior ni modificar automáticamente la fecha de la instantánea preparada;
- el sistema SHALL bloquear el envío automático e informar un impedimento visible indicando que la fecha de preparación venció sin transmisión, permitiendo al usuario autorizado cancelar y reemplazar la preparación con la fecha actual o vincular un comprobante externo cuando corresponda.

Los comprobantes que ya fueron recibidos por el proveedor/SRI dentro de su día de emisión y quedaron en estado `en_proceso` SHALL seguir consultándose hasta por las 24 horas previstas en `NOR-001`, aunque la consulta cruce la medianoche.

Trazabilidad: `DP-025`; `DP-034`, regla 6; `NOR-001`; `NOR-008` y validación `V-1`; `RNF-DIS-009`; spec `normativa-de-facturacion-electronica` («Fecha del comprobante que esperó sin Internet»); propuesta §B.1.

#### Scenario: Recuperación de Internet dentro del mismo día en America/Guayaquil
- **DADO** una preparación completada con fecha fiscal `2026-11-22` en `America/Guayaquil` que quedó en `error_temporal` por falta de conexión
- **CUANDO** vuelve la conexión y se procesa la cola antes de las `23:59:59` del `2026-11-22` en `America/Guayaquil`
- **ENTONCES** el sistema SHALL reintentar el envío conservando la fecha `2026-11-22` y la misma referencia de idempotencia.

#### Scenario: Comprobante no enviado que cruza al día siguiente frente a comprobante ya en procesamiento
- **DADO** un primer comprobante en `error_temporal` (nunca recibido por el proveedor) con fecha fiscal `2026-11-22` y un segundo comprobante que sí fue recibido el `2026-11-22` y quedó `en_proceso`
- **CUANDO** la cola se ejecuta el `2026-11-23` en `America/Guayaquil`
- **ENTONCES** el sistema SHALL bloquear el envío del primero mostrando el impedimento de fecha vencida sin reenviarlo ni cambiar su fecha en silencio, y SHALL consultar normalmente el estado del segundo que ya estaba `en_proceso`.

### Requirement: Elegibilidad para emitir y reemplazo de preparaciones anteriores al formato 4

El sistema SHALL permitir solicitar la emisión electrónica únicamente cuando se cumplan todas las condiciones siguientes:

1. la operación de origen (venta comercial u operación artesanal) está confirmada y vigente;
2. la **entidad fiscal** de la operación tiene la emisión electrónica **activada** en su configuración (en esta entrega, únicamente en ambiente de *Pruebas* `1`, conforme a `DP-034` regla 8);
3. la preparación fiscal está en estado local `preparada`, utiliza la instantánea de formato vigente (formato 4 o superior) y cumple los datos obligatorios de `DP-035` (correo válido cuando el receptor es identificado `04`, `05`, `06` o `08`; y plazo en días entre 1 y 9999 cuando la operación es a crédito con saldo pendiente).

Si una operación tiene una preparación completada antes del cambio 2 (formato anterior a 4, o sin correo para receptor identificado, o sin plazo en crédito con saldo pendiente), el sistema SHALL rechazar su emisión directa sin modificar la instantánea histórica y SHALL guiar al usuario autorizado a cancelarla con motivo y crear su preparación de reemplazo con los datos completos antes de emitir.

Trazabilidad: `DP-034`, reglas 4 y 8; `DP-035`, reglas 1 y 2; `RN-FIS-012`, `RN-FIS-017`; `RF-FIS-008`, `RF-FIS-013`, `RF-FIS-014`; `NOR-001`; `NOR-019`; propuesta §B.4 y §B.5.

#### Scenario: Entidad fiscal sin emisión activada o intento en producción
- **DADO** una preparación de formato 4 válida cuya entidad fiscal aún no tiene activada la emisión (o una solicitud que intenta forzar ambiente de producción `2` durante esta entrega)
- **CUANDO** se solicita emitir el comprobante
- **ENTONCES** el sistema SHALL rechazar la emisión explicando que la entidad no está activada o que el ambiente de producción no está habilitado, sin llamar al adaptador ni consumir numeración.

#### Scenario: Preparación antigua sin correo o sin plazo
- **DADO** una preparación completada antes del cambio 2 cuyo receptor identificado carece de correo o cuyo crédito con saldo carece de plazo
- **CUANDO** un usuario autorizado solicita emitirla
- **ENTONCES** el sistema SHALL bloquear la emisión indicando los datos obligatorios faltantes y ofreciendo cancelar y reemplazar la preparación, conservando intacta la instantánea original.

### Requirement: Archivo automático de la copia propia del XML autorizado y del RIDE

Cuando una referencia fiscal alcance el estado `autorizada`, el núcleo de emisión SHALL descargar del adaptador y conservar atómicamente en el **archivo fiscal** propio de Tallkit:

- los bytes íntegros del XML autorizado (comprobante y envoltorio de autorización), validados contra el esquema oficial local soportado y con su huella `SHA-256`;
- los bytes íntegros del documento RIDE en formato PDF con su huella `SHA-256`, tamaño y vínculo inmutable al mismo expediente fiscal;
- la identidad fiscal oficial (entidad, ambiente, tipo documental, establecimiento, punto, secuencial de 9 dígitos y clave de acceso de 49 dígitos), la fecha/hora de autorización y el vínculo con la preparación y la operación de origen.

El sistema SHALL actualizar en la misma confirmación el **último secuencial autorizado** del ámbito fiscal para garantizar numeración portable ante un futuro cambio de proveedor. Si la descarga o validación del XML o del RIDE falla después de que el adaptador reportó autorización, la referencia fiscal SHALL conservar la clave y el número reportados y registrar una incidencia de archivo pendiente para reintentar la descarga sin volver a emitir el comprobante.

Trazabilidad: `DP-034`, reglas 2 y 3; `RN-FIS-013`, `RN-FIS-014`, `RN-FIS-016`; `RF-FIS-010`; `ADR-0010`; `docs/cambios-pendientes.md` (regla de independencia, puntos 8 y 9).

#### Scenario: Autorización que archiva XML y RIDE y actualiza el secuencial portable
- **DADO** una referencia fiscal en ambiente de pruebas cuyo adaptador confirma el estado `autorizada` con secuencial `000000015`
- **CUANDO** el núcleo procesa la respuesta de autorización
- **ENTONCES** SHALL guardarse el XML autorizado y el PDF del RIDE con sus huellas `SHA-256` vinculados a la preparación y a la operación, el estado SHALL pasar a `autorizada` indicando ambiente de pruebas, y el último secuencial autorizado del ámbito SHALL actualizarse a `000000015`.

#### Scenario: Fallo transitorio al descargar archivos de un comprobante ya autorizado
- **DADO** un comprobante que el proveedor reporta como autorizado pero cuya descarga de XML o PDF falla por un corte de red
- **CUANDO** el núcleo procesa la consulta
- **ENTONCES** SHALL conservarse la clave de acceso y el número autorizado sin reenviar una nueva emisión, y el siguiente ciclo de cola SHALL reintentar únicamente la descarga y archivo del XML y del RIDE faltantes.

### Requirement: Permisos de emisión, consulta y cola por rol y entidad fiscal

La autorización de emisión electrónica SHALL decidirse en el servidor respetando estrictamente la separación entre el **RUC comercial** y el **RUC artesanal** y los tres roles fijos de V1 (`CT-001`):

- en el ámbito comercial (ventas de repuestos): únicamente **Administrador** y **Vendedor** (`fiscal.comercial.preparar` / `fiscal.comercial.emitir`) SHALL poder solicitar la emisión, consultar el estado ante el proveedor y reintentar comprobantes en `error_temporal`;
- en el ámbito artesanal (operaciones de servicios): únicamente **Administrador** y **Encargado del taller** (`fiscal.artesanal.preparar` / `fiscal.artesanal.emitir`) SHALL poder solicitar la emisión, consultar el estado y reintentar comprobantes en `error_temporal`;
- la usuaria diaria con los roles acumulados SHALL operar ambos ámbitos por la unión de sus roles;
- activar o desactivar la emisión de una entidad fiscal, configurar el punto de emisión exclusivo, fijar el secuencial inicial portable y disparar globalmente el procesamiento administrativo de la cola de emisión SHALL estar reservado exclusivamente al **Administrador** (`entidades_fiscales.editar`).

Toda acción de emisión, reintento, transición de estado o rechazo de autorización SHALL quedar registrada en la auditoría fiscal sin exponer secretos.

Trazabilidad: `CT-001`; `DP-034`; `DP-036`, regla 1; `RN-FIS-005`, `RN-FIS-008`, `RN-FIS-009`; `RN-SEG-002…007`; `RF-FIS-008`, `RF-FIS-009`, `RF-FIS-013`; `RF-AUD-001…006`; `actores-y-roles.md` §3 y §7; `CU-031`; propuesta §B.3.

#### Scenario: Emisión autorizada según el ámbito del rol y denegación cruzada
- **DADO** un Vendedor sin rol de taller y un Encargado del taller sin rol comercial
- **CUANDO** cada uno solicita emitir o reintentar una factura de su propio negocio o intenta hacerlo sobre el negocio ajeno
- **ENTONCES** el servidor SHALL permitir a cada rol emitir, consultar y reintentar únicamente los comprobantes de su entidad fiscal y SHALL denegar cualquier acción sobre la otra entidad o sobre la configuración administrativa de activación.
