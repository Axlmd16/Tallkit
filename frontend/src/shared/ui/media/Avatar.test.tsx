import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Avatar } from './Avatar'

describe('C24: Avatar', () => {
  it('genera iniciales a partir del nombre completo con nombre accesible', () => {
    render(<Avatar name="Carlos Mendoza" />)
    const avatar = screen.getByRole('img', { name: 'Carlos Mendoza' })
    expect(avatar).toHaveTextContent('CM')
    expect(avatar.className).toContain('rounded-full')
    expect(avatar.className).toContain('size-9') // 36px
  })

  it('soporta iniciales explícitas y etiqueta accesible personalizada', () => {
    render(<Avatar initials="OP" label="Operador del taller" />)
    const avatar = screen.getByRole('img', { name: 'Operador del taller' })
    expect(avatar).toHaveTextContent('OP')
  })

  it('renderiza fallback neutral accesible cuando no se proporcionan iniciales', () => {
    render(<Avatar label="Usuario anónimo" />)
    const avatar = screen.getByRole('img', { name: 'Usuario anónimo' })
    expect(avatar.querySelector('svg')).toBeInTheDocument()
  })

  it('soporta variantes de tamaño 70px y 134px circulares (F07 4:2815 / F08 4:3284)', () => {
    const { rerender } = render(<Avatar name="Mecánico Jefe" size="70" />)
    let avatar = screen.getByRole('img', { name: 'Mecánico Jefe' })
    expect(avatar.className).toContain('size-[70px]')

    rerender(<Avatar name="Mecánico Jefe" size="134" />)
    avatar = screen.getByRole('img', { name: 'Mecánico Jefe' })
    expect(avatar.className).toContain('size-[134px]')
  })

  it('soporta variante rectangular 45x43 (F01 4:580)', () => {
    render(<Avatar name="Empresa Aliada" size="45x43" />)
    const avatar = screen.getByRole('img', { name: 'Empresa Aliada' })
    expect(avatar.className).toContain('w-[45px]')
    expect(avatar.className).toContain('h-[43px]')
    expect(avatar.className).toContain('rounded-group')
  })
})
