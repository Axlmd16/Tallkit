import { List, SignOut } from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'

import compactBrand from '@/assets/brand/isotipo.svg'
import expandedBrand from '@/assets/brand/secundario.svg'
import { useLogout, useSession } from '@/features/auth/hooks'
import {
  anonymousSession,
  type Role,
  type Session,
} from '@/features/auth/types'
import { Button, Drawer, IconButton, InlineNotice } from '@/shared/ui'

import { visibleGroups } from './navigation'
import { CompactNavigation, ExpandedNavigation } from './SidebarNavigation'
import { useExpandedRail } from './useExpandedRail'

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
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
    <div className="app-shell min-h-screen bg-canvas text-ink md:grid md:grid-cols-[5rem_minmax(0,1fr)] xl:grid-cols-[16.5rem_minmax(0,1fr)]">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between bg-surface px-4 shadow-card md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <img
            alt="Tallkit"
            className="app-mobile-brand-logo"
            src={expandedBrand}
          />
        </div>
        <IconButton
          icon={<List size={24} />}
          label="Abrir navegación"
          onClick={() => setNavigationOpen(true)}
          ref={menuButtonRef}
        />
      </header>

      <aside className="app-rail sticky top-0 hidden h-screen flex-col bg-surface px-3 py-5 md:flex xl:px-3">
        <div className="app-brand-mark flex min-h-12 items-center justify-center">
          <img
            alt="Tallkit"
            className="app-brand-compact"
            data-testid="brand-logo-compact"
            src={compactBrand}
          />
          <img
            alt="Tallkit"
            className="app-brand-expanded"
            data-testid="brand-logo-expanded"
            src={expandedBrand}
          />
        </div>
        <nav
          aria-label="Navegación principal"
          className="mt-8 min-h-0 flex-1 overflow-y-auto"
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
        <nav aria-label="Opciones disponibles" className="w-full">
          <ExpandedNavigation
            groups={groups}
            idPrefix="drawer"
            onNavigate={() => setNavigationOpen(false)}
            pathname={pathname}
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
