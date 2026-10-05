import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  taxes: {} as Record<string, unknown>,
  vehicleBrandsArgs: [] as unknown[],
}))

const page = <T,>(results: T[]) => ({
  isPending: false,
  isError: false,
  isSuccess: true,
  data: {
    count: results.length,
    page: 1,
    page_size: 100,
    total_pages: 1,
    results,
  },
})

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/product-categories/hooks', () => ({
  useProductCategoryList: () =>
    page([{ id: 1, name: 'Aceites', is_active: true }]),
}))
vi.mock('@/features/measurement-units/hooks', () => ({
  useMeasurementUnitList: () =>
    page([{ id: 2, name: 'Galón', is_active: true }]),
}))
vi.mock('@/features/product-brands/hooks', () => ({
  useProductBrandList: () =>
    page([{ id: 3, name: 'Castrol', is_active: true }]),
}))
vi.mock('@/features/vehicle-brands/hooks', () => ({
  useVehicleBrands: (args: unknown) => {
    mocks.vehicleBrandsArgs.push(args)
    return page([
      { id: 10, name: 'Toyota', is_active: true },
      { id: 11, name: 'Chevrolet', is_active: true },
    ])
  },
}))
vi.mock('./hooks', () => ({
  useProductTaxOptions: () => mocks.taxes,
}))

import { ProductForm } from './ProductForm'
import type { Product } from './types'

const taxOption = (status: 'applicable' | 'missing' = 'applicable') => ({
  id: 7,
  code: 'IVA',
  name: 'IVA general',
  entity_type: 'COMERCIAL' as const,
  rate: status === 'applicable' ? '15.0000' : null,
  tax_status: status,
})

const product: Product = {
  id: 5,
  code: 'ACE-1',
  manufacturer_code: '',
  name: 'Aceite 20W50',
  description: '',
  category: { id: 1, name: 'Aceites', is_active: true },
  unit: { id: 2, name: 'Galón', is_active: true },
  product_brand: null,
  vehicle_brands: [{ id: 10, name: 'Toyota', is_active: true }],
  content_quantity: '1.000000',
  sale_price: '10.50',
  is_kit: false,
  tax: taxOption(),
  is_active: true,
  version: 3,
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
}

function renderForm(
  props: Partial<React.ComponentProps<typeof ProductForm>> = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined)
  render(
    <MemoryRouter>
      <ProductForm onCancel={vi.fn()} onSubmit={onSubmit} {...props} />
    </MemoryRouter>,
  )
  return { onSubmit }
}

beforeEach(() => {
  mocks.permissions = [
    'productos.ver',
    'productos.gestionar',
    'productos.cambiar_precio',
  ]
  mocks.taxes = page([taxOption()])
})

it('valida obligatorios, precio y contenido sin enviar ni redondear', async () => {
  const user = userEvent.setup()
  const { onSubmit } = renderForm()
  await user.type(screen.getByLabelText(/^código interno/i), 'X-1')
  await user.type(screen.getByLabelText(/precio final/i), '10.999')
  await user.type(screen.getByLabelText(/^contenido/i), '0')
  await user.click(screen.getByRole('button', { name: /guardar producto/i }))

  expect(
    await screen.findByText(/el nombre es obligatorio/i),
  ).toBeInTheDocument()
  expect(screen.getByText(/seleccione una categoría/i)).toBeInTheDocument()
  expect(screen.getByText(/seleccione una unidad/i)).toBeInTheDocument()
  expect(
    screen.getByText(/seleccione la configuración tributaria/i),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/hasta 12 enteros y 2 decimales/i),
  ).toBeInTheDocument()
  expect(screen.getByText(/mayor que cero/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/precio final/i)).toHaveValue('10.999')
  expect(onSubmit).not.toHaveBeenCalled()
})

it('envía el alta con importes como cadenas y varias marcas de vehículo', async () => {
  const user = userEvent.setup()
  const { onSubmit } = renderForm()
  await user.type(screen.getByLabelText(/^código interno/i), ' ace-2 ')
  await user.type(screen.getByLabelText(/^nombre/i), 'Aceite 10W40')
  await user.type(screen.getByLabelText(/^contenido/i), '0.500000')
  await user.selectOptions(screen.getByLabelText(/unidad de medida/i), '2')
  await user.selectOptions(screen.getByLabelText(/^categoría/i), '1')
  await user.click(screen.getByRole('checkbox', { name: 'Toyota' }))
  await user.click(screen.getByRole('checkbox', { name: 'Chevrolet' }))
  await user.type(screen.getByLabelText(/precio final/i), '12.50')
  await user.selectOptions(screen.getByLabelText(/impuesto/i), '7')
  await user.click(screen.getByRole('button', { name: /guardar producto/i }))

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit).toHaveBeenCalledWith({
    code: 'ace-2',
    name: 'Aceite 10W40',
    category_id: 1,
    unit_id: 2,
    vehicle_brand_ids: [10, 11],
    tax_definition_id: 7,
    content_quantity: '0.500000',
    sale_price: '12.50',
    is_kit: false,
  })
})

it('en edición envía solo lo modificado y conserva marcas inactivas ya asociadas', async () => {
  const user = userEvent.setup()
  const { onSubmit } = renderForm({
    product: {
      ...product,
      category: { id: 9, name: 'Antigua', is_active: false },
      vehicle_brands: [{ id: 12, name: 'Ford', is_active: false }],
    },
  })
  expect(
    screen.getByRole('option', { name: 'Antigua (inactiva)' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/ford \(inactiva\)/i)).toBeInTheDocument()

  await user.clear(screen.getByLabelText(/^nombre/i))
  await user.type(screen.getByLabelText(/^nombre/i), 'Aceite renovado')
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Aceite renovado' }),
  )
})

it('impide cambiar el precio sin permiso y sugiere el motivo', () => {
  mocks.permissions = ['productos.ver', 'productos.gestionar']
  renderForm({ product })
  expect(screen.getByLabelText(/precio final/i)).toBeDisabled()
  expect(screen.getByText(/permiso de cambio de precio/i)).toBeInTheDocument()
})

it('avisa de la configuración tributaria pendiente y de vigencias pendientes', () => {
  mocks.taxes = page([])
  const { unmount } = (() => {
    const view = render(
      <MemoryRouter>
        <ProductForm onCancel={vi.fn()} onSubmit={vi.fn()} />
      </MemoryRouter>,
    )
    return view
  })()
  expect(
    screen.getByText(/configuración tributaria pendiente/i),
  ).toBeInTheDocument()
  unmount()

  mocks.taxes = page([taxOption('missing')])
  renderForm({ product: { ...product, tax: taxOption('missing') } })
  expect(screen.getByText(/vigencia tributaria pendiente/i)).toBeInTheDocument()
})

it('conserva los valores ante un rechazo, ofrece recarga y muestra errores por campo', async () => {
  const user = userEvent.setup()
  const onReload = vi.fn()
  const onSubmit = vi
    .fn()
    .mockRejectedValueOnce(
      new ProblemError('Código duplicado.', 409, 'duplicate_code', 'r', {
        code: ['Ya existe un producto con ese código.'],
      }),
    )
    .mockRejectedValueOnce(
      new ProblemError('Registro desactualizado.', 409, 'stale_record'),
    )
  renderForm({ product, onSubmit, onReload })

  await user.clear(screen.getByLabelText(/^código interno/i))
  await user.type(screen.getByLabelText(/^código interno/i), 'DUP')
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  expect(
    await screen.findByText('Ya existe un producto con ese código.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/^código interno/i)).toHaveValue('DUP')

  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  await user.click(
    await screen.findByRole('button', { name: /cargar versión vigente/i }),
  )
  expect(onReload).toHaveBeenCalled()
  expect(screen.getByLabelText(/^código interno/i)).toHaveValue('DUP')
})

it('identifica un kit comprado completo sin componentes', async () => {
  const user = userEvent.setup()
  const { onSubmit } = renderForm({ product })
  expect(
    screen.getByRole('checkbox', { name: /kit comprado completo/i }),
  ).not.toBeChecked()
  await user.click(
    screen.getByRole('checkbox', { name: /kit comprado completo/i }),
  )
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ is_kit: true }))
})

it('permite un código de fabricante opcional y distinto del código interno', async () => {
  const user = userEvent.setup()
  const { onSubmit } = renderForm()
  expect(
    screen.getByText(/no reemplaza al código interno/i),
  ).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^código interno/i), 'ace-3')
  await user.type(screen.getByLabelText(/^código del fabricante/i), ' BP-500 ')
  await user.type(screen.getByLabelText(/^nombre/i), 'Aceite 5W30')
  await user.type(screen.getByLabelText(/^contenido/i), '1')
  await user.selectOptions(screen.getByLabelText(/unidad de medida/i), '2')
  await user.selectOptions(screen.getByLabelText(/^categoría/i), '1')
  await user.type(screen.getByLabelText(/precio final/i), '9.00')
  await user.selectOptions(screen.getByLabelText(/impuesto/i), '7')
  await user.click(screen.getByRole('button', { name: /guardar producto/i }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ace-3', manufacturer_code: 'BP-500' }),
    ),
  )
})

it('valida el largo del código de fabricante y muestra el conflicto por marca', async () => {
  const user = userEvent.setup()
  const onSubmit = vi
    .fn()
    .mockRejectedValueOnce(
      new ProblemError(
        'Código de fabricante duplicado.',
        409,
        'duplicate_manufacturer_code',
        'r',
        { manufacturer_code: ['Ya existe para la misma marca.'] },
      ),
    )
  renderForm({ product, onSubmit })
  const field = screen.getByLabelText(/^código del fabricante/i)
  await user.type(field, 'X'.repeat(65))
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  expect(await screen.findByText(/no puede exceder 64/i)).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()

  await user.clear(field)
  await user.type(field, 'BP-1')
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  expect(
    await screen.findByText('Ya existe para la misma marca.'),
  ).toBeInTheDocument()
  expect(onSubmit).toHaveBeenCalledWith({ manufacturer_code: 'BP-1' })
})

it('en edición permite vaciar el código de fabricante', async () => {
  const user = userEvent.setup()
  const { onSubmit } = renderForm({
    product: { ...product, manufacturer_code: 'BP-1' },
  })
  await user.clear(screen.getByLabelText(/^código del fabricante/i))
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ manufacturer_code: '' }),
  )
})

it('limita el código interno a los 25 caracteres del comprobante y lo explica', () => {
  renderForm()
  const code = screen.getByLabelText(/^código interno/i)
  expect(code).toHaveAttribute('maxlength', '25')
  expect(screen.getByText(/hasta 25 caracteres/i)).toBeInTheDocument()
})

it('rechaza un código nuevo de más de 25 caracteres sin enviarlo', async () => {
  const user = userEvent.setup()
  const { onSubmit } = renderForm({ product })
  fireEvent.change(screen.getByLabelText(/^código interno/i), {
    target: { value: 'M'.repeat(26) },
  })
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  expect(
    await screen.findByText(
      'El código interno no puede exceder 25 caracteres.',
    ),
  ).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

it('conserva un código largo ya registrado, lo avisa y no lo envía si no se toca', async () => {
  const user = userEvent.setup()
  const legacy = { ...product, code: 'L'.repeat(40) }
  const { onSubmit } = renderForm({ product: legacy })

  const code = screen.getByLabelText(/^código interno/i)
  expect(code).toHaveValue('L'.repeat(40))
  expect(
    screen.getByText(/excede los 25 caracteres del comprobante/i),
  ).toBeInTheDocument()

  const name = screen.getByLabelText(/^nombre/i)
  await user.clear(name)
  await user.type(name, 'Aceite renovado')
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Aceite renovado' }),
  )
})

it('no acepta cambiar un código largo por otro igual de largo, pero sí por uno corto', async () => {
  const user = userEvent.setup()
  const legacy = { ...product, code: 'L'.repeat(40) }
  const { onSubmit } = renderForm({ product: legacy })
  const code = screen.getByLabelText(/^código interno/i)

  fireEvent.change(code, { target: { value: 'M'.repeat(30) } })
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  expect(
    await screen.findByText(
      'El código interno no puede exceder 25 caracteres.',
    ),
  ).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()

  fireEvent.change(code, { target: { value: 'ACE-12' } })
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ code: 'ACE-12' }))
})
