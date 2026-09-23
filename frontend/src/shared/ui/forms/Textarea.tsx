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
    { className = '', radius = 'r10', resize = 'vertical', rows = 3, ...props },
    ref,
  ) {
    const radiusClass = radius === 'r5' ? 'rounded-control' : 'rounded-group'
    const resizeClass = resizeClasses[resize]

    return (
      <textarea
        className={`ui-control min-h-[72px] w-full ${radiusClass} ${resizeClass} border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:border-ink-muted/60 focus:border-accent focus:shadow-[0_0_0_3px_rgb(15_107_111_/_0.18)] disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 aria-invalid:border-danger aria-invalid:bg-[#fffaf9] aria-invalid:shadow-none ${className}`}
        ref={ref}
        rows={rows}
        {...useFieldProps()}
        {...props}
      />
    )
  },
)
