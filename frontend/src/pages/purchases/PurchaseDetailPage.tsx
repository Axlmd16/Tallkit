import {
  ArrowLeft,
  ArrowsClockwise,
  NotePencil,
  Prohibit,
} from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  documentDate,
  PurchaseStateBadge,
  timestamp,
} from '@/features/purchases/format'
import { usePurchase } from '@/features/purchases/hooks'
import { ReplacementDialog } from '@/features/purchases/ReplacementDialog'
import { documentTypeLabels } from '@/features/purchases/types'
import { VoidDialog } from '@/features/purchases/VoidDialog'
import {
  Button,
  InlineNotice,
  LoadingState,
  Money,
  useToast,
} from '@/shared/ui'

const panel = 'rounded-panel border border-line bg-surface'
const panelHead = 'border-b border-line px-4 py-3'
const panelTitle = 'text-[14.5px] font-semibold text-ink'

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

/** Ficha de un ingreso de mercadería: resumen, líneas y totales del servidor, acciones según estado y permiso. */
export function PurchaseDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const query = usePurchase(Number.isFinite(id) ? id : null)
  const [voiding, setVoiding] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const voidTrigger = useRef<HTMLButtonElement>(null)
  const replaceTrigger = useRef<HTMLButtonElement>(null)
  const from = (location.state as { from?: string } | null)?.from
  const back = from?.startsWith('/purchases') ? from : '/purchases'

  if (query.isPending) return <LoadingState label="Cargando ingreso…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar el ingreso" tone="danger">
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
  const canEdit =
    purchase.state === 'DRAFT' && permissions.has('ingresos.crear')
  const canVoid =
    purchase.state === 'CONFIRMED' && permissions.has('ingresos.anular')
  const canReplace =
    purchase.state !== 'DRAFT' && permissions.has('ingresos.crear')
  const title = purchase.internal_number ?? `Borrador #${purchase.id}`
  const hasLinks =
    purchase.replaces_id !== null ||
    purchase.replacements.length > 0 ||
    (canOpenInventory &&
      (purchase.inventory_operation_id !== null ||
        purchase.void_operation_id !== null))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label="Volver a ingresos"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a ingresos"
          to={back}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Ingresos de mercadería</p>
          <h1 className="font-mono text-[22px] leading-7 font-semibold text-ink">
            {title}
          </h1>
        </div>
      </div>

      {purchase.state === 'VOIDED' && (
        <InlineNotice title="Ingreso anulado" tone="warning">
          Anulado el {timestamp(purchase.voided_at)}. Motivo:{' '}
          {purchase.void_reason}
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <section
            aria-label="Resumen del ingreso"
            className={`${panel} px-5 py-4`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <PurchaseStateBadge state={purchase.state} />
              <span className="text-[13px] text-ink-muted">
                {documentTypeLabels[purchase.document.type]}
                {purchase.document.reference && (
                  <span className="ml-1 font-mono text-ink">
                    {purchase.document.reference}
                  </span>
                )}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
              <Datum label="Proveedor" wide>
                {purchase.supplier.name ?? '—'}
              </Datum>
              <Datum label="Fecha del documento">
                {documentDate(purchase.document_date)}
              </Datum>
              <Datum label="Fecha de confirmación">
                {timestamp(purchase.confirmed_at)}
              </Datum>
              <Datum label="Observación" wide>
                {purchase.notes || '—'}
              </Datum>
              {purchase.document.no_document_reason && (
                <Datum label="Explicación de la compra sin documento" wide>
                  {purchase.document.no_document_reason}
                </Datum>
              )}
            </dl>
          </section>

          <section
            aria-labelledby="purchase-lines-title"
            className={`${panel} overflow-hidden`}
          >
            <div className={panelHead}>
              <h2 className={panelTitle} id="purchase-lines-title">
                Productos recibidos
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-subtle text-[11.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
                    <th className="h-9 px-4" scope="col">
                      Producto
                    </th>
                    <th className="h-9 px-4 text-right" scope="col">
                      Cantidad
                    </th>
                    <th className="h-9 px-4 text-right" scope="col">
                      Costo unitario
                    </th>
                    <th className="h-9 px-4" scope="col">
                      Impuesto
                    </th>
                    <th className="h-9 px-4 text-right" scope="col">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {purchase.lines.map((line) => (
                    <tr aria-label={`Línea ${line.position}`} key={line.id}>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs font-semibold">
                          {line.product.code}
                        </span>
                        <span className="sr-only"> — </span>
                        <span className="block text-ink">
                          {line.product.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {line.quantity} {line.product.unit_symbol ?? ''}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Money amount={line.unit_cost} />
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">
                        {line.tax.code ?? '—'}{' '}
                        {line.tax.rate ? `${line.tax.rate}%` : ''} ·{' '}
                        {line.tax_recoverability === 'RECOVERABLE'
                          ? 'recuperable'
                          : 'no recuperable'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        <Money amount={line.amounts?.total} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              aria-label="Totales"
              className="border-t border-line bg-surface-subtle px-4 py-3"
              role="group"
            >
              {purchase.totals ? (
                <dl className="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[13px]">
                  <dt className="text-ink-muted">Base imponible</dt>
                  <dd className="text-right">
                    <Money amount={purchase.totals.base} />
                  </dd>
                  <dt className="text-ink-muted">Impuesto</dt>
                  <dd className="text-right">
                    <Money amount={purchase.totals.tax} />
                  </dd>
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="text-right text-base font-semibold">
                    <Money amount={purchase.totals.total} />
                  </dd>
                  <dt className="text-ink-muted">Valor inventariable</dt>
                  <dd className="text-right">
                    <Money amount={purchase.totals.inventory_value} />
                  </dd>
                </dl>
              ) : (
                <p className="text-[13px] text-ink-muted">
                  Totales no calculables todavía.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {(canEdit || canVoid || canReplace) && (
            <section aria-labelledby="purchase-actions-title" className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle} id="purchase-actions-title">
                  Acciones
                </h2>
              </div>
              <div className="flex flex-col gap-2 p-4">
                {canEdit && (
                  <Button
                    onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                    type="button"
                  >
                    <NotePencil aria-hidden="true" size={16} />
                    Editar borrador
                  </Button>
                )}
                {canReplace && (
                  <Button
                    onClick={() => setReplacing(true)}
                    ref={replaceTrigger}
                    type="button"
                    variant="secondary"
                  >
                    <ArrowsClockwise aria-hidden="true" size={16} />
                    Crear reemplazo
                  </Button>
                )}
                {canVoid && (
                  <Button
                    onClick={() => setVoiding(true)}
                    ref={voidTrigger}
                    type="button"
                    variant="danger"
                  >
                    <Prohibit aria-hidden="true" size={16} />
                    Anular ingreso
                  </Button>
                )}
              </div>
            </section>
          )}

          {hasLinks && (
            <section aria-label="Vínculos" className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle}>Documentos relacionados</h2>
              </div>
              <ul className="space-y-2 p-4 text-[13px]">
                {purchase.replaces_id && (
                  <li>
                    Reemplaza al ingreso{' '}
                    <Link
                      className="font-mono font-semibold text-accent hover:underline"
                      to={`/purchases/${purchase.replaces_id}`}
                    >
                      #{purchase.replaces_id}
                    </Link>
                  </li>
                )}
                {purchase.replacements.map((r) => (
                  <li key={r.id}>
                    Reemplazo:{' '}
                    <Link
                      className="font-mono font-semibold text-accent hover:underline"
                      to={`/purchases/${r.id}`}
                    >
                      {r.internal_number ?? `Borrador #${r.id}`}
                    </Link>
                  </li>
                ))}
                {canOpenInventory && purchase.inventory_operation_id && (
                  <li>
                    Operación de inventario:{' '}
                    <Link
                      className="font-mono font-semibold text-accent hover:underline"
                      to={`/inventory/operations/${purchase.inventory_operation_id}`}
                    >
                      INV-{purchase.inventory_operation_id}
                    </Link>
                  </li>
                )}
                {canOpenInventory && purchase.void_operation_id && (
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
          toast.success(`Ingreso ${title} anulado y su efecto compensado.`)
        }}
        open={voiding}
        purchase={purchase}
        returnFocusRef={voidTrigger}
      />
      <ReplacementDialog
        onClose={() => setReplacing(false)}
        onCreated={(newId) => navigate(`/purchases/${newId}/edit`)}
        open={replacing}
        purchase={purchase}
        returnFocusRef={replaceTrigger}
      />
    </div>
  )
}
