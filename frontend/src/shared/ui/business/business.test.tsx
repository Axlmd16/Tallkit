import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Money, PartCode, PlateTag, StockIndicator } from './index'

describe('piezas visuales del taller', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('presenta la placa como dato monoespaciado reconocible', () => {
    render(<PlateTag plate="pba-1234" />)
    expect(screen.getByText('PBA-1234')).toHaveClass('font-mono')
  })

  it('copia el código con una acción de nombre accesible', async () => {
    render(<PartCode code="FLT-0915" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Copiar código FLT-0915' }),
    )
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('FLT-0915'),
    )
    expect(screen.getByText('Código copiado')).toBeInTheDocument()
  })

  it('muestra agotado solo cuando la existencia es cero', () => {
    const { rerender } = render(<StockIndicator quantity="0" />)
    expect(screen.getByText('Agotado')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()

    rerender(<StockIndicator quantity="2" />)
    expect(screen.queryByText('Agotado')).not.toBeInTheDocument()
    expect(screen.queryByText(/Stock bajo/i)).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('formatea importes decimales exactos y usa guion sin dato', () => {
    const { rerender } = render(<Money amount="1240.3" />)
    const amount = screen.getByText('USD 1,240.30')
    expect(amount).toHaveClass('tabular-nums')
    expect(amount).not.toHaveClass('font-mono')

    rerender(<Money amount={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('no redondea mediante aritmética de coma flotante', () => {
    render(<Money amount="9007199254740993.05" />)
    expect(screen.getByText('USD 9,007,199,254,740,993.05')).toBeVisible()
  })
})
