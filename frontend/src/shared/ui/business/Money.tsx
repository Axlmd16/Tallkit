/**
 * Precisión con la que se muestra un importe: `price` (dos decimales, para precios, totales,
 * impuestos, saldos y abonos) o `cost` (hasta seis, para costos que solo ve quien ya puede verlos).
 */
export type MoneyPrecision = 'price' | 'cost'

const maxDecimals: Record<MoneyPrecision, number> = { price: 2, cost: 6 }

export interface MoneyProps {
  amount: string | null | undefined
  className?: string
  currency?: 'USD'
  precision?: MoneyPrecision
}

/**
 * Los ceros sobrantes después del segundo decimal se recortan; un decimal distinto de cero más
 * allá de la precisión admitida nunca se redondea en silencio: el valor se considera no mostrable.
 */
function formatExactDecimal(
  value: string,
  precision: MoneyPrecision,
): string | null {
  const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const [, sign = '', rawWhole = '0', rawFraction = ''] = match
  const fraction = rawFraction.replace(/0+$/, '')
  if (fraction.length > maxDecimals[precision]) return null
  const whole = rawWhole.replace(/^0+(?=\d)/, '')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}.${fraction.padEnd(2, '0')}`
}

/** Texto del importe con moneda, o `null` si el valor no es un decimal válido. */
export function formatMoney(
  amount: string | null | undefined,
  currency: 'USD' = 'USD',
  precision: MoneyPrecision = 'price',
): string | null {
  const formatted =
    amount == null ? null : formatExactDecimal(amount, precision)
  return formatted ? `${currency} ${formatted}` : null
}

export function Money({
  amount,
  className = '',
  currency = 'USD',
  precision = 'price',
}: MoneyProps) {
  const formatted = formatMoney(amount, currency, precision)
  return (
    <span
      className={`inline-block text-right whitespace-nowrap tabular-nums ${className}`}
    >
      {formatted ?? '—'}
    </span>
  )
}
