import { ArrowLeft, Printer } from '@phosphor-icons/react'
import { Link, useParams } from 'react-router'

import { useServiceOperationDocument } from '@/features/maintenance/billingHooks'
import {
  Button,
  DocumentSheet,
  InlineNotice,
  LoadingState,
  Money,
} from '@/shared/ui'

/** Comprobante interno del RUC artesanal; no es una factura electrónica autorizada. */
export function ServiceOperationDocumentPage() {
  const id = Number(useParams().id)
  const query = useServiceOperationDocument(Number.isFinite(id) ? id : null)
  if (query.isPending) return <LoadingState label="Cargando comprobante…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar el comprobante" tone="danger">
        <Link
          className="font-semibold text-accent hover:underline"
          to={`/maintenance/service-operations/${id}`}
        >
          Volver a la operación
        </Link>
      </InlineNotice>
    )
  }
  const doc = query.data
  const issuer = doc.fiscal_snapshot.entity
  return (
    <div className="catalog-page space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link
          aria-label="Volver a la operación"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a la operación"
          to={`/maintenance/service-operations/${doc.id}`}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted">
            Comprobante interno de servicios
          </p>
          <h1 className="font-mono text-[22px] leading-7 font-semibold">
            {doc.internal_number}
          </h1>
        </div>
        <Button
          onClick={() => window.print()}
          type="button"
          variant="secondary"
        >
          <Printer aria-hidden="true" size={16} />
          Imprimir comprobante
        </Button>
      </div>
      <div className="rounded-panel bg-workspace p-4 max-sm:p-2 print:bg-transparent print:p-0">
        <DocumentSheet
          label={`Comprobante ${doc.internal_number}`}
          meta={[
            {
              label: 'Emisor (RUC artesanal)',
              value: `${issuer.legal_name} · ${issuer.ruc}`,
              wide: true,
            },
            {
              label: 'Cliente',
              value: `${doc.customer_snapshot.name ?? ''} · ${doc.customer_snapshot.identification ?? ''}`,
            },
            {
              label: 'Vehículo',
              value: `${doc.vehicle_snapshot.plate ?? ''} ${doc.vehicle_snapshot.brand ?? ''} ${doc.vehicle_snapshot.model ?? ''}`,
            },
            { label: 'Orden', value: doc.order_number },
            { label: 'Fecha', value: doc.operational_date },
            {
              label: 'Condición',
              value: doc.condition === 'CREDITO' ? 'Crédito' : 'Contado',
            },
          ]}
          notice={doc.fiscal_notice}
          number={doc.internal_number}
          state={
            doc.state === 'VOIDED'
              ? `ANULADA · ${doc.void_reason}`
              : 'CONFIRMADA'
          }
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs">
                <th className="py-1 pr-2">Servicio</th>
                <th className="py-1 pr-2 text-right">Cant.</th>
                <th className="py-1 pr-2 text-right">Base</th>
                <th className="py-1 pr-2 text-right">Impuesto</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((line) => (
                <tr className="border-b border-line" key={line.id}>
                  <td className="py-1 pr-2">{line.service_name}</td>
                  <td className="py-1 pr-2 text-right">{line.quantity}</td>
                  <td className="py-1 pr-2 text-right">
                    <Money amount={line.base_amount} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <Money amount={line.tax_amount} />
                  </td>
                  <td className="py-1 text-right">
                    <Money amount={line.total_amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 ml-auto grid w-64 grid-cols-2 gap-1 text-[13px]">
            <dt>Base</dt>
            <dd className="text-right">
              <Money amount={doc.base_total} />
            </dd>
            <dt>Impuesto</dt>
            <dd className="text-right">
              <Money amount={doc.tax_total} />
            </dd>
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">
              <Money amount={doc.grand_total} />
            </dd>
            <dt>Pagado</dt>
            <dd className="text-right">
              <Money amount={doc.paid} />
            </dd>
            <dt>Saldo</dt>
            <dd className="text-right">
              <Money amount={doc.balance} />
            </dd>
          </dl>
        </DocumentSheet>
      </div>
    </div>
  )
}
