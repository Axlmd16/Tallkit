import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EntryReviewDialog } from './EntryReviewDialog'
import type { EntryReview } from './types'

const review = (extra: Partial<EntryReview> = {}): EntryReview => ({
  can_confirm: true,
  issues: [],
  summary: { products: 2, units: 10 },
  supplier: null,
  reference: '',
  observation: '',
  lines: [
    {
      product_id: 1,
      code: 'ACE-1',
      name: 'Aceite',
      unit_name: 'Galón',
      unit_symbol: 'gal',
      quantity: '4',
    },
    {
      product_id: 2,
      code: 'FIL-1',
      name: 'Filtro',
      unit_name: 'Unidad',
      unit_symbol: 'u',
      quantity: '6',
    },
  ],
  duplicates: [],
  requires_acknowledgement: false,
  ...extra,
})

function open(r: EntryReview | null, props: Record<string, unknown> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <EntryReviewDialog
      message={null}
      onClose={onClose}
      onConfirm={onConfirm}
      pending={false}
      review={r}
      {...props}
    />,
  )
  return { onConfirm, onClose }
}

describe('EntryReviewDialog', () => {
  it('resume cuántos productos y unidades entran', () => {
    open(review())
    expect(screen.getByRole('status')).toHaveTextContent(
      'Entran 2 productos · 10 unidades',
    )
    expect(screen.getByRole('list', { name: /que entran/i })).toHaveTextContent(
      'ACE-1',
    )
  })

  it('usa el singular y no muestra detalles que no se informaron', () => {
    open(review({ summary: { products: 1, units: 1 } }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Entran 1 producto · 1 unidad',
    )
    expect(screen.queryByText('Proveedor')).not.toBeInTheDocument()
    expect(screen.queryByText('Referencia')).not.toBeInTheDocument()
  })

  it('muestra proveedor, referencia y observación solo si existen y nunca costos', () => {
    open(
      review({
        supplier: { id: 3, name: 'Repuestos SA' },
        reference: 'F-001',
        observation: 'Llegó tarde',
      }),
    )
    expect(screen.getByText('Repuestos SA')).toBeInTheDocument()
    expect(screen.getByText('F-001')).toBeInTheDocument()
    expect(screen.getByText('Llegó tarde')).toBeInTheDocument()
    expect(screen.queryByText(/costo|USD|\$/i)).not.toBeInTheDocument()
  })

  it('confirma sin reconocimientos cuando no hay coincidencias', async () => {
    const { onConfirm } = open(review())
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar entrada' }),
    )
    expect(onConfirm).toHaveBeenCalledWith([])
  })

  it('una posible entrada repetida exige reconocerla y envía sus identificadores', async () => {
    const { onConfirm } = open(
      review({
        requires_acknowledgement: true,
        duplicates: [
          {
            purchase_id: 7,
            internal_number: 'COM-ING-000007',
            confirmed_at: null,
          },
        ],
      }),
    )
    const confirm = screen.getByRole('button', { name: 'Confirmar entrada' })
    expect(confirm).toBeDisabled()
    expect(screen.getByText(/COM-ING-000007/)).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('checkbox', { name: /otra entrada/i }),
    )
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith([7])
  })

  it('los problemas bloquean la confirmación y se explican', () => {
    open(
      review({
        can_confirm: false,
        issues: [
          {
            code: 'inactive_reference',
            field: 'lines.0.product_id',
            message: 'El producto está inactivo.',
          },
        ],
      }),
    )
    expect(screen.getByText('El producto está inactivo.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirmar entrada' }),
    ).toBeDisabled()
  })

  it('mientras confirma evita el doble envío', () => {
    open(review(), { pending: true })
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeDisabled()
  })

  it('cancelar cierra sin confirmar y sin revisión no muestra nada', async () => {
    const { onClose, onConfirm } = open(review())
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('sin revisión el diálogo permanece cerrado', () => {
    open(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el aviso de revisión actualizada', () => {
    open(review(), { message: 'Los datos cambiaron.' })
    expect(screen.getByText('Los datos cambiaron.')).toBeInTheDocument()
  })
})
