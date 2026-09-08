import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { TechnicalStatusPage } from './TechnicalStatusPage'

afterEach(() => vi.unstubAllGlobals())

it('shows that the technical stack is available', async () => {
  const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchSpy)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <TechnicalStatusPage />
    </QueryClientProvider>,
  )

  expect(
    screen.getByRole('heading', { name: 'Estado técnico' }),
  ).toBeInTheDocument()
  expect(
    await screen.findByText('Backend y PostgreSQL disponibles'),
  ).toBeInTheDocument()
  const retryButton = screen.getByRole('button', {
    name: 'Comprobar nuevamente',
  })
  expect(retryButton).toBeEnabled()
  await userEvent.click(retryButton)
  expect(fetchSpy).toHaveBeenCalledTimes(2)
})

it('shows a controlled unavailable state', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 })),
  )
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <TechnicalStatusPage />
    </QueryClientProvider>,
  )

  expect(
    await screen.findByText('Backend o PostgreSQL no disponible'),
  ).toBeInTheDocument()
})
