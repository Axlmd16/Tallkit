import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthLayout } from './AuthLayout'

describe('AuthLayout (C43) - Fase 10.1', () => {
  it('renders generic column with 448px maximum width and 348px control container', () => {
    render(
      <AuthLayout
        footer={<a href="#ayuda">Centro de ayuda técnica</a>}
        header={<h2>Acceso a Sys-Taller</h2>}
      >
        <div data-testid="test-form">
          <input placeholder="Usuario" type="text" />
          <button type="submit">Ingresar</button>
        </div>
      </AuthLayout>,
    )

    // Columna de autenticación con límite de 448px (F17 4:8585 / F18 4:8485)
    const card = screen.getByRole('main')
    expect(card).toBeInTheDocument()
    expect(card.className).toContain('max-w-[448px]')

    // Contenedor de formulario con ancho máximo de 348px para controles
    const formContainer = screen.getByTestId('auth-form-container')
    expect(formContainer.className).toContain('max-w-[348px]')

    // Slots header, children y footer
    expect(
      screen.getByRole('heading', { name: 'Acceso a Sys-Taller' }),
    ).toBeVisible()
    expect(screen.getByTestId('test-form')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Centro de ayuda técnica' }),
    ).toBeVisible()
  })

  it('renders short and extended composition variants', () => {
    const { rerender } = render(
      <AuthLayout variant="short">
        <p>Formulario corto</p>
      </AuthLayout>,
    )

    const mainShort = screen.getByRole('main')
    expect(mainShort.className).toContain('py-8')

    rerender(
      <AuthLayout variant="extended">
        <p>Formulario extenso</p>
      </AuthLayout>,
    )

    const mainExtended = screen.getByRole('main')
    expect(mainExtended.className).toContain('py-12')
  })

  it('renders optional hero side slot for wide screens without social login or external assets', () => {
    render(
      <AuthLayout
        hero={
          <div data-testid="auth-hero-panel">
            <h3>Panel editorial del taller</h3>
            <p>Plataforma para gestión de flotas y órdenes mecánicas.</p>
          </div>
        }
      >
        <p>Formulario con hero</p>
      </AuthLayout>,
    )

    const hero = screen.getByTestId('auth-hero-panel')
    expect(hero).toBeVisible()

    // No debe contener botones o enlaces de login social ni registro real
    expect(
      screen.queryByRole('button', { name: /google/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /facebook/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /registrarse/i }),
    ).not.toBeInTheDocument()
  })
})
