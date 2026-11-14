import { useNavigate } from 'react-router'
import { Tag, Wrench } from '@phosphor-icons/react'

import brandMark from '@/assets/brand/isotipo.svg'
import principalBrand from '@/assets/brand/principal.svg'
import { LoginForm } from '@/features/auth/AuthForms'
import { useLogin } from '@/features/auth/hooks'
import { environment } from '@/shared/config/env'

/**
 * Acceso con composición propia de Tallkit: el formulario ocupa la región principal y, en
 * pantallas amplias, un panel de marca muestra las piezas del taller como motivo visual.
 * No ofrece registro público, acceso social ni recuperación por correo.
 */
export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  return (
    <main
      className="grid min-h-screen bg-canvas text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      data-testid="login-layout"
    >
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[380px]">
          <img
            alt="Tallkit"
            className="h-16 w-auto"
            data-testid="login-brand-logo"
            src={principalBrand}
          />
          <h1 className="mt-8 text-page font-semibold">Iniciar sesión</h1>
          <p className="mt-1 text-body text-ink-muted">
            {environment.appName} · Acceso interno del personal del taller
          </p>
          <div className="mt-6 rounded-panel border border-line bg-surface p-5">
            <LoginForm
              onLogin={async (username, password) => {
                await login.mutateAsync({ username, password })
                void navigate('/')
              }}
            />
          </div>
          <p className="mt-4 text-label text-ink-muted">
            Las cuentas las crea el administrador. Si olvidó su contraseña,
            pídale que la restablezca.
          </p>
        </div>
      </section>
      <section
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-graphite text-white lg:flex lg:flex-col lg:justify-between lg:p-12"
        data-testid="login-visual"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-panel bg-white">
            <img alt="" className="size-8" src={brandMark} />
          </span>
          <span className="text-block font-bold tracking-tight">Tallkit</span>
        </div>
        <div className="max-w-md">
          <p className="text-page leading-9 font-semibold">
            El mostrador y el taller, en un mismo banco de trabajo.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex flex-col overflow-hidden rounded-chip border-2 border-white bg-white text-ink">
              <span className="h-1 bg-brand" />
              <span className="px-2.5 py-1 code text-body font-semibold tracking-wider">
                PBA-1234
              </span>
            </span>
            <span className="rounded-chip bg-white/12 px-2 py-1 code text-body">
              FLT-0915
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-chip bg-white/12 px-2.5 py-1 text-body">
              <Tag size={16} />
              Ventas
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-chip bg-white/12 px-2.5 py-1 text-body">
              <Wrench size={16} />
              Taller
            </span>
          </div>
        </div>
        <p className="text-body text-white/75">
          Repuestos y servicios, cada uno con sus propias cuentas, siempre
          separados.
        </p>
      </section>
    </main>
  )
}
