export interface ChartLegendItem {
  id: string
  label: string
  color: string
  value?: string | number | undefined
}

export interface ChartLegendProps {
  items: ChartLegendItem[]
  orientation?: 'horizontal' | 'vertical' | undefined
  label?: string | undefined
  className?: string | undefined
}

export function ChartLegend({
  className = '',
  items,
  label = 'Leyenda del gráfico',
  orientation = 'horizontal',
}: ChartLegendProps) {
  const isVertical = orientation === 'vertical'

  return (
    <ul
      aria-label={label}
      className={`text-xs text-ink flex ${
        isVertical ? 'flex-col gap-2' : 'flex-wrap items-center gap-4'
      } ${className}`.trim()}
      role="list"
    >
      {items.map((item) => (
        <li className="inline-flex items-center gap-2" key={item.id}>
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-ink-muted">{item.label}</span>
          {item.value !== undefined && (
            <span className="font-semibold text-ink font-mono">
              {item.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
