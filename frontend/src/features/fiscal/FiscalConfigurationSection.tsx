import { useSearchParams } from 'react-router'

import type {
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
import { SectionNav, SheetHeading, SubsectionIndicator } from '@/shared/ui'

import { CertificateSection } from './configuration/CertificateSection'
import { EntitySwitch } from './configuration/EntitySwitch'
import { LocationsSection } from './configuration/LocationsSection'
import { PaymentFormsSection } from './configuration/PaymentFormsSection'
import { PendingNotes } from './configuration/PendingNotes'
import { ProfileConditionsSection } from './configuration/ProfileConditionsSection'
import {
  READINESS_SECTION_SHORT_LABELS,
  READINESS_SECTIONS,
  sectionIndicator,
  type ConfigurationReadiness,
  type ReadinessSection,
} from './configuration/readiness'
import { TaxMappingsSection } from './configuration/TaxMappingsSection'

export const PREPARATION_NOTICE =
  'Configuración para preparación local. La emisión electrónica todavía no está habilitada.'

export function FiscalConfigurationSection({
  entities,
  taxDefinitions,
  readiness,
}: {
  entities: FiscalEntity[]
  taxDefinitions: TaxDefinition[]
  readiness: ConfigurationReadiness
}) {
  const [params, setParams] = useSearchParams()
  const requestedSection = params.get('seccion')
  const section: ReadinessSection =
    READINESS_SECTIONS.find((item) => item === requestedSection) ?? 'perfil'
  const requestedEntity = Number(params.get('entidad'))
  const selected =
    entities.find((entity) => entity.id === requestedEntity) ?? entities[0]

  if (!selected)
    return (
      <p className="text-sm text-ink-muted">
        Registre primero las entidades fiscales.
      </p>
    )

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    next.set('tab', 'facturacion')
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  function sectionHref(id: ReadinessSection) {
    const next = new URLSearchParams(params)
    next.set('tab', 'facturacion')
    if (id === 'perfil') next.delete('seccion')
    else next.set('seccion', id)
    return `?${next.toString()}`
  }

  const summary = readiness.byEntity[selected.id]
  const pendingFor = (id: ReadinessSection) => summary?.bySection[id] ?? []
  const definitions = taxDefinitions.filter(
    (definition) => definition.fiscal_entity_id === selected.id,
  )

  return (
    <section aria-labelledby="facturacion-titulo" className="space-y-6">
      <SheetHeading
        actions={
          <EntitySwitch
            entities={entities}
            onSelect={(entityId) => update({ entidad: String(entityId) })}
            readinessFor={(entityId) => readiness.byEntity[entityId]}
            selectedId={selected.id}
          />
        }
        description={PREPARATION_NOTICE}
        id="facturacion-titulo"
        title="Facturación electrónica"
      />

      <div className="space-y-6" key={selected.id}>
        {readiness.isError && !summary && (
          <p className="text-[13px] text-danger" role="status">
            No se pudo evaluar el estado de esta entidad.
          </p>
        )}
        {summary && summary.general.length > 0 && (
          <PendingNotes causes={summary.general} label="Pendientes generales" />
        )}

        <SectionNav
          activeId={section}
          aria-label="Subsecciones de facturación electrónica"
          className="border-b border-line lg:hidden"
          items={READINESS_SECTIONS.map((id) => ({
            id,
            label: READINESS_SECTION_SHORT_LABELS[id],
            href: sectionHref(id),
            ...(summary
              ? {
                  indicator: (
                    <SubsectionIndicator {...sectionIndicator(summary, id)} />
                  ),
                }
              : {}),
          }))}
          layout="horizontal"
          onSelect={(id) => update({ seccion: id === 'perfil' ? null : id })}
        />

        <div hidden={section !== 'perfil'}>
          <ProfileConditionsSection
            entityId={selected.id}
            pending={pendingFor('perfil')}
          />
        </div>
        <div hidden={section !== 'puntos'}>
          <LocationsSection
            entityId={selected.id}
            pending={pendingFor('puntos')}
          />
        </div>
        <div hidden={section !== 'impuestos'}>
          <TaxMappingsSection
            definitions={definitions}
            entityId={selected.id}
            pending={pendingFor('impuestos')}
          />
        </div>
        <div hidden={section !== 'formas-pago'}>
          <PaymentFormsSection
            entityId={selected.id}
            pending={pendingFor('formas-pago')}
          />
        </div>
        <div hidden={section !== 'certificado'}>
          <CertificateSection
            entityId={selected.id}
            warnings={summary?.warnings ?? []}
          />
        </div>
      </div>
    </section>
  )
}
