import { CurrencyDollar, TextAlignLeft, Wrench } from '@phosphor-icons/react'

import { RecordFooter } from '@/features/catalog-common/RecordFooter'
import { TaxLine } from '@/features/catalog-common/TaxLine'
import { DetailItem, Money, SectionPanel } from '@/shared/ui'

import type { Service } from './types'

/** Ficha del servicio: datos a la izquierda y precio referencial fijo a la derecha. */
export function ServiceDetails({ service }: { service: Service }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <SectionPanel
        className="min-w-0 self-start"
        icon={<Wrench size={17} />}
        id="service-general"
        title="Datos del servicio"
      >
        <dl className="grid gap-4 p-4">
          <DetailItem icon={<Wrench size={15} />} label="Nombre">
            {service.name}
          </DetailItem>
          <DetailItem
            className="border-t border-line pt-4"
            icon={<TextAlignLeft size={15} />}
            label="Descripción"
          >
            <span className="font-normal whitespace-pre-line">
              {service.description || (
                <span className="text-ink-muted">Sin descripción</span>
              )}
            </span>
          </DetailItem>
        </dl>
        <RecordFooter
          createdAt={service.created_at}
          updatedAt={service.updated_at}
        />
      </SectionPanel>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <SectionPanel
          icon={<CurrencyDollar size={17} />}
          id="service-price"
          title="Precio referencial"
        >
          <div className="space-y-2 p-4">
            <p className="text-xs text-ink-muted">Precio final sugerido</p>
            <Money
              amount={service.reference_price}
              className="text-2xl leading-8 font-semibold text-ink"
            />
            <TaxLine scope="artesanal" tax={service.tax} />
          </div>
          <p className="border-t border-line p-4 text-xs text-ink-muted">
            El Encargado del taller puede ajustar el precio antes de confirmar
            una operación, sin modificar este catálogo ni la historia.
          </p>
        </SectionPanel>
      </aside>
    </div>
  )
}
