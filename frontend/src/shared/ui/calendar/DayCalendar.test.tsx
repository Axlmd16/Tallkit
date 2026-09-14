import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DayCalendar, type DayCalendarEvent } from './DayCalendar'

describe('DayCalendar (C59) - Fase 12.4', () => {
  const sampleEvents: DayCalendarEvent[] = [
    {
      id: 'd1',
      title: 'Alineación y balanceo',
      subtitle: 'Bahía 1',
      startTime: '09:00',
      endTime: '10:30',
      tone: 'primary',
    },
    {
      id: 'd2',
      title: 'Cambio de aceite',
      subtitle: 'Bahía 2',
      startTime: '10:00',
      endTime: '11:00',
      tone: 'warning',
    },
    {
      id: 'd3',
      title: 'Diagnóstico escáner',
      startTime: '14:00',
      endTime: '15:30',
      tone: 'success',
    },
  ]

  it('renders hourly time axis and hour dividers', () => {
    render(
      <DayCalendar
        date="2026-09-13"
        startHour={8}
        endHour={18}
        ariaLabel="Agenda diaria del 13 de septiembre"
      />,
    )

    const region = screen.getByRole('region', { name: /agenda diaria/i })
    expect(region).toBeInTheDocument()

    // Eje horario visible
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('12:00')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
  })

  it('renders duration blocks with times and titles', () => {
    render(<DayCalendar date="2026-09-13" events={sampleEvents} />)

    expect(screen.getByText('Alineación y balanceo')).toBeInTheDocument()
    expect(screen.getByText('Bahía 1')).toBeInTheDocument()
    expect(screen.getByText('Cambio de aceite')).toBeInTheDocument()
    expect(screen.getByText('Diagnóstico escáner')).toBeInTheDocument()
  })

  it('handles overlapping events cleanly without occlusion', () => {
    render(<DayCalendar date="2026-09-13" events={sampleEvents} />)

    // d1 (09:00-10:30) y d2 (10:00-11:00) se solapan entre 10:00 y 10:30
    const event1 = screen.getByRole('button', {
      name: /alineación y balanceo/i,
    })
    const event2 = screen.getByRole('button', { name: /cambio de aceite/i })

    expect(event1).toBeInTheDocument()
    expect(event2).toBeInTheDocument()

    // Ambos deben tener anchos calculados menores al 100% para coexistir lado a lado
    expect(event1).toHaveAttribute('data-overlap-cols', '2')
    expect(event2).toHaveAttribute('data-overlap-cols', '2')
  })

  it('supports event and time slot selection via click and keyboard', async () => {
    const user = userEvent.setup()
    const handleSelectEvent = vi.fn()
    const handleSelectTimeSlot = vi.fn()

    render(
      <DayCalendar
        date="2026-09-13"
        events={sampleEvents}
        onSelectEvent={handleSelectEvent}
        onSelectTimeSlot={handleSelectTimeSlot}
      />,
    )

    // Clic en evento
    const eventItem = screen.getByRole('button', {
      name: /diagnóstico escáner/i,
    })
    await user.click(eventItem)
    expect(handleSelectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'd3',
        title: 'Diagnóstico escáner',
      }),
    )

    // Clic en franja horaria vacía de las 12:00
    const slot12 = screen.getByRole('button', { name: /franja de las 12:00/i })
    await user.click(slot12)
    expect(handleSelectTimeSlot).toHaveBeenCalledWith('12:00')

    // Teclado en franja
    slot12.focus()
    await user.keyboard('{Enter}')
    expect(handleSelectTimeSlot).toHaveBeenCalledWith('12:00')
  })
})
