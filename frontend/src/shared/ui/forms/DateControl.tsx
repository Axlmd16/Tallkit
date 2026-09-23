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
    const densityClass = density === 'compact42' ? 'min-h-10' : 'min-h-10'

    return (
      <input
        type="date"
        className={`ui-control w-full ${radiusClass} ${densityClass} border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:border-ink-muted/60 focus:border-accent focus:shadow-[0_0_0_3px_rgb(15_107_111_/_0.18)] disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 aria-invalid:border-danger aria-invalid:bg-[#fffaf9] aria-invalid:shadow-none ${className}`}
        ref={ref}
        {...useFieldProps()}
        {...props}
      />
    )
  },
)
