import type { ReactNode } from 'react'

import { recordDate } from '@/features/catalog-common/RecordFooter'
import { TaxLine } from '@/features/catalog-common/TaxLine'
import { Money, StatusBadge } from '@/shared/ui'

import type { Service } from './types'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-micro font-semibold tracking-[0.04em] text-ink-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Contenido de la vista previa del servicio: precio, impuesto, descripción y registro. */
export function ServicePreview({ service }: { service: Service }) {
  return (
    <div className="space-y-6">
      <div className="rounded-panel border border-line bg-surface-subtle p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-label text-ink-muted">Precio final sugerido</p>
          <StatusBadge
            label={service.is_active ? 'Activo' : 'Inactivo'}
            tone={service.is_active ? 'success' : 'neutral'}
          />
        </div>
        <Money
          amount={service.reference_price}
          className="mt-1 text-page leading-9 font-semibold text-ink"
        />
        <div className="mt-3 border-t border-line pt-3">
          <TaxLine scope="artesanal" tax={service.tax} />
        </div>
      </div>

      <Section title="Descripción">
        <p className="text-body leading-relaxed whitespace-pre-line text-ink">
          {service.description || (
            <span className="text-ink-muted">Sin descripción</span>
          )}
        </p>
      </Section>

      <Section title="Registro">
        <dl className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <dt className="text-label text-ink-muted">Código</dt>
            <dd className="mt-0.5 code text-body font-medium text-ink">
              {service.code}
            </dd>
          </div>
          <div>
            <dt className="text-label text-ink-muted">Creado</dt>
            <dd className="mt-0.5 text-body font-medium text-ink">
              {recordDate(service.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-label text-ink-muted">Actualizado</dt>
            <dd className="mt-0.5 text-body font-medium text-ink">
              {recordDate(service.updated_at)}
            </dd>
          </div>
        </dl>
      </Section>

      <p className="border-t border-line pt-4 text-label leading-relaxed text-ink-muted">
        El precio es referencial: el Encargado del taller puede ajustarlo antes
        de confirmar una operación, sin modificar este catálogo ni la historia.
      </p>
    </div>
  )
}
