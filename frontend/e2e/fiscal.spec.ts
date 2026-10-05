import { expect, test, type Page } from '@playwright/test'

import { login } from './helpers'

const EMPTY_ARCHIVE_PAGE = {
  count: 0,
  page: 1,
  page_size: 20,
  total_pages: 0,
  results: [],
}

const NOTICE =
  'Esta preparación todavía no es una factura electrónica. No ha sido firmada ni enviada al SRI.'

const PAYMENT_OPTIONS = [
  {
    code: '01',
    display_name: 'Efectivo o sin sistema financiero',
    description: 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
    internal_method: 'EFECTIVO',
  },
  {
    code: '20',
    display_name: 'Transferencia u otros con sistema financiero',
    description: 'OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO',
    internal_method: 'TRANSFERENCIA',
  },
]

const preparation = (
  kind: 'COMMERCIAL' | 'ARTISAN',
  sourceId: number,
  state: 'DRAFT' | 'PREPARED' = 'DRAFT',
) => ({
  preparation_id: `${kind === 'COMMERCIAL' ? '11111111' : '22222222'}-1111-4111-8111-111111111111`,
  fiscal_entity_id: kind === 'COMMERCIAL' ? 1 : 2,
  source: { kind, id: sourceId, version: 2 },
  state,
  version: 1,
  draft: {},
  snapshot:
    state === 'PREPARED'
      ? {
          reference_date: '2026-09-26',
          receiver: {
            legal_name: 'Cliente E2E S.A.',
            identification: '0999999999001',
          },
          totals: { tax: '13.04', grand: '100.00' },
          lines: [
            {
              position: 1,
              description: 'Filtro de aceite',
              quantity: '2',
              total_amount: '100.00',
              display_name: 'IVA 15 %',
            },
          ],
          payments: [
            {
              payment_code: '01',
              amount: '100.00',
              display_name: 'Efectivo o sin sistema financiero',
            },
          ],
          configuration: { point: { code: '001' } },
        }
      : null,
  discrepancy: {
    source_changed: false,
    state_changed: false,
    corrections_changed: false,
    original_state: 'CONFIRMED',
    current_state: 'CONFIRMED',
    original_source_version: 2,
    current_source_version: 2,
    current_correction_ids: [],
  },
  cancellation_reason: '',
  created_at: '2026-09-26T10:00:00-05:00',
  prepared_at: state === 'PREPARED' ? '2026-09-26T10:05:00-05:00' : null,
  official_status: null,
  official_submission: 'NOT_PERFORMED',
  summary: {
    kind,
    internal_number:
      kind === 'COMMERCIAL' ? 'COM-VEN-000007' : 'ART-SER-000009',
    operational_date: '2026-09-26',
    condition: 'CONTADO',
    state: 'CONFIRMED',
    base_total: '86.96',
    tax_total: '13.04',
    grand_total: '100.00',
    lines: [
      {
        position: 1,
        description: kind === 'COMMERCIAL' ? 'Filtro de aceite' : 'Alineación',
        quantity: kind === 'COMMERCIAL' ? '2' : '1',
        total: '100.00',
      },
    ],
  },
  issuer: {
    ruc: kind === 'COMMERCIAL' ? '1790000000001' : '1790000000002',
    legal_name: kind === 'COMMERCIAL' ? 'Comercial E2E' : 'Taller E2E',
  },
  working:
    state === 'DRAFT'
      ? {
          draft_format: 2,
          receiver: {
            identification_type: kind === 'COMMERCIAL' ? '04' : '05',
            identification:
              kind === 'COMMERCIAL' ? '0999999999001' : '0102030405',
            legal_name: 'Cliente E2E S.A.',
          },
          payments: {
            forms: [{ payment_code: '01', amount: '100.00' }],
            suggested: true,
            suggestion_origin: 'DEFAULT',
          },
          additional_info: [],
        }
      : null,
  payment_options: state === 'DRAFT' ? PAYMENT_OPTIONS : [],
  missing_fields: state === 'DRAFT' ? ['address'] : [],
  technical: null,
})

async function mockPreparationFlow(
  page: Page,
  kind: 'COMMERCIAL' | 'ARTISAN',
  sourceId: number,
) {
  let state: 'DRAFT' | 'PREPARED' = 'DRAFT'
  const patches: unknown[] = []
  await page.route('**/api/v1/fiscal/preparations/*/', async (route) => {
    const method = route.request().method()
    if (method === 'PATCH') {
      patches.push(route.request().postDataJSON())
      return route.fulfill({
        json: { preparation_id: 'x', state: 'DRAFT', version: 2, draft: {} },
      })
    }
    return route.fulfill({ json: preparation(kind, sourceId, state) })
  })
  await page.route('**/api/v1/fiscal/preparations/*/review/', (route) =>
    route.fulfill({ json: { impediments: [], review_token: 'token-e2e' } }),
  )
  await page.route('**/api/v1/fiscal/preparations/*/prepare/', (route) => {
    state = 'PREPARED'
    return route.fulfill({
      json: { preparation_id: 'x', replayed: false },
    })
  })
  return patches
}

test('el Vendedor revisa datos precargados y guarda una preparación local', async ({
  page,
}) => {
  await login(page, 'vendedor_e2e')
  const patches = await mockPreparationFlow(page, 'COMMERCIAL', 7)
  await page.goto('/fiscal/preparations/11111111-1111-4111-8111-111111111111')

  await expect(
    page.getByRole('heading', { name: 'Borrador fiscal' }),
  ).toBeVisible()
  await expect(page.getByText(NOTICE)).toBeVisible()
  await expect(page.getByText('Venta comercial COM-VEN-000007')).toBeVisible()
  await expect(page.getByText('Cliente E2E S.A.')).toBeVisible()
  await expect(page.getByLabel(/ambiente/i)).toHaveCount(0)
  await expect(page.getByLabel(/punto de emisión/i)).toHaveCount(0)
  await expect(page.getByLabel(/plazo/i)).toHaveCount(0)
  await expect(
    page.getByText(/Sugerido con la forma de pago predeterminada/),
  ).toBeVisible()

  await page.getByLabel('Dirección (opcional)').fill('Av. Principal 1')
  await page
    .getByRole('button', { name: 'Revisar datos para facturación' })
    .click()
  await expect.poll(() => patches.length).toBe(1)
  expect(patches[0]).toEqual({
    expected_version: 1,
    receiver: {
      identification_type: '04',
      identification: '0999999999001',
      legal_name: 'Cliente E2E S.A.',
      address: 'Av. Principal 1',
    },
    payments: { forms: [{ payment_code: '01', amount: '100.00' }] },
  })

  await page.getByRole('button', { name: 'Guardar preparación local' }).click()
  await expect(
    page.getByRole('status', {
      name: 'Estado: Preparación local · Pendiente de emisión',
    }),
  ).toBeVisible()
  await expect(page.getByText(NOTICE)).toBeVisible()
  await expect(page.getByText(/factura emitida|autorizada/i)).toHaveCount(0)
})

test('el Encargado prepara la operación artesanal con cédula precargada', async ({
  page,
}) => {
  await login(page, 'taller_e2e')
  await mockPreparationFlow(page, 'ARTISAN', 9)
  await page.goto('/fiscal/preparations/22222222-1111-4111-8111-111111111111')
  await expect(
    page.getByText('Operación artesanal ART-SER-000009'),
  ).toBeVisible()
  await expect(page.getByText('Cédula')).toBeVisible()
  await expect(page.getByText('Taller E2E · RUC 1790000000002')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Volver a la operación' }),
  ).toHaveAttribute('href', '/maintenance/service-operations/9')
})

test('una preparación completada conserva su punto después de cambiar la configuración', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await page.route('**/api/v1/fiscal/preparations/*/', (route) =>
    route.fulfill({
      json: {
        ...preparation('COMMERCIAL', 7, 'PREPARED'),
        technical: { configuration: { point: { code: '001', version: 1 } } },
      },
    }),
  )
  await page.goto('/fiscal/preparations/11111111-1111-4111-8111-111111111111')
  await expect(
    page.getByRole('heading', { name: 'Preparación local' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Cambios posteriores de la configuración no los modifican/),
  ).toBeVisible()
  await page.getByText('Información avanzada').click()
  await expect(page.getByText(/"code": "001"/)).toBeVisible()
})

test('archivo administrativo muestra evidencia externa y readiness', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await page.route('**/api/v1/workshop-configuration/entities/', (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          entity_type: 'COMERCIAL',
          ruc: '1790000000001',
          legal_name: 'Comercial E2E',
        },
      ],
    }),
  )
  await page.route('**/api/v1/fiscal/archive/**', (route) =>
    route.fulfill({ json: EMPTY_ARCHIVE_PAGE }),
  )
  await page.route('**/api/v1/fiscal/readiness/**', (route) =>
    route.fulfill({
      json: {
        fiscal_entity_id: 1,
        policy: null,
        restoration: null,
        policy_ready: false,
        restoration_ready: false,
        productive_archive_ready: false,
        pending: ['policy', 'restoration'],
      },
    }),
  )
  await page.goto('/fiscal/archive')
  await expect(
    page.getByText('Evidencia externa no verificada', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Filtrar por entidad').selectOption('1')
  await expect(
    page.getByText('Incorporación productiva bloqueada'),
  ).toBeVisible()
})

test('un bloqueo crítico de readiness permanece visible y no muestra éxito', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await page.route('**/api/v1/workshop-configuration/entities/', (route) =>
    route.fulfill({
      json: [{ id: 1, entity_type: 'COMERCIAL', ruc: '1790000000001' }],
    }),
  )
  await page.route('**/api/v1/fiscal/archive/', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 409,
        json: {
          code: 'fiscal_readiness_required',
          detail:
            'La incorporación productiva requiere política y restauración.',
        },
      })
    }
    return route.fulfill({ json: EMPTY_ARCHIVE_PAGE })
  })
  await page.goto('/fiscal/archive')
  await page.getByLabel('Procedencia').fill('Ensayo E2E')
  await page.getByLabel('Archivo XML').setInputFiles({
    name: 'factura.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from('<factura/>'),
  })
  await page.getByRole('button', { name: 'Incorporar' }).click()
  await expect(page.getByText('No se incorporó el comprobante')).toBeVisible()
  await expect(page.getByText(/Evidencia conservada/)).toHaveCount(0)
})

test('el Encargado ve el emisor y el código propio del servicio de una operación a tarifa cero', async ({
  page,
}) => {
  await login(page, 'taller_e2e')
  await page.route('**/api/v1/fiscal/preparations/*/', (route) =>
    route.fulfill({
      json: {
        ...preparation('ARTISAN', 9, 'PREPARED'),
        snapshot: {
          snapshot_format: 3,
          reference_date: '2026-10-05',
          issuer: {
            ruc: '1104018559001',
            legal_name: 'Taller E2E',
            tax_profile: {
              regime: 'GENERAL',
              accounting_obligation: 'NO',
              artisan_qualification: {
                number: 'JNDA-12345',
                issuing_body: 'Junta Nacional de Defensa del Artesano',
                ends_on: '2028-05-31',
              },
            },
          },
          receiver: {
            legal_name: 'Cliente E2E',
            identification: '0102030405',
          },
          totals: { tax: '0.00', grand: '25.00' },
          lines: [
            {
              position: 1,
              item_code: 'SRV-000012',
              description: 'Reparación de caja de cambios',
              quantity: '1',
              total_amount: '25.00',
              display_name: 'IVA 0 %',
            },
          ],
          payments: [{ payment_code: '01', amount: '25.00' }],
          legends: [],
        },
      },
    }),
  )
  await page.goto('/fiscal/preparations/22222222-1111-4111-8111-111111111111')

  const issuer = page.getByLabel('Emisor preparado')
  await expect(issuer).toContainText('General')
  await expect(issuer).toContainText('JNDA-12345 · vence 2028-05-31')
  await expect(page.getByText('SRV-000012')).toBeVisible()
  await expect(page.getByText('IVA 0 %')).toBeVisible()
  await expect(page.getByText(/factura emitida|autorizada/i)).toHaveCount(0)
})

test('un código de producto excedido bloquea la preparación y se explica al Administrador', async ({
  page,
}) => {
  await login(page, 'vendedor_e2e')
  await mockPreparationFlow(page, 'COMMERCIAL', 7)
  await page.route('**/api/v1/fiscal/preparations/*/review/', (route) =>
    route.fulfill({
      json: {
        review_token: null,
        impediments: [
          {
            field: 'line[1].item_code',
            code: 'line_text_limit',
            audience: 'ADMINISTRATOR',
            message:
              'El código «CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC» de «Filtro de aceite» tiene 31 caracteres y el comprobante admite hasta 25. Corrija el producto o servicio en el catálogo.',
          },
        ],
      },
    }),
  )
  await page.goto('/fiscal/preparations/11111111-1111-4111-8111-111111111111')
  await page.getByLabel('Dirección (opcional)').fill('Av. Principal 1')
  await page
    .getByRole('button', { name: 'Revisar datos para facturación' })
    .click()

  const admin = page.getByRole('list', {
    name: 'Debe resolverlo el Administrador',
  })
  await expect(admin).toContainText('tiene 31 caracteres')
  await expect(admin).toContainText('admite hasta 25')
  await expect(
    page.getByRole('button', { name: 'Guardar preparación local' }),
  ).toHaveCount(0)
})
