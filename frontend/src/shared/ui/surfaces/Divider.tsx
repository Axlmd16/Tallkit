import type { ReactNode } from 'react'

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  label?: string
  children?: ReactNode
  className?: string
}

export function Divider({
  orientation = 'horizontal',
  label,
  children,
  className = '',
}: DividerProps) {
  const content = label ?? children

  if (orientation === 'vertical') {
    return (
      <div
        aria-orientation="vertical"
        className={`inline-block w-px self-stretch bg-line mx-2 ${className}`}
        role="separator"
      />
    )
  }

  if (content) {
    return (
      <div
        aria-orientation="horizontal"
        className={`flex items-center gap-4 my-4 w-full ${className}`}
        role="separator"
      >
        <div className="flex-1 border-t border-line" />
        <span className="text-xs font-semibold text-ink-muted shrink-0">
          {content}
        </span>
        <div className="flex-1 border-t border-line" />
      </div>
    )
  }

  return (
    <hr
      className={`w-full border-t border-line my-4 ${className}`}
      role="separator"
    />
  )
}
