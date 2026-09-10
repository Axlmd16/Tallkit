import type { ReactNode } from 'react'

import { useSession } from '@/features/auth/hooks'

export function PermissionGuard({
  permission,
  children,
}: {
  permission: string
  children: ReactNode
}) {
  const session = useSession()
  if (!session.data?.permissions.includes(permission)) {
    return (
      <section>
        <h1 className="text-3xl font-bold">Acceso no permitido</h1>
        <p className="mt-3 text-slate-300">
          Su usuario no puede consultar esta función.
        </p>
      </section>
    )
  }
  return children
}
