import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { clearMoneyIntents } from '@/features/sales/moneyIntent'

import { useSession } from './hooks'
import { anonymousSession, type Session } from './types'
import { LoadingState } from '@/shared/ui'

export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; session: Session }

export function SessionGuard({ state }: { state: SessionState }) {
  const location = useLocation()
  const ended = state.status === 'ready' && !state.session.authenticated
  useEffect(() => {
    // Una sesión cerrada o invalidada no deja identificadores de dinero en el navegador.
    if (ended) clearMoneyIntents()
  }, [ended])
  if (state.status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas text-ink">
        <LoadingState label="Comprobando sesión…" />
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
