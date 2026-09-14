import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  children: ReactElement
  content: ReactNode
  position?: TooltipPosition
  open?: boolean
  disabled?: boolean
  id?: string
  className?: string
}

const positionClasses: Record<TooltipPosition, string> = {
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
}

export function Tooltip({
  children,
  content,
  position = 'top',
  open,
  disabled = false,
  id,
  className = '',
}: TooltipProps) {
  const autoId = useId()
  const tooltipId = id || `tooltip-${autoId}`

  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const isVisible =
    open ?? (!disabled && !isDismissed && (isHovered || isFocused))

  function handleMouseEnter(e: MouseEvent) {
    setIsDismissed(false)
    setIsHovered(true)
    // Invocar handler original del hijo si existe
    const childProps = (
      children as unknown as {
        props?: { onMouseEnter?: (e: MouseEvent) => void }
      }
    ).props
    childProps?.onMouseEnter?.(e)
  }

  function handleMouseLeave(e: MouseEvent) {
    setIsHovered(false)
    setIsDismissed(false)
    const childProps = (
      children as unknown as {
        props?: { onMouseLeave?: (e: MouseEvent) => void }
      }
    ).props
    childProps?.onMouseLeave?.(e)
  }

  function handleFocus(e: FocusEvent) {
    setIsDismissed(false)
    setIsFocused(true)
    const childProps = (
      children as unknown as { props?: { onFocus?: (e: FocusEvent) => void } }
    ).props
    childProps?.onFocus?.(e)
  }

  function handleBlur(e: FocusEvent) {
    setIsFocused(false)
    setIsDismissed(false)
    const childProps = (
      children as unknown as { props?: { onBlur?: (e: FocusEvent) => void } }
    ).props
    childProps?.onBlur?.(e)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsDismissed(true)
    }
    const childProps = (
      children as unknown as {
        props?: { onKeyDown?: (e: KeyboardEvent) => void }
      }
    ).props
    childProps?.onKeyDown?.(e)
  }

  if (!isValidElement(children)) {
    return null
  }

  const existingDescribedBy = (
    children.props as { 'aria-describedby'?: string }
  )['aria-describedby']
  const ariaDescribedBy = isVisible
    ? [existingDescribedBy, tooltipId].filter(Boolean).join(' ')
    : existingDescribedBy

  const clonedTrigger = cloneElement(children, {
    'aria-describedby': ariaDescribedBy,
    onBlur: handleBlur,
    onFocus: handleFocus,
    onKeyDown: handleKeyDown,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  } as Record<string, unknown>)

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      {clonedTrigger}
      {isVisible && !disabled && (
        <span
          className={`pointer-events-none absolute z-50 rounded-control bg-ink px-2.5 py-1 text-xs font-medium text-white shadow-md whitespace-nowrap animate-in fade-in duration-100 ${positionClasses[position]}`}
          id={tooltipId}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  )
}
