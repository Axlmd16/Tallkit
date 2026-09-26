import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Tabs } from './Tabs'

describe('Tabs (C15)', () => {
  const tabs = [
    { id: 'list', label: 'Lista', content: <div>Contenido de lista</div> },
    { id: 'board', label: 'Tablero', content: <div>Contenido de tablero</div> },
    {
      id: 'timeline',
      label: 'Cronograma',
      content: <div>Contenido de cronograma</div>,
    },
  ]

  it('renders tablist, tabs and active tabpanel with accessible aria attributes', () => {
    render(
      <Tabs
        activeId="board"
        aria-label="Vistas principales"
        items={tabs}
        onChange={() => {}}
      />,
    )

    const tablist = screen.getByRole('tablist', { name: 'Vistas principales' })
    expect(tablist).toBeInTheDocument()

    const renderedTabs = screen.getAllByRole('tab')
    expect(renderedTabs).toHaveLength(3)

    expect(renderedTabs[0]).toHaveAttribute('aria-selected', 'false')
    expect(renderedTabs[0]).toHaveAttribute('tabindex', '-1')

    expect(renderedTabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(renderedTabs[1]).toHaveAttribute('tabindex', '0')

    const activePanel = screen.getByRole('tabpanel')
    expect(activePanel).toHaveTextContent('Contenido de tablero')
    expect(activePanel).toHaveAttribute('aria-labelledby', renderedTabs[1]?.id)
    expect(renderedTabs[1]).toHaveAttribute('aria-controls', activePanel.id)
  })

  it('calls onChange when clicking a different tab', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Tabs
        activeId="list"
        aria-label="Vistas"
        items={tabs}
        onChange={handleChange}
      />,
    )

    const timelineTab = screen.getByRole('tab', { name: 'Cronograma' })
    await user.click(timelineTab)

    expect(handleChange).toHaveBeenCalledWith('timeline')
  })

  it('supports keyboard navigation across tabs with ArrowRight, ArrowLeft, Home and End', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    function StatefulTabs() {
      const [activeId, setActiveId] = useState('list')
      return (
        <Tabs
          activeId={activeId}
          aria-label="Vistas navegables"
          items={tabs}
          onChange={(id) => {
            setActiveId(id)
            handleChange(id)
          }}
        />
      )
    }

    render(<StatefulTabs />)

    const listTab = screen.getByRole('tab', { name: 'Lista' })
    listTab.focus()
    expect(listTab).toHaveFocus()

    // ArrowRight -> Tablero
    await user.keyboard('{ArrowRight}')
    expect(handleChange).toHaveBeenCalledWith('board')
    expect(screen.getByRole('tab', { name: 'Tablero' })).toHaveFocus()

    // ArrowRight -> Cronograma
    await user.keyboard('{ArrowRight}')
    expect(handleChange).toHaveBeenCalledWith('timeline')
    expect(screen.getByRole('tab', { name: 'Cronograma' })).toHaveFocus()

    // Home -> Lista
    await user.keyboard('{Home}')
    expect(handleChange).toHaveBeenCalledWith('list')
    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveFocus()

    // End -> Cronograma
    await user.keyboard('{End}')
    expect(handleChange).toHaveBeenCalledWith('timeline')
    expect(screen.getByRole('tab', { name: 'Cronograma' })).toHaveFocus()

    // ArrowLeft -> Tablero
    await user.keyboard('{ArrowLeft}')
    expect(handleChange).toHaveBeenCalledWith('board')
    expect(screen.getByRole('tab', { name: 'Tablero' })).toHaveFocus()
  })

  it('skips disabled tabs during keyboard navigation and prevents selection', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    const tabsWithDisabled = [
      { id: 'tab1', label: 'Pestaña 1', content: <div>P1</div> },
      {
        id: 'tab2',
        label: 'Pestaña 2',
        content: <div>P2</div>,
        disabled: true,
      },
      { id: 'tab3', label: 'Pestaña 3', content: <div>P3</div> },
    ]

    function StatefulTabs() {
      const [activeId, setActiveId] = useState('tab1')
      return (
        <Tabs
          activeId={activeId}
          aria-label="Pestañas con disabled"
          items={tabsWithDisabled}
          onChange={(id) => {
            setActiveId(id)
            handleChange(id)
          }}
        />
      )
    }

    render(<StatefulTabs />)

    const tab2 = screen.getByRole('tab', { name: 'Pestaña 2' })
    expect(tab2).toBeDisabled()

    await user.click(tab2)
    expect(handleChange).not.toHaveBeenCalled()

    const tab1 = screen.getByRole('tab', { name: 'Pestaña 1' })
    tab1.focus()
    await user.keyboard('{ArrowRight}')
    expect(handleChange).toHaveBeenCalledWith('tab3')
    expect(screen.getByRole('tab', { name: 'Pestaña 3' })).toHaveFocus()
  })

  it('renders badges/counts when provided in items', () => {
    const tabsWithCount = [
      { id: 'pending', label: 'Pendientes', count: 4 },
      { id: 'done', label: 'Completados', count: 12 },
    ]

    render(
      <Tabs
        activeId="pending"
        aria-label="Estado tareas"
        items={tabsWithCount}
        onChange={() => {}}
      />,
    )

    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('marca la pestaña activa con el acento de selección, no con la acción principal', () => {
    render(
      <Tabs
        activeId="board"
        aria-label="Vistas"
        items={tabs}
        onChange={() => {}}
      />,
    )
    const active = screen.getByRole('tab', { name: 'Tablero' })
    expect(active.className).toMatch(/\bborder-accent\b/)
    expect(active.className).toMatch(/\btext-accent-strong\b/)
    expect(active.className).not.toMatch(/\b(text|bg|border)-primary\b/)
  })

  it('keeps every panel mounted and hides inactive ones when keepMounted is set', async () => {
    function Counter() {
      const [count, setCount] = useState(0)
      return (
        <button onClick={() => setCount(count + 1)} type="button">
          Contador {count}
        </button>
      )
    }
    function Host() {
      const [active, setActive] = useState('a')
      return (
        <Tabs
          activeId={active}
          aria-label="Persistentes"
          items={[
            { id: 'a', label: 'Primera', content: <Counter /> },
            { id: 'b', label: 'Segunda', content: <p>Segundo panel</p> },
          ]}
          keepMounted
          onChange={setActive}
        />
      )
    }
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Contador 0' }))
    await user.click(screen.getByRole('tab', { name: 'Segunda' }))

    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(2)
    expect(panels[0]).not.toBeVisible()
    expect(panels[1]).toBeVisible()
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-controls')
    }

    await user.click(screen.getByRole('tab', { name: 'Primera' }))
    expect(screen.getByRole('button', { name: 'Contador 1' })).toBeVisible()
  })

  it('lets the tab list scroll horizontally without shrinking labels', () => {
    render(
      <Tabs
        activeId="list"
        aria-label="Desplazables"
        items={tabs}
        onChange={() => {}}
      />,
    )
    const tablist = screen.getByRole('tablist', { name: 'Desplazables' })
    expect(tablist.className).toContain('overflow-x-auto')
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('shrink-0')
      expect(tab.className).toContain('whitespace-nowrap')
    }
  })
})
