import { useNavigate } from 'react-router'
import { Clock, ShieldCheck, Wrench } from '@phosphor-icons/react'

import principalBrand from '@/assets/brand/principal.svg'
import workshopDiagnostic from '@/assets/workshop-diagnostic.svg'
import { LoginForm } from '@/features/auth/AuthForms'
import { useLogin } from '@/features/auth/hooks'
import { environment } from '@/shared/config/env'

export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  return (
    <main
      className="login-page grid min-h-screen bg-canvas text-ink lg:grid-cols-[28rem_minmax(0,1fr)]"
      data-testid="login-layout"
    >
      <section className="login-column">
        <div className="login-content">
          <img
            alt="Tallkit"
            className="login-brand-logo"
            data-testid="login-brand-logo"
            src={principalBrand}
          />
          <h1>Iniciar sesión</h1>
          <div className="login-context">
            <span>{environment.appName}</span>
            <span>Acceso interno</span>
          </div>
          <div className="login-divider">
            <span>Cuenta local</span>
          </div>
          <LoginForm
            onLogin={async (username, password) => {
              await login.mutateAsync({ username, password })
              void navigate('/')
            }}
          />
          <p className="login-footnote">
            Acceso exclusivo para el personal del taller.
          </p>
        </div>
      </section>
      <section
        aria-hidden="true"
        className="login-art hidden lg:grid"
        data-testid="login-visual"
      >
        <div className="login-art-scene">
          <span className="scene-clock">
            <Clock size={70} weight="light" />
          </span>
          <img alt="" className="login-illustration" src={workshopDiagnostic} />
          <span className="scene-toolbox">
            <Wrench size={52} weight="duotone" />
          </span>
          <span className="scene-access">
            <ShieldCheck size={48} weight="duotone" />
          </span>
          <span className="scene-ground" />
        </div>
      </section>
    </main>
  )
}
