import { FileText } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import { useSale } from '@/features/sales/hooks'
import { PaymentDialog } from '@/features/sales/PaymentDialog'
import { useBusinessName } from '@/shared/api/entity-logos'
import {
  Avatar,
  BusinessMark,
  Button,
  InlineNotice,
  LoadingState,
  Money,
  StatusBadge,
} from '@/shared/ui'

import { ArtisanPaymentDialog, ServiceOperationDialog } from './BillingDialogs'
import { useEconomicSummary } from './billingHooks'
import type {
  CommercialDocument,
  EconomicBlockPending,
  MaintenanceOrder,
  ServiceOperationSummary,
} from './types'

const paymentLabels = {
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  PAID: 'Pagado',
} as const

function PaymentBadge({ state }: { state: keyof typeof paymentLabels | null }) {
  if (!state) return null
  const tone =
    state === 'PAID' ? 'success' : state === 'PARTIAL' ? 'warning' : 'neutral'
  return <StatusBadge label={paymentLabels[state]} tone={tone} />
}

/**
 * Resumen por negocio: repuestos (comercial) y servicios (artesanal) en bloques separados, con
 * lo que todavía no tiene comprobante distinguido de lo confirmado. El total combinado es solo
 * informativo: cada documento se cobra por separado con su propia acción.
 */
export function EconomicSummary({
  order,
  userScope,
  onDone,
}: {
  order: MaintenanceOrder
  userScope: string
  onDone: (message: string) => void
}) {
  const query = useEconomicSummary(order.id)
  const artisanName = useBusinessName('artesanal')
  const commercialName = useBusinessName('commercial')
  const [documenting, setDocumenting] = useState(false)
  const [paying, setPaying] = useState<ServiceOperationSummary | null>(null)
  const [payingSale, setPayingSale] = useState<number | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const canDocument = (order.billing_actions ?? []).includes(
    'document_services',
  )

  if (query.isPending)
    return <LoadingState label="Cargando resumen económico…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice
        title="No se pudo cargar el resumen económico"
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
    )
  }
  const summary = query.data
  const finish = (message: string) => {
    setDocumenting(false)
    setPaying(null)
    setPayingSale(null)
    onDone(message)
  }

  const payableArtisan =
    summary.artisan.documents.find((op) =>
      op.allowed_actions?.includes('pay'),
    ) ?? null
  const payableCommercial =
    summary.commercial.documents.find((doc) =>
      doc.allowed_actions.includes('pay'),
    ) ?? null

  return (
    <section
      aria-label="Resumen económico por negocio"
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <section
            aria-labelledby="economy-artisan"
            className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
          >
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <BusinessMark
                decorative
                name={artisanName}
                scope="artesanal"
                size="md"
              />
              <div className="min-w-0 flex-1 leading-snug">
                <h2 className="truncate font-bold" id="economy-artisan">
                  {artisanName}
                </h2>
                <p className="text-label text-ink-muted">
                  Recibo de mano de obra
                </p>
              </div>
            </header>
            <div className="flex-1 space-y-3 px-5 py-4">
              {summary.artisan.visible ? (
                <>
                  <PendingNote pending={summary.artisan.pending} />
                  {summary.artisan.documents.length === 0 &&
                    !summary.artisan.pending && (
                      <p className="text-body text-ink-muted">
                        Sin importe de servicios por documentar.
                      </p>
                    )}
                  {summary.artisan.documents.map((operation) => (
                    <ArtisanRow
                      key={operation.id}
                      onPay={(event) => {
                        returnFocus.current = event.currentTarget
                        setPaying(operation)
                      }}
                      operation={operation}
                    />
                  ))}
                  {canDocument && (
                    <Button
                      className="w-full"
                      onClick={(event) => {
                        returnFocus.current = event.currentTarget
                        setDocumenting(true)
                      }}
                      type="button"
                      variant="soft"
                    >
                      <FileText aria-hidden="true" size={16} />
                      Generar recibo de servicios
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-body text-ink-muted">
                  Sin permiso para consultar cobros de servicios.
                </p>
              )}
            </div>
            {summary.artisan.visible && (
              <Totals
                balance={summary.artisan.balance_total ?? '0.00'}
                confirmed={summary.artisan.confirmed_total ?? '0.00'}
              />
            )}
          </section>

          <section
            aria-labelledby="economy-commercial"
            className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
          >
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <BusinessMark
                decorative
                name={commercialName}
                scope="commercial"
                size="md"
              />
              <div className="min-w-0 flex-1 leading-snug">
                <h2 className="truncate font-bold" id="economy-commercial">
                  {commercialName}
                </h2>
                <p className="text-label text-ink-muted">Venta de repuestos</p>
              </div>
            </header>
            <div className="flex-1 space-y-3 px-5 py-4">
              <PendingNote pending={summary.commercial.pending} />
              {summary.commercial.documents.length === 0 &&
                !summary.commercial.pending && (
                  <p className="text-body text-ink-muted">Sin repuestos.</p>
                )}
              {summary.commercial.documents.map((doc) => (
                <CommercialRow
                  doc={doc}
                  key={doc.id}
                  onPay={(event) => {
                    returnFocus.current = event.currentTarget
                    setPayingSale(doc.id)
                  }}
                />
              ))}
            </div>
            <Totals
              balance={summary.commercial.balance_total}
              confirmed={summary.commercial.confirmed_total}
            />
          </section>
        </div>

        <section
          aria-label="Comprobantes a nombre de"
          className="rounded-card border border-line bg-surface px-5 py-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-block font-bold">Comprobantes a nombre de</h2>
            <Link
              className="text-label font-semibold text-accent hover:underline"
              to={`/customers/${order.customer.id}`}
            >
              Ver ficha del cliente
            </Link>
          </div>
          <div className="mt-3 flex items-center gap-3.5">
            <Avatar name={order.customer.name} size="36" />
            <div className="min-w-0 leading-snug">
              <p className="font-bold text-ink">{order.customer.name}</p>
              <p className="code text-label text-ink-muted">
                {order.customer.identification_type ?? 'Identificación'}{' '}
                {order.customer.identification}
              </p>
            </div>
          </div>
        </section>
      </div>

      <aside
        aria-label="Resumen de cobro"
        className="space-y-4 rounded-card border border-line bg-surface p-5 lg:sticky lg:top-4"
      >
        <div className="space-y-1">
          <h2 className="text-block font-bold">Resumen de cobro</h2>
          <p className="text-label text-ink-muted">{summary.notice}</p>
        </div>
        <dl className="space-y-2 border-t border-line pt-3 text-body">
          {summary.artisan.visible && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-muted">Mano de obra</dt>
              <dd className="font-semibold">
                <Money amount={summary.artisan.confirmed_total ?? '0.00'} />
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-muted">Repuestos</dt>
            <dd className="font-semibold">
              <Money amount={summary.commercial.confirmed_total} />
            </dd>
          </div>
          {summary.combined && (
            <div className="border-t border-line pt-2.5">
              <dt className="text-label text-ink-muted">
                Total combinado (informativo)
              </dt>
              <dd className="text-display leading-tight font-light tracking-tight tabular-nums">
                <Money amount={summary.combined.confirmed_total} />
              </dd>
              {Number(summary.combined.pending_total) > 0 && (
                <p className="mt-1 text-label text-ink-muted">
                  Sin recibo: <Money amount={summary.combined.pending_total} />
                </p>
              )}
            </div>
          )}
        </dl>
        <div className="space-y-2 border-t border-line pt-3">
          {canDocument && (
            <Button
              className="w-full"
              onClick={(event) => {
                returnFocus.current = event.currentTarget
                setDocumenting(true)
              }}
              type="button"
            >
              Generar recibo de servicios
            </Button>
          )}
          {payableArtisan && (
            <Button
              className="w-full"
              onClick={(event) => {
                returnFocus.current = event.currentTarget
                setPaying(payableArtisan)
              }}
              type="button"
              variant="secondary"
            >
              Cobrar servicios
            </Button>
          )}
          {payableCommercial && (
            <Button
              className="w-full"
              onClick={(event) => {
                returnFocus.current = event.currentTarget
                setPayingSale(payableCommercial.id)
              }}
              type="button"
              variant="secondary"
            >
              Cobrar repuestos
            </Button>
          )}
          <p className="text-center text-label text-ink-muted">
            Cada negocio registra su cobro y su comprobante por separado.
          </p>
        </div>
      </aside>
      {documenting && (
        <ServiceOperationDialog
          onClose={() => setDocumenting(false)}
          onDone={finish}
          order={order}
          returnFocusRef={returnFocus}
        />
      )}
      {paying && (
        <ArtisanPaymentDialog
          onClose={() => setPaying(null)}
          onDone={finish}
          operation={paying}
          returnFocusRef={returnFocus}
          userScope={userScope}
        />
      )}
      {payingSale !== null && (
        <CommercialPayment
          onClose={() => setPayingSale(null)}
          onDone={() => finish('Cobro de repuestos registrado.')}
          saleId={payingSale}
          userScope={userScope}
        />
      )}
    </section>
  )
}

function PendingNote({ pending }: { pending: EconomicBlockPending | null }) {
  if (!pending) return null
  return (
    <div className="rounded-control border border-dashed border-line-strong px-3 py-2 text-body">
      <p className="text-label text-ink-muted">{pending.label}</p>
      <p>
        {pending.line_count} {pending.line_count === 1 ? 'línea' : 'líneas'} ·
        estimado <Money amount={pending.estimated_total} />
      </p>
    </div>
  )
}

function Totals({
  confirmed,
  balance,
}: {
  confirmed: string
  balance: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line bg-surface-subtle px-5 py-3">
      <div className="text-label text-ink-muted">
        Confirmado{' '}
        <Money amount={confirmed} className="font-semibold text-ink" />
      </div>
      <div className="text-right">
        <span className="mr-2 text-label text-ink-muted">Saldo</span>
        <Money
          amount={balance}
          className="text-figure font-light tracking-tight"
        />
      </div>
    </div>
  )
}

function DocumentAmounts({
  total,
  paid,
  withheld,
  balance,
}: {
  total: string | null
  paid: string | null
  withheld?: string | null | undefined
  balance: string | null
}) {
  const hasWithheld = Number(withheld ?? 0) > 0
  return (
    <dl
      className={`grid gap-2 text-label ${hasWithheld ? 'grid-cols-4' : 'grid-cols-3'}`}
    >
      <div>
        <dt className="text-ink-muted">Total</dt>
        <dd>
          <Money amount={total} />
        </dd>
      </div>
      <div>
        <dt className="text-ink-muted">Pagado</dt>
        <dd>
          <Money amount={paid} />
        </dd>
      </div>
      {hasWithheld && (
        <div>
          <dt className="text-ink-muted">Retenido</dt>
          <dd>
            <Money amount={withheld ?? null} />
          </dd>
        </div>
      )}
      <div>
        <dt className="text-ink-muted">Saldo</dt>
        <dd className="font-semibold">
          <Money amount={balance} />
        </dd>
      </div>
    </dl>
  )
}

function CommercialRow({
  doc,
  onPay,
}: {
  doc: CommercialDocument
  onPay: (event: { currentTarget: HTMLElement }) => void
}) {
  return (
    <article className="space-y-2 rounded-control border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        {doc.can_open_sale ? (
          <Link
            className="code text-body font-semibold hover:underline"
            to={`/sales/${doc.id}`}
          >
            {doc.internal_number}
          </Link>
        ) : (
          <span className="code text-body font-semibold">
            {doc.internal_number}
          </span>
        )}
        <StatusBadge
          label={doc.state === 'VOIDED' ? 'Anulada' : 'Confirmada'}
          tone={doc.state === 'VOIDED' ? 'neutral' : 'success'}
        />
        <PaymentBadge state={doc.payment_state} />
        <span className="text-label text-ink-muted">
          {doc.condition === 'CREDITO' ? 'Crédito' : 'Contado'}
        </span>
      </div>
      <DocumentAmounts
        balance={doc.balance}
        paid={doc.paid}
        withheld={doc.withheld}
        total={doc.grand_total}
      />
      {doc.allowed_actions.includes('pay') && (
        <Button onClick={onPay} type="button" variant="secondary">
          Cobrar repuestos
        </Button>
      )}
    </article>
  )
}

function ArtisanRow({
  operation,
  onPay,
}: {
  operation: ServiceOperationSummary
  onPay: (event: { currentTarget: HTMLElement }) => void
}) {
  const voided = operation.state === 'VOIDED'
  return (
    <article className="space-y-2 rounded-control border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="code text-body font-semibold hover:underline"
          to={`/maintenance/service-operations/${operation.id}`}
        >
          {operation.internal_number}
        </Link>
        <StatusBadge
          label={voided ? 'Anulada' : 'Confirmada'}
          tone={voided ? 'neutral' : 'success'}
        />
        {!voided && <PaymentBadge state={operation.payment_state} />}
        <span className="text-label text-ink-muted">
          {operation.condition === 'CREDITO' ? 'Crédito' : 'Contado'}
        </span>
      </div>
      {operation.replaces && (
        <p className="text-label text-ink-muted">
          Reemplaza a {operation.replaces.internal_number}.
        </p>
      )}
      {voided && (
        <p className="text-label text-ink-muted">
          Anulada: {operation.void_reason}
        </p>
      )}
      <DocumentAmounts
        balance={operation.balance}
        paid={operation.paid}
        withheld={operation.withheld}
        total={operation.grand_total}
      />
      {operation.allowed_actions?.includes('pay') && (
        <Button onClick={onPay} type="button" variant="secondary">
          Cobrar servicios
        </Button>
      )}
    </article>
  )
}

/** Carga la venta completa y reutiliza el cobro comercial existente. */
function CommercialPayment({
  saleId,
  userScope,
  onClose,
  onDone,
}: {
  saleId: number
  userScope: string
  onClose: () => void
  onDone: () => void
}) {
  const sale = useSale(saleId)
  if (!sale.data) return null
  return (
    <PaymentDialog
      onClose={onClose}
      onDone={onDone}
      open
      sale={sale.data}
      userScope={userScope}
    />
  )
}
