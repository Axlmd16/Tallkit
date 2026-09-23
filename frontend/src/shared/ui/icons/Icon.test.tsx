import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ICON_MAP, Icon, type IconName } from './index'

describe('C01: Icon - Componente y mapa de iconos accesibles', () => {
  it('contiene el mapa de iconos clave de Phosphor', () => {
    expect(ICON_MAP.category).toBeDefined()
    expect(ICON_MAP.document).toBeDefined()
    expect(ICON_MAP.chart).toBeDefined()
    expect(ICON_MAP.user).toBeDefined()
    expect(ICON_MAP.calendar).toBeDefined()
    expect(ICON_MAP.search).toBeDefined()
  })

  it('renderiza como decorativo por defecto (aria-hidden=true)', () => {
    const { container } = render(<Icon name="category" />)
    const icon = container.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('img')).toBeNull()
  })

  it('renderiza como accesible cuando se especifica aria-label', () => {
    render(<Icon name="document" aria-label="Ver documento" />)
    const icon = screen.getByLabelText('Ver documento')
    expect(icon.tagName.toLowerCase()).toBe('svg')
    expect(icon).toHaveAttribute('role', 'img')
    expect(icon).toHaveAttribute('aria-hidden', 'false')
  })

  it('soporta tamaño personalizado conservando dimensiones cuadradas', () => {
    const { container } = render(<Icon name="chart" size={24} />)
    const icon = container.querySelector('svg')
    expect(icon).toHaveAttribute('width', '24')
    expect(icon).toHaveAttribute('height', '24')
  })

  it('renderiza correctamente sin errores todos los iconos del mapa', () => {
    const names = Object.keys(ICON_MAP) as IconName[]
    expect(names.length).toBeGreaterThanOrEqual(10)
    for (const name of names) {
      const { container } = render(<Icon name={name} />)
      expect(container.querySelector('svg')).not.toBeNull()
    }
  })
})
