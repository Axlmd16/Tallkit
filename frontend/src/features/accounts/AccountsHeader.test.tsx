import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  enabled: [] as boolean[],
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/home/hooks', () => ({
  useHomeReceivables: (enabled: boolean) => {
    mocks.enabled.push(enabled)
    return {
      data: {
        items: [
          { scope: 'commercial', balance: '98.00', customers: 3 },
          { scope: 'artisan', balance: '65.00', customers: 2 },
        ],
      },
    }
  },
  useHomePending: () => ({
    data: {
      items: [
        { key: 'withholdings_pending', scope: 'commercial', count: 1 },
        { key: 'withholdings_pending', scope: 'artisan', count: 3 },
      ],
    },
  }),
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrand: (scope: string) => ({
    logoUrl: null,
    legalName: undefined,
    displayName: scope === 'COMERCIAL' ? 'Almacén' : 'Taller',
  }),
}))

import { AccountsHeader } from './AccountsHeader'

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/maintenance/receivables']}>
      <Routes>
        <Route
          element={
            <>
              <AccountsHeader business="artesanal" view="receivables" />
              <Where />
            </>
          }
          path="/maintenance/receivables"
        />
        <Route element={<Where />} path="/maintenance/withholdings" />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.enabled.length = 0
  mocks.permissions = ['pagos_comerciales.ver', 'pagos_artesanales.ver']
})

it('muestra una tarjeta por negocio con su propia deuda y ningún total conjunto', () => {
  renderHeader()
  const taller = screen.getByRole('link', { name: /Taller/ })
  const almacen = screen.getByRole('link', { name: /Almacén/ })
  expect(within(taller).getByText('USD 65.00')).toBeInTheDocument()
  expect(within(almacen).getByText('USD 98.00')).toBeInTheDocument()
  expect(taller).toHaveAttribute('aria-current', 'page')
  expect(almacen).not.toHaveAttribute('aria-current')
  expect(document.body.textContent).not.toMatch(/163\.00/)
  expect(taller).toHaveAttribute('href', '/maintenance/receivables')
  expect(almacen).toHaveAttribute('href', '/sales/receivables')
})

it('quien solo ve un negocio no ve la tarjeta del otro', () => {
  mocks.permissions = ['pagos_artesanales.ver']
  renderHeader()
  expect(screen.queryByRole('link', { name: /Almacén/ })).toBeNull()
  expect(screen.getByRole('link', { name: /Taller/ })).toBeInTheDocument()
})

it('el segmento «Retenciones» cambia de lista dentro del mismo negocio', async () => {
  const user = userEvent.setup()
  renderHeader()
  const group = screen.getByRole('radiogroup', { name: 'Ver cuentas' })
  expect(group).toHaveTextContent('Retenciones3')
  await user.click(screen.getByRole('radio', { name: /Retenciones/ }))
  expect(screen.getByTestId('where')).toHaveTextContent(
    '/maintenance/withholdings',
  )
})
