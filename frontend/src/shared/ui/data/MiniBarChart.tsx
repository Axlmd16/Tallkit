import { formatMoney, Money } from '../business/Money'
import { ScopeLabel, type ScopeLabelScope } from '../business/ScopeLabel'
import { Tooltip } from '../overlays/Tooltip'

export interface MiniBarChartDay {
  /** Fecha del negocio en formato AAAA-MM-DD. */
  date: string
  /** Importe decimal exacto que entrega el servidor. */
  amount: string
}

export interface MiniBarChartProps {
  title: string
  scope: ScopeLabelScope
  days: readonly MiniBarChartDay[]
  /** Total de la serie; `null` cuando no hay dato. */
  total: string | null
  /** Oculta el título a la vista cuando el panel que lo contiene ya lo muestra. */
  hideTitle?: boolean | undefined
}

const scopeNames: Record<ScopeLabelScope, string> = {
  commercial: 'RUC comercial',
  artesanal: 'RUC artesanal',
}

const tones: Record<ScopeLabelScope, string> = {
  commercial: 'bg-scope-commercial',
  artesanal: 'bg-scope-artisan',
}

const longDate = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
})
const narrowDay = new Intl.DateTimeFormat('es-EC', { weekday: 'narrow' })

/** La fecha llega como día del negocio: se interpreta en local para no desplazarla. */
function parseDay(date: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function describeDay(date: Date): string {
  const parts = Object.fromEntries(
    longDate.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return `${parts.weekday} ${parts.day} de ${parts.month}`
}

/**
 * Gráfico breve: una serie corta de barras de un solo ámbito fiscal, con su total. Solo
 * representa valores ya calculados por el servidor; la altura de cada barra es una proporción
 * visual y cada valor se lee también como texto.
 */
export function MiniBarChart({
  title,
  scope,
  days,
  total,
  hideTitle = false,
}: MiniBarChartProps) {
  const heights = days.map((day) => Number(day.amount))
  const highest = Math.max(0, ...heights)

  return (
    <div
      aria-label={`${title}, ${scopeNames[scope]}`}
      className="flex flex-col gap-3 px-4 py-3.5"
      role="group"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1">
          <ScopeLabel scope={scope} />
          {!hideTitle && (
            <span className="text-[13px] font-medium text-ink">{title}</span>
          )}
        </div>
        {total !== null && (
          <Money
            amount={total}
            className="text-[20px] leading-7 font-bold text-ink"
          />
        )}
      </div>
      {days.length === 0 ? (
        <p className="grid h-24 place-items-center text-[13px] text-ink-muted">
          Sin datos
        </p>
      ) : (
        <ol className="flex h-24 items-stretch gap-1.5 sm:gap-2.5">
          {days.map((day, index) => {
            const date = parseDay(day.date)
            const label = describeDay(date)
            const value = heights[index] ?? 0
            const isZero = value === 0
            return (
              <li
                className="flex min-w-0 flex-1 flex-col items-stretch gap-1"
                key={day.date}
              >
                <Tooltip
                  className="min-h-0 w-full flex-1 !items-end"
                  content={`${label} · ${formatMoney(day.amount) ?? '—'}`}
                >
                  <span
                    aria-label={`${label}: ${formatMoney(day.amount) ?? '—'}`}
                    className="flex h-full w-full cursor-default items-end rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    role="img"
                    tabIndex={0}
                  >
                    <span
                      className={`block w-full rounded-t-[3px] transition-[height] duration-200 motion-reduce:transition-none ${
                        isZero ? 'h-0.5 bg-line-strong' : tones[scope]
                      }`}
                      data-bar=""
                      data-zero={isZero || undefined}
                      style={
                        isZero
                          ? undefined
                          : {
                              height: `${Math.max(4, Math.round((value / highest) * 100))}%`,
                            }
                      }
                    />
                  </span>
                </Tooltip>
                <span
                  aria-hidden="true"
                  className="text-center text-[11px] font-medium text-ink-muted uppercase"
                >
                  {narrowDay.format(date)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
