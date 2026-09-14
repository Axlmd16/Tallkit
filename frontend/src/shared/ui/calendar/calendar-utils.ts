export const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

export const WEEKDAY_SHORT_ES = [
  'Lu',
  'Ma',
  'Mi',
  'Ju',
  'Vi',
  'Sá',
  'Do',
] as const

export function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Retorna el día de la semana para el primer día del mes dado (1..12).
 * Lunes = 0, Martes = 1, ..., Domingo = 6.
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return (day + 6) % 7
}

export function parseYearMonth(str: string): { year: number; month: number } {
  const [yStr, mStr] = str.split('-')
  const year = parseInt(yStr ?? '2026', 10)
  const month = parseInt(mStr ?? '1', 10)
  return {
    year: Number.isNaN(year) ? 2026 : year,
    month: Number.isNaN(month) ? 1 : month,
  }
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}-${pad2(month)}`
}

export function parseDate(
  str: string,
): { year: number; month: number; day: number } | null {
  if (!str) return null
  const [yStr, mStr, dStr] = str.split('-')
  const year = parseInt(yStr ?? '', 10)
  const month = parseInt(mStr ?? '', 10)
  const day = parseInt(dStr ?? '', 10)
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day))
    return null
  return { year, month, day }
}

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function shiftMonth(yearMonth: string, delta: number): string {
  const { year, month } = parseYearMonth(yearMonth)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return formatYearMonth(date.getUTCFullYear(), date.getUTCMonth() + 1)
}

export function getMonthName(month: number): string {
  return MONTH_NAMES_ES[month - 1] ?? ''
}
