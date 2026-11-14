/**
 * Escribe una tarifa de impuesto sin ceros sobrantes: «0.0000» → «0», «15.0000» → «15»,
 * «12.5000» → «12.5». Solo cambia la presentación; el valor guardado no se toca.
 * Devuelve `null` si no hay tarifa o no es un decimal válido.
 */
export function trimRate(
  rate: string | number | null | undefined,
): string | null {
  if (rate === null || rate === undefined) return null
  const text = String(rate).trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

/** Tarifa lista para mostrar con su signo: «0 %», «15 %». */
export function formatRate(
  rate: string | number | null | undefined,
): string | null {
  const trimmed = trimRate(rate)
  return trimmed === null ? null : `${trimmed} %`
}
