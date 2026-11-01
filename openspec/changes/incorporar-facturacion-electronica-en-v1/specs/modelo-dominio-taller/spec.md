## RENAMED Requirements

- FROM: `### Requirement: Documentos internos y futura facturación`
- TO: `### Requirement: Documentos internos y facturación electrónica`

## MODIFIED Requirements

### Requirement: Documentos internos y facturación electrónica
V1 SHALL emitir documentos internos separados por entidad fiscal y SHALL indicar que no son facturas electrónicas autorizadas. Una factura electrónica autorizada SHALL ser un comprobante distinto del documento interno. La referencia fiscal SHALL mantener identidad y estado independientes de la operación.

Trazabilidad: `DP-034`, que sustituye en parte a `DP-018`; `DP-006`; `RN-CON-003`, `RN-CON-009`, `RN-CON-010`; `RF-VEN-009`, `RF-REP-014`.

#### Scenario: Confirmación y numeración
- **WHEN** se confirma una operación económica
- **THEN** SHALL asignarse una secuencia interna de su entidad fiscal que no pueda reutilizarse ni trasladarse al otro RUC

#### Scenario: Emisión independiente de la operación
- **WHEN** se autorice una factura electrónica de una operación confirmada
- **THEN** la autorización del SRI SHALL asociarse a la operación existente sin controlar por sí sola inventario, pagos o mantenimiento

#### Scenario: Fallo de emisión
- **DADO** una venta confirmada y cobrada
- **CUANDO** la emisión de su factura falla o es rechazada
- **ENTONCES** la venta y su cobro SHALL conservarse sin cambios.

#### Scenario: Documento interno de una operación ya facturada
- **DADO** una operación con factura electrónica autorizada
- **CUANDO** se consulta su documento interno
- **ENTONCES** este SHALL conservar su número interno y SHALL NOT presentarse como la factura autorizada.

## ADDED Requirements

### Requirement: Facturación electrónica incluida en V1
V1 SHALL comprometer la emisión de **facturas** y **notas de crédito** autorizadas por el SRI y la anulación de comprobantes. Los demás comprobantes electrónicos SHALL quedar fuera de V1.

Trazabilidad: `DP-034` regla 1; sustituye el límite de V1 sobre facturación y SRI; `alcance-v1.md` §2.2, §6 y `FUT-001`.

#### Scenario: Comprobante incluido
- **DADO** el alcance de V1
- **CUANDO** se consulta qué comprobantes electrónicos compromete
- **ENTONCES** SHALL indicar factura y nota de crédito, además de la anulación.

#### Scenario: Comprobante excluido
- **DADO** el alcance de V1
- **CUANDO** se consulta una guía de remisión, nota de débito, liquidación de compra o retención emitida
- **ENTONCES** SHALL constar como fuera de V1.

### Requirement: Emisión por proveedor reemplazable
La emisión SHALL realizarse mediante un **proveedor de emisión**, que genera el XML, lo firma, lo envía al SRI y genera el RIDE. Tallkit SHALL reunir los datos, solicitar la emisión, guardar el resultado y conservar su propia copia. Tallkit SHALL NOT firmar comprobantes ni custodiar la **firma electrónica**. Cambiar de proveedor SHALL significar agregar un **adaptador de emisión** y cambiar una configuración.

Trazabilidad: `DP-034` reglas 2 y 3; `ADR-0010`; `docs/cambios-pendientes.md`, regla de independencia del proveedor.

#### Scenario: Cambio de proveedor
- **DADO** un proveedor en uso
- **CUANDO** se decide cambiarlo por otro
- **ENTONCES** ventas, taller, cobros y pantallas SHALL NOT requerir cambios.

#### Scenario: Códigos propios del proveedor
- **DADO** un estado o código definido por un proveedor
- **CUANDO** se describe el modelo de dominio
- **ENTONCES** ese código SHALL NOT formar parte del dominio.

#### Scenario: Documentos neutrales
- **DADO** los documentos de producto, requisitos y modelo de dominio
- **CUANDO** describen la emisión
- **ENTONCES** SHALL usar «proveedor de emisión» y el nombre comercial SHALL constar únicamente en la decisión y en el plan.

#### Scenario: Firma electrónica
- **DADO** un emisor que usa un proveedor de emisión
- **CUANDO** se documenta dónde está su firma electrónica
- **ENTONCES** SHALL indicarse que la conserva el proveedor y no Tallkit.

### Requirement: Activación por entidad fiscal
V1 SHALL incluir las dos entidades fiscales y cada una SHALL activarse por separado para la facturación diaria. Una entidad SHALL exigir firma vigente, autorización real comprobada, numeración conciliada, política de conservación y restauración aplicable. La entidad comercial SHALL exigir además su RUC definitivo y la validación del redondeo del IVA. Una exigencia de la matriz de normas que condicione la emisión SHALL sumarse a estas condiciones. Esta capacidad no define quién activa: lo deciden los cambios de emisión.

Trazabilidad: `DP-034` regla 4; `DP-031`; `EXT-002`; `RN-FIS-005`, `RN-FIS-008`, `RN-FIS-014`.

#### Scenario: Artesanal activado antes que el comercial
- **DADO** un RUC artesanal que cumple sus condiciones y un RUC comercial que aún no
- **CUANDO** se activa el artesanal
- **ENTONCES** SHALL poder facturar sin esperar al comercial.

#### Scenario: Comercial sin validar el redondeo
- **DADO** un RUC comercial con RUC definitivo y firma vigente, sin validar el redondeo del IVA
- **CUANDO** se revisa su activación
- **ENTONCES** SHALL permanecer sin activar.

#### Scenario: Entidad sin activar
- **DADO** una entidad sin activar
- **CUANDO** confirma una operación y registra su cobro
- **ENTONCES** la operación y el cobro SHALL continuar con normalidad.

### Requirement: Operación sin Internet
La operación diaria SHALL depender de la computadora principal y de la red local. Solo la emisión SHALL necesitar Internet, y únicamente de salida. Sin Internet, la operación SHALL quedar registrada y su comprobante SHALL esperar en Tallkit. El acceso público desde Internet SHALL seguir fuera de V1. Este requisito SHALL NOT fijar la fecha ni el plazo del comprobante que esperó.

Trazabilidad: `DP-034` regla 6; `RNF-DIS-001`; `DP-025`; spec `normativa-de-facturacion-electronica`.

#### Scenario: Venta durante una caída de Internet
- **DADO** una red local activa sin salida a Internet
- **CUANDO** se confirma y se cobra una venta
- **ENTONCES** la venta y el cobro SHALL registrarse y su comprobante SHALL quedar en espera.

#### Scenario: Comprobante en espera
- **DADO** un comprobante en espera
- **CUANDO** se consulta
- **ENTONCES** SHALL NOT presentarse como autorizado.

#### Scenario: Acceso desde fuera del taller
- **DADO** la salida a Internet que usa la emisión
- **CUANDO** se describe el acceso a Tallkit
- **ENTONCES** SHALL constar que el acceso público sigue fuera de V1.

### Requirement: Transición hasta habilitar la emisión real
Registrar la decisión SHALL NOT habilitar la emisión real. Hasta archivar los cambios 3 y 4, el sistema SHALL seguir operando solo en pruebas y SHALL seguir rechazando producción. Las specs fiscales que hoy lo establecen SHALL considerarse coherentes con `DP-034` durante esa transición.

Trazabilidad: `DP-034` regla 8; `RF-FIS-003`, `RN-FIS-012`; `ADR-0010`; specs `identidad-y-numeracion-fiscal` y `configuracion-operativa-y-fiscal`.

#### Scenario: Producción durante la transición
- **DADO** este cambio archivado y los cambios 3 y 4 sin archivar
- **CUANDO** se solicita numerar en producción
- **ENTONCES** SHALL rechazarse como hasta ahora, sin consumir número.

#### Scenario: Spec fiscal vigente
- **DADO** una spec fiscal que todavía rechaza producción
- **CUANDO** se contrasta con `DP-034`
- **ENTONCES** SHALL mantenerse vigente hasta que su propio cambio la modifique.

### Requirement: Prueba real supervisada
Antes de la facturación diaria SHALL permitirse una **prueba real supervisada**: pocas facturas reales para comprobar la autorización del SRI, aunque falten la política de conservación y la restauración probada. Cada factura de la prueba SHALL corresponder a una operación real con un comprador que lo acepte, y su XML SHALL guardarse en el **archivo fiscal**. La cantidad y los casos SHALL fijarse en el cambio 4 antes de emitir. La prueba SHALL NOT sustituir las condiciones de activación.

Trazabilidad: `DP-034` regla 9; `RN-FIS-014`, `RF-FIS-006`; spec `archivo-de-comprobantes-fiscales`; decisión del titular del 2026-11-01.

#### Scenario: Prueba sin política de conservación
- **DADO** una entidad sin política ni restauración probada y un cambio 4 con cantidad y casos fijados
- **CUANDO** se emite una factura de la prueba
- **ENTONCES** SHALL admitirse y su XML SHALL guardarse en el archivo fiscal.

#### Scenario: Facturación diaria tras la prueba
- **DADO** una prueba real terminada, sin política ni restauración probada
- **CUANDO** se intenta facturar en la operación diaria
- **ENTONCES** SHALL mantenerse bloqueada.

#### Scenario: Operación ficticia
- **DADO** una operación inventada solo para probar
- **CUANDO** se propone usarla en la prueba real
- **ENTONCES** SHALL descartarse, porque la factura sería un documento tributario real.

#### Scenario: Prueba sin casos definidos
- **DADO** un cambio 4 sin cantidad ni casos fijados
- **CUANDO** se intenta emitir una factura real
- **ENTONCES** SHALL NOT emitirse.

### Requirement: Sincronización de la decisión de facturación
`DP-034` SHALL registrarse en las decisiones confirmadas y `DP-018` SHALL quedar marcada como sustituida en parte, conservando su texto. Los documentos no históricos SHALL alinearse con esa decisión. Las reglas que se mantienen SHALL conservarse y los asuntos aplazados SHALL figurar con su cambio responsable. Este cambio SHALL modificar únicamente documentación.

Trazabilidad: propuesta §B y §C; `docs/cambios-pendientes.md`, regla para cada cambio; `AGENTS.md`, precedencia.

#### Scenario: Decisión anterior sustituida
- **DADO** el archivo de decisiones confirmadas
- **CUANDO** se consulta `DP-018`
- **ENTONCES** SHALL indicar qué parte sustituye `DP-034` y qué parte sigue vigente.

#### Scenario: Documento que todavía excluye la facturación
- **DADO** un documento no histórico que declara la facturación electrónica fuera de V1 o para el futuro
- **CUANDO** se aplica este cambio
- **ENTONCES** SHALL actualizarse, incluido el contexto C4 que niega integraciones externas.

#### Scenario: Regla sobre documentos internos que se mantiene
- **DADO** una regla que dice que un documento interno no es una factura
- **CUANDO** se aplica este cambio
- **ENTONCES** SHALL conservarse.

#### Scenario: Requisito nuevo sin implementar
- **DADO** un requisito nuevo de emisión
- **CUANDO** se registra en la trazabilidad
- **ENTONCES** SHALL constar como pendiente con su cambio responsable y SHALL NOT constar como implementado.

#### Scenario: Asunto aplazado
- **DADO** la convivencia del documento interno con el RIDE y los permisos de emisión
- **CUANDO** se actualiza la documentación
- **ENTONCES** SHALL figurar como pendientes de los cambios 5, 3 y 7, sin resolverse.

#### Scenario: Plan actualizado
- **DADO** el redondeo del IVA sin cambio asignado y la prueba real sin registrar
- **CUANDO** se aplica este cambio
- **ENTONCES** el plan SHALL asignar el redondeo al cambio 2 y registrar la prueba real en el cambio 4.

#### Scenario: Límite del cambio
- **DADO** este cambio en aplicación
- **CUANDO** se revisan sus archivos modificados
- **ENTONCES** SHALL NOT incluir código, modelos, migraciones, endpoints, pantallas ni `modelo-datos.md`.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
