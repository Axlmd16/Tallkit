import { User } from '@phosphor-icons/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button, ButtonGroup, IconButton } from './index'

describe('C03-C04: IconButton y ButtonGroup', () => {
  describe('C03: IconButton', () => {
    it('proporciona nombre accesible y título mediante label', () => {
      render(<IconButton icon={<User />} label="Perfil de usuario" />)
      const btn = screen.getByRole('button', { name: 'Perfil de usuario' })
      expect(btn).toBeInTheDocument()
      expect(btn).toHaveAttribute('title', 'Perfil de usuario')
    })

    it('conserva por defecto forma cuadrada redondeada (rounded-group) y tamaño 40px', () => {
      render(<IconButton icon={<User />} label="Acción estándar" />)
      const btn = screen.getByRole('button', { name: 'Acción estándar' })
      expect(btn.className).toContain('rounded-group')
      expect(btn.className).toContain('size-10')
    })

    it('soporta variante circular (shape=circle) para avatares y acciones redondas', () => {
      render(
        <IconButton icon={<User />} label="Acción circular" shape="circle" />,
      )
      const btn = screen.getByRole('button', { name: 'Acción circular' })
      expect(btn.className).toContain('rounded-full')
    })

    it('soporta objetivo táctil accesible de 44x44px (targetSize=touch44)', () => {
      render(
        <IconButton
          icon={<User />}
          label="Acción táctil"
          targetSize="touch44"
        />,
      )
      const btn = screen.getByRole('button', { name: 'Acción táctil' })
      expect(btn.className).toContain('min-h-11')
      expect(btn.className).toContain('min-w-11')
    })
  })

  describe('C04: ButtonGroup', () => {
    it('define semántica accesible de grupo con role="group" y etiqueta descriptiva', () => {
      render(
        <ButtonGroup label="Acciones de formulario">
          <Button>Cancelar</Button>
          <Button variant="primary">Guardar</Button>
        </ButtonGroup>,
      )

      const group = screen.getByRole('group', {
        name: 'Acciones de formulario',
      })
      expect(group).toBeInTheDocument()
    })

    it('aplica separación gap de 8px (gap-2) y alineación horizontal por defecto', () => {
      render(
        <ButtonGroup label="Grupo horizontal">
          <Button>Uno</Button>
          <Button>Dos</Button>
        </ButtonGroup>,
      )

      const group = screen.getByRole('group', { name: 'Grupo horizontal' })
      expect(group.className).toContain('gap-2')
      expect(group.className).toContain('flex-wrap')
      expect(group.className).toContain('items-center')
    })

    it('soporta orientación vertical con gap de 8px', () => {
      render(
        <ButtonGroup label="Grupo vertical" orientation="vertical">
          <Button>Opción A</Button>
          <Button>Opción B</Button>
        </ButtonGroup>,
      )

      const group = screen.getByRole('group', { name: 'Grupo vertical' })
      expect(group.className).toContain('flex-col')
      expect(group.className).toContain('gap-2')
    })
  })
})
