import { FiscalScopeBadge, StatusBadge } from '@/shared/ui'

import type { Service } from './types'

export function ServiceDetails({ service }: { service: Service }) {
  const tax = service.tax
  const taxText = !tax
    ? '—'
    : tax.tax_status === 'applicable'
      ? `${tax.code} — ${tax.name} (${tax.rate}%)`
      : `${tax.code} — ${tax.name} (${tax.tax_status === 'missing' ? 'vigencia pendiente' : 'vigencias ambiguas'})`
  return (
    <section
      aria-label="Datos del servicio"
      className="space-y-4 rounded-group bg-surface p-5 shadow-card"
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink-muted">Nombre</dt>
          <dd className="break-words text-ink">{service.name}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Estado</dt>
          <dd>
            <StatusBadge
              label={service.is_active ? 'Activo' : 'Inactivo'}
              tone={service.is_active ? 'success' : 'neutral'}
            />
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-semibold text-ink-muted">Descripción</dt>
          <dd className="break-words text-ink">{service.description || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">
            Precio referencial final
          </dt>
          <dd className="numeric text-ink">USD {service.reference_price}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Impuesto</dt>
          <dd className="flex flex-wrap items-center gap-2 text-ink">
            <FiscalScopeBadge scope="artesanal" />
            {taxText}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-ink-muted">
        El precio es referencial: el Encargado del taller puede ajustarlo antes
        de confirmar una operación, sin modificar este catálogo ni la historia.
      </p>
    </section>
  )
}
