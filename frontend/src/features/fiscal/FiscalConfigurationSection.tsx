import { Info, WarningCircle } from '@phosphor-icons/react'
import { useSearchParams } from 'react-router'

import type {
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
import { HintPopover, SectionNav, SubsectionIndicator } from '@/shared/ui'

import { CertificateSection } from './configuration/CertificateSection'
import { EntitySwitch } from './configuration/EntitySwitch'
import { LocationsSection } from './configuration/LocationsSection'
import { PaymentFormsSection } from './configuration/PaymentFormsSection'
import { ProfileConditionsSection } from './configuration/ProfileConditionsSection'
import {
  READINESS_SECTION_SHORT_LABELS,
  READINESS_SECTIONS,
  sectionIndicator,
  warningSection,
  type ConfigurationReadiness,
  type ReadinessSection,
} from './configuration/readiness'
import { TaxMappingsSection } from './configuration/TaxMappingsSection'
import type { StatusCause } from './types'

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
  const pending = [
    ...(summary?.bySection[section] ?? []),
    ...(summary?.general ?? []),
  ]
  const hints = <SectionHints pending={pending} />
  const definitions = taxDefinitions.filter(
    (definition) => definition.fiscal_entity_id === selected.id,
  )

  return (
    <section aria-label="Facturación electrónica" className="space-y-6">
      <EntitySwitch
        entities={entities}
        onSelect={(entityId) => update({ entidad: String(entityId) })}
        readinessFor={(entityId) => readiness.byEntity[entityId]}
        selectedId={selected.id}
      />

      <div className="space-y-6" key={selected.id}>
        {readiness.isError && !summary && (
          <p className="text-[13px] text-danger" role="status">
            No se pudo evaluar el estado de esta entidad.
          </p>
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
            hints={hints}
            warnings={warningsFor(summary?.warnings, 'perfil')}
          />
        </div>
        <div hidden={section !== 'puntos'}>
          <LocationsSection entityId={selected.id} hints={hints} />
        </div>
        <div hidden={section !== 'impuestos'}>
          <TaxMappingsSection
            definitions={definitions}
            entityId={selected.id}
            hints={hints}
          />
        </div>
        <div hidden={section !== 'formas-pago'}>
          <PaymentFormsSection entityId={selected.id} hints={hints} />
        </div>
        <div hidden={section !== 'certificado'}>
          <CertificateSection
            entityId={selected.id}
            hints={hints}
            warnings={warningsFor(summary?.warnings, 'certificado')}
          />
        </div>
      </div>
    </section>
  )
}

function warningsFor(
  warnings: StatusCause[] | undefined,
  section: ReadinessSection,
): StatusCause[] {
  return (warnings ?? []).filter(
    (warning) => warningSection(warning.code) === section,
  )
}

/** Avisos de la subsección como botones rectos, alineados con sus acciones. */
function SectionHints({ pending }: { pending: StatusCause[] }) {
  const label =
    pending.length === 1 ? '1 pendiente' : `${pending.length} pendientes`
  return (
    <>
      {pending.length > 0 && (
        <HintPopover
          align="end"
          label={label}
          trigger={
            <>
              <WarningCircle
                aria-hidden="true"
                className="text-[#c98a00]"
                size={16}
                weight="fill"
              />
              {label}
            </>
          }
          variant="button"
        >
          <p className="font-semibold text-ink">Para completar</p>
          <ul
            aria-label="Pendientes"
            className="mt-1.5 list-none space-y-1.5 p-0"
          >
            {pending.map((cause) => (
              <li className="flex items-start gap-2" key={cause.code}>
                <span
                  aria-hidden="true"
                  className="mt-[6px] size-[7px] shrink-0 rounded-full bg-[#c98a00]"
                />
                {cause.message}
              </li>
            ))}
          </ul>
        </HintPopover>
      )}
      <HintPopover
        align="end"
        description={PREPARATION_NOTICE}
        label="Preparación local"
        trigger={
          <Info
            aria-hidden="true"
            className="text-info"
            size={18}
            weight="bold"
          />
        }
        triggerClassName="px-2.5"
        variant="button"
      >
        <p className="font-semibold text-ink">Preparación local</p>
        <p className="mt-1 text-ink-muted">{PREPARATION_NOTICE}</p>
        <p className="mt-1 text-ink-muted">
          Ambiente disponible: Pruebas. La configuración la declara el
          Administrador y no está validada por el SRI.
        </p>
      </HintPopover>
    </>
  )
}
