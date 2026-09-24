## ADDED Requirements

<!-- Artefacto specs para revisión, 2026-09-20. Continuación solicitada por el usuario después de registrar proposal en master (c55ddf3). La instrucción de continuar autoriza desarrollar la propuesta; estas specs aún requieren aprobación antes de design. GIVEN/WHEN/THEN equivalen a Dado/Cuando/Entonces. Fuentes: proposal y su referencia terminológica; decisiones confirmadas y modelo de dominio leídos completos en esta tarea; specs principales de dominio, autorización y configuración; RN-CAT, RF-CAT, matriz de roles, CU-006/CU-016, UI-030…037, RNF de integridad, usabilidad y auditoría. Las brechas documentadas en proposal siguen abiertas salvo las recomendaciones desarrolladas aquí. -->

### Requirement: Acceso exclusivo de administración a proveedores

Solo Administrador SHALL consultar proveedores con `proveedores.ver` y crear, editar o cambiar estado con `proveedores.gestionar`. SHALL verificarse sesión, autorización vigente, protección de escrituras y unión de roles. Vendedor y Encargado del taller sin Administrador SHALL NOT recibir datos, coincidencias de identificación ni navegación de proveedores. Trazabilidad: CT-001; actores-y-roles §3.3; RN-SEG-001…007; autorizacion-y-navegacion.

#### Scenario: Consulta y gestión autorizadas
- **GIVEN** un Administrador autenticado
- **WHEN** consulta o administra un proveedor válido
- **THEN** SHALL permitirse según su permiso

#### Scenario: Acceso operativo directo
- **GIVEN** un Vendedor o Encargado sin Administrador
- **WHEN** solicita lista, ficha, coincidencias o escritura
- **THEN** SHALL rechazarse sin revelar datos ni cambiar registros

#### Scenario: Sesión inválida
- **GIVEN** un usuario sin sesión vigente
- **WHEN** accede al catálogo
- **THEN** SHALL exigirse autenticación sin devolver datos

#### Scenario: Unión de roles
- **GIVEN** un Administrador que también es Vendedor
- **WHEN** consulta proveedores
- **THEN** SHALL conservar su permiso de Administrador

### Requirement: Proveedor mínimo y contacto opcional

Un **Proveedor** SHALL pertenecer al ámbito comercial y exigir únicamente nombre o razón social no vacío, quitando espacios exteriores. Tipo de identificación y documento SHALL ser conjuntamente opcionales; teléfono, correo y dirección SHALL ser opcionales. Un opcional vacío SHALL significar ausencia. SHALL conservarse nombre de hasta 255 caracteres, teléfono hasta 64, correo hasta 254 y dirección hasta 1024, conforme a las convenciones de personas existentes; correo informado SHALL tener formato válido. SHALL rechazarse exceso de longitud sin truncar. El registro SHALL crearse activo, consultarse y editarse conservando identidad, sin crear automáticamente Cliente ni exigir proveedor genérico. Trazabilidad: DP-011; modelo-dominio §5.1; RN-CAT-015; RF-CAT-012/016; UI-036/037.

#### Scenario: Proveedor ocasional mínimo
- **GIVEN** un Administrador
- **WHEN** registra solo el nombre de una persona ocasional
- **THEN** SHALL persistirse activa sin identificación ni contacto inventados

#### Scenario: Edición de contacto
- **GIVEN** un proveedor existente
- **WHEN** se agrega, corrige o retira un contacto opcional
- **THEN** SHALL conservarse la identidad y guardarse el contacto válido o su ausencia

#### Scenario: Nombre o correo inválido
- **GIVEN** una alta o edición
- **WHEN** el nombre está vacío o un correo informado es inválido
- **THEN** SHALL rechazarse con error por campo sin cambios parciales

#### Scenario: Dato excedido
- **GIVEN** una alta o edición
- **WHEN** un campo supera su límite
- **THEN** SHALL rechazarse sin truncar ni persistir parcialmente

#### Scenario: Nombres coincidentes
- **GIVEN** un proveedor sin identificación con nombre equivalente
- **WHEN** se intenta registrar otro con igual nombre ignorando mayúsculas y espacios exteriores
- **THEN** SHALL mostrarse advertencia de coincidencia y permitirse continuar sin fusionar ni bloquear por nombre

### Requirement: Identificación opcional y duplicados

Si se informa identificación, el proveedor SHALL aportar tipo CI o RUC y documento como texto conservando ceros iniciales y quitando espacios exteriores. CI SHALL tener exactamente 10 caracteres y RUC exactamente 13 según el contrato vigente de personas; esta comprobación SHALL NOT presentarse como certificación tributaria. No SHALL exigirse documento para un proveedor sin identificación. La combinación tipo/documento SHALL ser única entre proveedores activos e inactivos, sin exigir unicidad respecto de clientes ni entidades fiscales. Modificaciones y solicitudes concurrentes SHALL respetar la misma restricción. Trazabilidad: DP-011; RF-CAT-012/016; RNF-INT-005; propuesta y convenciones de identificación de clientes.

#### Scenario: Identificación válida
- **GIVEN** un proveedor
- **WHEN** se informa CI de diez caracteres o RUC de trece con su tipo
- **THEN** SHALL conservarse el documento como texto incluidos sus ceros iniciales

#### Scenario: Par incompleto o tipo inválido
- **GIVEN** una alta o edición
- **WHEN** se envía solo tipo, solo documento o un tipo distinto de CI/RUC
- **THEN** SHALL rechazarse indicando los campos que deben completarse o retirarse juntos

#### Scenario: Longitud incorrecta
- **GIVEN** un proveedor con documento informado
- **WHEN** el documento no cumple la longitud de su tipo
- **THEN** SHALL rechazarse sin certificar ni corregir automáticamente el documento

#### Scenario: Duplicado incluyendo inactivos
- **GIVEN** otro proveedor con el mismo tipo/documento
- **WHEN** se intenta crear o editar usando ese par
- **THEN** SHALL rechazarse conservando el registro anterior

#### Scenario: Alta simultánea duplicada
- **GIVEN** dos solicitudes con el mismo par
- **WHEN** se procesan concurrentemente
- **THEN** SHALL persistirse como máximo un proveedor con ese par

#### Scenario: Coincidencia con cliente
- **GIVEN** un cliente existente con una identificación
- **WHEN** se registra un proveedor con el mismo par sin otro proveedor duplicado
- **THEN** SHALL permitirse sin duplicar ni alterar al cliente

#### Scenario: Retiro de identificación
- **GIVEN** un proveedor identificado
- **WHEN** se retiran conjuntamente tipo y documento
- **THEN** SHALL conservarse el proveedor con identificación ausente y nombre obligatorio

### Requirement: Consulta paginada de proveedores

El Administrador SHALL buscar por coincidencia parcial de identificación o nombre sin distinguir mayúsculas y quitando espacios exteriores, combinada con estado activo/inactivo/todos; activos SHALL ser el filtro inicial. SHALL paginarse en servidor con total y orden estable. SHALL permitir consultar fichas inactivas y conservar contexto al regresar; filtros o paginación inválidos SHALL responder con error corregible. Trazabilidad: RF-CAT-012; RNF-REN-005/006; RNF-USA-011; UI-036.

#### Scenario: Búsqueda por identificación o nombre
- **GIVEN** proveedores identificados y ocasionales
- **WHEN** se busca por parte del documento o del nombre
- **THEN** SHALL devolverse las coincidencias sin excluir a ocasionales de búsquedas por nombre

#### Scenario: Filtro y paginación
- **GIVEN** proveedores activos e inactivos suficientes para varias páginas
- **WHEN** se consulta estado inactivo y se recorren páginas sin cambios del catálogo
- **THEN** SHALL recibirse solo inactivos sin repetición ni omisión con total consistente

#### Scenario: Sin coincidencias
- **GIVEN** una búsqueda válida
- **WHEN** ningún proveedor coincide
- **THEN** SHALL mostrarse un resultado vacío y permitir limpiar filtros

#### Scenario: Ficha y retorno
- **GIVEN** una consulta con filtros y página
- **WHEN** se abre una ficha y vuelve
- **THEN** SHALL conservarse el contexto de consulta

### Requirement: Estado sin pérdida histórica ni operaciones de compra

Proveedor SHALL desactivarse/reactivarse explícitamente, conservando identidad y referencias. Inactivo SHALL permanecer consultable y no disponible para nuevos ingresos; esta entrega SHALL exponer su estado y selección sin implementar ingresos. Repetir estado alcanzado SHALL ser inocuo. SHALL NOT admitirse eliminación física ordinaria ni generar compras, cuentas por pagar, pagos o saldos. No SHALL imponerse relación de proveedor único al producto ni crearse relación producto-proveedor desde este catálogo. Trazabilidad: RN-CAT-010; RF-CAT-012; DP-011; modelo-dominio-taller; exclusiones de proposal.

#### Scenario: Baja de proveedor referenciado
- **GIVEN** un proveedor con referencias históricas
- **WHEN** se confirma su desactivación
- **THEN** SHALL mantenerse consultable con esas referencias y excluirse de nuevas selecciones

#### Scenario: Reactivación
- **GIVEN** un proveedor inactivo
- **WHEN** se confirma su reactivación
- **THEN** SHALL recuperar la misma identidad y disponibilidad

#### Scenario: Estado repetido
- **GIVEN** un proveedor ya activo
- **WHEN** se repite su reactivación
- **THEN** SHALL conservarse sin efectos adicionales

#### Scenario: Intento de eliminación
- **GIVEN** un proveedor existente
- **WHEN** se solicita eliminación física ordinaria
- **THEN** SHALL denegarse y conservarse el registro

#### Scenario: Operación ajena al catálogo
- **GIVEN** un Administrador
- **WHEN** intenta registrar saldo, compra o proveedor exclusivo de producto mediante esta capacidad
- **THEN** SHALL rechazarse sin producir efectos económicos ni relaciones de exclusividad

### Requirement: Escrituras consistentes y auditables de proveedores

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

### Requirement: Experiencia integrada de proveedores

Las listas, fichas y formularios SHALL reutilizar navegación, tipografía, colores, espaciado y componentes del sistema visual vigente. SHALL comunicar carga, vacío, ausencia de coincidencias, error recuperable y éxito; asociar errores a campos, conservar entradas tras errores y prevenir envíos duplicados. Las acciones de estado SHALL solicitar confirmación con registro y efecto identificados. SHALL ser utilizables con teclado, etiquetas y foco visible a 360, 768, 1024 y 1440 px, sin desbordamiento horizontal de página ni estados comunicados solo por color. SHALL advertir cambios sin guardar y restaurar el foco al cerrar paneles. Los errores del servidor SHALL seguir el formato uniforme y quedar documentados en el **Contrato OpenAPI**; una ruta o registro inexistente SHALL comunicar ausencia sin producir cambios. Trazabilidad: UI-036/037; RNF-USA-001…011; sistema-visual-frontend; proposal.

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


