export interface StockIndicatorProps {
  quantity: string | number
  className?: string
}

function isZero(quantity: string | number) {
  return /^[-+]?0+(?:\.0+)?$/.test(String(quantity).trim())
}

export function StockIndicator({
  quantity,
  className = '',
}: StockIndicatorProps) {
  const exhausted = isZero(quantity)
  return (
    <span
      aria-label={
        exhausted
          ? `Existencias: Agotado, ${quantity}`
          : `Existencias: ${quantity}`
      }
      className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${exhausted ? 'text-danger' : 'text-ink'} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`size-[7px] rounded-[2px] ${exhausted ? 'bg-danger' : 'bg-success'}`}
      />
      {exhausted && <span>Agotado</span>}
      {exhausted && <span aria-hidden="true">·</span>}
      <span className="font-mono tabular-nums">{quantity}</span>
    </span>
  )
}
