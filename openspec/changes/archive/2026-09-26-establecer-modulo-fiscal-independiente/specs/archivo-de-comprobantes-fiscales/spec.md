## ADDED Requirements

### Requirement: Incorporación administrativa de comprobantes externos

Solo el Administrador SHALL incorporar manualmente XML de factura o nota de crédito de una **entidad fiscal** configurada, conservando el contenido original, emisor, ambiente, tipo, número, clave, fecha de emisión declarada, origen de la carga, responsable y fecha de incorporación. Se SHALL distinguir el XML del comprobante y el envoltorio de autorización cuando se suministre; los datos declarados por ambos SHALL concordar. El documento SHALL identificarse como evidencia externa no verificada ante el SRI, aunque declare AUTORIZADO. Ningún rol SHALL convertir manualmente esa declaración en verificación oficial ni en ejecución de una solicitud local. SHALL NOT efectuarse consultas externas, crear ventas, pagos ni asignaciones de número por cargar un archivo. Trazabilidad: propuesta P1/P5; DP-018; RN-FIS-005/008; RN-CON-002/010.

#### Scenario: Archivo declara autorización
- **DADO** un XML coherente de factura del maestro con un envoltorio que declara AUTORIZADO
- **CUANDO** el Administrador lo incorpora
- **ENTONCES** SHALL conservarse el original y su declaración, mostrando evidencia externa no verificada, sin marcar autorizada una preparación local.

#### Scenario: Emisor ajeno
- **DADO** un XML cuyo RUC no pertenece a ninguna entidad configurada
- **CUANDO** se intenta incorporarlo a este archivo de emitidos
- **ENTONCES** SHALL rechazarse sin asociarlo por nombre parecido ni crear otro emisor.

#### Scenario: Usuario operativo intenta cargar
- **DADO** un Vendedor sin rol Administrador
- **CUANDO** intenta incorporar un XML
- **ENTONCES** SHALL denegarse sin guardar el documento ni revelar archivos existentes.

### Requirement: Validación segura sin atribuir autenticidad

La incorporación SHALL verificar que el contenido corresponde a un documento soportado y a una versión identificada de sus esquemas oficiales, validar estructura, tipos, clave y concordancia de identidad y totales. SHALL rechazar documento mal formado, envoltorio contradictorio, identificador fiscal inválido o versión no soportada, sin reparar ni reserializar el original. SHALL NOT resolver referencias externas, ejecutar instrucciones, acceder a la red o leer archivos locales indicados por el contenido. Límites de tamaño y complejidad SHALL documentarse y mostrarse antes de la carga; superarlos SHALL producir rechazo controlado. La validación estructural SHALL NOT presentarse como validación de firma, existencia o estado vigente del comprobante ante el SRI. Trazabilidad: propuesta §5 y P5; RNF-DIS-008; RN-SEG-007; ficha/XSD oficiales.

#### Scenario: Envoltorio y comprobante discrepan
- **DADO** un envoltorio cuyo número de autorización no corresponde a la clave del comprobante
- **CUANDO** se valida la carga
- **ENTONCES** SHALL rechazarse por inconsistencia sin seleccionar arbitrariamente uno de los valores.

#### Scenario: Contenido solicita un recurso externo
- **DADO** un XML con entidades externas o referencias que requieren leer recursos ajenos
- **CUANDO** se intenta incorporar
- **ENTONCES** SHALL rechazarse sin acceder a esos recursos ni incluir su contenido en errores.

#### Scenario: XML de versión desconocida
- **DADO** un comprobante que declara una versión sin esquema soportado
- **CUANDO** se incorpora
- **ENTONCES** SHALL rechazarse con explicación de la versión no soportada, sin interpretarlo como otra versión.

### Requirement: Duplicados y conflictos de identidad preservados

La **idempotencia** de incorporación SHALL impedir archivos duplicados ante reintentos y cargas concurrentes del mismo contenido. Se SHALL comprobar tanto clave como identidad por emisor, ambiente, tipo, establecimiento, punto y secuencial. Si una identidad ya registrada llega con contenido diferente, SHALL informarse conflicto y conservarse el original sin sobrescribirlo ni crear un segundo comprobante. Una evidencia adicional compatible, como el envoltorio de autorización del mismo comprobante, SHALL conservarse separada y relacionada, sin reemplazar bytes previos ni elevar su nivel de verificación. Un fallo SHALL NOT dejar un registro que aparente un archivo completo descargable sin contenido. Trazabilidad: propuesta P5; RF-AUD-003/006; RNF-INT-001/003/004/009; RNF-DIS-008.

#### Scenario: Cargas concurrentes idénticas
- **DADO** dos solicitudes autorizadas del mismo XML
- **CUANDO** se incorporan simultáneamente
- **ENTONCES** SHALL existir un único comprobante archivado recuperable por ambas solicitudes.

#### Scenario: Mismo número con otra clave o importe
- **DADO** un comprobante archivado
- **CUANDO** llega otro contenido con la misma identidad documental y distinta clave o importe
- **ENTONCES** SHALL informarse conflicto y conservarse el original íntegro, sin ocultar la diferencia.

#### Scenario: Falla al conservar contenido
- **DADO** una carga válida
- **CUANDO** falla el almacenamiento antes de completarla
- **ENTONCES** SHALL informarse incorporación fallida, sin registro de éxito ni archivo falsamente disponible.

### Requirement: Vinculación explícita y coherente con operaciones

El Administrador SHALL poder vincular una factura archivada a una única operación de su mismo emisor, comparando cliente/receptor, líneas, importes, moneda y tributos y revisando discrepancias. El vínculo SHALL exigir coherencia con los datos fiscales admitidos; consumidor final SHALL evaluarse sin alterar al cliente operativo. SHALL NOT aceptarse el vínculo si cambian emisor, total o tratamiento tributario respecto del origen. Diferencias de datos fiscales descriptivos SHALL quedar identificadas y justificadas, sin reescribir la operación. Archivar sin vínculo SHALL estar permitido para conservación del historial externo. Corregir un vínculo erróneo SHALL exigir motivo y conservar sus antecedentes. Una nota de crédito SHALL referenciar su factura externa de la misma entidad; si falta el original, SHALL quedar pendiente de vinculación sin inventarlo. Trazabilidad: propuesta §5/7 y P5; DP-017/018; RN-CON-002/007; RF-AUD-004.

#### Scenario: Factura artesanal y venta comercial
- **DADO** una factura del emisor artesanal y una venta comercial del mismo cliente
- **CUANDO** se intenta vincularlas
- **ENTONCES** SHALL rechazarse por entidad incompatible, aunque coincidan los totales.

#### Scenario: Conservación sin operación histórica
- **DADO** una factura externa válida para incorporación y sin operación registrada en Sys-Taller
- **CUANDO** el Administrador la archiva sin vínculo
- **ENTONCES** SHALL conservarse como evidencia no vinculada, sin crear una venta ni un cobro.

#### Scenario: Corregir asociación equivocada
- **DADO** un XML asociado por error a una operación
- **CUANDO** el Administrador corrige el vínculo con motivo
- **ENTONCES** SHALL conservarse la historia del vínculo anterior y revalidarse cualquier nueva asociación sin alterar el archivo.

### Requirement: Consulta y exportación con permisos e integridad

El Administrador SHALL consultar y exportar el archivo de ambas entidades. Vendedor y Encargado del taller SHALL acceder solamente a evidencias vinculadas a operaciones cuyo detalle fiscal puedan consultar según su ámbito; SHALL NOT obtener acceso general al archivo por conocer una clave o dirección de descarga. Las consultas SHALL mostrar emisor, ambiente, origen externo, fecha, identidad, vínculo y nivel de verificación. La exportación SHALL entregar los XML originales y una relación de sus identidades y procedencia; un PDF o enlace temporal SHALL NOT sustituirlos. Si la integridad falla o el contenido falta, SHALL mostrarse incidencia y no entregarse una copia diferente como si fuera original. Trazabilidad: propuesta P1/P5; RN-FIS-009; RN-SEG-007; RF-AUD-001/004.

#### Scenario: Descargar en otro ámbito
- **DADO** un Vendedor sin rol de taller que conoce la clave de una factura artesanal
- **CUANDO** intenta descargarla directamente
- **ENTONCES** SHALL denegarse sin revelar sus datos.

#### Scenario: Exportar archivo propio
- **DADO** XML incorporados de pruebas y producción
- **CUANDO** el Administrador exporta los de una entidad y ambiente
- **ENTONCES** SHALL recibir solo los seleccionados, con contenido original e identidades, sin depender de un proveedor externo.

### Requirement: Conservación y recuperación comprobables

Los XML y evidencias incorporados SHALL permanecer protegidos frente a edición o eliminación ordinarias, con un horizonte de conservación no menor de siete años desde su fecha de emisión y sin borrado automático al vencerlo. Desvincular, cancelar una preparación, desactivar usuarios o cambiar proveedor SHALL NOT eliminar el archivo. Antes de habilitar incorporación productiva SHALL existir procedimiento de respaldo de contenido y referencias y evidencia de restauración en un entorno distinto que compruebe integridad, permisos y vínculos. Si esa preparación operativa falta, SHALL bloquearse la incorporación productiva con explicación, permitiendo ejercicios de prueba. Esto SHALL NOT declararse cumplimiento del respaldo integral del taller. Trazabilidad: propuesta §5/P5; DA-003 acotada; RNF-DIS-002…006; SRI conservación documental.

#### Scenario: Restaurar un archivo fiscal
- **DADO** un respaldo con XML, identidades y vínculos
- **CUANDO** se restaura en el entorno de comprobación
- **ENTONCES** SHALL recuperarse el mismo contenido y relaciones con los permisos correspondientes y SHALL registrarse el resultado y responsable de la comprobación.

#### Scenario: Falta la preparación de recuperación
- **DADO** que no existe evidencia de respaldo y restauración aplicable al archivo
- **CUANDO** se intenta incorporar un XML productivo
- **ENTONCES** SHALL bloquearse informando el requisito operativo pendiente, sin afirmar conservación garantizada.

### Requirement: Conservación fiscal y solicitudes sobre datos personales

Antes de incorporar documentos reales, SHALL estar documentada y accesible al Administrador la política de tratamiento del archivo: finalidad fiscal, responsable por **entidad fiscal**, fundamento de conservación, plazos y restricciones, permisos, canal de atención de derechos y procedimiento de revisión al finalizar la conservación. SHALL distinguir documentos fiscales, datos operativos de contacto, auditoría, exportaciones y respaldos; un plazo fiscal SHALL NOT justificar conservar indefinidamente toda información personal. El procedimiento SHALL contemplar copias y restauraciones para evitar reintroducir datos cuya eliminación se hubiera ejecutado legítimamente. Trazabilidad: propuesta §5 y operación/seguridad; RNF-DAT-001…005; RNF-MAN-010; LOPDP y su reglamento, artículos 8 a 12.

Las solicitudes de acceso, rectificación o eliminación SHALL tramitarse mediante ese canal, verificando legitimación y alcance antes de entregar datos. Una solicitud de supresión SHALL NOT borrar automáticamente XML sujetos a conservación obligatoria ni alterar comprobantes inmutables: el responsable documentará la decisión, fundamento, alcance y respuesta conforme al procedimiento aplicable. Corregir un contacto operativo SHALL NOT reescribir el comprobante histórico. La atención podrá documentarse mediante un procedimiento administrativo; esta entrega no exige un portal de derechos, un módulo general de expedientes ni eliminación automática al vencer el plazo.

#### Scenario: Supresión durante conservación obligatoria
- **DADO** un XML fiscal sujeto a una obligación de conservación vigente y una solicitud acreditada de eliminación de datos del receptor
- **CUANDO** el responsable atiende la solicitud mediante el procedimiento documentado
- **ENTONCES** SHALL conservarse íntegro el XML y documentarse el fundamento de la decisión y la respuesta, evaluando por separado los datos ajenos a esa obligación.

#### Scenario: Rectificación de contacto
- **DADO** un comprobante archivado cuyo receptor informa un nuevo correo de contacto
- **CUANDO** se rectifica el contacto operativo por el procedimiento autorizado
- **ENTONCES** SHALL permanecer intacto el XML histórico, sin presentar la rectificación como modificación fiscal del comprobante.

#### Scenario: Archivo sin política de tratamiento
- **DADO** una instalación sin política documentada de tratamiento y atención de derechos del archivo
- **CUANDO** se intenta habilitar la incorporación de documentos reales
- **ENTONCES** SHALL bloquearse esa habilitación indicando el requisito pendiente, sin impedir ensayos con datos sintéticos.

Fuentes: [Reglamento de la LOPDP](https://spdp.gob.ec/wp-content/uploads/2024/12/04.pdf.pdf); [SRI: archivo obligatorio](https://www.sri.gob.ec/detalle-noticias?idnoticia=1021&marquesina=1) y [esquemas oficiales](https://www.sri.gob.ec/facturacion-electronica).
