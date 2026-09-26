import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import type { CertificateMetadata, DeclaredCondition } from './types'

const mocks = vi.hoisted(() => ({
  profile: {
    data: {
      entity_id: 1,
      revision: 2,
      conditions: {
        artisan_qualification: {
          status: 'UNKNOWN',
        } as DeclaredCondition,
        accounting_obligation: {
          status: 'NOT_APPLICABLE',
          source: 'Declaración del contribuyente',
          starts_on: '2026-01-01',
        } as DeclaredCondition,
      },
      certificate: null as CertificateMetadata | null,
    },
    isLoading: false,
    isError: false,
  },
  establishments: {
    data: [
      {
        id: 4,
        entity_id: 1,
        code: '001',
        address: 'Matriz',
        is_active: true,
        version: 1,
        points: [
          {
            id: 8,
            establishment_id: 4,
            code: '002',
            is_active: true,
            version: 1,
          },
        ],
      },
    ],
    isLoading: false,
    isError: false,
  },
  saveProfile: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as Error | null,
  },
  createEstablishment: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  },
  createPoint: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  },
  createTaxMapping: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  },
}))

vi.mock('./hooks', () => ({
  useElectronicProfile: () => mocks.profile,
  useEstablishments: () => mocks.establishments,
  useFiscalMutations: () => ({
    saveProfile: mocks.saveProfile,
    createEstablishment: mocks.createEstablishment,
    createPoint: mocks.createPoint,
    createTaxMapping: mocks.createTaxMapping,
  }),
}))

import { FiscalConfigurationSection } from './FiscalConfigurationSection'

const entities = [
  {
    id: 1,
    entity_type: 'ARTESANAL' as const,
    ruc: '1104018559001',
    legal_name: 'Taller Jiménez',
    trade_name: null,
    address: 'Matriz',
    phone: null,
    email: null,
    version: 1,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile.isLoading = false
  mocks.profile.isError = false
  mocks.profile.data.certificate = null
  mocks.profile.data.conditions.artisan_qualification.status = 'UNKNOWN'
  mocks.profile.data.conditions.accounting_obligation.status = 'NOT_APPLICABLE'
  delete mocks.profile.data.conditions.accounting_obligation.ends_on
  mocks.establishments.isLoading = false
  mocks.establishments.isError = false
  mocks.establishments.data[0]!.is_active = true
  mocks.saveProfile.isError = false
  mocks.saveProfile.error = null
})

it('shows unknown and missing declarations without presenting fiscal eligibility', () => {
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  expect(screen.getByText('Condición desconocida')).toBeInTheDocument()
  expect(screen.getByText('Certificado sin declarar')).toBeInTheDocument()
  expect(
    screen.getByText('Vigencia declarada desde 2026-01-01'),
  ).toBeInTheDocument()
  expect(screen.queryByText(/habilitado para emitir/i)).not.toBeInTheDocument()
})

it('shows establishment and point codes as separate three-digit values', () => {
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  expect(screen.getByText('Establecimiento 001')).toBeInTheDocument()
  expect(screen.getByText('Punto 002')).toBeInTheDocument()
})

it('opens a point form scoped to the selected establishment', async () => {
  const user = userEvent.setup()
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  await user.click(screen.getByRole('button', { name: 'Añadir punto' }))
  expect(screen.getByLabelText('Código del punto de emisión')).toHaveAttribute(
    'pattern',
    '[0-9]{3}',
  )
})

it('profile editing offers metadata fields and no private signature upload', async () => {
  const user = userEvent.setup()
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  await user.click(screen.getByRole('button', { name: 'Editar perfil fiscal' }))
  expect(
    screen.getByLabelText('Referencia del certificado'),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText(/clave privada/i)).not.toBeInTheDocument()
  expect(document.querySelector('input[type="file"]')).toBeNull()
})

it('submits certificate metadata while preserving declared conditions and revision', async () => {
  const user = userEvent.setup()
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  await user.click(screen.getByRole('button', { name: 'Editar perfil fiscal' }))
  await user.type(
    screen.getByLabelText('Referencia del certificado'),
    'cert-01',
  )
  await user.type(screen.getByLabelText('Titular declarado'), 'Taller Jiménez')
  await user.type(screen.getByLabelText('Emisor del certificado'), 'Entidad CA')
  await user.type(screen.getByLabelText('Fuente de la declaración'), 'Contrato')
  await user.type(
    screen.getByLabelText('Inicio de vigencia declarado'),
    '2026-01-01',
  )
  await user.type(
    screen.getByLabelText('Fin de vigencia declarado'),
    '2027-01-01',
  )
  await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))

  expect(mocks.saveProfile.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      entityId: 1,
      data: {
        expected_revision: 2,
        conditions: mocks.profile.data.conditions,
        certificate: {
          reference: 'cert-01',
          holder: 'Taller Jiménez',
          issuer: 'Entidad CA',
          source: 'Contrato',
          starts_on: '2026-01-01',
          ends_on: '2027-01-01',
        },
      },
      attemptKey: expect.any(String),
    }),
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  )
  await act(async () => mocks.saveProfile.mutate.mock.calls[0]?.[1].onSuccess())
})

it('submits scoped establishment and point commands with three-digit codes', async () => {
  const user = userEvent.setup()
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)

  await user.click(screen.getByRole('button', { name: 'Añadir ubicación' }))
  await user.type(screen.getByLabelText('Código de establecimiento'), '003')
  await user.type(
    screen.getByLabelText('Dirección declarada'),
    'Sucursal norte',
  )
  await user.click(screen.getByRole('button', { name: 'Añadir' }))
  expect(mocks.createEstablishment.mutate).toHaveBeenCalledWith(
    { entityId: 1, code: '003', address: 'Sucursal norte' },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  )
  await act(async () =>
    mocks.createEstablishment.mutate.mock.calls[0]?.[1].onSuccess(),
  )

  await user.click(screen.getByRole('button', { name: 'Añadir punto' }))
  await user.type(screen.getByLabelText('Código del punto de emisión'), '004')
  await user.click(screen.getByRole('button', { name: 'Añadir punto' }))
  expect(mocks.createPoint.mutate).toHaveBeenCalledWith(
    { entityId: 1, establishmentId: 4, code: '004' },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  )
  await act(async () => mocks.createPoint.mutate.mock.calls[0]?.[1].onSuccess())
})

it('submits a documented tax correspondence scoped to the selected issuer', async () => {
  const user = userEvent.setup()
  render(
    <FiscalConfigurationSection
      entities={entities}
      taxDefinitions={[
        {
          id: 7,
          code: 'IVA15',
          name: 'IVA 15%',
          fiscal_entity_id: 1,
        },
      ]}
    />,
  )
  await user.type(screen.getByLabelText('Código tarifa'), '4')
  await user.type(screen.getByLabelText('Inicio'), '2026-01-01')
  await user.type(screen.getByLabelText('Fundamento'), 'Ficha técnica SRI')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(mocks.createTaxMapping.mutate).toHaveBeenCalledWith({
    definition_id: 7,
    percentage_code: '4',
    starts_on: '2026-01-01',
    source: 'Ficha técnica SRI',
  })
})

it('shows independent loading and error states without hiding the other panel', () => {
  mocks.profile.isLoading = true
  mocks.establishments.isError = true
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  expect(screen.getByText('Cargando…')).toBeInTheDocument()
  expect(
    screen.getByText('No se pudieron cargar establecimientos y puntos.'),
  ).toBeInTheDocument()
})

it('shows the profile error and establishment loading states independently', () => {
  mocks.profile.isError = true
  mocks.establishments.isLoading = true
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  expect(
    screen.getByText('No se pudo cargar el perfil fiscal.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Cargando…')).toBeInTheDocument()
})

it('shows declared certificate, bounded validity and inactive locations', () => {
  mocks.profile.data.certificate = {
    reference: 'cert-01',
    holder: 'Taller Jiménez',
    issuer: 'Entidad CA',
    source: 'Contrato',
    starts_on: '2026-01-01',
    ends_on: '2027-01-01',
  }
  mocks.profile.data.conditions.accounting_obligation.ends_on = '2026-12-31'
  mocks.profile.data.conditions.artisan_qualification.status = 'APPLICABLE'
  mocks.establishments.data[0]!.is_active = false
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  expect(screen.getByText(/cert-01/)).toBeInTheDocument()
  expect(screen.getByText(/hasta 2026-12-31/)).toBeInTheDocument()
  expect(screen.getByText('Declarada aplicable')).toBeInTheDocument()
  expect(screen.getByText('Inactivo')).toBeInTheDocument()
})

it('keeps an empty certificate declaration when its reference is blank', async () => {
  const user = userEvent.setup()
  mocks.saveProfile.isError = true
  mocks.saveProfile.error = new Error('La revisión cambió')
  render(<FiscalConfigurationSection entities={entities} taxDefinitions={[]} />)
  await user.click(screen.getByRole('button', { name: 'Editar perfil fiscal' }))
  expect(screen.getByText('La revisión cambió')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar perfil' }))
  expect(mocks.saveProfile.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ certificate: null }),
    }),
    expect.any(Object),
  )
})

it('renders nothing when no fiscal issuer exists', () => {
  const { container } = render(
    <FiscalConfigurationSection entities={[]} taxDefinitions={[]} />,
  )
  expect(container).toBeEmptyDOMElement()
})
