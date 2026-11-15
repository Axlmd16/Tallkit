import type { ReactNode } from 'react'

/** Columna de tarjetas del inicio: título, subtítulo, contador y las tarjetas debajo. */
export function Column({
  id,
  title,
  subtitle,
  count,
  tone,
  children,
}: {
  id: string
  title: string
  subtitle: string
  /** `undefined` mientras se consulta: nunca se muestra un cero en lugar de un dato pendiente. */
  count: number | undefined
  tone: 'info' | 'danger'
  children: ReactNode
}) {
  const tones = {
    info: 'bg-accent-soft text-accent-strong',
    danger: 'bg-danger-soft text-danger',
  } as const
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-card border border-line bg-surface"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 leading-snug">
          <h2 className="text-block font-bold text-ink" id={id}>
            {title}
          </h2>
          <p className="text-label text-ink-muted">{subtitle}</p>
        </div>
        {count !== undefined && (
          <span
            className={`inline-grid h-[26px] min-w-[26px] place-items-center rounded-control px-2 text-label font-bold ${tones[tone]}`}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

/** Tarjeta de una columna: separada de la anterior por una línea fina. */
export const cardClass =
  'flex flex-col gap-2 border-t border-line px-5 py-3.5 text-ink'
