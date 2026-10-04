import { ArrowLeft, Prohibit } from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  count,
  PurchaseStateBadge,
  timestamp,
  unitCost,
} from '@/features/purchases/format'
import { usePurchase } from '@/features/purchases/hooks'
import type { Purchase, PurchaseLine } from '@/features/purchases/types'
import { VoidDialog } from '@/features/purchases/VoidDialog'
import {
  Button,
  InlineNotice,
  LoadingState,
  Money,
  Tabs,
  useToast,
} from '@/shared/ui'

const panel = 'rounded-panel border border-line bg-surface'
const panelHead = 'border-b border-line px-4 py-3'
const panelTitle = 'text-[14.5px] font-semibold text-ink'
const head =
  'h-9 px-4 text-[11.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase'

function Datum({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium break-words text-ink">
        {children}
      </dd>
    </div>
  )
}

function ProductCell({ line }: { line: PurchaseLine }) {
  return (
    <td className="px-4 py-2.5">
      <span className="font-mono text-xs font-semibold">
        {line.product.code}
      </span>
      <span className="sr-only"> — </span>
      <span className="block text-ink">{line.product.name}</span>
    </td>
  )
}

function Lines({ purchase }: { purchase: Purchase }) {
  // El costo solo llega a quien puede verlo: sin el campo, la columna no existe.
  const showCost = purchase.lines.some((line) => 'cost_registered' in line)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line bg-surface-subtle">
            <th className={head} scope="col">
              Producto
            </th>
            <th className={`${head} text-right`} scope="col">
              Cantidad
            </th>
            {showCost && (
              <th className={`${head} text-right`} scope="col">
                Costo unitario
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {purchase.lines.map((line) => (
            <tr aria-label={`Línea ${line.position}`} key={line.id}>
              <ProductCell line={line} />
              <td className="px-4 py-2.5 text-right tabular-nums">
                {line.quantity} {line.product.unit_symbol ?? ''}
              </td>
              {showCost && (
                <td className="px-4 py-2.5 text-right">
                  {line.cost_registered ? (
                    <span className="tabular-nums">
                      {unitCost(line.unit_cost)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                      Sin costo
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Datos de una compra anterior; solo los recibe quien ve costos. */
function LegacyPanel({ purchase }: { purchase: Purchase }) {
  const legacy = purchase.legacy
  if (!legacy) return null
  return (
    <div className="space-y-4 p-4">
      {legacy.is_pending_draft && (
        <InlineNotice title="Borrador sin efecto" tone="warning">
          Quedó pendiente en el flujo anterior y no puede confirmarse.
        </InlineNotice>
      )}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        <Datum label="Documento">
          {legacy.document.type}{' '}
          <span className="font-mono">{legacy.document.reference}</span>
        </Datum>
        <Datum label="Fecha del documento">{legacy.document_date ?? '—'}</Datum>
        {legacy.document.no_document_reason && (
          <Datum label="Sin documento" wide>
            {legacy.document.no_document_reason}
          </Datum>
        )}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-surface-subtle">
              <th className={head} scope="col">
                Producto
              </th>
              <th className={`${head} text-right`} scope="col">
                Costo
              </th>
              <th className={head} scope="col">
                Impuesto
              </th>
              <th className={`${head} text-right`} scope="col">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {purchase.lines.map((line) => (
              <tr key={line.id}>
                <ProductCell line={line} />
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {unitCost(line.unit_cost)}
                </td>
                <td className="px-4 py-2.5 text-ink-muted">
                  {line.tax?.code ?? '—'}{' '}
                  {line.tax?.rate ? `${line.tax.rate}%` : ''}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold">
                  <Money amount={line.amounts?.total ?? null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {legacy.totals && (
        <dl
          aria-label="Totales de la compra anterior"
          className="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[13px]"
        >
          <dt className="text-ink-muted">Base</dt>
          <dd className="text-right">
            <Money amount={legacy.totals.base} />
          </dd>
          <dt className="text-ink-muted">Impuesto</dt>
          <dd className="text-right">
            <Money amount={legacy.totals.tax} />
          </dd>
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="text-right font-semibold">
            <Money amount={legacy.totals.total} />
          </dd>
        </dl>
      )}
    </div>
  )
}

/** Ficha de una entrada: lo recibido, quién la registró y, solo para el Administrador, costos y anulación. */
export function PurchaseDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const toast = useToast()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const query = usePurchase(Number.isFinite(id) ? id : null)
  const [voiding, setVoiding] = useState(false)
  const [tab, setTab] = useState('products')
  const voidTrigger = useRef<HTMLButtonElement>(null)
  const from = (location.state as { from?: string } | null)?.from
  const back = from?.startsWith('/purchases') ? from : '/purchases'

  if (query.isPending) return <LoadingState label="Cargando entrada…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar la entrada" tone="danger">
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
  const purchase = query.data
  const canOpenInventory = permissions.has('inventario.ver')
  const canVoid =
    purchase.state === 'CONFIRMED' && permissions.has('ingresos.anular')
  const title = purchase.internal_number ?? `Sin número #${purchase.id}`
  const totals = {
    products: purchase.lines.length,
    units: purchase.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
  }
  const linesSection = (
    <>
      <Lines purchase={purchase} />
      <p className="border-t border-line bg-surface-subtle px-4 py-2.5 text-[13px] text-ink-muted">
        {count(totals.products, 'producto', 'productos')} ·{' '}
        {count(totals.units, 'unidad', 'unidades')}
      </p>
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label="Volver a entradas"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a entradas"
          to={back}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Entradas de stock</p>
          <h1 className="font-mono text-[22px] leading-7 font-semibold text-ink">
            {title}
          </h1>
        </div>
        <PurchaseStateBadge state={purchase.state} />
      </div>

      {purchase.state === 'VOIDED' && (
        <InlineNotice title="Entrada anulada" tone="warning">
          Anulada el {timestamp(purchase.voided_at)}
          {purchase.voided_by?.name ? ` por ${purchase.voided_by.name}` : ''}.
          Motivo: {purchase.void_reason}
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <section
            aria-label="Resumen de la entrada"
            className={`${panel} px-5 py-4`}
          >
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
              <Datum label="Registró">
                {purchase.registered_by?.name ?? '—'}
              </Datum>
              <Datum label="Fecha y hora">
                {timestamp(purchase.confirmed_at)}
              </Datum>
              {purchase.supplier && (
                <Datum label="Proveedor">{purchase.supplier.name ?? '—'}</Datum>
              )}
              {purchase.reference && (
                <Datum label="Referencia">
                  <span className="font-mono">{purchase.reference}</span>
                </Datum>
              )}
              {purchase.observation && (
                <Datum label="Observación" wide>
                  {purchase.observation}
                </Datum>
              )}
            </dl>
          </section>

          <section
            aria-labelledby="purchase-lines-title"
            className={`${panel} overflow-hidden`}
          >
            {purchase.legacy ? (
              <Tabs
                activeId={tab}
                aria-label="Contenido de la compra"
                items={[
                  { id: 'products', label: 'Productos', content: linesSection },
                  {
                    id: 'legacy',
                    label: 'Compra anterior',
                    content: <LegacyPanel purchase={purchase} />,
                  },
                ]}
                onChange={setTab}
              />
            ) : (
              <>
                <div className={panelHead}>
                  <h2 className={panelTitle} id="purchase-lines-title">
                    Productos recibidos
                  </h2>
                </div>
                {linesSection}
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {canVoid && (
            <section aria-labelledby="purchase-actions-title" className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle} id="purchase-actions-title">
                  Acciones
                </h2>
              </div>
              <div className="flex flex-col gap-2 p-4">
                <Button
                  onClick={() => setVoiding(true)}
                  ref={voidTrigger}
                  type="button"
                  variant="danger"
                >
                  <Prohibit aria-hidden="true" size={16} />
                  Anular entrada
                </Button>
              </div>
            </section>
          )}
          {canOpenInventory &&
            (purchase.inventory_operation_id || purchase.void_operation_id) && (
              <section aria-label="Vínculos" className={panel}>
                <div className={panelHead}>
                  <h2 className={panelTitle}>En inventario</h2>
                </div>
                <ul className="space-y-2 p-4 text-[13px]">
                  {purchase.inventory_operation_id && (
                    <li>
                      Movimiento:{' '}
                      <Link
                        className="font-mono font-semibold text-accent hover:underline"
                        to={`/inventory/operations/${purchase.inventory_operation_id}`}
                      >
                        INV-{purchase.inventory_operation_id}
                      </Link>
                    </li>
                  )}
                  {purchase.void_operation_id && (
                    <li>
                      Compensación:{' '}
                      <Link
                        className="font-mono font-semibold text-accent hover:underline"
                        to={`/inventory/operations/${purchase.void_operation_id}`}
                      >
                        INV-{purchase.void_operation_id}
                      </Link>
                    </li>
                  )}
                </ul>
              </section>
            )}
        </aside>
      </div>

      <VoidDialog
        canOpenInventory={canOpenInventory}
        onClose={() => setVoiding(false)}
        onDone={() => {
          setVoiding(false)
          toast.success(`Entrada ${title} anulada y su efecto compensado.`)
        }}
        open={voiding}
        purchase={purchase}
        returnFocusRef={voidTrigger}
      />
    </div>
  )
}
