import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type { FiscalPreparationDetail } from '@/features/fiscal/types'

import { FiscalPreparationPage } from './FiscalPreparationPage'

const mocks = vi.hoisted(() => ({
  preparation: {
    isPending: false,
    isError: false,
    data: null as unknown,
    refetch: vi.fn(),
  },
  review: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as Error | null,
    data: null as unknown,
  },
}))

vi.mock('@/features/fiscal/hooks', () => ({
  usePreparation: () => mocks.preparation,
  useEstablishments: () => ({ data: [], isError: false }),
  useFiscalMutations: () => ({
    updateDraft: {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    },
    review: mocks.review,
    prepare: { mutate: vi.fn(), isPending: false, isError: false, error: null },
  }),
}))

function detail(
  overrides: Partial<FiscalPreparationDetail> = {},
): FiscalPreparationDetail {
  return {
    preparation_id: '11111111-1111-1111-1111-111111111111',
    fiscal_entity_id: 1,
    source: { kind: 'COMMERCIAL', id: 7, version: 1 },
    state: 'DRAFT',
    version: 1,
    draft: {
      point_id: 3,
      environment: '1',
      reference_date: '2026-09-25',
      receiver: {
        identification_type: '04',
        identification: '0999999999001',
        legal_name: 'Cliente Fiscal',
        address: null,
        email: null,
      },
      payments: { forms: [{ payment_code: '01', amount: '100.00' }] },
    },
    snapshot: null,
    discrepancy: {
      source_changed: false,
      state_changed: false,
      corrections_changed: false,
      current_source_version: 1,
    } as FiscalPreparationDetail['discrepancy'],
    cancellation_reason: '',
    created_at: '2026-09-25T10:00:00Z',
    prepared_at: null,
    official_status: null,
    official_submission: 'NOT_PERFORMED',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/fiscal/preparations/x']}>
      <Routes>
        <Route
          path="/fiscal/preparations/:id"
          element={<FiscalPreparationPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.review.data = null
})

it('separa el estado fiscal local del estado oficial y del cobro real', () => {
  mocks.preparation.data = detail()
  renderPage()
  expect(screen.getByText('Ambiente de ensayo')).toBeInTheDocument()
  expect(screen.getByText('Estado oficial SRI')).toBeInTheDocument()
  expect(screen.getByText('Sin envío realizado')).toBeInTheDocument()
  expect(screen.getByText(/Cobro real/)).toBeInTheDocument()
})

it('muestra el formulario del borrador con el receptor previo', () => {
  mocks.preparation.data = detail()
  renderPage()
  expect(screen.getByDisplayValue('0999999999001')).toBeInTheDocument()
  expect(screen.getByText('Receptor fiscal declarado')).toBeInTheDocument()
})

it('lista los datos faltantes de la revisión como impedimentos', () => {
  mocks.preparation.data = detail()
  mocks.review.data = {
    impediments: [
      { field: 'receiver.identification', message: 'Formato inválido' },
    ],
    review_token: null,
  }
  renderPage()
  expect(screen.getByLabelText('Datos faltantes')).toBeInTheDocument()
  expect(screen.getByText(/Formato inválido/)).toBeInTheDocument()
})

it('muestra la instantánea histórica cuando está preparada', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    snapshot: {
      issuer: {
        legal_name: 'Comercial SA',
        ruc: '1790000000001',
        environment: '1',
      },
      receiver: {
        legal_name: 'Cliente Fiscal',
        identification: '0999999999001',
      },
      base_total: '86.96',
      tax_total: '13.04',
      grand_total: '100.00',
      lines: [],
    },
  })
  renderPage()
  expect(screen.getByText('Instantánea histórica local')).toBeInTheDocument()
  expect(screen.getByText('USD 100.00')).toBeInTheDocument()
})

it('advierte cuando el origen cambió tras preparar', () => {
  mocks.preparation.data = detail({
    state: 'PREPARED',
    snapshot: { issuer: {}, receiver: {}, lines: [] },
    discrepancy: {
      source_changed: true,
      state_changed: false,
      corrections_changed: false,
      current_source_version: 2,
    } as FiscalPreparationDetail['discrepancy'],
  })
  renderPage()
  expect(
    screen.getByText('La operación cambió después de esta preparación'),
  ).toBeInTheDocument()
})
