import { PencilSimple, Plus, Power, Key } from '@phosphor-icons/react'
import { useState } from 'react'

import { useSession } from '@/features/auth/hooks'
import type { Role } from '@/features/auth/types'
import { UserForm } from '@/features/users/UserForm'
import { useRoles, useUserMutations, useUsers } from '@/features/users/hooks'
import type {
  UserFilters,
  UserSummary,
  UserWrite,
} from '@/features/users/types'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Dialog,
  Drawer,
  ElevatedDataList,
  EmptyState,
  Field,
  FilterPanel,
  InlineNotice,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  RowActions,
  Select,
  StatusBadge,
} from '@/shared/ui'

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
}

type Confirmation = { kind: 'state' | 'reset'; user: UserSummary }
type Notice = { text: string; tone: 'success' | 'danger' }

export function UsersPage() {
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const [filters, setFilters] = useState<UserFilters>({ page: 1 })
  const [editing, setEditing] = useState<UserSummary | null | undefined>()
  const [formDirty, setFormDirty] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  )
  const users = useUsers(filters)
  const roles = useRoles()
  const mutations = useUserMutations()

  async function save(data: UserWrite) {
    if (editing) await mutations.update.mutateAsync({ id: editing.id, data })
    else await mutations.create.mutateAsync(data)
    setEditing(undefined)
    setFormDirty(false)
    setNotice({ text: 'Usuario guardado correctamente.', tone: 'success' })
  }

  async function runConfirmation() {
    if (!confirmation) return
    const { kind, user } = confirmation
    setConfirmation(null)
    setNotice(null)
    try {
      if (kind === 'reset') {
        const result = await mutations.resetPassword.mutateAsync({
          id: user.id,
          operationId: crypto.randomUUID(),
        })
        setTemporaryPassword(result.temporary_password)
        return
      }
      if (user.is_active) await mutations.deactivate.mutateAsync(user.id)
      else await mutations.activate.mutateAsync(user.id)
      setNotice({
        text: `Usuario ${user.is_active ? 'desactivado' : 'activado'}.`,
        tone: 'success',
      })
    } catch (caught) {
      const text =
        caught instanceof ProblemError &&
        caught.code === 'last_active_administrator'
          ? 'No se puede desactivar el último Administrador activo.'
          : caught instanceof Error
            ? caught.message
            : kind === 'reset'
              ? 'No fue posible restablecer la contraseña.'
              : 'No fue posible cambiar el estado.'
      setNotice({ text, tone: 'danger' })
    }
  }

  const columns = [
    {
      header: 'Usuario',
      key: 'username' as const,
      priority: 'primary' as const,
      render: (user: UserSummary) => (
        <div className="user-identity">
          <span
            className={`person-avatar avatar-${user.id % 4}`}
            aria-hidden="true"
          >
            {(user.first_name[0] ?? user.username[0])?.toUpperCase()}
            {user.last_name[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="break-words font-semibold">{user.username}</p>
            <p className="break-words text-sm text-ink-muted">
              {`${user.first_name} ${user.last_name}`.trim() ||
                'Sin nombre registrado'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Correo',
      key: 'email' as const,
      priority: 'secondary' as const,
      render: (user: UserSummary) => (
        <span className="user-email">{user.email || '—'}</span>
      ),
    },
    {
      header: 'Roles',
      key: 'roles' as const,
      priority: 'secondary' as const,
      render: (user: UserSummary) => (
        <span className="role-list">
          {user.roles.map((role) => (
            <span className={`role-tag role-${role.toLowerCase()}`} key={role}>
              {roleLabels[role]}
            </span>
          ))}
        </span>
      ),
    },
    {
      header: 'Estado',
      key: 'is_active' as const,
      priority: 'primary' as const,
      render: (user: UserSummary) => (
        <StatusBadge
          label={user.is_active ? 'Activo' : 'Inactivo'}
          tone={user.is_active ? 'success' : 'neutral'}
        />
      ),
    },
  ]

  function actions(user: UserSummary) {
    return (
      <RowActions>
        {permissions.has('usuarios.editar') && (
          <Button
            className="record-action"
            title="Editar"
            aria-label="Editar"
            onClick={() => setEditing(user)}
            variant="quiet"
          >
            <PencilSimple aria-hidden="true" size={18} />
            <span>Editar</span>
          </Button>
        )}
        {permissions.has('usuarios.desactivar') && (
          <Button
            className="record-action"
            title={user.is_active ? 'Desactivar' : 'Activar'}
            aria-label={user.is_active ? 'Desactivar' : 'Activar'}
            onClick={() => setConfirmation({ kind: 'state', user })}
            variant={user.is_active ? 'danger' : 'secondary'}
          >
            <Power aria-hidden="true" size={18} />
            <span>{user.is_active ? 'Desactivar' : 'Activar'}</span>
          </Button>
        )}
        {permissions.has('usuarios.restablecer_clave') && (
          <Button
            className="record-action"
            title="Restablecer contraseña"
            aria-label="Restablecer contraseña"
            onClick={() => setConfirmation({ kind: 'reset', user })}
            variant="secondary"
          >
            <Key aria-hidden="true" size={18} />
            <span>Restablecer contraseña</span>
          </Button>
        )}
      </RowActions>
    )
  }

  return (
    <section className="users-page list-page">
      <PageHeader
        actions={
          permissions.has('usuarios.crear') ? (
            <Button onClick={() => setEditing(null)}>
              <Plus aria-hidden="true" size={19} /> Crear usuario
            </Button>
          ) : undefined
        }
        description="Cuentas internas, estado de acceso y roles vigentes."
        title="Usuarios"
      />

      
      <FilterPanel label="Filtros de usuarios">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field id="user-search" label="Buscar">
            <Input
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value, page: 1 })
              }
              placeholder="Buscar usuario"
              type="search"
            />
          </Field>
          <Field id="user-status" label="Estado">
            <Select
              onChange={(event) =>
                setFilters(({ isActive: _isActive, ...current }) =>
                  event.target.value === ''
                    ? { ...current, page: 1 }
                    : {
                        ...current,
                        isActive: event.target.value === 'true',
                        page: 1,
                      },
                )
              }
            >
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </Field>
          <Field id="user-role" label="Rol">
            <Select
              onChange={(event) =>
                setFilters(({ role: _role, ...current }) =>
                  event.target.value === ''
                    ? { ...current, page: 1 }
                    : { ...current, role: event.target.value as Role, page: 1 },
                )
              }
            >
              <option value="">Todos los roles</option>
              {Object.entries(roleLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FilterPanel>

      {notice && (
        <div className="mt-4">
          <InlineNotice title={notice.text} tone={notice.tone} />
        </div>
      )}

      <Drawer
        description="Complete únicamente la información autorizada para esta cuenta interna."
        hasUnsavedChanges={formDirty}
        onClose={() => {
          setEditing(undefined)
          setFormDirty(false)
        }}
        open={editing !== undefined}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
      >
        {editing !== undefined && (
          <UserForm
            key={editing ? editing.id : 'new'}
            onCancel={() => {
              setEditing(undefined)
              setFormDirty(false)
            }}
            onDirtyChange={setFormDirty}
            onSubmit={save}
            {...(editing ? { user: editing } : {})}
          />
        )}
      </Drawer>

      {users.isPending && <LoadingState label="Cargando usuarios…" />}
      {users.isError && (
        <div className="mt-6">
          <InlineNotice
            title="No fue posible cargar los usuarios."
            tone="danger"
          />
        </div>
      )}
      {users.isSuccess && users.data.results.length === 0 && (
        <div className="mt-6">
          <EmptyState
            description="Cambie o limpie los filtros para ampliar la búsqueda."
            title="No hay usuarios que coincidan con los filtros."
          />
        </div>
      )}
      {users.isSuccess && users.data.results.length > 0 && (
        <>
          <ElevatedDataList
            actions={actions}
            columns={columns}
            getRowKey={(user) => user.id}
            label="Usuarios"
            rows={users.data.results}
          />
          <Pagination
            onNext={() =>
              setFilters({ ...filters, page: (filters.page ?? 1) + 1 })
            }
            onPrevious={() =>
              setFilters({ ...filters, page: (filters.page ?? 1) - 1 })
            }
            page={users.data.page}
            totalPages={users.data.total_pages}
          />
        </>
      )}

      <details className="role-reference">
        <summary className="cursor-pointer py-2 text-sm font-semibold">
          Roles y permisos fijos
        </summary>
        {roles.isPending && <LoadingState label="Cargando roles…" />}
        {roles.isError && (
          <InlineNotice
            title="No fue posible consultar los roles."
            tone="danger"
          />
        )}
        {roles.isSuccess && (
          <ul className="mt-3 space-y-3">
            {roles.data.map((role) => (
              <li
                className="border-t border-line pt-3 first:border-0 first:pt-0"
                key={role.code}
              >
                <strong>{roleLabels[role.code]}</strong>
                <span className="ml-2 break-words text-sm text-ink-muted">
                  {role.permissions.join(', ') || 'Sin permisos adicionales'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <Dialog
        appearance={confirmation?.kind === 'reset' ? 'recover' : 'default'}
        description={
          confirmation
            ? confirmation.kind === 'reset'
              ? `Se generará una credencial temporal para ${confirmation.user.username}. La actual dejará de funcionar.`
              : `El acceso de ${confirmation.user.username} quedará ${confirmation.user.is_active ? 'desactivado' : 'activo'}.`
            : ''
        }
        onClose={() => setConfirmation(null)}
        open={Boolean(confirmation)}
        title={
          confirmation?.kind === 'reset'
            ? 'Restablecer contraseña'
            : confirmation?.user.is_active
              ? 'Desactivar usuario'
              : 'Activar usuario'
        }
      >
        {confirmation?.kind === 'reset' && (
          <div className="recovery-target">
            <span>Identificación de acceso</span>
            <p>{confirmation.user.username}</p>
          </div>
        )}
        <Button onClick={() => setConfirmation(null)} variant="secondary">
          Cancelar
        </Button>
        <Button
          data-autofocus
          onClick={() => void runConfirmation()}
          variant={
            confirmation?.kind === 'state' && confirmation.user.is_active
              ? 'danger'
              : 'primary'
          }
        >
          {confirmation?.kind === 'reset'
            ? 'Confirmar restablecimiento'
            : confirmation?.user.is_active
              ? 'Confirmar desactivación'
              : 'Confirmar activación'}
        </Button>
      </Dialog>

      <Dialog
        appearance="confirm"
        description="Cópiela ahora: por seguridad no volverá a mostrarse después de cerrar este diálogo."
        onClose={() => setTemporaryPassword(null)}
        open={Boolean(temporaryPassword)}
        title="Credencial temporal"
      >
        <div className="w-full">
          <code className="numeric block break-all rounded-control bg-surface-subtle p-3">
            {temporaryPassword}
          </code>
          <p className="mt-3 text-sm text-ink-muted">
            Si la pierde, inicie deliberadamente otro restablecimiento.
          </p>
        </div>
        <Button data-autofocus onClick={() => setTemporaryPassword(null)}>
          Ya la copié
        </Button>
      </Dialog>
    </section>
  )
}
