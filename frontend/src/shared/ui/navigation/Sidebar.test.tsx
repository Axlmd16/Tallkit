import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NavigationItem } from './NavigationItem'
import { Sidebar } from './Sidebar'

describe('Sidebar y NavigationItem (C27, C28)', () => {
  const items = [
    { id: 'dashboard', label: 'Tablero', icon: <span>📊</span> },
    { id: 'orders', label: 'Órdenes', icon: <span>🔧</span>, badge: 5 },
    {
      id: 'vehicles',
      label: 'Vehículos',
      icon: <span>🚗</span>,
      disabled: true,
    },
    { id: 'settings', label: 'Configuración', icon: <span>⚙️</span> },
  ]

  it('renders NavigationItem with active state, label and badge', () => {
    const handleClick = vi.fn()

    render(
      <NavigationItem
        active
        badge={3}
        icon={<span>⭐</span>}
        id="favs"
        label="Favoritos"
        onClick={handleClick}
      />,
    )

    const item = screen.getByRole('button', { name: /Favoritos/ })
    expect(item).toBeInTheDocument()
    expect(item).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders NavigationItem collapsed showing label as accessible name', () => {
    render(
      <NavigationItem
        collapsed
        icon={<span>⭐</span>}
        id="favs"
        label="Favoritos"
      />,
    )

    const item = screen.getByRole('button', { name: 'Favoritos' })
    expect(item).toBeInTheDocument()
    expect(item.className).toContain('justify-center')
  })

  it('renders Sidebar expanded (218px) with header, items and selection', async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    render(
      <Sidebar
        activeId="dashboard"
        header={<div>Logo Taller</div>}
        items={items}
        onSelect={handleSelect}
      />,
    )

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByText('Logo Taller')).toBeInTheDocument()

    const dashboardBtn = screen.getByRole('button', { name: /Tablero/ })
    expect(dashboardBtn).toHaveAttribute('aria-current', 'page')
    expect(dashboardBtn.className).toContain('linear-gradient')

    const aside = nav.closest('aside')
    expect(aside?.className).not.toContain('border-r')

    const ordersBtn = screen.getByRole('button', { name: /Órdenes/ })
    expect(ordersBtn).not.toHaveAttribute('aria-current')
    expect(screen.getByText('5')).toBeInTheDocument()

    await user.click(ordersBtn)
    expect(handleSelect).toHaveBeenCalledWith('orders')
  })

  it('keeps the full label available when expanded text is truncated', () => {
    render(
      <NavigationItem
        icon={<span>⭐</span>}
        id="long"
        label="Configuración administrativa extraordinariamente larga"
      />,
    )

    expect(
      screen.getByRole('button', {
        name: 'Configuración administrativa extraordinariamente larga',
      }),
    ).toHaveAttribute(
      'title',
      'Configuración administrativa extraordinariamente larga',
    )
  })

  it('renders Sidebar collapsed (80px) and omits visible text while preserving accessibility', () => {
    render(<Sidebar activeId="orders" collapsed items={items} />)

    const aside = screen.getByRole('navigation').closest('aside')
    expect(aside?.className).toContain('w-20')

    const ordersBtn = screen.getByRole('button', { name: /Órdenes/ })
    expect(ordersBtn).toBeInTheDocument()
    expect(ordersBtn).toHaveAttribute('aria-current', 'page')
  })

  it('respects disabled item preventing selection in Sidebar', async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    render(
      <Sidebar activeId="dashboard" items={items} onSelect={handleSelect} />,
    )

    const disabledBtn = screen.getByRole('button', { name: /Vehículos/ })
    expect(disabledBtn).toBeDisabled()

    await user.click(disabledBtn)
    expect(handleSelect).not.toHaveBeenCalled()
  })
})
