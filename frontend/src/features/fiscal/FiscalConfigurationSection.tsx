import {
  Certificate,
  IdentificationCard,
  Info,
  MapPin,
  Percent,
  Wallet,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
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
  READINESS_SECTION_LABELS,
  READINESS_SECTION_SHORT_LABELS,
  READINESS_SECTIONS,
  sectionIndicator,
  type ConfigurationReadiness,
  type ReadinessSection,
} from './configuration/readiness'
import { TaxMappingsSection } from './configuration/TaxMappingsSection'
import type { StatusCause } from './types'

export const PREPARATION_NOTICE =
  'Configuración para preparación local. La emisión electrónica todavía no está habilitada.'

const SUBSECTIONS: Record<
  ReadinessSection,
  { description: string; icon: Icon }
> = {
  perfil: {
    description: 'Declare cada condición según el certificado de RUC.',
    icon: IdentificationCard,
  },
  puntos: {
    description: 'Códigos de tres dígitos que usa el SRI.',
    icon: MapPin,
  },
  impuestos: {
    description: 'Relacione cada impuesto interno con su tarifa oficial.',
    icon: Percent,
  },
  'formas-pago': {
    description: 'En V1 solo se habilitan efectivo (01) y transferencia (20).',
    icon: Wallet,
  },
  certificado: {
    description: 'Opcional. Datos de referencia; no equivale a una firma.',
    icon: Certificate,
  },
}

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
  const current = SUBSECTIONS[section]
  const SectionIcon = current.icon
  const commercial = selected.entity_type === 'COMERCIAL'
  const pending = [
    ...(summary?.bySection[section] ?? []),
    ...(summary?.general ?? []),
  ]
  const definitions = taxDefinitions.filter(
    (definition) => definition.fiscal_entity_id === selected.id,
  )

  return (
    <section aria-label="Facturación electrónica" className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden="true"
            className={`grid size-11 shrink-0 place-items-center rounded-control ${commercial ? 'bg-scope-commercial-soft text-scope-commercial' : 'bg-scope-artisan-soft text-scope-artisan'}`}
          >
            <SectionIcon size={22} weight="duotone" />
          </span>
          <div className="min-w-0">
            <h2
              className="text-xl leading-7 font-bold text-ink"
              id="facturacion-titulo"
            >
              {READINESS_SECTION_LABELS[section]}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {current.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PendingHint causes={pending} />
              <HintPopover
                description={PREPARATION_NOTICE}
                label="Preparación local"
                trigger={
                  <>
                    <Info aria-hidden="true" size={15} weight="bold" />
                    Preparación local
                  </>
                }
                triggerClassName="bg-info-soft text-info hover:bg-accent-soft"
              >
                <p className="font-semibold text-ink">Preparación local</p>
                <p className="mt-1 text-ink-muted">{PREPARATION_NOTICE}</p>
                <p className="mt-1 text-ink-muted">
                  Ambiente disponible: Pruebas. La configuración la declara el
                  Administrador y no está validada por el SRI.
                </p>
              </HintPopover>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <EntitySwitch
            entities={entities}
            onSelect={(entityId) => update({ entidad: String(entityId) })}
            readinessFor={(entityId) => readiness.byEntity[entityId]}
            selectedId={selected.id}
          />
        </div>
      </header>

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
          <ProfileConditionsSection entityId={selected.id} />
        </div>
        <div hidden={section !== 'puntos'}>
          <LocationsSection entityId={selected.id} />
        </div>
        <div hidden={section !== 'impuestos'}>
          <TaxMappingsSection
            definitions={definitions}
            entityId={selected.id}
          />
        </div>
        <div hidden={section !== 'formas-pago'}>
          <PaymentFormsSection entityId={selected.id} />
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

/** Advertencia interactiva con los pendientes de la subsección actual. */
function PendingHint({ causes }: { causes: StatusCause[] }) {
  if (causes.length === 0) return null
  const label =
    causes.length === 1 ? '1 pendiente' : `${causes.length} pendientes`
  return (
    <HintPopover
      label={label}
      trigger={
        <>
          <WarningCircle aria-hidden="true" size={16} weight="fill" />
          {causes.length}
        </>
      }
      triggerClassName="bg-warning-soft text-warning hover:bg-[#ffe9ad]"
    >
      <p className="font-semibold text-ink">Para completar</p>
      <ul aria-label="Pendientes" className="mt-1.5 list-none space-y-1.5 p-0">
        {causes.map((cause) => (
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
  )
}
