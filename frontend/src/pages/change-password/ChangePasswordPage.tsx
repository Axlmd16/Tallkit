import { useNavigate } from 'react-router'

import { ChangePasswordForm } from '@/features/auth/AuthForms'
import { useChangePassword } from '@/features/auth/hooks'

export function ChangePasswordPage() {
  const changePassword = useChangePassword()
  const navigate = useNavigate()
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <h1 className="text-3xl font-bold">Cambiar contraseña</h1>
        <p className="mb-7 mt-3 text-slate-300">
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
