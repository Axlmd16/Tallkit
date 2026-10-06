# Casos de uso

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.3 |
| Estado | Alineado con el modelo de dominio aprobado |
| Fecha | 2026-09-08 |

> Los casos de uso describen interacciones funcionales de V1. Las validaciones de reglas y permisos se ejecutan en el backend incluso cuando no se repiten en cada paso.

## 1. Convenciones

- Actor principal: quien inicia el caso.
- Precondición: condición que debe cumplirse antes del primer paso.
- Garantía de éxito: estado observable cuando el flujo termina correctamente.
- Garantía mínima: condiciones que se preservan si el caso falla.
- Los flujos económicos de ambas **entidades fiscales** nunca se fusionan.

## 2. Catálogo

| ID | Caso de uso | Actor principal | Requisitos principales |
|---|---|---|---|
| CU-001 | Iniciar y cerrar sesión | Administrador / Vendedor / Encargado del taller | RF-ACC-001 a RF-ACC-004 |
| CU-002 | Administrar usuarios y asignar roles | Administrador | RF-ACC-005 a RF-ACC-009 |
| CU-003 | Configurar entidades y parámetros | Administrador | RF-ACC-010 a RF-ACC-014 |
| CU-004 | Gestionar cliente | Administrador / Vendedor / Encargado del taller | RF-CLI-001 a RF-CLI-005, RF-CLI-012, RF-CLI-014 |
| CU-005 | Gestionar vehículo e historial | Administrador / Encargado del taller | RF-CLI-006 a RF-CLI-011 |
| CU-006 | Gestionar catálogos | Administrador | RF-CAT-001 a RF-CAT-016 |
| CU-007 | Registrar entrada de stock | Vendedor / Administrador | RF-INV-001 a RF-INV-005, RF-INV-014 |
| CU-008 | Consultar inventario y Kardex | Administrador / Vendedor / Encargado del taller | RF-INV-007, RF-INV-008, RF-INV-011, RF-REP-001, RF-REP-002 |
| CU-009 | Ajustar inventario | Administrador | RF-INV-009, RF-INV-010, RF-AUD-001 a RF-AUD-004 |
| CU-010 | Elaborar proforma | Administrador / Vendedor | RF-PRO-001 a RF-PRO-006, RF-PRO-010, RF-PRO-011 |
| CU-011 | Convertir proforma en venta | Administrador / Vendedor | RF-PRO-007 a RF-PRO-009, RF-VEN-001 a RF-VEN-006 |
| CU-012 | Registrar y confirmar venta | Administrador / Vendedor | RF-VEN-001 a RF-VEN-010, RF-VEN-014 a RF-VEN-016 |
| CU-013 | Registrar pago o abono | Administrador / Vendedor / Encargado del taller, según entidad | RF-PAG-001 a RF-PAG-015 |
| CU-014 | Registrar devolución o reembolso | Administrador | RF-VEN-012, RF-VEN-013, RF-VEN-017, RF-VEN-018, RF-PAG-007, RF-AUD-001 a RF-AUD-004 |
| CU-015 | Anular operación confirmada | Administrador | RF-INV-006, RF-VEN-011, RF-PAG-008, RF-TAL-014, RF-AUD-001 a RF-AUD-004 |
| CU-016 | Gestionar catálogo de servicios | Administrador / Encargado del taller | RF-CAT-010, RF-CAT-011 |
| CU-017 | Registrar mantenimiento y servicios | Administrador / Encargado del taller | RF-TAL-001 a RF-TAL-009 |
| CU-018 | Vincular repuestos con mantenimiento | Encargado del taller; Administrador o Vendedor para confirmar | RF-TAL-010 a RF-TAL-012, RF-VEN-002, RF-VEN-016 |
| CU-019 | Finalizar, cancelar o reabrir mantenimiento | Administrador / Encargado del taller | RF-TAL-013 a RF-TAL-020 |
| CU-020 | Consultar y exportar reportes | Administrador / Vendedor / Encargado del taller, según ámbito | RF-REP-001 a RF-REP-014 |
| CU-021 | Respaldar o restaurar el sistema | Administrador | RNF-DIS-002 a RNF-DIS-007 |
| CU-022 | Desarmar kit comprado | Administrador | RF-INV-016 |
| CU-023 | Registrar consumo interno | Administrador / Vendedor; solicitud del Encargado | RF-INV-017 |
| CU-024 | Registrar reposición por corrección | Administrador | RF-INV-018, RF-TAL-016, RF-TAL-020 |
| CU-025 | Devolver mercadería a proveedor | Administrador | RF-INV-019 |
| CU-026 | Confirmar cierre diario | Administrador | RF-REP-011, RF-REP-012 |
| CU-027 | Preparar información fiscal | Administrador / Vendedor / Encargado según ámbito | RF-FIS-001…003 |
| CU-028 | Incorporar evidencia fiscal externa | Administrador | RF-FIS-004, RF-FIS-006 |
| CU-029 | Preparar una corrección fiscal | Administrador | RF-FIS-005 |
| CU-030 | Registrar readiness del archivo | Administrador | RF-FIS-006 |

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
4a. En la pestaña *Facturación electrónica* declara el perfil tributario (régimen y contabilidad con listas cerradas, agente de retención y contribuyente especial con su número de resolución solo cuando aplican, y la calificación artesanal con número, organismo y vencimiento), los establecimientos y el punto predeterminado, las correspondencias con el catálogo oficial del SRI, las formas de pago SRI habilitadas (en V1 solo 01 y 20) y, de forma opcional, los metadatos del certificado. El sistema muestra el estado del perfil con sus causas y mantiene producción bloqueada.
5. El sistema valida solapamientos, unicidad y permisos.
6. El administrador confirma y el sistema registra la auditoría.

**Alternativas y excepciones**

- 5a. Una vigencia se solapa de forma ambigua: se rechaza y se muestran los períodos en conflicto.
- 5b. Una serie o secuencial produciría duplicados: se rechaza.
- 5c. Se edita una configuración usada históricamente: se crea una nueva vigencia en lugar de alterar documentos.
- 5d. Se intenta habilitar una forma de pago distinta de 01 o 20, configurar producción o designar un punto de otra entidad: se rechaza sin cambios.
- 5e. Se cambia la configuración fiscal después de preparar datos fiscales: las preparaciones locales completadas conservan la configuración que usaron.
- 5f. Un valor queda fuera de las opciones o su formato no es el del comprobante, o la calificación artesanal no trae vencimiento: se rechaza el campo sin guardar una revisión parcial.
- 5g. La calificación artesanal vence en 60 días o menos: se muestra un aviso con la fecha y los días restantes; vencida, el perfil requiere revisión y no se preparan facturas de esa entidad.
- 5h. La revisión vigente del perfil está escrita como texto libre: se muestra como pendiente de declarar de nuevo y la anterior se conserva como historia.

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
- 4b. Falta un dato obligatorio de `DP-008` (nombre o razón social, tipo de identificación, identificación o teléfono): se señala el campo. Email y dirección pueden omitirse.
- 4c. Coinciden nombre o teléfono con otra ficha, pero la identificación es distinta: se advierte sin bloquear y el actor puede revisar la ficha o continuar.
- 5a. El Administrador desactiva el cliente: no podrá usarse en nuevas operaciones, pero conserva el historial.

**Garantía de éxito:** existe una única ficha utilizable por los procesos autorizados.  
**Garantía mínima:** los documentos históricos no cambian por editar la ficha.

## 7. CU-005 — Gestionar vehículo e historial

**Actor principal:** Administrador o Encargado del taller.  
**Precondiciones:** existe un cliente propietario; sesión autorizada.

**Flujo principal**

1. El actor busca por placa, VIN, cliente u otros datos.
2. Crea o abre la ficha del vehículo.
3. Registra datos y cliente propietario vigente.
4. El sistema normaliza placa y VIN y verifica duplicados.
5. El actor confirma.
6. Desde la ficha puede consultar el historial cronológico permitido.

**Alternativas y excepciones**

- 3a. Falta la marca en el catálogo: si el actor tiene permiso de gestión de marcas (Administrador o Encargado del taller) puede crearla sin perder el borrador del vehículo; de lo contrario solicita su alta.
- 4a. La placa o VIN ya existe, incluso en un vehículo inactivo: se rechaza el duplicado y se muestra la ficha existente.
- 4b. Falta la placa, la marca, el modelo o el propietario: se señala el campo. Color, año y VIN son opcionales.
- 5a. Cambia el propietario: se cierra el período anterior y se abre otro sin trasladar ni borrar historial.
- 5b. El Administrador desactiva el vehículo: queda fuera de nuevos mantenimientos, pero permanece consultable.

**Garantía de éxito:** el vehículo queda identificado y conserva su continuidad histórica.

> **Estado de implementación:** `CU-004` y `CU-005` están implementados por `openspec/changes/archive/2026-09-24-gestionar-clientes-y-vehiculos` para fichas, propiedad y períodos de propiedad. La consulta cronológica de mantenimientos y documentos vinculados (`RF-CLI-011`) no forma parte de esa entrega y depende de las capacidades de taller y ventas. Evidencia: [cobertura-clientes-vehiculos.md](cobertura-clientes-vehiculos.md).

> **Estado de implementación:** `CU-006` y `CU-016` están implementados en el cambio `openspec/changes/archive/2026-09-24-gestionar-catalogos-productos-servicios-proveedores` para productos, categorías, unidades, marcas de producto, compatibilidades, servicios y proveedores. No incluyen existencias, costos ni operaciones de compra, venta o mantenimiento. La alternativa 6a (impresión de etiquetas) se implementa en el cambio `imprimir-etiquetas-de-productos`. Evidencia: [cobertura-catalogos.md](cobertura-catalogos.md).

## 8. CU-006 — Gestionar catálogos

**Actor principal:** Administrador. El Encargado del taller gestiona únicamente servicios mediante `CU-016`.  
**Precondiciones:** sesión autorizada.

**Flujo principal**

1. El actor abre Productos, Servicios o Proveedores.
2. Busca un registro o crea uno nuevo.
3. Ingresa o modifica producto, presentación, unidad, marca de producto, compatibilidad con marca de vehículo, servicio o proveedor.
4. El sistema valida códigos, importes, estado y referencias.
5. El actor confirma y el sistema guarda el cambio.

**Alternativas y excepciones**

- 4a. Código interno repetido o de más de 25 caracteres, código del fabricante repetido para la misma marca o importe negativo: se rechaza.
- 5a. Se desactiva un elemento: no se usa en operaciones nuevas y permanece en históricas.
- 5b. Se modifica precio: el nuevo valor no altera líneas históricas.
- 5c. Se marca un kit comprado: se trata como producto completo; cualquier desarme se realiza con `CU-022`.
- 5d. Se crea una presentación diferente: se registra como otro producto con código, existencia, costo y precio propios.
- 6a. Imprimir etiquetas: desde la lista (selección manual o «Todos los del filtro actual») o desde la ficha, cualquier rol con `productos.ver` abre la preparación, ajusta copias y posición inicial, revisa la vista previa e imprime hojas A4 de 100 × 55 mm. Un código interno no representable en **Code 128** bloquea la impresión y se informa sin modificar el producto. Imprimir no altera catálogo, inventario ni auditoría.

**Garantía de éxito:** el catálogo actualizado se usa en operaciones futuras.

## 9. CU-007 — Registrar entrada de stock

**Actor principal:** Vendedor o Administrador.

**Precondiciones:** productos activos; bodega y serie COM-ING configuradas.

**Flujo principal**

1. El actor busca o escanea los productos que llegaron y ajusta su cantidad.
2. Opcionalmente indica proveedor, referencia, observación y costos.
3. Solicita revisar; el sistema muestra cuántos productos y unidades entran, sin costos.
4. Confirma.
5. El sistema vuelve a validar productos, proveedor, permisos y configuración.
6. En una transacción, asigna secuencial, crea movimientos de entrada, aumenta existencias y, si hay costo, recalcula el promedio.
7. El sistema avisa el número asignado y deja el formulario listo para otra entrada.

**Alternativas y excepciones**

- 3a. Cancelar la revisión: no se guarda nada; lo escrito se conserva en pantalla.
- 3b. Hoy ya hay una entrada igual: se advierte y exige reconocerla para continuar.
- 5a. Hay datos inválidos o un producto o proveedor inactivo: se rechaza sin efectos.
- 6a. Ocurre un error: se revierte toda la transacción.
- 6b. La petición se repite: no se duplican la entrada ni los movimientos.
- 6c. Un producto sin costo recibe su primera entrada con costo: se valoran a ese costo las unidades previas y se deja constancia.

**Garantía de éxito:** entrada, existencias, costos y Kardex quedan consistentes.  
**Garantía mínima:** no queda ningún registro parcial.

## 10. CU-008 — Consultar inventario y Kardex

**Actor principal:** Administrador, Vendedor o Encargado del taller.  
**Precondiciones:** sesión válida.

**Flujo principal**

1. El actor abre Inventario o Kardex.
2. Busca y filtra por producto, bodega, período, tipo u origen.
3. El sistema muestra existencia, cantidad reservada, disponibilidad, stock bajo y movimientos según permisos.
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
**Precondiciones:** productos válidos.

**Flujo principal**

1. El actor crea una proforma y, si la persona está registrada, selecciona al cliente; el cliente es opcional.
2. Define la vigencia (7 días sugeridos, ajustables antes de emitir) y agrega productos y cantidades; el precio final proviene del catálogo y no se edita, sin descuentos.
3. El sistema calcula valores y muestra existencia solo como referencia.
4. El actor guarda y edita el borrador; al emitir, la proforma recibe su número y su contenido queda inmutable.
5. La proforma queda disponible para consulta o conversión.

**Alternativas y excepciones**

- 4a. Se anula: conserva historial y no modifica ventas.
- 4b. El cliente pide cambios sobre una proforma emitida: se crea una nueva proforma vinculada; la emitida no se edita.
- 5a. Vence: no se reactiva; si el cliente retoma la oferta se crea una nueva proforma vinculada.

**Garantía de éxito:** existe una oferta trazable sin reserva ni movimiento de stock.

## 13. CU-011 — Convertir proforma en venta

**Actor principal:** Administrador o Vendedor.  
**Precondiciones:** proforma vigente, no anulada y no convertida.

**Flujo principal**

1. El actor abre la proforma y solicita convertir; si la proforma no tiene cliente, elige uno registrado, que la venta exige.
2. El sistema crea una venta en borrador y copia los datos relevantes.
3. Recalcula precios, impuestos y disponibilidad vigentes y muestra las diferencias respecto de lo cotizado; la falta de disponibilidad avisa, pero no impide crear el borrador.
4. El actor revisa diferencias, puede ajustar productos y cantidades sin alterar la proforma y completa la condición de venta.
5. Continúa con `CU-012` para confirmar.
6. El sistema conserva el vínculo entre proforma y venta.

**Excepciones:** si la proforma venció, fue anulada o ya se convirtió, no se crea otra venta.  
**Garantía de éxito:** una única venta nueva queda relacionada; la proforma nunca afectó stock.

## 14. CU-012 — Registrar y confirmar venta

**Actor principal:** Administrador o Vendedor.  
**Precondiciones:** RUC comercial configurado; cliente y productos válidos.

**Flujo principal**

1. El actor crea una venta en borrador y selecciona cliente.
2. Agrega productos, cantidades, precios finales y condición de venta, sin descuentos.
3. El sistema calcula los valores y muestra disponibilidad.
4. El actor solicita confirmar.
5. El sistema vuelve a validar permisos, productos, precios, impuestos, cantidades y existencia.
6. En una transacción, asigna secuencial, congela valores históricos, genera salidas de Kardex y crea el importe exigible.
7. El sistema muestra la venta confirmada.
8. El actor registra el cobro mediante `CU-013` o deja saldo si es crédito.
9. Opcionalmente, pulsa «Preparar datos fiscales»: el sistema precarga receptor, líneas, impuestos, totales y la configuración centralizada de la entidad; el actor completa solo lo faltante, revisa los datos para facturación y guarda una preparación local, que no es una factura electrónica ni se envía al SRI.

**Alternativas y excepciones**

- 2a. Se intenta aplicar un descuento: se rechaza porque V1 no los admite.
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
2. El sistema muestra entidad fiscal, total pagado, lo retenido por el cliente y saldo.
3. El actor registra importe, fecha y una o varias formas habilitadas.
4. El sistema valida permisos, importes, entidad y sobrepago.
5. El actor confirma.
6. El sistema registra el pago, recalcula saldo y deriva el estado de pago.

**Alternativas y excepciones**

- 3a. Pago combinado: las partes deben sumar el importe total recibido.
- 4a. El pago pertenece a otra entidad: se rechaza.
- 4b. Excede el saldo o el documento no está confirmado: se rechaza.
- 4c. El dinero se destina a dos ventas: el usuario registra un pago independiente para cada una.
- 3b. El cliente pagó menos porque retuvo impuestos y la entidad registra retenciones: el sistema pregunta si la diferencia fue retenida y propone ese valor; el actor lo confirma, lo ajusta o lo deja como saldo. La retención baja el saldo sin contarse como dinero y puede registrarse sola si el dinero se cobró antes. No se piden datos del comprobante.
- 3c. El cliente está marcado como agente de retención: la opción se ofrece desde el inicio.
- 4d. La retención excede el saldo, o el contado no queda cubierto con dinero más retención: se rechaza toda la acción.
- 4e. La retención supera el porcentaje de advertencia de la entidad: el sistema pide confirmarla y no bloquea.
- 5a. Falla la operación: no se guarda ninguna parte del pago ni la retención.
- 6a. El comprobante de retención llega después: quien cobra o el Administrador lo completa desde la lista de retenciones por completar de esa entidad, con número, fecha y desglose opcional.
- 6b. La retención se registró por error: el Administrador la anula con motivo y el importe vuelve al saldo.

**Garantía de éxito:** pago, retención, saldo y estado son reproducibles y pertenecen a una sola entidad fiscal; lo retenido nunca figura como dinero cobrado.

## 16. CU-014 — Registrar devolución o reembolso

**Actor principal:** Administrador.  
**Precondiciones:** venta confirmada con cantidad todavía devolvible.

**Flujo principal**

1. El actor abre la venta original y selecciona Devolver.
2. Elige líneas y cantidades, registra motivo e inspecciona si cada producto está apto para reventa.
3. El sistema calcula el efecto sobre valores, existencia y saldo.
4. El actor confirma la devolución.
5. En una transacción, el sistema crea la devolución, reingresa solo productos aptos usando su costo histórico y corrige el importe exigible.
6. El sistema vincula la devolución con la venta original.
7. Si la corrección produce un exceso pagado, el Administrador registra un reembolso trazable.

**Excepciones**

- 2a. La cantidad supera lo pendiente de devolver: se rechaza.
- 3a. Un producto no está apto: se conserva la devolución económica sin aumentar existencia.
- 7a. El reembolso supera lo efectivamente pagado: se rechaza.
- 5a. Falla un efecto: se revierte toda la operación.

**Garantía de éxito:** la devolución corrige inventario y valores sin borrar la venta.

## 17. CU-015 — Anular operación confirmada

**Actor principal:** Administrador (solo él anula entradas, ventas, pagos u operaciones de servicios).  
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

> **Estado de implementación:** `CU-017` y `CU-019` están implementados parcialmente por `openspec/changes/archive/2026-09-24-gestionar-ordenes-mantenimiento` (specs principales en `openspec/specs/`): registro y edición de órdenes, kilometraje con confirmación, servicios del catálogo con precio aplicado, fotografías, finalización y reapertura con intervención correctiva sin cargo. No incluyen la operación económica artesanal, pagos, repuestos vinculados (`CU-018`) ni cancelación. Evidencia: [cobertura-mantenimientos.md](cobertura-mantenimientos.md).

> **Estado de implementación (integración económica):** `openspec/changes/archive/2026-09-24-integrar-mantenimiento-ventas-cobros-por-ruc` completa `CU-017` (operación económica de servicios y sus pagos), implementa `CU-018` (repuestos como venta comercial vinculada con reserva, confirmada por el Vendedor o el Administrador) y amplía `CU-019` (finalización bloqueada por repuestos pendientes; la reapertura conserva documentos y pagos). La cancelación sigue pendiente. Evidencia: [cobertura-integracion-mantenimiento.md](cobertura-integracion-mantenimiento.md).

## 19. CU-017 — Registrar mantenimiento y servicios

**Actor principal:** Administrador o Encargado del taller.  
**Precondiciones:** cliente y vehículo activos; RUC artesanal configurado.

**Flujo principal**

1. El actor crea un mantenimiento para el cliente y vehículo.
2. Registra fecha, kilometraje, diagnóstico y observaciones.
3. Adjunta fotografías válidas cuando corresponda.
4. Agrega servicios del catálogo; el sistema copia sus precios referenciales.
5. El Encargado del taller o el Administrador modifica libremente el precio aplicado antes de confirmar, sin que se exija un motivo.
6. El sistema calcula la operación económica artesanal.
7. El actor guarda el mantenimiento en estado `registrado`.
8. Cuando corresponda, confirma la operación de servicios y registra pagos mediante `CU-013`.

**Alternativas y excepciones**

- 2a. Kilometraje menor al último: el sistema advierte y exige resolución.
- 3a. Archivo no permitido: se rechaza sin perder los demás datos.
- 5a. El precio aplicado es negativo: se rechaza.
- 8a. No se confirma la operación económica: el mantenimiento puede continuar operativo sin mezclar estados.

**Garantía de éxito:** mantenimiento y operación artesanal quedan relacionados, pero con estados propios.

## 20. CU-018 — Vincular repuestos con mantenimiento

**Actor principal:** Encargado del taller; el Administrador o el Vendedor interviene para confirmar o cobrar la venta comercial.  
**Precondiciones:** mantenimiento registrado y productos activos.

**Flujo principal**

1. El Encargado del taller abre Repuestos utilizados dentro del mantenimiento.
2. Selecciona productos y cantidades.
3. El sistema crea o actualiza la única venta comercial vinculada que puede permanecer abierta y reserva disponibilidad por sus líneas.
4. La vista muestra por separado servicios artesanales, repuestos comerciales, existencia, cantidad reservada y disponibilidad.
5. Mientras la venta esté abierta, agregar una línea reserva su cantidad y retirar una línea libera la reserva.
6. El Administrador o el Vendedor revisa y confirma la venta mediante `CU-012`; la confirmación consume la reserva y genera la salida de Kardex.
7. Los pagos comerciales se registran mediante `CU-013` y no afectan el saldo artesanal.

**Alternativas y excepciones**

- 3a. Ya existe una venta vinculada editable: se reutiliza; no puede abrirse una segunda.
- 3b. La disponibilidad es insuficiente: se rechaza la línea sin crear reserva ni movimiento.
- 6a. Falta existencia o permiso al confirmar: la venta permanece abierta y no se genera salida.
- 6b. Después de confirmar se descubre otro repuesto necesario: se crea otra venta vinculada; solo una puede quedar abierta.
- 6c. El mantenimiento no confirma automáticamente la venta ni convierte la reserva en movimiento.

**Garantía de éxito:** los repuestos salen por una venta comercial independiente y trazable.

## 21. CU-019 — Finalizar, cancelar o reabrir mantenimiento

**Actor principal:** Administrador o Encargado del taller.  
**Precondiciones:** mantenimiento `registrado` para finalizar o cancelar, o `finalizado` para reabrir; permiso correspondiente.

**Flujo de finalización**

1. El actor solicita finalizar.
2. El sistema valida datos obligatorios y muestra el estado de documentos vinculados.
3. Si la venta vinculada abierta contiene líneas, el actor debe confirmarla o retirar esas líneas antes de continuar.
4. El actor confirma.
5. El sistema cambia el estado a `finalizado` y registra la finalización sin confirmar ventas automáticamente.

**Flujo de cancelación**

1. El actor solicita cancelar un registro duplicado, erróneo o sin trabajo cobrable y registra el motivo.
2. El sistema muestra operaciones económicas vinculadas que requieren tratamiento independiente.
3. El actor retira las líneas de cualquier venta abierta para liberar sus reservas.
4. El actor confirma.
5. El sistema cambia el estado a `cancelado` y conserva historial.

**Flujo de reapertura por corrección**

1. El Administrador o el Encargado del taller abre un mantenimiento finalizado cuando la nueva atención corrige una falla atribuible al trabajo anterior.
2. Registra la causa y crea una nueva intervención correctiva dentro del mismo mantenimiento, sin alterar la intervención inicial.
3. Los servicios correctivos se registran sin cargo al cliente.
4. Si una instalación incorrecta exige un repuesto del inventario, el Encargado lo solicita y el Administrador registra la reposición mediante `CU-024`.
5. Tras la corrección, el actor vuelve a finalizar el mantenimiento.

**Excepciones**

- Una venta o pago confirmado no se anula automáticamente.
- Si el problema es nuevo, no atribuible al trabajo anterior o aparece después sin relación con él, se crea otro mantenimiento.
- Un repuesto de corrección no puede salir si dejaría disponibilidad negativa.

**Garantía de éxito:** el estado operativo y las intervenciones conservan su historia; las operaciones económicas permanecen separadas por entidad fiscal.

## 22. CU-020 — Consultar y exportar reportes

**Actor principal:** Administrador, Vendedor o Encargado del taller, según el ámbito del reporte.  
**Precondiciones:** sesión válida y permiso del rol para el reporte solicitado.

**Flujo principal**

1. El Administrador puede seleccionar cualquier reporte; el Vendedor accede a Comercial e Inventario; el Encargado del taller accede a Artesanal e Inventario.
2. Define período, estado, entidad y otros filtros disponibles.
3. El sistema valida permisos y genera los datos desde operaciones válidas, incluidos consumos internos, correcciones, cierres diarios y margen bruto histórico cuando corresponda.
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

## 24. CU-022 — Desarmar kit comprado

**Actor principal:** Administrador.

**Precondiciones:** kit con existencia disponible y componentes reales identificados.

**Flujo principal**

1. El Administrador selecciona el kit y la cantidad a desarmar.
2. Registra los productos y cantidades efectivamente obtenidos.
3. El sistema propone distribuir el costo total proporcionalmente según costos de referencia o ponderaciones explícitas.
4. El Administrador revisa y confirma.
5. En una sola operación, el sistema genera la salida del kit, las entradas de componentes y sus movimientos de Kardex.

**Excepciones:** si la distribución no conserva exactamente el costo total o cualquier línea es inválida, no se registra efecto parcial.

**Garantía de éxito:** el kit deja de estar disponible y sus componentes quedan vendibles individualmente con costo trazable.

## 25. CU-023 — Registrar consumo interno

**Actor principal:** Administrador o Vendedor, por solicitud del Encargado del taller.

**Precondiciones:** producto activo y disponibilidad suficiente.

**Flujo principal:** el actor selecciona producto y cantidad completa solicitada, marca el motivo como consumo del taller y confirma; el sistema genera una salida de Kardex sin venta ni cuenta por cobrar.

**Excepción:** si la disponibilidad es insuficiente, se rechaza toda la salida.

**Garantía de éxito:** el material deja el inventario con origen, responsable y motivo trazables.

## 26. CU-024 — Registrar reposición por corrección

**Actor principal:** Administrador; solicitud del Encargado del taller.

**Precondiciones:** mantenimiento reabierto, intervención correctiva y disponibilidad suficiente.

**Flujo principal:** el Administrador identifica mantenimiento, intervención, producto y cantidad; confirma que el costo lo asume el taller; el sistema genera una salida de Kardex por reposición sin venta ni cargo al cliente.

**Excepciones:** se rechaza si falta la relación correctiva, el permiso o la disponibilidad.

**Garantía de éxito:** el repuesto queda trazado como costo de la corrección del taller.

## 27. CU-025 — Devolver mercadería a proveedor

**Actor principal:** Administrador.

**Precondiciones:** ingreso original confirmado y cantidad todavía retornable y disponible.

**Flujo principal:** el actor abre el ingreso, selecciona productos y cantidades, registra motivo y confirma; el sistema crea la devolución vinculada y las salidas de Kardex correspondientes.

**Excepciones:** no se permite devolver más de lo ingresado pendiente de retorno ni provocar disponibilidad negativa.

**Garantía de éxito:** la devolución física es trazable al ingreso; V1 no registra reembolso, deuda ni pago del proveedor.

## 28. CU-026 — Confirmar cierre diario

**Actor principal:** Administrador.

**Precondiciones:** fecha, entidad fiscal y forma de pago seleccionadas.

**Flujo principal:** el sistema resume cobros válidos del período; el Administrador registra el importe contado o verificado, revisa diferencias y confirma un cierre lógico independiente por RUC y forma de pago.

**Excepción:** corregir un cierre no borra el original; requiere una operación trazable.

**Garantía de éxito:** cada cierre puede conciliarse con los pagos de su misma entidad fiscal y forma de pago.

## 29. Relaciones include/extend relevantes

- `CU-011` incluye la creación de venta y continúa con `CU-012`.
- `CU-012` puede incluir `CU-013` para cobro inmediato.
- `CU-017` puede incluir `CU-013` para pagos artesanales.
- `CU-017` puede extenderse con `CU-018` cuando se utilizan repuestos.
- `CU-019` incluye `CU-024` cuando una corrección requiere reponer inventario a cargo del taller.
- `CU-014` y `CU-015` incluyen registro de auditoría y pueden requerir corrección de pagos.
- `CU-020` puede abrir los documentos generados por los demás casos, sujeto a permisos.
## 29. Casos de uso fiscales locales

### CU-027 — Preparar información fiscal

**Actores:** Administrador o Vendedor para venta comercial; Administrador o Encargado para operación artesanal. **Precondición:** operación confirmada y vigente. El actor crea el borrador, declara receptor, punto, ambiente de pruebas y formas fiscales, revisa impedimentos y completa una instantánea local que conserva también el emisor estructurado. Un código de línea de más de 25 caracteres, una descripción de más de 300 o una tarifa distinta de IVA 0 % con calificación artesanal vigente quedan como impedimentos que resuelve el Administrador. El sistema no cobra, transmite ni autoriza.

### CU-028 — Incorporar evidencia fiscal externa

**Actor:** Administrador. Selecciona entidad, declara procedencia y carga un XML acotado. El sistema valida estructura/identidad, conserva bytes y hash y permite vínculo motivado. En ambiente productivo exige readiness aplicable; la evidencia queda marcada como externa no verificada.

### CU-029 — Preparar una corrección fiscal

**Actor:** Administrador. Selecciona factura original o identidad de ensayo, acción, motivo, hechos y líneas afectadas. El sistema evalúa impedimentos y remanente, y permite preparar o cancelar la solicitud local sin afirmar ejecución oficial.

### CU-030 — Registrar readiness del archivo

**Actor:** Administrador. Registra política versionada por entidad y evidencia de restauración. El sistema vincula la evidencia a procedimiento y almacenamiento; una versión incompatible bloquea nuevas cargas productivas.
