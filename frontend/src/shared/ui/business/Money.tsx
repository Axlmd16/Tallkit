export interface MoneyProps {
  amount: string | null | undefined
  className?: string
  currency?: 'USD'
}

function formatExactDecimal(value: string): string | null {
  const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const [, sign = '', rawWhole = '0', rawFraction = ''] = match
  const whole = rawWhole.replace(/^0+(?=\d)/, '')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}.${rawFraction.padEnd(2, '0')}`
}

/** Texto del importe con moneda, o `null` si el valor no es un decimal válido. */
export function formatMoney(
  amount: string | null | undefined,
  currency: 'USD' = 'USD',
): string | null {
  const formatted = amount == null ? null : formatExactDecimal(amount)
  return formatted ? `${currency} ${formatted}` : null
}

export function Money({
  amount,
  className = '',
  currency = 'USD',
}: MoneyProps) {
  const formatted = formatMoney(amount, currency)
  return (
    <span
      className={`inline-block text-right whitespace-nowrap tabular-nums ${className}`}
    >
      {formatted ?? '—'}
    </span>
  )
}
