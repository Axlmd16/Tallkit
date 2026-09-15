export const ACTION_LABELS: Record<string, string> = {
  // Registro de clientes
  'registry.customer_created': 'Creación de cliente',
  'registry.customer_updated': 'Actualización de cliente',
  'registry.customer_activated': 'Activación de cliente',
  'registry.customer_deactivated': 'Desactivación de cliente',

  // Catálogo de marcas
  'registry.brand_created': 'Creación de marca',
  'registry.brand_updated': 'Actualización de marca',
  'registry.brand_activated': 'Activación de marca',
  'registry.brand_deactivated': 'Desactivación de marca',

  // Registro de vehículos y propiedad
  'registry.vehicle_created': 'Registro de vehículo',
  'registry.vehicle_updated': 'Actualización de vehículo',
  'registry.vehicle_activated': 'Activación de vehículo',
  'registry.vehicle_deactivated': 'Desactivación de vehículo',
  'registry.vehicle_owner_changed': 'Transferencia de propiedad',

  // Identidad y usuarios
  'identity.user_created': 'Creación de usuario',
  'identity.user_updated': 'Actualización de usuario',
  'identity.user_activated': 'Activación de usuario',
  'identity.user_deactivated': 'Desactivación de usuario',
  'identity.user_roles_changed': 'Cambio de roles de usuario',
  'identity.password_reset': 'Restablecimiento de contraseña',
  'identity.temp_password_issued': 'Emisión de contraseña temporal',
  'identity.temp_password_cleared': 'Cancelación de contraseña temporal',

  // Autenticación y autorización
  'authentication.login_success': 'Inicio de sesión exitoso',
  'authentication.login_failed': 'Intento fallido de inicio de sesión',
  'authentication.logout': 'Cierre de sesión',
  'authorization.denied': 'Acceso denegado',
  'authorization.permission_denied': 'Permiso denegado',

  // Configuración operativa y fiscal
  'workshop_configuration.initialized': 'Inicialización del taller',
  'workshop_configuration.entity_updated': 'Actualización de entidad fiscal',
  'workshop_configuration.warehouse_updated': 'Actualización de bodega',
  'workshop_configuration.tax_definition_created':
    'Creación de definición de impuesto',
  'workshop_configuration.tax_period_created':
    'Creación de vigencia de impuesto',
  'workshop_configuration.tax_period_updated':
    'Actualización de vigencia de impuesto',
  'workshop_configuration.successor_scheduled':
    'Sucesión de vigencia de impuesto programada',
  'workshop_configuration.series_code_updated':
    'Actualización de código de serie',
  'workshop_configuration.series_replaced':
    'Sustitución de serie de documentos',
}

export function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export const TARGET_TYPE_LABELS: Record<string, string> = {
  customer: 'Cliente',
  vehicle: 'Vehículo',
  vehicle_brand: 'Marca de vehículo',
  user: 'Usuario',
  authentication: 'Autenticación',
  authorization: 'Autorización',
  workshop_configuration: 'Instalación',
  fiscal_entity: 'Entidad fiscal',
  warehouse: 'Bodega',
  tax_definition: 'Impuesto',
  tax_period: 'Vigencia de impuesto',
  document_series: 'Serie de documentos',
}

export function formatTargetType(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? targetType
}

export const METADATA_LABELS: Record<string, string> = {
  previous_owner_id: 'Propietario anterior (ID)',
  new_owner_id: 'Nuevo propietario (ID)',
  changed_fields: 'Campos modificados',
  roles_added: 'Roles asignados',
  roles_removed: 'Roles revocados',
  path: 'Ruta',
  method: 'Método HTTP',
  attempts: 'Intentos',
  permission: 'Permiso requerido',
}
