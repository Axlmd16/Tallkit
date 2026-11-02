## Why

El módulo fiscal de `establecer-modulo-fiscal-independiente` funciona, pero su pantalla de preparación hace que el Vendedor y el Encargado del taller escriban datos técnicos que ya existen en la operación o que debería decidir el Administrador: ambiente, punto de emisión, medio SRI, importe declarado, plazo, unidad del plazo y fecha de referencia. Además, la configuración fiscal electrónica comparte una página larga con entidades, bodega, impuestos y series, y usa etiquetas técnicas como «Revisión 0» o «Código tarifa» sin explicación.

Este cambio convierte la configuración fiscal en una configuración realmente centralizada por **entidad fiscal**. Con ella, preparar los datos fiscales de una operación queda en revisar un resumen y completar solo lo que falta. No rehace el módulo ni lo acerca a ningún proveedor: AutorizadorEC, FactuPlan, Invoca y el **SRI** siguen fuera de alcance.

Estado: **propuesta aprobada con modificaciones** el 2026-09-26 (America/Guayaquil). Esta versión incorpora las decisiones del usuario sobre A1–A6, B7–B12, C13–C15, R1–R6, borradores existentes y fuentes oficiales. La aprobación habilita crear las specs y el diseño; no autoriza tareas ni implementación.

## What Changes

### A. Flujo simplificado de preparación fiscal

1. **Precarga automática.** Al pulsar «Preparar datos fiscales», la **entidad fiscal** se obtiene de la operación y el usuario nunca elige otro RUC. El receptor, las líneas, los impuestos, los totales y la condición de contado o crédito se copian de las instantáneas históricas de la operación confirmada. La instantánea del cliente traduce CI a cédula `05` y RUC a `04`, junto con nombre, dirección y correo.
2. **Mostrar solo lo faltante.** La pantalla muestra un resumen simple (operación, receptor, líneas y totales). El Vendedor o el Encargado completa solo información comprensible que realmente falte, como la dirección del receptor o las formas de pago previstas. Los problemas técnicos o de configuración se explican como impedimentos que debe resolver el Administrador.
3. **Campos técnicos ocultos.** La interfaz operativa no envía ni recibe como datos editables el ambiente, el punto de emisión, los códigos SRI, las revisiones, las versiones ni la fecha fiscal. Los resuelve el backend (R2).
4. **Formas de pago comprensibles.** El usuario ve solo las formas de pago SRI habilitadas para la entidad, con su descripción comprensible, y puede combinar varias. Los importes deben sumar exactamente el total del comprobante. El catálogo oficial no se limita a `01` y `20` (R3). La declaración inicial se muestra como sugerencia editable: si la operación tiene cobros, se sugiere su reparto (efectivo → `01`, transferencia → `20`); lo que falte por cobrar, o el total si no hay cobros, se sugiere con la **forma de pago predeterminada** de la entidad. Confirmar la preparación no registra ni modifica cobros.
5. **Instantánea fiscal.** Al completar la preparación se congelan el perfil, el establecimiento, el punto, el ambiente, los catálogos y las formas de pago utilizados, con sus revisiones y versiones. Los cambios futuros de configuración o catálogos no alteran documentos preparados.
6. **Terminología.** Se usan «Preparar datos fiscales», «Borrador fiscal», «Revisar datos para facturación», «Preparación local» y «Pendiente de emisión». Es obligatorio el aviso visible «Esta preparación todavía no es una factura electrónica. No ha sido firmada ni enviada al SRI.» Ninguna pantalla presenta una preparación como factura emitida, autorizada, enviada o aprobada por el SRI.

**Fecha fiscal de referencia.** Se resuelve en la revisión final, en America/Guayaquil, y se congela al completar la preparación. No depende de la zona horaria del navegador.

### B. Configuración centralizada (solo Administrador)

7. **Perfil tributario.** Tiene los estados de R4, cada uno con su causa explicada, nunca solo con un color o una etiqueta genérica. Nunca se afirma validación oficial del SRI. El formulario permite declarar las condiciones tributarias (régimen, contabilidad, contribuyente especial, agente de retención, RIMPE, calificación artesanal) con ayuda contextual. Hoy el diálogo no permite declararlas.
8. **Establecimientos y puntos.** Cada entidad puede tener varios puntos activos, pero debe existir uno predeterminado para preparar (R1). El único ambiente disponible es *Pruebas*.
9. **Impuestos y catálogo SRI.** Los códigos y tarifas se seleccionan desde catálogos oficiales versionados. No se escriben libremente ni se fijan permanentemente en el código tarifas como IVA 15 %. Cada correspondencia muestra un nombre comprensible (IVA 0 %, IVA 15 %, no objeto de IVA, exento) y el código oficial como información avanzada. «Fundamento» se explica como «Fuente o referencia que justifica esta correspondencia tributaria». Sin definiciones tributarias se muestra: «Primero debe configurarse el catálogo tributario de esta entidad». Una única opción interna se presenta como dato fijo, no como selector. Además se listan las correspondencias vigentes e históricas.
10. **Formas de pago fiscales.** Se muestra el catálogo completo de la Tabla 24 con código, descripción oficial, fuente, vigencia y estado de habilitación por entidad. Inicialmente solo `01` y `20` están habilitadas operativamente (R3, R6). El Administrador designa la forma de pago predeterminada de cada entidad entre las habilitadas, inicialmente `01`.
11. **Certificado electrónico.** Sus metadatos son opcionales y no bloquean la preparación local. Su ausencia o vencimiento produce una advertencia independiente, que no cambia el estado del perfil. Se aclara que son metadatos del certificado de firma que podría usarse en una emisión futura y que no equivalen a firma ni autorización. Los campos llevan nombres y ayuda comprensibles: referencia o identificador, titular, entidad emisora del certificado, fuente de la información, fecha de inicio y fecha de vencimiento. No se aceptan archivos P12, claves privadas ni contraseñas.
12. **Producción bloqueada.** No se puede configurar ni preparar en producción mientras no exista un cambio aprobado para firma, emisión y transmisión. El backend rechaza cualquier intento.

**Condiciones tributarias declaradas, no deducidas.** El sistema no deduce condiciones a partir de textos como «artesano calificado» ni del tipo COMERCIAL/ARTESANAL. El Administrador las declara con base en el certificado de RUC y la documentación vigente. Antes de una emisión en producción, el responsable tributario debe revisar esa configuración.

### C. Página de configuración

13. **Organización en pestañas.** Las pestañas son *Entidades fiscales*, *Bodega*, *Impuestos*, *Series y numeración* y *Facturación electrónica*. Siguen el patrón visual y de teclado de las fichas de mantenimiento, funcionan en pantallas pequeñas, admiten navegación directa o restauración de la pestaña y muestran sus errores dentro de su panel. La pestaña inicial es *Entidades fiscales*, salvo navegación directa.
14. **Reorganización solo visual.** Entidades, bodega, impuestos internos y series solo se reubican. No cambian sus modelos, API, permisos, reglas, formularios, validaciones ni datos, y las series internas (COM-VEN, ART-SER…) no se mezclan con la numeración fiscal. «Identidades fiscales» pasa a «Entidades fiscales», el término del glosario, para no confundirlo con la identidad fiscal de ensayo.
15. **Acceso exclusivo.** Solo el Administrador accede a la configuración. El Vendedor y el Encargado preparan datos fiscales, pero no modifican configuraciones.

La pestaña *Facturación electrónica* muestra de forma permanente: «Configuración para preparación local. La emisión electrónica todavía no está habilitada.» Tiene cinco subsecciones:

1. Perfil tributario.
2. Establecimientos y puntos de emisión.
3. Impuestos y catálogo SRI.
4. Formas de pago SRI.
5. Certificado electrónico.

### Decisiones aprobadas

**R1 — Punto predeterminado por entidad.**
- Si existe un único punto activo, se usa automáticamente.
- Si existen varios, el Administrador designa uno.
- Si ninguno está designado ni resulta determinable, se bloquea la preparación con un mensaje dirigido al Administrador.
- Requiere una migración aditiva.
- El punto pertenece a una entidad fiscal y nunca puede usarse para la otra.

**R2 — Ambiente fijo de pruebas.**
- El usuario operativo no selecciona el ambiente.
- El backend deja de aceptar `environment` y `point_id` desde el formulario de preparación. Es **BREAKING** para el contrato de edición del borrador, cuyo único consumidor es la propia interfaz.
- Solo se admite *Pruebas*. Producción permanece bloqueada hasta aprobar la integración real.
- Se actualiza el contrato OpenAPI.

**R3 — Separación entre condición comercial y formas de pago del SRI.**

Contado y crédito son condiciones internas que controlan el saldo de la operación y no se traducen directamente a un código de la Tabla 24 del SRI.

La configuración fiscal conserva el catálogo oficial completo y versionado de formas de pago, y el Administrador habilita las que usa cada entidad fiscal. La preparación puede contener una o varias formas de pago, cuyos importes deben sumar exactamente el total del comprobante.

En esta fase no se capturan, muestran ni exigen plazo ni unidad de tiempo en la preparación local, sea de contado o a crédito. La API los rechaza y los que conserven borradores anteriores no pasan a la instantánea. El sistema nunca inventa un plazo ni bloquea una preparación local porque la operación interna sea a crédito. La representación de un plazo real para la emisión electrónica queda pendiente de una spec futura.

| Código | Descripción de referencia |
|---|---|
| 01 | Sin utilización del sistema financiero |
| 15 | Compensación de deudas |
| 16 | Tarjeta de débito |
| 17 | Dinero electrónico |
| 18 | Tarjeta prepago |
| 19 | Tarjeta de crédito |
| 20 | Otros con utilización del sistema financiero |
| 21 | Endoso de títulos |

En V1 solo están habilitadas `01`, asociada inicialmente a efectivo o pago sin sistema financiero, y `20`, asociada inicialmente a transferencia. El catálogo completo existe porque lo exige el SRI. Las demás formas permanecen deshabilitadas hasta que el taller las use realmente y el sistema interno pueda registrarlas correctamente.

**R4 — Estados del perfil.** Cada estado explica su causa.

| Estado | Significado |
|---|---|
| Sin configurar | Todavía no existe un perfil guardado. |
| Falta completar | Faltan datos necesarios para preparar. |
| Lista para preparación local | Contiene lo necesario para preparar en ambiente de pruebas. |
| Requiere revisión | Una condición tributaria o correspondencia necesaria está fuera de vigencia. |

El certificado opcional no hace que el perfil deje de estar listo; su ausencia o vencimiento es una advertencia independiente.

**R5 — «Bodega» en singular.** V1 tiene una sola bodega (DP-001), así que la pestaña se llama *Bodega*.

**R6 — Tarjetas presentes en el catálogo, pero no habilitadas en V1.**
- Tarjeta de débito (`16`) y tarjeta de crédito (`19`) aparecen en el catálogo oficial y permanecen deshabilitadas para el uso operativo.
- No se agregan como medios internos de cobro en este cambio.
- Habilitarlas requiere otra decisión que actualice pagos, caja, cierres, reportes y conciliación (DP-003, DP-019, RF-ACC-014).

**Borradores existentes.**
- Las preparaciones completadas permanecen intactas.
- Los borradores existentes siguen siendo editables y sus antiguos campos técnicos no se muestran al usuario.
- Al revisarlos, el backend resuelve nuevamente la configuración vigente. Si falta configuración, muestra un impedimento administrativo.
- No se inventan datos ni se reescriben instantáneas históricas.
- El diseño decide si la adaptación se hace mediante migración o mediante una resolución compatible al leer. Las specs exigen el resultado, no la implementación.

**Fuentes y vigencia legal.**
- Toda entrada de catálogo oficial conserva código, descripción oficial, fuente, versión del catálogo o de la ficha técnica, fecha de vigencia, estado activo o inactivo y fecha de incorporación al sistema.
- Una actualización de catálogos no modifica preparaciones completadas.
- La fuente primaria es el SRI (ficha técnica, XSD y catálogos oficiales). Los documentos de FactuPlan, AutorizadorEC u otros proveedores pueden ayudar a interpretar una integración, pero no los reemplazan.

### Fuera de alcance

- Integración con proveedores, transmisión al SRI, firma electrónica o producción.
- P12, claves privadas o contraseñas.
- Cambios en ventas, cobros, deuda, inventario, cálculos monetarios o series internas.
- Nuevos medios internos de cobro. Las formas `15`–`19` y `21` solo existen en el catálogo, deshabilitadas.
- Nuevos roles, permisos personalizados o acceso del Vendedor o el Encargado a la configuración.
- Presentar una preparación como factura, o modificar instantáneas y preparaciones completadas.
- Rediseñar el archivo XML, las solicitudes de corrección o la identidad fiscal de ensayo, más allá de la terminología.
- Cambiar tipos de identificación u obligatoriedad de datos del cliente (DP-008).

## Capabilities

### New Capabilities

- `organizacion-de-la-configuracion`: página de configuración en pestañas y subsecciones de *Facturación electrónica*, con accesibilidad, navegación directa, errores por pestaña, adaptación a pantallas pequeñas, aviso permanente de preparación local, acceso exclusivo del Administrador y conservación íntegra de las funciones existentes.

### Modified Capabilities

- `preparacion-y-seguimiento-fiscal`:
  - precarga desde la operación y la configuración, y datos técnicos resueltos por el backend;
  - solicitud limitada a lo faltante y fecha fiscal resuelta en la revisión final;
  - formas de pago habilitadas y combinables, sugeridas desde cobros o la forma predeterminada, sin captura de plazo;
  - instantánea con referencias de configuración, borradores existentes y terminología obligatoria.
- `configuracion-operativa-y-fiscal`:
  - punto predeterminado (R1), ambiente de pruebas y producción bloqueada (R2);
  - catálogos oficiales versionados de impuestos y formas de pago, con habilitación y forma de pago predeterminada por entidad (R3, R6);
  - estados del perfil (R4) y declaración de condiciones sin deducción;
  - certificado opcional con advertencia independiente.
- `ventas-comerciales`: la acción y los estados visibles desde la venta usan la terminología obligatoria.
- `operacion-artesanal-de-servicios`: el mismo ajuste de terminología desde la operación artesanal.

## Impact

- **Backend:**
  - `fiscal/application/preparations.py` y `snapshot_builder.py`: precarga, resolución de punto, ambiente y fecha, y referencias de configuración.
  - `fiscal/domain/payment_declaration.py`: formas habilitadas, varias formas y rechazo de plazo y unidad.
  - `workshop_configuration`: catálogos oficiales versionados en lugar de las constantes `IVA_CODES` y `SUPPORTED_PAYMENT_CODES`, habilitación de formas de pago, punto predeterminado, estado del perfil y rechazo de producción.
  - Serializadores y OpenAPI de `/api/v1/fiscal/` y de la configuración electrónica.
  - En `sales` y `workshop` solo se amplían las lecturas públicas `fiscal_source` con lo cobrado por medio, para sugerir formas de pago; no cambian sus modelos, escrituras, cobros ni reglas. `shared/money.py` no se toca.
- **Frontend:**
  - Se reescriben `pages/fiscal/FiscalPreparationPage.tsx` y `features/fiscal/FiscalConfigurationSection.tsx`.
  - Se reorganiza `pages/workshop-configuration/WorkshopConfigurationPage.tsx` con `shared/ui/navigation/Tabs.tsx`.
  - Se ajustan textos en `SaleDetailPage.tsx`, `ServiceOperationDetailPage.tsx` y `FiscalPreparationLink.tsx`.
- **Datos:** migraciones aditivas de catálogos oficiales, habilitación de formas de pago y punto predeterminado. No se modifican preparaciones, instantáneas ni configuraciones existentes. Las correspondencias existentes conservan su versión de catálogo.
- **Permisos:** sin cambios en la matriz; se añaden pruebas positivas y negativas por rol y por combinación de roles.
- **Pruebas (focalizadas):**
  - Backend en `backend/tests/fiscal/` y `backend/tests/workshop_configuration/`.
  - Vitest de páginas y secciones afectadas.
  - E2E solo de preparación y configuración.
  - Cubren: precarga, permisos, configuración modificada después de preparar, que una preparación no se presente como factura, producción bloqueada, pestañas con teclado y sin regresiones.
- **Documentación:**
  - Glosario de producto y referencias terminológicas.
  - Requisitos y casos de uso (CU-003, CU-012), `interfaz-y-navegacion.md`, trazabilidad, `cobertura-modulo-fiscal.md` y `matriz-instantanea-fiscal.md`.
  - Modelo de dominio (§11.6), por el punto predeterminado y los catálogos oficiales.
- **Otro cambio activo:** `ajustar-venta-vinculada-vacia-y-textos-de-servicios` modifica textos de `ServiceOperationDetailPage.tsx`. Hay que coordinar para no pisar sus textos. No hay conflicto de reglas.

### Contradicciones resueltas e información pendiente

- **Crédito:** el código y la spec vigente bloqueaban el crédito sin plazo, contra DP-003. R3 lo resuelve sin capturar plazo en esta fase. Cómo representar un plazo real para la emisión queda para una spec futura, sujeta a la revisión del responsable tributario antes de producción.
- **Catálogos fijos en el código:** las constantes `IVA_CODES` y `SUPPORTED_PAYMENT_CODES` contradicen los catálogos versionados aprobados y se sustituyen.
- **Instantánea:** la actual no conserva la revisión del perfil ni las versiones del punto. Se corrige solo para preparaciones nuevas.
- **Tarjetas:** quedan en el catálogo pero deshabilitadas (R6). «Bodegas» en plural se resolvió con R5 y los estados del perfil, con R4.
- **Formularios:** la regla de no cambiar formularios se aplica a las cuatro primeras pestañas. *Facturación electrónica* se rediseña por la parte B.
- **Encabezados desactualizados:** `AGENTS.md` y `openspec/config.yaml` dicen que el dominio no está implementado. Se registra y no se corrige en este cambio.
- **Pendiente externo:** confirmar con la ficha técnica vigente del SRI las descripciones y la vigencia exactas de la Tabla 24 y de las tarifas de IVA antes de cargarlas. La lista de R3 es la estructura aprobada del catálogo inicial, no su fuente: cada entrada conservará la versión exacta de la ficha, la fecha de descarga y el archivo o manifiesto utilizado, y si la ficha difiere, prevalece la ficha.

### Fuentes consultadas

- `AGENTS.md`, `openspec/config.yaml`, `docs/negocio/decisiones/decisiones-confirmadas.yaml` (DP-001/003/006/008/018/019/025/027/029, CT-001) y `docs/arquitectura/modelo-dominio.md` (§11.6, invariante 25).
- Artefactos completos del cambio archivado `2026-09-26-establecer-modulo-fiscal-independiente`: propuesta P1–P5, specs, diseño D1–D14 y tareas.
- Specs principales: `preparacion-y-seguimiento-fiscal`, `configuracion-operativa-y-fiscal`, `ventas-comerciales`, `operacion-artesanal-de-servicios`, `patrones-de-pantalla-frontend` y `autorizacion-y-navegacion`.
- Requisitos RF-ACC-010…014, CU-003, CU-012 y RN-FIS-001…010.
- Código:
  - Frontend: `FiscalPreparationPage.tsx`, `FiscalConfigurationSection.tsx`, `WorkshopConfigurationPage.tsx` y `Tabs.tsx`.
  - Backend: `fiscal/application/preparations.py`, `snapshot_builder.py`, `fiscal/domain/payment_declaration.py` y `snapshot.py`, `workshop_configuration/application/fiscal_resolver.py` y `fiscal_tax_mapping.py`, `workshop_configuration/models.py` y `sales/application/fiscal_source.py`.
- Propuesta del cambio activo `ajustar-venta-vinculada-vacia-y-textos-de-servicios`.
- Decisiones del usuario sobre esta propuesta (2026-09-26).
