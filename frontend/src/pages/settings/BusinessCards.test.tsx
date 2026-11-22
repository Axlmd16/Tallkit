import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  entities: { isLoading: false, isError: false, data: [] as unknown[] },
  taxes: { data: [] as unknown[] },
  series: { data: [] as unknown[] },
  readiness: { byEntity: {} as Record<number, unknown> },
}))

vi.mock('@/features/workshop-configuration/queries', () => ({
  useFiscalEntities: () => mocks.entities,
  useAllTaxDefinitions: () => mocks.taxes,
  useAllDocumentSeries: () => mocks.series,
}))

vi.mock('@/features/fiscal/configuration/readiness', () => ({
  useConfigurationReadiness: () => mocks.readiness,
}))

import { BusinessCards } from './BusinessCards'

function renderCards() {
  return render(
    <MemoryRouter>
      <BusinessCards />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.entities = { isLoading: false, isError: false, data: [] }
  mocks.taxes = { data: [] }
  mocks.series = { data: [] }
  mocks.readiness = { byEntity: {} }
})

describe('BusinessCards', () => {
  it('muestra carga, error y estado vacío cuando no hay negocios', () => {
    mocks.entities = { isLoading: true, isError: false, data: [] }
    const { unmount } = renderCards()
    expect(screen.getByText(/Cargando/)).toBeInTheDocument()
    unmount()

    mocks.entities = { isLoading: false, isError: true, data: [] }
    const second = renderCards()
    expect(
      screen.getByText(/No se pudieron cargar los negocios/),
    ).toBeInTheDocument()
    second.unmount()

    mocks.entities = { isLoading: false, isError: false, data: [] }
    renderCards()
    expect(
      screen.getByText(/Aún no se han configurado los negocios/),
    ).toBeInTheDocument()
  })

  it('muestra las tarjetas de ambos negocios con su estado de configuración', () => {
    mocks.entities = {
      isLoading: false,
      isError: false,
      data: [
        {
          id: 2,
          entity_type: 'COMERCIAL',
          ruc: '1790000000001',
          legal_name: 'Comercial Norte S.A.',
          trade_name: 'Repuestos Norte',
          logo: null,
        },
        {
          id: 1,
          entity_type: 'ARTESANAL',
          ruc: '1790000000002',
          legal_name: 'Taller Norte Artesanal',
          trade_name: 'Taller Norte',
          logo: { url: '/media/logo.png' },
        },
      ],
    }
    mocks.taxes = {
      data: [
        {
          id: 10,
          fiscal_entity_id: 1,
          entity_type: 'ARTESANAL',
          name: 'IVA 0%',
          current_rate: '0',
        },
      ],
    }
    mocks.series = {
      data: [
        {
          id: 20,
          entity_type: 'ARTESANAL',
          code: '001-001',
          last_number: 42,
          is_active: true,
        },
      ],
    }
    mocks.readiness = {
      byEntity: {
        1: {
          bySection: { puntos: [], certificado: [], impuestos: [], perfil: [] },
          warnings: [],
        },
        2: {
          bySection: {
            puntos: [{ code: 'missing_point' }],
            certificado: [],
            impuestos: [{ code: 'missing_tax' }],
            perfil: [],
          },
          warnings: [{ code: 'certificate_expiring' }],
        },
      },
    }

    renderCards()
    expect(screen.getByText('Taller Norte')).toBeInTheDocument()
    expect(screen.getByText('Repuestos Norte')).toBeInTheDocument()
    expect(screen.getByText(/Serie 001-001/)).toBeInTheDocument()
    expect(
      screen.getByText(/Revisa la vigencia de la firma/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Abrir configuración avanzada/ }),
    ).toHaveAttribute('href', '/configuration')
  })
})
