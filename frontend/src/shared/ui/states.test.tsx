import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  EmptyState,
  FiscalScopeBadge,
  ForbiddenState,
  InlineNotice,
  LoadingState,
  SkeletonRows,
  StatusBadge,
} from './states'

it('names business state without relying on its color', () => {
  render(<StatusBadge label="Activo" tone="success" />)

  expect(screen.getByRole('status', { name: 'Estado: Activo' })).toBeVisible()
})

it.each([
  ['commercial', 'Repuestos'],
  ['artesanal', 'Servicios'],
] as const)(
  'identifies the %s business by name, not by RUC',
  (scope, label) => {
    render(<FiscalScopeBadge scope={scope} />)

    expect(
      screen.getByRole('status', { name: `Negocio: ${label}` }),
    ).toBeVisible()
    expect(screen.queryByText(/RUC/)).toBeNull()
  },
)

it('announces an error with its corrective detail', () => {
  render(
    <InlineNotice title="No se guardó" tone="danger">
      Revise los campos marcados.
    </InlineNotice>,
  )

  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se guardóRevise los campos marcados.',
  )
})

it('distinguishes loading from an actionable empty result', () => {
  const { rerender } = render(<LoadingState label="Cargando usuarios…" />)
  expect(screen.getByRole('status')).toHaveTextContent('Cargando usuarios…')

  rerender(
    <EmptyState
      action={<button type="button">Limpiar filtros</button>}
      description="Pruebe con otros criterios."
      title="No hay resultados"
    />,
  )
  expect(
    screen.getByRole('heading', { name: 'No hay resultados' }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeEnabled()
})

describe('estados Tallkit', () => {
  it('un estado es una píldora, con punto y texto', () => {
    render(<StatusBadge label="Confirmada" tone="success" />)
    const badge = screen.getByRole('status', { name: 'Estado: Confirmada' })
    expect(badge.className).toMatch(/rounded-full/)
    expect(badge.querySelector('[data-marker]')).not.toBeNull()
  })

  it('cada ámbito fiscal tiene su propio tono e icono', () => {
    render(
      <>
        <FiscalScopeBadge scope="commercial" />
        <FiscalScopeBadge scope="artesanal" />
      </>,
    )
    const commercial = screen.getByRole('status', {
      name: 'Negocio: Repuestos',
    })
    const artisan = screen.getByRole('status', {
      name: 'Negocio: Servicios',
    })
    expect(commercial.className).toMatch(/bg-scope-commercial-soft/)
    expect(artisan.className).toMatch(/bg-scope-artisan-soft/)
    expect(artisan.className).not.toMatch(/warning/)
  })

  it('sin permiso explica qué rol concede el acceso', () => {
    render(
      <ForbiddenState
        description="Solo el rol Administrador puede verla."
        title="No tiene acceso a la auditoría"
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'No tiene acceso a la auditoría' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Administrador/)).toBeInTheDocument()
  })

  it('la carga en filas se anuncia sin mostrar datos inventados', () => {
    render(<SkeletonRows label="Cargando productos…" rows={3} />)
    const region = screen.getByRole('status', { name: 'Cargando productos…' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelectorAll('[data-skeleton-row]')).toHaveLength(3)
    expect(region.textContent?.replace('Cargando productos…', '').trim()).toBe(
      '',
    )
  })
})
