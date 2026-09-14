import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CalendarToolbar } from './CalendarToolbar'
import { MiniCalendar } from './MiniCalendar'

describe('CalendarToolbar (C55) - Fase 12.1', () => {
  it('renders title, view options and navigation controls', async () => {
    const user = userEvent.setup()
    const handlePrevious = vi.fn()
    const handleNext = vi.fn()
    const handleToday = vi.fn()
    const handleViewChange = vi.fn()

    render(
      <CalendarToolbar
        title="Septiembre 2026"
        currentView="month"
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
      />,
    )

    expect(screen.getByText('Septiembre 2026')).toBeInTheDocument()

    // Botones de navegación
    const prevBtn = screen.getByRole('button', { name: /anterior/i })
    const nextBtn = screen.getByRole('button', { name: /siguiente/i })
    const todayBtn = screen.getByRole('button', { name: /hoy/i })

    await user.click(prevBtn)
    expect(handlePrevious).toHaveBeenCalledTimes(1)

    await user.click(nextBtn)
    expect(handleNext).toHaveBeenCalledTimes(1)

    await user.click(todayBtn)
    expect(handleToday).toHaveBeenCalledTimes(1)

    // Selector de vista
    const dayViewBtn = screen.getByRole('button', { name: /día/i })
    await user.click(dayViewBtn)
    expect(handleViewChange).toHaveBeenCalledWith('day')
  })
})

describe('MiniCalendar (C56) - Fase 12.1', () => {
  it('renders 7-column weekday headers and days of month', () => {
    render(
      <MiniCalendar
        currentMonth="2026-09"
        selectedDate="2026-09-13"
        today="2026-09-13"
      />,
    )

    // Días de la semana
    expect(screen.getByText('Lu')).toBeInTheDocument()
    expect(screen.getByText('Do')).toBeInTheDocument()

    // 30 días para septiembre
    expect(
      screen.getByRole('button', { name: /13 de septiembre de 2026/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /30 de septiembre de 2026/i }),
    ).toBeInTheDocument()
  })

  it('correctly calculates 28 days for February non-leap year (2026)', () => {
    render(<MiniCalendar currentMonth="2026-02" today="2026-02-15" />)

    expect(
      screen.getByRole('button', { name: /28 de febrero de 2026/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /29 de febrero de 2026/i }),
    ).not.toBeInTheDocument()
  })

  it('correctly calculates 29 days for February leap year (2024)', () => {
    render(<MiniCalendar currentMonth="2024-02" today="2024-02-15" />)

    expect(
      screen.getByRole('button', { name: /28 de febrero de 2024/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /29 de febrero de 2024/i }),
    ).toBeInTheDocument()
  })

  it('distinguishes outside-month days and selected date', () => {
    render(
      <MiniCalendar
        currentMonth="2026-09"
        selectedDate="2026-09-13"
        today="2026-09-13"
      />,
    )

    const selectedDay = screen.getByRole('button', {
      name: /13 de septiembre de 2026/i,
    })
    expect(selectedDay).toHaveAttribute('aria-pressed', 'true')

    // Días fuera del mes (agosto al inicio, octubre al final) deben existir con marcador outside
    const outsideDay = screen.getByRole('button', {
      name: /31 de agosto de 2026/i,
    })
    expect(outsideDay).toHaveAttribute('data-outside-month', 'true')
  })

  it('handles date selection via click and keyboard activation', async () => {
    const user = userEvent.setup()
    const handleSelectDate = vi.fn()

    render(
      <MiniCalendar currentMonth="2026-09" onSelectDate={handleSelectDate} />,
    )

    const targetDay = screen.getByRole('button', {
      name: /20 de septiembre de 2026/i,
    })
    await user.click(targetDay)
    expect(handleSelectDate).toHaveBeenCalledWith('2026-09-20')

    // Navegación y teclado
    targetDay.focus()
    await user.keyboard('{Enter}')
    expect(handleSelectDate).toHaveBeenCalledWith('2026-09-20')
  })

  it('allows navigating between months using next and previous buttons', async () => {
    const user = userEvent.setup()
    const handleMonthChange = vi.fn()

    render(
      <MiniCalendar currentMonth="2026-09" onMonthChange={handleMonthChange} />,
    )

    const nextMonthBtn = screen.getByRole('button', { name: /mes siguiente/i })
    await user.click(nextMonthBtn)
    expect(handleMonthChange).toHaveBeenCalledWith('2026-10')

    const prevMonthBtn = screen.getByRole('button', { name: /mes anterior/i })
    await user.click(prevMonthBtn)
    expect(handleMonthChange).toHaveBeenCalledWith('2026-08')
  })
})
