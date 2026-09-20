import { QueryClientProvider } from '@tanstack/react-query'
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from 'react-router'

import { RemoteSessionGuard } from '@/features/auth/SessionGuard'
import { ChangePasswordPage } from '@/pages/change-password/ChangePasswordPage'
import { AuditPage } from '@/pages/audit/AuditPage'
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage'
import { CustomersPage } from '@/pages/customers/CustomersPage'
import { HomePage } from '@/pages/home/HomePage'
import { LoginPage } from '@/pages/login/LoginPage'
import { MeasurementUnitsPage } from '@/pages/measurement-units/MeasurementUnitsPage'
import { ProductBrandsPage } from '@/pages/product-brands/ProductBrandsPage'
import { ProductCategoriesPage } from '@/pages/product-categories/ProductCategoriesPage'
import { ProductDetailPage } from '@/pages/products/ProductDetailPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { ServiceDetailPage } from '@/pages/services/ServiceDetailPage'
import { ServicesPage } from '@/pages/services/ServicesPage'
import { SupplierDetailPage } from '@/pages/suppliers/SupplierDetailPage'
import { SuppliersPage } from '@/pages/suppliers/SuppliersPage'
import { TechnicalStatusPage } from '@/pages/technical-status/TechnicalStatusPage'
import { UsersPage } from '@/pages/users/UsersPage'
import { VehicleBrandsPage } from '@/pages/vehicle-brands/VehicleBrandsPage'
import { VehicleDetailPage } from '@/pages/vehicles/VehicleDetailPage'
import { VehiclesPage } from '@/pages/vehicles/VehiclesPage'

import { RemoteAuthenticatedShell } from './AuthenticatedShell'
import { PermissionGuard } from './PermissionGuard'
import { createAppQueryClient } from './query-client'

import { WorkshopConfigurationPage } from '@/pages/workshop-configuration/WorkshopConfigurationPage'

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
            path: '/customers',
            element: (
              <PermissionGuard permission="clientes.ver">
                <CustomersPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/customers/:id',
            element: (
              <PermissionGuard permission="clientes.ver">
                <CustomerDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/vehicle-brands',
            element: (
              <PermissionGuard permission="marcas_vehiculo.ver">
                <VehicleBrandsPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/vehicles',
            element: (
              <PermissionGuard permission="vehiculos.ver">
                <VehiclesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/vehicles/:id',
            element: (
              <PermissionGuard permission="vehiculos.ver">
                <VehicleDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/products',
            element: (
              <PermissionGuard permission="productos.ver">
                <ProductsPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/products/:id',
            element: (
              <PermissionGuard permission="productos.ver">
                <ProductDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/product-categories',
            element: (
              <PermissionGuard permission="productos.ver">
                <ProductCategoriesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/measurement-units',
            element: (
              <PermissionGuard permission="productos.ver">
                <MeasurementUnitsPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/product-brands',
            element: (
              <PermissionGuard permission="productos.ver">
                <ProductBrandsPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/services',
            element: (
              <PermissionGuard permission="servicios.ver">
                <ServicesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/services/:id',
            element: (
              <PermissionGuard permission="servicios.ver">
                <ServiceDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/suppliers',
            element: (
              <PermissionGuard permission="proveedores.ver">
                <SuppliersPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/suppliers/:id',
            element: (
              <PermissionGuard permission="proveedores.ver">
                <SupplierDetailPage />
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
          {
            path: '/configuration',
            element: (
              <PermissionGuard permission="parametros.gestionar">
                <WorkshopConfigurationPage />
              </PermissionGuard>
            ),
          },
          { path: '*', element: <Navigate replace to="/" /> },
        ],
      },
    ],
  },
]

const queryClient = createAppQueryClient()

const browserRouter = createBrowserRouter(appRoutes)
type AppRouter = ReturnType<typeof createBrowserRouter>

export function App({ router = browserRouter }: { router?: AppRouter }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
