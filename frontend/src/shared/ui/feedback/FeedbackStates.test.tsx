import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  SuccessState,
} from './index'

describe('Fase 5.4: Feedback States (C44–C48)', () => {
  it('C44: LoadingState incluye soporte de accesibilidad y clase de reduced-motion', () => {
    render(<LoadingState label="Cargando órdenes…" />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Cargando órdenes…')
    const icon = status.querySelector('svg')
    expect(icon?.className.baseVal ?? icon?.getAttribute('class')).toContain(
      'motion-reduce:animate-none',
    )
  })

  it('C45: EmptyState representa estado vacío inicial con acción de creación', () => {
    render(
      <EmptyState
        action={<button type="button">Crear primer vehículo</button>}
        description="Aún no se han registrado vehículos en la plataforma."
        title="Sin vehículos registrados"
      />,
    )
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Sin vehículos registrados',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Aún no se han registrado vehículos en la plataforma.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Crear primer vehículo' }),
    ).toBeInTheDocument()
  })

  it('C46: ErrorState compone InlineNotice con role alert y botón de reintento operable', async () => {
    const user = userEvent.setup()
    const handleRetry = vi.fn()
    render(
      <ErrorState
        message="No se pudo sincronizar la lista de repuestos."
        onRetry={handleRetry}
        title="Fallo de conexión"
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Fallo de conexión')).toBeInTheDocument()
    expect(
      screen.getByText('No se pudo sincronizar la lista de repuestos.'),
    ).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: 'Reintentar' })
    await user.click(retryButton)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('C47: SuccessState anuncia mensaje de confirmación con tono exitoso', () => {
    render(
      <SuccessState
        message="Los datos del vehículo han sido actualizados en el taller."
        title="Vehículo guardado"
      />,
    )

    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    expect(screen.getByText('Vehículo guardado')).toBeInTheDocument()
  })

  it('C48: NoResultsState diferencia búsqueda sin resultados de vacío inicial y permite limpiar filtros', async () => {
    const user = userEvent.setup()
    const handleClear = vi.fn()
    render(<NoResultsState onClear={handleClear} />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Sin coincidencias' }),
    ).toBeInTheDocument()
    const clearButton = screen.getByRole('button', { name: 'Limpiar filtros' })
    await user.click(clearButton)
    expect(handleClear).toHaveBeenCalledTimes(1)
  })
})
