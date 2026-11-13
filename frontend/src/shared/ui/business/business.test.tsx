import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Money, PartCode, PlateTag, RucPlate, StockIndicator } from './index'

describe('piezas visuales del taller', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('presenta la placa como pieza oscura con cifras de ancho uniforme y la invierte sobre fondo oscuro', () => {
    const { rerender } = render(<PlateTag plate="pba-1234" />)
    const plate = screen.getByText('PBA-1234')
    expect(plate).toHaveClass('code', 'bg-ink')
    expect(plate).not.toHaveClass('font-mono')

    rerender(<PlateTag onDark plate="pba-1234" />)
    expect(screen.getByText('PBA-1234')).toHaveClass('bg-white')
  })

  it('presenta el RUC como una placa accesible sin separadores', () => {
    const { rerender } = render(<RucPlate ruc="1140258475001" size="sm" />)

    const compactPlate = screen.getByText('RUC').parentElement
    expect(compactPlate).toHaveClass('code')
    expect(compactPlate).toHaveTextContent('RUC 1140258475001')
    expect(screen.getByText('1140258475001')).toBeInTheDocument()
    expect(screen.queryByText(/114\.025/)).not.toBeInTheDocument()

    rerender(<RucPlate ruc="1140258475001" size="md" />)
    expect(screen.getByText('RUC').parentElement).toHaveClass('code')
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
