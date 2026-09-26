import type { ReactNode } from 'react'

import { useSession } from '@/features/auth/hooks'
import { InlineNotice, PageHeader } from '@/shared/ui'

export function PermissionGuard({
  permission,
  anyOf,
  children,
}: {
  permission?: string
  anyOf?: string[]
  children: ReactNode
}) {
  const session = useSession()
  const accepted = anyOf ?? (permission ? [permission] : [])
  if (!accepted.some((item) => session.data?.permissions.includes(item))) {
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
