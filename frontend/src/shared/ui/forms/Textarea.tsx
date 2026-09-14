import { forwardRef, type TextareaHTMLAttributes } from 'react'

import { useFieldProps, type ControlRadius } from '@/shared/ui/controls'

export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both'

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  radius?: ControlRadius
  resize?: TextareaResize
}

const resizeClasses: Record<TextareaResize, string> = {
  both: 'resize',
  horizontal: 'resize-x',
  none: 'resize-none',
  vertical: 'resize-y',
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { className = '', radius = 'r10', resize = 'vertical', rows = 4, ...props },
    ref,
  ) {
    const radiusClass = radius === 'r5' ? 'rounded-control' : 'rounded-group'
    const resizeClass = resizeClasses[resize]

    return (
      <textarea
        className={`ui-control min-h-[96px] w-full ${radiusClass} ${resizeClass} border border-transparent bg-surface-muted px-4 py-2.5 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:bg-surface-selected/50 focus:border-primary/35 focus:bg-surface focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-danger/45 aria-invalid:bg-danger-soft aria-invalid:shadow-[0_0_0_3px_rgb(209_26_42_/_0.08)] ${className}`}
        ref={ref}
        rows={rows}
        {...useFieldProps()}
        {...props}
      />
    )
  },
)
