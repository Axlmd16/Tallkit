import type { StatusCause } from '../types'

/** Pendientes breves al inicio de la subsección que los resuelve, sin franjas a todo el ancho. */
export function PendingNotes({
  causes,
  tone = 'warning',
  label = 'Pendientes',
}: {
  causes: StatusCause[]
  tone?: 'warning' | 'neutral'
  label?: string
}) {
  if (causes.length === 0) return null
  return (
    <ul aria-label={label} className="list-none space-y-1 p-0 text-[13px]">
      {causes.map((cause) => (
        <li
          className={`flex items-start gap-2 ${tone === 'warning' ? 'font-medium text-warning' : 'text-ink-muted'}`}
          key={cause.code}
        >
          <span
            aria-hidden="true"
            className={`mt-[7px] size-[7px] shrink-0 rounded-full ${tone === 'warning' ? 'bg-[#c98a00]' : 'bg-line-strong'}`}
          />
          {cause.message}
        </li>
      ))}
    </ul>
  )
}
