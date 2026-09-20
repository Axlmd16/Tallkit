import { FiscalScopeBadge, StatusBadge } from '@/shared/ui'

import type { Supplier } from './types'

export function SupplierDetails({ supplier }: { supplier: Supplier }) {
  const row = (label: string, value: string | null | undefined) => (
    <div className="min-w-0">
      <dt className="font-semibold text-ink-muted">{label}</dt>
      <dd className="break-words text-ink">{value || '—'}</dd>
    </div>
  )
  return (
    <section
      aria-label="Datos del proveedor"
      className="space-y-4 rounded-group bg-surface p-5 shadow-card"
    >
      <FiscalScopeBadge scope="commercial" />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {row('Nombre o razón social', supplier.name)}
        <div>
          <dt className="font-semibold text-ink-muted">Estado</dt>
          <dd>
            <StatusBadge
              label={supplier.is_active ? 'Activo' : 'Inactivo'}
              tone={supplier.is_active ? 'success' : 'neutral'}
            />
          </dd>
        </div>
        {row(
          'Identificación',
          supplier.identification
            ? `${supplier.identification_type} ${supplier.identification}`
            : null,
        )}
        {row('Teléfono', supplier.phone)}
        {row('Correo electrónico', supplier.email)}
        {row('Dirección', supplier.address)}
      </dl>
    </section>
  )
}
