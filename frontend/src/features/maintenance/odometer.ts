import { ProblemError } from '@/shared/api/client'

import type { OdometerWarning } from './types'

/**
 * Aviso del servidor cuando el kilometraje es menor al último conocido del vehículo: no lo
 * prohíbe, pide una confirmación explícita. `null` si el error es otro.
 */
export function odometerWarningOf(error: unknown): OdometerWarning | null {
  if (
    error instanceof ProblemError &&
    error.code === 'odometer_confirmation_required' &&
    error.details
  ) {
    const d = error.details
    return {
      last_known_km: Number(d.last_known_km),
      order_id: Number(d.order_id),
      order_number: String(d.order_number ?? ''),
    }
  }
  return null
}
