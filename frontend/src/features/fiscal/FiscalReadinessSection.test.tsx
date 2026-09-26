import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import type { ArchiveReadiness } from './types'

const mocks = vi.hoisted(() => ({
  query: {
    isPending: false,
    isError: false,
    data: {
      fiscal_entity_id: 1,
      policy: null,
      restoration: null,
      policy_ready: false,
      restoration_ready: false,
      productive_archive_ready: false,
      pending: ['policy', 'restoration'],
    } as ArchiveReadiness,
  },
  policy: { mutate: vi.fn(), isPending: false, isError: false, error: null },
  restoration: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  },
}))

vi.mock('./hooks', () => ({
  useArchiveReadiness: () => mocks.query,
  useFiscalMutations: () => ({
    saveArchivePolicy: mocks.policy,
    recordRestoration: mocks.restoration,
  }),
}))

import { FiscalReadinessSection } from './FiscalReadinessSection'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.query.isPending = false
  mocks.query.isError = false
  mocks.query.data.productive_archive_ready = false
  mocks.query.data.pending = ['policy', 'restoration']
})

it('shows the positive administrative declaration without claiming verification', () => {
  mocks.query.data.productive_archive_ready = true
  mocks.query.data.pending = []
  render(<FiscalReadinessSection entityId={1} />)

  expect(screen.getByText('Declarado listo')).toBeInTheDocument()
  expect(
    screen.queryByText('Incorporación productiva bloqueada'),
  ).not.toBeInTheDocument()
  expect(
    screen.getByText(/No comprueba por sí solo que exista una copia externa/),
  ).toBeInTheDocument()
})

it('shows loading and persistent readiness errors', () => {
  mocks.query.isPending = true
  const { rerender } = render(<FiscalReadinessSection entityId={1} />)
  expect(
    screen.getByText('Consultando preparación operativa…'),
  ).toBeInTheDocument()

  mocks.query.isPending = false
  mocks.query.isError = true
  rerender(<FiscalReadinessSection entityId={1} />)
  expect(
    screen.getByText('No se pudo consultar la preparación del archivo.'),
  ).toBeInTheDocument()
})

it('keeps productive incorporation visibly blocked without policy and restoration', () => {
  render(<FiscalReadinessSection entityId={1} />)

  expect(screen.getByText('Bloqueado')).toBeInTheDocument()
  expect(
    screen.getByText('Incorporación productiva bloqueada'),
  ).toBeInTheDocument()
  expect(screen.getByText(/policy, restoration/)).toBeInTheDocument()
  expect(
    screen.getByText(/No comprueba por sí solo que exista una copia externa/),
  ).toBeInTheDocument()
  expect(screen.getByText(/ensayos sintéticos/)).toBeInTheDocument()
})

it('requires selecting an entity before recording readiness', () => {
  render(<FiscalReadinessSection entityId={undefined} />)

  expect(screen.getByText('Seleccione una entidad')).toBeInTheDocument()
  expect(screen.queryByText('Registrar nueva versión de política')).toBeNull()
})

it('records a complete versioned policy for the selected entity', async () => {
  const user = userEvent.setup()
  render(<FiscalReadinessSection entityId={1} />)
  await user.click(screen.getByText('Registrar nueva versión de política'))

  const values: Array<[string, string]> = [
    ['Responsable fiscal', 'Responsable E2E'],
    ['Finalidad', 'Conservación fiscal'],
    ['Fundamento', 'Obligación tributaria'],
    ['Canal de derechos', 'correo administrativo'],
    ['Procedimiento de derechos', 'Verificar legitimación'],
    ['Revisión al finalizar conservación', 'Revisar eliminación'],
    ['Identificador del almacenamiento', 'postgresql:v1'],
    ['Versión del procedimiento', 'archivo-v1'],
    ['Retención de XML', 'mínimo siete años'],
    ['Retención de contacto operativo', 'mientras sea necesario'],
    ['Retención de auditoría', 'según política'],
    ['Retención de exportaciones', 'hasta entrega'],
    ['Retención de copias', 'según rotación'],
  ]
  for (const [label, value] of values) {
    await user.type(screen.getAllByLabelText(label)[0]!, value)
  }
  await user.click(screen.getByRole('button', { name: 'Registrar versión' }))

  expect(mocks.policy.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      fiscal_entity_id: 1,
      responsible: 'Responsable E2E',
      procedure_version: 'archivo-v1',
      storage_fingerprint: 'postgresql:v1',
      retention: expect.objectContaining({
        fiscal_xml: 'mínimo siete años',
        backups: 'según rotación',
      }),
    }),
  )
})

it('records restoration evidence with every reconciliation check', async () => {
  const user = userEvent.setup()
  render(<FiscalReadinessSection entityId={1} />)
  await user.click(screen.getByText('Registrar evidencia de restauración'))

  await user.type(screen.getByLabelText('Fecha y hora'), '2026-09-26T08:00')
  const values: Array<[string, string]> = [
    ['Versión del procedimiento', 'archivo-v1'],
    ['Identificador del almacenamiento', 'postgresql:v1'],
    ['Responsable del ensayo', 'Operador E2E'],
    ['Identificador de copia', 'backup-001'],
    ['Referencia del informe', 'docs/informe.md'],
    ['Destino aislado', 'postgresql aislado'],
    ['Notas', 'Solo datos sintéticos'],
  ]
  for (const [label, value] of values) {
    await user.type(screen.getAllByLabelText(label).at(-1)!, value)
  }
  for (const label of [
    'Contenido y hashes',
    'Identidades',
    'Permisos',
    'Vínculos',
    'Decisiones de eliminación posteriores revisadas',
  ]) {
    await user.click(screen.getByLabelText(label))
  }
  await user.click(screen.getByRole('button', { name: 'Registrar evidencia' }))

  expect(mocks.restoration.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      procedure_version: 'archivo-v1',
      storage_fingerprint: 'postgresql:v1',
      backup_identifier: 'backup-001',
      content_hashes_ok: true,
      identities_ok: true,
      permissions_ok: true,
      links_ok: true,
      deletion_reviewed: true,
    }),
  )
})
