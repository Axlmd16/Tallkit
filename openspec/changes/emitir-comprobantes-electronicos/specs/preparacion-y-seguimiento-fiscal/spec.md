## MODIFIED Requirements

### Requirement: Estados locales distintos de autorización y pago

La preparación SHALL distinguir borrador, preparada y cancelada. Borrador será editable; pasar a preparada registrará una intención local durable sin transmisión por sí misma; cancelada conservará historia y motivo y no se reactivará. Ninguno de esos estados locales equivaldrá por sí solo a enviada, recibida, autorizada, rechazada por el SRI o anulada oficialmente. El **estado de pago** y los estados comerciales SHALL mostrarse independientemente. Preparación, consulta y cancelación local SHALL funcionar sin llamadas a proveedores externos.

Los intentos de emisión electrónica y los resultados del **proveedor de emisión** SHALL constituir una dimensión vinculada e independiente del estado local, representada en la **referencia fiscal** mediante los estados canónicos `no_solicitada`, `pendiente`, `en_proceso`, `error_temporal`, `autorizada`, `no_autorizada` y `anulada`. Estos estados SHALL NOT sustituir `borrador`, `preparada` o `cancelada` ni convertir códigos propietarios de un proveedor en estados de la preparación. La ausencia de solicitud de emisión (`no_solicitada`) SHALL mostrarse como tal y nunca como autorización pendiente efectivamente enviada. Cuando una referencia fiscal esté en `en_proceso` o `autorizada`, la preparación local SHALL NOT poder cancelarse directamente. Todo estado de emisión generado en ambiente de pruebas (`1`) SHALL mostrarse acompañado de la indicación explícita de ambiente de pruebas, sin presentarse como factura productiva con validez tributaria.

Trazabilidad: propuesta §6; propuesta `emitir-comprobantes-electronicos` §A.3 y §B.2/7; `DP-018`; `DP-027`; `DP-034`, reglas 5 y 8; `RN-CON-009/010`; `RF-FIS-002`, `RF-FIS-008`, `RF-FIS-009`.

#### Scenario: Preparación sin emisión solicitada
- **DADO** una operación con datos fiscales suficientes cuya entidad fiscal no tiene la emisión activada o cuya emisión no se ha solicitado
- **CUANDO** se completa la preparación
- **ENTONCES** SHALL mostrarse con estado local `preparada` y referencia fiscal `no_solicitada` («Preparada, sin enviar»), sin producir solicitud de red ni factura autorizada.

#### Scenario: Pago posterior independiente de la referencia fiscal
- **DADO** una preparación asociada a una operación pendiente de pago, con o sin referencia fiscal emitida
- **CUANDO** se registra un cobro válido por el procedimiento comercial
- **ENTONCES** SHALL cambiar únicamente la información económica correspondiente, sin alterar el estado local de la preparación ni el estado de su referencia fiscal.

#### Scenario: Cancelar preparación antes o después de un rechazo frente a bloqueo en procesamiento o autorizada
- **DADO** una primera preparación cuya referencia fiscal está en `no_solicitada` o `no_autorizada`, y una segunda preparación cuya referencia fiscal está en `en_proceso` o `autorizada`
- **CUANDO** un usuario autorizado intenta cancelar localmente ambas con motivo
- **ENTONCES** la primera SHALL cancelarse conservando su historia y permitiendo crear un reemplazo, mientras que la segunda SHALL rechazar la cancelación local explicando que un comprobante en procesamiento o autorizado no puede cancelarse localmente.

### Requirement: Terminología de preparación local

La interfaz SHALL hablar en lenguaje simple, sin términos contables ni técnicos que la persona usuaria no necesita. SHALL llamar «Datos de la factura» a la pantalla de preparación, «Preparar factura» a la acción que la inicia, «Completar datos» a la que retoma un borrador, «Ver datos» a la que consulta los ya confirmados y «Facturar» a la acción que solicita la emisión cuando la entidad fiscal está activada; «Por completar», «Datos listos» y «Cancelados» a los estados locales de preparación; y textos claros en español para la referencia fiscal («Sin enviar», «En cola de envío», «Enviada al SRI (en proceso)», «Error de conexión (reintentar)», «Autorizada en pruebas», «Rechazada (revisar datos)»).

Mientras la preparación esté en `no_solicitada`, toda vista de estos datos SHALL mostrar de forma visible y breve «Todavía no se ha enviado al SRI». Cuando el comprobante haya sido emitido en ambiente de pruebas (`1`), toda vista SHALL indicar de forma visible que pertenece al ambiente de **Pruebas (sin validez tributaria)**. Ninguna vista, estado, botón, notificación o mensaje SHALL presentar una preparación no enviada o un comprobante de pruebas como factura autorizada de producción. Las explicaciones largas SHALL ofrecerse como ayuda breve desplegable y los datos técnicos del emisor SHALL quedar plegados.

Trazabilidad: propuesta A6; propuesta `emitir-comprobantes-electronicos` §A.6 y §B.7; solicitud del titular de lenguaje simple (2026-11-01); `DP-018`; `DP-034`, reglas 5 y 8; invariante 25 del modelo de dominio; `RN-CON-009/010`; `RF-FIS-002`, `RF-FIS-009`.

#### Scenario: Preparación completada sin enviar frente a emitida en pruebas
- **DADO** una preparación completada cuya emisión no se ha solicitado y otra cuya emisión con el adaptador simulado quedó `autorizada` en ambiente de pruebas
- **CUANDO** el usuario las consulta
- **ENTONCES** la primera SHALL mostrar «Datos listos» con el aviso «Todavía no se ha enviado al SRI», y la segunda SHALL mostrar «Autorizada en pruebas» con la indicación explícita de ambiente de pruebas sin validez tributaria.

#### Scenario: Texto sin jerga y datos del emisor plegados
- **DADO** cualquier vista de los datos de la factura y de su estado de emisión
- **CUANDO** el usuario la lee
- **ENTONCES** SHALL NOT aparecer códigos crudos del proveedor ni jerga interna como «snapshot formato 4» o «borrador fiscal», y los datos técnicos del emisor SHALL quedar plegados por omisión.

### Requirement: Lista de preparaciones locales de factura

El sistema SHALL ofrecer una consulta paginada de las preparaciones y referencias fiscales de factura de las entidades fiscales que el usuario pueda consultar según sus permisos fiscales (`fiscal.comercial.ver`, `fiscal.artesanal.ver`). SHALL devolver por fila la entidad fiscal (identificada por su nombre comercial o razón social), el origen (venta comercial u operación artesanal), su número interno, el número fiscal y clave de acceso cuando ya existan, el cliente, el total, la fecha, el ambiente (*Pruebas* `1`), el estado local (`borrador`, `preparada` o `cancelada`) y el estado de emisión de la referencia fiscal (`no_solicitada`, `pendiente`, `en_proceso`, `error_temporal`, `autorizada`, `no_autorizada`).

La lista SHALL poder filtrarse por entidad, por estado local y por estado de emisión, con orden estable, total y paginación en el servidor. El servidor SHALL omitir las filas de la entidad que el usuario no pueda consultar y SHALL rechazar un filtro por esa entidad. La consulta por sí sola SHALL NOT crear, modificar, cancelar ni transmitir comprobantes, y SHALL distinguir siempre un estado local o una autorización de pruebas de una emisión productiva.

Trazabilidad: `DP-034`, regla 8; `DP-036`, reglas 3 y 8; `RN-FIS-009`; `RF-FIS-002`, `RF-FIS-008`, `RF-FIS-009`; `RNF-SEG-003`; `navegacion-de-uso-diario`; propuesta `emitir-comprobantes-electronicos` §A.6 y §B.7.

#### Scenario: Consulta y filtrado por entidad y estado de emisión
- **DADO** facturas de ambas entidades en distintos estados locales y de emisión (`no_solicitada`, `en_proceso`, `autorizada`, `error_temporal`) y un usuario con permisos de consulta
- **CUANDO** consulta la lista o filtra por entidad y estado de emisión
- **ENTONCES** SHALL recibir únicamente las filas de las entidades autorizadas a su sesión que coincidan con el filtro, cada una con su estado local, su estado de emisión y su ambiente claramente identificados, y el servidor SHALL rechazar cualquier filtro sobre una entidad no autorizada.
