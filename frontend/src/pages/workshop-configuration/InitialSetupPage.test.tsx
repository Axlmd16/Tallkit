import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  status: { isLoading: false, data: { is_initialized: false } as unknown },
  entities: { data: [] as unknown[] },
  taxes: { data: [] as unknown[] },
  init: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
  readiness: { byEntity: {} as Record<number, unknown> },
  navigate: vi.fn(),
}))

vi.mock('react-router', async (orig) => {
  const actual = await orig<Record<string, unknown>>()
  return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('@/features/workshop-configuration/queries', () => ({
  useWorkshopStatus: () => mocks.status,
  useFiscalEntities: () => mocks.entities,
  useAllTaxDefinitions: () => mocks.taxes,
  useInitializeWorkshop: () => mocks.init,
  useUpdateFiscalEntity: () => mocks.update,
}))

vi.mock('@/features/fiscal/configuration/readiness', () => ({
  useConfigurationReadiness: () => mocks.readiness,
}))

import { InitialSetupPage } from './InitialSetupPage'

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <InitialSetupPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.status = { isLoading: false, data: { is_initialized: false } }
  mocks.entities = { data: [] }
  mocks.taxes = { data: [] }
  mocks.readiness = { byEntity: {} }
})

describe('InitialSetupPage', () => {
  it('muestra estado de carga mientras consulta el estado del taller', () => {
    mocks.status = { isLoading: true, data: undefined }
    renderPage()
    expect(
      screen.getByText(/Cargando configuración inicial/),
    ).toBeInTheDocument()
  })

  it('valida RUC y nombres, inicializa el taller y permite recorrer los 5 pasos', async () => {
    const user = userEvent.setup()
    mocks.init.mutateAsync.mockResolvedValue({})
    renderPage()

    // Intento con RUCs vacíos
    await user.click(
      screen.getByRole('button', { name: /Guardar y seguir|Siguiente/i }),
    )
    expect(screen.getByText(/RUC válido de 13 dígitos/)).toBeInTheDocument()

    // Completa RUCs pero sin nombres
    const rucInputs = screen.getAllByPlaceholderText('13 dígitos')
    await user.type(rucInputs[0]!, '1790000000002')
    await user.type(rucInputs[1]!, '1790000000001')
    await user.click(
      screen.getByRole('button', { name: /Guardar y seguir|Siguiente/i }),
    )
    expect(screen.getByText(/nombre o razón social/)).toBeInTheDocument()

    // Completa nombres comerciales y razones sociales
    const tradeInputs = screen.getAllByLabelText(
      /Nombre que verán los clientes/,
    )
    const legalInputs = screen.getAllByLabelText(/Razón social/)
    await user.type(tradeInputs[0]!, 'Taller Norte')
    await user.type(legalInputs[0]!, 'Taller Norte Artesanal')
    await user.type(tradeInputs[1]!, 'Repuestos Norte')
    await user.type(legalInputs[1]!, 'Repuestos Norte S.A.')

    await user.click(
      screen.getByRole('button', { name: /Guardar y seguir|Siguiente/i }),
    )
    await waitFor(() => expect(mocks.init.mutateAsync).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Paso 2 de 5')).toBeInTheDocument()

    // Avanza por los pasos 3, 4 y 5
    await user.click(screen.getByRole('button', { name: /Impuestos/ }))
    expect(screen.getByText('Paso 3 de 5')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /Personas con acceso/ }),
    )
    expect(screen.getByText('Paso 4 de 5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Listo/ }))
    expect(screen.getByText('Paso 5 de 5')).toBeInTheDocument()
  })

  it('cuando ya está inicializado precarga entidades y las actualiza al guardar', async () => {
    const user = userEvent.setup()
    mocks.status = { isLoading: false, data: { is_initialized: true } }
    mocks.entities = {
      data: [
        {
          id: 1,
          entity_type: 'ARTESANAL',
          ruc: '1790000000002',
          legal_name: 'Artesanal Legal',
          trade_name: 'Taller A',
          version: 2,
        },
        {
          id: 2,
          entity_type: 'COMERCIAL',
          ruc: '1790000000001',
          legal_name: 'Comercial Legal',
          trade_name: 'Almacén B',
          version: 3,
        },
      ],
    }
    mocks.update.mutateAsync.mockResolvedValue({})
    renderPage()

    await user.click(
      screen.getByRole('button', { name: /Guardar y seguir|Siguiente/i }),
    )
    await waitFor(() =>
      expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(2),
    )
    expect(screen.getByText('Paso 2 de 5')).toBeInTheDocument()
  })
})
