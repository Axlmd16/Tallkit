import { SealWarning } from '@phosphor-icons/react'

import {
  ErrorState,
  InlineNotice,
  LoadingState,
  StatusBadge,
  Surface,
} from '@/shared/ui'

import { useElectronicStatus } from '../hooks'
import type { ElectronicState } from '../types'

const STATE_LABELS: Record<ElectronicState, string> = {
  NOT_CONFIGURED: 'Sin configurar',
  INCOMPLETE: 'Falta completar',
  NEEDS_REVIEW: 'Requiere revisión',
  READY: 'Lista para preparación local',
}

const STATE_EXPLANATION: Record<ElectronicState, string> = {
  NOT_CONFIGURED:
    'Todavía no existe una configuración guardada para esta entidad.',
  INCOMPLETE: 'Faltan datos necesarios para preparar datos fiscales.',
  NEEDS_REVIEW:
    'Una condición tributaria o una correspondencia necesaria está fuera de vigencia.',
  READY:
    'Contiene lo necesario para preparar datos fiscales en ambiente de pruebas.',
}

const STATE_TONES = {
  NOT_CONFIGURED: 'neutral',
  INCOMPLETE: 'warning',
  NEEDS_REVIEW: 'warning',
  READY: 'success',
} as const

export function ElectronicStatusCard({ entityId }: { entityId: number }) {
  const status = useElectronicStatus(entityId)
  if (status.isLoading) return <LoadingState label="Evaluando configuración…" />
  if (status.isError || !status.data) {
    return <ErrorState message="No se pudo evaluar la configuración fiscal." />
  }
  const { state, causes, warnings } = status.data
  return (
    <Surface className="space-y-4" aria-label="Estado de la configuración">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Estado de la configuración
          </p>
          <p className="mt-1 text-sm text-ink">{STATE_EXPLANATION[state]}</p>
        </div>
        <StatusBadge
          label={STATE_LABELS[state]}
          tone={STATE_TONES[state]}
          shape="pill"
        />
      </div>
      {causes.length > 0 && (
        <ul
          aria-label="Causas del estado"
          className="space-y-1.5 text-sm text-ink"
        >
          {causes.map((cause) => (
            <li className="flex gap-2" key={cause.code}>
              <span aria-hidden="true">•</span>
              <span>
                {cause.message}
                <span className="sr-only">
                  {cause.kind === 'MISSING'
                    ? ' (falta completar)'
                    : ' (requiere revisión)'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <dl className="grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-muted">Ambiente disponible</dt>
          <dd className="font-semibold text-ink">Pruebas</dd>
          <dd className="text-xs text-ink-muted">
            La emisión real todavía no está disponible; producción permanece
            bloqueada.
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Validación</dt>
          <dd className="text-ink">
            Configuración declarada por el Administrador; no está validada por
            el SRI.
          </dd>
        </div>
      </dl>
      {warnings.map((warning) => (
        <InlineNotice
          key={warning.code}
          title="Certificado electrónico"
          tone="info"
        >
          <span className="inline-flex items-center gap-2">
            <SealWarning aria-hidden="true" />
            {warning.message}
          </span>
        </InlineNotice>
      ))}
    </Surface>
  )
}
