import { List, SignOut } from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'

import brandMark from '@/assets/brand/isotipo.svg'
import { useLogout, useSession } from '@/features/auth/hooks'
import {
  anonymousSession,
  type Role,
  type Session,
} from '@/features/auth/types'
import {
  Button,
  FiscalScopeBadge,
  IconButton,
  InlineNotice,
  GaugeMotif,
  NavigationPanel,
  ToastProvider,
} from '@/shared/ui'

import { findLocation, groupScopes, visibleGroups } from './navigation'
import { CompactNavigation, ExpandedNavigation } from './SidebarNavigation'
import { useExpandedRail } from './useExpandedRail'

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
}

const exactBreadcrumbLabels: Record<string, string> = {
  '/product-categories': 'Categorías de producto',
  '/measurement-units': 'Unidades de medida',
  '/product-brands': 'Marcas de producto',
  '/sales/receivables': 'Cuentas por cobrar',
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
}

/** Sustantivos femeninos: «Nueva entrada», «Nueva venta». */
const feminineNouns = new Set(['entrada', 'venta'])

function currentBreadcrumbLabel(pathname: string, itemLabel: string) {
  const exact = exactBreadcrumbLabels[pathname]
  if (exact) return exact
  const noun = singularLabels[itemLabel] ?? itemLabel.toLocaleLowerCase('es')
  if (pathname.endsWith('/new'))
    return `${feminineNouns.has(noun) ? 'Nueva' : 'Nuevo'} ${noun}`
  if (pathname.endsWith('/edit')) return `Editar ${noun}`
  if (pathname.endsWith('/document')) return 'Comprobante'
  if (pathname.endsWith('/kardex')) return 'Kardex'
  if (pathname.startsWith('/inventory/operations/'))
    return 'Operación de inventario'
  return `Ficha de ${noun}`
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
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [navigationOpen, setNavigationOpen] = useState(false)
  const locked = useRef(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const expandedRail = useExpandedRail()
  const groups = visibleGroups(new Set(session.permissions))
  const location = findLocation(groups, pathname)
  const nestedLocation = location && pathname !== location.item.to
  const currentLabel =
    location && nestedLocation
      ? currentBreadcrumbLabel(pathname, location.item.label)
      : location?.item.label
  const scope = location?.group ? groupScopes[location.group.id] : undefined
  const userSummary = `${session.username} · ${session.roles.map((role) => roleLabels[role]).join(' · ')}`

  async function logout() {
    if (locked.current) return
    locked.current = true
    setPending(true)
    setError('')
    try {
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
          <IconButton
            icon={<List size={24} />}
            label="Abrir navegación"
            onClick={() => setNavigationOpen(true)}
            ref={menuButtonRef}
          />
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
            {expandedRail ? (
              <ExpandedNavigation
                groups={groups}
                idPrefix="rail"
                pathname={pathname}
              />
            ) : (
              <CompactNavigation groups={groups} pathname={pathname} />
            )}
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
              {location && (
                <ol className="flex min-w-0 items-center gap-1.5">
                  {location.group && (
                    <li className="truncate">
                      <Link
                        className="text-ink-muted hover:text-accent hover:underline"
                        to={location.item.to}
                      >
                        {location.group.label}
                      </Link>
                    </li>
                  )}
                  {location.group && (
                    <li aria-hidden="true" className="text-line-strong">
                      /
                    </li>
                  )}
                  {nestedLocation && (
                    <>
                      <li className="truncate">
                        <Link
                          className="text-ink-muted hover:text-accent hover:underline"
                          to={location.item.to}
                        >
                          {location.item.label}
                        </Link>
                      </li>
                      <li aria-hidden="true" className="text-line-strong">
                        /
                      </li>
                    </>
                  )}
                  <li aria-current="page" className="truncate font-semibold">
                    {currentLabel}
                  </li>
                </ol>
              )}
            </nav>
            {scope && <FiscalScopeBadge scope={scope} />}
          </div>
          {error && (
            <div className="px-4 pt-5 md:px-7 xl:px-8">
              <InlineNotice title="No se cerró la sesión" tone="danger">
                Inténtelo nuevamente.
              </InlineNotice>
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
            <ExpandedNavigation
              groups={groups}
              idPrefix="drawer"
              onNavigate={() => setNavigationOpen(false)}
              pathname={pathname}
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
      </div>
    </ToastProvider>
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
