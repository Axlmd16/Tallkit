import { CaretRight } from '@phosphor-icons/react'
import { Link } from 'react-router'

import {
  useConfigurationReadiness,
  type EntityReadinessSummary,
} from '@/features/fiscal/configuration/readiness'
import {
  useAllDocumentSeries,
  useAllTaxDefinitions,
  useFiscalEntities,
} from '@/features/workshop-configuration/queries'
import type {
  DocumentSeries,
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
import {
  businessInitials,
  GaugeMotif,
  InlineNotice,
  LoadingState,
} from '@/shared/ui'

interface CheckRow {
  letter: string
  title: string
  subtitle: string
  status: string
  tone: 'success' | 'warning'
  to: string
  complete: boolean
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const ratio = total > 0 ? done / total : 0
  const offset = circumference * (1 - ratio)
  const complete = done >= total
  return (
    <svg
      aria-hidden="true"
      className="size-10 shrink-0 -rotate-90"
      viewBox="0 0 40 40"
    >
      <circle
        className="stroke-line"
        cx="20"
        cy="20"
        fill="none"
        r={radius}
        strokeWidth="3.5"
      />
      <circle
        className={complete ? 'stroke-success' : 'stroke-primary'}
        cx="20"
        cy="20"
        fill="none"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth="3.5"
      />
    </svg>
  )
}

function buildRows(
  entity: FiscalEntity,
  readiness: EntityReadinessSummary | undefined,
  taxes: TaxDefinition[],
  series: DocumentSeries[],
): CheckRow[] {
  const isArtisan = entity.entity_type === 'ARTESANAL'
  const hasCore = Boolean(entity.ruc && entity.legal_name)
  const hasLogo = Boolean(entity.logo)

  const pointsIssues = readiness?.bySection.puntos.length ?? 0
  const pointsComplete = readiness ? pointsIssues === 0 : series.length > 0
  const activeSeries = series.find((item) => item.is_active)
  const numberingSubtitle = activeSeries
    ? `Serie ${activeSeries.code} · último N.º ${String(activeSeries.last_number).padStart(6, '0')}`
    : 'Configura el punto de emisión y la numeración'

  const certIssues = readiness?.bySection.certificado.length ?? 0
  const certWarn = (readiness?.warnings ?? []).some((w) =>
    w.code.startsWith('certificate_'),
  )
  const certComplete = readiness ? certIssues === 0 && !certWarn : false
  const certStatus = certIssues > 0 ? 'Falta' : certWarn ? 'Revisar' : 'Vigente'
  const certSubtitle =
    certIssues > 0
      ? 'Todavía no se cargó'
      : certWarn
        ? 'Revisa la vigencia de la firma'
        : 'Certificado configurado'

  const taxIssues =
    (readiness?.bySection.impuestos.length ?? 0) +
    (readiness?.bySection.perfil.length ?? 0)
  const entityTaxes = taxes.filter(
    (t) =>
      t.fiscal_entity_id === entity.id || t.entity_type === entity.entity_type,
  )
  const taxComplete = readiness ? taxIssues === 0 : entityTaxes.length > 0
  const mainTax = entityTaxes[0]
  const taxSubtitle = mainTax
    ? `${mainTax.name}${mainTax.current_rate ? ` (${mainTax.current_rate}%)` : ''}`
    : isArtisan
      ? 'Calificación artesanal y régimen tributario'
      : 'IVA y configuración tributaria'

  return [
    {
      letter: 'D',
      title: 'Datos del negocio',
      subtitle: `${entity.legal_name} · RUC ${entity.ruc}`,
      status: hasCore ? 'Completo' : 'Falta',
      tone: hasCore ? 'success' : 'warning',
      to: '/configuration?tab=entidades',
      complete: hasCore,
    },
    {
      letter: 'L',
      title: 'Logo',
      subtitle: 'Sale en recibos y facturas',
      status: hasLogo ? 'Cargado' : 'Falta',
      tone: hasLogo ? 'success' : 'warning',
      to: '/configuration?tab=entidades',
      complete: hasLogo,
    },
    {
      letter: 'N',
      title: 'Numeración de facturas',
      subtitle: numberingSubtitle,
      status: pointsComplete ? 'Completo' : 'Falta',
      tone: pointsComplete ? 'success' : 'warning',
      to: `/configuration?tab=facturacion&seccion=puntos&entidad=${entity.id}`,
      complete: pointsComplete,
    },
    {
      letter: 'F',
      title: 'Firma electrónica',
      subtitle: certSubtitle,
      status: certStatus,
      tone: certComplete ? 'success' : 'warning',
      to: `/configuration?tab=facturacion&seccion=certificado&entidad=${entity.id}`,
      complete: certComplete,
    },
    {
      letter: 'I',
      title: 'Impuestos',
      subtitle: taxSubtitle,
      status: taxComplete ? 'Completo' : 'Falta',
      tone: taxComplete ? 'success' : 'warning',
      to: `/configuration?tab=facturacion&seccion=impuestos&entidad=${entity.id}`,
      complete: taxComplete,
    },
  ]
}

function BusinessCard({
  entity,
  readiness,
  taxes,
  series,
}: {
  entity: FiscalEntity
  readiness: EntityReadinessSummary | undefined
  taxes: TaxDefinition[]
  series: DocumentSeries[]
}) {
  const isArtisan = entity.entity_type === 'ARTESANAL'
  const displayName = entity.trade_name || entity.legal_name
  const subtitle = isArtisan
    ? 'Mano de obra y servicios del taller'
    : 'Venta de repuestos y accesorios'
  const rows = buildRows(entity, readiness, taxes, series)
  const completed = rows.filter((row) => row.complete).length
  const missing = rows.length - completed
  const firstMissing = rows.find((row) => !row.complete)

  const headerBg = isArtisan ? 'bg-[#4F637A]' : 'bg-[#8C6A3E]'
  const badgeBg = isArtisan ? 'bg-[#4F637A]' : 'bg-[#8C6A3E]'

  return (
    <article className="overflow-hidden rounded-dialog border border-line bg-surface shadow-card">
      <div className={`relative h-24 overflow-hidden ${headerBg} px-5 pt-4`}>
        <GaugeMotif
          className="absolute -right-6 -bottom-8 w-44 opacity-45"
          variant="card"
        />
        <div className="relative flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-micro font-semibold text-ink shadow-xs">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${missing === 0 ? 'bg-success' : 'bg-warning'}`}
            />
            {missing === 0
              ? 'Listo para facturar'
              : missing === 1
                ? 'Falta un dato'
                : `Faltan ${missing} datos`}
          </span>
        </div>
      </div>

      <div className="relative px-5 pb-5">
        <div className="flex items-start gap-4">
          <div
            className={`-mt-8 grid size-16 shrink-0 place-items-center overflow-hidden rounded-full text-lead font-bold text-white ring-4 ring-surface ${badgeBg}`}
          >
            {entity.logo?.url ? (
              <img
                alt={displayName}
                className="size-full bg-surface object-contain p-1"
                src={entity.logo.url}
              />
            ) : (
              businessInitials(displayName)
            )}
          </div>
          <div className="min-w-0 pt-2.5 leading-snug">
            <h2 className="truncate text-block font-bold text-ink">
              {displayName}
            </h2>
            <p className="text-label text-ink-muted">{subtitle}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3.5 rounded-panel bg-surface-subtle px-4 py-3">
          <ProgressRing done={completed} total={rows.length} />
          <div className="min-w-0 leading-snug">
            <p className="text-body font-bold text-ink">
              {completed} de {rows.length} datos completos
            </p>
            <p className="text-label text-ink-muted">
              {missing === 0
                ? 'Puede preparar facturas'
                : firstMissing
                  ? `Completa ${firstMissing.title.toLowerCase()} para facturar`
                  : 'Completa los datos pendientes'}
            </p>
          </div>
        </div>

        <ul className="mt-3 divide-y divide-line">
          {rows.map((row) => (
            <li key={row.letter}>
              <Link
                className="flex items-center gap-3.5 py-3 transition-colors hover:bg-surface-subtle/50"
                to={row.to}
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-control bg-surface-subtle text-label font-semibold text-ink-muted"
                >
                  {row.letter}
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block text-body font-semibold text-ink">
                    {row.title}
                  </span>
                  <span className="block truncate text-label text-ink-muted">
                    {row.subtitle}
                  </span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 text-label font-semibold ${
                    row.tone === 'success' ? 'text-success' : 'text-warning'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      row.tone === 'success' ? 'bg-success' : 'bg-warning'
                    }`}
                  />
                  {row.status}
                </span>
                <CaretRight
                  aria-hidden="true"
                  className="shrink-0 text-ink-muted"
                  size={15}
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/**
 * Pestaña «Negocios» de Ajustes: muestra las dos tarjetas de negocio con su avance
 * «n de 5 datos completos» y accesos directos a cada sección de la configuración fiscal.
 */
export function BusinessCards() {
  const entitiesQuery = useFiscalEntities()
  const taxesQuery = useAllTaxDefinitions()
  const seriesQuery = useAllDocumentSeries()
  const entities = entitiesQuery.data ?? []
  const readiness = useConfigurationReadiness(entities.map((e) => e.id))

  if (entitiesQuery.isLoading) {
    return <LoadingState label="Cargando negocios…" />
  }

  if (entitiesQuery.isError) {
    return (
      <InlineNotice title="No se pudieron cargar los negocios" tone="danger">
        Reintenta o abre la{' '}
        <Link className="underline" to="/configuration">
          configuración del taller
        </Link>
        .
      </InlineNotice>
    )
  }

  if (entities.length === 0) {
    return (
      <InlineNotice title="Aún no se han configurado los negocios" tone="info">
        Completa la{' '}
        <Link className="font-semibold underline" to="/configuration/setup">
          guía inicial
        </Link>{' '}
        para registrar el taller y el almacén.
      </InlineNotice>
    )
  }

  // Orden del prototipo: taller (ARTESANAL) a la izquierda, repuestos (COMERCIAL) a la derecha.
  const ordered = [...entities].sort((a, b) =>
    a.entity_type === 'ARTESANAL' ? -1 : b.entity_type === 'ARTESANAL' ? 1 : 0,
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-2">
        {ordered.map((entity) => (
          <BusinessCard
            entity={entity}
            key={entity.id}
            readiness={readiness.byEntity[entity.id]}
            series={(seriesQuery.data ?? []).filter(
              (s) => s.entity_type === entity.entity_type,
            )}
            taxes={taxesQuery.data ?? []}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Link
          className="text-label font-semibold text-accent hover:underline"
          to="/configuration"
        >
          Abrir configuración avanzada →
        </Link>
      </div>
    </div>
  )
}
