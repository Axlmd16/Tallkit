import { ArrowLeft } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useOperation } from '@/features/inventory/hooks'
import { NoCost } from '@/features/inventory/NoCost'
import { kindLabels, operationStateLabels } from '@/features/inventory/types'
import { Button, InlineNotice, LoadingState, StatusBadge } from '@/shared/ui'

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
  const panel = 'rounded-panel border border-line bg-surface'
  const link = 'code font-semibold text-accent hover:underline'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label="Volver a inventario"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a inventario"
          to="/inventory"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-label text-ink-muted">{kindLabels[op.kind]}</p>
          <h1 className="code text-page font-semibold text-ink">
            {op.reference}
          </h1>
        </div>
      </div>
      <section
        aria-label="Resumen de la operación"
        className={`${panel} px-5 py-4`}
      >
        <div className="mb-3">
          <StatusBadge
            label={operationStateLabels[op.state]}
            tone={op.state === 'POSTED' ? 'success' : 'neutral'}
          />
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-body sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label text-ink-muted">Producto</dt>
            <dd className="mt-0.5 font-medium">
              {op.product ? (
                <>
                  <span className="code text-label font-semibold">
                    {op.product.code}
                  </span>{' '}
                  — {op.product.name}
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-label text-ink-muted">Cantidad</dt>
            <dd className="mt-0.5 code font-semibold tabular-nums">
              {op.quantity ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-label text-ink-muted">Origen</dt>
            <dd className="mt-0.5">
              {op.origin.type}{' '}
              {op.origin.origin_url ? (
                <Link
                  className="font-semibold text-accent hover:underline"
                  to={op.origin.origin_url}
                >
                  Abrir origen
                </Link>
              ) : (
                <span className="code">({op.origin.reference})</span>
              )}
            </dd>
          </div>
          {op.reason !== undefined && (
            <div className="sm:col-span-2">
              <dt className="text-label text-ink-muted">Motivo</dt>
              <dd className="mt-0.5">{op.reason || '—'}</dd>
            </div>
          )}
          {op.reverses_reference && (
            <div>
              <dt className="text-label text-ink-muted">Compensa a</dt>
              <dd className="mt-0.5">
                <Link
                  className={link}
                  to={`/inventory/operations/${originId(op.reverses_reference)}`}
                >
                  {op.reverses_reference}
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </section>
      {op.entry_value !== undefined && (
        <section aria-label="Valoración" className={`${panel} px-4 py-3`}>
          <h2 className="text-body font-semibold text-ink">Valoración</h2>
          <p className="mt-1 text-body tabular-nums">
            {op.entry_value === null ? (
              <NoCost />
            ) : (
              <>
                Costo unitario USD {op.unit_cost} · valor USD {op.entry_value}
              </>
            )}
          </p>
        </section>
      )}
      {op.movements && op.movements.length > 0 && (
        <section
          aria-label="Movimientos"
          className={`${panel} overflow-hidden`}
        >
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-body font-semibold text-ink">Movimientos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-body">
              <thead>
                <tr className="border-b border-line bg-surface-subtle text-micro font-semibold tracking-[0.04em] text-ink-muted uppercase">
                  <th className="h-9 px-4" scope="col">
                    Movimiento
                  </th>
                  <th className="h-9 px-4 text-right" scope="col">
                    Costo aplicado
                  </th>
                  <th className="h-9 px-4 text-right" scope="col">
                    Variación de valor
                  </th>
                  <th className="h-9 px-4 text-right" scope="col">
                    Ajuste de redondeo
                  </th>
                  <th className="h-9 px-4 text-right" scope="col">
                    Valor posterior
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {op.movements.map((m) => (
                  <tr key={m.ordinal}>
                    <td className="h-11 px-4 font-medium">
                      Movimiento {m.ordinal}
                    </td>
                    <td className="h-11 px-4 text-right">
                      {m.applied_unit_cost === null ? (
                        <NoCost />
                      ) : (
                        `USD ${m.applied_unit_cost}`
                      )}
                    </td>
                    <td className="h-11 px-4 text-right">
                      {m.value_delta === null ? (
                        <NoCost />
                      ) : (
                        `USD ${m.value_delta}`
                      )}
                    </td>
                    <td className="h-11 px-4 text-right">
                      USD {m.rounding_adjustment}
                    </td>
                    <td className="h-11 px-4 text-right">
                      {m.value_after === null ? (
                        <NoCost />
                      ) : (
                        `USD ${m.value_after}`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
