import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import type { ArchiveSummary } from '@/features/fiscal/types'

import { FiscalArchivePage } from './FiscalArchivePage'

const mocks = vi.hoisted(() => ({
  permissions: ['fiscal.archivo.gestionar'] as string[],
  archive: { isPending: false, isError: false, data: [] as ArchiveSummary[] },
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
  useArchive: () => mocks.archive,
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

beforeEach(() => {
  mocks.permissions = ['fiscal.archivo.gestionar']
  mocks.archive = { isPending: false, isError: false, data: [] }
  mocks.upload.isError = false
  mocks.upload.isSuccess = false
})

it('restringe el archivo al Administrador', () => {
  mocks.permissions = ['fiscal.comercial.ver']
  render(<FiscalArchivePage />)
  expect(screen.getByText('Acceso restringido')).toBeInTheDocument()
})

it('muestra la condición externa no verificada y los comprobantes', () => {
  mocks.archive = { isPending: false, isError: false, data: [dossier()] }
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
