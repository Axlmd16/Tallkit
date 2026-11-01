import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

import type { StatusCause } from '../types'

const mocks = vi.hoisted(() => ({
  profile: undefined as unknown,
  saveProfile: { mutateAsync: vi.fn(), isPending: false },
}))

vi.mock('../hooks', () => ({
  useElectronicProfile: () => ({
    data: mocks.profile,
    isLoading: false,
    isError: false,
  }),
  useFiscalMutations: () => ({ saveProfile: mocks.saveProfile }),
  useWithholdingSettings: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
  }),
}))

import { ProfileConditionsSection } from './ProfileConditionsSection'

const OPTIONS = {
  tax_regime: [
    { value: 'GENERAL', label: 'General' },
    { value: 'RIMPE_EMPRENDEDOR', label: 'RIMPE Emprendedor' },
    { value: 'RIMPE_NEGOCIO_POPULAR', label: 'RIMPE Negocio Popular' },
  ],
  accounting_obligation: [
    { value: 'SI', label: 'Sí' },
    { value: 'NO', label: 'No' },
  ],
}

const SIX_KEYS = [
  'tax_regime',
  'accounting_obligation',
  'withholding_agent',
  'special_taxpayer',
  'large_taxpayer',
  'artisan_qualification',
]

function profile(overrides: Record<string, unknown> = {}) {
  return {
    entity_id: 1,
    revision: 1,
    conditions_format: 2,
    conditions: {},
    certificate: null,
    regime_legend: null,
    options: OPTIONS,
    ...overrides,
  }
}

beforeEach(() => {
  mocks.profile = profile()
  mocks.saveProfile.mutateAsync.mockReset()
  mocks.saveProfile.mutateAsync.mockResolvedValue({})
})

function renderSection(warnings: StatusCause[] = []) {
  return render(
    <ToastProvider>
      <ProfileConditionsSection entityId={1} warnings={warnings} />
    </ToastProvider>,
  )
}

async function openDialog(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('button', { name }))
  return screen.getByRole('dialog')
}

async function fillSource(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  await user.type(
    within(dialog).getByLabelText(/Fuente o documento/),
    'Certificado de RUC',
  )
  await user.type(within(dialog).getByLabelText(/Vigente desde/), '2026-01-01')
}

function savedConditions() {
  const call = mocks.saveProfile.mutateAsync.mock.calls[0]![0] as {
    data: { expected_revision: number; conditions: Record<string, unknown> }
  }
  return call.data
}

it('lista las seis condiciones y no ofrece el régimen RIMPE como condición aparte', () => {
  renderSection()
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
  expect(
    rows.map((row) => within(row).getAllByRole('rowheader')[0]?.textContent),
  ).toEqual([
    'Régimen tributario',
    'Obligado a llevar contabilidad',
    'Agente de retención',
    'Contribuyente especial',
    'Gran contribuyente',
    'Calificación artesanal',
  ])
  expect(screen.queryByRole('button', { name: /RIMPE$/ })).toBeNull()
})

it('declara el régimen con una lista cerrada y sin texto libre', async () => {
  const user = userEvent.setup()
  renderSection()
  const dialog = await openDialog(user, 'Declarar Régimen tributario')

  const select = within(dialog).getByRole('combobox', { name: /Régimen/ })
  expect(
    within(select)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual([
    'Seleccione…',
    'General',
    'RIMPE Emprendedor',
    'RIMPE Negocio Popular',
  ])
  expect(within(dialog).queryByRole('radio')).toBeNull()
  expect(
    within(dialog).queryByLabelText(/Detalle|Régimen declarado/),
  ).toBeNull()

  await user.selectOptions(select, 'RIMPE_EMPRENDEDOR')
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )

  const { conditions, expected_revision } = savedConditions()
  expect(expected_revision).toBe(1)
  expect(Object.keys(conditions)).toEqual(SIX_KEYS)
  expect(conditions).not.toHaveProperty('rimpe')
  expect(conditions.tax_regime).toEqual({
    status: 'APPLICABLE',
    value: 'RIMPE_EMPRENDEDOR',
    source: 'Certificado de RUC',
    starts_on: '2026-01-01',
  })
  expect(conditions.accounting_obligation).toEqual({ status: 'UNKNOWN' })
})

it('explica que la leyenda del régimen la pone el sistema y la muestra de solo lectura', async () => {
  const user = userEvent.setup()
  mocks.profile = profile({
    regime_legend: 'CONTRIBUYENTE RÉGIMEN RIMPE',
    conditions: {
      tax_regime: {
        status: 'APPLICABLE',
        value: 'RIMPE_EMPRENDEDOR',
        source: 'Certificado',
        starts_on: '2026-01-01',
      },
    },
  })
  renderSection()
  const row = within(screen.getByRole('table')).getAllByRole('row')[1]!
  expect(row).toHaveTextContent('RIMPE Emprendedor')
  expect(row).toHaveTextContent('Leyenda en la factura')
  expect(row).toHaveTextContent('CONTRIBUYENTE RÉGIMEN RIMPE')
  const dialog = await openDialog(user, 'Editar Régimen tributario')
  expect(dialog).toHaveTextContent('La leyenda del régimen la pone el sistema')
})

it('declara si está obligado a llevar contabilidad con Sí o No', async () => {
  const user = userEvent.setup()
  renderSection()
  const dialog = await openDialog(
    user,
    'Declarar Obligado a llevar contabilidad',
  )
  const select = within(dialog).getByRole('combobox', { name: /contabilidad/ })
  expect(
    within(select)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Seleccione…', 'Sí', 'No'])
  await user.selectOptions(select, 'NO')
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  expect(savedConditions().conditions.accounting_obligation).toEqual({
    status: 'APPLICABLE',
    value: 'NO',
    source: 'Certificado de RUC',
    starts_on: '2026-01-01',
  })
})

it.each([
  ['Agente de retención', 8],
  ['Contribuyente especial', 13],
])(
  'pide el número de %s solo cuando aplica y limita su longitud',
  async (label, max) => {
    const user = userEvent.setup()
    renderSection()
    const dialog = await openDialog(user, `Declarar ${label}`)
    expect(within(dialog).queryByLabelText(/Número de resolución/)).toBeNull()
    await user.click(within(dialog).getByRole('radio', { name: 'No aplica' }))
    expect(within(dialog).queryByLabelText(/Número de resolución/)).toBeNull()
    await user.click(within(dialog).getByRole('radio', { name: 'Aplica' }))
    expect(
      within(dialog).getByLabelText(/Número de resolución/),
    ).toHaveAttribute('maxlength', String(max))
  },
)

it('guarda el número de resolución del agente de retención', async () => {
  const user = userEvent.setup()
  renderSection()
  const dialog = await openDialog(user, 'Declarar Agente de retención')
  await user.click(within(dialog).getByRole('radio', { name: 'Aplica' }))
  await user.type(
    within(dialog).getByLabelText(/Número de resolución/),
    '12345678',
  )
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  expect(savedConditions().conditions.withholding_agent).toEqual({
    status: 'APPLICABLE',
    value: '12345678',
    source: 'Certificado de RUC',
    starts_on: '2026-01-01',
  })
})

it('exige número, organismo y vencimiento en la calificación artesanal', async () => {
  const user = userEvent.setup()
  renderSection()
  const dialog = await openDialog(user, 'Declarar Calificación artesanal')
  await user.click(within(dialog).getByRole('radio', { name: 'Aplica' }))
  await user.type(
    within(dialog).getByLabelText(/Número de calificación/),
    'JNDA-12345',
  )
  await user.type(
    within(dialog).getByLabelText(/Organismo que la otorgó/),
    'Junta Nacional de Defensa del Artesano',
  )
  await fillSource(user, dialog)
  const ends = within(dialog).getByLabelText(/Vence el/)
  expect(ends).toBeRequired()
  await user.type(ends, '2028-05-31')
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  expect(savedConditions().conditions.artisan_qualification).toEqual({
    status: 'APPLICABLE',
    value: 'JNDA-12345',
    source: 'Certificado de RUC',
    starts_on: '2026-01-01',
    ends_on: '2028-05-31',
    issuing_body: 'Junta Nacional de Defensa del Artesano',
  })
})

it('muestra la calificación con su número y vencimiento y avisa si está por vencer', async () => {
  const user = userEvent.setup()
  mocks.profile = profile({
    conditions: {
      artisan_qualification: {
        status: 'APPLICABLE',
        value: 'JNDA-12345',
        source: 'Certificado',
        starts_on: '2026-01-01',
        ends_on: '2026-11-10',
        issuing_body: 'Junta Nacional de Defensa del Artesano',
      },
    },
  })
  renderSection([
    {
      code: 'artisan_qualification_expiring',
      kind: 'REVIEW',
      message: 'Calificación artesanal: vence el 2026-11-10 (faltan 45 días).',
    },
  ])
  const rows = within(screen.getByRole('table')).getAllByRole('row')
  expect(rows[6]).toHaveTextContent('JNDA-12345 · vence 2026-11-10')

  const notice = screen.getByRole('button', { name: 'Calificación por vencer' })
  await user.hover(notice)
  expect(screen.getByRole('note')).toHaveTextContent('faltan 45 días')
})

it('muestra el error del servidor junto al campo y mantiene abierto el modal', async () => {
  const user = userEvent.setup()
  mocks.saveProfile.mutateAsync.mockRejectedValue(
    new ProblemError(
      'Hay condiciones tributarias inválidas.',
      400,
      'validation_error',
      undefined,
      {
        'accounting_obligation.value': ['Seleccione Sí o No.'],
      },
    ),
  )
  renderSection()
  const dialog = await openDialog(
    user,
    'Declarar Obligado a llevar contabilidad',
  )
  await user.selectOptions(within(dialog).getByRole('combobox'), 'SI')
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  expect(await within(dialog).findByText('Seleccione Sí o No.')).toBeVisible()
  expect(screen.getByRole('dialog')).toBeVisible()
})

it('conserva lo escrito y explica el conflicto de revisión', async () => {
  const user = userEvent.setup()
  mocks.saveProfile.mutateAsync.mockRejectedValue(
    new ProblemError('Conflicto', 409, 'revision_conflict'),
  )
  renderSection()
  const dialog = await openDialog(user, 'Declarar Régimen tributario')
  await user.selectOptions(within(dialog).getByRole('combobox'), 'GENERAL')
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  expect(
    await within(dialog).findByText(/Otro guardado cambió el perfil/),
  ).toBeVisible()
  expect(within(dialog).getByRole('combobox')).toHaveValue('GENERAL')
})

it('trata un perfil anterior como pendiente de declarar de nuevo y no reenvía su texto libre', async () => {
  const user = userEvent.setup()
  mocks.profile = profile({
    revision: 3,
    conditions_format: 1,
    conditions: {
      accounting_obligation: {
        status: 'APPLICABLE',
        value: 'no obligado',
        source: 'Certificado',
        starts_on: '2026-01-01',
      },
      rimpe: { status: 'UNKNOWN' },
    },
  })
  renderSection()

  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(6)
  for (const row of rows) expect(row).toHaveTextContent('Sin declarar')

  const notice = screen.getByRole('button', { name: 'Perfil anterior' })
  await user.hover(notice)
  expect(screen.getByRole('note')).toHaveTextContent('Declare de nuevo')
  await user.keyboard('{Escape}')
  expect(screen.getByText(/no obligado/)).toBeInTheDocument()

  const dialog = await openDialog(
    user,
    'Declarar Obligado a llevar contabilidad',
  )
  await user.selectOptions(within(dialog).getByRole('combobox'), 'NO')
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )

  const { conditions, expected_revision } = savedConditions()
  expect(expected_revision).toBe(3)
  expect(Object.keys(conditions)).toEqual(SIX_KEYS)
  expect(JSON.stringify(conditions)).not.toContain('no obligado')
  expect(conditions.tax_regime).toEqual({ status: 'UNKNOWN' })
})

it('declara gran contribuyente con su número de resolución y conserva las demás condiciones', async () => {
  const user = userEvent.setup()
  mocks.profile = profile({
    conditions: {
      tax_regime: {
        status: 'APPLICABLE',
        value: 'GENERAL',
        source: 'Certificado',
        starts_on: '2026-01-01',
      },
    },
  })
  renderSection()
  const dialog = await openDialog(user, 'Declarar Gran contribuyente')
  await user.click(within(dialog).getByRole('radio', { name: 'Aplica' }))
  await user.type(
    within(dialog).getByLabelText(/Número de resolución/),
    'NAC-GCFOIOC21-00000868-E',
  )
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  const saved = savedConditions().conditions
  expect(saved.large_taxpayer).toEqual({
    status: 'APPLICABLE',
    value: 'NAC-GCFOIOC21-00000868-E',
    source: 'Certificado de RUC',
    starts_on: '2026-01-01',
  })
  expect((saved.tax_regime as { value: string }).value).toBe('GENERAL')
  expect(Object.keys(saved)).toEqual(SIX_KEYS)
})

it('declara gran contribuyente como no aplica sin pedir número', async () => {
  const user = userEvent.setup()
  renderSection()
  const dialog = await openDialog(user, 'Declarar Gran contribuyente')
  await user.click(within(dialog).getByRole('radio', { name: 'No aplica' }))
  expect(within(dialog).queryByLabelText(/Número de resolución/)).toBeNull()
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  expect(savedConditions().conditions.large_taxpayer).toMatchObject({
    status: 'NOT_APPLICABLE',
  })
})

it('una revisión anterior sin gran contribuyente la muestra sin declarar y pide declararla', () => {
  mocks.profile = profile({
    conditions: {
      tax_regime: {
        status: 'APPLICABLE',
        value: 'GENERAL',
        source: 'Certificado',
        starts_on: '2026-01-01',
      },
    },
  })
  renderSection()
  const row = within(screen.getByRole('table'))
    .getAllByRole('row')
    .find((candidate) => candidate.textContent?.includes('Gran contribuyente'))!
  expect(row).toHaveTextContent('Sin declarar')
  expect(
    screen.getByRole('button', { name: 'Declarar Gran contribuyente' }),
  ).toBeInTheDocument()
})

it('muestra la leyenda derivada de Negocio Popular como dato de solo lectura', () => {
  mocks.profile = profile({
    regime_legend: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
    conditions: {
      tax_regime: {
        status: 'APPLICABLE',
        value: 'RIMPE_NEGOCIO_POPULAR',
        source: 'Certificado',
        starts_on: '2026-01-01',
      },
    },
  })
  renderSection()
  const row = within(screen.getByRole('table')).getAllByRole('row')[1]!
  expect(row).toHaveTextContent('RIMPE Negocio Popular')
  expect(row).toHaveTextContent('CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE')
})

it('muestra junto al campo el error del servidor del número de resolución', async () => {
  const user = userEvent.setup()
  mocks.saveProfile.mutateAsync.mockRejectedValue(
    new ProblemError(
      'Hay condiciones tributarias inválidas.',
      400,
      'validation_error',
      undefined,
      {
        'withholding_agent.value': [
          'El número de resolución admite de 1 a 8 dígitos, sin ceros a la izquierda.',
        ],
      },
    ),
  )
  renderSection()
  const dialog = await openDialog(user, 'Declarar Agente de retención')
  await user.click(within(dialog).getByRole('radio', { name: 'Aplica' }))
  await user.type(
    within(dialog).getByLabelText(/Número de resolución/),
    '00012',
  )
  await fillSource(user, dialog)
  await user.click(
    within(dialog).getByRole('button', { name: 'Guardar condición' }),
  )
  expect(
    await within(dialog).findByText(/sin ceros a la izquierda/),
  ).toBeVisible()
})
