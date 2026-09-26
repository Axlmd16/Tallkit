import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react'
import { Link, useSearchParams } from 'react-router'

import type {
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
import { AdvancedInfo, SectionNav, SheetHeading } from '@/shared/ui'

import { CertificateSection } from './configuration/CertificateSection'
import { EntityChoice } from './configuration/EntityChoice'
import { LocationsSection } from './configuration/LocationsSection'
import { PaymentFormsSection } from './configuration/PaymentFormsSection'
import { ProfileConditionsSection } from './configuration/ProfileConditionsSection'
import {
  destinationHref,
  ELECTRONIC_STATE_LABELS,
  READINESS_SECTION_LABELS,
  READINESS_SECTIONS,
  sectionIndicator,
  type ConfigurationReadiness,
  type EntityReadinessSummary,
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
  const definitions = taxDefinitions.filter(
    (definition) => definition.fiscal_entity_id === selected.id,
  )

  return (
    <section aria-labelledby="facturacion-titulo" className="space-y-6">
      <SheetHeading
        id="facturacion-titulo"
        actions={
          <span className="inline-flex h-[26px] items-center rounded-full bg-surface-muted px-2.5 text-xs font-semibold text-ink-muted">
            Preparación local
          </span>
        }
        description={PREPARATION_NOTICE}
        title="Facturación electrónica"
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="sr-only">Entidad fiscal</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {entities.map((entity) => (
            <EntityChoice
              checked={entity.id === selected.id}
              entity={entity}
              key={entity.id}
              onChange={() => update({ entidad: String(entity.id) })}
              readiness={readiness.byEntity[entity.id]}
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-6" key={selected.id}>
        <StatusStrip isError={readiness.isError} summary={summary} />

        <SectionNav
          activeId={section}
          aria-label="Subsecciones de facturación electrónica"
          className="border-b border-line lg:hidden"
          items={READINESS_SECTIONS.map((id) => ({
            id,
            label: READINESS_SECTION_LABELS[id],
            href: sectionHref(id),
            ...(summary
              ? { indicator: sectionIndicator(summary, id).label }
              : {}),
          }))}
          layout="horizontal"
          onSelect={(id) => update({ seccion: id === 'perfil' ? null : id })}
        />

        <div className="pt-2" hidden={section !== 'perfil'}>
          <ProfileConditionsSection entityId={selected.id} />
        </div>
        <div className="pt-2" hidden={section !== 'puntos'}>
          <LocationsSection entityId={selected.id} />
        </div>
        <div className="pt-2" hidden={section !== 'impuestos'}>
          <TaxMappingsSection
            definitions={definitions}
            entityId={selected.id}
          />
        </div>
        <div className="pt-2" hidden={section !== 'formas-pago'}>
          <PaymentFormsSection entityId={selected.id} />
        </div>
        <div className="pt-2" hidden={section !== 'certificado'}>
          <CertificateSection entityId={selected.id} />
        </div>
      </div>
    </section>
  )
}

function StatusStrip({
  summary,
  isError,
}: {
  summary: EntityReadinessSummary | undefined
  isError: boolean
}) {
  if (!summary)
    return (
      <p
        className={`rounded-control px-4 py-3 text-sm ${isError ? 'bg-danger-soft text-danger' : 'bg-surface-subtle text-ink-muted'}`}
        role="status"
      >
        {isError
          ? 'No se pudo evaluar el estado de esta entidad.'
          : 'Evaluando la configuración…'}
      </p>
    )

  const label = ELECTRONIC_STATE_LABELS[summary.state]
  const ready = summary.state === 'READY'
  const tone = ready
    ? 'bg-success-soft text-success'
    : summary.state === 'NOT_CONFIGURED'
      ? 'bg-surface-muted text-ink'
      : 'bg-warning-soft text-warning'
  const Icon = ready ? CheckCircle : WarningCircle
  const [first, ...rest] = summary.causes
  const destination = summary.firstDestination

  return (
    <div className="space-y-2">
      <div
        aria-label="Estado de la configuración"
        className={`rounded-control px-4 py-3 text-sm ${tone}`}
        role="status"
      >
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <Icon
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={18}
            weight="bold"
          />
          <p className="min-w-0 flex-1">
            <strong>{label}.</strong>{' '}
            {first
              ? first.message
              : ready
                ? 'Contiene lo necesario para preparar datos fiscales en ambiente de pruebas.'
                : 'Todavía no existe una configuración guardada para esta entidad.'}
          </p>
          {destination?.section && (
            <Link
              className="font-semibold underline-offset-2 hover:underline"
              replace
              to={destinationHref(destination)}
            >
              Ir a {READINESS_SECTION_LABELS[destination.section]}
            </Link>
          )}
        </div>
        {rest.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-12">
            {rest.map((cause) => (
              <li key={cause.code}>{cause.message}</li>
            ))}
          </ul>
        )}
      </div>
      {summary.warnings.map((warning) => (
        <p
          className="flex items-start gap-2 text-[13px] text-ink-muted"
          key={warning.code}
        >
          <Info aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
          <span>
            <span className="font-semibold text-ink">Certificado:</span>{' '}
            {warning.message} No cambia el estado de preparación.
          </span>
        </p>
      ))}
      <AdvancedInfo hint="ambiente y validación">
        <p>
          Ambiente disponible: <strong className="text-ink">Pruebas</strong>. La
          emisión real todavía no está disponible; producción permanece
          bloqueada.
        </p>
        <p>
          Configuración declarada por el Administrador; no está validada por el
          SRI.
        </p>
      </AdvancedInfo>
    </div>
  )
}
