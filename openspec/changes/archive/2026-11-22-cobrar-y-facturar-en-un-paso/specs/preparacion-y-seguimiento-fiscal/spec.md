## MODIFIED Requirements

### Requirement: Receptor fiscal sin mutación del cliente histórico

La preparación SHALL conservar por separado el **cliente** operativo de origen y el receptor declarado para el comprobante. SHALL admitir los tipos SRI RUC `04`, cédula `05`, pasaporte `06`, consumidor final `07` e identificación del exterior `08` conforme a los formatos oficiales; los demás tipos SHALL rechazarse como no soportados en esta entrega. RUC y cédula SHALL contener respectivamente 13 y 10 dígitos ASCII conservando ceros iniciales; documentos extranjeros SHALL conservar su representación alfanumérica admitida. SHALL NOT rechazarse un RUC por un algoritmo universal ni afirmarse comprobación de existencia sin consulta oficial. Completar o corregir datos fiscales SHALL exigir trazabilidad y no editar la instantánea comercial ni la ficha maestra por efecto implícito. La información requerida y sus límites SHALL validarse contra la versión oficial identificada del documento; el correo SHALL ser válido y no constituir evidencia de entrega.

Para completar la preparación de un receptor identificado (tipos `04`, `05`, `06` y `08`), el correo SHALL ser obligatorio, porque el comprobante debe enviarse al comprador. Un borrador SHALL poder guardarse sin correo. El tipo consumidor final `07` SHALL conservar el correo como dato opcional. Exigirlo al preparar SHALL NOT cambiar el registro del cliente, donde sigue siendo opcional, ni bloquear la confirmación o el cobro de la operación.

**Excepción controlada para el correo del cliente (`DP-036`, regla 4):** al completar los datos de una factura (desde «Cobrar y facturar» o desde la preparación fiscal), una casilla explícita —activada por omisión cuando el usuario tiene permiso para editar clientes— SHALL permitir guardar el correo del receptor en la ficha del cliente, dejando registro de auditoría en el cliente y sin modificar facturas ya preparadas ni la instantánea comercial. Si la ficha del cliente ya tenía un correo diferente, la interfaz SHALL mostrar ambos correos antes de confirmar el reemplazo. Si la casilla está desactivada, si el receptor elegido es consumidor final o si el usuario carece de permiso para editar clientes, el correo SHALL conservarse únicamente en esa preparación sin modificar la ficha del cliente. Las preparaciones completadas antes de esta regla SHALL conservarse sin cambios.

Trazabilidad: propuesta §4/5; propuesta `alinear-datos-del-comprobante-con-sri` §A.1; propuesta `cobrar-y-facturar-en-un-paso` (U6); DP-008/017/035 regla 1/036 regla 4; RN-CLI-003; RN-CON-002; `NOR-001`; ficha y advertencia SRI de validación de RUC.

#### Scenario: Completar dirección fiscal faltante
- **DADO** una operación cuyo cliente histórico carece de dirección
- **CUANDO** se completa el receptor de su preparación
- **ENTONCES** SHALL conservarse el dato fiscal nuevo y su responsable sin cambiar el documento interno confirmado.

#### Scenario: RUC sin algoritmo general aplicable
- **DADO** un RUC de formato admitido de una sociedad
- **CUANDO** no coincide con un algoritmo pensado para cédulas
- **ENTONCES** SHALL NOT rechazarse por esa razón ni etiquetarse como validado oficialmente.

#### Scenario: Cliente interno de longitud correcta pero no numérico
- **DADO** una identificación interna que contiene letras en un tipo CI
- **CUANDO** se intenta declarar preparada su información fiscal como cédula
- **ENTONCES** SHALL bloquearse señalando el formato incorrecto, sin corregirlo ni cambiar de tipo silenciosamente.

#### Scenario: Receptor identificado sin correo
- **DADO** un borrador de factura cuyo receptor es una cédula o un RUC, sin correo
- **CUANDO** se intenta completar la preparación
- **ENTONCES** SHALL permanecer en borrador con un impedimento que el usuario operativo puede completar y que pide el correo del receptor.

#### Scenario: Guardar el correo en la ficha del cliente con casilla activada y permiso
- **DADO** una operación de un cliente sin correo en su ficha (o con otro correo distinto mostrado en aviso) y un usuario con permiso para editar clientes
- **CUANDO** informa un correo válido, mantiene marcada la casilla «Guardar este correo en la ficha del cliente» y completa la preparación
- **ENTONCES** la instantánea fiscal SHALL conservar ese correo, la ficha del cliente SHALL actualizarse con ese correo registrando auditoría, y la instantánea comercial y las facturas anteriores SHALL permanecer sin cambios.

#### Scenario: Completar correo sin guardar en el cliente (casilla desmarcada o sin permiso)
- **DADO** una operación de un cliente sin correo en su ficha
- **CUANDO** el usuario desmarca la casilla de guardar en la ficha (o carece de permiso para editar clientes) y completa la preparación con un correo válido
- **ENTONCES** la instantánea fiscal SHALL conservar ese correo y la ficha del cliente SHALL seguir sin modificarse.

#### Scenario: Guardar un borrador sin correo
- **DADO** un borrador de un receptor identificado que aún no tiene correo
- **CUANDO** el usuario guarda sus cambios
- **ENTONCES** SHALL guardarse el borrador, y el correo SHALL exigirse solo al completar.

#### Scenario: Consumidor final sin correo
- **DADO** una operación de USD 30 cuyo receptor es consumidor final, elegido de forma explícita
- **CUANDO** se completa la preparación sin correo
- **ENTONCES** SHALL completarse sin impedimento por el correo y sin modificar el correo de la ficha del cliente operativo.

#### Scenario: Correo con formato inválido
- **DADO** un receptor con el correo «cliente-sin-dominio»
- **CUANDO** se guarda el borrador o se intenta completar la preparación
- **ENTONCES** SHALL rechazarse identificando el campo, sin corregir el valor ni tocar la ficha del cliente.

#### Scenario: Operación de un cliente sin correo
- **DADO** un cliente sin correo en su ficha
- **CUANDO** se confirma y se cobra una venta a su nombre
- **ENTONCES** ambas acciones SHALL completarse, porque el correo solo se exige al preparar la factura.

#### Scenario: Preparación completada antes de exigir el correo
- **DADO** una preparación completada antes de esta regla, con un receptor sin correo
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrarse tal como se conservó, sin pedir el correo ni cambiar su estado.

## ADDED Requirements

### Requirement: Preparación fiscal como paso interno del flujo único

La preparación fiscal local SHALL poder ejecutarse como paso interno del flujo «Cobrar y facturar» para cada operación confirmada del negocio autorizado, aplicando exactamente las mismas validaciones de emisor, receptor, líneas, formas de pago SRI, plazo y coherencia de la instantánea de formato 4 que la pantalla individual de preparación. La pantalla individual de preparación fiscal SHALL seguir disponible para consultar la instantánea, completar detalles adicionales (hasta 12 datos), ajustar notas de servicio o cancelar y reemplazar una preparación local.

Trazabilidad: `DP-035`; `DP-036` regla 2; `DP-037`; `RF-FIS-001/002`.

#### Scenario: Preparación completada internamente desde «Cobrar y facturar»
- **DADO** una operación comercial o artesanal recién confirmada en «Cobrar y facturar» con configuración fiscal válida y correo del receptor válido
- **CUANDO** se ejecuta el paso fiscal interno del flujo
- **ENTONCES** el sistema SHALL crear, revisar y completar la preparación local de esa operación con su instantánea inmutable de formato 4 en estado «Preparada, sin enviar», consultable luego desde «Facturas» y desde la ficha de la operación.
