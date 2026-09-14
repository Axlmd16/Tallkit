import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Checkbox, Input, Select } from './index'

describe('C06–C08: Variantes opt-in de Input, Select y Checkbox', () => {
  describe('C06: Input', () => {
    it('conserva por defecto radio r5 y altura 50px', () => {
      render(<Input placeholder="Entrada estándar" />)
      const input = screen.getByPlaceholderText('Entrada estándar')
      expect(input.className).toContain('rounded-control')
      expect(input.className).toContain('min-h-[50px]')
    })

    it('soporta variante opt-in radio r10 (F10 4:5440)', () => {
      render(<Input placeholder="Entrada r10" radius="r10" />)
      const input = screen.getByPlaceholderText('Entrada r10')
      expect(input.className).toContain('rounded-group')
    })

    it('soporta variante opt-in compacta 42px (F12 4:6205)', () => {
      render(<Input placeholder="Entrada compacta" density="compact42" />)
      const input = screen.getByPlaceholderText('Entrada compacta')
      expect(input.className).toContain('min-h-[42px]')
    })

    it('soporta estado disabled y reenvío de ref', () => {
      const ref = createRef<HTMLInputElement>()
      render(<Input disabled placeholder="Deshabilitado" ref={ref} />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
      expect(screen.getByPlaceholderText('Deshabilitado')).toBeDisabled()
    })
  })

  describe('C07: Select', () => {
    it('conserva por defecto radio r5 y soporta radio r10 (F10 4:5429)', () => {
      const { rerender } = render(
        <Select aria-label="Selector estándar">
          <option value="1">Opción 1</option>
        </Select>,
      )
      const select = screen.getByRole('combobox')
      expect(select.className).toContain('rounded-control')

      rerender(
        <Select aria-label="Selector r10" radius="r10">
          <option value="1">Opción 1</option>
        </Select>,
      )
      expect(screen.getByRole('combobox').className).toContain('rounded-group')
    })

    it('soporta estado disabled y opciones nativas', () => {
      render(
        <Select disabled aria-label="Selector deshabilitado">
          <option value="a">A</option>
        </Select>,
      )
      expect(screen.getByRole('combobox')).toBeDisabled()
    })
  })

  describe('C08: Checkbox', () => {
    it('conserva por defecto tamaño 20px (size-5)', () => {
      const { container } = render(<Checkbox label="Acepto términos" />)
      const input = container.querySelector('input[type="checkbox"]')
      expect(input?.className).toContain('size-5')
    })

    it('soporta variante opt-in de 15px (F18 4:8495)', () => {
      const { container } = render(
        <Checkbox label="Compacto 15px" sizeVariant="15" />,
      )
      const input = container.querySelector('input[type="checkbox"]')
      expect(input?.className).toContain('size-[15px]')
    })

    it('soporta estado indeterminado (mixed) reflejado en propiedad DOM y aria-checked', () => {
      const { container } = render(
        <Checkbox indeterminate label="Selección parcial" />,
      )
      const input = container.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement
      expect(input.indeterminate).toBe(true)
      expect(input).toHaveAttribute('aria-checked', 'mixed')
    })

    it('soporta estado disabled', () => {
      render(<Checkbox disabled label="Deshabilitado" />)
      expect(screen.getByRole('checkbox')).toBeDisabled()
    })
  })
})
