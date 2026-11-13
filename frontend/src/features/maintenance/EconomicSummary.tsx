import { CurrencyDollar, FileText } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import { useSale } from '@/features/sales/hooks'
import { PaymentDialog } from '@/features/sales/PaymentDialog'
import {
  BusinessMark,
  Button,
  FiscalScopeBadge,
  InlineNotice,
  LoadingState,
  Money,
  SectionPanel,
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
 * Resumen por RUC: repuestos (comercial) y servicios (artesanal) en bloques separados, con
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

  return (
    <SectionPanel
      description={summary.notice}
      icon={<CurrencyDollar size={17} />}
      id="order-economy-title"
      title="Resumen económico por RUC"
    >
      <div className="grid gap-4 p-4 xl:grid-cols-2">
        <section aria-labelledby="economy-commercial" className="space-y-3">
          <header className="flex flex-wrap items-center gap-2">
            <BusinessMark
              decorative
              name="Repuestos"
              scope="commercial"
              size="sm"
            />
            <h3 className="text-body font-semibold" id="economy-commercial">
              Repuestos
            </h3>
            <FiscalScopeBadge scope="commercial" />
          </header>
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
          <Totals
            balance={summary.commercial.balance_total}
            confirmed={summary.commercial.confirmed_total}
          />
        </section>

        <section aria-labelledby="economy-artisan" className="space-y-3">
          <header className="flex flex-wrap items-center gap-2">
            <BusinessMark
              decorative
              name="Servicios"
              scope="artesanal"
              size="sm"
            />
            <h3 className="text-body font-semibold" id="economy-artisan">
              Servicios
            </h3>
            <FiscalScopeBadge scope="artesanal" />
            {canDocument && (
              <Button
                className="ml-auto"
                onClick={(event) => {
                  returnFocus.current = event.currentTarget
                  setDocumenting(true)
                }}
                type="button"
                variant="soft"
              >
                <FileText aria-hidden="true" size={16} />
                Generar comprobante de servicios
              </Button>
            )}
          </header>
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
              <Totals
                balance={summary.artisan.balance_total ?? '0.00'}
                confirmed={summary.artisan.confirmed_total ?? '0.00'}
              />
            </>
          ) : (
            <p className="text-body text-ink-muted">
              Sin permiso para consultar documentos del RUC artesanal.
            </p>
          )}
        </section>
      </div>
      {summary.combined && (
        <div className="mx-4 mb-4 rounded-control border border-line bg-surface-subtle px-3 py-2 text-body">
          <p className="font-semibold">Total combinado (informativo)</p>
          <p className="text-label text-ink-muted">
            Suma de documentos de dos RUC distintos: no es una deuda única ni
            una factura y no puede cobrarse en conjunto.
          </p>
          <p className="mt-1 flex flex-wrap gap-4">
            <span>
              Confirmado: <Money amount={summary.combined.confirmed_total} />
            </span>
            <span>
              Sin comprobante: <Money amount={summary.combined.pending_total} />
            </span>
          </p>
        </div>
      )}
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
          onDone={() =>
            finish('Cobro de repuestos registrado (RUC comercial).')
          }
          saleId={payingSale}
          userScope={userScope}
        />
      )}
    </SectionPanel>
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
    <p className="flex justify-end gap-4 border-t border-line pt-2 text-body">
      <span>
        Confirmado: <Money amount={confirmed} />
      </span>
      <span className="font-semibold">
        Saldo: <Money amount={balance} />
      </span>
    </p>
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
          Cobrar repuestos (RUC comercial)
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
          Cobrar servicios (RUC artesanal)
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
