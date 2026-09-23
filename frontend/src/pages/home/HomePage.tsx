import { ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router'

import { visibleGroups } from '@/app/navigation'
import { useSession } from '@/features/auth/hooks'
import { roleLabels } from '@/features/auth/types'
import { EmptyState, PageHeader } from '@/shared/ui'

/**
 * Inicio: identidad de la sesión y accesos a las áreas que autorizan sus permisos. No
 * muestra indicadores: ninguno tiene todavía un dato del servidor que lo respalde.
 */
export function HomePage() {
  const session = useSession().data
  const groups = visibleGroups(new Set(session?.permissions ?? []))
  const roles = (session?.roles ?? []).map((role) => roleLabels[role])

  return (
    <div className="space-y-4">
      <PageHeader
        {...(session?.username
          ? {
              description: `Sesión de ${session.username}${roles.length > 0 ? ` · ${roles.join(' · ')}` : ''}.`,
            }
          : {})}
        title="Inicio"
      />
      {groups.length === 0 ? (
        <section className="rounded-panel border border-line bg-surface">
          <EmptyState
            description="La navegación se actualizará cuando su cuenta reciba permisos para otras funciones."
            title="No hay accesos adicionales disponibles."
          />
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const GroupIcon = group.icon
            return (
              <section
                aria-labelledby={`home-${group.id}`}
                className="overflow-hidden rounded-panel border border-line bg-surface"
                key={group.id}
              >
                <div className="flex items-center gap-2.5 border-b border-line bg-surface-subtle px-4 py-3">
                  <GroupIcon
                    aria-hidden="true"
                    className="text-ink-muted"
                    size={18}
                  />
                  <h2
                    className="text-[14.5px] font-semibold text-ink"
                    id={`home-${group.id}`}
                  >
                    {group.label}
                  </h2>
                </div>
                <ul className="divide-y divide-line">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <li key={item.to}>
                        <Link
                          className="group flex min-h-11 items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium text-ink hover:bg-surface-subtle focus-visible:bg-accent-soft"
                          to={item.to}
                        >
                          <ItemIcon
                            aria-hidden="true"
                            className="shrink-0 text-ink-muted group-hover:text-accent"
                            size={18}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          <ArrowRight
                            aria-hidden="true"
                            className="shrink-0 text-ink-muted group-hover:text-accent"
                            size={16}
                          />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
