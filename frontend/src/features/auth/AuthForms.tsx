import { useRef, useState, type FormEvent } from 'react'

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No fue posible completar la operación.'
}

const inputClass =
  'mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-slate-100 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30'
const buttonClass =
  'mt-6 min-h-11 w-full rounded-xl bg-cyan-400 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60'

export function LoginForm({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const locked = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current) return
    if (!username.trim() || !password) {
      setError('Ingrese su identificación y contraseña.')
      return
    }
    locked.current = true
    setPending(true)
    setError('')
    try {
      await onLogin(username.trim(), password)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      locked.current = false
      setPending(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <label className="block font-medium">
        Identificación de acceso
        <input
          autoComplete="username"
          className={inputClass}
          onChange={(event) => setUsername(event.target.value)}
          value={username}
        />
      </label>
      <label className="mt-5 block font-medium">
        Contraseña
        <input
          autoComplete="current-password"
          className={inputClass}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>
      {error && (
        <p
          className="mt-4 rounded-lg bg-rose-950/70 p-3 text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
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
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const locked = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current) return
    if (!currentPassword || !newPassword || !confirmation) {
      setError('Complete los tres campos.')
      return
    }
    if (newPassword !== confirmation) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    locked.current = true
    setPending(true)
    setError('')
    try {
      await onChangePassword(currentPassword, newPassword)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      locked.current = false
      setPending(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <label className="block font-medium">
        Contraseña actual
        <input
          autoComplete="current-password"
          className={inputClass}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          value={currentPassword}
        />
      </label>
      <label className="mt-5 block font-medium">
        Nueva contraseña
        <input
          autoComplete="new-password"
          className={inputClass}
          onChange={(event) => setNewPassword(event.target.value)}
          type="password"
          value={newPassword}
        />
      </label>
      <label className="mt-5 block font-medium">
        Confirmar nueva contraseña
        <input
          autoComplete="new-password"
          className={inputClass}
          onChange={(event) => setConfirmation(event.target.value)}
          type="password"
          value={confirmation}
        />
      </label>
      {error && (
        <p
          className="mt-4 rounded-lg bg-rose-950/70 p-3 text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
