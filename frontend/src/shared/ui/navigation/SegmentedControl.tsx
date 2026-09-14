import { useId, useRef, type KeyboardEvent } from 'react'

export type SegmentedControlAccent = 'violet' | 'coral'

export interface SegmentedControlOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  accent?: SegmentedControlAccent
  'aria-label'?: string
  className?: string
  name?: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  accent = 'violet',
  'aria-label': ariaLabel,
  className = '',
  name,
}: SegmentedControlProps) {
  const autoId = useId()
  const groupName = name || `segmented-${autoId}`
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const enabledOptions = options.filter((o) => !o.disabled)

  function focusAndSelect(targetValue: string) {
    onChange(targetValue)
    const btn = buttonRefs.current.get(targetValue)
    btn?.focus()
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (
      [
        'ArrowRight',
        'ArrowDown',
        'ArrowLeft',
        'ArrowUp',
        'Home',
        'End',
      ].includes(e.key)
    ) {
      e.preventDefault()
    } else {
      return
    }

    const currentOpt = options[currentIndex]
    if (!currentOpt) return

    const enabledIndex = enabledOptions.findIndex(
      (o) => o.value === currentOpt.value,
    )
    if (enabledIndex === -1 && enabledOptions.length > 0) {
      const first = enabledOptions[0]
      if (first) focusAndSelect(first.value)
      return
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const nextIndex = (enabledIndex + 1) % enabledOptions.length
      const nextOpt = enabledOptions[nextIndex]
      if (nextOpt) focusAndSelect(nextOpt.value)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const prevIndex =
        (enabledIndex - 1 + enabledOptions.length) % enabledOptions.length
      const prevOpt = enabledOptions[prevIndex]
      if (prevOpt) focusAndSelect(prevOpt.value)
    } else if (e.key === 'Home') {
      const firstOpt = enabledOptions[0]
      if (firstOpt) focusAndSelect(firstOpt.value)
    } else if (e.key === 'End') {
      const lastOpt = enabledOptions[enabledOptions.length - 1]
      if (lastOpt) focusAndSelect(lastOpt.value)
    }
  }

  const activeStyles =
    accent === 'coral'
      ? 'bg-warning text-white shadow-sm'
      : 'bg-primary text-white shadow-sm'

  return (
    <div
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-group bg-surface-muted p-1 border border-border-subtle ${className}`}
      role="radiogroup"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value
        return (
          <button
            aria-checked={isSelected ? 'true' : 'false'}
            className={`min-h-[36px] rounded-control px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
              isSelected
                ? activeStyles
                : 'text-ink-muted hover:bg-surface-selected/40 hover:text-ink'
            }`}
            disabled={option.disabled}
            id={`${groupName}-${option.value}`}
            key={option.value}
            onClick={() => {
              if (!option.disabled && option.value !== value) {
                onChange(option.value)
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            ref={(el) => {
              if (el) {
                buttonRefs.current.set(option.value, el)
              } else {
                buttonRefs.current.delete(option.value)
              }
            }}
            role="radio"
            tabIndex={isSelected ? 0 : -1}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
