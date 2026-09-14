import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './index'

describe('C02: Button - Variantes opt-in 40/50 y estados', () => {
  it('reenvía ref al elemento HTML button nativo', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Acción</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('conserva tamaño por defecto de 40px (min-h-10) idéntico al control existente', () => {
    render(<Button>Botón por defecto</Button>)
    const btn = screen.getByRole('button', { name: 'Botón por defecto' })
    expect(btn.className).toContain('min-h-10')
  })

  it('soporta variante opt-in de tamaño 50px (min-h-[50px]) para formularios', () => {
    render(<Button size="50">Botón formulario</Button>)
    const btn = screen.getByRole('button', { name: 'Botón formulario' })
    expect(btn.className).toContain('min-h-[50px]')
  })

  it('soporta todos los tonos de variante: primary, secondary, quiet y danger', () => {
    const { rerender } = render(<Button variant="primary">Primario</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary')

    rerender(<Button variant="secondary">Secundario</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary-soft')

    rerender(<Button variant="quiet">Quiet</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-transparent')

    rerender(<Button variant="danger">Peligro</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-danger-soft')
  })

  it('gestiona correctamente estados disabled y busy/pending', () => {
    const { rerender } = render(<Button disabled>Deshabilitado</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).not.toHaveAttribute('aria-busy')

    rerender(
      <Button pending pendingLabel="Guardando cambios…">
        Guardar
      </Button>,
    )
    const busyBtn = screen.getByRole('button', { name: 'Guardando cambios…' })
    expect(busyBtn).toBeDisabled()
    expect(busyBtn).toHaveAttribute('aria-busy', 'true')
  })
})
