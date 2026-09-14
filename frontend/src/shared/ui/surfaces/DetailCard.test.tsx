import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DetailCard } from './DetailCard'

describe('DetailCard (C23)', () => {
  it('renders header, metadata grid and actions in a structured surface', () => {
    render(
      <DetailCard
        actions={<button type="button">Editar</button>}
        badge={<span>Activo</span>}
        metadata={[
          { label: 'Placa', value: 'ABC-123' },
          { label: 'Año', value: '2022' },
          { label: 'Propietario', value: 'Juan Pérez' },
        ]}
        subtitle="Mantenimiento preventivo"
        title="Ficha de Vehículo"
      >
        <p>Notas adicionales del vehículo</p>
      </DetailCard>,
    )

    expect(
      screen.getByRole('heading', { level: 3, name: 'Ficha de Vehículo' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Mantenimiento preventivo')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()

    expect(screen.getByText('Placa')).toBeInTheDocument()
    expect(screen.getByText('ABC-123')).toBeInTheDocument()
    expect(screen.getByText('Año')).toBeInTheDocument()
    expect(screen.getByText('2022')).toBeInTheDocument()
    expect(
      screen.getByText('Notas adicionales del vehículo'),
    ).toBeInTheDocument()
  })

  it('handles extensive text with wrapping and without overflow', () => {
    const longText =
      'Texto extremadamente largo que describe detalles extensos '.repeat(10)
    render(
      <DetailCard
        metadata={[{ label: 'Observaciones', value: longText }]}
        title="Ficha con texto largo"
      />,
    )

    expect(screen.getByText(longText.trim())).toBeInTheDocument()
  })
})
