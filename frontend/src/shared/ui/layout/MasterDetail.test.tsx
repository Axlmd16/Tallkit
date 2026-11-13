import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MasterDetail } from './MasterDetail'

const people = [
  { id: 'a1', name: 'Ana' },
  { id: 'a2', name: 'Andrés' },
  { id: 'b1', name: 'Beatriz' },
]

function Harness({ visible = people }: { visible?: typeof people }) {
  const [selected, setSelected] = useState<string | null>('a1')
  return (
    <MasterDetail
      detailLabel="Vista previa"
      getGroup={(person) => person.name[0] ?? ''}
      getKey={(person) => person.id}
      items={visible}
      listLabel="Clientes"
      onSelect={setSelected}
      renderDetail={(person) => <h2>Detalle de {person.name}</h2>}
      renderItem={(person) => person.name}
      selectedKey={selected}
      toolbar={<input aria-label="Buscar" />}
    />
  )
}

function mockPhone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('MasterDetail (PPF-11)', () => {
  it('elige un registro con el teclado, lo marca y deja el foco en la lista', async () => {
    mockPhone(false)
    const user = userEvent.setup()
    render(<Harness />)

    expect(
      screen.getByRole('heading', { name: 'Detalle de Ana' }),
    ).toBeVisible()
    expect(screen.getAllByTestId('master-detail-group')).toHaveLength(2)

    await user.tab()
    await user.tab()
    await user.tab()
    const second = screen.getByRole('button', { name: 'Andrés' })
    expect(second).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(
      screen.getByRole('heading', { name: 'Detalle de Andrés' }),
    ).toBeVisible()
    expect(second).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Ana' })).not.toHaveAttribute(
      'aria-current',
    )
    expect(second).toHaveFocus()
  })

  it('no presenta datos de un registro que el filtro dejó fuera', () => {
    mockPhone(false)
    render(<Harness visible={[people[2]!]} />)

    expect(screen.queryByText(/Detalle de Ana/)).not.toBeInTheDocument()
    expect(
      screen.getByText('Elija un registro de la lista para ver su detalle.'),
    ).toBeVisible()
  })

  it('en teléfono muestra el detalle a ancho completo y permite volver conservando la búsqueda', async () => {
    mockPhone(true)
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.queryByRole('heading', { name: /Detalle de/ })).toBeNull()
    await user.type(screen.getByRole('textbox', { name: 'Buscar' }), 'be')
    await user.click(screen.getByRole('button', { name: 'Beatriz' }))

    expect(
      screen.getByRole('heading', { name: 'Detalle de Beatriz' }),
    ).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Buscar' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Volver a la lista' }))
    expect(screen.getByRole('button', { name: 'Beatriz' })).toBeVisible()
  })
})
