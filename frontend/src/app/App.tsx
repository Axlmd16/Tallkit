import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from 'react-router'

import { RemoteSessionGuard } from '@/features/auth/SessionGuard'
import { ChangePasswordPage } from '@/pages/change-password/ChangePasswordPage'
import { AuditPage } from '@/pages/audit/AuditPage'
import { HomePage } from '@/pages/home/HomePage'
import { LoginPage } from '@/pages/login/LoginPage'
import { TechnicalStatusPage } from '@/pages/technical-status/TechnicalStatusPage'
import { UsersPage } from '@/pages/users/UsersPage'

import { RemoteAuthenticatedShell } from './AuthenticatedShell'
import { PermissionGuard } from './PermissionGuard'

export const appRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RemoteSessionGuard />,
    children: [
      { path: '/change-password', element: <ChangePasswordPage /> },
      {
        element: <RemoteAuthenticatedShell />,
        children: [
          { index: true, element: <HomePage /> },
          {
            path: '/users',
            element: (
              <PermissionGuard permission="usuarios.ver">
                <UsersPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/audit',
            element: (
              <PermissionGuard permission="auditoria.ver">
                <AuditPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/technical-status',
            element: (
              <PermissionGuard permission="operacion.ver_estado">
                <TechnicalStatusPage />
              </PermissionGuard>
            ),
          },
          { path: '*', element: <Navigate replace to="/" /> },
        ],
      },
    ],
  },
]

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

const browserRouter = createBrowserRouter(appRoutes)
type AppRouter = ReturnType<typeof createBrowserRouter>

export function App({ router = browserRouter }: { router?: AppRouter }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
