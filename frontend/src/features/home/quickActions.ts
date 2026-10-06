import {
  Coins,
  DownloadSimple,
  FileText,
  Receipt,
  Wrench,
  type Icon,
} from '@phosphor-icons/react'

import type { ScopeLabelScope } from '@/shared/ui'

export interface QuickAction {
  id: string
  label: string
  to: string
  icon: Icon
  /** Permiso que ya exige la pantalla de destino. */
  permission: string
  /** Solo en accesos de cobro: distingue repuestos de servicios. */
  scope?: ScopeLabelScope
}

/**
 * Operaciones más frecuentes. Cada acceso solo abre su pantalla: nada se crea, confirma ni
 * cobra desde el inicio. «Cobrar» lleva a las cuentas por cobrar, donde se elige la operación.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'new-sale',
    label: 'Nueva venta',
    to: '/sales/new',
    icon: Receipt,
    permission: 'ventas.crear',
  },
  {
    id: 'new-proforma',
    label: 'Nueva proforma',
    to: '/proformas/new',
    icon: FileText,
    permission: 'proformas.gestionar',
  },
  {
    id: 'new-maintenance',
    label: 'Nuevo mantenimiento',
    to: '/maintenance/new',
    icon: Wrench,
    permission: 'mantenimientos.gestionar',
  },
  {
    id: 'new-entry',
    label: 'Registrar entrada',
    to: '/purchases/new',
    icon: DownloadSimple,
    permission: 'ingresos.crear',
  },
  {
    id: 'charge-parts',
    label: 'Cobrar repuestos',
    to: '/sales/receivables',
    icon: Coins,
    permission: 'pagos_comerciales.registrar',
    scope: 'commercial',
  },
  {
    id: 'charge-services',
    label: 'Cobrar servicios',
    to: '/maintenance/receivables',
    icon: Coins,
    permission: 'pagos_artesanales.registrar',
    scope: 'artesanal',
  },
]

export function visibleQuickActions(
  permissions: ReadonlySet<string>,
): QuickAction[] {
  return QUICK_ACTIONS.filter((action) => permissions.has(action.permission))
}
