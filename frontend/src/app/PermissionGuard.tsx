import type { ReactNode } from 'react'

import { useSession } from '@/features/auth/hooks'
import { InlineNotice, PageHeader } from '@/shared/ui'

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
        <PageHeader title="Acceso no permitido" />
        <div className="mt-6 max-w-2xl">
          <InlineNotice title="Esta función no está disponible" tone="warning">
            Su usuario no puede consultar esta función.
          </InlineNotice>
        </div>
      </section>
    )
  }
  return children
}
