import type { ScopeLabelScope } from '@/shared/ui'

import type { HomeScope, PendingItem, PendingKey } from './types'

/** El servidor nombra el ámbito en inglés; las piezas visuales usan el nombre del negocio. */
export const scopeOf = (scope: HomeScope): ScopeLabelScope =>
  scope === 'commercial' ? 'commercial' : 'artesanal'

const LABELS: Record<PendingKey, string> = {
  open_orders: 'Mantenimientos abiertos',
  cash_sales_unpaid: 'Ventas de contado sin cobrar',
  cash_services_unpaid: 'Servicios de contado sin cobrar',
  proformas_expiring: 'Proformas por vencer',
  withholdings_pending: 'Retenciones por completar',
  sale_drafts: 'Ventas en borrador',
  proforma_drafts: 'Proformas en borrador',
}

/**
 * Lista a la que conduce cada pendiente, con el mismo filtro con que el servidor lo contó:
 * el número del inicio coincide con lo que la lista muestra.
 */
const TARGETS: Record<PendingKey, (scope: HomeScope | null) => string> = {
  open_orders: () => '/maintenance?state=OPEN',
  cash_sales_unpaid: () =>
    '/sales/receivables?condition=CONTADO&only_debt=true',
  cash_services_unpaid: () => '/maintenance/receivables?condition=CONTADO',
  proformas_expiring: () => '/proformas?state=VALID&expires_within_days=1',
  withholdings_pending: (scope) =>
    scope === 'artisan' ? '/maintenance/withholdings' : '/sales/withholdings',
  sale_drafts: () => '/sales?state=DRAFT',
  proforma_drafts: () => '/proformas?state=DRAFT',
}

export interface PendingTarget {
  id: string
  key: PendingKey
  label: string
  to: string
  count: number
  scope: ScopeLabelScope | undefined
}

/** Un pendiente que esta versión de la interfaz no conoce se omite, no se inventa. */
export function pendingTargets(items: readonly PendingItem[]): PendingTarget[] {
  return items
    .filter((item) => item.key in TARGETS)
    .map((item) => ({
      id: `${item.key}:${item.scope ?? 'shared'}`,
      key: item.key,
      label: LABELS[item.key],
      to: TARGETS[item.key](item.scope),
      count: item.count,
      scope: item.scope ? scopeOf(item.scope) : undefined,
    }))
}

export const RECEIVABLE_TARGETS: Record<
  HomeScope,
  { label: string; to: string }
> = {
  commercial: { label: 'Repuestos por cobrar', to: '/sales/receivables' },
  artisan: { label: 'Servicios por cobrar', to: '/maintenance/receivables' },
}

/** Perfil tributario de la entidad artesanal, donde se renueva la calificación. */
export const qualificationTarget = (entityId: number) =>
  `/configuration?tab=facturacion&entidad=${entityId}`
