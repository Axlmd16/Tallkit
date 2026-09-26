import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import { FiscalPreparationLink } from './FiscalPreparationLink'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  createPreparation: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as Error | null,
  },
}))

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('./hooks', () => ({
  useFiscalMutations: () => ({ createPreparation: mocks.createPreparation }),
}))

beforeEach(() => {
  mocks.permissions = []
})

it('muestra el enlace comercial con permiso comercial', () => {
  mocks.permissions = ['fiscal.comercial.preparar']
  render(<FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={7} />)
  expect(screen.getByText('Preparar factura fiscal')).toBeInTheDocument()
})

it('no habilita el expediente fiscal comercial al Encargado (solo artesanal)', () => {
  mocks.permissions = ['fiscal.artesanal.preparar']
  const { container } = render(
    <FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={7} />,
  )
  expect(container).toBeEmptyDOMElement()
})

it('muestra el enlace artesanal con permiso artesanal', () => {
  mocks.permissions = ['fiscal.artesanal.preparar']
  render(<FiscalPreparationLink sourceKind="ARTISAN" sourceId={9} />)
  expect(screen.getByText('Preparar factura fiscal')).toBeInTheDocument()
})

it('la union de roles habilita el ambito comercial', () => {
  mocks.permissions = ['fiscal.comercial.preparar', 'fiscal.artesanal.preparar']
  render(<FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={7} />)
  expect(screen.getByText('Preparar factura fiscal')).toBeInTheDocument()
})
