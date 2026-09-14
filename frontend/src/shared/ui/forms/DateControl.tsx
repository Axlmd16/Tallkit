import { forwardRef, type InputHTMLAttributes } from 'react'

import {
  useFieldProps,
  type ControlDensity,
  type ControlRadius,
} from '@/shared/ui/controls'

export interface DateControlProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  radius?: ControlRadius
  density?: ControlDensity
}

export const DateControl = forwardRef<HTMLInputElement, DateControlProps>(
  function DateControl(
    { className = '', radius = 'r5', density = 'compact42', ...props },
    ref,
  ) {
    const radiusClass = radius === 'r10' ? 'rounded-group' : 'rounded-control'
    const densityClass =
      density === 'compact42' ? 'min-h-[42px]' : 'min-h-[50px]'

    return (
      <input
        type="date"
        className={`ui-control w-full ${radiusClass} ${densityClass} border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:bg-surface-selected/50 focus:border-primary/35 focus:bg-surface focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-danger/45 aria-invalid:bg-danger-soft aria-invalid:shadow-[0_0_0_3px_rgb(209_26_42_/_0.08)] ${className}`}
        ref={ref}
        {...useFieldProps()}
        {...props}
      />
    )
  },
)
