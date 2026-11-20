import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  suggestions: vi.fn(),
}))
vi.mock('@/features/products/api', () => ({
  productsApi: { list: mocks.list },
}))
vi.mock('./pickers', () => ({
  useProductSuggestions: (term: string) => mocks.suggestions(term),
}))

import { ProductSearch } from './ProductSearch'

const oil = {
  id: 1,
  code: 'ACE-1',
  manufacturer_code: 'MOT-5',
  name: 'Aceite 20W50',
  unit: { id: 1, name: 'Galón', is_active: true },
}
const filter = {
  id: 2,
  code: 'FIL-1',
  manufacturer_code: '',
  name: 'Filtro de aceite',
  unit: { id: 2, name: 'Unidad', is_active: true },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.suggestions.mockReturnValue({ data: undefined })
})

const box = () => screen.getByRole('combobox', { name: /buscar producto/i })

describe('ProductSearch', () => {
  it('un código interno exacto con Enter agrega el producto sin esperar sugerencias', async () => {
    mocks.list.mockResolvedValue({ results: [oil, filter] })
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.type(box(), 'ace-1{Enter}')
    await waitFor(() => expect(onChoose).toHaveBeenCalledTimes(1))
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        code: 'ACE-1',
        name: 'Aceite 20W50',
        unit: 'Galón',
        label: expect.objectContaining({ id: 1, code: 'ACE-1' }),
      }),
    )
    expect(mocks.list).toHaveBeenCalledWith({
      search: 'ace-1',
      isActive: 'true',
      pageSize: 5,
    })
  })

  it('reconoce el código del fabricante y limpia el campo conservando el foco', async () => {
    mocks.list.mockResolvedValue({ results: [oil, filter] })
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.type(box(), 'MOT-5{Enter}')
    await waitFor(() => expect(onChoose).toHaveBeenCalled())
    expect(box()).toHaveValue('')
    expect(box()).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Agregado: ACE-1')
  })

  it('una única coincidencia por nombre se agrega directamente', async () => {
    mocks.list.mockResolvedValue({ results: [filter] })
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.type(box(), 'filtro{Enter}')
    await waitFor(() =>
      expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: 2 })),
    )
  })

  it('varias coincidencias sin código exacto piden elegir y no agregan nada', async () => {
    mocks.list.mockResolvedValue({ results: [oil, filter] })
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.type(box(), 'aceite{Enter}')
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /varias coincidencias/i,
      ),
    )
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('sin coincidencias lo dice y no agrega nada', async () => {
    mocks.list.mockResolvedValue({ results: [] })
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.type(box(), 'zzz{Enter}')
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /no hay un producto/i,
      ),
    )
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('una falla de red se comunica y permite reintentar', async () => {
    mocks.list.mockRejectedValueOnce(new Error('red'))
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.type(box(), 'ACE-1{Enter}')
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /no se pudo buscar/i,
      ),
    )
    mocks.list.mockResolvedValue({ results: [oil] })
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(onChoose).toHaveBeenCalled())
  })

  it('las sugerencias se eligen con flechas y Enter o con clic', async () => {
    mocks.suggestions.mockImplementation((term: string) => ({
      data: term ? { results: [oil, filter] } : undefined,
    }))
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.type(box(), 'ace')
    const list = await screen.findByRole('listbox', { name: /sugeridos/i })
    expect(list).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChoose).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 2 }),
    )
    await userEvent.type(box(), 'ace')
    await userEvent.click(await screen.findByRole('option', { name: /ACE-1/ }))
    expect(onChoose).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 1 }),
    )
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('Escape limpia el texto y un campo vacío no consulta', async () => {
    const onChoose = vi.fn()
    render(<ProductSearch onChoose={onChoose} />)
    await userEvent.keyboard('{Enter}')
    expect(mocks.list).not.toHaveBeenCalled()
    await userEvent.type(box(), 'abc{Escape}')
    expect(box()).toHaveValue('')
  })

  it('deshabilitado no admite escritura', () => {
    render(<ProductSearch disabled onChoose={vi.fn()} />)
    expect(box()).toBeDisabled()
  })
})
