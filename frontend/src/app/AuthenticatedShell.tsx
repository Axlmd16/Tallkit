import {
  AddressBook,
  Car,
  ClipboardText,
  House,
  List,
  Pulse,
  SignOut,
  Tag,
  Users,
  Wrench,
} from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

import { useLogout, useSession } from '@/features/auth/hooks'
import {
  anonymousSession,
  type Role,
  type Session,
} from '@/features/auth/types'
import { environment } from '@/shared/config/env'
import { Button, Drawer, IconButton, InlineNotice } from '@/shared/ui'

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
}

const navigation = [
  { icon: House, label: 'Inicio', to: '/', permission: null },
  {
    icon: AddressBook,
    label: 'Clientes',
    to: '/customers',
    permission: 'clientes.ver',
  },
  {
    icon: Tag,
    label: 'Marcas',
    to: '/vehicle-brands',
    permission: 'marcas_vehiculo.ver',
  },
  {
    icon: Car,
    label: 'Vehículos',
    to: '/vehicles',
    permission: 'vehiculos.ver',
  },
  { icon: Users, label: 'Usuarios', to: '/users', permission: 'usuarios.ver' },
  {
    icon: ClipboardText,
    label: 'Auditoría',
    to: '/audit',
    permission: 'auditoria.ver',
  },
  {
    icon: Pulse,
    label: 'Estado técnico',
    to: '/technical-status',
    permission: 'operacion.ver_estado',
  },
] as const

function NavigationItems({
  onNavigate,
  permissions,
}: {
  onNavigate?: () => void
  permissions: Set<string>
}) {
  return navigation
    .filter((item) => !item.permission || permissions.has(item.permission))
    .map((item) => {
      const Icon = item.icon
      return (
        <NavLink
          className={({ isActive }) =>
            `relative flex min-h-11 items-center gap-3 px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-[linear-gradient(90deg,rgb(172_169_255_/_0.2),transparent)] text-primary' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'}`
          }
          end={item.to === '/'}
          key={item.to}
          onClick={onNavigate}
          title={item.label}
          to={item.to}
        >
          {item.to === '/users' || item.to === '/customers' ? (
            <Icon
              aria-hidden="true"
              className="shrink-0"
              size={22}
              weight="fill"
            />
          ) : (
            <span
              aria-hidden="true"
              className={`nav-glyph ${item.to === '/' ? 'nav-home' : item.to === '/audit' ? 'nav-audit' : 'nav-technical'}`}
            />
          )}
          <span className="app-nav-label truncate">{item.label}</span>
        </NavLink>
      )
    })
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
  const permissions = new Set(session.permissions)
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
    <div className="app-shell min-h-screen bg-canvas text-ink md:grid md:grid-cols-[5rem_minmax(0,1fr)] xl:grid-cols-[13.625rem_minmax(0,1fr)]">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between bg-surface px-4 shadow-card md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white">
            <Wrench aria-hidden="true" size={20} weight="bold" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-extrabold">{environment.appName}</p>
            <p className="truncate text-xs text-ink-muted">
              {session.username}
            </p>
          </div>
        </div>
        <IconButton
          icon={<List size={24} />}
          label="Abrir navegación"
          onClick={() => setNavigationOpen(true)}
          ref={menuButtonRef}
        />
      </header>

      <aside className="app-rail sticky top-0 hidden h-screen flex-col bg-surface px-3 py-5 md:flex xl:px-5">
        <div className="flex min-h-12 items-center gap-3 px-1 xl:px-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white">
            <Wrench aria-hidden="true" size={20} weight="bold" />
          </span>
          <p className="hidden truncate text-lg font-extrabold xl:block">
            {environment.appName}
          </p>
        </div>
        <nav aria-label="Navegación principal" className="mt-8 space-y-2">
          <NavigationItems permissions={permissions} />
        </nav>
        <div className="rail-profile mt-auto pt-4" title={userSummary}>
          <span aria-hidden="true" className="rail-avatar">
            {session.username?.slice(0, 2).toUpperCase()}
          </span>
          <div className="hidden min-w-0 xl:block">
            <p className="truncate text-sm font-bold">{session.username}</p>
            <p className="truncate text-xs text-ink-muted">
              {session.roles.map((role) => roleLabels[role]).join(' · ')}
            </p>
          </div>
          <p className="sr-only">{userSummary}</p>
          <Button
            className="mt-2 w-full xl:justify-start"
            onClick={() => void logout()}
            pending={pending}
            pendingLabel="Cerrando…"
            variant="quiet"
          >
            <SignOut aria-hidden="true" size={20} />
            <span className="app-logout-label">Cerrar sesión</span>
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        {error && (
          <div className="px-4 pt-5 md:px-7 xl:px-8">
            <InlineNotice title="No se cerró la sesión" tone="danger">
              Inténtelo nuevamente.
            </InlineNotice>
          </div>
        )}
        <main className="app-main mx-auto max-w-[90rem] px-4 py-6 md:px-7 md:py-8 xl:px-8">
          {children}
        </main>
      </div>

      <Drawer
        description="Elija una función disponible según sus permisos."
        onClose={() => setNavigationOpen(false)}
        open={navigationOpen}
        returnFocusRef={menuButtonRef}
        title="Navegación principal"
      >
        <nav aria-label="Opciones disponibles" className="w-full space-y-1">
          <NavigationItems
            onNavigate={() => setNavigationOpen(false)}
            permissions={permissions}
          />
          <Button
            className="mt-4 w-full justify-start"
            onClick={() => void logout()}
            pending={pending}
            pendingLabel="Cerrando…"
            variant="quiet"
          >
            <SignOut aria-hidden="true" size={20} />
            Cerrar sesión
          </Button>
        </nav>
      </Drawer>
    </div>
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
