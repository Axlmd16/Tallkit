import { useNavigate } from 'react-router'

import { LoginForm } from '@/features/auth/AuthForms'
import { useLogin } from '@/features/auth/hooks'
import { environment } from '@/shared/config/env'

export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          {environment.appName}
        </p>
        <h1 className="mt-3 text-3xl font-bold">Iniciar sesión</h1>
        <p className="mb-7 mt-3 text-slate-300">
          Acceso exclusivo para el personal del taller.
        </p>
        <LoginForm
          onLogin={async (username, password) => {
            await login.mutateAsync({ username, password })
            void navigate('/')
          }}
        />
      </section>
    </main>
  )
}
