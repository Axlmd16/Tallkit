import { House } from '@phosphor-icons/react'

import { useSession } from '@/features/auth/hooks'
import { roleLabels } from '@/features/auth/types'
import {
  useHomeCollections,
  useHomePending,
  useHomeReceivables,
} from '@/features/home/hooks'
import { visibleQuickActions } from '@/features/home/quickActions'
import { EmptyState, PageHeader } from '@/shared/ui'

import { CollectionsBlock } from './CollectionsBlock'
import { PendingBlock } from './PendingBlock'
import { QuickActionsBlock } from './QuickActionsBlock'
import { ReceivablesBlock } from './ReceivablesBlock'

/** Permisos que dan acceso a algún pendiente; el servidor decide cuáles entrega. */
const PENDING_PERMISSIONS = [
  'mantenimientos.ver',
  'pagos_comerciales.ver',
  'pagos_artesanales.ver',
  'proformas.ver',
  'ventas.ver',
  'parametros.gestionar',
]
const MONEY_PERMISSIONS = ['pagos_comerciales.ver', 'pagos_artesanales.ver']

/**
 * Inicio: resumen de trabajo de la sesión. Accesos a lo más frecuente, pendientes que conducen
 * a su lista, saldos por cobrar y cobros recientes, siempre separados por entidad fiscal. Los
 * valores los calcula el servidor; aquí solo se evita pedir lo que la sesión no puede ver.
 */
export function HomePage() {
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const roles = (session?.roles ?? []).map((role) => roleLabels[role])
  const actions = visibleQuickActions(permissions)
  const showPending = PENDING_PERMISSIONS.some((name) => permissions.has(name))
  const showMoney = MONEY_PERMISSIONS.some((name) => permissions.has(name))

  const pending = useHomePending(showPending)
  const receivables = useHomeReceivables(showMoney)
  const collections = useHomeCollections(showMoney)

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<House />}
        {...(session?.username
          ? {
              description: `Sesión de ${session.username}${roles.length > 0 ? ` · ${roles.join(' · ')}` : ''}.`,
            }
          : {})}
        title="Inicio"
      />
      {actions.length === 0 && !showPending && !showMoney ? (
        <EmptyState
          description="Cuando el administrador le asigne un rol, aquí verá sus accesos y pendientes."
          title="Su cuenta todavía no tiene funciones asignadas."
        />
      ) : (
        <>
          <QuickActionsBlock actions={actions} />
          {showPending && <PendingBlock query={pending} />}
          {showMoney && (
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
              <ReceivablesBlock
                className="xl:min-w-0 xl:flex-1"
                query={receivables}
              />
              <CollectionsBlock
                className="xl:min-w-0 xl:flex-[2]"
                query={collections}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
