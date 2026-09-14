import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthCalendar, type CalendarEventItem } from './MonthCalendar'

describe('MonthCalendar (C57) - Fase 12.2', () => {
  const sampleEvents: CalendarEventItem[] = [
    {
      id: 'e1',
      date: '2026-09-14',
      title: 'Mantenimiento preventivo',
      tone: 'primary',
      time: '09:00',
    },
    {
      id: 'e2',
      date: '2026-09-14',
      title: 'Revisión de frenos',
      tone: 'warning',
      time: '14:30',
    },
    {
      id: 'e3',
      date: '2026-09-22',
      title: 'Entrega de vehículo',
      tone: 'success',
    },
  ]

  it('renders 7-column month grid and day cells', () => {
    render(
      <MonthCalendar
        currentMonth="2026-09"
        selectedDate="2026-09-13"
        today="2026-09-13"
        events={sampleEvents}
        ariaLabel="Calendario de septiembre 2026"
      />,
    )

    const grid = screen.getByRole('grid', {
      name: /calendario de septiembre 2026/i,
    })
    expect(grid).toBeInTheDocument()

    // Encabezados de días de la semana
    expect(screen.getByText('Lunes')).toBeInTheDocument()
    expect(screen.getByText('Domingo')).toBeInTheDocument()

    // Día 13 de septiembre
    const cell13 = screen.getByRole('gridcell', {
      name: /13 de septiembre de 2026/i,
    })
    expect(cell13).toBeInTheDocument()
    expect(cell13).toHaveAttribute('aria-selected', 'true')
  })

  it('renders neutral event items inside matching day cells', () => {
    render(<MonthCalendar currentMonth="2026-09" events={sampleEvents} />)

    expect(screen.getByText('Mantenimiento preventivo')).toBeInTheDocument()
    expect(screen.getByText('Revisión de frenos')).toBeInTheDocument()
    expect(screen.getByText('Entrega de vehículo')).toBeInTheDocument()
  })

  it('allows date selection and event interaction via mouse and keyboard', async () => {
    const user = userEvent.setup()
    const handleSelectDate = vi.fn()
    const handleSelectEvent = vi.fn()

    render(
      <MonthCalendar
        currentMonth="2026-09"
        events={sampleEvents}
        onSelectDate={handleSelectDate}
        onSelectEvent={handleSelectEvent}
      />,
    )

    // Seleccionar día
    const cell20 = screen.getByRole('gridcell', {
      name: /20 de septiembre de 2026/i,
    })
    await user.click(cell20)
    expect(handleSelectDate).toHaveBeenCalledWith('2026-09-20')

    // Teclado en celda
    cell20.focus()
    await user.keyboard('{Enter}')
    expect(handleSelectDate).toHaveBeenCalledWith('2026-09-20')

    // Seleccionar evento específico
    const eventItem = screen.getByText('Entrega de vehículo')
    await user.click(eventItem)
    expect(handleSelectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'e3',
        title: 'Entrega de vehículo',
      }),
    )
  })

  it('distinguishes outside-month days with muted appearance', () => {
    render(<MonthCalendar currentMonth="2026-09" />)

    // El 31 de agosto de 2026 es el lunes previo
    const outsideCell = screen.getByRole('gridcell', {
      name: /31 de agosto de 2026/i,
    })
    expect(outsideCell).toHaveAttribute('data-outside-month', 'true')
  })
})
