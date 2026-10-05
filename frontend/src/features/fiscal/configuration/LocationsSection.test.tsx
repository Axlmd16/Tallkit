import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  establishments: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
  },
  defaults: { data: undefined as unknown, isLoading: false },
  createEstablishment: { mutateAsync: vi.fn() },
  createPoint: { mutateAsync: vi.fn() },
  savePreparationDefaults: { mutateAsync: vi.fn() },
}))

vi.mock('../hooks', () => ({
  useEstablishments: () => mocks.establishments,
  usePreparationDefaults: () => mocks.defaults,
  useFiscalMutations: () => ({
    createEstablishment: mocks.createEstablishment,
    createPoint: mocks.createPoint,
    savePreparationDefaults: mocks.savePreparationDefaults,
  }),
}))

import { LocationsSection } from './LocationsSection'

const point = (id: number, code: string, is_active = true) => ({
  id,
  code,
  is_active,
})
const establishment = (
  id: number,
  code: string,
  points: ReturnType<typeof point>[],
  is_active = true,
) => ({ id, code, address: `Dirección ${code}`, is_active, points })

function renderSection() {
  render(
    <ToastProvider>
      <LocationsSection entityId={2} hints={<span>Aviso</span>} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  mocks.establishments.data = []
  mocks.establishments.isLoading = false
  mocks.establishments.isError = false
  mocks.defaults.data = {
    effective_point_id: null,
    designated_point_id: null,
    version: 4,
  }
  mocks.defaults.isLoading = false
  for (const mutation of [
    mocks.createEstablishment,
    mocks.createPoint,
    mocks.savePreparationDefaults,
  ]) {
    mutation.mutateAsync.mockReset()
    mutation.mutateAsync.mockResolvedValue({})
  }
})

it('indica la carga y el fallo de la consulta', () => {
  mocks.establishments.isLoading = true
  const { unmount } = render(
    <ToastProvider>
      <LocationsSection entityId={2} />
    </ToastProvider>,
  )
  expect(screen.queryByText('Añadir establecimiento')).toBeNull()
  unmount()

  mocks.establishments.isLoading = false
  mocks.establishments.isError = true
  renderSection()
  expect(
    screen.getByText('No se pudieron cargar establecimientos y puntos.'),
  ).toBeVisible()
})

it('sin establecimientos avisa y valida el código y la dirección antes de guardar', async () => {
  const user = userEvent.setup()
  renderSection()

  expect(screen.getByText('Sin puntos activos')).toBeVisible()
  expect(screen.getByText('Aviso')).toBeVisible()
  expect(
    screen.getByText('No hay establecimientos declarados para esta entidad.'),
  ).toBeVisible()

  await user.click(
    screen.getByRole('button', { name: 'Añadir establecimiento' }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Añadir establecimiento' })
  await user.type(
    within(dialog).getByLabelText(/Código de establecimiento/),
    '000',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Añadir establecimiento' }),
  )
  expect(
    within(dialog).getByText(
      'Use tres dígitos, por ejemplo 001. No puede ser 000.',
    ),
  ).toBeVisible()
  expect(within(dialog).getByText('Escriba la dirección.')).toBeVisible()
  expect(mocks.createEstablishment.mutateAsync).not.toHaveBeenCalled()

  const code = within(dialog).getByLabelText(/Código de establecimiento/)
  await user.clear(code)
  await user.type(code, '001')
  await user.type(
    within(dialog).getByLabelText(/Dirección del establecimiento/),
    '  Vía Catamayo  ',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Añadir establecimiento' }),
  )

  expect(mocks.createEstablishment.mutateAsync).toHaveBeenCalledWith({
    entityId: 2,
    code: '001',
    address: 'Vía Catamayo',
  })
  expect(await screen.findByText('Establecimiento 001 añadido.')).toBeVisible()
})

it('un único punto activo es el predeterminado automático y los inactivos no ofrecen añadir', async () => {
  const user = userEvent.setup()
  mocks.establishments.data = [
    establishment(1, '001', [point(10, '001'), point(11, '002', false)]),
    establishment(2, '002', [], false),
    establishment(3, '003', []),
  ]
  mocks.defaults.data = {
    effective_point_id: 10,
    designated_point_id: null,
    version: 0,
  }
  renderSection()

  expect(screen.getByText('Automático: es el único punto activo')).toBeVisible()
  expect(screen.getByText('Predeterminado')).toBeVisible()
  // El establecimiento 002 y el punto 002 del 001 están inactivos.
  expect(screen.getAllByText('Inactivo')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Cambiar' })).toBeNull()
  expect(
    screen.queryByRole('button', {
      name: 'Añadir punto al establecimiento 002',
    }),
  ).toBeNull()
  expect(screen.getAllByText('Sin puntos de emisión.')).toHaveLength(2)

  await user.click(
    screen.getByRole('button', {
      name: 'Añadir punto al establecimiento 003',
    }),
  )
  const dialog = screen.getByRole('dialog', { name: 'Añadir punto de emisión' })
  await user.click(within(dialog).getByRole('button', { name: 'Añadir punto' }))
  expect(
    within(dialog).getByText(
      'Use tres dígitos, por ejemplo 001. No puede ser 000.',
    ),
  ).toBeVisible()
  await user.type(
    within(dialog).getByLabelText(/Código del punto de emisión/),
    '002',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Añadir punto' }))
  expect(mocks.createPoint.mutateAsync).toHaveBeenCalledWith({
    entityId: 2,
    establishmentId: 3,
    code: '002',
  })
  expect(await screen.findByText('Punto 003-002 añadido.')).toBeVisible()
})

it('con varios puntos activos el Administrador designa el predeterminado', async () => {
  const user = userEvent.setup()
  mocks.establishments.data = [
    establishment(1, '001', [point(10, '001'), point(11, '002')]),
  ]
  renderSection()

  expect(screen.getByText('Sin designar')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Designar punto' }))
  const dialog = screen.getByRole('dialog', { name: 'Punto predeterminado' })
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar punto' }),
  )
  expect(within(dialog).getByText('Seleccione un punto activo.')).toBeVisible()
  expect(mocks.savePreparationDefaults.mutateAsync).not.toHaveBeenCalled()

  await user.selectOptions(
    within(dialog).getByLabelText(/Punto de emisión/),
    '11',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar punto' }),
  )

  expect(mocks.savePreparationDefaults.mutateAsync).toHaveBeenCalledWith({
    entityId: 2,
    data: { expected_version: 4, default_point_id: 11 },
    attemptKey: expect.any(String),
  })
  expect(
    await screen.findByText('Punto predeterminado actualizado.'),
  ).toBeVisible()
})

it('muestra el punto designado y permite cambiarlo', () => {
  mocks.establishments.data = [
    establishment(1, '001', [point(10, '001'), point(11, '002')]),
  ]
  mocks.defaults.data = {
    effective_point_id: 11,
    designated_point_id: 11,
    version: 1,
  }
  renderSection()

  expect(screen.getByText('Designado por el Administrador')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cambiar' })).toBeVisible()
})
