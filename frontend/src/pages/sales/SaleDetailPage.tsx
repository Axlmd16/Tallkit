import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { CorrectionDialog } from '@/features/sales/CorrectionDialog'
import {
  documentDate,
  PaymentStateBadge,
  SaleStateBadge,
  usd,
} from '@/features/sales/format'
import { useSale } from '@/features/sales/hooks'
import { PaymentDialog } from '@/features/sales/PaymentDialog'
import { RefundDialog } from '@/features/sales/RefundDialog'
import { ReturnDialog } from '@/features/sales/ReturnDialog'
import {
  conditionLabels,
  methodLabels,
  type SalePaymentRow,
  type SaleReturnRow,
} from '@/features/sales/types'
import { VoidSaleDialog } from '@/features/sales/VoidSaleDialog'
import {
  Button,
  InlineNotice,
  LoadingState,
  PageHeader,
  useToast,
} from '@/shared/ui'

type Dialogs =
  | { kind: 'payment' }
  | { kind: 'return' }
  | { kind: 'void' }
  | { kind: 'correction'; payment: SalePaymentRow }
  | { kind: 'refund'; saleReturn: SaleReturnRow }
  | null

/**
 * Ficha de una venta: estado de la venta, estado de pago y documento interno en campos
 * separados; saldo y exceso distinguidos; historial de cobros, correcciones, devoluciones
 * y reembolsos. Las acciones dependen de permisos, pero solo el servidor autoriza.
 */
export function SaleDetailPage() {
  const id = Number(useParams().id)
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const scope = session?.username ?? ''
  const query = useSale(Number.isFinite(id) ? id : null)
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
  const open = (next: Dialogs, event: { currentTarget: HTMLElement }) => {
    returnFocus.current = event.currentTarget
    setDialog(next)
  }
  const done = (message: string) => () => {
    setDialog(null)
    toast.success(message)
  }
  const focusRef = returnFocus

  return (
    <div className="catalog-page space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            {sale.state === 'DRAFT' && permissions.has('ventas.crear') && (
              <Link className="underline" to={`/sales/${sale.id}/edit`}>
                Editar borrador
              </Link>
            )}
            {sale.state !== 'DRAFT' && (
              <Link className="underline" to={`/sales/${sale.id}/document`}>
                Ver comprobante
              </Link>
            )}
          </div>
        }
        description="Los importes, el saldo y los estados se derivan de hechos registrados; no se editan."
        title={sale.internal_number ?? 'Venta en borrador'}
      />
      <section
        aria-label="Estados"
        className="ui-surface rounded-group bg-surface p-5"
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">Estado de la venta</dt>
            <dd>
              <SaleStateBadge state={sale.state} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Estado de pago</dt>
            <dd>
              <PaymentStateBadge state={money.payment_state} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Documento interno</dt>
            <dd>{sale.internal_number ?? 'Sin número (borrador)'}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Cliente</dt>
            <dd>{sale.customer.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Condición</dt>
            <dd>{conditionLabels[sale.condition]}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Fecha operativa</dt>
            <dd>
              {sale.operational_date
                ? documentDate(sale.operational_date)
                : '—'}
            </dd>
          </div>
        </dl>
        {sale.state === 'VOIDED' && (
          <p className="mt-3 text-sm text-warning">
            Anulada: {sale.void_reason}
          </p>
        )}
      </section>
      <section
        aria-label="Importes"
        className="ui-surface rounded-group bg-surface p-5"
      >
        <h2 className="font-bold text-ink">Importes</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <Money label="Total confirmado" value={sale.grand_total} />
          <Money label="Exigible vigente" value={money.exigible} />
          <Money label="Pagado" value={money.paid_total} />
          <Money label="Reembolsado" value={money.refunded_total} />
          <Money
            highlight={balance > 0}
            label="Saldo pendiente de cobro"
            value={money.balance}
          />
          <Money
            highlight={refundDue > 0}
            label="Exceso por reembolsar"
            value={money.refund_due}
          />
        </dl>
        {refundDue > 0 && (
          <p className="mt-3 text-sm text-ink-muted">
            El exceso por reembolsar no es un saldo a favor ni una deuda del
            cliente.
          </p>
        )}
      </section>
      <section aria-label="Acciones" className="flex flex-wrap gap-3">
        {confirmed &&
          balance > 0 &&
          permissions.has('pagos_comerciales.registrar') && (
            <Button onClick={(e) => open({ kind: 'payment' }, e)} type="button">
              Registrar cobro
            </Button>
          )}
        {confirmed && permissions.has('ventas.devolver') && (
          <Button
            onClick={(e) => open({ kind: 'return' }, e)}
            type="button"
            variant="secondary"
          >
            Registrar devolución
          </Button>
        )}
        {confirmed && permissions.has('ventas.anular') && (
          <Button
            onClick={(e) => open({ kind: 'void' }, e)}
            type="button"
            variant="danger"
          >
            Anular venta
          </Button>
        )}
      </section>
      <section aria-label="Líneas" className="space-y-3">
        <h2 className="font-bold text-ink">Líneas</h2>
        {sale.lines.map((line) => (
          <div
            aria-label={`Línea ${line.position}`}
            className="ui-surface rounded-group bg-surface p-4"
            key={line.id}
            role="group"
          >
            <p className="font-semibold text-ink">
              {line.product_code} · {line.product_name}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <dt>Cantidad</dt>
              <dd>{line.quantity}</dd>
              <dt>Devueltas</dt>
              <dd>{line.returned_quantity ?? '0'}</dd>
              <dt>Precio final</dt>
              <dd>{usd(line.unit_price)}</dd>
              <dt>Total</dt>
              <dd>{usd(line.total_amount)}</dd>
            </dl>
          </div>
        ))}
      </section>
      {sale.payments && (
        <section aria-label="Historial de cobros" className="space-y-3">
          <h2 className="font-bold text-ink">
            Historial de cobros y correcciones
          </h2>
          {sale.payments.length === 0 && (
            <p className="text-sm text-ink-muted">
              Aún no hay cobros registrados.
            </p>
          )}
          {sale.payments.map((payment) => (
            <div
              className="ui-surface rounded-group bg-surface p-4"
              key={payment.id}
              role="group"
              aria-label={`Cobro ${payment.id}`}
            >
              <p className="font-semibold text-ink">
                {usd(payment.amount)} · {documentDate(payment.effective_date)} ·{' '}
                {payment.state === 'CORRECTED'
                  ? 'Corregido (no cuenta como cobro vigente)'
                  : 'Vigente'}
              </p>
              <p className="text-sm text-ink-muted">
                {payment.parts
                  .map((p) => `${methodLabels[p.method]} ${usd(p.amount)}`)
                  .join(' · ')}
              </p>
              {payment.correction && (
                <p className="text-sm text-warning">
                  Motivo de corrección: {payment.correction.reason}
                </p>
              )}
              {confirmed &&
                payment.state === 'ACTIVE' &&
                permissions.has('pagos_comerciales.anular') && (
                  <Button
                    onClick={(e) => open({ kind: 'correction', payment }, e)}
                    type="button"
                    variant="quiet"
                  >
                    Corregir pago {payment.id}
                  </Button>
                )}
            </div>
          ))}
        </section>
      )}
      {sale.returns && sale.returns.length > 0 && (
        <section aria-label="Devoluciones" className="space-y-3">
          <h2 className="font-bold text-ink">Devoluciones y reembolsos</h2>
          {sale.returns.map((item) => (
            <div
              className="ui-surface rounded-group bg-surface p-4"
              key={item.id}
              role="group"
              aria-label={`Devolución ${item.id}`}
            >
              <p className="font-semibold text-ink">
                {usd(item.grand_total)} · {documentDate(item.effective_date)}
              </p>
              <p className="text-sm text-ink-muted">{item.reason}</p>
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
          {(sale.refunds ?? []).map((refund) => (
            <p className="text-sm text-ink" key={refund.id}>
              Reembolso registrado: {usd(refund.amount)} (
              {refund.origin === 'VOID' ? 'por anulación' : 'por devolución'},{' '}
              {documentDate(refund.effective_date)})
            </p>
          ))}
        </section>
      )}
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

function Money({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | null
  highlight?: boolean
}) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd
        className={
          highlight ? 'font-bold text-warning' : 'font-semibold text-ink'
        }
      >
        {usd(value)}
      </dd>
    </div>
  )
}
