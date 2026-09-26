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
      className={`inline-flex shrink-0 items-stretch overflow-hidden rounded-chip border-[1.5px] border-ink bg-surface font-mono text-ink ${className}`}
    >
      <span
        className={`flex items-center bg-ink font-semibold tracking-[0.1em] text-surface ${compact ? 'px-1.5 text-[9px]' : 'px-[7px] text-[10px]'}`}
      >
        RUC
      </span>{' '}
      <span
        className={`tracking-[0.06em] tabular-nums ${compact ? 'px-2 py-[3px] text-[13px]' : 'px-2.5 py-[5px] text-[15px]'}`}
      >
        {ruc}
      </span>
    </span>
  )
}
