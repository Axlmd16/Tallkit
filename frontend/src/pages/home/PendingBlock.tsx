import {
  CheckCircle,
  Coins,
  HourglassMedium,
  ListChecks,
  NotePencil,
  SealPercent,
  type Icon,
} from '@phosphor-icons/react'
import { Link } from 'react-router'

import {
  pendingTargets,
  qualificationTarget,
} from '@/features/home/pendingTargets'
import type {
  HomePending,
  PendingKey,
  QualificationNotice,
} from '@/features/home/types'
import { InlineNotice, SectionPanel, StatGrid, StatLink } from '@/shared/ui'

import { BlockStates, isEmptyBlock, type BlockQuery } from './BlockStates'

const ICONS: Record<PendingKey, Icon> = {
  open_orders: ListChecks,
  cash_sales_unpaid: Coins,
  cash_services_unpaid: Coins,
  proformas_expiring: HourglassMedium,
  withholdings_pending: SealPercent,
  sale_drafts: NotePencil,
  proforma_drafts: NotePencil,
}

const longDate = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDay(date: string): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  return longDate.format(new Date(year, month - 1, day))
}

function remaining(days: number): string {
  if (days === 0) return 'Vence hoy'
  return days === 1 ? 'Falta 1 día' : `Faltan ${days} días`
}

function QualificationAlert({ notice }: { notice: QualificationNotice }) {
  const day = formatDay(notice.expires_on)
  return (
    <div className="border-b border-line px-4 py-3">
      <InlineNotice
        title={
          notice.expired
            ? `La calificación artesanal venció el ${day}`
            : `La calificación artesanal vence el ${day}`
        }
        tone={notice.expired ? 'danger' : 'warning'}
      >
        <p>
          {notice.expired
            ? 'El taller no puede preparar facturas hasta renovarla.'
            : `${remaining(notice.days_left)}. Renuévela para seguir preparando facturas con IVA 0 %.`}{' '}
          <Link
            className="font-semibold underline"
            to={qualificationTarget(notice.entity_id)}
          >
            Revisar la calificación
          </Link>
        </p>
      </InlineNotice>
    </div>
  )
}

/**
 * Pendientes del día en un solo panel: cada conteo conduce a su lista ya filtrada. El cero se
 * conserva, atenuado, para que la página no cambie de forma de un día a otro.
 */
export function PendingBlock({
  query,
  id = 'home-pending',
}: {
  query: BlockQuery<HomePending>
  id?: string
}) {
  if (isEmptyBlock(query, (data) => !data.items.length && !data.qualification))
    return null
  const allClear =
    query.data !== undefined &&
    !query.isError &&
    !query.data.qualification &&
    query.data.items.length > 0 &&
    query.data.items.every((item) => item.count === 0)

  return (
    <SectionPanel
      actions={
        allClear && (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <CheckCircle aria-hidden="true" size={17} weight="fill" />
            Todo al día
          </span>
        )
      }
      icon={<ListChecks aria-hidden="true" size={17} weight="bold" />}
      id={id}
      title="Pendientes"
    >
      <BlockStates
        errorTitle="No se pudieron cargar los pendientes"
        loadingLabel="Cargando pendientes…"
        query={query}
      >
        {(data) => (
          <>
            {data.qualification && (
              <QualificationAlert notice={data.qualification} />
            )}
            {data.items.length > 0 && (
              <StatGrid label="Pendientes por atender">
                {pendingTargets(data.items).map((target) => {
                  const TargetIcon = ICONS[target.key]
                  return (
                    <StatLink
                      icon={<TargetIcon aria-hidden="true" size={18} />}
                      key={target.id}
                      label={target.label}
                      scope={target.scope}
                      to={target.to}
                      value={target.count}
                    />
                  )
                })}
              </StatGrid>
            )}
          </>
        )}
      </BlockStates>
    </SectionPanel>
  )
}
