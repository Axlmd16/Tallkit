import { Link } from 'react-router'

import { useHomeUnbilled } from '@/features/home/hooks'
import { useBusinessName } from '@/shared/api/entity-logos'
import { Button, InlineNotice, Money, StatusBadge } from '@/shared/ui'

import { Column } from './Column'

export function UnbilledColumn({ enabled }: { enabled: boolean }) {
  const query = useHomeUnbilled(enabled)
  const commercialName = useBusinessName('commercial')
  const artisanName = useBusinessName('artesanal')

  if (!enabled) return null

  const commercialItems = query.data?.commercial?.items ?? []
  const artisanItems = query.data?.artisan?.items ?? []
  const items = [...artisanItems, ...commercialItems]
  const totalCount =
    (query.data?.commercial?.count ?? 0) + (query.data?.artisan?.count ?? 0)

  return (
    <Column
      count={query.isSuccess ? totalCount : undefined}
      id="home-unbilled"
      subtitle="Operaciones sin factura local"
      title="Falta facturar"
      tone="info"
    >
      {query.isPending && (
        <div className="space-y-2 p-4">
          <div className="h-14 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-muted" />
        </div>
      )}
      {query.isError && (
        <div className="p-4">
          <InlineNotice
            title="No se pudo cargar lo pendiente de facturar"
            tone="danger"
          >
            <Button
              onClick={() => void query.refetch()}
              type="button"
              variant="secondary"
            >
              Reintentar
            </Button>
          </InlineNotice>
        </div>
      )}
      {query.isSuccess && items.length === 0 && (
        <p className="p-4 text-body-sm text-ink-muted">
          No hay operaciones confirmadas pendientes de preparar factura local.
        </p>
      )}
      {query.isSuccess && items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const isCom = item.entity === 'COMERCIAL'
            const to =
              item.order_id != null
                ? `/maintenance/${item.order_id}/checkout`
                : `/sales/${item.source_id}/checkout`
            return (
              <li
                className="flex items-center justify-between gap-3 px-4 py-3"
                key={`${item.entity}-${item.source_id}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">
                    {item.customer_name || item.number}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {isCom ? commercialName : artisanName} · {item.number}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Money
                    amount={item.total}
                    className="text-body-sm font-semibold text-ink"
                  />
                  <Link
                    className="inline-flex min-h-9 items-center rounded-control border border-line-strong px-2.5 text-caption font-semibold text-ink hover:bg-surface-muted"
                    to={to}
                  >
                    Facturar
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="border-t border-line px-4 py-2">
        <StatusBadge label="Preparación local (pruebas)" tone="neutral" />
      </div>
    </Column>
  )
}
