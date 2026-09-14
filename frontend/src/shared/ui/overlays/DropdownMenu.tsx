import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

export interface DropdownMenuItem {
  id: string
  label: string
  onClick?: () => void
  icon?: ReactNode
  destructive?: boolean
  disabled?: boolean
  divider?: boolean
}

export interface DropdownMenuProps {
  trigger: ReactElement
  items: DropdownMenuItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'left' | 'right'
  className?: string
}

export function DropdownMenu({
  trigger,
  items,
  open,
  onOpenChange,
  align = 'right',
  className = '',
}: DropdownMenuProps) {
  const autoId = useId()
  const triggerId = `menu-trigger-${autoId}`
  const menuId = `menu-${autoId}`

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = typeof open === 'boolean'
  const isOpen = isControlled ? open : uncontrolledOpen

  const triggerRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const enabledItems = items.filter((item) => !item.disabled && !item.divider)

  const setMenuOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange],
  )

  const focusItem = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const btn = itemRefs.current.get(id)
      btn?.focus()
    })
  }, [])

  const focusFirst = useCallback(() => {
    const first = enabledItems[0]
    if (first) focusItem(first.id)
  }, [enabledItems, focusItem])

  const focusLast = useCallback(() => {
    const last = enabledItems[enabledItems.length - 1]
    if (last) focusItem(last.id)
  }, [enabledItems, focusItem])

  const closeAndFocusTrigger = useCallback(() => {
    setMenuOpen(false)
    triggerRef.current?.focus()
  }, [setMenuOpen])

  // Cierre por outside click
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(
      e: globalThis.MouseEvent | globalThis.PointerEvent,
    ) {
      const target = e.target as Node | null
      if (!target) return
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, setMenuOpen])

  function handleTriggerClick(e: MouseEvent) {
    const childProps = (
      trigger as unknown as { props?: { onClick?: (e: MouseEvent) => void } }
    ).props
    childProps?.onClick?.(e)

    if (isOpen) {
      setMenuOpen(false)
    } else {
      setMenuOpen(true)
      focusFirst()
    }
  }

  function handleTriggerKeyDown(e: KeyboardEvent) {
    const childProps = (
      trigger as unknown as {
        props?: { onKeyDown?: (e: KeyboardEvent) => void }
      }
    ).props
    childProps?.onKeyDown?.(e)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMenuOpen(true)
      focusFirst()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMenuOpen(true)
      focusLast()
    }
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeAndFocusTrigger()
      return
    }

    if (e.key === 'Tab') {
      setMenuOpen(false)
      return
    }

    const activeEl = document.activeElement as HTMLElement | null
    const currentId = activeEl?.getAttribute('data-item-id')
    const currentIndex = enabledItems.findIndex((item) => item.id === currentId)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % enabledItems.length
      const nextItem = enabledItems[nextIndex]
      if (nextItem) focusItem(nextItem.id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex =
        (currentIndex - 1 + enabledItems.length) % enabledItems.length
      const prevItem = enabledItems[prevIndex]
      if (prevItem) focusItem(prevItem.id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusFirst()
    } else if (e.key === 'End') {
      e.preventDefault()
      focusLast()
    }
  }

  if (!isValidElement(trigger)) {
    return null
  }

  const clonedTrigger = cloneElement(trigger, {
    'aria-controls': isOpen ? menuId : undefined,
    'aria-expanded': isOpen ? 'true' : 'false',
    'aria-haspopup': 'menu',
    id: triggerId,
    onClick: handleTriggerClick,
    onKeyDown: handleTriggerKeyDown,
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el
      const existingRef = (
        trigger as unknown as { ref?: (el: HTMLElement | null) => void }
      ).ref
      if (typeof existingRef === 'function') {
        existingRef(el)
      }
    },
  } as Record<string, unknown>)

  const alignmentClass = align === 'left' ? 'left-0' : 'right-0'

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {clonedTrigger}

      {isOpen && (
        <div
          aria-labelledby={triggerId}
          className={`absolute z-50 mt-1.5 min-w-[180px] rounded-group border border-border-subtle bg-surface p-1 shadow-card outline-none ${alignmentClass}`}
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
          tabIndex={-1}
        >
          {items.map((item) => {
            if (item.divider) {
              return (
                <div
                  className="my-1 border-t border-border-subtle"
                  key={item.id}
                  role="separator"
                />
              )
            }

            const isDestructive = item.destructive
            const itemClasses = isDestructive
              ? 'text-danger hover:bg-danger-soft/40 focus:bg-danger-soft/40'
              : 'text-ink hover:bg-surface-selected/60 focus:bg-surface-selected/60'

            return (
              <button
                className={`flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${itemClasses}`}
                data-item-id={item.id}
                disabled={item.disabled}
                id={`item-${autoId}-${item.id}`}
                key={item.id}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick?.()
                    closeAndFocusTrigger()
                  }
                }}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(item.id, el)
                  } else {
                    itemRefs.current.delete(item.id)
                  }
                }}
                role="menuitem"
                tabIndex={-1}
                type="button"
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
