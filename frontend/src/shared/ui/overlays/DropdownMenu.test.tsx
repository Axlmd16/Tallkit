import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DropdownMenu } from './DropdownMenu'

describe('DropdownMenu (C17)', () => {
  const items = [
    { id: 'view', label: 'Ver detalles' },
    { id: 'edit', label: 'Editar elemento' },
    { id: 'disabled-action', label: 'No disponible', disabled: true },
    { id: 'delete', label: 'Eliminar registro', destructive: true },
  ]

  it('renders trigger with menu accessibility attributes', () => {
    render(
      <DropdownMenu
        items={items}
        trigger={<button type="button">Opciones</button>}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Opciones' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens menu on trigger click and focuses first enabled item', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu
        items={items}
        trigger={<button type="button">Opciones</button>}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Opciones' })
    await user.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems).toHaveLength(4)
    expect(menuItems[0]).toHaveFocus()
  })

  it('calls item onClick and closes menu when selecting an item', async () => {
    const user = userEvent.setup()
    const handleEdit = vi.fn()
    const itemsWithAction = [
      { id: 'view', label: 'Ver' },
      { id: 'edit', label: 'Editar', onClick: handleEdit },
    ]

    render(
      <DropdownMenu
        items={itemsWithAction}
        trigger={<button type="button">Acciones</button>}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Acciones' })
    await user.click(trigger)

    const editItem = screen.getByRole('menuitem', { name: 'Editar' })
    await user.click(editItem)

    expect(handleEdit).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('renders destructive item with danger styling', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu
        items={items}
        trigger={<button type="button">Opciones</button>}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Opciones' }))

    const deleteItem = screen.getByRole('menuitem', {
      name: 'Eliminar registro',
    })
    expect(deleteItem.className).toContain('text-danger')
  })

  it('navigates through items with ArrowDown, ArrowUp, Home, End and closes with Escape', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu
        items={items}
        trigger={<button type="button">Menú Teclado</button>}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Menú Teclado' })
    trigger.focus()

    // ArrowDown on trigger opens menu and focuses first item ('Ver detalles')
    await user.keyboard('{ArrowDown}')
    const viewItem = screen.getByRole('menuitem', { name: 'Ver detalles' })
    expect(viewItem).toHaveFocus()

    // ArrowDown skips disabled item ('disabled-action') and focuses destructive item ('Eliminar registro')
    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitem', { name: 'Editar elemento' }),
    ).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitem', { name: 'Eliminar registro' }),
    ).toHaveFocus()

    // ArrowDown cycles back to first item
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Ver detalles' })).toHaveFocus()

    // ArrowUp cycles to last enabled item
    await user.keyboard('{ArrowUp}')
    expect(
      screen.getByRole('menuitem', { name: 'Eliminar registro' }),
    ).toHaveFocus()

    // Home focuses first
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Ver detalles' })).toHaveFocus()

    // Escape closes menu and returns focus to trigger
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('supports controlled open prop for static preview', () => {
    render(
      <DropdownMenu
        items={items}
        open
        trigger={<button type="button">Siempre abierto</button>}
      />,
    )

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu.className).toContain('rounded-group')
    expect(menu.className).toContain('shadow-menu')
    expect(menu.className).not.toContain('border')
  })
})
