import { type Icon } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'

export interface SectionNavItem {
  id: string
  label: string
  href: string
  icon?: Icon
  /** Número de registros, pendientes o estado breve; debe ser comprensible como texto. */
  indicator?: ReactNode
  /** Subsecciones; se muestran bajo el elemento actual y solo en la disposición vertical. */
  children?: SectionNavItem[]
}

export interface SectionNavProps {
  items: SectionNavItem[]
  activeId: string
  activeChildId?: string | undefined
  onSelect: (id: string) => void
  'aria-label': string
  /** Rótulo visible sobre la lista vertical. */
  title?: string
  /** `adaptive`: vertical desde 1024 px y barra horizontal por debajo. `horizontal`: siempre barra. */
  layout?: 'adaptive' | 'horizontal'
  className?: string
}

/**
 * Navegación de enlaces para secciones jerárquicas. No es una lista de pestañas
 * ARIA: marca la posición con `aria-current` y se recorre con Tab.
 */
export function SectionNav({
  items,
  activeId,
  activeChildId,
  onSelect,
  'aria-label': ariaLabel,
  title,
  layout = 'adaptive',
  className = '',
}: SectionNavProps) {
  const refs = useRef<Map<string, HTMLAnchorElement>>(new Map())
  const adaptive = layout === 'adaptive'
  const currentId = activeChildId ?? activeId

  useEffect(() => {
    const current = refs.current.get(currentId)
    if (typeof current?.scrollIntoView === 'function') {
      current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [currentId])

  function register(id: string) {
    return (element: HTMLAnchorElement | null) => {
      if (element) refs.current.set(id, element)
      else refs.current.delete(id)
    }
  }

  function select(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
      return
    event.preventDefault()
    onSelect(id)
  }

  const focusRing =
    'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'

  const itemBase = adaptive
    ? 'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm lg:gap-3 lg:border-b-0 lg:pr-4 lg:pl-5 lg:whitespace-normal'
    : 'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm'
  const itemCurrent = adaptive
    ? 'border-accent font-semibold text-accent-strong lg:bg-accent-soft lg:shadow-[inset_3px_0_0_var(--color-accent)]'
    : 'border-accent font-semibold text-accent-strong'
  // Con subsecciones visibles, la marca pasa a la subsección actual.
  const itemExpanded = adaptive
    ? 'border-accent font-semibold text-accent-strong lg:text-ink'
    : itemCurrent
  const itemIdle = adaptive
    ? 'border-transparent text-ink-muted hover:text-ink lg:text-ink lg:hover:bg-surface-subtle'
    : 'border-transparent text-ink-muted hover:text-ink'

  return (
    <nav aria-label={ariaLabel} className={className}>
      {title && (
        <p
          className={`hidden px-5 pb-2.5 text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase ${adaptive ? 'lg:block' : ''}`}
        >
          {title}
        </p>
      )}
      <ul
        className={`relative flex list-none overflow-x-auto p-0 ${adaptive ? 'lg:flex-col lg:overflow-visible' : ''}`}
      >
        {items.map((item) => {
          const current = item.id === activeId
          const ItemIcon = item.icon
          const showChildren = current && item.children?.length
          return (
            <li className="shrink-0" key={item.id}>
              <a
                aria-current={current ? 'page' : undefined}
                className={`${itemBase} ${focusRing} ${current ? (showChildren ? itemExpanded : itemCurrent) : itemIdle}`}
                href={item.href}
                onClick={(event) => select(event, item.id)}
                ref={register(item.id)}
              >
                {ItemIcon && (
                  <ItemIcon
                    aria-hidden="true"
                    className={`hidden shrink-0 ${adaptive ? 'lg:block' : ''} ${current ? 'text-accent' : 'text-ink-muted'}`}
                    size={18}
                  />
                )}
                <span>{item.label}</span>
                {item.indicator !== undefined && (
                  <span className="ml-auto shrink-0 pl-2 text-xs font-normal whitespace-nowrap text-ink-muted">
                    {item.indicator}
                  </span>
                )}
              </a>
              {showChildren && (
                <ul
                  className={`hidden list-none p-0 ${adaptive ? 'lg:block' : ''}`}
                >
                  {item.children!.map((child) => {
                    const childCurrent = child.id === activeChildId
                    return (
                      <li key={child.id}>
                        <a
                          aria-current={childCurrent ? 'page' : undefined}
                          className={`flex min-h-10 items-center gap-2.5 pr-5 pl-[50px] text-[13px] pointer-coarse:min-h-11 ${focusRing} ${childCurrent ? 'bg-accent-soft font-semibold text-accent-strong shadow-[inset_3px_0_0_var(--color-accent)]' : 'text-ink-muted hover:bg-surface-subtle hover:text-ink'}`}
                          href={child.href}
                          onClick={(event) => select(event, child.id)}
                          ref={register(child.id)}
                        >
                          <span>{child.label}</span>
                          {child.indicator !== undefined && (
                            <span className="ml-auto shrink-0 pl-2 text-xs font-normal whitespace-nowrap">
                              {child.indicator}
                            </span>
                          )}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
