import { useNavigate } from 'react-router'
import { Key } from '@phosphor-icons/react'

import { ChangePasswordForm } from '@/features/auth/AuthForms'
import { useChangePassword } from '@/features/auth/hooks'

export function ChangePasswordPage() {
  const changePassword = useChangePassword()
  const navigate = useNavigate()
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink sm:px-6">
      <section className="w-full max-w-md rounded-group bg-surface p-6 shadow-card sm:p-8">
        <span className="grid size-11 place-items-center rounded-full bg-primary text-white">
          <Key aria-hidden="true" size={22} weight="bold" />
        </span>
        <h1 className="mt-7 text-3xl font-extrabold tracking-[-0.02em]">
          Cambiar contraseña
        </h1>
        <p className="mb-7 mt-2 text-ink-muted">
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
