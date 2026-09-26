import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'

import type { ConfigurationReadiness } from '@/features/fiscal/configuration/readiness'

import { ConfigurationSummary } from './ConfigurationSummary'

function renderSummary(readiness: Partial<ConfigurationReadiness>) {
  return render(
    <MemoryRouter initialEntries={['/configuration']}>
      <ConfigurationSummary
        readiness={{
          isLoading: false,
          isError: false,
          pending: 0,
          firstDestination: null,
          byEntity: {},
          ...readiness,
        }}
      />
    </MemoryRouter>,
  )
}

it('muestra un marcador mientras evalúa la configuración', () => {
  renderSummary({ isLoading: true })
  expect(screen.getByText('Evaluando configuración…')).toBeInTheDocument()
})

it('enlaza una causa sin subsección conocida a la entidad en facturación', () => {
  renderSummary({
    pending: 1,
    firstDestination: { entityId: 3, section: null },
  })

  expect(
    screen.getByRole('link', {
      name: '1 pendiente en Facturación electrónica',
    }),
  ).toHaveAttribute('href', '/configuration?tab=facturacion&entidad=3')
})
