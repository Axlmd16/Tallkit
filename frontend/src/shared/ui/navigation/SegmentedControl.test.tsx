import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from './SegmentedControl'

describe('SegmentedControl (C14)', () => {
  const options = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
  ]

  it('renders all options with appropriate radiogroup roles', () => {
    render(
      <SegmentedControl
        aria-label="Periodo de visualización"
        onChange={() => {}}
        options={options}
        value="week"
      />,
    )

    const group = screen.getByRole('radiogroup', {
      name: 'Periodo de visualización',
    })
    expect(group).toBeInTheDocument()

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)

    expect(radios[0]).toHaveAttribute('aria-checked', 'false')
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[2]).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when clicking an unselected option', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <SegmentedControl
        aria-label="Periodo"
        onChange={handleChange}
        options={options}
        value="day"
      />,
    )

    const monthOption = screen.getByRole('radio', { name: 'Mes' })
    await user.click(monthOption)

    expect(handleChange).toHaveBeenCalledWith('month')
  })

  it('supports keyboard navigation with ArrowRight, ArrowLeft, Home and End', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    function StatefulControl() {
      const [value, setValue] = useState('day')
      return (
        <SegmentedControl
          aria-label="Filtro temporal"
          onChange={(val) => {
            setValue(val)
            handleChange(val)
          }}
          options={options}
          value={value}
        />
      )
    }

    render(<StatefulControl />)

    const dayOption = screen.getByRole('radio', { name: 'Día' })
    dayOption.focus()
    expect(dayOption).toHaveFocus()

    // ArrowRight -> Semana
    await user.keyboard('{ArrowRight}')
    expect(handleChange).toHaveBeenCalledWith('week')
    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveFocus()

    // ArrowRight -> Mes
    await user.keyboard('{ArrowRight}')
    expect(handleChange).toHaveBeenCalledWith('month')
    expect(screen.getByRole('radio', { name: 'Mes' })).toHaveFocus()

    // Home -> Día
    await user.keyboard('{Home}')
    expect(handleChange).toHaveBeenCalledWith('day')
    expect(screen.getByRole('radio', { name: 'Día' })).toHaveFocus()

    // End -> Mes
    await user.keyboard('{End}')
    expect(handleChange).toHaveBeenCalledWith('month')
    expect(screen.getByRole('radio', { name: 'Mes' })).toHaveFocus()

    // ArrowLeft -> Semana
    await user.keyboard('{ArrowLeft}')
    expect(handleChange).toHaveBeenCalledWith('week')
    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveFocus()
  })

  it('ignores disabled options during click and keyboard navigation', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    const optionsWithDisabled = [
      { value: 'opt1', label: 'Opción 1' },
      { value: 'opt2', label: 'Opción 2', disabled: true },
      { value: 'opt3', label: 'Opción 3' },
    ]

    function StatefulControl() {
      const [value, setValue] = useState('opt1')
      return (
        <SegmentedControl
          aria-label="Opciones con disabled"
          onChange={(val) => {
            setValue(val)
            handleChange(val)
          }}
          options={optionsWithDisabled}
          value={value}
        />
      )
    }

    render(<StatefulControl />)

    const opt2 = screen.getByRole('radio', { name: 'Opción 2' })
    expect(opt2).toBeDisabled()

    // Click on disabled option
    await user.click(opt2)
    expect(handleChange).not.toHaveBeenCalled()

    // ArrowRight from opt1 should skip opt2 and select opt3
    const opt1 = screen.getByRole('radio', { name: 'Opción 1' })
    opt1.focus()
    await user.keyboard('{ArrowRight}')
    expect(handleChange).toHaveBeenCalledWith('opt3')
    expect(screen.getByRole('radio', { name: 'Opción 3' })).toHaveFocus()
  })

  it('supports accent variants: violet and coral', () => {
    const { rerender } = render(
      <SegmentedControl
        accent="violet"
        aria-label="Acento violeta"
        onChange={() => {}}
        options={options}
        value="day"
      />,
    )

    let activeRadio = screen.getByRole('radio', { name: 'Día' })
    expect(activeRadio.className).toContain('bg-primary')

    rerender(
      <SegmentedControl
        accent="coral"
        aria-label="Acento coral"
        onChange={() => {}}
        options={options}
        value="day"
      />,
    )

    activeRadio = screen.getByRole('radio', { name: 'Día' })
    expect(activeRadio.className).toContain('bg-warning')
  })
})
