import { ArrowLeft, ArrowsClockwise, Info } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { useKardex } from '@/features/inventory/hooks'
import { NoCost } from '@/features/inventory/NoCost'
import {
  kindLabels,
  type KardexRow,
  type KardexTotals,
  type OperationKind,
} from '@/features/inventory/types'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  ElevatedDataList,
  Field,
  FilterPanel,
  HintPopover,
  InlineNotice,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
} from '@/shared/ui'

const totalsText = (t: KardexTotals) =>
  `${t.count} movimientos · entradas ${t.quantity_in} · salidas ${t.quantity_out}`

export function KardexPage() {
  const productId = Number(useParams().id)
  const from = (useLocation().state as { from?: string } | null)?.from
  const filters = useUrlFilters()
  const canSeeValuation = new Set(useSession().data?.permissions ?? []).has(
    'inventario.ver_valorizacion',
  )
  // El corte se conserva hasta un cambio de filtros o un refresco explícito.
  const [cutState, setCutState] = useState<{
    key: string
    token: string
  } | null>(null)
  const filterKey = [
    'date_from',
    'date_to',
    'movement_type',
    'source_type',
    'source_id',
    'actor_id',
  ]
    .map((name) => filters.get(name))
    .join('|')
  // Un corte solo vale para los filtros con los que se obtuvo; no se reutiliza con otros.
  const cut = cutState?.key === filterKey ? cutState.token : undefined

  const query = useKardex(Number.isFinite(productId) ? productId : null, {
    dateFrom: filters.get('date_from') || undefined,
    dateTo: filters.get('date_to') || undefined,
    movementType: (filters.get('movement_type') || undefined) as
      | OperationKind
      | undefined,
    sourceType: filters.get('source_type') || undefined,
    sourceId: filters.getNumber('source_id'),
    actorId: filters.getNumber('actor_id'),
    page: filters.page,
    cutToken: cut,
  })
  const data = query.data
  useEffect(() => {
    if (data && !cut) setCutState({ key: filterKey, token: data.cut.token })
  }, [data, cut, filterKey])

  const cutExpired =
    query.error instanceof ProblemError && query.error.code === 'stale_record'

  return (
    <div className="catalog-page space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label={
            from ? 'Volver a la ficha del producto' : 'Volver a inventario'
          }
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title={
            from ? 'Volver a la ficha del producto' : 'Volver a inventario'
          }
          to={from ?? '/inventory'}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <PageHeader
            description="Historia de movimientos del producto con saldos reales de existencia."
            title="Kardex del producto"
          />
        </div>
      </div>
      <InlineNotice title="Está leyendo un corte de la historia" tone="info">
        Los movimientos confirmados después de abrir esta consulta no aparecen
        hasta que la actualice.{' '}
        <Button
          onClick={() => {
            setCutState(null)
            void query.refetch()
          }}
          type="button"
          variant="secondary"
        >
          <ArrowsClockwise aria-hidden="true" size={15} />
          Actualizar corte
        </Button>
      </InlineNotice>
      <FilterPanel
        label="Filtros del Kardex"
        layout="inline"
        {...(filters.filtered
          ? {
              onClear: () =>
                filters.set({
                  date_from: '',
                  date_to: '',
                  movement_type: '',
                  source_type: '',
                  source_id: '',
                  actor_id: '',
                }),
            }
          : {})}
      >
        <Field id="kardex-from" label="Desde">
          <Input
            id="kardex-from"
            onChange={(e) => filters.set({ date_from: e.target.value })}
            type="date"
            value={filters.get('date_from')}
          />
        </Field>
        <Field id="kardex-to" label="Hasta">
          <Input
            id="kardex-to"
            onChange={(e) => filters.set({ date_to: e.target.value })}
            type="date"
            value={filters.get('date_to')}
          />
        </Field>
        <Field id="kardex-type" label="Tipo de movimiento">
          <Select
            id="kardex-type"
            onChange={(e) => filters.set({ movement_type: e.target.value })}
            value={filters.get('movement_type')}
          >
            <option value="">Todos</option>
            {(Object.keys(kindLabels) as OperationKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {kindLabels[kind]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="kardex-source" label="Origen">
          <Select
            id="kardex-source"
            onChange={(e) =>
              filters.set({ source_type: e.target.value, source_id: '' })
            }
            value={filters.get('source_type')}
          >
            <option value="">Todos</option>
            <option value="PURCHASE">Ingreso de compra</option>
            <option value="PURCHASE_VOID">Anulación de ingreso</option>
          </Select>
        </Field>
        {filters.get('source_type') && (
          <Field id="kardex-source-id" label="Identificador del origen">
            <Input
              id="kardex-source-id"
              inputMode="numeric"
              onChange={(e) => filters.set({ source_id: e.target.value })}
              value={filters.get('source_id')}
            />
          </Field>
        )}
        <Field id="kardex-actor" label="Usuario (identificador)">
          <Input
            id="kardex-actor"
            inputMode="numeric"
            onChange={(e) => filters.set({ actor_id: e.target.value })}
            value={filters.get('actor_id')}
          />
        </Field>
      </FilterPanel>
      {query.isPending && <LoadingState label="Cargando Kardex…" />}
      {(query.isError || (!query.isPending && !data)) && (
        <InlineNotice
          title={
            cutExpired
              ? 'El corte venció'
              : 'No fue posible consultar el Kardex'
          }
          tone="danger"
        >
          {cutExpired
            ? 'Actualice el corte para leer la historia vigente; no se mezclan cortes distintos.'
            : 'No se muestra ningún saldo hasta reintentar.'}{' '}
          <Button
            onClick={() => {
              setCutState(null)
              void query.refetch()
            }}
            type="button"
            variant="secondary"
          >
            {cutExpired ? 'Actualizar corte' : 'Reintentar'}
          </Button>
        </InlineNotice>
      )}
      {data && (
        <>
          <section
            aria-label="Saldos del período"
            className="rounded-panel border border-line bg-surface"
          >
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[14.5px] font-semibold text-ink">
                Saldos del período
              </h2>
            </div>
            <dl className="grid gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-muted">Saldo inicial</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
                  {data.opening_quantity}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Saldo final</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
                  {data.closing_quantity}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">
                  Movimientos del período
                </dt>
                <dd className="mt-0.5 text-[13px] text-ink">
                  {totalsText(data.period_totals)}
                </dd>
              </div>
            </dl>
            {canSeeValuation && data.opening_value !== undefined && (
              <p className="flex flex-wrap items-center gap-x-1.5 border-t border-line px-4 py-2 text-[13px] text-ink-muted tabular-nums">
                Valor inicial{' '}
                {data.opening_value === null ? (
                  <NoCost />
                ) : (
                  `USD ${data.opening_value}`
                )}{' '}
                · valor final{' '}
                {data.closing_value === null ? (
                  <NoCost />
                ) : (
                  `USD ${data.closing_value}`
                )}
              </p>
            )}
          </section>
          <section
            aria-label="Coincidencias con los filtros"
            className="rounded-panel border border-line bg-surface-subtle px-4 py-3 text-[13px]"
          >
            <h2 className="font-semibold text-ink">
              Coincidencias con los filtros
            </h2>
            <p className="mt-0.5">{totalsText(data.matching_totals)}</p>
            {data.page_opening_quantity !== null && (
              <p className="text-ink-muted">
                Saldo antes de la primera fila de esta página:{' '}
                <span className="font-mono tabular-nums">
                  {data.page_opening_quantity}
                </span>
              </p>
            )}
          </section>
          {data.results.length === 0 ? (
            <InlineNotice title="Sin movimientos" tone="info">
              No hay movimientos que coincidan con los filtros en este período.
            </InlineNotice>
          ) : (
            <ElevatedDataList<KardexRow>
              columns={[
                {
                  header: 'Fecha',
                  key: 'effective_at',
                  priority: 'primary',
                  render: (row) =>
                    new Date(row.effective_at).toLocaleString('es-EC'),
                },
                {
                  header: 'Tipo',
                  key: 'movement_type',
                  priority: 'secondary',
                  render: (row) => kindLabels[row.movement_type],
                },
                {
                  header: 'Origen',
                  key: 'source',
                  priority: 'secondary',
                  render: (row) => (
                    <Link
                      className="font-mono text-xs font-semibold text-accent hover:underline"
                      to={`/inventory/operations/${row.source.reference.replace('INV-', '')}`}
                    >
                      {row.source.reference}
                    </Link>
                  ),
                },
                {
                  header: 'Entrada',
                  key: 'quantity_in',
                  priority: 'secondary',
                  align: 'end',
                  render: (row) => (
                    <span className="tabular-nums">{row.quantity_in}</span>
                  ),
                },
                {
                  header: 'Salida',
                  key: 'quantity_out',
                  priority: 'secondary',
                  align: 'end',
                  render: (row) => (
                    <span className="tabular-nums">{row.quantity_out}</span>
                  ),
                },
                {
                  header: 'Saldo',
                  key: 'quantity_after',
                  priority: 'primary',
                  align: 'end',
                  render: (row) => (
                    <strong className="tabular-nums">
                      {row.quantity_after}
                    </strong>
                  ),
                },
                {
                  header: 'Responsable',
                  key: 'actor_id',
                  priority: 'secondary',
                  render: (row) => `Usuario #${row.actor_id}`,
                },
                ...(canSeeValuation
                  ? [
                      {
                        header: 'Costo aplicado',
                        key: 'applied_unit_cost' as const,
                        priority: 'secondary' as const,
                        align: 'end' as const,
                        render: (row: KardexRow) =>
                          row.cost_known === false ? (
                            <NoCost />
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              {row.applied_unit_cost ?? '—'}
                              {Number(row.regularization_value ?? 0) > 0 && (
                                <HintPopover
                                  align="end"
                                  label="Costo asignado a unidades previas"
                                  size="sm"
                                  trigger={
                                    <Info aria-hidden="true" size={14} />
                                  }
                                >
                                  Esta entrada trajo el primer costo: asignó USD{' '}
                                  {row.regularization_value} a las unidades que
                                  ya estaban sin costo.
                                </HintPopover>
                              )}
                            </span>
                          ),
                      },
                      {
                        header: 'Valor del saldo',
                        key: 'value_after' as const,
                        priority: 'secondary' as const,
                        align: 'end' as const,
                        render: (row: KardexRow) =>
                          row.value_after === null ? (
                            <NoCost />
                          ) : (
                            (row.value_after ?? '—')
                          ),
                      },
                    ]
                  : []),
              ]}
              getRowKey={(row) => row.ordinal}
              label="Movimientos del Kardex"
              rows={data.results}
            />
          )}
          {data.total_pages > 1 && (
            <Pagination
              onNext={() => filters.set({ page: data.page + 1 })}
              onPrevious={() => filters.set({ page: data.page - 1 })}
              page={data.page}
              totalItems={data.count}
              totalPages={data.total_pages}
            />
          )}
        </>
      )}
    </div>
  )
}
