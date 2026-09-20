import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/features/vehicle-brands/hooks', () => ({
  useVehicleBrands: (args: Record<string, unknown>) => {
    mocks.calls.push(args)
    const page = (args.page as number) ?? 1
    return {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: {
        count: 12,
        page,
        page_size: 8,
        total_pages: 2,
        results:
          page === 1
            ? [{ id: 1, name: 'Toyota', is_active: true }]
            : [{ id: 9, name: 'Zotye', is_active: true }],
      },
    }
  },
}))

import { VehicleBrandPicker } from './VehicleBrandPicker'
import type { CatalogRef } from './types'

function Harness({ initial = [] as CatalogRef[] }) {
  const [selected, setSelected] = useState(initial)
  return <VehicleBrandPicker onChange={setSelected} selected={selected} />
}

beforeEach(() => {
  mocks.calls.length = 0
})

it('pagina y busca en el servidor sin perder las marcas seleccionadas', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('checkbox', { name: 'Toyota' }))
  await user.click(screen.getByRole('button', { name: /página siguiente/i }))
  await user.click(screen.getByRole('checkbox', { name: 'Zotye' }))

  const chips = screen.getByRole('list', { name: 'Marcas seleccionadas' })
  expect(chips).toHaveTextContent('Toyota')
  expect(chips).toHaveTextContent('Zotye')
  expect(mocks.calls.some((c) => c.page === 2 && c.pageSize === 8)).toBe(true)

  await user.type(screen.getByLabelText(/buscar marca de vehículo/i), 'to')
  expect(mocks.calls.at(-1)).toMatchObject({
    search: 'to',
    page: 1,
    isActive: true,
  })
})

it('permite quitar marcas y etiqueta las inactivas ya asociadas', async () => {
  const user = userEvent.setup()
  render(<Harness initial={[{ id: 4, name: 'Ford', is_active: false }]} />)
  expect(screen.getByText(/ford \(inactiva\)/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Quitar Ford' }))
  expect(screen.getByText(/sin marcas seleccionadas/i)).toBeInTheDocument()
})
