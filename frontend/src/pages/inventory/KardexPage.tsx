import { ArrowLeft, ArrowsClockwise } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { useUrlFilters } from '@/features/catalog-common/filters'
import { useKardex } from '@/features/inventory/hooks'
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
    <div className="catalog-page space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        to={from ?? '/inventory'}
      >
        <ArrowLeft aria-hidden="true" size={16} />
        {from ? 'Volver a la ficha del producto' : 'Volver a inventario'}
      </Link>
      <PageHeader
        description="Historia de movimientos del producto con saldos reales de existencia."
        title="Kardex del producto"
      />
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
            className="grid gap-3 rounded-group bg-surface p-4 shadow-card sm:grid-cols-3"
          >
            <h2 className="sm:col-span-3 font-semibold text-ink">
              Saldos del período
            </h2>
            <p>
              <span className="block text-sm text-ink-muted">
                Saldo inicial
              </span>
              <strong>{data.opening_quantity}</strong>
            </p>
            <p>
              <span className="block text-sm text-ink-muted">Saldo final</span>
              <strong>{data.closing_quantity}</strong>
            </p>
            <p>
              <span className="block text-sm text-ink-muted">
                Movimientos del período
              </span>
              {totalsText(data.period_totals)}
            </p>
            {canSeeValuation && data.opening_value !== undefined && (
              <p className="sm:col-span-3 text-sm">
                Valor inicial USD {data.opening_value} · valor final USD{' '}
                {data.closing_value}
              </p>
            )}
          </section>
          <section
            aria-label="Coincidencias con los filtros"
            className="rounded-group bg-surface-muted p-4"
          >
            <h2 className="font-semibold text-ink">
              Coincidencias con los filtros
            </h2>
            <p>{totalsText(data.matching_totals)}</p>
            {data.page_opening_quantity !== null && (
              <p className="text-sm text-ink-muted">
                Saldo antes de la primera fila de esta página:{' '}
                {data.page_opening_quantity}
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
                      className="underline"
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
                  render: (row) => row.quantity_in,
                },
                {
                  header: 'Salida',
                  key: 'quantity_out',
                  priority: 'secondary',
                  render: (row) => row.quantity_out,
                },
                {
                  header: 'Saldo',
                  key: 'quantity_after',
                  priority: 'primary',
                  render: (row) => <strong>{row.quantity_after}</strong>,
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
                        render: (row: KardexRow) =>
                          row.applied_unit_cost ?? '—',
                      },
                      {
                        header: 'Valor del saldo',
                        key: 'value_after' as const,
                        priority: 'secondary' as const,
                        render: (row: KardexRow) => row.value_after ?? '—',
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
