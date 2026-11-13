import { useNavigate } from 'react-router'
import brandMark from '@/assets/brand/isotipo.svg'

import { ChangePasswordForm } from '@/features/auth/AuthForms'
import { useChangePassword } from '@/features/auth/hooks'

export function ChangePasswordPage() {
  const changePassword = useChangePassword()
  const navigate = useNavigate()
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink sm:px-6">
      <section className="w-full max-w-[420px] rounded-panel border border-line bg-surface p-6">
        <div className="flex items-center gap-2">
          <img alt="" className="size-7" src={brandMark} />
          <span className="font-bold text-primary">Tallkit</span>
        </div>
        <h1 className="mt-6 text-page font-semibold">Cambiar contraseña</h1>
        <p className="mt-1 mb-6 text-body text-ink-muted">
          Establezca una contraseña personal antes de continuar.
        </p>
        <ChangePasswordForm
          onChangePassword={async (currentPassword, newPassword) => {
            await changePassword.mutateAsync({ currentPassword, newPassword })
            void navigate('/')
          }}
        />
      </section>
    </main>
  )
}
