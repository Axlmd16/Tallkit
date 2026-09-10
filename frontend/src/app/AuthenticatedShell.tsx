import { useRef, useState, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router'

import { useLogout, useSession } from '@/features/auth/hooks'
import {
  anonymousSession,
  type Role,
  type Session,
} from '@/features/auth/types'
import { environment } from '@/shared/config/env'

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
}

const navigation = [
  { label: 'Usuarios', to: '/users', permission: 'usuarios.ver' },
  { label: 'Auditoría', to: '/audit', permission: 'auditoria.ver' },
  {
    label: 'Estado técnico',
    to: '/technical-status',
    permission: 'operacion.ver_estado',
  },
] as const

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
  const locked = useRef(false)
  const permissions = new Set(session.permissions)

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-semibold text-cyan-400">{environment.appName}</p>
            <p className="text-sm text-slate-300">
              {session.username} ·{' '}
              {session.roles.map((role) => roleLabels[role]).join(' · ')}
            </p>
          </div>
          <button
            className="min-h-11 rounded-xl border border-slate-600 px-4 py-2 font-medium hover:border-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            onClick={() => void logout()}
            type="button"
          >
            {pending ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
        <nav
          aria-label="Navegación principal"
          className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-4"
        >
          <Link className="rounded-lg px-3 py-2 hover:bg-slate-800" to="/">
            Inicio
          </Link>
          {navigation
            .filter((item) => permissions.has(item.permission))
            .map((item) => (
              <Link
                className="rounded-lg px-3 py-2 hover:bg-slate-800"
                key={item.to}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
        </nav>
      </header>
      {error && (
        <p className="mx-auto mt-4 max-w-7xl px-5 text-rose-300" role="alert">
          {error}
        </p>
      )}
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
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
