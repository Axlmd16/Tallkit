import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from '../actions'
import { PageHeader, Toolbar } from './index'
import { Surface } from '../surfaces'

describe('Fase 5.1: Reexportar PageHeader, Toolbar y Surface (C18, C19, C21)', () => {
  describe('C18: PageHeader', () => {
    it('renderiza título, descripción y contenedor de acciones accesibles', () => {
      render(
        <PageHeader
          actions={<Button variant="primary">Nueva orden</Button>}
          description="Gestión general de mantenimientos y servicios"
          title="Órdenes de Trabajo"
        />,
      )

      expect(
        screen.getByRole('heading', { level: 1, name: 'Órdenes de Trabajo' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText('Gestión general de mantenimientos y servicios'),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Nueva orden' }),
      ).toBeInTheDocument()
    })

    it('renderiza únicamente título sin descripción ni acciones', () => {
      render(<PageHeader title="Panel Simple" />)
      expect(
        screen.getByRole('heading', { level: 1, name: 'Panel Simple' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('C19: Toolbar', () => {
    it('renderiza con rol semántico toolbar y nombre accesible obligatorio', () => {
      render(
        <Toolbar label="Herramientas de filtro">
          <Button variant="quiet">Filtrar</Button>
          <Button variant="quiet">Exportar</Button>
        </Toolbar>,
      )

      const toolbar = screen.getByRole('toolbar', {
        name: 'Herramientas de filtro',
      })
      expect(toolbar).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Filtrar' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Exportar' }),
      ).toBeInTheDocument()
    })
  })

  describe('C21: Surface', () => {
    it('renderiza contenedor neutral con clases estándar sin depender de páginas', () => {
      render(
        <Surface aria-label="Tarjeta de datos">
          <h3>Encabezado de bloque</h3>
          <p>Contenido interior protegido</p>
        </Surface>,
      )

      const surface = screen.getByRole('region', { name: 'Tarjeta de datos' })
      expect(surface.className).toContain('ui-surface')
      expect(surface.className).toContain('rounded-group')
      expect(surface.className).toContain('bg-surface')
      expect(
        screen.getByText('Contenido interior protegido'),
      ).toBeInTheDocument()
    })
  })
})
