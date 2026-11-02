## ADDED Requirements

### Requirement: Acceso fiscal comercial sin cambiar la confirmación de venta

Administrador y Vendedor SHALL poder acceder desde una venta confirmada a su preparación fiscal, solicitudes y evidencias vinculadas, según los permisos de cada capacidad. La consulta SHALL distinguir **documento interno**, **estado de pago**, preparación local y evidencia externa no verificada. El comprobante interno SHALL conservar número, historia y advertencia de que no constituye factura electrónica autorizada. Un Encargado sin rol comercial SHALL conservar exclusivamente su consulta limitada de ventas vinculadas y SHALL NOT acceder por ella a expedientes fiscales, XML ni acciones fiscales comerciales. Trazabilidad: propuesta P1/P2 y Modified Capabilities; DP-018/029; RN-FIS-009; RF-VEN-015; spec principal de ventas, autorización por acción.

#### Scenario: Venta confirmada sin preparación
- **DADO** una venta confirmada consultada por un Vendedor
- **CUANDO** abre el apartado fiscal
- **ENTONCES** SHALL mostrarse sin preparación y ofrecer la acción autorizada, sin sugerir autorización pendiente ya solicitada.

#### Scenario: Evidencia importada vinculada
- **DADO** una venta con un XML externo archivado y vinculado
- **CUANDO** el Vendedor consulta su situación fiscal
- **ENTONCES** SHALL ver identidad, origen externo y condición no verificada, y descargar únicamente la evidencia a la que tenga acceso, sin sustituir el número interno.

#### Scenario: Encargado intenta seguir enlace fiscal comercial
- **DADO** un Encargado que puede consultar el resumen de una venta vinculada
- **CUANDO** intenta abrir su XML o preparación comercial sin rol adicional
- **ENTONCES** SHALL denegarse conservando el acceso limitado al resumen económico autorizado.

### Requirement: Independencia comercial durante la preparación fiscal

Confirmar, cobrar, devolver o anular una venta SHALL conservar sus requisitos existentes. La falta de perfil fiscal adicional, certificado o integración SHALL NOT bloquear una confirmación interna válida ni producir llamadas externas. Las correcciones comerciales SHALL mantenerse visibles para el seguimiento fiscal sin emitir documentos ni modificar evidencias. La incorporación de esta capacidad SHALL NOT preparar automáticamente ventas previas ni cambiar su historia. Trazabilidad: propuesta P2; DP-017/018/027/028; RN-CON-002/007/010.

#### Scenario: Confirmación sin configuración fiscal adicional
- **DADO** una venta que cumple la configuración interna pero tiene perfil electrónico incompleto
- **CUANDO** el Vendedor confirma
- **ENTONCES** SHALL confirmarse conforme a las reglas comerciales, sin autorización fiscal ni número fiscal productivo y sin ocultar los pendientes al entrar en preparación.

#### Scenario: Despliegue sobre ventas históricas
- **DADO** ventas confirmadas antes de disponer del módulo fiscal
- **CUANDO** se habilita esta capacidad
- **ENTONCES** SHALL conservarse su estado y no crearse intenciones, facturas ni cobros retrospectivos.
