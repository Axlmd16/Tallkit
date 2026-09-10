import { Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from './hooks'
import { anonymousSession, type Session } from './types'

export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; session: Session }

export function SessionGuard({ state }: { state: SessionState }) {
  const location = useLocation()
  if (state.status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        <p aria-live="polite">Comprobando sesión…</p>
      </main>
    )
  }
  if (!state.session.authenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }
  if (
    state.session.must_change_password &&
    location.pathname !== '/change-password'
  ) {
    return <Navigate replace to="/change-password" />
  }
  return <Outlet />
}

export function RemoteSessionGuard() {
  const session = useSession()
  if (session.isPending) return <SessionGuard state={{ status: 'loading' }} />
  return (
    <SessionGuard
      state={{
        status: 'ready',
        session: session.isSuccess ? session.data : anonymousSession,
      }}
    />
  )
}
