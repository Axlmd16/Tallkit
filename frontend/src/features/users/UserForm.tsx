import { useEffect, useState, type FormEvent } from 'react'

import type { Role } from '@/features/auth/types'

import type { UserSummary, UserWrite } from './types'

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
}
const allRoles = Object.keys(roleLabels) as Role[]

const empty: UserWrite = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  roles: [],
}

export function UserForm({
  user,
  onSubmit,
  onCancel,
}: {
  user?: UserSummary
  onSubmit: (data: UserWrite) => Promise<void>
  onCancel?: () => void
}) {
  const initial = user
    ? {
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        roles: user.roles,
      }
    : empty
  const [draft, setDraft] = useState<UserWrite>(initial)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.username.trim())
      return setError('Ingrese la identificación de acceso.')
    if (draft.roles.length === 0) return setError('Seleccione al menos un rol.')
    setPending(true)
    setError('')
    try {
      await onSubmit({ ...draft, username: draft.username.trim() })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No fue posible guardar el usuario.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <label className="block">
        Identificación de acceso
        <input
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3"
          onChange={(event) =>
            setDraft({ ...draft, username: event.target.value })
          }
          value={draft.username}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Nombres
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3"
            onChange={(event) =>
              setDraft({ ...draft, first_name: event.target.value })
            }
            value={draft.first_name}
          />
        </label>
        <label>
          Apellidos
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3"
            onChange={(event) =>
              setDraft({ ...draft, last_name: event.target.value })
            }
            value={draft.last_name}
          />
        </label>
      </div>
      <label className="block">
        Correo opcional
        <input
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3"
          onChange={(event) =>
            setDraft({ ...draft, email: event.target.value })
          }
          type="email"
          value={draft.email}
        />
      </label>
      <fieldset>
        <legend className="font-medium">Roles</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {allRoles.map((role) => (
            <label key={role}>
              <input
                checked={draft.roles.includes(role)}
                className="mr-2"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    roles: event.target.checked
                      ? [...draft.roles, role]
                      : draft.roles.filter((item) => item !== role),
                  })
                }
                type="checkbox"
              />
              {roleLabels[role]}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="text-rose-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          className="min-h-11 rounded-lg bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Guardando…' : 'Guardar usuario'}
        </button>
        {onCancel && (
          <button
            className="min-h-11 rounded-lg border border-slate-600 px-4"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
