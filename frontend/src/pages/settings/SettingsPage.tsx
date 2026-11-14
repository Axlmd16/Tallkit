import { Gear } from '@phosphor-icons/react'
import { Link } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { PageHeader } from '@/shared/ui'

import { isSectionAllowed, settingsOptions } from '@/app/navigation'

/**
 * Página de entrada de «Ajustes»: reúne lo que se usa poco (proveedores, marcas, categorías,
 * usuarios, auditoría, configuración) en una lista de opciones con su descripción. Cada opción
 * aparece solo si los permisos del usuario la permiten; el servidor decide cada acción.
 */
export function SettingsPage() {
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const options = settingsOptions.filter((option) =>
    isSectionAllowed(option, permissions),
  )

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        description="Lo que se usa poco: los datos de cada negocio, quién entra al sistema y lo que se configura una vez."
        icon={<Gear />}
        title="Ajustes"
      />
      <ul
        aria-label="Opciones de ajustes"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {options.map((option) => {
          const Icon = option.icon
          return (
            <li key={option.id}>
              <Link
                className="flex h-full min-h-11 items-start gap-3 rounded-panel border border-line bg-surface p-4 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                to={option.to}
              >
                {Icon && (
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-card bg-primary-soft text-primary-strong"
                  >
                    <Icon size={20} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-ink">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block text-label text-ink-muted">
                      {option.description}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
