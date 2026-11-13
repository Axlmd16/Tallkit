import { useId, useRef, type KeyboardEvent } from 'react'

export type SegmentedControlAccent = 'violet' | 'coral'

export interface SegmentedControlOption {
  value: string
  label: string
  /** Contador opcional de registros de la opción, junto a su etiqueta. */
  count?: number
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
      ? 'bg-surface text-warning shadow-[0_1px_2px_rgb(30_34_38_/_0.12)]'
      : 'bg-surface text-ink shadow-[0_1px_2px_rgb(30_34_38_/_0.12)]'

  return (
    <div
      aria-label={ariaLabel}
      className={`inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-workspace p-[3px] ${className}`}
      role="radiogroup"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value
        return (
          <button
            aria-checked={isSelected ? 'true' : 'false'}
            className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1 text-label font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
              isSelected ? activeStyles : 'text-ink-muted hover:text-ink'
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
            {option.count !== undefined && (
              <span
                className={`code rounded-full px-1.5 text-micro ${isSelected ? 'bg-surface-muted text-ink' : 'bg-surface/70 text-ink-muted'}`}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
