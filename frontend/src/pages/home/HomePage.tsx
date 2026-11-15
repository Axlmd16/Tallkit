import { House } from '@phosphor-icons/react'
import { useState } from 'react'

import { useSession } from '@/features/auth/hooks'
import { useHomeCollections, useHomePending } from '@/features/home/hooks'
import { NewMaintenanceDialog } from '@/features/maintenance/NewMaintenanceDialog'
import { EmptyState, PageHeader } from '@/shared/ui'

import { CashToday } from './CashToday'
import { CounterHero } from './CounterHero'
import { OwedColumn } from './OwedColumn'
import { QualificationBanner } from './QualificationBanner'
import { WorkshopColumn } from './WorkshopColumn'

/** Permisos que dan acceso a algún aviso del servidor; este decide cuáles entrega. */
const NOTICE_PERMISSIONS = ['parametros.gestionar']
const MONEY_PERMISSIONS = ['pagos_comerciales.ver', 'pagos_artesanales.ver']
/** Quien puede ver algo de lo que Inicio muestra; sin esto no hay nada que ofrecer. */
const ACCESS_PERMISSIONS = [
  'mantenimientos.ver',
  'mantenimientos.gestionar',
  'ventas.ver',
  'ventas.crear',
  'parametros.gestionar',
  ...MONEY_PERMISSIONS,
]

/**
 * Inicio: el mostrador del día. Arriba, la búsqueda y los dos accesos de uso diario con lo
 * cobrado hoy por negocio; debajo, lo que está en el taller y lo que falta cobrar. Los
 * importes los calcula el servidor y siempre van separados por negocio, sin total conjunto.
 */
export function HomePage() {
  const [newOpen, setNewOpen] = useState(false)
  const permissions = new Set(useSession().data?.permissions ?? [])
  const has = (name: string) => permissions.has(name)

  const showWorkshop = has('mantenimientos.ver')
  const showOwedCommercial = has('pagos_comerciales.ver')
  const showOwedArtisan = has('pagos_artesanales.ver')
  const showMoney = showOwedCommercial || showOwedArtisan
  const showNotices = NOTICE_PERMISSIONS.some(has)
  const hasAccess = ACCESS_PERMISSIONS.some(has)

  const pending = useHomePending(showNotices)
  const collections = useHomeCollections(showMoney)

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <PageHeader icon={<House />} title="Inicio" />
        <EmptyState
          description="Cuando el administrador le asigne un rol, aquí verá sus accesos y pendientes."
          title="Su cuenta todavía no tiene funciones asignadas."
        />
      </div>
    )
  }

  const searchTarget = showWorkshop
    ? '/maintenance'
    : has('ventas.ver')
      ? '/sales'
      : null
  const onNewMaintenance = has('mantenimientos.gestionar')
    ? () => setNewOpen(true)
    : null
  const quickSaleTo = has('ventas.crear') ? '/sales/quick' : null

  return (
    <div className="space-y-5">
      <CounterHero
        aside={showMoney ? <CashToday query={collections} /> : null}
        onNewMaintenance={onNewMaintenance}
        quickSaleTo={quickSaleTo}
        searchTarget={searchTarget}
      />
      {showNotices && <QualificationBanner query={pending} />}
      {(showWorkshop || showMoney) && (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(18.75rem,1fr))]">
          {showWorkshop && (
            <WorkshopColumn onNewMaintenance={onNewMaintenance} />
          )}
          {showMoney && (
            <OwedColumn
              artisan={showOwedArtisan}
              canCollectArtisan={has('pagos_artesanales.registrar')}
              canCollectCommercial={has('pagos_comerciales.registrar')}
              commercial={showOwedCommercial}
            />
          )}
        </div>
      )}
      {newOpen && (
        <NewMaintenanceDialog onClose={() => setNewOpen(false)} open />
      )}
    </div>
  )
}
