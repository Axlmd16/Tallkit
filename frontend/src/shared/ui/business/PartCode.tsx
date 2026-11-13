import { Check, Copy } from '@phosphor-icons/react'
import { useState } from 'react'

export interface PartCodeProps {
  code: string
  className?: string
}

export function PartCode({ code, className = '' }: PartCodeProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
  }

  return (
    <span
      className={`inline-flex min-h-7 items-center overflow-hidden rounded-chip bg-surface-muted code text-label font-semibold text-ink ${className}`}
    >
      <span className="px-2">{code}</span>
      <button
        aria-label={`Copiar código ${code}`}
        className="grid size-7 place-items-center border-l border-line-strong text-ink-muted hover:bg-line hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        onClick={() => void copy()}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" size={14} />
        ) : (
          <Copy aria-hidden="true" size={14} />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Código copiado' : ''}
      </span>
    </span>
  )
}
