## ADDED Requirements

<!-- Artefacto specs para revisión, 2026-09-20. Continuación solicitada por el usuario después de registrar proposal en master (c55ddf3). La instrucción de continuar autoriza desarrollar la propuesta; estas specs aún requieren aprobación antes de design. GIVEN/WHEN/THEN equivalen a Dado/Cuando/Entonces. Fuentes: proposal y su referencia terminológica; decisiones confirmadas y modelo de dominio leídos completos en esta tarea; specs principales de dominio, autorización y configuración; RN-CAT, RF-CAT, matriz de roles, CU-006/CU-016, UI-030…037, RNF de integridad, usabilidad y auditoría. Las brechas documentadas en proposal siguen abiertas salvo las recomendaciones desarrolladas aquí. -->

### Requirement: Autorización de productos y auxiliares

Los tres roles SHALL consultar productos, categorías, marcas de producto y unidades mediante `productos.ver`. Solo Administrador SHALL crear/editar productos y auxiliares con `productos.gestionar`, cambiar precios con `productos.cambiar_precio` y cambiar estado de productos con `productos.desactivar`; el estado de auxiliares SHALL requerir `productos.gestionar`. SHALL aplicarse la unión de permisos vigentes, sesión y protección de escrituras existentes; interfaz y acceso directo SHALL respetar la misma matriz. Los permisos de marcas de vehículo SHALL permanecer sin cambios. Trazabilidad: CT-001; RN-SEG-001…007; actores-y-roles §3.3; autorizacion-y-navegacion.

#### Scenario: Consulta por cada rol
- **GIVEN** una sesión de Administrador, Vendedor o Encargado del taller
- **WHEN** consulta lista o ficha de productos o auxiliares
- **THEN** SHALL recibir los datos autorizados, incluidos estados, sin costos ni permisos adicionales

#### Scenario: Administración del catálogo
- **GIVEN** un Administrador autenticado
- **WHEN** crea, edita o cambia el estado de un registro válido
- **THEN** SHALL permitirse la operación según su permiso específico

#### Scenario: Escritura directa no autorizada
- **GIVEN** un Vendedor o Encargado del taller sin rol Administrador
- **WHEN** intenta crear, editar, cambiar precio o estado directamente
- **THEN** SHALL denegarse sin cambios y ocultarse esas acciones en la interfaz

#### Scenario: Unión de roles
- **GIVEN** un usuario con Administrador y otro rol
- **WHEN** administra el catálogo
- **THEN** SHALL conservar las concesiones de Administrador

#### Scenario: Sesión ausente o invalidada
- **GIVEN** una sesión inexistente o invalidada por reducción de roles
- **WHEN** solicita cualquier catálogo
- **THEN** SHALL exigirse autenticación sin devolver datos ni guardar cambios

### Requirement: Categorías planas con identidad y nombre único

Una categoría SHALL tener nombre no vacío, descripción opcional y estado activo inicial. SHALL poder consultarse y editarse conservando identidad. Los nombres SHALL quitar espacios exteriores y compararse sin distinguir mayúsculas/minúsculas; no SHALL admitirse duplicados, incluidos inactivos. SHALL rechazarse jerarquías y subcategorías. Las restricciones SHALL mantenerse ante concurrencia. Trazabilidad: RN-CAT-003; RF-CAT-006; UI-033; RNF-INT-005; proposal.

#### Scenario: Alta mínima y edición
- **GIVEN** un Administrador
- **WHEN** crea una categoría solo con nombre y luego consulta o edita su descripción
- **THEN** SHALL persistirla activa y conservar su identidad al editar

#### Scenario: Nombre obligatorio
- **GIVEN** una alta o edición
- **WHEN** se envía un nombre vacío o compuesto solo por espacios
- **THEN** SHALL rechazarse con error de nombre sin cambios

#### Scenario: Duplicado normalizado o inactivo
- **GIVEN** una categoría denominada Filtros, activa o inactiva
- **WHEN** se intenta guardar otra como « filtros »
- **THEN** SHALL rechazarse como duplicada y conservarse ambas identidades originales si era una edición

#### Scenario: Altas simultáneas equivalentes
- **GIVEN** dos solicitudes con el mismo nombre normalizado
- **WHEN** se procesan concurrentemente
- **THEN** SHALL persistirse como máximo una categoría y la otra recibir un error de duplicidad

#### Scenario: Jerarquía no admitida
- **GIVEN** una categoría existente
- **WHEN** se intenta asignarle una categoría padre
- **THEN** SHALL rechazarse sin crear jerarquía

### Requirement: Desactivación de categorías sin cascadas

Una categoría SHALL poder desactivarse solo cuando no tenga productos activos. SHALL informarse el bloqueo y permitir reclasificar o desactivar productos mediante acciones independientes. La baja con productos inactivos SHALL conservar asociaciones; reactivar SHALL recuperar la misma identidad. Un producto SHALL exigir categoría activa para creación, cambio de categoría o reactivación. La validación SHALL ser consistente ante operaciones simultáneas. Trazabilidad: RF-CAT-003/006; RN-CAT-002; RNF-INT-005/009; recomendación 2 de proposal.

#### Scenario: Categoría con producto activo
- **GIVEN** una categoría con al menos un producto activo
- **WHEN** se solicita su baja
- **THEN** SHALL rechazarse indicando que deben reclasificarse o desactivarse los productos sin cambiar ninguno

#### Scenario: Categoría con productos inactivos
- **GIVEN** una categoría sin productos activos
- **WHEN** se confirma su baja
- **THEN** SHALL quedar inactiva conservando productos y asociaciones consultables

#### Scenario: Reactivar categoría
- **GIVEN** una categoría inactiva
- **WHEN** se confirma su reactivación
- **THEN** SHALL volver a estar disponible con la misma identidad

#### Scenario: Reactivar producto de categoría inactiva
- **GIVEN** un producto inactivo cuya categoría está inactiva
- **WHEN** se intenta reactivarlo
- **THEN** SHALL rechazarse hasta disponer de categoría activa

#### Scenario: Carrera entre baja y asociación
- **GIVEN** una categoría activa sin productos activos
- **WHEN** compiten su baja y la creación, reclasificación o reactivación de un producto activo en ella
- **THEN** SHALL impedirse el resultado de categoría inactiva con producto activo; la operación incompatible SHALL fallar sin cambios parciales

### Requirement: Producto por presentación completa

Cada **Producto** SHALL exigir código único, nombre, categoría, cantidad positiva de contenido, unidad de medida y **precio final de catálogo**; descripción, marca de producto y compatibilidades SHALL ser opcionales y el estado inicial SHALL ser activo. El código SHALL quitar espacios exteriores y normalizarse a mayúsculas; su unicidad SHALL incluir inactivos. La **presentación** SHALL conservar cantidad decimal y unidad, sin conversiones automáticas. Diferentes presentaciones vendibles SHALL ser productos distintos. SHALL admitirse una indicación de **kit** comprado sin composición. Crear o editar SHALL validar conjuntamente todos los campos y referencias. Trazabilidad: DP-009/010; RN-CAT-001/005/006/011/012; RF-CAT-001/002/008/009/013/014; UI-030…032.

#### Scenario: Producto mínimo persistente
- **GIVEN** categoría y unidad activas y configuración fiscal válida
- **WHEN** se registra un producto con sus campos obligatorios
- **THEN** SHALL persistirse activo y recuperarse la misma ficha al consultarlo

#### Scenario: Código duplicado
- **GIVEN** un producto activo o inactivo con código FIL-01
- **WHEN** se intenta crear otro con « fil-01 »
- **THEN** SHALL rechazarse el código sin crear otro producto

#### Scenario: Código concurrente
- **GIVEN** dos solicitudes independientes con igual código normalizado
- **WHEN** se procesan simultáneamente
- **THEN** SHALL guardarse como máximo un producto y comunicarse duplicidad al otro

#### Scenario: Datos obligatorios o relaciones inválidas
- **GIVEN** una alta o edición
- **WHEN** falta un campo obligatorio, el contenido no es positivo o una referencia no existe
- **THEN** SHALL rechazarse toda la entrada con errores corregibles por campo

#### Scenario: Presentaciones independientes
- **GIVEN** un producto con contenido de un galón
- **WHEN** se registra otro de medio galón con código propio
- **THEN** SHALL conservarse como otro producto con precio propio sin convertir ni fraccionar el primero

#### Scenario: Edición de ficha
- **GIVEN** un producto persistido
- **WHEN** se cambian nombre, descripción o precio válidamente
- **THEN** SHALL conservarse su identidad y no alterarse valores históricos de operaciones consumidoras

#### Scenario: Kit comprado
- **GIVEN** un producto válido
- **WHEN** se identifica como kit
- **THEN** SHALL seguir siendo un único producto sin crear componentes ni ejecutar desarme

### Requirement: Unidades marcas y compatibilidad informativa

Unidades y marcas de producto SHALL poder crearse, listarse, consultarse, editarse, desactivarse y reactivarse. SHALL exigir nombre no vacío y conservar identidad; una unidad SHALL admitir símbolo descriptivo opcional y no autorizar fraccionamiento. SHALL evitarse duplicados de nombre normalizado por catálogo, incluidos inactivos. Un producto SHALL admitir cero o una marca de producto y cero o varias marcas de vehículo compatibles existentes, sin duplicarlas. La **compatibilidad vehicular** SHALL ser informativa y nunca representar una restricción de venta. La baja de auxiliares SHALL conservar productos y referencias sin cascadas; referencias inactivas no SHALL elegirse por primera vez ni como sustitución. Trazabilidad: modelo-dominio-taller; RN-CAT-003/004/012/013; RF-CAT-004/006/007; DP-008 Marcas.

#### Scenario: Gestión de auxiliares
- **GIVEN** un Administrador
- **WHEN** registra una unidad o marca de producto con nombre válido y después la edita
- **THEN** SHALL poder consultarla y conservar su identidad

#### Scenario: Auxiliar duplicado
- **GIVEN** un auxiliar activo o inactivo
- **WHEN** se intenta guardar otro con nombre equivalente sin distinguir mayúsculas o espacios exteriores
- **THEN** SHALL rechazarse incluso si las altas son concurrentes

#### Scenario: Varias marcas compatibles
- **GIVEN** un producto y dos marcas de vehículo existentes
- **WHEN** se asocian ambas como compatibles
- **THEN** SHALL conservarse ambas referencias sin crear marcas de vehículo nuevas

#### Scenario: Baja de auxiliar utilizado
- **GIVEN** una unidad o marca asociada a un producto
- **WHEN** se desactiva el auxiliar
- **THEN** SHALL conservarse el producto y su referencia visible sin cambiar su estado

#### Scenario: Referencia inactiva nueva
- **GIVEN** una unidad, marca de producto o marca de vehículo inactiva
- **WHEN** se intenta seleccionarla en un producto nuevo o como nueva asociación
- **THEN** SHALL rechazarse esa selección sin guardar parcialmente

#### Scenario: Corrección conservando referencia
- **GIVEN** un producto con marca o unidad que posteriormente fue desactivada
- **WHEN** se edita un campo ajeno a esa referencia
- **THEN** SHALL permitirse conservarla sin exigir reemplazo

#### Scenario: Reactivación del auxiliar
- **GIVEN** una marca de producto o unidad inactiva
- **WHEN** se reactiva
- **THEN** SHALL recuperar su misma identidad y disponibilidad de selección

### Requirement: Precios finales y selección tributaria comercial

Los precios SHALL ser importes decimales no negativos en USD con hasta dos decimales, incluido cero; exceso de precisión SHALL rechazarse sin redondear ni truncar. SHALL incluir el impuesto aplicable y conservarse exactamente. Cada producto SHALL seleccionar explícitamente una definición tributaria existente del ámbito comercial; no SHALL admitir una artesanal ni una tarifa fija embebida en el producto. La elección SHALL referenciar la definición, no congelar una vigencia. La falta de tarifa vigente no SHALL interpretarse como cero; no impide mantener el catálogo si existe la definición, pero SHALL comunicarse como configuración pendiente para operaciones futuras. Consultar o guardar SHALL NOT registrar uso tributario confirmado, alterar configuración ni consumir secuenciales. Trazabilidad: DP-017; RN-CAT-007/016; RF-CAT-015; RNF-INT-006; configuracion-operativa-y-fiscal; recomendaciones 1/4 de proposal.

#### Scenario: Precio exacto y cero
- **GIVEN** un producto con impuesto comercial definido
- **WHEN** se guarda precio 12.35 o 0.00
- **THEN** SHALL conservarse ese importe final sin añadirle nuevamente impuesto

#### Scenario: Precio inválido
- **GIVEN** una alta o edición
- **WHEN** se introduce precio negativo, no decimal o con más de dos decimales
- **THEN** SHALL rechazarse con error de precio y no redondearse

#### Scenario: Impuesto ausente o de otro ámbito
- **GIVEN** un producto
- **WHEN** se intenta guardar sin definición tributaria o con una artesanal
- **THEN** SHALL rechazarse sin asignar una tarifa por defecto

#### Scenario: Cambio de vigencia
- **GIVEN** un producto con precio y definición tributaria
- **WHEN** entra en vigor una tarifa sucesora
- **THEN** SHALL conservarse el precio final y la definición elegida sin modificar historia

#### Scenario: Configuración pendiente
- **GIVEN** una definición comercial sin vigencia para hoy
- **WHEN** se consulta o guarda el producto asociado
- **THEN** SHALL conservarse la selección e indicarse ausencia de tarifa aplicable sin mostrarla como cero

#### Scenario: Tarifa cero configurada
- **GIVEN** una definición comercial con vigencia de tarifa cero
- **WHEN** se selecciona para un producto
- **THEN** SHALL admitirse sin sustituirla por otra tarifa

### Requirement: Consulta filtrada y paginada de productos y auxiliares

Productos SHALL buscarse por coincidencia parcial de código o nombre, sin distinguir mayúsculas y quitando espacios exteriores; filtros de categoría, estado, marca de producto y marca de vehículo SHALL combinarse por intersección. SHALL permitir activos, inactivos o todos, con activos por defecto. Auxiliares SHALL admitir búsqueda por nombre y estado. Toda lista SHALL paginarse en servidor con orden estable, total y navegación entre páginas; volver desde ficha SHALL conservar búsqueda, filtros y página. Filtros inválidos SHALL rechazarse de forma corregible. La consulta de fichas inactivas SHALL estar permitida. Trazabilidad: RF-CAT-004/006; RNF-REN-005/006; RNF-USA-011; UI-030…033.

#### Scenario: Filtros combinados
- **GIVEN** productos de distintas categorías y marcas
- **WHEN** se busca por nombre y se aplican categoría, ambas marcas y estado
- **THEN** SHALL mostrarse solo la intersección

#### Scenario: Páginas estables
- **GIVEN** una consulta con más resultados que una página
- **WHEN** se recorren las páginas sin cambios del catálogo
- **THEN** SHALL recibirse cada coincidencia una vez con total consistente

#### Scenario: Sin coincidencias
- **GIVEN** una consulta válida
- **WHEN** ningún producto cumple los filtros
- **THEN** SHALL mostrarse ausencia de resultados y permitir limpiar filtros

#### Scenario: Estado y retorno desde ficha
- **GIVEN** una lista filtrada de inactivos
- **WHEN** se consulta una ficha y se vuelve
- **THEN** SHALL conservarse los criterios y página sin ocultar el registro por estar inactivo

### Requirement: Estados del producto y separación de inventario

Producto SHALL poder desactivarse y reactivarse mediante acciones explícitas, conservando identidad y relaciones. Los inactivos SHALL permanecer consultables y SHALL excluirse de selecciones nuevas. Repetir un estado ya alcanzado SHALL ser inocuo. El catálogo SHALL NOT permitir eliminación ordinaria ni aceptar escrituras de existencias, reservas, costos o movimientos; tampoco SHALL mostrar cantidades ficticias, producir compras, documentos o relaciones de proveedor único. Trazabilidad: RN-CAT-002; RF-CAT-003; DP-001/002/012; modelo-dominio-taller; exclusiones de proposal.

#### Scenario: Desactivación y selección
- **GIVEN** un producto activo
- **WHEN** se confirma su baja
- **THEN** SHALL conservarse consultable con sus relaciones y excluirse de nuevas selecciones

#### Scenario: Reactivación válida
- **GIVEN** un producto inactivo con categoría activa
- **WHEN** se confirma su reactivación
- **THEN** SHALL recuperar su identidad y disponibilidad de selección

#### Scenario: Estado repetido
- **GIVEN** un producto ya inactivo
- **WHEN** se repite su desactivación
- **THEN** SHALL conservarse sin efectos adicionales

#### Scenario: Escritura de stock o costo
- **GIVEN** un usuario incluso Administrador
- **WHEN** intenta enviar stock, costo promedio o costo de referencia mediante el catálogo
- **THEN** SHALL rechazarse explícitamente sin cambiar cantidades ni costos

#### Scenario: Eliminación ordinaria
- **GIVEN** un producto o auxiliar persistido
- **WHEN** se intenta eliminarlo físicamente por la interfaz de catálogo
- **THEN** SHALL denegarse conservando identidad y referencias

### Requirement: Escrituras consistentes y auditables de productos y auxiliares

Toda alta, edición y cambio de estado SHALL validar autorización y datos en el servidor y guardar conjuntamente el registro, sus relaciones y la auditoría exitosa, o no guardar ninguno. SHALL detectar ediciones sobre una versión obsoleta y reintentos de una misma solicitud lógica para no sobrescribir cambios ni duplicar altas/eventos. Un reintento compatible SHALL devolver el resultado ya registrado; reutilizar su identidad con contenido distinto SHALL producir conflicto. La auditoría SHALL conservar actor, momento, acción, objetivo, resultado y nombres de campos modificados, sin datos de contacto innecesarios ni secretos; solo el Administrador SHALL consultarla. Los rechazos relevantes SHALL conservar su resultado sin registrar éxito. El mecanismo de versión e identidad de solicitud se concretará en design. Trazabilidad: RNF-INT-004/005/009; RF-AUD-001/003; RNF-AUD-001…005; proposal.

#### Scenario: Reintento después de perder la respuesta
- **GIVEN** una escritura de catálogo ya completada
- **WHEN** el mismo actor repite la misma solicitud lógica con idénticos datos
- **THEN** SHALL recibir el resultado previo sin duplicar registros ni auditoría exitosa

#### Scenario: Reintento incompatible
- **GIVEN** una identidad de solicitud ya utilizada
- **WHEN** se repite con contenido diferente
- **THEN** SHALL rechazarse por conflicto sin modificar el resultado anterior

#### Scenario: Edición concurrente
- **GIVEN** dos usuarios autorizados consultaron la misma versión
- **WHEN** el segundo guarda después de que el primero modificó el registro
- **THEN** SHALL rechazarse su versión obsoleta y permitirse recargar sin sobrescribir al primero

#### Scenario: Falla de persistencia o auditoría
- **GIVEN** una escritura válida
- **WHEN** falla el guardado de una relación o de su auditoría exitosa
- **THEN** SHALL revertirse toda la escritura sin efectos parciales

#### Scenario: Intento denegado
- **GIVEN** un actor sin permiso de escritura
- **WHEN** intenta modificar un registro
- **THEN** SHALL rechazarse y registrarse la denegación sin guardar datos sensibles innecesarios

### Requirement: Experiencia integrada de productos y auxiliares

Las listas, fichas y formularios SHALL reutilizar navegación, tipografía, colores, espaciado y componentes del sistema visual vigente. SHALL comunicar carga, vacío, ausencia de coincidencias, error recuperable y éxito; asociar errores a campos, conservar entradas tras errores y prevenir envíos duplicados. Las acciones de estado SHALL solicitar confirmación con registro y efecto identificados. SHALL ser utilizables con teclado, etiquetas y foco visible a 360, 768, 1024 y 1440 px, sin desbordamiento horizontal de página ni estados comunicados solo por color. SHALL advertir cambios sin guardar y restaurar el foco al cerrar paneles. Los errores del servidor SHALL seguir el formato uniforme y quedar documentados en el **Contrato OpenAPI**; una ruta o registro inexistente SHALL comunicar ausencia sin producir cambios. Trazabilidad: UI-030…033; RNF-USA-001…011; sistema-visual-frontend; proposal.

#### Scenario: Carga y lista vacía
- **GIVEN** una consulta autorizada
- **WHEN** se carga un catálogo sin registros
- **THEN** SHALL mostrar carga mientras espera y luego un vacío con creación solo para quien tenga permiso

#### Scenario: Consulta fallida recuperable
- **GIVEN** un usuario con filtros aplicados
- **WHEN** falla la consulta
- **THEN** SHALL mostrar error y permitir reintentar conservando filtros sin mostrar éxito ni datos inventados

#### Scenario: Error de formulario y doble envío
- **GIVEN** un formulario con información capturada
- **WHEN** se envía una entrada inválida o se intenta enviarla mientras está pendiente
- **THEN** SHALL mantener valores, asociar errores a campos y evitar solicitudes simultáneas de ese formulario

#### Scenario: Confirmación cancelada
- **GIVEN** un registro activo
- **WHEN** el usuario cancela su desactivación
- **THEN** SHALL conservar el estado y devolver el foco al disparador

#### Scenario: Navegación por teclado y teléfono
- **GIVEN** un usuario autorizado en cualquiera de los anchos definidos
- **WHEN** consulta, edita o cierra un panel usando teclado
- **THEN** SHALL disponer de etiquetas, foco visible y acciones accesibles sin desbordamiento de página

#### Scenario: Salida con cambios pendientes
- **GIVEN** un formulario modificado
- **WHEN** el usuario intenta abandonarlo
- **THEN** SHALL advertir los cambios sin guardar y permitir permanecer sin perderlos


