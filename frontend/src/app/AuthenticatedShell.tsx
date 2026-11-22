import { List, MagnifyingGlass, SignOut } from '@phosphor-icons/react'
import { Fragment, useRef, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'

import brandMark from '@/assets/brand/isotipo.svg'
import { useLogout, useSession } from '@/features/auth/hooks'
import {
  anonymousSession,
  type Role,
  type Session,
} from '@/features/auth/types'
import {
  GlobalSearchProvider,
  useGlobalSearchModal,
} from '@/features/search/GlobalSearchContext'
import { GlobalSearchDialog } from '@/features/search/GlobalSearchDialog'
import { clearRecentSearches } from '@/features/search/recent'
import { useBusinessName } from '@/shared/api/entity-logos'
import {
  Button,
  FiscalScopeBadge,
  IconButton,
  InlineNotice,
  GaugeMotif,
  NavigationPanel,
  SectionNav,
  ToastProvider,
} from '@/shared/ui'
import { TERMS } from '@/shared/ui/terms'

import {
  findLocation,
  homeEntry,
  visibleEntries,
  type NavLocation,
  type NavScope,
  type NavSection,
} from './navigation'
import { EntryNavigation } from './SidebarNavigation'
import { useExpandedRail } from './useExpandedRail'

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
}

const singularLabels: Record<string, string> = {
  Clientes: 'cliente',
  Vehículos: 'vehículo',
  Productos: 'producto',
  Servicios: 'servicio',
  Proveedores: 'proveedor',
  Entradas: 'entrada',
  Ventas: 'venta',
  Mantenimientos: 'mantenimiento',
  Proformas: 'proforma',
}

/** Sustantivos femeninos: «Nueva entrada», «Nueva venta». */
const feminineNouns = new Set(['entrada', 'venta', 'proforma'])

function currentBreadcrumbLabel(pathname: string, itemLabel: string) {
  const noun = singularLabels[itemLabel] ?? itemLabel.toLocaleLowerCase('es')
  if (pathname.endsWith('/quick')) return 'Venta rápida'
  if (pathname.endsWith('/new'))
    return `${feminineNouns.has(noun) ? 'Nueva' : 'Nuevo'} ${noun}`
  if (pathname.endsWith('/edit')) return `Editar ${noun}`
  if (pathname.endsWith('/document')) return TERMS.receipt
  if (pathname.endsWith('/kardex')) return TERMS.movements
  if (pathname.startsWith('/inventory/operations/'))
    return 'Operación de inventario'
  return `Ficha de ${noun}`
}

interface Crumb {
  label: string
  to: string
}

/** Ruta de migas: entrada, sección (si aporta), subsección y, en una ficha, su nombre. */
function buildTrail(
  location: NavLocation,
  pathname: string,
  sectionLabel: (section: NavSection) => string,
): Crumb[] {
  const { entry, section, subsection } = location
  const trail: Crumb[] = []
  if (entry.id !== homeEntry.id)
    trail.push({ label: entry.label, to: entry.to })
  if (
    section &&
    (entry.tabs === 'never' ||
      section.businessTab ||
      section.label !== entry.label)
  )
    trail.push({ label: sectionLabel(section), to: section.to })
  if (subsection) trail.push({ label: subsection.label, to: subsection.to })
  if (entry.id === homeEntry.id) return [{ label: entry.label, to: '/' }]
  const last = trail[trail.length - 1]
  if (!last) return trail
  if (pathname !== last.to && pathname !== '/settings')
    trail.push({
      label: currentBreadcrumbLabel(pathname, section?.label ?? entry.label),
      to: pathname,
    })
  return trail
}

function AuthenticatedShellInner({
  session,
  onLogout,
  children,
}: {
  session: Session
  onLogout: () => Promise<void>
  children: ReactNode
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [navigationOpen, setNavigationOpen] = useState(false)
  const locked = useRef(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const expandedRail = useExpandedRail()
  const search = useGlobalSearchModal()
  const businessNames: Record<NavScope, string> = {
    commercial: useBusinessName('commercial'),
    artesanal: useBusinessName('artesanal'),
  }
  const entries = visibleEntries(new Set(session.permissions))
  const location = findLocation(entries, pathname)
  const scope = location?.section?.scope
  const sectionLabel = (section: NavSection) =>
    section.businessTab && section.scope
      ? businessNames[section.scope]
      : section.label
  const trail = location ? buildTrail(location, pathname, sectionLabel) : []
  const entry = location?.entry
  const tabSections =
    entry && entry.tabs !== 'never'
      ? entry.sections.length >= (entry.tabs === 'always' ? 1 : 2)
        ? entry.sections
        : []
      : []
  const activeSection = location?.section ?? null
  const userSummary = `${session.username} · ${session.roles.map((role) => roleLabels[role]).join(' · ')}`

  async function logout() {
    if (locked.current) return
    locked.current = true
    setPending(true)
    setError('')
    try {
      clearRecentSearches()
      await onLogout()
    } catch {
      setError('No fue posible cerrar la sesión. Inténtelo nuevamente.')
    } finally {
      locked.current = false
      setPending(false)
    }
  }

  return (
    <ToastProvider>
      <div className="app-shell min-h-screen bg-canvas text-ink md:grid md:grid-cols-[5rem_minmax(0,1fr)] xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-line bg-surface px-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img alt="" className="app-mobile-brand-logo" src={brandMark} />
            <span className="text-block font-bold text-ink">Tallkit</span>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              className="size-[44px] min-w-[44px] min-h-[44px]"
              icon={<MagnifyingGlass size={22} />}
              label="Buscar en todo el sistema"
              onClick={() => search.openSearch('')}
              targetSize="touch44"
            />
            <IconButton
              className="size-[44px] min-w-[44px] min-h-[44px]"
              icon={<List size={24} />}
              label="Abrir navegación"
              onClick={() => setNavigationOpen(true)}
              ref={menuButtonRef}
              targetSize="touch44"
            />
          </div>
        </header>

        <aside className="app-rail sticky top-0 hidden h-screen flex-col overflow-hidden border-r border-graphite-line bg-graphite text-graphite-ink md:flex">
          <div className="app-brand-mark flex h-15 shrink-0 items-center border-b border-graphite-line">
            <img
              alt="Tallkit"
              className="app-brand-compact rounded-control bg-white p-0.5"
              data-testid="brand-logo-compact"
              src={brandMark}
            />
            <span
              className="app-brand-expanded items-center gap-2.5"
              data-testid="brand-logo-expanded"
            >
              <img
                alt=""
                className="size-8 rounded-control bg-white p-0.5"
                src={brandMark}
              />
              <span className="text-block font-bold tracking-tight text-white">
                Tallkit
              </span>
            </span>
          </div>
          <nav
            aria-label="Navegación principal"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
          >
            <EntryNavigation
              entries={entries}
              iconOnly={!expandedRail}
              location={location}
            />
          </nav>
          <div
            className="rail-profile mt-auto border-t border-graphite-line"
            title={userSummary}
          >
            <span aria-hidden="true" className="rail-avatar">
              {session.username?.slice(0, 2).toUpperCase()}
            </span>
            <div className="hidden min-w-0 xl:block">
              <p className="truncate text-body font-semibold text-white">
                {session.username}
              </p>
              <p className="truncate text-label text-graphite-ink">
                {session.roles.map((role) => roleLabels[role]).join(' · ')}
              </p>
            </div>
            <p className="sr-only">{userSummary}</p>
            <Button
              className="mt-2 w-full text-graphite-ink! hover:bg-graphite-raised! hover:text-white! xl:justify-start"
              onClick={() => void logout()}
              pending={pending}
              pendingLabel="Cerrando…"
              variant="quiet"
            >
              <SignOut aria-hidden="true" size={20} />
              <span className="app-logout-label">Cerrar sesión</span>
            </Button>
          </div>
          <GaugeMotif
            className="mx-auto hidden h-16 w-full max-w-[9rem] shrink-0 pb-3 xl:block"
            variant="rail"
          />
        </aside>

        <div className="min-w-0">
          <div
            className="app-topbar sticky top-0 z-20 hidden h-15 items-center gap-4 border-b border-line bg-surface px-6 md:flex"
            data-testid="app-topbar"
          >
            <nav aria-label="Ruta" className="min-w-0 flex-1 text-body">
              {trail.length > 0 && (
                <ol className="flex min-w-0 items-center gap-1.5">
                  {trail.map((crumb, index) => {
                    const current = index === trail.length - 1
                    return (
                      <Fragment key={`${crumb.to}-${index}`}>
                        {index > 0 && (
                          <li aria-hidden="true" className="text-line-strong">
                            /
                          </li>
                        )}
                        {current ? (
                          <li
                            aria-current="page"
                            className="truncate font-semibold"
                          >
                            {crumb.label}
                          </li>
                        ) : (
                          <li className="truncate">
                            <Link
                              className="text-ink-muted hover:text-accent hover:underline"
                              to={crumb.to}
                            >
                              {crumb.label}
                            </Link>
                          </li>
                        )}
                      </Fragment>
                    )
                  })}
                </ol>
              )}
            </nav>
            <button
              aria-label="Buscar en todo el sistema"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-line bg-canvas px-3 text-body font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => search.openSearch('')}
              type="button"
            >
              <MagnifyingGlass aria-hidden="true" size={16} weight="bold" />
              <span>Buscar</span>
              <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted lg:inline">
                Ctrl K
              </kbd>
            </button>
            {scope && <FiscalScopeBadge scope={scope} />}
          </div>
          {error && (
            <div className="px-4 pt-5 md:px-7 xl:px-8">
              <InlineNotice title="No se cerró la sesión" tone="danger">
                Inténtelo nuevamente.
              </InlineNotice>
            </div>
          )}
          {tabSections.length > 0 && entry && (
            <div className="border-b border-line bg-surface px-2 md:px-4">
              <SectionNav
                activeId={activeSection?.id ?? ''}
                aria-label={`Secciones de ${entry.label}`}
                items={tabSections.map((section) => ({
                  id: section.id,
                  label: sectionLabel(section),
                  href: section.to,
                }))}
                layout="horizontal"
                onSelect={(id) => {
                  const target = tabSections.find((item) => item.id === id)
                  if (target) navigate(target.to)
                }}
              />
              {activeSection?.subsections && (
                <SectionNav
                  activeId={location?.subsection?.to ?? ''}
                  aria-label={`Cuentas de ${sectionLabel(activeSection)}`}
                  className="border-t border-line"
                  items={activeSection.subsections.map((item) => ({
                    id: item.to,
                    label: item.label,
                    href: item.to,
                  }))}
                  layout="horizontal"
                  onSelect={(id) => navigate(id)}
                />
              )}
            </div>
          )}
          <main className="app-main w-full px-4 py-5 md:px-6">{children}</main>
        </div>

        <NavigationPanel
          description="Elija una función disponible según sus permisos."
          onClose={() => setNavigationOpen(false)}
          open={navigationOpen}
          returnFocusRef={menuButtonRef}
          title="Navegación principal"
        >
          <nav aria-label="Opciones disponibles" className="w-full">
            <EntryNavigation
              entries={entries}
              location={location}
              onNavigate={() => setNavigationOpen(false)}
            />
            <Button
              className="mt-4 w-full justify-start text-graphite-ink! hover:bg-graphite-raised! hover:text-white!"
              onClick={() => void logout()}
              pending={pending}
              pendingLabel="Cerrando…"
              variant="quiet"
            >
              <SignOut aria-hidden="true" size={20} />
              Cerrar sesión
            </Button>
          </nav>
        </NavigationPanel>
        {search.open && (
          <GlobalSearchDialog
            initialQuery={search.initialQuery}
            onClose={search.closeSearch}
            open={search.open}
            username={session.username ?? null}
          />
        )}
      </div>
    </ToastProvider>
  )
}

export function AuthenticatedShell({
  session,
  onLogout,
  children,
}: {
  session: Session
  onLogout: () => Promise<void>
  children: ReactNode
}) {
  return (
    <GlobalSearchProvider
      authenticated={session.authenticated}
      username={session.username ?? null}
    >
      <AuthenticatedShellInner onLogout={onLogout} session={session}>
        {children}
      </AuthenticatedShellInner>
    </GlobalSearchProvider>
  )
}

export function RemoteAuthenticatedShell() {
  const session = useSession()
  const logout = useLogout()
  return (
    <AuthenticatedShell
      onLogout={() => logout.mutateAsync()}
      session={session.data ?? anonymousSession}
    >
      <Outlet />
    </AuthenticatedShell>
  )
}
