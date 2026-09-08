# Casos de uso

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.2 |
| Estado | Borrador para revisión |
| Fecha | 2026-08-04 |

> Los casos de uso describen interacciones funcionales de V1. Las validaciones de reglas y permisos se ejecutan en el backend incluso cuando no se repiten en cada paso.

## 1. Convenciones

- Actor principal: quien inicia el caso.
- Precondición: condición que debe cumplirse antes del primer paso.
- Garantía de éxito: estado observable cuando el flujo termina correctamente.
- Garantía mínima: condiciones que se preservan si el caso falla.
- Los flujos económicos de ambas entidades fiscales nunca se fusionan.

## 2. Catálogo

| ID | Caso de uso | Actor principal | Requisitos principales |
|---|---|---|---|
| CU-001 | Iniciar y cerrar sesión | Administrador / Vendedor / Encargado del taller | RF-ACC-001 a RF-ACC-004 |
| CU-002 | Administrar usuarios y asignar roles | Administrador | RF-ACC-005 a RF-ACC-009 |
| CU-003 | Configurar entidades y parámetros | Administrador | RF-ACC-010 a RF-ACC-014 |
| CU-004 | Gestionar cliente | Administrador / Vendedor / Encargado del taller | RF-CLI-001 a RF-CLI-005, RF-CLI-012 |
| CU-005 | Gestionar vehículo e historial | Administrador / Encargado del taller | RF-CLI-006 a RF-CLI-011 |
| CU-006 | Gestionar catálogos | Administrador | RF-CAT-001 a RF-CAT-012 |
| CU-007 | Registrar y confirmar ingreso de mercadería | Administrador | RF-INV-001 a RF-INV-005, RF-INV-014 |
| CU-008 | Consultar inventario y Kardex | Administrador / Vendedor / Encargado del taller | RF-INV-007, RF-INV-008, RF-INV-011, RF-REP-001, RF-REP-002 |
| CU-009 | Ajustar inventario | Administrador | RF-INV-009, RF-INV-010, RF-AUD-001 a RF-AUD-004 |
| CU-010 | Elaborar proforma | Administrador / Vendedor | RF-PRO-001 a RF-PRO-006, RF-PRO-010 |
| CU-011 | Convertir proforma en venta | Administrador / Vendedor | RF-PRO-007 a RF-PRO-009, RF-VEN-001 a RF-VEN-006 |
| CU-012 | Registrar y confirmar venta directa | Administrador / Vendedor | RF-VEN-001 a RF-VEN-010, RF-VEN-014, RF-VEN-015 |
| CU-013 | Registrar pago o abono | Administrador / Vendedor / Encargado del taller, según entidad | RF-PAG-001 a RF-PAG-010 |
| CU-014 | Registrar devolución | Administrador | RF-VEN-012, RF-VEN-013, RF-PAG-007, RF-AUD-001 a RF-AUD-004 |
| CU-015 | Anular operación confirmada | Administrador | RF-INV-006, RF-VEN-011, RF-PAG-008, RF-TAL-014, RF-AUD-001 a RF-AUD-004 |
| CU-016 | Gestionar catálogo de servicios | Administrador / Encargado del taller | RF-CAT-010, RF-CAT-011 |
| CU-017 | Registrar mantenimiento y servicios | Administrador / Encargado del taller | RF-TAL-001 a RF-TAL-009 |
| CU-018 | Vincular repuestos con mantenimiento | Encargado del taller; Administrador o Vendedor para confirmar | RF-TAL-010 a RF-TAL-012, RF-VEN-002, RF-VEN-016 |
| CU-019 | Finalizar o cancelar mantenimiento | Administrador / Encargado del taller | RF-TAL-013 a RF-TAL-016 |
| CU-020 | Consultar y exportar reportes | Administrador / Vendedor / Encargado del taller, según ámbito | RF-REP-001 a RF-REP-010 |
| CU-021 | Respaldar o restaurar el sistema | Administrador | RNF-DIS-002 a RNF-DIS-007 |

## 3. CU-001 — Iniciar y cerrar sesión

**Actor principal:** usuario interno.  
**Precondiciones:** la cuenta existe y el sistema está disponible.  
**Disparador:** el usuario abre la aplicación.

**Flujo principal**

1. El sistema muestra el formulario de acceso.
2. El usuario ingresa sus credenciales.
3. El sistema valida identidad, credencial y estado activo.
4. El sistema crea una sesión segura y carga permisos efectivos.
5. El sistema muestra la página inicial correspondiente.
6. Cuando el usuario elige cerrar sesión, el sistema invalida la sesión y vuelve al acceso.

**Alternativas y excepciones**

- 3a. Las credenciales no son válidas: se muestra un mensaje genérico y no se crea sesión.
- 3b. La cuenta está inactiva: se deniega el acceso sin revelar información sensible.
- 3c. Se supera el límite de intentos: se aplica la protección configurada y se registra el evento.
- 4a. La sesión expiró durante el uso: se solicita autenticar nuevamente sin ejecutar la acción pendiente.

**Garantía de éxito:** el usuario accede solo a acciones autorizadas o la sesión queda cerrada.  
**Garantía mínima:** ninguna credencial queda expuesta y ninguna acción de negocio se ejecuta sin sesión válida.

## 4. CU-002 — Administrar usuarios y asignar roles

**Actor principal:** administrador.  
**Precondiciones:** sesión válida con permisos de administración.

**Flujo principal**

1. El Administrador abre Usuarios.
2. Consulta, crea o edita el usuario requerido.
3. Asigna uno o más de los tres roles: Administrador, Vendedor o Encargado del taller.
4. El sistema valida unicidad, estado, roles y datos obligatorios.
5. El administrador confirma.
6. El sistema guarda el cambio y registra la acción crítica.

**Alternativas y excepciones**

- 4a. El identificador de usuario ya existe: se rechaza el registro.
- 4b. Se intenta activar un usuario sin rol o con un rol distinto de los tres permitidos: se rechaza la modificación.
- 5a. Se desactiva un usuario: se impide su próximo acceso, pero se conserva el historial.
- 5b. Se restablece una credencial: se genera un mecanismo temporal y no se revela la anterior.

**Garantía de éxito:** los permisos efectivos corresponden a la unión de los roles asignados.  
**Garantía mínima:** el cambio no altera la autoría de operaciones históricas.

## 5. CU-003 — Configurar entidades y parámetros

**Actor principal:** administrador.  
**Precondiciones:** sesión con permiso de configuración; información oficial disponible.

**Flujo principal**

1. El administrador selecciona la entidad fiscal comercial o artesanal.
2. Registra o actualiza sus datos permitidos.
3. Configura impuestos o tarifas con fecha de vigencia.
4. Configura series, secuenciales, umbrales y formas de pago habilitadas según decisiones aprobadas.
5. El sistema valida solapamientos, unicidad y permisos.
6. El administrador confirma y el sistema registra la auditoría.

**Alternativas y excepciones**

- 5a. Una vigencia se solapa de forma ambigua: se rechaza y se muestran los períodos en conflicto.
- 5b. Una serie o secuencial produciría duplicados: se rechaza.
- 5c. Se edita una configuración usada históricamente: se crea una nueva vigencia en lugar de alterar documentos.

**Garantía de éxito:** los parámetros futuros se aplican a la entidad y período correctos.  
**Garantía mínima:** ningún documento confirmado cambia retroactivamente.

## 6. CU-004 — Gestionar cliente

**Actor principal:** Administrador, Vendedor o Encargado del taller.  
**Precondiciones:** sesión con permisos de clientes.

**Flujo principal**

1. El actor busca al cliente para evitar duplicados.
2. Si no existe, elige crear; si existe, abre su ficha.
3. Registra o modifica los datos permitidos.
4. El sistema normaliza la identificación y busca coincidencias.
5. El actor resuelve advertencias y confirma.
6. El sistema guarda la ficha compartida para ambas entidades fiscales.

**Alternativas y excepciones**

- 4a. Existe la misma identificación: se impide duplicar y se ofrece abrir la ficha.
- 4b. Falta un dato definido como obligatorio en `DP-008`: se señala el campo.
- 5a. El Administrador desactiva el cliente: no podrá usarse en nuevas operaciones, pero conserva el historial.

**Garantía de éxito:** existe una única ficha utilizable por los procesos autorizados.  
**Garantía mínima:** los documentos históricos no cambian por editar la ficha.

## 7. CU-005 — Gestionar vehículo e historial

**Actor principal:** Administrador o Encargado del taller.  
**Precondiciones:** existe un cliente responsable; sesión autorizada.

**Flujo principal**

1. El actor busca por placa, VIN, cliente u otros datos.
2. Crea o abre la ficha del vehículo.
3. Registra datos y cliente responsable vigente.
4. El sistema normaliza placa y VIN y verifica duplicados.
5. El actor confirma.
6. Desde la ficha puede consultar el historial cronológico permitido.

**Alternativas y excepciones**

- 4a. La placa o VIN ya existe: se rechaza el duplicado y se muestra la ficha existente.
- 5a. Cambia el responsable: se registra el cambio sin trasladar ni borrar historial.
- 5b. El Administrador desactiva el vehículo: queda fuera de nuevos mantenimientos, pero permanece consultable.

**Garantía de éxito:** el vehículo queda identificado y conserva su continuidad histórica.

## 8. CU-006 — Gestionar catálogos

**Actor principal:** Administrador. El Encargado del taller gestiona únicamente servicios mediante `CU-016`.  
**Precondiciones:** sesión autorizada.

**Flujo principal**

1. El actor abre Productos, Servicios o Proveedores.
2. Busca un registro o crea uno nuevo.
3. Ingresa o modifica los datos permitidos.
4. El sistema valida códigos, importes, estado y referencias.
5. El actor confirma y el sistema guarda el cambio.

**Alternativas y excepciones**

- 4a. Código de producto repetido o importe negativo: se rechaza.
- 5a. Se desactiva un elemento: no se usa en operaciones nuevas y permanece en históricas.
- 5b. Se modifica precio: el nuevo valor no altera líneas históricas.
- 5c. Se marca un kit: se trata como producto completo, sin componentes automáticos.

**Garantía de éxito:** el catálogo actualizado se usa en operaciones futuras.

## 9. CU-007 — Registrar y confirmar ingreso de mercadería

**Actor principal:** Administrador.  
**Precondiciones:** proveedor y productos activos; bodega habilitada.

**Flujo principal**

1. El actor crea un ingreso y selecciona proveedor y bodega.
2. Agrega productos, cantidades y costos unitarios.
3. Guarda el documento en borrador para revisión.
4. Solicita confirmar.
5. El sistema vuelve a validar proveedor, líneas, permisos y estado.
6. En una transacción, asigna secuencial, crea movimientos de entrada, aumenta existencias y recalcula costos promedio.
7. El sistema muestra el documento confirmado y sus movimientos.

**Alternativas y excepciones**

- 3a. Guardar borrador: no cambia existencia ni costo.
- 5a. Hay datos inválidos o proveedor inactivo: se rechaza sin efectos.
- 6a. Ocurre un error: se revierte toda la transacción.
- 6b. La petición se repite: no se duplican ingreso ni movimientos.

**Garantía de éxito:** ingreso, existencias, costos y Kardex quedan consistentes.  
**Garantía mínima:** el borrador permanece revisable o la confirmación queda completamente revertida.

## 10. CU-008 — Consultar inventario y Kardex

**Actor principal:** Administrador, Vendedor o Encargado del taller.  
**Precondiciones:** sesión válida.

**Flujo principal**

1. El actor abre Inventario o Kardex.
2. Busca y filtra por producto, bodega, período, tipo u origen.
3. El sistema muestra existencia, stock bajo y movimientos según permisos.
4. El actor abre el documento de origen o exporta la consulta autorizada.

**Alternativas:** un usuario sin `productos.ver_costos` o `inventario.ver_valorizacion` no ve costos.  
**Garantía de éxito:** cada saldo puede explicarse por sus movimientos visibles.

## 11. CU-009 — Ajustar inventario

**Actor principal:** Administrador.  
**Precondiciones:** producto y bodega válidos; diferencia comprobada.

**Flujo principal**

1. El actor abre Ajustes de inventario.
2. Selecciona producto, bodega, sentido y cantidad.
3. Registra el motivo obligatorio.
4. El sistema muestra existencia anterior y resultado previsto.
5. El actor confirma.
6. El sistema valida política de stock y crea el movimiento de ajuste en una transacción.
7. Se registra usuario, fecha y motivo.

**Excepciones:** una cantidad inválida, motivo vacío o resultado contrario a `DP-002` cancela la operación.  
**Garantía de éxito:** la existencia cambia solo mediante un movimiento trazable.

## 12. CU-010 — Elaborar proforma

**Actor principal:** Administrador o Vendedor.  
**Precondiciones:** cliente y productos válidos.

**Flujo principal**

1. El actor crea una proforma y selecciona al cliente.
2. Define vigencia y agrega productos, cantidades, precios y descuentos permitidos.
3. El sistema calcula valores y muestra existencia solo como referencia.
4. El actor guarda, edita o emite el comprobante interno.
5. La proforma queda disponible para consulta o conversión.

**Alternativas y excepciones**

- 2a. El descuento excede el permiso: se solicita autorización o se rechaza.
- 4a. Se anula: conserva historial y no modifica ventas.
- 5a. Vence: deja de poder convertirse sin renovación autorizada.

**Garantía de éxito:** existe una oferta trazable sin reserva ni movimiento de stock.

## 13. CU-011 — Convertir proforma en venta

**Actor principal:** Administrador o Vendedor.  
**Precondiciones:** proforma vigente, no anulada y no convertida.

**Flujo principal**

1. El actor abre la proforma y solicita convertir.
2. El sistema crea una venta en borrador y copia los datos relevantes.
3. Recalcula precios, impuestos y disponibilidad vigentes.
4. El actor revisa diferencias y completa la condición de venta.
5. Continúa con `CU-012` para confirmar.
6. El sistema conserva el vínculo entre proforma y venta.

**Excepciones:** si la proforma venció, fue anulada o ya se convirtió, no se crea otra venta.  
**Garantía de éxito:** una única venta nueva queda relacionada; la proforma nunca afectó stock.

## 14. CU-012 — Registrar y confirmar venta directa

**Actor principal:** Administrador o Vendedor.  
**Precondiciones:** RUC comercial configurado; cliente y productos válidos.

**Flujo principal**

1. El actor crea una venta en borrador y selecciona cliente.
2. Agrega productos, cantidades, precios, descuentos y condición de venta.
3. El sistema calcula los valores y muestra disponibilidad.
4. El actor solicita confirmar.
5. El sistema vuelve a validar permisos, productos, precios, impuestos, cantidades y existencia.
6. En una transacción, asigna secuencial, congela valores históricos, genera salidas de Kardex y crea el importe exigible.
7. El sistema muestra la venta confirmada.
8. El actor registra el cobro mediante `CU-013` o deja saldo si es crédito.

**Alternativas y excepciones**

- 2a. Precio o descuento excede el permiso: se rechaza o requiere autorización.
- 5a. La existencia no cumple `DP-002`: se rechaza y se informa qué línea cambió.
- 6a. Otro usuario confirmó simultáneamente: se revalida bajo control transaccional.
- 6b. Falla cualquier efecto: toda la operación se revierte.
- 6c. La solicitud se repite: no duplica secuencial ni salida.

**Garantía de éxito:** venta, secuencial, cuenta por cobrar y Kardex son coherentes.  
**Garantía mínima:** ningún efecto parcial permanece.

## 15. CU-013 — Registrar pago o abono

**Actor principal:** Administrador en ambas entidades; Vendedor para repuestos; Encargado del taller para servicios.  
**Precondiciones:** documento confirmado, con saldo y de la entidad fiscal correspondiente.

**Flujo principal**

1. El actor abre el documento o cuenta por cobrar.
2. El sistema muestra entidad fiscal, total pagado y saldo.
3. El actor registra importe, fecha y una o varias formas habilitadas.
4. El sistema valida permisos, importes, entidad y sobrepago.
5. El actor confirma.
6. El sistema registra el pago, recalcula saldo y deriva el estado de pago.

**Alternativas y excepciones**

- 3a. Pago combinado: las partes deben sumar el importe total recibido.
- 4a. El pago pertenece a otra entidad: se rechaza.
- 4b. Excede el saldo: se rechaza mientras rija la regla provisional de `DP-005`.
- 5a. Falla la operación: no se guarda ninguna parte del pago.

**Garantía de éxito:** pago, saldo y estado son reproducibles y pertenecen a una sola entidad fiscal.

## 16. CU-014 — Registrar devolución

**Actor principal:** Administrador.  
**Precondiciones:** venta confirmada con cantidad todavía devolvible.

**Flujo principal**

1. El actor abre la venta original y selecciona Devolver.
2. Elige líneas, cantidades y registra motivo.
3. El sistema calcula el efecto sobre valores, existencia y saldo.
4. El actor confirma la devolución.
5. En una transacción, el sistema crea el documento de devolución, movimientos inversos y correcciones económicas aprobadas.
6. El sistema vincula la devolución con la venta original.

**Excepciones**

- 2a. La cantidad supera lo pendiente de devolver: se rechaza.
- 3a. Existen pagos afectados y `DP-005` no define el tratamiento: se detiene para aplicar el procedimiento autorizado.
- 5a. Falla un efecto: se revierte toda la operación.

**Garantía de éxito:** la devolución corrige inventario y valores sin borrar la venta.

## 17. CU-015 — Anular operación confirmada

**Actor principal:** Administrador.  
**Precondiciones:** documento anulable; motivo y procedimiento aplicable definidos.

**Flujo principal**

1. El actor abre el documento y selecciona Anular.
2. El sistema presenta sus efectos sobre inventario, pagos, saldos y vínculos.
3. El actor registra el motivo y resuelve dependencias requeridas.
4. El sistema valida estado, permiso y que no exista una anulación previa.
5. En una transacción, crea registros compensatorios y marca el documento como anulado.
6. Registra auditoría y muestra relaciones entre original y corrección.

**Excepciones**

- 3a. Hay pagos sin tratamiento válido: no se permite continuar.
- 4a. Ya está anulado: se devuelve el estado existente sin repetir efectos.
- 5a. Un efecto falla: se revierte la anulación completa.

**Garantía de éxito:** el efecto neto queda corregido y el historial completo permanece.

## 18. CU-016 — Gestionar catálogo de servicios

**Actor principal:** Administrador o Encargado del taller.  
**Precondiciones:** sesión con permiso.

**Flujo principal:** busca o crea un servicio, registra nombre y precio referencial, valida importes, confirma y activa o desactiva según necesidad.  
**Alternativa:** cambiar el precio no altera servicios ya copiados a mantenimientos.  
**Garantía de éxito:** el catálogo vigente queda disponible para mantenimientos futuros.

## 19. CU-017 — Registrar mantenimiento y servicios

**Actor principal:** Administrador o Encargado del taller.  
**Precondiciones:** cliente y vehículo activos; RUC artesanal configurado.

**Flujo principal**

1. El actor crea un mantenimiento para el cliente y vehículo.
2. Registra fecha, kilometraje, diagnóstico y observaciones.
3. Adjunta fotografías válidas cuando corresponda.
4. Agrega servicios del catálogo; el sistema copia sus precios referenciales.
5. Modifica precios aplicados si tiene permiso.
6. El sistema calcula la operación económica artesanal.
7. El actor guarda el mantenimiento en estado `registrado`.
8. Cuando corresponda, confirma la operación de servicios y registra pagos mediante `CU-013`.

**Alternativas y excepciones**

- 2a. Kilometraje menor al último: el sistema advierte y exige resolución.
- 3a. Archivo no permitido: se rechaza sin perder los demás datos.
- 5a. No tiene permiso: se conserva el precio copiado.
- 8a. No se confirma la operación económica: el mantenimiento puede continuar operativo sin mezclar estados.

**Garantía de éxito:** mantenimiento y operación artesanal quedan relacionados, pero con estados propios.

## 20. CU-018 — Vincular repuestos con mantenimiento

**Actor principal:** Encargado del taller; el Administrador o el Vendedor interviene para confirmar o cobrar la venta comercial.  
**Precondiciones:** mantenimiento registrado y productos activos.

**Flujo principal**

1. El Encargado del taller abre Repuestos utilizados dentro del mantenimiento.
2. Selecciona productos y cantidades.
3. El sistema crea o actualiza una venta comercial vinculada en borrador.
4. La vista muestra por separado servicios artesanales y repuestos comerciales.
5. El Administrador o el Vendedor revisa y confirma la venta mediante `CU-012`.
6. Los pagos comerciales se registran mediante `CU-013` y no afectan el saldo artesanal.

**Alternativas y excepciones**

- 3a. Ya existe una venta vinculada editable: se reutiliza, no se duplica.
- 5a. No hay existencia o permiso: la venta permanece sin confirmar y el mantenimiento no descuenta stock.
- 5b. El mantenimiento se finaliza: la venta no se confirma automáticamente.

**Garantía de éxito:** los repuestos salen por una venta comercial independiente y trazable.

## 21. CU-019 — Finalizar o cancelar mantenimiento

**Actor principal:** Administrador o Encargado del taller.  
**Precondiciones:** mantenimiento en estado `registrado`; permiso correspondiente.

**Flujo de finalización**

1. El actor solicita finalizar.
2. El sistema valida datos obligatorios y muestra el estado de documentos vinculados.
3. El actor confirma.
4. El sistema cambia el estado a `finalizado` y registra fecha y usuario.

**Flujo de cancelación**

1. El actor solicita cancelar y registra motivo.
2. El sistema muestra operaciones económicas vinculadas que requieren tratamiento independiente.
3. El actor confirma.
4. El sistema cambia el estado a `cancelado` y conserva historial.

**Excepciones:** una venta o pago confirmado no se anula automáticamente; una reapertura se rechaza mientras `DP-007` siga pendiente.  
**Garantía de éxito:** solo cambia el estado operativo del mantenimiento y se conserva separación fiscal.

## 22. CU-020 — Consultar y exportar reportes

**Actor principal:** Administrador, Vendedor o Encargado del taller, según el ámbito del reporte.  
**Precondiciones:** sesión válida y permiso del rol para el reporte solicitado.

**Flujo principal**

1. El Administrador puede seleccionar cualquier reporte; el Vendedor accede a Comercial e Inventario; el Encargado del taller accede a Artesanal e Inventario.
2. Define período, estado, entidad y otros filtros disponibles.
3. El sistema valida permisos y genera los datos desde operaciones válidas.
4. Muestra columnas, totales y entidad fiscal claramente identificados.
5. El actor abre un registro de origen o exporta el resultado.

**Excepciones:** un reporte sin permiso es denegado; los totales de ambos RUC no se fusionan.  
**Garantía de éxito:** la salida puede rastrearse a documentos y filtros.

## 23. CU-021 — Respaldar o restaurar el sistema

**Actor principal:** Administrador.  
**Precondiciones:** acceso técnico seguro y procedimiento documentado.

**Flujo de respaldo**

1. El Administrador inicia o verifica la tarea programada.
2. El procedimiento incluye base de datos y fotografías de forma coherente.
3. Se valida la integridad del resultado y se registra fecha, responsable y estado.

**Flujo de restauración**

1. El Administrador selecciona un respaldo verificado y confirma la restauración.
2. Se protege o detiene el acceso de usuarios según el procedimiento.
3. Se restauran base de datos y fotografías en conjunto.
4. Se ejecutan comprobaciones funcionales y de versión.
5. Se registra el resultado y se habilita el servicio si todo es correcto.

**Excepciones:** un respaldo incompleto, incompatible o no verificable no se restaura sobre la instalación activa.  
**Garantía de éxito:** el sistema recuperado conserva relaciones entre datos y archivos.  
**Garantía mínima:** existe un camino documentado para volver al estado previo o mantener la instalación protegida.

## 24. Relaciones include/extend relevantes

- `CU-011` incluye la creación de venta y continúa con `CU-012`.
- `CU-012` puede incluir `CU-013` para cobro inmediato.
- `CU-017` puede incluir `CU-013` para pagos artesanales.
- `CU-017` puede extenderse con `CU-018` cuando se utilizan repuestos.
- `CU-014` y `CU-015` incluyen registro de auditoría y pueden requerir corrección de pagos.
- `CU-020` puede abrir los documentos generados por los demás casos, sujeto a permisos.
