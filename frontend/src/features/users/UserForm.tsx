import { User } from '@phosphor-icons/react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import type { Role } from '@/features/auth/types'
import {
  Button,
  ButtonGroup,
  Checkbox,
  Field,
  InlineNotice,
  Input,
} from '@/shared/ui'

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
  onDirtyChange,
}: {
  user?: UserSummary
  onSubmit: (data: UserWrite) => Promise<void>
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const initial = useMemo<UserWrite>(
    () =>
      user
        ? {
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            roles: user.roles,
          }
        : empty,
    [user],
  )
  const [draft, setDraft] = useState<UserWrite>(initial)
  const [summary, setSummary] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [rolesError, setRolesError] = useState('')
  const [pending, setPending] = useState(false)
  const locked = useRef(false)
  const rolesErrorId = useId()
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    const missingUsername = !draft.username.trim()
    const missingRoles = draft.roles.length === 0
    setUsernameError(
      missingUsername ? 'Ingrese la identificación de acceso.' : '',
    )
    setRolesError(missingRoles ? 'Seleccione al menos un rol.' : '')
    if (missingUsername || missingRoles) {
      setSummary(
        missingUsername && missingRoles
          ? 'Revise los campos señalados.'
          : missingUsername
            ? 'Ingrese la identificación de acceso.'
            : 'Seleccione al menos un rol.',
      )
      return
    }

    locked.current = true
    setPending(true)
    setSummary('')
    try {
      await onSubmit({ ...draft, username: draft.username.trim() })
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'No fue posible guardar el usuario.'
      setSummary(message)
      setUsernameError(message)
    } finally {
      locked.current = false
      setPending(false)
    }
  }

  return (
    <form
      className="user-form space-y-6"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <div className="user-form-avatar" aria-hidden="true">
        {user ? (
          `${user.first_name[0] ?? user.username[0]}${user.last_name[0] ?? ''}`.toUpperCase()
        ) : (
          <User size={62} weight="fill" />
        )}
      </div>
      {summary && <InlineNotice title={summary} tone="danger" />}

      <div
        className="grid grid-cols-1 gap-5 md:grid-cols-2"
        data-testid="user-fields"
      >
        <Field
          className="md:col-span-2"
          error={usernameError || undefined}
          id="user-username"
          label="Identificación de acceso"
        >
          <Input
            data-autofocus
            onChange={(event) =>
              setDraft({ ...draft, username: event.target.value })
            }
            value={draft.username}
          />
        </Field>
        <Field id="user-first-name" label="Nombres">
          <Input
            autoComplete="given-name"
            onChange={(event) =>
              setDraft({ ...draft, first_name: event.target.value })
            }
            value={draft.first_name}
          />
        </Field>
        <Field id="user-last-name" label="Apellidos">
          <Input
            autoComplete="family-name"
            onChange={(event) =>
              setDraft({ ...draft, last_name: event.target.value })
            }
            value={draft.last_name}
          />
        </Field>
        <Field
          className="md:col-span-2"
          id="user-email"
          label="Correo opcional"
        >
          <Input
            autoComplete="email"
            onChange={(event) =>
              setDraft({ ...draft, email: event.target.value })
            }
            type="email"
            value={draft.email}
          />
        </Field>
      </div>

      <fieldset
        aria-describedby={rolesError ? rolesErrorId : undefined}
        aria-invalid={Boolean(rolesError)}
        className="rounded-group bg-surface-muted p-4"
      >
        <legend className="px-1 font-semibold text-ink">Roles</legend>
        <p className="mt-1 text-sm text-ink-muted">
          Puede asignar uno o varios roles según las funciones de la persona.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {allRoles.map((role) => (
            <Checkbox
              checked={draft.roles.includes(role)}
              key={role}
              label={roleLabels[role]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  roles: event.target.checked
                    ? [...draft.roles, role]
                    : draft.roles.filter((item) => item !== role),
                })
              }
            />
          ))}
        </div>
        {rolesError && (
          <p
            className="mt-2 text-sm font-semibold text-danger"
            id={rolesErrorId}
          >
            {rolesError}
          </p>
        )}
      </fieldset>

      {dirty && (
        <p className="text-sm text-warning" role="status">
          Hay cambios sin guardar.
        </p>
      )}
      <ButtonGroup label="Acciones del formulario">
        <Button pending={pending} pendingLabel="Guardando…" type="submit">
          Guardar usuario
        </Button>
        {onCancel && (
          <Button onClick={onCancel} variant="secondary">
            Cancelar
          </Button>
        )}
      </ButtonGroup>
    </form>
  )
}
