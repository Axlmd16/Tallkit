## ADDED Requirements

### Requirement: Incorporación automática de XML autorizado y RIDE desde el núcleo de emisión

Cuando el núcleo de emisión confirme que un comprobante electrónico alcanzó el estado `autorizada`, el sistema SHALL incorporar automáticamente en el **archivo fiscal** un expediente vinculado a la preparación y a la operación de origen que conserve:

- el XML autorizado original y su envoltorio de autorización, validados contra el esquema oficial local soportado y con su huella `SHA-256`;
- los bytes originales del documento **RIDE** en formato PDF devuelto por el adaptador, con su huella `SHA-256` y tamaño en bytes;
- la procedencia `EMISION_PROPIA`, el identificador del adaptador que lo emitió, el ambiente (`1` pruebas), la fecha de autorización y el nivel de verificación correspondiente (*Autorizado en ambiente de pruebas* cuando provenga del adaptador simulado en ambiente `1`).

La incorporación automática SHALL ser idempotente por clave de acceso e identidad documental: si el proceso de cola se repite sobre un comprobante ya archivado, SHALL recuperar el expediente existente sin duplicarlo ni sobrescribir sus bytes originales. Si el expediente ya tenía el XML archivado pero le faltaba el PDF del RIDE por un corte previo de descarga, la actualización SHALL adjuntar únicamente el RIDE faltante verificando su integridad, sin modificar los bytes ni el `SHA-256` del XML ya conservado.

Mientras el ambiente de producción (`2`) no esté habilitado conforme a `DP-034` regla 8 y `RN-FIS-014`, el archivo automático SHALL aceptar únicamente comprobantes del ambiente de pruebas (`1`) y SHALL rechazar cualquier intento de archivar un comprobante con ambiente `2`.

Trazabilidad: `DP-034`, reglas 2, 8 y 9; `RN-FIS-013`, `RN-FIS-014`, `RN-FIS-016`; `RF-FIS-010`; `ADR-0010`; `operacion-archivo-fiscal.md`; `docs/cambios-pendientes.md` (regla de independencia, punto 8; propuesta §A.5 y §B.8).

#### Scenario: Archivo automático completo al autorizarse una emisión en pruebas
- **DADO** una preparación fiscal comercial o artesanal cuya emisión con el adaptador simulado pasa a `autorizada` en ambiente de pruebas (`1`)
- **CUANDO** el núcleo recibe el XML autorizado y el PDF del RIDE
- **ENTONCES** SHALL crearse atómicamente el expediente en el archivo fiscal con los bytes y `SHA-256` del XML y del RIDE, vinculado a la operación y con procedencia `EMISION_PROPIA` en ambiente de pruebas, sin requerir carga manual del Administrador.

#### Scenario: Reintento idempotente o completado del RIDE sin sobrescribir el XML
- **DADO** un comprobante autorizado cuyo XML ya fue archivado en un intento previo
- **CUANDO** se repite el archivado del mismo comprobante o se completa la descarga del RIDE pendiente con la misma clave de acceso
- **ENTONCES** el sistema SHALL conservar intactos los bytes y el `SHA-256` del XML original, adjuntar el RIDE si faltaba y no crear un segundo expediente.

#### Scenario: Rechazo de comprobante en ambiente de producción durante el cambio 3
- **DADO** una respuesta que declara ambiente de producción (`2`) mientras la emisión productiva y la excepción de prueba real no están habilitadas
- **CUANDO** se intenta archivar automáticamente
- **ENTONCES** el sistema SHALL rechazar la incorporación productiva registrando la incidencia, sin almacenar como válido un comprobante de producción no habilitado.
