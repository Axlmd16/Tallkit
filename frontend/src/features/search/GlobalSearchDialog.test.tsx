import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { GlobalSearchDialog } from './GlobalSearchDialog'
import { clearRecentSearches, recordRecentSearch } from './recent'
import type { GlobalSearchResponse } from './types'

const searchMock = vi.fn()

vi.mock('./api', () => ({
  searchApi: {
    search: (...args: unknown[]) => searchMock(...args),
  },
}))

vi.mock('@/shared/api/entity-logos', () => ({
  useBusinessName: (scope: string) =>
    scope === 'commercial' ? 'Repuestos Jiménez' : 'Taller Jiménez',
}))

function LocationProbe() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function renderDialog(
  props: Partial<{
    open: boolean
    initialQuery: string
    username: string | null
    onClose: () => void
  }> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onClose = props.onClose ?? vi.fn()
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <GlobalSearchDialog
            initialQuery={props.initialQuery ?? ''}
            onClose={onClose}
            open={props.open ?? true}
            username={props.username ?? 'admin'}
          />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

const sampleResponse: GlobalSearchResponse = {
  query: 'mendoza',
  vehicles: {
    total: 2,
    items: [
      {
        id: 10,
        plate: 'GBA-1234',
        label: 'Chevrolet Aveo 2018',
        owner_id: 7,
        owner_name: 'José Mendoza',
        open_order: { id: 45, number: 'ART-OT-000045', status: 'REGISTERED' },
      },
      {
        id: 11,
        plate: 'PCQ-0571',
        label: 'Chevrolet Spark 2020',
        owner_id: 7,
        owner_name: 'José Mendoza',
        open_order: null,
      },
    ],
  },
  customers: {
    total: 1,
    items: [
      {
        id: 7,
        full_name: 'José Mendoza',
        identification_type: 'CI',
        identification: '0912345678',
      },
    ],
  },
  invoices: {
    total: 1,
    items: [
      {
        id: 'prep-uuid-1',
        entity: 'ARTESANAL',
        number: 'ART-SER-000001',
        customer_name: 'José Mendoza',
        date: '2026-11-20',
        state: 'PREPARED',
        total: '40.00',
      },
    ],
  },
  products: {
    total: 1,
    items: [
      {
        id: 3,
        code: 'BUJ-001',
        manufacturer_code: 'MFR-1',
        name: 'Bujía estándar',
        sale_price: '12.50',
        stock: '7',
      },
    ],
  },
}

beforeEach(() => {
  searchMock.mockReset()
  clearRecentSearches()
})

afterEach(() => {
  clearRecentSearches()
})

it('shows grouped results, navigates to open maintenance or vehicle detail, and records recents', async () => {
  searchMock.mockResolvedValue(sampleResponse)
  const user = userEvent.setup()
  const { onClose } = renderDialog({ initialQuery: 'mendoza' })

  await waitFor(() => expect(screen.getByText('GBA-1234')).toBeInTheDocument())
  expect(screen.getByText(/Taller Jiménez · José Mendoza/)).toBeInTheDocument()
  expect(screen.getByText('Preparada, sin enviar')).toBeInTheDocument()
  expect(screen.getByText('Quedan 7')).toBeInTheDocument()

  await user.click(screen.getByText('GBA-1234'))
  expect(onClose).toHaveBeenCalled()
  expect(screen.getByTestId('path')).toHaveTextContent('/maintenance/45')
})

it('navigates vehicle without open order to vehicle detail, and supports keyboard navigation', async () => {
  searchMock.mockResolvedValue(sampleResponse)
  const user = userEvent.setup()
  renderDialog({ initialQuery: 'mendoza' })

  await waitFor(() => expect(screen.getByText('PCQ-0571')).toBeInTheDocument())
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.getByTestId('path')).toHaveTextContent('/vehicles/11')
})

it('navigates to customer, invoice preparation, and product detail', async () => {
  searchMock.mockResolvedValue(sampleResponse)
  const user = userEvent.setup()

  const first = renderDialog({ initialQuery: 'mendoza' })
  await waitFor(() =>
    expect(
      screen.getByText('0912345678', { exact: false }),
    ).toBeInTheDocument(),
  )
  await user.click(screen.getByText('0912345678', { exact: false }))
  expect(screen.getByTestId('path')).toHaveTextContent('/customers/7')
  first.unmount()

  const second = renderDialog({ initialQuery: 'mendoza' })
  await waitFor(() =>
    expect(screen.getByText('ART-SER-000001')).toBeInTheDocument(),
  )
  await user.click(screen.getByText('ART-SER-000001'))
  expect(screen.getByTestId('path')).toHaveTextContent(
    '/fiscal/preparations/prep-uuid-1',
  )
  second.unmount()

  renderDialog({ initialQuery: 'mendoza' })
  await waitFor(() =>
    expect(screen.getByText('Bujía estándar')).toBeInTheDocument(),
  )
  await user.click(screen.getByText('Bujía estándar'))
  expect(screen.getByTestId('path')).toHaveTextContent('/products/3')
})

it('shows empty state and recoverable error with retry, and closes on Escape', async () => {
  searchMock.mockResolvedValueOnce({
    query: 'zzz',
    vehicles: { total: 0, items: [] },
    customers: { total: 0, items: [] },
    invoices: { total: 0, items: [] },
    products: { total: 0, items: [] },
  })
  const user = userEvent.setup()
  const { onClose, unmount } = renderDialog({ initialQuery: 'zzz' })

  await waitFor(() =>
    expect(screen.getByText(/Nada coincide con/)).toBeInTheDocument(),
  )
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
  unmount()

  searchMock.mockRejectedValueOnce(new Error('network'))
  searchMock.mockResolvedValueOnce(sampleResponse)
  renderDialog({ initialQuery: 'mendoza' })
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument(),
  )
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() => expect(screen.getByText('GBA-1234')).toBeInTheDocument())
})

it('keeps recents isolated per user and clears them on logout', () => {
  recordRecentSearch('ana', {
    key: 'customer:7',
    kind: 'customer',
    title: 'José Mendoza',
    subtitle: 'CI 0912345678',
    to: '/customers/7',
  })

  const { unmount } = renderDialog({ username: 'ana', initialQuery: '' })
  expect(screen.getByText('José Mendoza')).toBeInTheDocument()
  unmount()

  const other = renderDialog({ username: 'luis', initialQuery: '' })
  expect(screen.queryByText('José Mendoza')).not.toBeInTheDocument()
  other.unmount()

  clearRecentSearches()
  renderDialog({ username: 'ana', initialQuery: '' })
  expect(screen.queryByText('José Mendoza')).not.toBeInTheDocument()
})
