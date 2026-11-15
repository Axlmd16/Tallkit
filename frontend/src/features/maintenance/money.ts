/**
 * Suma exacta de importes decimales con hasta dos decimales, solo para mostrar un total
 * informativo en pantalla. No reemplaza al servidor: cada documento se cobra por separado con
 * el importe que él calcula. Devuelve `null` si algún valor no es un decimal exacto.
 */
export function sumMoney(
  ...values: readonly (string | null | undefined)[]
): string | null {
  let cents = 0n
  for (const value of values) {
    if (value == null || value === '') continue
    const match = value.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/)
    if (!match) return null
    const [, sign = '', whole = '0', fraction = ''] = match
    const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
    cents += sign === '-' ? -amount : amount
  }
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  const text = `${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`
  return negative ? `-${text}` : text
}
