import { Check } from '@phosphor-icons/react'

import type { FiscalEntity } from '@/features/workshop-configuration/types'
import { PendingCount, RucPlate } from '@/shared/ui'

import type { EntityReadinessSummary } from './readiness'

/**
 * Selector compacto de entidad fiscal junto al título: ámbito, razón social y
 * marcador de estado por opción; la placa del RUC seleccionado va debajo.
 */
export function EntitySwitch({
  entities,
  selectedId,
  onSelect,
  readinessFor,
}: {
  entities: FiscalEntity[]
  selectedId: number
  onSelect: (entityId: number) => void
  readinessFor: (entityId: number) => EntityReadinessSummary | undefined
}) {
  const selected = entities.find((entity) => entity.id === selectedId)
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="sr-only">Entidad fiscal</legend>
        <div className="grid grid-cols-2 gap-1 rounded-control border border-line-strong bg-surface-subtle p-1">
          {entities.map((entity) => (
            <EntityOption
              checked={entity.id === selectedId}
              entity={entity}
              key={entity.id}
              onChange={() => onSelect(entity.id)}
              readiness={readinessFor(entity.id)}
            />
          ))}
        </div>
      </fieldset>
      {selected && (
        <RucPlate
          className="self-start sm:self-end"
          ruc={selected.ruc}
          size="sm"
        />
      )}
    </div>
  )
}

function EntityOption({
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
  const selected = commercial
    ? 'bg-scope-commercial-soft text-scope-commercial shadow-[inset_0_0_0_1.5px_var(--color-scope-commercial)]'
    : 'bg-scope-artisan-soft text-scope-artisan shadow-[inset_0_0_0_1.5px_var(--color-scope-artisan)]'
  const square = commercial ? 'bg-scope-commercial' : 'bg-scope-artisan'

  return (
    <label
      className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-[5px] px-3 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent motion-reduce:transition-none ${checked ? selected : 'text-ink-muted hover:bg-surface hover:text-ink'}`}
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
        className={`size-2 shrink-0 rounded-[2px] ${square}`}
      />
      <span className="shrink-0 font-semibold">
        {commercial ? 'Comercial' : 'Artesanal'}
      </span>
      <span
        className={`min-w-0 truncate sm:max-w-[11rem] ${checked ? 'text-ink' : ''}`}
      >
        {entity.legal_name}
      </span>
      <span className="ml-auto shrink-0 pl-1 text-xs">
        <StateMarker readiness={readiness} />
      </span>
    </label>
  )
}

function StateMarker({
  readiness,
}: {
  readiness: EntityReadinessSummary | undefined
}) {
  if (!readiness) return <span className="sr-only">Evaluando</span>
  if (readiness.state === 'READY')
    return (
      <span className="inline-flex text-success">
        <Check aria-hidden="true" size={14} weight="bold" />
        <span className="sr-only">Lista</span>
      </span>
    )
  if (readiness.state === 'NOT_CONFIGURED')
    return (
      <span className="inline-flex items-center">
        <span
          aria-hidden="true"
          className="size-[7px] rounded-full border-[1.5px] border-ink-muted"
        />
        <span className="sr-only">Sin configurar</span>
      </span>
    )
  return <PendingCount count={readiness.pending} />
}
