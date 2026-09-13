import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import {
  EmptyState,
  FiscalScopeBadge,
  InlineNotice,
  LoadingState,
  StatusBadge,
} from './states'

it('names business state without relying on its color', () => {
  render(<StatusBadge label="Activo" tone="success" />)

  expect(screen.getByRole('status', { name: 'Estado: Activo' })).toBeVisible()
})

it.each([
  ['commercial', 'RUC comercial'],
  ['artesanal', 'RUC artesanal'],
] as const)('identifies the %s fiscal scope in text', (scope, label) => {
  render(<FiscalScopeBadge scope={scope} />)

  expect(
    screen.getByRole('status', { name: `Ámbito fiscal: ${label}` }),
  ).toBeVisible()
})

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
