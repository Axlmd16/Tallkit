import { ArrowLeft } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useOperation } from '@/features/inventory/hooks'
import { kindLabels, operationStateLabels } from '@/features/inventory/types'
import {
  Button,
  InlineNotice,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/shared/ui'

export function InventoryOperationDetailPage() {
  const id = Number(useParams().id)
  const query = useOperation(Number.isFinite(id) ? id : null)
  if (query.isPending) return <LoadingState label="Cargando operación…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar la operación" tone="danger">
        <Button
          onClick={() => void query.refetch()}
          type="button"
          variant="secondary"
        >
          Reintentar
        </Button>
      </InlineNotice>
    )
  }
  const op = query.data
  const originId = (ref: string) => ref.replace('INV-', '')
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        to="/inventory"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Volver a inventario
      </Link>
      <PageHeader description={kindLabels[op.kind]} title={op.reference} />
      <div className="flex flex-wrap gap-3">
        <StatusBadge
          label={operationStateLabels[op.state]}
          tone={op.state === 'POSTED' ? 'success' : 'neutral'}
        />
      </div>
      <dl className="grid gap-3 rounded-group bg-surface p-4 shadow-card sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-muted">Producto</dt>
          <dd className="font-semibold">
            {op.product ? `${op.product.code} — ${op.product.name}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Cantidad</dt>
          <dd className="font-semibold">{op.quantity ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Origen</dt>
          <dd>
            {op.origin.type}{' '}
            {op.origin.origin_url ? (
              <Link className="underline" to={op.origin.origin_url}>
                Abrir origen
              </Link>
            ) : (
              <span>({op.origin.reference})</span>
            )}
          </dd>
        </div>
        {op.reason !== undefined && (
          <div>
            <dt className="text-sm text-ink-muted">Motivo</dt>
            <dd>{op.reason || '—'}</dd>
          </div>
        )}
        {op.reverses_reference && (
          <div>
            <dt className="text-sm text-ink-muted">Compensa a</dt>
            <dd>
              <Link
                className="underline"
                to={`/inventory/operations/${originId(op.reverses_reference)}`}
              >
                {op.reverses_reference}
              </Link>
            </dd>
          </div>
        )}
      </dl>
      {op.entry_value !== undefined && (
        <section
          aria-label="Valoración"
          className="rounded-group bg-surface p-4 shadow-card"
        >
          <h2 className="font-semibold text-ink">Valoración</h2>
          <p>
            Costo unitario USD {op.unit_cost} · valor USD {op.entry_value}
          </p>
        </section>
      )}
      {op.movements && op.movements.length > 0 && (
        <section aria-label="Movimientos" className="space-y-2">
          {op.movements.map((m) => (
            <article
              className="rounded-group bg-surface p-4 shadow-card"
              key={m.ordinal}
            >
              <h3 className="font-semibold">Movimiento {m.ordinal}</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-ink-muted">Costo aplicado</dt>
                  <dd>USD {m.applied_unit_cost}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Variación de valor</dt>
                  <dd>USD {m.value_delta}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Ajuste de redondeo</dt>
                  <dd>USD {m.rounding_adjustment}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Valor posterior</dt>
                  <dd>USD {m.value_after}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
