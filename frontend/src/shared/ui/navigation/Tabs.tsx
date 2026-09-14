import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

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
}: TabsProps) {
  const autoId = useId()
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const enabledItems = items.filter((item) => !item.disabled)
  const activeItem = items.find((item) => item.id === activeId)

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
        className={`flex items-center gap-2 border-b border-border-subtle ${
          variant === 'pill'
            ? 'border-b-0 gap-1 bg-surface-muted p-1 rounded-group'
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
                ? 'border-b-2 border-primary text-primary font-semibold'
                : 'border-b-2 border-transparent text-ink-muted hover:text-ink hover:border-border'
              : isSelected
                ? 'bg-surface text-ink shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-surface-selected/30'

          return (
            <button
              aria-controls={panelId}
              aria-selected={isSelected ? 'true' : 'false'}
              className={`min-h-[40px] px-4 py-2 text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2 ${
                variant === 'pill' ? 'rounded-control' : ''
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
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isSelected
                      ? 'bg-surface-selected text-ink'
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

      {activeItem?.content !== undefined && (
        <div
          aria-labelledby={`tab-${autoId}-${activeItem.id}`}
          className={`mt-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-control ${panelClassName}`}
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
