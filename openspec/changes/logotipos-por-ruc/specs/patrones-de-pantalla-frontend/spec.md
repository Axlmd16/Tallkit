## ADDED Requirements

### Requirement: PPF-09 Encabezado del documento interno con la identidad del emisor

Toda hoja de documento interno SHALL encabezarse con la identidad de su **entidad fiscal** emisora. Esto incluye la vista previa de un editor, el comprobante confirmado y su impresión. La venta y el ingreso de mercadería SHALL usar la entidad comercial, y la operación de servicios la entidad artesanal.

- Si la entidad tiene **logotipo**, el encabezado SHALL mostrarlo junto al nombre del emisor. El texto alternativo SHALL ser «Logo de» seguido de ese nombre. El logotipo SHALL mostrarse completo y sin deformarse, dentro de un alto y un ancho máximos que no desplacen el tipo de documento, el estado ni el número.
- Si la entidad no tiene logotipo, o su imagen no puede cargarse, el encabezado SHALL mostrar solo el nombre del emisor, sin espacio vacío ni imagen rota.
- Una hoja SHALL NOT mostrar nunca el logotipo de la otra entidad fiscal.
- El nombre del emisor SHALL ser el mismo que el documento usa según la regla vigente de historia de datos fiscales: el conservado al confirmar, o el vigente en un borrador.

El logotipo de Tallkit SHALL NOT ocupar el encabezado. La hoja SHALL conservar una mención discreta al pie, «Generado con Tallkit», en texto secundario pequeño, que no compita con el emisor ni con el aviso fiscal.

La impresión SHALL producirse con el logotipo ya cargado, o con el nombre si la carga falla, sin imprimir una imagen incompleta. El encabezado SHALL seguir siendo legible en A4 y en blanco y negro.

**Trazabilidad:** propuesta `logotipos-por-ruc` §7–9 y D1; `RN-FIS-009`; `DP-018`; `RNF-USA-012`; spec `configuracion-operativa-y-fiscal` («Historia de los datos fiscales»).

#### Scenario: Vista previa de un ingreso con logotipo comercial
- **WHEN** el Administrador edita un ingreso de mercadería y la entidad comercial tiene logotipo
- **THEN** la vista previa SHALL mostrar el logotipo comercial y el nombre del emisor en el encabezado, y «Generado con Tallkit» al pie

#### Scenario: Borrador de venta sin logotipo
- **WHEN** un Vendedor edita una venta y la entidad comercial no tiene logotipo
- **THEN** la vista previa SHALL mostrar solo el nombre del emisor en el encabezado, sin el isotipo de Tallkit

#### Scenario: Imagen que no carga
- **WHEN** la hoja intenta mostrar el logotipo y su carga falla
- **THEN** el encabezado SHALL mostrar el nombre del emisor sin imagen rota, y la impresión SHALL continuar con ese encabezado

#### Scenario: Logotipo muy ancho
- **WHEN** la entidad tiene un logotipo de 2000 × 200 px y se imprime un comprobante en A4
- **THEN** el logotipo SHALL reducirse proporcionalmente dentro del encabezado, sin desplazar el tipo de documento, el estado ni el número

## MODIFIED Requirements

### Requirement: PPF-05 Editor de documento con vista previa
Los editores de documentos económicos SHALL mostrar el formulario y una vista previa del documento interno como hoja imprimible. Hoy son la venta directa y el ingreso de mercadería. La hoja SHALL encabezarse con la identidad de su entidad emisora conforme a PPF-09.

La tabla de líneas SHALL:
- editarse fila por fila, sin tarjetas por línea;
- mostrar código, descripción y cantidad;
- mostrar precio, impuesto y total solo como valores del servidor, con guion cuando todavía no se han calculado.

El total de la operación SHALL estar visible junto a las acciones. La vista previa SHALL indicar que es un borrador, que el número está pendiente de confirmación y que el documento interno no constituye una factura electrónica autorizada por el SRI.

**Trazabilidad:** `DP-004`, `DP-017`, `DP-018`, `DP-025`, `DP-026`; `RNF-USA-010`, `RNF-USA-012`; secciones 7.1 y 11 de `interfaz-y-navegacion.md`; tablero «Nueva venta»; propuesta `logotipos-por-ruc` §7.

#### Scenario: Importe aún no calculado
- **WHEN** una línea tiene producto pero el servidor todavía no devolvió sus importes
- **THEN** precio, impuesto y total SHALL mostrarse con guion y SHALL NOT mostrarse ceros ni valores calculados por la interfaz

#### Scenario: Vista previa sin habilitar la confirmación
- **WHEN** la vista previa del borrador se actualiza con valores completos
- **THEN** la confirmación SHALL seguir requiriendo guardar el borrador y revisar la versión guardada

#### Scenario: Sin descuentos ni precio editable
- **WHEN** el usuario edita una línea de venta
- **THEN** SHALL NOT existir un campo de descuento ni un campo para editar precio o impuesto

#### Scenario: Existencias en la línea
- **WHEN** el editor muestra las existencias del producto elegido
- **THEN** SHALL mostrar la cantidad disponible y el estado «Agotado» cuando sea cero, y SHALL NOT clasificarla como baja mediante un umbral no decidido

#### Scenario: Encabezado del emisor en la vista previa
- **WHEN** se abre el editor de una venta directa o de un ingreso de mercadería
- **THEN** la hoja de vista previa SHALL encabezarse con la identidad de la entidad comercial conforme a PPF-09

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
