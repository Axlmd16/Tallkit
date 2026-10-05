## Why

La revisión del módulo fiscal contra el esquema oficial de factura 2.1.0 del **SRI** encontró tres defectos que harían rechazar un comprobante el día que el sistema emita, sea con emisión propia o mediante cualquier proveedor externo, porque el proveedor solo firma y transmite los datos que recibe:

1. **Las condiciones del emisor se guardan como texto libre.** El perfil admite cualquier texto de hasta 500 caracteres y la instantánea lo conserva como leyenda `clave: valor`. El esquema exige valores exactos: obligado a llevar contabilidad `SI` o `NO`, la leyenda `CONTRIBUYENTE RÉGIMEN RIMPE`, el número de resolución de agente de retención (hasta 8 dígitos) y el de contribuyente especial (hasta 13 caracteres alfanuméricos). Hoy puede guardarse «Sí», «no aplica» o una frase, y nada lo impide.
2. **El código de producto admite 64 caracteres y el esquema solo 25.** Ni el catálogo ni la preparación advierten un código que no cabe en `codigoPrincipal`.
3. **Los servicios no tienen código propio.** La preparación usa como código de línea el identificador interno de la base de datos, que no es un dato de negocio, no es estable ante una restauración y no dice nada a quien lee la factura.

Además, el titular confirmó el 2026-10-04 los datos reales del RUC artesanal (persona natural, régimen general, no obligado a llevar contabilidad, no agente de retención, no contribuyente especial, **artesano calificado**). La calificación artesanal sostiene la tarifa 0 % de IVA de los servicios y tiene vencimiento: si caduca sin que nadie lo note, el taller seguiría preparando comprobantes con una tarifa que ya no le corresponde. El sistema hoy guarda la calificación como una condición más, sin número, sin relación con la tarifa configurada y sin aviso previo al vencimiento.

Este cambio corrige la base. No emite, no firma, no transmite y no se acerca a ningún proveedor; deja los datos del emisor y de las líneas en una forma que cualquier emisión futura pueda usar sin transformaciones inseguras.

Fuentes consultadas: `docs/negocio/decisiones/decisiones-confirmadas.yaml` (DP-008, DP-017, DP-018, DP-025, DP-029, DP-030 y decisiones abiertas), `docs/arquitectura/modelo-dominio.md` (§11.5 y §11.6), specs `configuracion-operativa-y-fiscal`, `preparacion-y-seguimiento-fiscal`, `catalogo-de-productos-y-categorias` y `catalogo-de-servicios`, `docs/tecnico/matriz-instantanea-fiscal.md`, ADR-0010, el XSD `factura-2.1.0.xsd` conservado en el repositorio y el código de `workshop_configuration`, `fiscal` y `catalog`.

## What Changes

### A. Perfil del emisor con valores cerrados

1. **Régimen tributario** pasa a ser una lista cerrada: *General*, *RIMPE Emprendedor* y *RIMPE Negocio Popular*. La condición separada «RIMPE» desaparece del formulario porque queda determinada por el régimen: el sistema deriva la leyenda oficial y nadie la escribe.
2. **Obligado a llevar contabilidad** se declara como *Sí* o *No* y se conserva como `SI`/`NO`.
3. **Agente de retención** y **contribuyente especial** se declaran como *No aplica* o *Aplica*; cuando aplican exigen el número de resolución con el formato del esquema (dígitos, hasta 8; alfanumérico, hasta 13).
4. Cada condición conserva lo que ya tiene hoy: fundamento, inicio y fin de vigencia y responsable del registro. Sigue distinguiéndose «sin información» de «no aplica».
5. **Régimen RIMPE Negocio Popular** se puede declarar y la entidad **puede preparar facturas electrónicas**: el SRI permite a un negocio popular emitir notas de venta o, de forma voluntaria, comprobantes electrónicos. Como ese régimen no cobra IVA, la preparación exige que toda línea resuelva a IVA 0 % y explica el impedimento si no es así. La leyenda del comprobante de Negocio Popular queda pendiente de confirmar con la ficha técnica del SRI o con el proveedor; el régimen sí se conserva en la instantánea.
6. La **instantánea fiscal** de las preparaciones nuevas conserva estos datos como campos estructurados del emisor, no como leyendas de texto. Las preparaciones ya completadas no se modifican.

### B. Calificación artesanal

7. La calificación artesanal se declara con **número de calificación**, organismo que la otorgó, fecha de inicio y **fecha de vencimiento obligatoria**.
8. **Aviso previo al vencimiento.** La configuración muestra al Administrador una advertencia cuando faltan 60 días o menos para que venza, con la fecha y los días restantes. Vencida, el perfil pasa a *Requiere revisión*, como ya ocurre con cualquier condición fuera de vigencia.
9. **Coherencia con la tarifa.** Una entidad con calificación artesanal vigente solo puede preparar líneas cuya correspondencia tributaria sea IVA 0 %. Una entidad sin calificación vigente que intente preparar líneas de servicios a 0 % no recibe un bloqueo automático, porque existen otras razones legales para una tarifa cero; sí lo recibe la que declara calificación y usa otra tarifa, porque esa combinación es contradictoria.
10. El número de calificación se conserva en la instantánea como dato del emisor, disponible para la representación del comprobante.

El sistema sigue sin deducir la calificación por el tipo COMERCIAL/ARTESANAL: se declara con base en el documento vigente.

### C. Códigos de línea que caben en el comprobante

11. **Código de producto de hasta 25 caracteres.** El alta y la edición de productos rechazan códigos más largos. **BREAKING** para el contrato del catálogo: el máximo aceptado baja de 64 a 25.
12. **Productos existentes con código más largo.** Se conservan sin cambios y siguen operando en ventas e inventario. La preparación fiscal de una operación que los incluya queda con un impedimento que nombra el producto, y la lista de productos permite al Administrador encontrarlos para acortarlos. No se truncan ni se renombran de forma automática.
13. **Código propio de servicio.** Cada servicio recibe un código visible, único y estable, asignado por el sistema al crearlo (por ejemplo `SRV-000012`). Los servicios existentes reciben el suyo en la migración. Se muestra en el catálogo y en la operación artesanal, y es el que la preparación usa como código de línea.
14. La preparación comprueba además que la descripción de cada línea no supere los 300 caracteres del esquema, y bloquea con un impedimento en lugar de recortarla.

### D. Continuidad ante un cambio de régimen

16. **Cambio programado del código del SRI.** Un negocio que pasa de Negocio Popular (IVA 0 %) a Emprendedor (IVA 15 %) ya podía programar la tarifa interna, pero no el código del SRI de su correspondencia. El Administrador puede ahora programar el cambio de una correspondencia abierta: la actual termina el día anterior y la nueva rige desde una fecha futura, atómicamente y con la tarifa interna sucesora programada antes.
17. **Prueba de continuidad.** Un recorrido de punta a punta comprueba que antes del cambio se prepara con IVA 0 % y régimen Negocio Popular, y el día del cambio con IVA 15 %, régimen Emprendedor y su leyenda, sin alterar lo ya preparado.

### E. Verificación

15. La matriz `docs/tecnico/matriz-instantanea-fiscal.md` se actualiza con los campos estructurados del emisor y los límites de longitud comprobados.

### Decisiones que requieren aprobación

Las siguientes son recomendaciones. La propuesta se detiene aquí hasta que el titular las apruebe o las cambie.

- **D1 — Perfiles ya guardados.** Las revisiones anteriores del perfil se conservan como historia. La revisión vigente que tenga valores en texto libre se mostrará como *Falta completar* hasta que el Administrador la declare de nuevo con las opciones cerradas. *Alternativa descartada:* convertir el texto automáticamente, porque obligaría a interpretar frases libres y podría inventar un dato tributario.
- **D2 — Productos con código largo.** Conservarlos y bloquear solo su preparación fiscal (punto 12). *Alternativa:* obligar a corregirlos todos antes de desplegar, más limpia pero que detiene la operación diaria por un asunto que todavía no produce facturas.
- **D3 — Código de servicio.** Asignado por el sistema e inmutable (punto 13). *Alternativa:* que el Administrador lo escriba, lo que añade un campo obligatorio y un riesgo de duplicados sin beneficio claro para un taller.
- **D4 — Plazo del aviso de vencimiento.** 60 días. Es un valor fijo en esta entrega, no configurable.
- **D5 — Número de calificación en el comprobante.** No se encontró una norma que confirme si la factura electrónica del artesano debe mostrarlo. Se recomienda conservarlo en la instantánea y decidir su presentación en el cambio de emisión, cuando se conozca el formato del proveedor.

### Fuera de alcance

- Generación de XML, firma, transmisión, RIDE, entrega al comprador y cualquier integración con un proveedor externo.
- Habilitar el ambiente de producción.
- La regla de redondeo del IVA incluido en el precio (DP-025): corresponde al cambio `alinear-calculo-de-iva-con-el-sri`.
- Retenciones recibidas en cobros, preparación automática al confirmar, notas de crédito y plazo del crédito: cada uno tiene su propio cambio.
- Notas de venta preimpresas: este cambio no las genera; el negocio que las use las emite fuera del sistema.
- Una marca de «datos de prueba» para la entidad comercial. El titular confirmó que el RUC comercial cargado hoy es provisional y que se sustituirá por el definitivo al pasar a producción; no se añade ningún control para ello.
- Cambios en precios, tarifas internas, numeración interna, ventas, cobros o inventario.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `configuracion-operativa-y-fiscal`: el requisito «Perfil fiscal adicional sin alterar la configuración operativa» pasa de condiciones en texto libre a valores cerrados con formato; se añaden el número y el vencimiento de la calificación artesanal, el aviso previo al vencimiento y el cambio programado del código del SRI de una correspondencia.
- `preparacion-y-seguimiento-fiscal`: la instantánea conserva el emisor en campos estructurados; se añaden los impedimentos por código o descripción de línea que exceden el esquema por tarifa incoherente con la calificación artesanal y por una línea con IVA en un Negocio Popular; el código de línea de un servicio es su código propio.
- `catalogo-de-productos-y-categorias`: el código interno de producto admite como máximo 25 caracteres en altas y ediciones; los existentes más largos se conservan y pueden localizarse.
- `catalogo-de-servicios`: cada servicio tiene un código visible, único e inmutable asignado por el sistema.

## Impact

**Usuarios afectados.** El Administrador declara el perfil con opciones cerradas, ve el aviso de vencimiento y corrige los códigos largos. El Vendedor y el Encargado del taller ven el código del servicio y, si corresponde, un impedimento nuevo al preparar. Ningún rol gana ni pierde permisos.

**Reutilización, modificación y sustitución.**
- *Se reutiliza:* el historial de revisiones del perfil, los estados del perfil (*Sin configurar*, *Falta completar*, *Lista para preparación local*, *Requiere revisión*), el mecanismo de impedimentos de la preparación y la auditoría de configuración.
- *Se modifica:* la validación de condiciones (`workshop_configuration/domain/electronic_profile.py`), el cálculo del estado del perfil, el ensamble de la instantánea (`fiscal/application/snapshot_builder.py`, `fiscal/domain/snapshot.py`), la validación del catálogo (`catalog/domain/validation.py`) y el modelo de servicio.
- *Se sustituye:* las leyendas de texto `clave: valor` del emisor por campos estructurados en las instantáneas nuevas.

**Datos.** Migración aditiva: código de servicio con relleno para los existentes y restricción de unicidad. Las revisiones de perfil y las instantáneas anteriores no se reescriben. Las instantáneas nuevas usan un formato posterior al 2; las de formato 1 y 2 siguen leyéndose como hasta ahora.

**API y contrato.** Cambian los cuerpos de guardado y consulta del perfil electrónico, la respuesta de servicios (nuevo campo de código) y el límite del código de producto. Se actualiza el contrato OpenAPI. El único consumidor es la interfaz propia.

**Frontend.** Formulario del perfil tributario con selectores y campos condicionales, aviso de vencimiento de la calificación, código visible en el catálogo de servicios y en la operación artesanal, validación de longitud en el formulario de producto.

**Dependencias.** Ninguna dependencia nueva. No depende de otro cambio activo. Los cambios posteriores de preparación automática y de emisión dependen de este.

**Riesgos.**
- Un perfil vigente en texto libre quedará como *Falta completar* tras desplegar y bloqueará la preparación local hasta declararlo de nuevo (D1). Es un bloqueo de una función que hoy solo opera en ambiente de pruebas.
- Productos con código largo ya usados en ventas confirmadas no podrán prepararse hasta acortar el código; el acortamiento no altera las líneas históricas, que conservan su instantánea.
- La regla de coherencia entre calificación artesanal y tarifa 0 % es una comprobación local: no acredita que el beneficio sea legalmente aplicable ni sustituye la revisión del responsable tributario.

**Trazabilidad.** DP-008, DP-017, DP-018, DP-029; RN-FIS-001…010; RN-CAT-001; RF-ACC-010, RF-ACC-011; RF-CAT-001, RF-CAT-002, RF-CAT-010; CU-003; ADR-0010; XSD de factura 2.1.0 del SRI. Decisión abierta relacionada, que este cambio no cierra: «Tarifas y clasificación tributaria reales, reglas de redondeo y requisitos futuros de consumidor final y facturación electrónica».

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
