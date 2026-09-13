import { describe, expect, it } from 'vitest'

import { formatAction, formatTargetType, METADATA_LABELS } from './labels'

describe('audit labels and formatters', () => {
  it('formats known registry actions into Spanish business labels', () => {
    expect(formatAction('registry.customer_created')).toBe(
      'Creación de cliente',
    )
    expect(formatAction('registry.customer_deactivated')).toBe(
      'Desactivación de cliente',
    )
    expect(formatAction('registry.brand_created')).toBe('Creación de marca')
    expect(formatAction('registry.vehicle_created')).toBe(
      'Registro de vehículo',
    )
    expect(formatAction('registry.vehicle_owner_changed')).toBe(
      'Transferencia de propiedad',
    )
  })

  it('formats identity and authentication actions', () => {
    expect(formatAction('identity.user_created')).toBe('Creación de usuario')
    expect(formatAction('authentication.login_success')).toBe(
      'Inicio de sesión exitoso',
    )
    expect(formatAction('authorization.denied')).toBe('Acceso denegado')
  })

  it('returns raw action string for unknown actions', () => {
    expect(formatAction('custom.unknown_action')).toBe('custom.unknown_action')
  })

  it('formats target types', () => {
    expect(formatTargetType('customer')).toBe('Cliente')
    expect(formatTargetType('vehicle')).toBe('Vehículo')
    expect(formatTargetType('vehicle_brand')).toBe('Marca de vehículo')
    expect(formatTargetType('user')).toBe('Usuario')
    expect(formatTargetType('unknown_type')).toBe('unknown_type')
  })

  it('provides metadata labels including transfer properties', () => {
    expect(METADATA_LABELS.previous_owner_id).toBe('Propietario anterior (ID)')
    expect(METADATA_LABELS.new_owner_id).toBe('Nuevo propietario (ID)')
    expect(METADATA_LABELS.changed_fields).toBe('Campos modificados')
  })
})
