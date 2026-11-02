import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { FiscalPreparationLink } from './FiscalPreparationLink'
import { expectNoForbiddenFiscalTerms } from './terminology.test-utils'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  navigate: vi.fn(),
  active: { data: null as unknown },
  createPreparation: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as Error | null,
  },
}))

vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('./hooks', () => ({
  useFiscalMutations: () => ({ createPreparation: mocks.createPreparation }),
  useActivePreparation: () => mocks.active,
}))

beforeEach(() => {
  mocks.permissions = []
  mocks.active.data = { preparation_id: null, state: null }
  mocks.navigate.mockReset()
  mocks.createPreparation.mutate.mockReset()
})

it('ofrece «Preparar factura» a quien prepara ventas comerciales', async () => {
  const user = userEvent.setup()
  mocks.permissions = ['fiscal.comercial.preparar']
  const { container } = render(
    <FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={7} />,
  )
  expect(
    screen.getByText(/Todavía no se ha enviado al SRI/),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Preparar factura' }))
  expect(mocks.createPreparation.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ sourceKind: 'COMMERCIAL', sourceId: 7 }),
    expect.anything(),
  )
  expectNoForbiddenFiscalTerms(container)
})

it('muestra una preparación completada como datos listos', async () => {
  const user = userEvent.setup()
  mocks.permissions = ['fiscal.comercial.preparar']
  mocks.active.data = { preparation_id: 'p-1', state: 'PREPARED' }
  const { container } = render(
    <FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={7} />,
  )
  expect(
    screen.getByRole('status', {
      name: 'Estado: Datos listos',
    }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Preparar factura' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Ver datos' }))
  expect(mocks.navigate).toHaveBeenCalledWith('/fiscal/preparations/p-1')
  expectNoForbiddenFiscalTerms(container)
})

it('lleva un borrador existente a «Completar datos»', () => {
  mocks.permissions = ['fiscal.artesanal.preparar']
  mocks.active.data = { preparation_id: 'p-2', state: 'DRAFT' }
  render(<FiscalPreparationLink sourceKind="ARTISAN" sourceId={9} />)
  expect(
    screen.getByRole('status', { name: 'Estado: Por completar' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Completar datos' }),
  ).toBeInTheDocument()
})

it('no habilita el expediente fiscal comercial al Encargado (solo artesanal)', () => {
  mocks.permissions = ['fiscal.artesanal.preparar']
  const { container } = render(
    <FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={7} />,
  )
  expect(container).toBeEmptyDOMElement()
})

it('no muestra los datos fiscales artesanales al Vendedor', () => {
  mocks.permissions = ['fiscal.comercial.preparar']
  const { container } = render(
    <FiscalPreparationLink sourceKind="ARTISAN" sourceId={9} />,
  )
  expect(container).toBeEmptyDOMElement()
})

it('la unión de roles habilita el ámbito comercial', () => {
  mocks.permissions = ['fiscal.comercial.preparar', 'fiscal.artesanal.preparar']
  render(<FiscalPreparationLink sourceKind="COMMERCIAL" sourceId={7} />)
  expect(
    screen.getByRole('button', { name: 'Preparar factura' }),
  ).toBeInTheDocument()
})
