export interface GaugeMotifProps {
  /**
   * `rail` es el tacómetro del pie de la barra lateral; `card` es la versión de las tarjetas
   * oscuras, más tenue y recortada contra una esquina.
   */
  variant?: 'rail' | 'card'
  className?: string
}

const TICKS = Array.from({ length: 11 }, (_, index) => index)

/**
 * Motivo gráfico propio de Tallkit: un tacómetro en líneas finas con un arco y una aguja de
 * cobre. Es solo decorativo: no recibe foco, no se lee y no intercepta el puntero.
 */
export function GaugeMotif({
  variant = 'rail',
  className = '',
}: GaugeMotifProps) {
  const card = variant === 'card'
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none select-none ${card ? 'opacity-70' : ''} ${className}`.trim()}
      data-variant={variant}
      fill="none"
      focusable="false"
      viewBox="0 0 120 72"
    >
      <path
        d="M10 64a50 50 0 0 1 100 0"
        stroke="var(--color-graphite-line)"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M10 64a50 50 0 0 1 72.6-44.6"
        stroke="var(--color-primary)"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      {TICKS.map((index) => {
        const angle = Math.PI - (index / 10) * Math.PI
        const inner = index % 5 === 0 ? 40 : 44
        return (
          <line
            key={index}
            stroke="var(--color-graphite-ink)"
            strokeLinecap="round"
            strokeOpacity={index % 5 === 0 ? 0.7 : 0.35}
            strokeWidth="1.25"
            x1={60 + Math.cos(angle) * inner}
            x2={60 + Math.cos(angle) * 47}
            y1={64 - Math.sin(angle) * inner}
            y2={64 - Math.sin(angle) * 47}
          />
        )
      })}
      <line
        stroke="var(--color-primary)"
        strokeLinecap="round"
        strokeWidth="2"
        x1="60"
        x2="86"
        y1="64"
        y2="34"
      />
      <circle
        cx="60"
        cy="64"
        fill="var(--color-graphite)"
        r="4"
        stroke="var(--color-primary)"
        strokeWidth="2"
      />
    </svg>
  )
}
