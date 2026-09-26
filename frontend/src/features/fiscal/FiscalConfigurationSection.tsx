import { useState } from 'react'
import { useSearchParams } from 'react-router'

import type {
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
import { getControlClasses, InlineNotice, Tabs } from '@/shared/ui'

import { CertificateSection } from './configuration/CertificateSection'
import { ElectronicStatusCard } from './configuration/ElectronicStatusCard'
import { LocationsSection } from './configuration/LocationsSection'
import { PaymentFormsSection } from './configuration/PaymentFormsSection'
import { ProfileConditionsSection } from './configuration/ProfileConditionsSection'
import { TaxMappingsSection } from './configuration/TaxMappingsSection'

const SECTIONS = [
  'perfil',
  'puntos',
  'impuestos',
  'formas-pago',
  'certificado',
] as const
type Section = (typeof SECTIONS)[number]

function isSection(value: string | null): value is Section {
  return SECTIONS.includes(value as Section)
}

export function FiscalConfigurationSection({
  entities,
  taxDefinitions,
}: {
  entities: FiscalEntity[]
  taxDefinitions: TaxDefinition[]
}) {
  const [entityId, setEntityId] = useState(entities[0]?.id ?? 0)
  const [params, setParams] = useSearchParams()
  const requested = params.get('seccion')
  const section: Section = isSection(requested) ? requested : 'perfil'
  const selected =
    entities.find((entity) => entity.id === entityId) ?? entities[0]

  if (!selected) {
    return (
      <p className="text-sm text-ink-muted">
        Registre primero las entidades fiscales.
      </p>
    )
  }

  const selectSection = (next: string) => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', 'facturacion')
    if (next === 'perfil') nextParams.delete('seccion')
    else nextParams.set('seccion', next)
    setParams(nextParams, { replace: true })
  }
  const definitions = taxDefinitions.filter(
    (definition) => definition.fiscal_entity_id === selected.id,
  )

  return (
    <section aria-label="Facturación electrónica" className="space-y-5">
      <InlineNotice title="Preparación local" tone="info">
        Configuración para preparación local. La emisión electrónica todavía no
        está habilitada.
      </InlineNotice>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">
            Facturación electrónica
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Entidad seleccionada:{' '}
            <strong className="text-ink">{selected.legal_name}</strong> · RUC{' '}
            <span className="font-mono">{selected.ruc}</span>
          </p>
        </div>
        <label className="ui-field min-w-64 text-sm font-semibold text-ink">
          Entidad fiscal
          <select
            className={`mt-1.5 ${getControlClasses()}`}
            onChange={(event) => setEntityId(Number(event.target.value))}
            value={selected.id}
          >
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.legal_name} · {entity.ruc}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-5" key={selected.id}>
        <ElectronicStatusCard entityId={selected.id} />
        <Tabs
          activeId={section}
          aria-label="Subsecciones de facturación electrónica"
          keepMounted
          onChange={selectSection}
          variant="pill"
          items={[
            {
              id: 'perfil',
              label: 'Perfil tributario',
              content: <ProfileConditionsSection entityId={selected.id} />,
            },
            {
              id: 'puntos',
              label: 'Establecimientos y puntos de emisión',
              content: <LocationsSection entityId={selected.id} />,
            },
            {
              id: 'impuestos',
              label: 'Impuestos y catálogo SRI',
              content: (
                <TaxMappingsSection
                  definitions={definitions}
                  entityId={selected.id}
                />
              ),
            },
            {
              id: 'formas-pago',
              label: 'Formas de pago SRI',
              content: <PaymentFormsSection entityId={selected.id} />,
            },
            {
              id: 'certificado',
              label: 'Certificado electrónico',
              content: <CertificateSection entityId={selected.id} />,
            },
          ]}
        />
      </div>
    </section>
  )
}
