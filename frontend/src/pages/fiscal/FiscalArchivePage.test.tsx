import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import type {
  ArchiveFilters,
  ArchivePage,
  ArchiveSummary,
} from '@/features/fiscal/types'

import { FiscalArchivePage } from './FiscalArchivePage'

const mocks = vi.hoisted(() => ({
  permissions: ['fiscal.archivo.gestionar'] as string[],
  archive: {
    isPending: false,
    isError: false,
    data: null as ArchivePage | null,
  },
  archiveCalls: [] as {
    entityId?: number | undefined
    filters: ArchiveFilters
  }[],
  upload: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null as Error | null,
    data: null as unknown,
  },
  exportArchive: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as Error | null,
  },
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/workshop-configuration/queries', () => ({
  useFiscalEntities: () => ({
    data: [{ id: 1, entity_type: 'COMERCIAL', ruc: '1790000000001' }],
  }),
}))
vi.mock('@/features/fiscal/hooks', () => ({
  useArchive: (entityId?: number, filters: ArchiveFilters = {}) => {
    mocks.archiveCalls.push({ entityId, filters })
    return mocks.archive
  },
  useFiscalMutations: () => ({
    uploadArchive: mocks.upload,
    exportArchive: mocks.exportArchive,
  }),
}))
vi.mock('@/features/fiscal/api', () => ({
  fiscalApi: { downloadArchive: vi.fn() },
}))
vi.mock('@/features/fiscal/FiscalReadinessSection', () => ({
  FiscalReadinessSection: () => <div>Readiness fiscal</div>,
}))

function dossier(): ArchiveSummary {
  return {
    dossier_id: 'd1',
    fiscal_entity_id: 1,
    document_type: '01',
    environment: '1',
    access_key: '2509202601179000000000110010010000000011234567811',
    issue_date: '2026-09-25',
    total: '100.00',
    verification_level: 'EXTERNAL_UNVERIFIED',
    linked_source: null,
  }
}

function page(
  results: ArchiveSummary[],
  overrides: Partial<ArchivePage> = {},
): ArchivePage {
  return {
    count: results.length,
    page: 1,
    page_size: 20,
    total_pages: results.length ? 1 : 0,
    results,
    ...overrides,
  }
}

beforeEach(() => {
  mocks.permissions = ['fiscal.archivo.gestionar']
  mocks.archive = { isPending: false, isError: false, data: page([]) }
  mocks.archiveCalls = []
  mocks.upload.isError = false
  mocks.upload.isSuccess = false
})

it('restringe el archivo al Administrador', () => {
  mocks.permissions = ['fiscal.comercial.ver']
  render(<FiscalArchivePage />)
  expect(screen.getByText('Acceso restringido')).toBeInTheDocument()
})

it('muestra la condición externa no verificada y los comprobantes', () => {
  mocks.archive = { isPending: false, isError: false, data: page([dossier()]) }
  render(<FiscalArchivePage />)
  expect(
    screen.getByText('Evidencia externa no verificada'),
  ).toBeInTheDocument()
  expect(screen.getByText('Externa no verificada')).toBeInTheDocument()
  expect(screen.getByText('USD 100.00')).toBeInTheDocument()
})

it('muestra el error de carga sin exito ficticio', () => {
  mocks.upload.isError = true
  mocks.upload.error = new Error('El documento supera 2 MiB.')
  render(<FiscalArchivePage />)
  expect(screen.getByText('No se incorporó el comprobante')).toBeInTheDocument()
  expect(screen.queryByText(/Evidencia conservada/)).not.toBeInTheDocument()
})

it('filtra por ambiente y pagina sin cargar todo el archivo', async () => {
  const user = userEvent.setup()
  mocks.archive = {
    isPending: false,
    isError: false,
    data: page([dossier()], { count: 45, total_pages: 3 }),
  }
  render(<FiscalArchivePage />)

  expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(mocks.archiveCalls.at(-1)?.filters.page).toBe(2)

  await user.selectOptions(screen.getByLabelText('Ambiente'), '2')
  expect(mocks.archiveCalls.at(-1)?.filters).toEqual(
    expect.objectContaining({ environment: '2', page: 1 }),
  )
})
