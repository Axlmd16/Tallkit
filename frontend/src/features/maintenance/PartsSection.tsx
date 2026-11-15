import { Package, X } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  ConfirmationPanel,
  InlineNotice,
  LoadingState,
  Money,
  StatusBadge,
} from '@/shared/ui'

import { useBillingMutations, useOrderParts } from './billingHooks'
import { maintenanceKeys } from './hooks'
import { sumMoney } from './money'
import { QuantityStepper } from './QuantityStepper'
import { PartAdder } from './WorkSearch'
import type { LinkedSale, MaintenanceOrder } from './types'

type DraftLine = LinkedSale['lines'][number]

/**
 * Repuestos de la orden como venta comercial vinculada (RUC comercial). Agregar reserva
 * disponibilidad sin descontar inventario ni generar deuda; la salida ocurre cuando el
 * Vendedor o el Administrador confirma la venta. Las ventas confirmadas no se editan aquí.
 * Los repuestos se agregan desde el buscador de la ficha; aquí se cambia su cantidad o se quitan.
 */
export function PartsSection({
  order,
  onDone,
  canOpenSales,
  canSeeKardex = false,
}: {
  order: MaintenanceOrder
  onDone: (message: string) => void
  canOpenSales: boolean
  /** Con `inventario.ver`, cada repuesto confirmado enlaza a su Kardex. */
  canSeeKardex?: boolean
}) {
  const canManage = (order.billing_actions ?? []).includes('manage_parts')
  const query = useOrderParts(order.id)
  const [removing, setRemoving] = useState<DraftLine | null>(null)
  const [removeError, setRemoveError] = useState('')
  const [stepError, setStepError] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const mutations = useBillingMutations()
  const queryClient = useQueryClient()
  const tracker = useIntentTracker()

  const sales = query.data ?? []
  const draft = sales.find((sale) => sale.state === 'DRAFT') ?? null
  const confirmed = sales.filter((sale) => sale.state !== 'DRAFT')
  const total = sumMoney(
    draft?.estimate?.totals?.total ?? null,
    ...confirmed
      .filter((sale) => sale.state === 'CONFIRMED')
      .map((sale) => sale.grand_total),
  )

  async function remove(line: DraftLine) {
    setRemoveError('')
    try {
      await tracker.run({ removePart: line.id }, (key) =>
        mutations.removePart.mutateAsync({
          id: order.id,
          lineId: line.id,
          expectedVersion: order.version,
          key,
        }),
      )
      setRemoving(null)
      onDone(
        `Repuesto «${line.product_name ?? ''}» retirado; su reserva quedó liberada.`,
      )
    } catch (error) {
      setRemoveError(describeProblem(error).message)
    }
  }

  // La versión vigente se lee al guardar: varios clics seguidos salen uno detrás de otro.
  const version = useRef(order.version)
  version.current = order.version

  async function setQuantity(line: DraftLine, next: number) {
    const quantity = String(next)
    setStepError('')
    try {
      await tracker.run({ changePart: line.id, quantity }, (key) =>
        mutations.changePart.mutateAsync({
          id: order.id,
          lineId: line.id,
          quantity,
          expectedVersion: version.current,
          key,
        }),
      )
    } catch (error) {
      const problem = describeProblem(error)
      if (problem.staleRecord) {
        void queryClient.invalidateQueries({ queryKey: maintenanceKeys.root })
        setStepError(
          'La orden cambió mientras se guardaba. Ya se cargó la versión actual; repita el cambio si hace falta.',
        )
      } else {
        setStepError(problem.message)
      }
      throw error
    }
  }

  const pendingLines = draft?.lines.length ?? 0
  const units = (draft?.lines ?? []).reduce(
    (n, line) => n + Number(line.quantity),
    0,
  )
  const [expanded, setExpanded] = useState<boolean | null>(null)
  const show = expanded ?? (pendingLines > 0 || confirmed.length > 0)
  const summary =
    sales.length === 0
      ? 'No se usaron repuestos del almacén'
      : pendingLines > 0
        ? `${units} ${units === 1 ? 'repuesto' : 'repuestos'} · USD ${total ?? '—'} · falta confirmar`
        : `Repuestos confirmados · USD ${total ?? '—'}`

  return (
    <section
      aria-labelledby="order-parts-title"
      className="rounded-card border-[1.5px] border-dashed border-line-dashed bg-surface-subtle px-5 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-[34px] shrink-0 place-items-center rounded-control bg-surface-muted text-ink-muted"
          >
            <Package size={17} />
          </span>
          <span className="leading-snug">
            <h2 className="text-body font-bold" id="order-parts-title">
              Repuestos del almacén{' '}
              <span className="font-medium text-ink-muted">· opcional</span>
            </h2>
            <span className="text-label text-ink-muted">{summary}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingLines > 0 && draft && canOpenSales && (
            <Link
              className="ui-button inline-flex min-h-10 items-center rounded-control border border-ink px-3.5 text-body font-semibold text-ink hover:bg-ink hover:text-white"
              to={`/sales/${draft.id}`}
            >
              Confirmar repuestos
            </Link>
          )}
          {order.state !== 'FINALIZED' && (
            <button
              className="ui-button inline-flex min-h-10 items-center rounded-control px-3 text-body font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
              onClick={() => setExpanded(!show)}
              type="button"
            >
              {show
                ? 'Ocultar'
                : sales.length > 0
                  ? 'Ver o cambiar'
                  : '+ Agregar repuesto'}
            </button>
          )}
        </div>
      </div>
      {order.state === 'REOPENED' && (
        <div className="mt-2.5">
          <InlineNotice title="Reapertura por corrección" tone="info">
            El trabajo correctivo no genera cobro: no se agregan repuestos a una
            venta. La reposición por corrección es una operación futura del
            Administrador.
          </InlineNotice>
        </div>
      )}
      {show && (
        <div className="mt-2.5">
          {canManage && <PartAdder order={order} />}
          {query.isPending && (
            <div className="py-2">
              <LoadingState label="Cargando repuestos…" />
            </div>
          )}
          {query.isError && (
            <div className="py-2">
              <InlineNotice
                title="No se pudieron cargar los repuestos"
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
          {stepError && (
            <div className="py-2">
              <InlineNotice title="No se cambió la cantidad" tone="danger">
                {stepError}
              </InlineNotice>
            </div>
          )}
          {draft && draft.lines.length > 0 && (
            <DraftSale
              canManage={canManage}
              canOpenSales={canOpenSales}
              onRemove={(line, target) => {
                returnFocus.current = target
                setRemoveError('')
                setRemoving(line)
              }}
              onQuantity={setQuantity}
              sale={draft}
            />
          )}
          {confirmed.map((sale) => (
            <ConfirmedSale
              canOpenSales={canOpenSales}
              canSeeKardex={canSeeKardex}
              key={sale.id}
              sale={sale}
            />
          ))}
        </div>
      )}
      <p className="mt-2.5 text-label text-ink-muted">
        Si el cliente trajo sus propios repuestos, anótelo en las observaciones.
      </p>
      <ConfirmationPanel
        confirmLabel="Retirar repuesto"
        description={
          removing
            ? `Se retirará «${removing.product_name ?? ''}» de la venta pendiente y se liberará su reserva. No hay movimiento de inventario.`
            : ''
        }
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
        open={removing !== null}
        returnFocusRef={returnFocus}
        title="Retirar repuesto"
        tone="danger"
      >
        {removeError && (
          <InlineNotice title="No se retiró el repuesto" tone="danger">
            {removeError}
          </InlineNotice>
        )}
      </ConfirmationPanel>
    </section>
  )
}

function DraftSale({
  sale,
  canManage,
  canOpenSales,
  onQuantity,
  onRemove,
}: {
  sale: LinkedSale
  canManage: boolean
  canOpenSales: boolean
  onQuantity: (line: DraftLine, next: number) => Promise<void>
  onRemove: (line: DraftLine, target: HTMLElement) => void
}) {
  const estimate = new Map(
    (sale.estimate?.lines ?? []).map((line) => [line.position, line]),
  )
  const stock = new Map(
    (sale.estimate?.availability ?? []).map((item) => [
      item.product_id,
      item.current_quantity,
    ]),
  )
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-2.5">
        <StatusBadge label="Reservado, pendiente de confirmar" tone="warning" />
        {canOpenSales && (
          <Link className="text-body hover:underline" to={`/sales/${sale.id}`}>
            Abrir venta pendiente
          </Link>
        )}
        <p className="basis-full text-label text-ink-muted">
          Reserva la disponibilidad sin descontar inventario ni generar deuda.
          La salida ocurre cuando el Vendedor o el Administrador confirma la
          venta; la orden no puede finalizar mientras haya repuestos pendientes.
        </p>
      </div>
      {sale.lines.map((line) => {
        const values = estimate.get(line.position)
        const name = line.product_name ?? ''
        return (
          <PartRow
            actions={
              canManage ? (
                <>
                  <QuantityStepper
                    name={name}
                    onChange={(next) => onQuantity(line, next)}
                    value={Number(line.quantity)}
                  />
                  <button
                    aria-label={`Retirar ${name}`}
                    className="grid size-10 place-items-center rounded-full text-ink-muted hover:bg-danger-soft hover:text-danger"
                    onClick={(event) => onRemove(line, event.currentTarget)}
                    type="button"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </>
              ) : (
                <span className="text-label text-ink-muted">
                  × {Number(line.quantity)}
                </span>
              )
            }
            line={line}
            stock={stock.get(line.product_id)}
            total={values?.total_amount ?? null}
            unit={values?.unit_price ?? null}
          />
        )
      })}
    </div>
  )
}

function PartRow({
  line,
  stock,
  unit,
  total,
  actions,
  kardex = false,
}: {
  line: DraftLine
  /** Existencia informada por el servidor, si la tiene. */
  stock?: string | undefined
  unit: string | null
  total: string | null
  actions: React.ReactNode
  kardex?: boolean
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 border-t border-line px-5 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink">{line.product_name}</span>
          {stock !== undefined && (
            <StatusBadge
              label={`Hay ${Number(stock)} en existencia`}
              tone="info"
            />
          )}
        </div>
        <p className="text-label text-ink-muted">
          {kardex ? (
            <Link
              aria-label={`Movimientos de ${line.product_name ?? ''}`}
              className="code hover:underline"
              to={`/inventory/products/${line.product_id}/kardex`}
            >
              {line.product_code}
            </Link>
          ) : (
            <span className="code">{line.product_code}</span>
          )}
          {unit && (
            <>
              {' · '}
              <Money amount={unit} /> c/u
            </>
          )}
        </p>
      </div>
      <span className="flex items-center gap-2">{actions}</span>
      <Money amount={total} className="font-bold" />
    </div>
  )
}

function ConfirmedSale({
  sale,
  canOpenSales,
  canSeeKardex,
}: {
  sale: LinkedSale
  canOpenSales: boolean
  canSeeKardex: boolean
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-2.5">
        <span className="code text-body font-semibold">
          {sale.internal_number}
        </span>
        <StatusBadge
          label={
            sale.state === 'VOIDED'
              ? 'Anulada'
              : 'Confirmada: salida registrada'
          }
          tone={sale.state === 'VOIDED' ? 'neutral' : 'success'}
        />
        {canOpenSales && (
          <Link className="text-body hover:underline" to={`/sales/${sale.id}`}>
            Ver venta y movimientos
          </Link>
        )}
        <p className="basis-full text-label text-ink-muted">
          Venta confirmada: sus líneas no se modifican desde la orden. Una
          corrección requiere el procedimiento comercial correspondiente.
        </p>
      </div>
      {sale.lines.map((line) => (
        <PartRow
          actions={
            <span className="text-label text-ink-muted">
              × {Number(line.quantity)}
            </span>
          }
          kardex={canSeeKardex && sale.state === 'CONFIRMED'}
          key={line.id}
          line={line}
          total={line.total_amount ?? null}
          unit={line.unit_price ?? null}
        />
      ))}
    </div>
  )
}
