export interface StockIndicatorProps {
  quantity: string | number
  className?: string
}

function isZero(quantity: string | number) {
  return /^[-+]?0+(?:\.0+)?$/.test(String(quantity).trim())
}

/**
 * Existencias en un marcador de tinta con la cantidad; en rojo suave y con el texto «Agotado»
 * cuando es cero. No clasifica una cantidad como baja: ese umbral no está decidido (`RF-INV-011`).
 */
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
      className={`inline-flex items-center gap-1.5 text-body font-medium ${exhausted ? 'text-danger' : 'text-ink'} ${className}`}
    >
      {exhausted && <span>Agotado</span>}
      {exhausted && <span aria-hidden="true">·</span>}
      <span
        className={`code inline-flex min-w-8 justify-center rounded-chip px-2 py-0.5 text-label font-semibold ${exhausted ? 'bg-danger-soft text-danger' : 'bg-ink text-white'}`}
      >
        {quantity}
      </span>
    </span>
  )
}
