import { Link } from 'react-router'

import type { QuickAction } from '@/features/home/quickActions'

const iconTones = {
  commercial: 'text-scope-commercial',
  artesanal: 'text-scope-artisan',
} as const

/**
 * Accesos a las operaciones más frecuentes. Son acciones secundarias: ninguna usa el relleno
 * de la acción principal, porque aquí no hay una sola acción que domine la página.
 */
export function QuickActionsBlock({
  actions,
}: {
  actions: readonly QuickAction[]
}) {
  if (actions.length === 0) return null
  return (
    <nav aria-label="Acciones rápidas">
      <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <li key={action.id}>
              <Link
                className="ui-button group flex min-h-11 w-full items-center gap-2 rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] font-semibold text-ink transition-[background-color,border-color,color] duration-150 hover:border-accent/50 hover:bg-accent-soft hover:text-accent-strong"
                to={action.to}
              >
                <Icon
                  aria-hidden="true"
                  className={`shrink-0 ${action.scope ? iconTones[action.scope] : 'text-accent'}`}
                  size={18}
                  weight="bold"
                />
                {action.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
