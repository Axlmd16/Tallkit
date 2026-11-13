export interface RucPlateProps {
  ruc: string
  className?: string
  size?: 'sm' | 'md'
}

/** Placa fiscal: etiqueta «RUC» diferenciada y los 13 dígitos sin separadores. */
export function RucPlate({ ruc, className = '', size = 'md' }: RucPlateProps) {
  const compact = size === 'sm'

  return (
    <span
      className={`inline-flex shrink-0 items-stretch overflow-hidden rounded-chip border border-ink bg-surface code text-ink ${className}`}
    >
      <span
        className={`flex items-center bg-ink font-semibold tracking-[0.1em] text-surface ${compact ? 'px-1.5 text-micro' : 'px-[7px] text-micro'}`}
      >
        RUC
      </span>{' '}
      <span
        className={`tabular-nums ${compact ? 'px-2 py-[3px] text-body' : 'px-2.5 py-[5px] text-lead'}`}
      >
        {ruc}
      </span>
    </span>
  )
}
