import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkoutApi } from '@/features/checkout/api'
import type {
  CheckoutExecuteResponse,
  CheckoutPreview,
} from '@/features/checkout/types'
import { ToastProvider } from '@/shared/ui'

import { CheckoutPage } from './CheckoutPage'

vi.mock('@/features/checkout/api', () => ({
  checkoutApi: {
    previewMaintenance: vi.fn(),
    previewSale: vi.fn(),
    execute: vi.fn(),
  },
}))

const mockPreview: CheckoutPreview = {
  origin: {
    kind: 'MAINTENANCE',
    id: 24,
    number: 'ART-OT-000024',
    state: 'REGISTERED',
    version: 1,
    vehicle_plate: 'GBA-1234',
    vehicle_label: 'Chevrolet Sail',
  },
  customer: {
    id: 5,
    name: 'Carlos Mendoza',
    identification_type: 'CI',
    identification: '0912345678',
    email: 'cmendoza@correo.com',
    address: 'Av. 1',
    is_withholding_agent: false,
    can_save_email: true,
  },
  artisan: {
    visible: true,
    business_name: 'Transmisiones Jimenez',
    has_pending_lines: true,
    operation_id: null,
    document_number: null,
    lines: [
      { description: 'Cambio de pastillas', quantity: '1', total: '20.00' },
    ],
    total: '20.00',
    balance: '20.00',
    can_confirm: true,
    can_collect: true,
    action_needed: true,
    issues: [],
    fiscal: {
      can_prepare_permission: true,
      state: 'NONE',
      preparation_id: null,
      can_prepare: true,
      impediments: [],
      can_use_final_consumer: true,
    },
    withholding: { enabled: true, alert_percentage: '20' },
  },
  commercial: {
    visible: true,
    business_name: 'Repuestos Automotrices',
    pending_sale_id: 9,
    sale_id: 9,
    document_number: null,
    lines: [
      { description: 'Pastillas de freno', quantity: '1', total: '23.00' },
    ],
    total: '23.00',
    balance: '23.00',
    can_confirm: true,
    can_collect: true,
    action_needed: true,
    issues: [],
    fiscal: {
      can_prepare_permission: true,
      state: 'NONE',
      preparation_id: null,
      can_prepare: true,
      impediments: [],
      can_use_final_consumer: true,
    },
    withholding: { enabled: true, alert_percentage: '20' },
  },
  closure: {
    can_close: true,
    default_checked: true,
    missing_requirements: [],
  },
}

const mockSuccess: CheckoutExecuteResponse = {
  overall_status: 'completed',
  origin_kind: 'MAINTENANCE',
  commercial: {
    executed: true,
    sale_id: 9,
    document_number: 'COM-VEN-000009',
    confirmed: true,
    paid: true,
    paid_amount: '23.00',
    fiscal_state: 'PREPARED',
    preparation_id: 'uuid-com',
  },
  artisan: {
    executed: true,
    operation_id: 4,
    document_number: 'ART-SER-000004',
    confirmed: true,
    paid: true,
    paid_amount: '20.00',
    fiscal_state: 'PREPARED',
    preparation_id: 'uuid-art',
  },
  customer_email_updated: false,
  order_closure: { requested: true, closed: true, reason: null },
  replayed: false,
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/maintenance/24/checkout']}>
          <Routes>
            <Route
              element={<CheckoutPage originKind="MAINTENANCE" />}
              path="/maintenance/:id/checkout"
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra los dos negocios separados sin Tarjeta y ejecuta Cobrar y facturar', async () => {
    vi.mocked(checkoutApi.previewMaintenance).mockResolvedValue(mockPreview)
    vi.mocked(checkoutApi.execute).mockResolvedValue(mockSuccess)

    renderPage()

    expect(
      await screen.findByText('Transmisiones Jimenez'),
    ).toBeInTheDocument()
    expect(screen.getByText('Repuestos Automotrices')).toBeInTheDocument()
    expect(screen.queryByText('Tarjeta')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Cobrar y facturar' }),
    )

    await waitFor(() => {
      expect(checkoutApi.execute).toHaveBeenCalledTimes(1)
    })
    const call = vi.mocked(checkoutApi.execute).mock.calls[0]
    expect(call?.[0].origin_kind).toBe('MAINTENANCE')
    expect(call?.[0].include_invoices).toBe(true)
    expect(call?.[0].close_order).toBe(true)

    expect(
      await screen.findByRole('heading', { name: 'Cobro registrado' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('Factura preparada (sin enviar)').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('habilita Solo cobrar cuando falta correo y muestra aviso si cambia el correo guardado', async () => {
    vi.mocked(checkoutApi.previewMaintenance).mockResolvedValue({
      ...mockPreview,
      customer: { ...mockPreview.customer, email: '' },
    })
    vi.mocked(checkoutApi.execute).mockResolvedValue({
      ...mockSuccess,
      commercial: { ...mockSuccess.commercial, fiscal_state: 'SKIPPED' },
      artisan: { ...mockSuccess.artisan, fiscal_state: 'SKIPPED' },
    })

    renderPage()

    const primary = await screen.findByRole('button', {
      name: 'Escribe el correo para facturar',
    })
    expect(primary).toBeDisabled()

    const soloCobrar = screen.getByRole('button', {
      name: 'Solo cobrar (facturar después)',
    })
    await userEvent.click(soloCobrar)

    await waitFor(() => {
      expect(checkoutApi.execute).toHaveBeenCalledTimes(1)
    })
    expect(
      vi.mocked(checkoutApi.execute).mock.calls[0]?.[0].include_invoices,
    ).toBe(false)
  })
})
