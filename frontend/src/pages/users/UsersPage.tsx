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

const roleLabels: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  ENCARGADO_TALLER: 'Encargado del taller',
}

export function UsersPage() {
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const [filters, setFilters] = useState<UserFilters>({ page: 1 })
  const [editing, setEditing] = useState<UserSummary | null | undefined>()
  const [notice, setNotice] = useState('')
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
    setNotice('Usuario guardado correctamente.')
  }

  async function changeState(user: UserSummary) {
    const action = user.is_active ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Desea ${action} a ${user.username}?`)) return
    setNotice('')
    try {
      if (user.is_active) await mutations.deactivate.mutateAsync(user.id)
      else await mutations.activate.mutateAsync(user.id)
      setNotice(`Usuario ${user.is_active ? 'desactivado' : 'activado'}.`)
    } catch (caught) {
      setNotice(
        caught instanceof ProblemError &&
          caught.code === 'last_active_administrator'
          ? 'No se puede desactivar el último Administrador activo.'
          : caught instanceof Error
            ? caught.message
            : 'No fue posible cambiar el estado.',
      )
    }
  }

  async function resetPassword(user: UserSummary) {
    if (!window.confirm(`¿Restablecer la contraseña de ${user.username}?`))
      return
    try {
      const result = await mutations.resetPassword.mutateAsync({
        id: user.id,
        operationId: crypto.randomUUID(),
      })
      setTemporaryPassword(result.temporary_password)
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : 'No fue posible restablecer la contraseña.',
      )
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <p className="mt-2 text-slate-300">
            Cuentas internas y sus roles vigentes.
          </p>
        </div>
        {permissions.has('usuarios.crear') && (
          <button
            className="min-h-11 rounded-lg bg-cyan-400 px-4 font-semibold text-slate-950"
            onClick={() => setEditing(null)}
            type="button"
          >
            Crear usuario
          </button>
        )}
      </div>
      <div className="mt-6 grid gap-3 rounded-xl border border-slate-700 p-4 sm:grid-cols-3">
        <label>
          Buscar
          <input
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value, page: 1 })
            }
          />
        </label>
        <label>
          Estado
          <select
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
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
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
        <label>
          Rol
          <select
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            onChange={(event) =>
              setFilters(({ role: _role, ...current }) =>
                event.target.value === ''
                  ? { ...current, page: 1 }
                  : {
                      ...current,
                      role: event.target.value as Role,
                      page: 1,
                    },
              )
            }
          >
            <option value="">Todos</option>
            {Object.entries(roleLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="mt-4 rounded-xl border border-slate-700 p-4">
        <summary className="cursor-pointer font-medium">
          Roles y permisos fijos
        </summary>
        {roles.isPending && <p className="mt-3">Cargando roles…</p>}
        {roles.isError && (
          <p className="mt-3 text-rose-300">
            No fue posible consultar los roles.
          </p>
        )}
        {roles.isSuccess && (
          <ul className="mt-3 space-y-3">
            {roles.data.map((role) => (
              <li key={role.code}>
                <strong>{roleLabels[role.code]}</strong>
                <span className="ml-2 text-sm text-slate-400">
                  {role.permissions.join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
      {notice && (
        <p className="mt-4" role="status">
          {notice}
        </p>
      )}
      {editing !== undefined && (
        <div className="mt-6 rounded-xl border border-slate-700 p-5">
          <h2 className="mb-4 text-xl font-semibold">
            {editing ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
          {editing ? (
            <UserForm
              key={editing.id}
              onCancel={() => setEditing(undefined)}
              onSubmit={save}
              user={editing}
            />
          ) : (
            <UserForm
              key="new"
              onCancel={() => setEditing(undefined)}
              onSubmit={save}
            />
          )}
        </div>
      )}
      {users.isPending && (
        <p className="mt-6" aria-live="polite">
          Cargando usuarios…
        </p>
      )}
      {users.isError && (
        <p className="mt-6 text-rose-300" role="alert">
          No fue posible cargar los usuarios.
        </p>
      )}
      {users.isSuccess && users.data.results.length === 0 && (
        <p className="mt-6">No hay usuarios que coincidan con los filtros.</p>
      )}
      {users.isSuccess && users.data.results.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="p-3">Usuario</th>
                <th className="p-3">Roles</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.data.results.map((user) => (
                <tr className="border-b border-slate-800" key={user.id}>
                  <td className="p-3">
                    {user.username}
                    <span className="block text-sm text-slate-400">
                      {`${user.first_name} ${user.last_name}`.trim()}
                    </span>
                  </td>
                  <td className="p-3">
                    {user.roles.map((role) => roleLabels[role]).join(', ')}
                  </td>
                  <td className="p-3">
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {permissions.has('usuarios.editar') && (
                        <button onClick={() => setEditing(user)} type="button">
                          Editar
                        </button>
                      )}
                      {permissions.has('usuarios.desactivar') && (
                        <button
                          onClick={() => void changeState(user)}
                          type="button"
                        >
                          {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                      {permissions.has('usuarios.restablecer_clave') && (
                        <button
                          onClick={() => void resetPassword(user)}
                          type="button"
                        >
                          Restablecer contraseña
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between">
            <button
              disabled={users.data.page <= 1}
              onClick={() =>
                setFilters({ ...filters, page: (filters.page ?? 1) - 1 })
              }
            >
              Anterior
            </button>
            <span>
              Página {users.data.page} de {Math.max(users.data.total_pages, 1)}
            </span>
            <button
              disabled={users.data.page >= users.data.total_pages}
              onClick={() =>
                setFilters({ ...filters, page: (filters.page ?? 1) + 1 })
              }
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
      {temporaryPassword && (
        <div
          aria-modal="true"
          className="fixed inset-0 grid place-items-center bg-slate-950/80 p-5"
          role="dialog"
        >
          <div className="max-w-md rounded-xl bg-slate-800 p-6">
            <h2 className="text-xl font-bold">Credencial temporal</h2>
            <p className="mt-3">Cópiela ahora. No volverá a mostrarse.</p>
            <code className="mt-4 block break-all rounded bg-slate-950 p-3">
              {temporaryPassword}
            </code>
            <p className="mt-3 text-sm text-slate-300">
              Si la pierde, cierre esta ventana e inicie deliberadamente otro
              restablecimiento.
            </p>
            <button
              className="mt-5 min-h-11 rounded-lg bg-cyan-400 px-4 text-slate-950"
              onClick={() => setTemporaryPassword(null)}
              type="button"
            >
              Ya la copié
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
