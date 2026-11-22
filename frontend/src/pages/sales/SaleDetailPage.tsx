import {
  ArrowLeft,
  ArrowUUpLeft,
  CurrencyDollar,
  FileText,
  NotePencil,
  Prohibit,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { FiscalPreparationLink } from '@/features/fiscal'
import { QuoteComparison } from '@/features/proformas/QuoteComparison'
import { CorrectionDialog } from '@/features/sales/CorrectionDialog'
import {
  documentDate,
  PaymentStateBadge,
  SaleStateBadge,
  usd,
} from '@/features/sales/format'
import { useSale, useSaleMutations } from '@/features/sales/hooks'
import { PaymentDialog } from '@/features/sales/PaymentDialog'
import { RefundDialog } from '@/features/sales/RefundDialog'
import { ReturnDialog } from '@/features/sales/ReturnDialog'
import {
  conditionLabels,
  methodLabels,
  type SalePaymentRow,
  type SaleReturnRow,
  type Withholding,
} from '@/features/sales/types'
import { VoidSaleDialog } from '@/features/sales/VoidSaleDialog'
import {
  VoidWithholdingDialog,
  VoucherDialog,
  WithholdingList,
} from '@/features/sales/WithholdingRecords'
import {
  Button,
  InlineNotice,
  LoadingState,
  Money as MoneyAmount,
  useToast,
} from '@/shared/ui'

type Dialogs =
  | { kind: 'payment' }
  | { kind: 'return' }
  | { kind: 'void' }
  | { kind: 'correction'; payment: SalePaymentRow }
  | { kind: 'refund'; saleReturn: SaleReturnRow }
  | { kind: 'voucher'; withholding: Withholding; correcting: boolean }
  | { kind: 'void-withholding'; withholding: Withholding }
  | null

/**
 * Ficha de una venta: estado de la venta, estado de pago y documento interno en campos
 * separados; saldo y exceso distinguidos; historial de cobros, correcciones, devoluciones
 * y reembolsos. Las acciones dependen de permisos, pero solo el servidor autoriza.
 */
export function SaleDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const scope = session?.username ?? ''
  const query = useSale(Number.isFinite(id) ? id : null)
  const mutations = useSaleMutations()
  const [dialog, setDialog] = useState<Dialogs>(null)
  const toast = useToast()
  const returnFocus = useRef<HTMLElement | null>(null)

  if (query.isPending) return <LoadingState label="Cargando venta…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar la venta" tone="danger">
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
  const sale = query.data
  const money = sale.money
  const confirmed = sale.state === 'CONFIRMED'
  const balance = Number(money.balance ?? 0)
  const refundDue = Number(money.refund_due ?? 0)
  const withheld = Number(money.withheld_total ?? 0)
  const withheldExcess = Number(money.withheld_excess ?? 0)
  const withholdings = sale.withholdings ?? []
  const openFrom = (next: Dialogs, origin: HTMLElement) => {
    returnFocus.current = origin
    setDialog(next)
  }
  const open = (next: Dialogs, event: { currentTarget: HTMLElement }) => {
    returnFocus.current = event.currentTarget
    setDialog(next)
  }
  const done = (message: string) => () => {
    setDialog(null)
    toast.success(message)
  }
  const focusRef = returnFocus

  const from = (location.state as { from?: string } | null)?.from ?? ''
  const back = `/sales${from.startsWith('?') ? from : ''}`
  const panel = 'rounded-panel border border-line bg-surface'
  const panelHead =
    'flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3'
  const panelTitle = 'text-body font-semibold text-ink'
  const canPay =
    confirmed && balance > 0 && permissions.has('pagos_comerciales.registrar')
  const canReturn = confirmed && permissions.has('ventas.devolver')
  const linked = sale.origin?.type === 'MAINTENANCE'
  // Una venta vinculada corresponde a repuestos instalados: su anulación está bloqueada.
  const canVoid = confirmed && !linked && permissions.has('ventas.anular')
  const canEdit = sale.state === 'DRAFT' && permissions.has('ventas.crear')
  const hasDocument = sale.state !== 'DRAFT'

  return (
    <div className="catalog-page space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label="Volver a ventas"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a ventas"
          to={back}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-label text-ink-muted">Ventas</p>
          <h1 className="code text-page font-semibold text-ink">
            {sale.internal_number ?? 'Venta en borrador'}
          </h1>
        </div>
      </div>

      {sale.state === 'VOIDED' && (
        <InlineNotice title="Venta anulada" tone="warning">
          Motivo: {sale.void_reason}
        </InlineNotice>
      )}

      {sale.origin?.type === 'PROFORMA' && (
        <section
          aria-label="Origen proforma"
          className="space-y-3 rounded-panel border border-line bg-surface p-4"
        >
          <p className="text-body text-ink">
            Originada en la proforma{' '}
            {permissions.has('proformas.ver') ? (
              <Link
                className="code font-semibold text-accent hover:underline"
                to={`/proformas/${sale.origin.proforma_id}`}
              >
                {sale.origin.proforma_number}
              </Link>
            ) : (
              <span className="code font-semibold">
                {sale.origin.proforma_number}
              </span>
            )}
            . Los precios son los vigentes del catálogo.
          </p>
          {sale.quote_comparison && (
            <QuoteComparison comparison={sale.quote_comparison} />
          )}
        </section>
      )}

      {linked && (
        <InlineNotice
          title={`Venta vinculada a ${sale.origin.order_number}`}
          tone="info"
        >
          Repuestos de un mantenimiento. Sus líneas se gestionan desde la orden.
          Una vez confirmada no puede anularse: sus repuestos se consideran
          instalados en el vehículo.{' '}
          <Link
            className="font-semibold hover:underline"
            to={
              permissions.has('mantenimientos.ver')
                ? `/maintenance/${sale.origin.order_id}`
                : `/maintenance/${sale.origin.order_id}/commercial`
            }
          >
            Ver orden de origen
          </Link>
        </InlineNotice>
      )}

      {sale.state === 'CONFIRMED' && (
        <FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={sale.id} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Estados" className={`${panel} px-5 py-4`}>
            <dl className="grid gap-x-6 gap-y-3 text-body sm:grid-cols-3">
              <div>
                <dt className="text-label text-ink-muted">
                  Estado de la venta
                </dt>
                <dd className="mt-1">
                  <SaleStateBadge state={sale.state} />
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Estado de pago</dt>
                <dd className="mt-1">
                  <PaymentStateBadge state={money.payment_state} />
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Documento interno</dt>
                <dd className="mt-0.5 code font-medium">
                  {sale.internal_number ?? 'Sin número (borrador)'}
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Cliente</dt>
                <dd className="mt-0.5 font-medium">
                  {sale.customer.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Condición</dt>
                <dd className="mt-0.5 font-medium">
                  {conditionLabels[sale.condition]}
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Fecha operativa</dt>
                <dd className="mt-0.5 font-medium">
                  {sale.operational_date
                    ? documentDate(sale.operational_date)
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="sale-lines-title"
            className={`${panel} overflow-hidden`}
          >
            <div className={panelHead}>
              <h2 className={panelTitle} id="sale-lines-title">
                Productos
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-body">
                <thead>
                  <tr className="border-b border-line bg-surface-subtle text-micro font-semibold tracking-[0.04em] text-ink-muted uppercase">
                    <th className="h-9 px-4" scope="col">
                      Producto
                    </th>
                    <th className="h-9 px-4 text-right" scope="col">
                      Cantidad
                    </th>
                    <th className="h-9 px-4 text-right" scope="col">
                      Devueltas
                    </th>
                    <th className="h-9 px-4 text-right" scope="col">
                      Precio final
                    </th>
                    <th className="h-9 px-4 text-right" scope="col">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sale.lines.map((line) => (
                    <tr aria-label={`Línea ${line.position}`} key={line.id}>
                      <td className="px-4 py-2.5">
                        <span className="code text-label font-semibold">
                          {line.product_code}
                        </span>
                        <span className="sr-only"> · </span>
                        <span className="block text-ink">
                          {line.product_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink-muted tabular-nums">
                        {line.returned_quantity ?? '0'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <MoneyAmount amount={line.unit_price} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        <MoneyAmount amount={line.total_amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {sale.payments && (
            <section aria-label="Historial de cobros" className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle}>
                  Historial de cobros y correcciones
                </h2>
              </div>
              {sale.payments.length === 0 ? (
                <p className="px-4 py-4 text-body text-ink-muted">
                  Aún no hay cobros registrados.
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {sale.payments.map((payment) => (
                    <div
                      aria-label={`Cobro ${payment.id}`}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-body"
                      key={payment.id}
                      role="group"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          <MoneyAmount amount={payment.amount} /> ·{' '}
                          {documentDate(payment.effective_date)} ·{' '}
                          {payment.state === 'CORRECTED'
                            ? 'Corregido (no cuenta como cobro vigente)'
                            : 'Vigente'}
                        </p>
                        <p className="text-ink-muted">
                          {payment.parts
                            .map(
                              (p) =>
                                `${methodLabels[p.method]} ${usd(p.amount)}`,
                            )
                            .join(' · ')}
                        </p>
                        {payment.correction && (
                          <p className="text-warning">
                            Motivo de corrección: {payment.correction.reason}
                          </p>
                        )}
                      </div>
                      {confirmed &&
                        payment.state === 'ACTIVE' &&
                        permissions.has('pagos_comerciales.anular') && (
                          <Button
                            onClick={(e) =>
                              open({ kind: 'correction', payment }, e)
                            }
                            type="button"
                            variant="quiet"
                          >
                            Corregir pago {payment.id}
                          </Button>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {withholdings.length > 0 && (
            <section aria-label="Retenciones recibidas" className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle}>Retenciones del cliente</h2>
                <Link
                  className="text-label font-semibold text-accent hover:underline"
                  to="/sales/withholdings"
                >
                  Ver retenciones por completar
                </Link>
              </div>
              <WithholdingList
                canAdmin={permissions.has('pagos_comerciales.anular')}
                canComplete={permissions.has('pagos_comerciales.registrar')}
                onComplete={(withholding, origin) =>
                  openFrom(
                    { kind: 'voucher', withholding, correcting: false },
                    origin,
                  )
                }
                onCorrect={(withholding, origin) =>
                  openFrom(
                    { kind: 'voucher', withholding, correcting: true },
                    origin,
                  )
                }
                onVoid={(withholding, origin) =>
                  openFrom({ kind: 'void-withholding', withholding }, origin)
                }
                withholdings={withholdings}
              />
              <p className="border-t border-line px-4 py-2 text-label text-ink-muted">
                Lo retenido baja la deuda, pero no es dinero recibido.
              </p>
            </section>
          )}

          {sale.returns && sale.returns.length > 0 && (
            <section aria-label="Devoluciones" className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle}>Devoluciones y reembolsos</h2>
              </div>
              <div className="divide-y divide-line">
                {sale.returns.map((item) => (
                  <div
                    aria-label={`Devolución ${item.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-body"
                    key={item.id}
                    role="group"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        <MoneyAmount amount={item.grand_total} /> ·{' '}
                        {documentDate(item.effective_date)}
                      </p>
                      <p className="text-ink-muted">{item.reason}</p>
                    </div>
                    {confirmed &&
                      refundDue > 0 &&
                      permissions.has('ventas.devolver') && (
                        <Button
                          onClick={(e) =>
                            open({ kind: 'refund', saleReturn: item }, e)
                          }
                          type="button"
                          variant="quiet"
                        >
                          Registrar reembolso de la devolución {item.id}
                        </Button>
                      )}
                  </div>
                ))}
              </div>
              {(sale.refunds ?? []).length > 0 && (
                <ul className="space-y-1 border-t border-line px-4 py-3 text-body">
                  {(sale.refunds ?? []).map((refund) => (
                    <li className="text-ink" key={refund.id}>
                      Reembolso registrado: {usd(refund.amount)} (
                      {refund.origin === 'VOID'
                        ? 'por anulación'
                        : 'por devolución'}
                      , {documentDate(refund.effective_date)})
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {(canPay || canReturn || canVoid || canEdit || hasDocument) && (
            <section aria-label="Acciones" className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle}>Acciones</h2>
              </div>
              <div className="flex flex-col gap-2 p-4">
                {sale.state !== 'VOIDED' && (
                  <Link
                    className={`${linkButton} border-accent bg-accent text-white hover:bg-accent-hover`}
                    to={`/sales/${sale.id}/checkout`}
                  >
                    Cobrar y facturar
                  </Link>
                )}
                {canPay && (
                  <Button
                    onClick={(e) => open({ kind: 'payment' }, e)}
                    type="button"
                  >
                    <CurrencyDollar aria-hidden="true" size={16} />
                    Registrar cobro
                  </Button>
                )}
                {canEdit && (
                  <Link
                    className={`${linkButton} border-primary bg-primary text-white hover:bg-primary-strong`}
                    to={`/sales/${sale.id}/edit`}
                  >
                    <NotePencil aria-hidden="true" size={16} />
                    Editar borrador
                  </Link>
                )}
                {hasDocument && (
                  <Link
                    className={`${linkButton} border-line-strong bg-surface text-ink hover:bg-surface-subtle`}
                    to={`/sales/${sale.id}/document`}
                  >
                    <FileText aria-hidden="true" size={16} />
                    Ver recibo
                  </Link>
                )}
                {canReturn && (
                  <Button
                    onClick={(e) => open({ kind: 'return' }, e)}
                    type="button"
                    variant="secondary"
                  >
                    <ArrowUUpLeft aria-hidden="true" size={16} />
                    Registrar devolución
                  </Button>
                )}
                {canVoid && (
                  <Button
                    onClick={(e) => open({ kind: 'void' }, e)}
                    type="button"
                    variant="danger"
                  >
                    <Prohibit aria-hidden="true" size={16} />
                    Anular venta
                  </Button>
                )}
              </div>
            </section>
          )}

          <section aria-label="Importes" className={panel}>
            <div className={panelHead}>
              <h2 className={panelTitle}>Importes</h2>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 py-3 text-body">
              <AmountRow label="Total confirmado" value={sale.grand_total} />
              <AmountRow label="Total a pagar vigente" value={money.exigible} />
              <AmountRow label="Cobrado en dinero" value={money.paid_total} />
              {withheld > 0 && (
                <AmountRow
                  label="Retenido por el cliente"
                  value={money.withheld_total ?? null}
                />
              )}
              <AmountRow label="Reembolsado" value={money.refunded_total} />
              <AmountRow
                highlight={balance > 0}
                label="Saldo pendiente de cobro"
                value={money.balance}
              />
              <AmountRow
                highlight={refundDue > 0}
                label="Exceso por reembolsar"
                value={money.refund_due}
              />
            </dl>
            {withheldExcess > 0 && (
              <p className="border-t border-line px-4 py-2 text-label text-warning">
                Hay USD {money.withheld_excess} retenidos de más tras una
                devolución. No se reembolsan: el Administrador anula la
                retención cuando el cliente corrija su comprobante.
              </p>
            )}
            {refundDue > 0 && (
              <p className="border-t border-line px-4 py-2 text-label text-ink-muted">
                El exceso por reembolsar no es un saldo a favor ni una deuda del
                cliente.
              </p>
            )}
            <p className="border-t border-line px-4 py-2 text-label text-ink-muted">
              Los importes, el saldo y los estados se derivan de hechos
              registrados; no se editan.
            </p>
          </section>
        </aside>
      </div>

      <PaymentDialog
        onClose={() => setDialog(null)}
        onDone={done('Cobro registrado.')}
        open={dialog?.kind === 'payment'}
        returnFocusRef={focusRef}
        sale={sale}
        userScope={scope}
      />
      <ReturnDialog
        onClose={() => setDialog(null)}
        onDone={done('Devolución registrada.')}
        open={dialog?.kind === 'return'}
        returnFocusRef={focusRef}
        sale={sale}
        userScope={scope}
      />
      <VoidSaleDialog
        onClose={() => setDialog(null)}
        onDone={done('Venta anulada.')}
        open={dialog?.kind === 'void'}
        returnFocusRef={focusRef}
        sale={sale}
        userScope={scope}
      />
      {dialog?.kind === 'correction' && (
        <CorrectionDialog
          onClose={() => setDialog(null)}
          onDone={done('Pago corregido.')}
          open
          payment={dialog.payment}
          returnFocusRef={focusRef}
          sale={sale}
          userScope={scope}
        />
      )}
      {dialog?.kind === 'voucher' && (
        <VoucherDialog
          correcting={dialog.correcting}
          onClose={() => setDialog(null)}
          onDone={(message) => done(message)()}
          onSubmit={(data, key) =>
            dialog.correcting
              ? mutations.correctVoucher.mutateAsync({
                  ...data,
                  id: sale.id,
                  withholdingId: dialog.withholding.id,
                  key,
                })
              : mutations.completeVoucher.mutateAsync({
                  ...data,
                  id: sale.id,
                  withholdingId: dialog.withholding.id,
                  key,
                })
          }
          returnFocusRef={focusRef}
          scope="commercial"
          withholding={dialog.withholding}
        />
      )}
      {dialog?.kind === 'void-withholding' && (
        <VoidWithholdingDialog
          onClose={() => setDialog(null)}
          onDone={(message) => done(message)()}
          onSubmit={(reason, key) =>
            mutations.voidWithholding.mutateAsync({
              id: sale.id,
              withholdingId: dialog.withholding.id,
              reason,
              key,
            })
          }
          returnFocusRef={focusRef}
          scope="commercial"
          withholding={dialog.withholding}
        />
      )}
      {dialog?.kind === 'refund' && (
        <RefundDialog
          onClose={() => setDialog(null)}
          onDone={done('Reembolso registrado.')}
          open
          returnFocusRef={focusRef}
          sale={sale}
          saleReturn={dialog.saleReturn}
          userScope={scope}
        />
      )}
    </div>
  )
}

const linkButton =
  'ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-control border px-4 py-2 text-body font-semibold'

function AmountRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | null
  highlight?: boolean
}) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={`text-right ${highlight ? 'font-bold text-warning' : 'font-semibold text-ink'}`}
      >
        <MoneyAmount amount={value} />
      </dd>
    </>
  )
}
