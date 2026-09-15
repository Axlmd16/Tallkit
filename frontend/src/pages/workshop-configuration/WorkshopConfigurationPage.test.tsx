import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mutation: {
    isError: false,
    isPending: false,
    error: null,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
  },
}))

vi.mock('@/features/workshop-configuration/queries', () => ({
  useWorkshopStatus: () => ({
    data: { is_initialized: true },
    isLoading: false,
    isError: false,
  }),
  useFiscalEntities: () => ({
    data: [
      {
        id: 1,
        entity_type: 'ARTESANAL',
        ruc: '1104018559001',
        legal_name: 'Trasmisiones y Embragues Jimenez',
        trade_name: null,
        address: 'Via Catamayo - Loja Ecuador',
        phone: null,
        email: null,
        version: 2,
      },
      {
        id: 2,
        entity_type: 'COMERCIAL',
        ruc: '1150696977001',
        legal_name: 'Repuestos VVH',
        trade_name: null,
        address: 'Via Catamayo - Loja Ecuador',
        phone: null,
        email: null,
        version: 2,
      },
    ],
    isLoading: false,
  }),
  useWarehouse: () => ({
    data: { id: 1, name: 'Bodega Principal', is_active: true, version: 1 },
    isLoading: false,
  }),
  useAllTaxDefinitions: () => ({
    data: [
      {
        id: 1,
        code: 'IVA',
        name: 'IVA',
        entity_type: 'COMERCIAL',
        current_rate: '15',
        starts_on: '2026-09-15',
      },
    ],
    isLoading: false,
  }),
  useAllDocumentSeries: () => ({
    data: [
      {
        id: 1,
        code: 'COM-VEN',
        is_active: true,
        last_number: 0,
        version: 1,
        document_type: 'VENTA',
        entity_type: 'COMERCIAL',
      },
    ],
    isLoading: false,
  }),
  useUpdateFiscalEntity: () => mocks.mutation,
  useUpdateWarehouse: () => mocks.mutation,
  useCreateTaxDefinition: () => mocks.mutation,
  useCreateTaxPeriod: () => mocks.mutation,
  useUpdateSeriesCode: () => mocks.mutation,
  useInitializeWorkshop: () => mocks.mutation,
}))

import { WorkshopConfigurationPage } from './WorkshopConfigurationPage'

beforeEach(() => {
  vi.clearAllMocks()
})

it('presenta una central de control con secciones de configuración diferenciadas', () => {
  render(<WorkshopConfigurationPage />)

  expect(
    screen.getByRole('navigation', { name: 'Mapa de configuración' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Identidades fiscales' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Operación del inventario' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Impuestos y vigencias' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Series y secuenciales' }),
  ).toBeInTheDocument()
})

it('abre los formularios de edición y creación dentro de diálogos modales', async () => {
  const user = userEvent.setup()
  render(<WorkshopConfigurationPage />)

  await user.click(screen.getAllByRole('button', { name: 'Editar' })[0]!)
  expect(
    screen.getByRole('dialog', { name: 'Editar Entidad Artesanal' }),
  ).toHaveClass('dialog-panel')
  expect(document.querySelector('.drawer-panel')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  await user.click(screen.getByRole('button', { name: 'Nuevo Impuesto' }))
  expect(
    screen.getByRole('dialog', { name: 'Nuevo Impuesto y Vigencia' }),
  ).toHaveClass('dialog-panel')
})
