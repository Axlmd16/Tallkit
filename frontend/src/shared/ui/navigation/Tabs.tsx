import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export type TabsVariant = 'line' | 'pill'

export interface TabItem {
  id: string
  label: string
  content?: ReactNode
  disabled?: boolean
  count?: number
}

export interface TabsProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  variant?: TabsVariant
  'aria-label'?: string
  className?: string
  tabListClassName?: string
  panelClassName?: string
  /** Mantiene montados todos los paneles; los inactivos quedan ocultos y conservan su estado. */
  keepMounted?: boolean
}

export function Tabs({
  items,
  activeId,
  onChange,
  variant = 'line',
  'aria-label': ariaLabel,
  className = '',
  tabListClassName = '',
  panelClassName = '',
  keepMounted = false,
}: TabsProps) {
  const autoId = useId()
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const enabledItems = items.filter((item) => !item.disabled)
  const activeItem = items.find((item) => item.id === activeId)

  useEffect(() => {
    const active = tabRefs.current.get(activeId)
    if (typeof active?.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [activeId])

  function focusAndSelect(targetId: string) {
    onChange(targetId)
    const btn = tabRefs.current.get(targetId)
    btn?.focus()
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      e.preventDefault()
    } else {
      return
    }

    const currentItem = items[currentIndex]
    if (!currentItem) return

    const enabledIndex = enabledItems.findIndex(
      (item) => item.id === currentItem.id,
    )
    if (enabledIndex === -1 && enabledItems.length > 0) {
      const first = enabledItems[0]
      if (first) focusAndSelect(first.id)
      return
    }

    if (e.key === 'ArrowRight') {
      const nextIndex = (enabledIndex + 1) % enabledItems.length
      const nextItem = enabledItems[nextIndex]
      if (nextItem) focusAndSelect(nextItem.id)
    } else if (e.key === 'ArrowLeft') {
      const prevIndex =
        (enabledIndex - 1 + enabledItems.length) % enabledItems.length
      const prevItem = enabledItems[prevIndex]
      if (prevItem) focusAndSelect(prevItem.id)
    } else if (e.key === 'Home') {
      const firstItem = enabledItems[0]
      if (firstItem) focusAndSelect(firstItem.id)
    } else if (e.key === 'End') {
      const lastItem = enabledItems[enabledItems.length - 1]
      if (lastItem) focusAndSelect(lastItem.id)
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={`flex items-center gap-2 overflow-x-auto border-b border-line ${
          variant === 'pill'
            ? 'border-b-0 gap-0.5 bg-surface-muted p-[3px] rounded-control'
            : ''
        } ${tabListClassName}`}
        role="tablist"
      >
        {items.map((item, index) => {
          const isSelected = item.id === activeId
          const tabId = `tab-${autoId}-${item.id}`
          const panelId = `panel-${autoId}-${item.id}`

          const styleClasses =
            variant === 'line'
              ? isSelected
                ? 'border-b-2 border-accent text-accent-strong font-semibold'
                : 'border-b-2 border-transparent text-ink-muted hover:text-ink hover:border-line'
              : isSelected
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(21_35_58_/_0.12)] font-semibold'
                : 'text-ink-muted hover:text-ink'

          return (
            <button
              aria-controls={
                (keepMounted || isSelected) && item.content !== undefined
                  ? panelId
                  : undefined
              }
              aria-selected={isSelected ? 'true' : 'false'}
              className={`min-h-10 shrink-0 whitespace-nowrap px-3.5 py-2 text-[13.5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2 ${
                variant === 'pill' ? 'rounded-[4px] min-h-8' : ''
              } ${styleClasses}`}
              disabled={item.disabled}
              id={tabId}
              key={item.id}
              onClick={() => {
                if (!item.disabled && item.id !== activeId) {
                  onChange(item.id)
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(item.id, el)
                } else {
                  tabRefs.current.delete(item.id)
                }
              }}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span
                  className={`rounded-chip px-1.5 py-0.5 text-xs font-semibold ${
                    isSelected
                      ? 'bg-accent-soft text-accent-strong'
                      : 'bg-surface-muted text-ink-muted'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {keepMounted
        ? items.map((item) =>
            item.content === undefined ? null : (
              <div
                aria-labelledby={`tab-${autoId}-${item.id}`}
                className={`mt-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-control ${panelClassName}`}
                hidden={item.id !== activeId}
                id={`panel-${autoId}-${item.id}`}
                key={item.id}
                role="tabpanel"
                tabIndex={0}
              >
                {item.content}
              </div>
            ),
          )
        : activeItem?.content !== undefined && (
            <div
              aria-labelledby={`tab-${autoId}-${activeItem.id}`}
              className={`mt-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-control ${panelClassName}`}
              id={`panel-${autoId}-${activeItem.id}`}
              role="tabpanel"
              tabIndex={0}
            >
              {activeItem.content}
            </div>
          )}
    </div>
  )
}
