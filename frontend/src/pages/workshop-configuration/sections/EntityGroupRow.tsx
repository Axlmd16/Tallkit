import type { FiscalEntity } from '@/features/workshop-configuration/types'
import { RucPlate, ScopeLabel } from '@/shared/ui'

/** Fila de grupo de una tabla por entidad fiscal: ámbito, razón social y RUC. */
export function EntityGroupRow({
  entity,
  colSpan,
}: {
  entity: FiscalEntity
  colSpan: number
}) {
  return (
    <tr>
      <th
        className="border-b border-line-strong pt-7 pb-2.5 text-left font-normal"
        colSpan={colSpan}
        scope="rowgroup"
      >
        <span className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <ScopeLabel
            scope={
              entity.entity_type === 'COMERCIAL' ? 'commercial' : 'artesanal'
            }
          />
          <span className="font-semibold text-ink">{entity.legal_name}</span>
          <RucPlate ruc={entity.ruc} size="sm" />
        </span>
      </th>
    </tr>
  )
}
