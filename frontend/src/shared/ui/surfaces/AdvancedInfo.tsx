import { CaretRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

/** Datos técnicos plegados por defecto; siguen en el documento y se muestran al desplegar. */
export function AdvancedInfo({
  children,
  hint,
}: {
  children: ReactNode
  hint?: string
}) {
  return (
    <details className="group text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <CaretRight
          aria-hidden="true"
          className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
          size={14}
          weight="bold"
        />
        Información avanzada
        {hint && <span className="font-normal text-ink-muted">· {hint}</span>}
      </summary>
      <div className="space-y-1 pb-2 pl-[22px] text-[13px] text-ink-muted">
        {children}
      </div>
    </details>
  )
}
