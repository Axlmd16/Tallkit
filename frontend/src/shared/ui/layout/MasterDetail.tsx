import { CaretLeft } from '@phosphor-icons/react'
import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react'

import { Button } from '../controls'

const phoneQuery = '(max-width: 767px)'

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const media = window.matchMedia(phoneQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function usePhone() {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(phoneQuery).matches,
    () => false,
  )
}

export interface MasterDetailProps<T> {
  /** Registros que la lista muestra ya filtrados. */
  items: readonly T[]
  getKey: (item: T) => string
  /** Clave del registro elegido; si ya no está en `items`, el detalle indica que no hay elegido. */
  selectedKey: string | null
  onSelect: (key: string) => void
  renderItem: (item: T, selected: boolean) => ReactNode
  renderDetail: (item: T) => ReactNode
  /** Nombre accesible de la lista. */
  listLabel: string
  /** Nombre accesible de la vista previa. */
  detailLabel: string
  /** Búsqueda y filtros: viven fuera de la lista para conservarse al volver desde el detalle. */
  toolbar?: ReactNode
  /** Encabezado de grupo de cada registro (por ejemplo, la letra inicial). Los registros llegan ordenados. */
  getGroup?: (item: T) => string
  emptyDetail?: ReactNode
  emptyList?: ReactNode
  backLabel?: string
}

/**
 * Maestro y detalle (PPF-11): la lista agrupada a la izquierda y la vista previa del registro
 * elegido a la derecha. En teléfono se muestran una después de la otra, con una acción para
 * volver a la lista. La selección se marca con fondo suave, barra de acento y `aria-current`.
 */
export function MasterDetail<T>({
  items,
  getKey,
  selectedKey,
  onSelect,
  renderItem,
  renderDetail,
  listLabel,
  detailLabel,
  toolbar,
  getGroup,
  emptyDetail = 'Elija un registro de la lista para ver su detalle.',
  emptyList = 'No hay registros que coincidan.',
  backLabel = 'Volver a la lista',
}: MasterDetailProps<T>) {
  const phone = usePhone()
  const [detailOpen, setDetailOpen] = useState(false)
  const selected = items.find((item) => getKey(item) === selectedKey)
  const showDetail = !phone || (detailOpen && selected !== undefined)
  const showList = !phone || !showDetail

  let lastGroup: string | undefined

  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      {showList && (
        <section aria-label={listLabel} className="min-w-0">
          {toolbar && <div className="mb-3">{toolbar}</div>}
          {items.length === 0 ? (
            <p className="rounded-panel border border-dashed border-line-dashed p-4 text-body text-ink-muted">
              {emptyList}
            </p>
          ) : (
            <ul className="overflow-hidden rounded-panel border border-line bg-surface">
              {items.map((item) => {
                const key = getKey(item)
                const isSelected = key === selectedKey
                const group = getGroup?.(item)
                const heading = group !== undefined && group !== lastGroup
                lastGroup = group
                return (
                  <Fragment key={key}>
                    {heading && (
                      <li
                        className="bg-surface-subtle px-4 py-1.5 text-micro font-semibold tracking-wider text-ink-muted uppercase"
                        data-testid="master-detail-group"
                      >
                        {group}
                      </li>
                    )}
                    <li className="border-t border-line first:border-t-0">
                      <button
                        aria-current={isSelected ? 'true' : undefined}
                        className={`relative block min-h-11 w-full px-4 py-2.5 text-left text-body transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${isSelected ? 'bg-primary-soft before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary' : 'hover:bg-surface-subtle'}`}
                        onClick={() => {
                          onSelect(key)
                          setDetailOpen(true)
                        }}
                        type="button"
                      >
                        {renderItem(item, isSelected)}
                      </button>
                    </li>
                  </Fragment>
                )
              })}
            </ul>
          )}
        </section>
      )}
      {showDetail && (
        <section
          aria-label={detailLabel}
          className="min-w-0 rounded-card border border-line bg-surface p-5"
        >
          {phone && (
            <Button
              className="mb-4"
              onClick={() => setDetailOpen(false)}
              variant="ghost"
            >
              <CaretLeft aria-hidden="true" size={16} />
              {backLabel}
            </Button>
          )}
          {selected !== undefined ? (
            renderDetail(selected)
          ) : (
            <p className="text-body text-ink-muted">{emptyDetail}</p>
          )}
        </section>
      )}
    </div>
  )
}
