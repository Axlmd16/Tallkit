import {
  ArrowLeft,
  Coins,
  FileText,
  Prohibit,
  Toolbox,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { FiscalPreparationLink } from '@/features/fiscal'
import {
  ArtisanCorrectionDialog,
  ArtisanPaymentDialog,
  VoidServiceOperationDialog,
} from '@/features/maintenance/BillingDialogs'
import { useServiceOperation } from '@/features/maintenance/billingHooks'
import type { ArtisanPayment } from '@/features/maintenance/types'
import {
  Button,
  FiscalScopeBadge,
  InlineNotice,
  LoadingState,
  Money,
  SectionPanel,
  StatusBadge,
  useToast,
} from '@/shared/ui'

const statusLabels = {
  EFFECTIVE: 'Vigente',
  VOIDED: 'Anulado',
  REPLACED: 'Sustituido',
} as const

type Dialog = 'pay' | 'void' | { correct: ArtisanPayment } | null

/**
 * Operación artesanal de servicios (RUC artesanal): líneas congeladas, saldo derivado,
 * historial de cobros y cadena de reemplazo. No tiene efectos de inventario.
 */
export function ServiceOperationDetailPage() {
  const id = Number(useParams().id)
  const query = useServiceOperation(Number.isFinite(id) ? id : null)
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const toast = useToast()
  const [dialog, setDialog] = useState<Dialog>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

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
  const operation = query.data
  const actions = new Set(operation.allowed_actions ?? [])
  const canCorrect =
    permissions.has('pagos_artesanales.anular') &&
    operation.state === 'CONFIRMED'
  const done = (message: string) => {
    setDialog(null)
    toast.success(message)
  }
  const open = (next: Dialog, event: { currentTarget: HTMLElement }) => {
    returnFocus.current = event.currentTarget
    setDialog(next)
  }

  return (
    <div className="catalog-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            aria-label={`Volver a la orden ${operation.order_number}`}
            className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
            title="Volver a la orden"
            to={`/maintenance/${operation.order_id}`}
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
          <div>
            <p className="text-xs text-ink-muted">
              Operación de servicios · orden {operation.order_number}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-[22px] leading-7 font-semibold">
                {operation.internal_number}
              </h1>
              <FiscalScopeBadge scope="artesanal" />
              <StatusBadge
                label={operation.state === 'VOIDED' ? 'Anulada' : 'Confirmada'}
                tone={operation.state === 'VOIDED' ? 'neutral' : 'success'}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line px-3 text-[13px] font-semibold hover:bg-surface-subtle"
            to={`/maintenance/service-operations/${operation.id}/document`}
          >
            <FileText aria-hidden="true" size={16} />
            Comprobante interno
          </Link>
          {actions.has('pay') && (
            <Button onClick={(event) => open('pay', event)} type="button">
              Cobrar servicios (RUC artesanal)
            </Button>
          )}
          {actions.has('void') && (
            <Button
              onClick={(event) => open('void', event)}
              type="button"
              variant="secondary"
            >
              <Prohibit aria-hidden="true" size={16} />
              Anular
            </Button>
          )}
        </div>
      </div>

      {operation.state === 'VOIDED' && (
        <InlineNotice title="Operación anulada" tone="warning">
          Motivo: {operation.void_reason}. Se conservan número, líneas e
          historial; sus servicios volvieron a quedar pendientes de documentar.
        </InlineNotice>
      )}
      {operation.replaces && (
        <InlineNotice title="Reemplazo" tone="info">
          Reemplaza a{' '}
          <Link
            className="font-semibold hover:underline"
            to={`/maintenance/service-operations/${operation.replaces.id}`}
          >
            {operation.replaces.internal_number}
          </Link>
          .
        </InlineNotice>
      )}
      {operation.replaced_by.map((next) => (
        <InlineNotice key={next.id} title="Reemplazada" tone="info">
          Reemplazada por{' '}
          <Link
            className="font-semibold hover:underline"
            to={`/maintenance/service-operations/${next.id}`}
          >
            {next.internal_number}
          </Link>
          .
        </InlineNotice>
      ))}

      {operation.state !== 'VOIDED' && (
        <FiscalPreparationLink sourceKind="ARTISAN" sourceId={operation.id} />
      )}

      <section
        aria-label="Saldo de la operación"
        className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-4"
      >
        {[
          ['Total', operation.grand_total],
          ['Pagado', operation.paid],
          ['Saldo', operation.balance],
        ].map(([label, amount]) => (
          <div className="bg-surface px-4 py-3" key={label}>
            <p className="text-xs font-semibold text-ink-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold">
              <Money amount={amount ?? null} />
            </p>
          </div>
        ))}
        <div className="bg-surface px-4 py-3">
          <p className="text-xs font-semibold text-ink-muted">Condición</p>
          <p className="mt-1 text-[15px] font-semibold">
            {operation.condition === 'CREDITO' ? 'Crédito' : 'Contado'}
          </p>
          <p className="text-xs text-ink-muted">
            Sin vencimiento, cuotas ni intereses.
          </p>
        </div>
      </section>

      <SectionPanel
        icon={<Toolbox size={17} />}
        id="operation-lines"
        title="Servicios documentados"
      >
        <div className="overflow-x-auto p-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="py-2 pr-3 font-semibold">Servicio</th>
                <th className="py-2 pr-3 text-right font-semibold">Cant.</th>
                <th className="py-2 pr-3 text-right font-semibold">
                  Precio aplicado
                </th>
                <th className="py-2 pr-3 text-right font-semibold">Base</th>
                <th className="py-2 pr-3 text-right font-semibold">Impuesto</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {operation.lines.map((line) => (
                <tr
                  className="border-b border-line last:border-0"
                  key={line.id}
                >
                  <td className="py-2 pr-3">
                    {line.service_name}
                    {line.service_code && (
                      <span className="block font-mono text-xs text-ink-muted">
                        {line.service_code}
                      </span>
                    )}
                    <span className="block text-xs text-ink-muted">
                      {line.tax_name} · {line.tax_rate} %
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">{line.quantity}</td>
                  <td className="py-2 pr-3 text-right">
                    <Money amount={line.applied_price} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Money amount={line.base_amount} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Money amount={line.tax_amount} />
                  </td>
                  <td className="py-2 text-right font-medium">
                    <Money amount={line.total_amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      <SectionPanel
        icon={<Coins size={17} />}
        id="operation-payments"
        title="Historial de cobros"
      >
        <div className="p-4">
          {operation.payments.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Sin cobros registrados.
            </p>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {operation.payments.map((payment) => (
                <li
                  className="flex flex-wrap items-center gap-3 py-2"
                  key={payment.id}
                >
                  <Money amount={payment.amount} className="font-semibold" />
                  <span className="text-ink-muted">
                    {payment.parts
                      .map(
                        (p) =>
                          `${p.method === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'} ${p.amount}`,
                      )
                      .join(' + ')}
                  </span>
                  <span className="text-ink-muted">
                    {payment.effective_date}
                  </span>
                  <span className="text-ink-muted">
                    {payment.created_by?.name}
                  </span>
                  <StatusBadge
                    label={statusLabels[payment.status]}
                    tone={
                      payment.status === 'EFFECTIVE' ? 'success' : 'neutral'
                    }
                  />
                  {payment.correction && (
                    <span className="text-xs text-ink-muted">
                      Motivo: {payment.correction.reason}
                    </span>
                  )}
                  {canCorrect && payment.status === 'EFFECTIVE' && (
                    <Button
                      className="ml-auto"
                      onClick={(event) => open({ correct: payment }, event)}
                      type="button"
                      variant="ghost"
                    >
                      Corregir pago
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionPanel>

      {dialog === 'pay' && (
        <ArtisanPaymentDialog
          onClose={() => setDialog(null)}
          onDone={done}
          operation={operation}
          returnFocusRef={returnFocus}
          userScope={session?.username ?? ''}
        />
      )}
      {dialog === 'void' && (
        <VoidServiceOperationDialog
          onClose={() => setDialog(null)}
          onDone={done}
          operation={operation}
          returnFocusRef={returnFocus}
        />
      )}
      {dialog && typeof dialog === 'object' && (
        <ArtisanCorrectionDialog
          onClose={() => setDialog(null)}
          onDone={done}
          operation={operation}
          payment={dialog.correct}
          returnFocusRef={returnFocus}
          userScope={session?.username ?? ''}
        />
      )}
    </div>
  )
}
