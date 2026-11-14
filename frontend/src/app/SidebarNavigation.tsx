import { Link } from 'react-router'

import {
  homeEntry,
  type NavEntry,
  type NavLocation,
  type VisibleNavEntry,
} from './navigation'

const rowBase =
  'app-rail-nav-item relative flex min-h-11 w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white'
const rowIdle = 'text-graphite-ink hover:bg-graphite-raised/60 hover:text-white'
/* Entrada activa: fondo elevado, texto blanco y barra cobre a la izquierda. */
const rowActive =
  'bg-graphite-raised font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[2.5px] before:rounded-r-full before:bg-primary'

interface NavigationProps {
  entries: readonly VisibleNavEntry[]
  location: NavLocation | null
  onNavigate?: (() => void) | undefined
  /** Barra compacta de tableta: solo iconos, con el nombre como etiqueta accesible. */
  iconOnly?: boolean
}

function EntryLink({
  entry,
  active,
  onNavigate,
  iconOnly,
}: {
  entry: NavEntry & { to: string }
  active: boolean
  onNavigate?: (() => void) | undefined
  iconOnly: boolean
}) {
  const Icon = entry.icon
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      aria-label={iconOnly ? entry.label : undefined}
      className={`${rowBase} ${active ? rowActive : rowIdle} ${iconOnly ? 'justify-center px-0' : ''}`}
      onClick={onNavigate}
      title={entry.label}
      to={entry.to}
    >
      <Icon aria-hidden="true" className="shrink-0" size={18} />
      {!iconOnly && <span className="min-w-0 flex-1">{entry.label}</span>}
    </Link>
  )
}

/**
 * Menú principal: Inicio y las demás entradas, todas visibles a la vez y sin grupos plegables,
 * igual en la barra desplegada, la barra compacta de iconos y el panel de teléfono.
 */
export function EntryNavigation({
  entries,
  location,
  onNavigate,
  iconOnly = false,
}: NavigationProps) {
  const activeId = location?.entry.id ?? null
  return (
    <ul className={`flex flex-col ${iconOnly ? 'gap-1.5' : 'gap-1'}`}>
      {[homeEntry, ...entries].map((entry) => (
        <li key={entry.id}>
          <EntryLink
            active={entry.id === activeId}
            entry={entry}
            iconOnly={iconOnly}
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  )
}
