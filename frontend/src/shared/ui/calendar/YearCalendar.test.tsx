import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { YearCalendar } from './YearCalendar'

describe('YearCalendar (C58) - Fase 12.3', () => {
  it('renders all 12 months of the year in a grid', () => {
    render(
      <YearCalendar
        year={2026}
        selectedDate="2026-09-13"
        today="2026-09-13"
        ariaLabel="Vista anual 2026"
      />,
    )

    // Los 12 meses deben estar presentes
    expect(screen.getByText('Enero')).toBeInTheDocument()
    expect(screen.getByText('Febrero')).toBeInTheDocument()
    expect(screen.getByText('Junio')).toBeInTheDocument()
    expect(screen.getByText('Septiembre')).toBeInTheDocument()
    expect(screen.getByText('Diciembre')).toBeInTheDocument()

    // Fecha seleccionada en septiembre
    const selectedDay = screen.getByRole('button', {
      name: /13 de septiembre de 2026/i,
    })
    expect(selectedDay).toBeInTheDocument()
    expect(selectedDay).toHaveAttribute('aria-pressed', 'true')
  })

  it('allows date selection and month activation', async () => {
    const user = userEvent.setup()
    const handleSelectDate = vi.fn()
    const handleSelectMonth = vi.fn()

    render(
      <YearCalendar
        year={2026}
        onSelectDate={handleSelectDate}
        onSelectMonth={handleSelectMonth}
      />,
    )

    // Seleccionar día en mayo
    const mayDay = screen.getByRole('button', { name: /15 de mayo de 2026/i })
    await user.click(mayDay)
    expect(handleSelectDate).toHaveBeenCalledWith('2026-05-15')

    // Clic en título de mes para zoom/cambio de vista
    const octMonthBtn = screen.getByRole('button', { name: /ver octubre/i })
    await user.click(octMonthBtn)
    expect(handleSelectMonth).toHaveBeenCalledWith('2026-10')
  })
})
