import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  documentDate,
  PurchaseStateBadge,
  timestamp,
  usd,
} from '@/features/purchases/format'
import { usePurchase } from '@/features/purchases/hooks'
import { ReplacementDialog } from '@/features/purchases/ReplacementDialog'
import { documentTypeLabels } from '@/features/purchases/types'
import { VoidDialog } from '@/features/purchases/VoidDialog'
import {
  Button,
  FiscalScopeBadge,
  InlineNotice,
  LoadingState,
  PageHeader,
} from '@/shared/ui'

export function PurchaseDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const location = useLocation()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const query = usePurchase(Number.isFinite(id) ? id : null)
  const [voiding, setVoiding] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const voidTrigger = useRef<HTMLButtonElement>(null)
  const replaceTrigger = useRef<HTMLButtonElement>(null)
  const back = (location.state as { from?: string } | null)?.from ?? ''

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

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate(`/purchases${back}`)}
              type="button"
              variant="quiet"
            >
              Volver a la lista
            </Button>
            {purchase.state === 'DRAFT' &&
              permissions.has('ingresos.crear') && (
                <Button
                  onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                  type="button"
                >
                  Editar borrador
                </Button>
              )}
            {purchase.state === 'CONFIRMED' &&
              permissions.has('ingresos.anular') && (
                <Button
                  onClick={() => setVoiding(true)}
                  ref={voidTrigger}
                  type="button"
                  variant="danger"
                >
                  Anular ingreso
                </Button>
              )}
            {purchase.state !== 'DRAFT' &&
              permissions.has('ingresos.crear') && (
                <Button
                  onClick={() => setReplacing(true)}
                  ref={replaceTrigger}
                  type="button"
                  variant="secondary"
                >
                  Crear reemplazo
                </Button>
              )}
          </div>
        }
        description={`${documentTypeLabels[purchase.document.type]} ${purchase.document.reference}`.trim()}
        title={purchase.internal_number ?? `Borrador #${purchase.id}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <PurchaseStateBadge state={purchase.state} />
        <FiscalScopeBadge scope="commercial" />
      </div>
      {notice && (
        <InlineNotice title="Operación exitosa" tone="success">
          {notice}
        </InlineNotice>
      )}
      <dl className="grid gap-3 rounded-group bg-surface p-4 shadow-card sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-muted">Proveedor</dt>
          <dd className="font-semibold">{purchase.supplier.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Fecha del documento</dt>
          <dd className="font-semibold">
            {documentDate(purchase.document_date)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Fecha de confirmación</dt>
          <dd className="font-semibold">{timestamp(purchase.confirmed_at)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Observación</dt>
          <dd>{purchase.notes || '—'}</dd>
        </div>
        {purchase.document.no_document_reason && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-ink-muted">
              Explicación de la compra sin documento
            </dt>
            <dd>{purchase.document.no_document_reason}</dd>
          </div>
        )}
      </dl>
      {purchase.state === 'VOIDED' && (
        <InlineNotice title="Ingreso anulado" tone="warning">
          Anulado el {timestamp(purchase.voided_at)}. Motivo:{' '}
          {purchase.void_reason}
        </InlineNotice>
      )}
      <section aria-label="Líneas" className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Líneas</h2>
        {purchase.lines.map((line) => (
          <article
            aria-label={`Línea ${line.position}`}
            className="rounded-group bg-surface p-4 shadow-card"
            key={line.id}
          >
            <h3 className="font-semibold text-ink">
              {line.product.code} — {line.product.name}
            </h3>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-ink-muted">Cantidad</dt>
                <dd>
                  {line.quantity} {line.product.unit_symbol ?? ''}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Costo unitario</dt>
                <dd>{usd(line.unit_cost)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Impuesto</dt>
                <dd>
                  {line.tax.code ?? '—'}{' '}
                  {line.tax.rate ? `${line.tax.rate}%` : ''} ·{' '}
                  {line.tax_recoverability === 'RECOVERABLE'
                    ? 'recuperable'
                    : 'no recuperable'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Total</dt>
                <dd>{usd(line.amounts?.total)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
      <section
        aria-label="Totales"
        className="rounded-group bg-surface p-4 shadow-card"
      >
        <h2 className="font-semibold text-ink">Totales</h2>
        {purchase.totals ? (
          <p className="mt-2">
            Base {usd(purchase.totals.base)} · Impuesto{' '}
            {usd(purchase.totals.tax)} · Total{' '}
            <strong>{usd(purchase.totals.total)}</strong> · Valor inventariable{' '}
            {usd(purchase.totals.inventory_value)}
          </p>
        ) : (
          <p className="mt-2 text-ink-muted">Totales no calculables todavía.</p>
        )}
      </section>
      <section aria-label="Vínculos" className="space-y-1 text-sm">
        {purchase.replaces_id && (
          <p>
            Reemplaza al ingreso{' '}
            <Link
              className="underline"
              to={`/purchases/${purchase.replaces_id}`}
            >
              #{purchase.replaces_id}
            </Link>
            .
          </p>
        )}
        {purchase.replacements.map((r) => (
          <p key={r.id}>
            Reemplazo:{' '}
            <Link className="underline" to={`/purchases/${r.id}`}>
              {r.internal_number ?? `Borrador #${r.id}`}
            </Link>
          </p>
        ))}
        {canOpenInventory && purchase.inventory_operation_id && (
          <p>
            Operación de inventario:{' '}
            <Link
              className="underline"
              to={`/inventory/operations/${purchase.inventory_operation_id}`}
            >
              INV-{purchase.inventory_operation_id}
            </Link>
          </p>
        )}
        {canOpenInventory && purchase.void_operation_id && (
          <p>
            Compensación:{' '}
            <Link
              className="underline"
              to={`/inventory/operations/${purchase.void_operation_id}`}
            >
              INV-{purchase.void_operation_id}
            </Link>
          </p>
        )}
      </section>
      <VoidDialog
        canOpenInventory={canOpenInventory}
        onClose={() => setVoiding(false)}
        onDone={() => {
          setVoiding(false)
          setNotice('El ingreso fue anulado y su efecto compensado.')
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
