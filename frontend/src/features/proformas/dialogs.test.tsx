import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  issuePreview: {} as Record<string, unknown>,
  conversionPreview: {} as Record<string, unknown>,
  issue: vi.fn(),
  convert: vi.fn(),
  refetch: vi.fn(),
  previewCustomers: [] as (number | null)[],
}))

vi.mock('./pickers', () => ({
  useCustomerPickerOptions: () => ({
    isPending: false,
    isError: false,
    data: {
      totalPages: 1,
      options: [{ id: 3, label: 'Ana Pérez', detail: 'CI 1712345678' }],
    },
  }),
}))

vi.mock('./hooks', () => ({
  useIssuePreview: (_id: number, _version: number, enabled: boolean) =>
    enabled ? mocks.issuePreview : { isPending: false, isError: false },
  useConversionPreview: (
    _id: number,
    _version: number,
    enabled: boolean,
    customerId: number | null,
  ) => {
    mocks.previewCustomers.push(customerId)
    return enabled
      ? mocks.conversionPreview
      : { isPending: false, isError: false }
  },
  useProformaMutations: () => ({
    issue: { mutateAsync: mocks.issue },
    convert: { mutateAsync: mocks.convert },
  }),
}))

import { ConvertDialog } from './ConvertDialog'
import { IssueDialog } from './IssueDialog'
import type { Proforma } from './types'

const proforma = { id: 5, version: 2, customer: { id: 1 } } as Proforma

const issueReview = (overrides: Record<string, unknown> = {}) => ({
  proforma_id: 5,
  version: 2,
  can_issue: true,
  review_token: 'tok-issue',
  issues: [],
  issue_date: '2026-10-06',
  valid_until: '2026-10-13',
  totals: { base: '20.00', tax: '3.00', total: '23.00' },
  warnings: [],
  ...overrides,
})

const comparison = {
  proforma_number: 'COM-PRO-000001',
  products: [
    {
      product_id: 1,
      product_code: 'FIL-1',
      product_name: 'Filtro',
      status: 'CHANGED',
      changes: ['unit_price'],
      quoted: {
        quantity: '1',
        unit_price: '10.00',
        tax_rate: '15',
        base_amount: '8.70',
        tax_amount: '1.30',
        total_amount: '10.00',
      },
      current: {
        quantity: '1',
        unit_price: '12.00',
        tax_rate: '15',
        base_amount: '10.43',
        tax_amount: '1.57',
        total_amount: '12.00',
      },
    },
  ],
  totals: {
    quoted: { base: '8.70', tax: '1.30', total: '10.00' },
    current: { base: '10.43', tax: '1.57', total: '12.00' },
    difference: '2.00',
  },
  has_differences: true,
}

const conversionReview = (overrides: Record<string, unknown> = {}) => ({
  proforma_id: 5,
  version: 2,
  can_convert: true,
  blocked_by: null,
  sale: null,
  issues: [],
  warnings: [],
  comparison,
  review_token: 'tok-convert',
  ...overrides,
})

const ready = (data: unknown) => ({
  isPending: false,
  isError: false,
  data,
  refetch: mocks.refetch,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.previewCustomers.length = 0
  mocks.issuePreview = ready(issueReview())
  mocks.conversionPreview = ready(conversionReview())
})

describe('IssueDialog', () => {
  const open = (onIssued = vi.fn()) =>
    render(
      <IssueDialog
        onClose={vi.fn()}
        onIssued={onIssued}
        open
        proforma={proforma}
      />,
    )

  it('muestra fechas y totales del servidor y emite con la revisión', async () => {
    const user = userEvent.setup()
    const onIssued = vi.fn()
    mocks.issue.mockResolvedValue({ id: 5, internal_number: 'COM-PRO-000001' })
    open(onIssued)
    const values = screen.getByRole('region', { name: 'Valores revisados' })
    expect(within(values).getByText('13/10/2026')).toBeInTheDocument()
    expect(within(values).getByText('USD 23.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Emitir proforma' }))
    expect(mocks.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        expectedVersion: 2,
        reviewToken: 'tok-issue',
      }),
    )
    await waitFor(() => expect(onIssued).toHaveBeenCalled())
  })

  it('un impedimento identifica la línea y no deja emitir', () => {
    mocks.issuePreview = ready(
      issueReview({
        can_issue: false,
        review_token: null,
        issues: [
          {
            code: 'inactive_reference',
            field: 'lines.1.product_id',
            message: 'El producto está inactivo.',
          },
        ],
      }),
    )
    open()
    expect(
      screen.getByText('Línea 2: El producto está inactivo.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Emitir proforma' }),
    ).toBeDisabled()
  })

  it('la disponibilidad insuficiente es un aviso que no impide emitir', () => {
    mocks.issuePreview = ready(
      issueReview({
        warnings: [
          {
            code: 'insufficient_availability',
            product_id: 1,
            product_code: 'FIL-1',
            requested: '3',
            available: '1',
            message: '',
          },
        ],
      }),
    )
    open()
    expect(
      screen.getByRole('list', { name: 'Avisos de disponibilidad' }),
    ).toHaveTextContent('hay 1 y se cotizan 3')
    expect(
      screen.getByRole('button', { name: 'Emitir proforma' }),
    ).toBeEnabled()
  })

  it('una revisión obsoleta exige actualizar y no emite', async () => {
    const user = userEvent.setup()
    const onIssued = vi.fn()
    mocks.issue.mockRejectedValue(
      new ProblemError('Los valores cambiaron.', 409, 'review_required'),
    )
    open(onIssued)
    await user.click(screen.getByRole('button', { name: 'Emitir proforma' }))
    expect(
      await screen.findByText('Los valores cambiaron desde la revisión'),
    ).toBeInTheDocument()
    expect(onIssued).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Emitir proforma' }),
    ).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: 'Actualizar revisión' }),
    )
    expect(mocks.refetch).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Emitir proforma' }),
    ).toBeEnabled()
  })

  it('doble clic o reintento tras respuesta incierta no genera otra clave', async () => {
    const user = userEvent.setup()
    let release: (value: unknown) => void = () => {}
    mocks.issue
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            release = () => reject(new ProblemError('Sin respuesta.', 0, 'net'))
          }),
      )
      .mockResolvedValue({ id: 5, internal_number: 'COM-PRO-000001' })
    open()
    const button = screen.getByRole('button', { name: 'Emitir proforma' })
    await user.dblClick(button)
    expect(mocks.issue).toHaveBeenCalledTimes(1)
    release(null)
    expect(
      await screen.findByText('No sabemos si la proforma se emitió'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar emisión' }))
    await waitFor(() => expect(mocks.issue).toHaveBeenCalledTimes(2))
    expect(mocks.issue.mock.calls[1]![0].key).toBe(
      mocks.issue.mock.calls[0]![0].key,
    )
  })
})

describe('ConvertDialog', () => {
  const open = (onConverted = vi.fn()) =>
    render(
      <MemoryRouter>
        <ConvertDialog
          onClose={vi.fn()}
          onConverted={onConverted}
          open
          proforma={proforma}
        />
      </MemoryRouter>,
    )

  it('muestra lo cotizado frente a los valores actuales antes de convertir', async () => {
    const user = userEvent.setup()
    const onConverted = vi.fn()
    mocks.convert.mockResolvedValue({ id: 5, sale: { id: 9 } })
    open(onConverted)
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('USD 10.00').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('USD 12.00').length).toBeGreaterThan(0)
    expect(within(table).getByText('Cambió precio')).toBeInTheDocument()
    expect(screen.getByText('USD 2.00')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Convertir en venta' }))
    expect(mocks.convert).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 2,
        reviewToken: 'tok-convert',
      }),
    )
    await waitFor(() => expect(onConverted).toHaveBeenCalled())
  })

  it('una oferta vencida o anulada no se convierte', () => {
    mocks.conversionPreview = ready(
      conversionReview({
        can_convert: false,
        comparison: null,
        review_token: null,
        blocked_by: {
          code: 'proforma_expired',
          message: 'La proforma está vencida; cree una nueva vinculada.',
        },
      }),
    )
    open()
    expect(screen.getByText(/La proforma está vencida/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Convertir en venta' }),
    ).toBeDisabled()
  })

  it('una oferta ya convertida enlaza la venta existente', () => {
    mocks.conversionPreview = ready(
      conversionReview({
        can_convert: false,
        comparison: null,
        review_token: null,
        blocked_by: {
          code: 'proforma_converted',
          message: 'Ya fue convertida.',
        },
        sale: { id: 9, internal_number: null, state: 'DRAFT' },
      }),
    )
    open()
    expect(
      screen.getByRole('link', { name: 'Abrir la venta existente' }),
    ).toHaveAttribute('href', '/sales/9')
  })

  it('si otro usuario convirtió primero se informa la misma venta sin crear otra', async () => {
    const user = userEvent.setup()
    const onConverted = vi.fn()
    mocks.convert.mockRejectedValue(
      new ProblemError(
        'La proforma ya fue convertida en venta.',
        409,
        'proforma_converted',
        undefined,
        undefined,
        { type: 'sale', id: 9 },
        { sale: { id: 9, internal_number: null, state: 'DRAFT' } },
      ),
    )
    open(onConverted)
    await user.click(screen.getByRole('button', { name: 'Convertir en venta' }))
    expect(
      await screen.findByRole('link', { name: 'Abrir la venta existente' }),
    ).toHaveAttribute('href', '/sales/9')
    expect(onConverted).not.toHaveBeenCalled()
  })

  it('el reintento tras respuesta incierta reutiliza la clave', async () => {
    const user = userEvent.setup()
    mocks.convert
      .mockRejectedValueOnce(new ProblemError('Sin respuesta.', 0, 'net'))
      .mockResolvedValue({ id: 5, sale: { id: 9 } })
    open()
    await user.click(screen.getByRole('button', { name: 'Convertir en venta' }))
    expect(
      await screen.findByText('No sabemos si la venta se creó'),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Reintentar conversión' }),
    )
    await waitFor(() => expect(mocks.convert).toHaveBeenCalledTimes(2))
    expect(mocks.convert.mock.calls[1]![0].key).toBe(
      mocks.convert.mock.calls[0]![0].key,
    )
  })

  it('referencias inactivas y falta de disponibilidad se distinguen', () => {
    mocks.conversionPreview = ready(
      conversionReview({
        can_convert: false,
        review_token: null,
        issues: [
          {
            code: 'inactive_reference',
            field: 'customer_id',
            message: 'El cliente está inactivo.',
          },
        ],
        warnings: [
          {
            code: 'insufficient_availability',
            product_id: 1,
            product_code: 'FIL-1',
            requested: '3',
            available: '1',
            message: '',
          },
        ],
      }),
    )
    open()
    expect(screen.getByText('El cliente está inactivo.')).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: 'Avisos de disponibilidad' }),
    ).toHaveTextContent('La venta no podrá confirmarse así')
  })

  it('una proforma sin cliente exige elegirlo y lo envía a la venta', async () => {
    const user = userEvent.setup()
    const onConverted = vi.fn()
    const missing = conversionReview({
      can_convert: false,
      requires_customer: true,
      review_token: null,
      issues: [
        {
          code: 'validation_error',
          field: 'customer_id',
          message: 'Seleccione un cliente registrado: la venta lo exige.',
        },
      ],
    })
    mocks.conversionPreview = ready(missing)
    mocks.convert.mockResolvedValue({ id: 5, sale: { id: 9 } })
    render(
      <MemoryRouter>
        <ConvertDialog
          onClose={vi.fn()}
          onConverted={onConverted}
          open
          proforma={{ id: 5, version: 2, customer: null } as Proforma}
        />
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: 'Convertir en venta' })
    expect(button).toBeDisabled()
    expect(screen.queryByText('Resuelva antes de convertir')).toBeNull()
    expect(mocks.previewCustomers.at(-1)).toBeNull()
    const picker = screen.getByRole('combobox', { name: 'Cliente de la venta' })
    await user.click(picker)
    mocks.conversionPreview = ready(
      conversionReview({ requires_customer: true }),
    )
    await user.click(
      within(
        screen.getByRole('listbox', {
          name: 'Resultados de Cliente de la venta',
        }),
      ).getByRole('option', { name: /Ana Pérez/ }),
    )
    expect(mocks.previewCustomers.at(-1)).toBe(3)
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    expect(mocks.convert).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 3, reviewToken: 'tok-convert' }),
    )
    await waitFor(() => expect(onConverted).toHaveBeenCalled())
  })

  it('una proforma con cliente no pide elegir otro', () => {
    open()
    expect(
      screen.queryByRole('combobox', { name: 'Cliente de la venta' }),
    ).toBeNull()
    expect(mocks.previewCustomers.at(-1)).toBeNull()
  })
})
