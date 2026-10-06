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
import { CustomerEditorPage } from '@/pages/customers/CustomerEditorPage'
import { CustomersPage } from '@/pages/customers/CustomersPage'
import { HomePage } from '@/pages/home/HomePage'
import { FiscalArchivePage } from '@/pages/fiscal/FiscalArchivePage'
import { FiscalCorrectionsPage } from '@/pages/fiscal/FiscalCorrectionsPage'
import { FiscalPreparationPage } from '@/pages/fiscal/FiscalPreparationPage'
import { LoginPage } from '@/pages/login/LoginPage'
import { MeasurementUnitsPage } from '@/pages/measurement-units/MeasurementUnitsPage'
import { ProductBrandsPage } from '@/pages/product-brands/ProductBrandsPage'
import { ProductCategoriesPage } from '@/pages/product-categories/ProductCategoriesPage'
import { InventoryOperationDetailPage } from '@/pages/inventory/InventoryOperationDetailPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { KardexPage } from '@/pages/inventory/KardexPage'
import { ProductDetailPage } from '@/pages/products/ProductDetailPage'
import { ProductEditorPage } from '@/pages/products/ProductEditorPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { EntryPage } from '@/pages/purchases/EntryPage'
import { PurchaseDetailPage } from '@/pages/purchases/PurchaseDetailPage'
import { PurchasesPage } from '@/pages/purchases/PurchasesPage'
import { MaintenanceOrderDetailPage } from '@/pages/maintenance/MaintenanceOrderDetailPage'
import { ArtisanReceivablesPage } from '@/pages/maintenance/ArtisanReceivablesPage'
import { CommercialOrderViewPage } from '@/pages/maintenance/CommercialOrderViewPage'
import { ServiceOperationDetailPage } from '@/pages/maintenance/ServiceOperationDetailPage'
import { ServiceOperationDocumentPage } from '@/pages/maintenance/ServiceOperationDocumentPage'
import { MaintenanceOrderEditorPage } from '@/pages/maintenance/MaintenanceOrderEditorPage'
import { MaintenanceOrdersPage } from '@/pages/maintenance/MaintenanceOrdersPage'
import { ReceivablesPage } from '@/pages/sales/ReceivablesPage'
import { PendingWithholdingsPage } from '@/pages/withholdings/PendingWithholdingsPage'
import { SaleDetailPage } from '@/pages/sales/SaleDetailPage'
import { SaleDocumentPage } from '@/pages/sales/SaleDocumentPage'
import { SaleEditorPage } from '@/pages/sales/SaleEditorPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { ServicesPage } from '@/pages/services/ServicesPage'
import { SupplierDetailPage } from '@/pages/suppliers/SupplierDetailPage'
import { SupplierEditorPage } from '@/pages/suppliers/SupplierEditorPage'
import { SuppliersPage } from '@/pages/suppliers/SuppliersPage'
import { TechnicalStatusPage } from '@/pages/technical-status/TechnicalStatusPage'
import { UsersPage } from '@/pages/users/UsersPage'
import { VehicleBrandsPage } from '@/pages/vehicle-brands/VehicleBrandsPage'
import { VehicleDetailPage } from '@/pages/vehicles/VehicleDetailPage'
import { VehicleEditorPage } from '@/pages/vehicles/VehicleEditorPage'
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
            path: '/fiscal/preparations/:id',
            element: (
              <PermissionGuard
                anyOf={['fiscal.comercial.ver', 'fiscal.artesanal.ver']}
              >
                <FiscalPreparationPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/fiscal/archive',
            element: (
              <PermissionGuard permission="fiscal.archivo.gestionar">
                <FiscalArchivePage />
              </PermissionGuard>
            ),
          },
          {
            path: '/fiscal/corrections',
            element: (
              <PermissionGuard permission="fiscal.correcciones.gestionar">
                <FiscalCorrectionsPage />
              </PermissionGuard>
            ),
          },
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
            path: '/customers/new',
            element: (
              <PermissionGuard permission="clientes.gestionar">
                <CustomerEditorPage />
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
            path: '/customers/:id/edit',
            element: (
              <PermissionGuard permission="clientes.gestionar">
                <CustomerEditorPage />
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
            path: '/vehicles/new',
            element: (
              <PermissionGuard permission="vehiculos.gestionar">
                <VehicleEditorPage />
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
            path: '/vehicles/:id/edit',
            element: (
              <PermissionGuard permission="vehiculos.gestionar">
                <VehicleEditorPage />
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
            path: '/products/new',
            element: (
              <PermissionGuard permission="productos.gestionar">
                <ProductEditorPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/products/:id/edit',
            element: (
              <PermissionGuard permission="productos.gestionar">
                <ProductEditorPage />
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
            path: '/purchases',
            element: (
              <PermissionGuard permission="ingresos.ver">
                <PurchasesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/purchases/new',
            element: (
              <PermissionGuard permission="ingresos.crear">
                <EntryPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/purchases/:id',
            element: (
              <PermissionGuard permission="ingresos.ver">
                <PurchaseDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/sales',
            element: (
              <PermissionGuard permission="ventas.ver">
                <SalesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/sales/new',
            element: (
              <PermissionGuard permission="ventas.crear">
                <SaleEditorPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/sales/receivables',
            element: (
              <PermissionGuard permission="pagos_comerciales.ver">
                <ReceivablesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/sales/withholdings',
            element: (
              <PermissionGuard permission="pagos_comerciales.ver">
                <PendingWithholdingsPage scope="commercial" />
              </PermissionGuard>
            ),
          },
          {
            path: '/sales/:id',
            element: (
              <PermissionGuard permission="ventas.ver">
                <SaleDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/sales/:id/edit',
            element: (
              <PermissionGuard permission="ventas.crear">
                <SaleEditorPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/sales/:id/document',
            element: (
              <PermissionGuard permission="ventas.ver">
                <SaleDocumentPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance',
            element: (
              <PermissionGuard permission="mantenimientos.ver">
                <MaintenanceOrdersPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/receivables',
            element: (
              <PermissionGuard permission="pagos_artesanales.ver">
                <ArtisanReceivablesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/withholdings',
            element: (
              <PermissionGuard permission="pagos_artesanales.ver">
                <PendingWithholdingsPage scope="artesanal" />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/service-operations/:id',
            element: (
              <PermissionGuard permission="servicios_economicos.ver">
                <ServiceOperationDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/service-operations/:id/document',
            element: (
              <PermissionGuard permission="servicios_economicos.ver">
                <ServiceOperationDocumentPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/:id/commercial',
            element: (
              <PermissionGuard permission="ventas.ver">
                <CommercialOrderViewPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/new',
            element: (
              <PermissionGuard permission="mantenimientos.gestionar">
                <MaintenanceOrderEditorPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/:id',
            element: (
              <PermissionGuard permission="mantenimientos.ver">
                <MaintenanceOrderDetailPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/maintenance/:id/edit',
            element: (
              <PermissionGuard permission="mantenimientos.gestionar">
                <MaintenanceOrderEditorPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/inventory',
            element: (
              <PermissionGuard permission="inventario.ver">
                <InventoryPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/inventory/products/:id/kardex',
            element: (
              <PermissionGuard permission="inventario.ver">
                <KardexPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/inventory/operations/:id',
            element: (
              <PermissionGuard permission="inventario.ver">
                <InventoryOperationDetailPage />
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
            path: '/suppliers/new',
            element: (
              <PermissionGuard permission="proveedores.gestionar">
                <SupplierEditorPage />
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
            path: '/suppliers/:id/edit',
            element: (
              <PermissionGuard permission="proveedores.gestionar">
                <SupplierEditorPage />
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
