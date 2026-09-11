import { useRef, useState, type FormEvent } from 'react'

import { Button, Field, InlineNotice, Input } from '@/shared/ui'

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No fue posible completar la operación.'
}

type LoginErrors = { password?: string; username?: string }

export function LoginForm({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [summary, setSummary] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [pending, setPending] = useState(false)
  const locked = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current) return
    const nextErrors: LoginErrors = {}
    if (!username.trim()) nextErrors.username = 'Ingrese su identificación.'
    if (!password) nextErrors.password = 'Ingrese su contraseña.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSummary('Revise los campos señalados.')
      return
    }
    locked.current = true
    setPending(true)
    setErrors({})
    setSummary('')
    try {
      await onLogin(username.trim(), password)
    } catch (caught) {
      const message = errorMessage(caught)
      setErrors({ password: message, username: message })
      setSummary(message)
    } finally {
      locked.current = false
      setPending(false)
    }
  }

  return (
    <form
      className="login-form space-y-5"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      {summary && <InlineNotice title={summary} tone="danger" />}
      <Field
        error={errors.username}
        hint="Use la identificación asignada por el administrador."
        id="login-username"
        label="Identificación de acceso"
      >
        <Input
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
          value={username}
        />
      </Field>
      <Field error={errors.password} id="login-password" label="Contraseña">
        <Input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </Field>
      <Button
        className="w-full"
        pending={pending}
        pendingLabel="Ingresando…"
        type="submit"
      >
        Ingresar
      </Button>
    </form>
  )
}

type PasswordErrors = {
  confirmation?: string
  currentPassword?: string
  newPassword?: string
}

export function ChangePasswordForm({
  onChangePassword,
}: {
  onChangePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [summary, setSummary] = useState('')
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [pending, setPending] = useState(false)
  const locked = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current) return
    const nextErrors: PasswordErrors = {}
    if (!currentPassword)
      nextErrors.currentPassword = 'Ingrese su contraseña actual.'
    if (!newPassword) nextErrors.newPassword = 'Ingrese la nueva contraseña.'
    if (!confirmation) nextErrors.confirmation = 'Confirme la nueva contraseña.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSummary('Revise los campos señalados.')
      return
    }
    if (newPassword !== confirmation) {
      const message = 'Las contraseñas nuevas no coinciden.'
      setErrors({ confirmation: message, newPassword: message })
      setSummary(message)
      return
    }
    locked.current = true
    setPending(true)
    setErrors({})
    setSummary('')
    try {
      await onChangePassword(currentPassword, newPassword)
    } catch (caught) {
      const message = errorMessage(caught)
      setErrors({ currentPassword: message })
      setSummary(message)
    } finally {
      locked.current = false
      setPending(false)
    }
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      {summary && <InlineNotice title={summary} tone="danger" />}
      <Field
        error={errors.currentPassword}
        id="current-password"
        label="Contraseña actual"
      >
        <Input
          autoComplete="current-password"
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          value={currentPassword}
        />
      </Field>
      <Field
        error={errors.newPassword}
        hint="Use una contraseña personal que no comparta con otras personas."
        id="new-password"
        label="Nueva contraseña"
      >
        <Input
          autoComplete="new-password"
          onChange={(event) => setNewPassword(event.target.value)}
          type="password"
          value={newPassword}
        />
      </Field>
      <Field
        error={errors.confirmation}
        id="confirm-password"
        label="Confirmar nueva contraseña"
      >
        <Input
          autoComplete="new-password"
          onChange={(event) => setConfirmation(event.target.value)}
          type="password"
          value={confirmation}
        />
      </Field>
      <Button
        className="w-full"
        pending={pending}
        pendingLabel="Guardando…"
        type="submit"
      >
        Cambiar contraseña
      </Button>
    </form>
  )
}
