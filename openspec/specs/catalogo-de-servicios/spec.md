# catalogo-de-servicios Specification

## Purpose
Mantener el catálogo de servicios del taller con nombre, descripción, precio referencial final en USD y selección tributaria del ámbito artesanal; administración por Administrador y Encargado del taller, estados sin pérdida histórica, escrituras idempotentes y auditables, sin existencias ni efectos económicos propios.
## Requirements
### Requirement: Autorización del catálogo de servicios

Los tres roles SHALL consultar servicios mediante `servicios.ver`. Administrador y Encargado del taller SHALL crear, editar, cambiar precio, desactivar y reactivar con `servicios.gestionar`; Vendedor solo SHALL consultar. SHALL aplicarse sesión vigente, protección de escrituras y unión de roles; navegación y acciones SHALL reflejar permisos sin sustituir la validación del servidor. Trazabilidad: CT-001; actores-y-roles §3.3; CU-016; autorizacion-y-navegacion.

#### Scenario: Lectura por los tres roles
- **GIVEN** una sesión de cualquiera de los tres roles
- **WHEN** consulta servicios activos o inactivos
- **THEN** SHALL acceder al catálogo según los filtros

#### Scenario: Gestión por Encargado o Administrador
- **GIVEN** una sesión de uno de estos roles
- **WHEN** crea, edita o cambia estado de un servicio válido
- **THEN** SHALL permitirse la acción sin exigirle otro rol

#### Scenario: Vendedor intenta escribir
- **GIVEN** un usuario solo Vendedor
- **WHEN** invoca una escritura directamente
- **THEN** SHALL denegarse sin cambios y ocultarse esa acción

#### Scenario: Sesión inválida
- **GIVEN** una sesión ausente o invalidada
- **WHEN** se consulta o escribe el catálogo
- **THEN** SHALL rechazarse sin devolver datos ni guardar cambios

#### Scenario: Roles acumulados
- **GIVEN** un Vendedor que también es Encargado del taller
- **WHEN** administra un servicio
- **THEN** SHALL permitirse mediante la unión de roles

### Requirement: Ficha persistente de servicio referencial

Un **Servicio** SHALL exigir nombre no vacío, **precio referencial**, estado y selección tributaria artesanal; descripción SHALL ser opcional y el estado inicial activo. SHALL NOT pedirse un código a quien lo registra: el sistema SHALL asignar al crearlo un **código de servicio** visible, único e inmutable, con el prefijo `SRV-` y un número correlativo de al menos seis dígitos completados con ceros, de modo que nunca supere los 25 caracteres. La asignación SHALL ocurrir en la misma transacción que el alta y ser segura ante altas concurrentes; un alta fallida SHALL NOT dejar un servicio sin código. El código SHALL NOT reutilizarse aunque el servicio se desactive, SHALL NOT aceptarse ni modificarse desde una alta o edición, y SHALL mostrarse en la ficha, en el listado y en la búsqueda. Los servicios existentes SHALL recibir su código una sola vez, en orden de creación, conservando su identidad. SHALL poder crearse, consultarse y editarse conservando identidad. El nombre SHALL quitar espacios exteriores; nombres iguales no SHALL convertirse en restricción de unicidad no prevista en proposal. Cambios del catálogo SHALL NOT alterar valores de servicios ya aplicados a mantenimientos. El **precio aplicado** en una futura operación podrá diferir sin modificar el referencial. Trazabilidad: RN-CAT-008/009; RF-CAT-010/011; DP-020; CU-016; UI-034/035; propuesta de estructurar-perfil-del-emisor-y-codigos-fiscales §C.13 y D3.

#### Scenario: Alta mínima
- **GIVEN** un usuario autorizado y una definición tributaria artesanal
- **WHEN** crea un servicio con nombre y precio sin descripción ni código
- **THEN** SHALL persistirse activo con un código asignado por el sistema y recuperarse al consultar su ficha

#### Scenario: Nombre vacío
- **GIVEN** una alta o edición
- **WHEN** el nombre solo contiene espacios
- **THEN** SHALL rechazarse indicando el campo y conservando los datos anteriores

#### Scenario: Edición referencial
- **GIVEN** un servicio ya referenciado
- **WHEN** se cambia nombre, descripción o precio
- **THEN** SHALL conservarse su identidad y los valores históricos de servicios aplicados

#### Scenario: Nombres coincidentes
- **GIVEN** un servicio llamado Diagnóstico
- **WHEN** se registra otro servicio válido con igual nombre
- **THEN** SHALL conservarse como registro distinto sin imponer unicidad de nombre

#### Scenario: Código asignado al crear
- **GIVEN** un catálogo cuyo último código de servicio es `SRV-000011`
- **WHEN** un usuario autorizado crea un servicio válido
- **THEN** SHALL persistirse con el código `SRV-000012`, visible en su ficha y en el listado

#### Scenario: Intento de enviar o cambiar el código
- **GIVEN** un servicio con código `SRV-000012`
- **WHEN** una alta o una edición incluye un código elegido por el usuario
- **THEN** SHALL rechazarse con un error asociado al campo, sin crear ni modificar el servicio

#### Scenario: Altas concurrentes
- **GIVEN** dos altas válidas de servicios distintos procesadas a la vez
- **WHEN** ambas se confirman
- **THEN** cada servicio SHALL tener un código diferente y no SHALL existir códigos repetidos

#### Scenario: Servicios existentes
- **GIVEN** un catálogo con servicios creados antes de existir el código
- **WHEN** se aplica el cambio
- **THEN** cada uno SHALL tener un código único asignado en orden de creación, sin alterar su nombre, precio, estado ni los servicios ya aplicados a mantenimientos

#### Scenario: Servicio desactivado
- **GIVEN** un servicio con código `SRV-000005` que se desactiva
- **WHEN** se crea otro servicio
- **THEN** SHALL NOT recibir `SRV-000005`

#### Scenario: Búsqueda por código
- **GIVEN** un servicio con código `SRV-000012`
- **WHEN** se busca « srv-000012 »
- **THEN** SHALL localizarse ese servicio

### Requirement: Precio decimal e impuesto artesanal

El precio referencial SHALL ser final para el cliente con impuesto incluido cuando aplique, en USD, decimal no negativo y con hasta dos decimales. SHALL aceptar cero y rechazar valores inválidos o precisión excedida sin redondeo. Cada servicio SHALL elegir una definición tributaria existente artesanal, sin crear tarifas ni asumir exención. Los roles que gestionan servicios SHALL poder consultar únicamente las opciones tributarias necesarias sin adquirir permisos de administración fiscal. La elección SHALL conservar la definición, no una vigencia fija; un cambio de tarifa SHALL NOT recalcular automáticamente precios. Ausencia de vigencia SHALL mostrarse como configuración pendiente, sin impedir conservar el catálogo ni interpretarla como cero. Trazabilidad: DP-017/020; RN-CAT-007/008; RNF-INT-006; configuracion-operativa-y-fiscal; recomendaciones 1/4 de proposal.

#### Scenario: Importe válido
- **GIVEN** un servicio con definición artesanal
- **WHEN** se guarda 35.50 o 0.00
- **THEN** SHALL conservarse exactamente como precio referencial final

#### Scenario: Importe inválido
- **GIVEN** un formulario de servicio
- **WHEN** se introduce un valor negativo, no decimal o con más de dos decimales
- **THEN** SHALL rechazarse sin redondear ni cambiar el servicio

#### Scenario: Impuesto cruzado o ausente
- **GIVEN** una alta o edición
- **WHEN** se selecciona una definición comercial o se omite la definición
- **THEN** SHALL rechazarse la selección sin asignación implícita

#### Scenario: Opciones fiscales del Encargado
- **GIVEN** un Encargado del taller gestionando servicios
- **WHEN** consulta las definiciones disponibles
- **THEN** SHALL recibir solo las opciones artesanales necesarias sin acceso de modificación a configuración

#### Scenario: Nueva vigencia
- **GIVEN** un servicio con selección tributaria
- **WHEN** cambia la tarifa configurada
- **THEN** SHALL conservarse definición y precio referencial sin alterar historia

#### Scenario: Sin vigencia y tarifa cero
- **GIVEN** una definición artesanal sin vigencia actual o con tarifa cero explícita
- **WHEN** se presenta la información tributaria del servicio
- **THEN** SHALL distinguirse configuración pendiente de tarifa cero y no inventarse una tarifa

### Requirement: Consulta paginada de servicios

Servicios SHALL buscarse por coincidencia parcial de nombre sin distinguir mayúsculas y quitando espacios exteriores, combinada con estado activo/inactivo/todos; activos SHALL ser el filtro inicial. SHALL paginarse en servidor con orden estable y total, permitir ficha de inactivos y conservar contexto al regresar. Parámetros inválidos SHALL generar un error corregible. Trazabilidad: RF-CAT-011; RNF-REN-005/006; RNF-USA-011; UI-034.

#### Scenario: Búsqueda combinada
- **GIVEN** servicios con nombres y estados distintos
- **WHEN** se busca parte de un nombre y estado inactivo
- **THEN** SHALL devolverse únicamente la intersección

#### Scenario: Paginación
- **GIVEN** resultados que exceden una página
- **WHEN** se recorren páginas sin cambios del catálogo
- **THEN** SHALL presentarse cada coincidencia una vez con total consistente

#### Scenario: Vacío de búsqueda
- **GIVEN** filtros válidos sin coincidencias
- **WHEN** se consulta el catálogo
- **THEN** SHALL mostrarse ausencia de resultados y opción de limpiar filtros

#### Scenario: Retorno desde ficha
- **GIVEN** un usuario en una página filtrada
- **WHEN** abre una ficha y vuelve
- **THEN** SHALL conservarse búsqueda, estado y página

### Requirement: Estado e independencia económica de servicios

Servicios SHALL desactivarse/reactivarse explícitamente con la misma identidad; inactivos SHALL permanecer consultables y no disponibles para nuevas selecciones. Repetir el estado alcanzado SHALL ser inocuo. SHALL NOT admitirse eliminación física ordinaria, stock, movimientos, cobros ni creación de mantenimientos desde este catálogo. Guardar o consultar SHALL NOT consumir numeración, generar usos tributarios de operación confirmada ni modificar configuración fiscal. Trazabilidad: RF-CAT-010; RN-CAT-009; DP-020; modelo-dominio-taller; exclusiones de proposal.

#### Scenario: Baja conservando historia
- **GIVEN** un servicio referenciado
- **WHEN** se confirma su desactivación
- **THEN** SHALL conservarse ficha y referencias históricas y excluirse de nuevas selecciones

#### Scenario: Reactivación
- **GIVEN** un servicio inactivo
- **WHEN** se confirma su reactivación
- **THEN** SHALL recuperarse la misma identidad sin modificar precios aplicados históricos

#### Scenario: Repetición del estado
- **GIVEN** un servicio ya inactivo
- **WHEN** se repite la desactivación
- **THEN** SHALL mantenerse sin efectos adicionales

#### Scenario: Stock y eliminación no admitidos
- **GIVEN** un servicio existente
- **WHEN** se intenta escribir stock o eliminar físicamente el servicio
- **THEN** SHALL rechazarse conservando el registro

#### Scenario: Guardado sin efectos económicos
- **GIVEN** una edición válida
- **WHEN** se guarda el servicio
- **THEN** SHALL cambiar únicamente catálogo y auditoría sin generar movimientos, cobros, mantenimiento, numeración ni uso tributario confirmado

### Requirement: Escrituras consistentes y auditables de servicios

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

### Requirement: Experiencia integrada de servicios

Las listas, fichas y formularios SHALL reutilizar navegación, tipografía, colores, espaciado y componentes del sistema visual vigente. SHALL comunicar carga, vacío, ausencia de coincidencias, error recuperable y éxito; asociar errores a campos, conservar entradas tras errores y prevenir envíos duplicados. Las acciones de estado SHALL solicitar confirmación con registro y efecto identificados. SHALL ser utilizables con teclado, etiquetas y foco visible a 360, 768, 1024 y 1440 px, sin desbordamiento horizontal de página ni estados comunicados solo por color. SHALL advertir cambios sin guardar y restaurar el foco al cerrar paneles. Los errores del servidor SHALL seguir el formato uniforme y quedar documentados en el **Contrato OpenAPI**; una ruta o registro inexistente SHALL comunicar ausencia sin producir cambios. Trazabilidad: UI-034/035; RNF-USA-001…011; sistema-visual-frontend; proposal.

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

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
