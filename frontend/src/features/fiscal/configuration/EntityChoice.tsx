import { Check } from '@phosphor-icons/react'

import type { FiscalEntity } from '@/features/workshop-configuration/types'
import { PendingCount } from '@/shared/ui'

import type { EntityReadinessSummary } from './readiness'

/** Opción visible de entidad fiscal: razón social, RUC, ámbito y estado en texto. */
export function EntityChoice({
  checked,
  entity,
  onChange,
  readiness,
}: {
  checked: boolean
  entity: FiscalEntity
  onChange: () => void
  readiness: EntityReadinessSummary | undefined
}) {
  const commercial = entity.entity_type === 'COMERCIAL'
  const scopeName = commercial ? 'Comercial' : 'Artesanal'
  const selectedTone = commercial
    ? 'border-scope-commercial bg-scope-commercial-soft'
    : 'border-scope-artisan bg-scope-artisan-soft'

  return (
    <label
      className={`flex min-h-16 cursor-pointer items-center gap-3.5 rounded-panel px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 ${checked ? `border-[1.5px] ${selectedTone}` : 'border border-line bg-surface hover:border-line-strong'}`}
    >
      <input
        checked={checked}
        className="sr-only"
        name="entidad-fiscal"
        onChange={onChange}
        type="radio"
        value={entity.id}
      />
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-[2px] ${commercial ? 'bg-scope-commercial' : 'bg-scope-artisan'}`}
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold break-words text-ink">
          {entity.legal_name}
        </span>
        <span className="font-mono text-xs text-ink-muted">
          RUC {entity.ruc} · <span className="font-sans">{scopeName}</span>
        </span>
      </span>
      <span className="ml-auto shrink-0 text-xs">
        <ChoiceState readiness={readiness} />
      </span>
    </label>
  )
}

function ChoiceState({
  readiness,
}: {
  readiness: EntityReadinessSummary | undefined
}) {
  if (!readiness) return <span className="text-ink-muted">Evaluando…</span>
  if (readiness.state === 'READY')
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-success">
        <Check aria-hidden="true" size={15} weight="bold" />
        Lista
      </span>
    )
  if (readiness.state === 'NOT_CONFIGURED')
    return <span className="font-semibold text-ink-muted">Sin configurar</span>
  return (
    <span className="inline-flex items-center gap-1">
      <PendingCount count={readiness.pending} />
      <span aria-hidden="true" className="font-semibold text-warning">
        {readiness.pending === 1 ? 'pendiente' : 'pendientes'}
      </span>
    </span>
  )
}
