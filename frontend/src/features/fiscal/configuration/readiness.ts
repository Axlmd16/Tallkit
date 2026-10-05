import { useElectronicStatus } from '../hooks'
import type { ElectronicState, ElectronicStatus, StatusCause } from '../types'

export const READINESS_SECTIONS = [
  'perfil',
  'puntos',
  'impuestos',
  'formas-pago',
  'certificado',
] as const
export type ReadinessSection = (typeof READINESS_SECTIONS)[number]

export const READINESS_SECTION_LABELS: Record<ReadinessSection, string> = {
  perfil: 'Perfil tributario',
  puntos: 'Establecimientos y puntos de emisión',
  impuestos: 'Impuestos y catálogo SRI',
  'formas-pago': 'Formas de pago SRI',
  certificado: 'Certificado electrónico',
}

/** Nombres breves para la navegación; el título de cada subsección conserva el completo. */
export const READINESS_SECTION_SHORT_LABELS: Record<ReadinessSection, string> =
  {
    perfil: 'Perfil tributario',
    puntos: 'Puntos de emisión',
    impuestos: 'Impuestos SRI',
    'formas-pago': 'Formas de pago',
    certificado: 'Certificado',
  }

export const ELECTRONIC_STATE_LABELS: Record<ElectronicState, string> = {
  NOT_CONFIGURED: 'Sin configurar',
  INCOMPLETE: 'Falta completar',
  NEEDS_REVIEW: 'Requiere revisión',
  READY: 'Lista para preparación local',
}

/** Destino que resuelve un pendiente; sin subsección cuando la causa no es atribuible. */
export interface ReadinessDestination {
  entityId: number
  section: ReadinessSection | null
}

/**
 * Subsección donde se resuelve cada causa del estado fiscal. Los códigos los
 * construye `backend/src/workshop_configuration/application/electronic_status.py`;
 * un código nuevo sin correspondencia se trata como causa general.
 */
export function sectionForCause(code: string): ReadinessSection | null {
  if (
    code === 'profile' ||
    code === 'profile.legacy_format' ||
    /^conditions\.[^.]+\.(unknown|future|expired|unsupported)$/.test(code)
  )
    return 'perfil'
  if (/^tax_mapping\.\d+\.(missing|expired|review)$/.test(code))
    return 'impuestos'
  if (
    [
      'point_missing',
      'default_point_required',
      'establishment_address',
    ].includes(code)
  )
    return 'puntos'
  if (['payment_forms_missing', 'default_payment_form_required'].includes(code))
    return 'formas-pago'
  if (code.startsWith('certificate_')) return 'certificado'
  return null
}

/**
 * Subsección que explica una advertencia: las del certificado van a su subsección y el
 * aviso de vencimiento de la calificación artesanal, al perfil tributario.
 */
export function warningSection(code: string): ReadinessSection | null {
  if (code.startsWith('certificate_')) return 'certificado'
  if (code.startsWith('artisan_qualification_')) return 'perfil'
  return null
}

export interface EntityReadinessSummary {
  entityId: number
  state: ElectronicState
  pending: number
  /** Causas en el orden del servidor. */
  causes: StatusCause[]
  bySection: Record<ReadinessSection, StatusCause[]>
  general: StatusCause[]
  warnings: StatusCause[]
  firstDestination: ReadinessDestination | null
}

export function summarizeEntityStatus(
  status: ElectronicStatus,
): EntityReadinessSummary {
  const bySection = Object.fromEntries(
    READINESS_SECTIONS.map((section) => [section, [] as StatusCause[]]),
  ) as Record<ReadinessSection, StatusCause[]>
  const general: StatusCause[] = []

  for (const cause of status.causes) {
    const section = sectionForCause(cause.code)
    if (section) bySection[section].push(cause)
    else general.push(cause)
  }

  const firstCause = status.causes[0]
  return {
    entityId: status.entity_id,
    state: status.state,
    pending: status.causes.length,
    causes: status.causes,
    bySection,
    general,
    warnings: status.warnings ?? [],
    firstDestination: firstCause
      ? {
          entityId: status.entity_id,
          section: sectionForCause(firstCause.code),
        }
      : null,
  }
}

/** Indicador breve de una subsección para la entidad seleccionada. */
export function sectionIndicator(
  summary: EntityReadinessSummary,
  section: ReadinessSection,
): {
  label: string
  tone: 'success' | 'warning' | 'neutral'
  count?: number
} {
  const pending = summary.bySection[section].length
  if (pending > 0)
    return {
      label: pending === 1 ? '1 pendiente' : `${pending} pendientes`,
      tone: 'warning',
      count: pending,
    }
  const warned = summary.warnings.some(
    (warning) => warningSection(warning.code) === section,
  )
  if (section === 'certificado')
    return warned
      ? { label: 'Revisar', tone: 'warning' }
      : { label: 'Opcional', tone: 'neutral' }
  if (warned) return { label: 'Revisar', tone: 'warning' }
  return { label: 'Completo', tone: 'success' }
}

export function destinationHref({ entityId, section }: ReadinessDestination) {
  const params = new URLSearchParams({
    tab: 'facturacion',
    entidad: String(entityId),
  })
  if (section) params.set('seccion', section)
  return `?${params.toString()}`
}

export interface ConfigurationReadiness {
  isLoading: boolean
  isError: boolean
  pending: number
  firstDestination: ReadinessDestination | null
  byEntity: Record<number, EntityReadinessSummary>
}

/** Estado de las dos entidades; comparte caché con la sección de facturación. */
export function useConfigurationReadiness(
  entityIds: number[],
): ConfigurationReadiness {
  const first = useElectronicStatus(entityIds[0] ?? 0)
  const second = useElectronicStatus(entityIds[1] ?? 0)
  const queries = [first, second].slice(0, entityIds.length)
  const summaries = queries.flatMap((query) =>
    query.data ? [summarizeEntityStatus(query.data)] : [],
  )

  return {
    isLoading:
      entityIds.length === 0 || queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    pending: summaries.reduce((total, summary) => total + summary.pending, 0),
    firstDestination:
      summaries.find((summary) => summary.firstDestination)?.firstDestination ??
      null,
    byEntity: Object.fromEntries(
      summaries.map((summary) => [summary.entityId, summary]),
    ),
  }
}
