import { Check } from '@phosphor-icons/react'

import type { FiscalEntity } from '@/features/workshop-configuration/types'
import { PendingCount, RucPlate } from '@/shared/ui'

import type { EntityReadinessSummary } from './readiness'

/**
 * Barra de pestañas de entidad fiscal: pestañas rectas con línea inferior,
 * como la navegación de secciones, y la placa del RUC seleccionado a la derecha.
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
    <div className="flex flex-col gap-2 border-b border-line sm:flex-row sm:items-end sm:justify-between">
      <fieldset className="relative -mb-px min-w-0 border-0 p-0">
        <legend className="sr-only">Entidad fiscal</legend>
        <div className="flex overflow-x-auto">
          {entities.map((entity) => (
            <EntityTab
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
          className="mb-2 self-start sm:self-auto"
          ruc={selected.ruc}
          size="sm"
        />
      )}
    </div>
  )
}

function EntityTab({
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
  const square = commercial ? 'bg-scope-commercial' : 'bg-scope-artisan'

  return (
    <label
      className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-4 text-body whitespace-nowrap first:pl-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-inset ${checked ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
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
      <span className="font-semibold">
        {commercial ? 'Comercial' : 'Artesanal'}
      </span>
      <span className={checked ? 'text-ink' : ''}>{entity.legal_name}</span>
      <span className="pl-1 text-label">
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
