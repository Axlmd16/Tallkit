import { expect, test, type Page } from '@playwright/test'

import { login } from './helpers'

const EMPTY_ARCHIVE_PAGE = {
  count: 0,
  page: 1,
  page_size: 20,
  total_pages: 0,
  results: [],
}

const preparation = (kind: 'COMMERCIAL' | 'ARTISAN', sourceId: number) => ({
  preparation_id: `${kind === 'COMMERCIAL' ? '11111111' : '22222222'}-1111-4111-8111-111111111111`,
  fiscal_entity_id: kind === 'COMMERCIAL' ? 1 : 2,
  source: { kind, id: sourceId, version: 2 },
  state: 'DRAFT',
  version: 1,
  draft: {
    environment: '1',
    reference_date: '2026-09-26',
    receiver: {},
    payments: {},
  },
  snapshot: null,
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
  prepared_at: null,
  official_status: null,
  official_submission: 'NOT_PERFORMED',
})

async function mockPreparation(
  page: Page,
  kind: 'COMMERCIAL' | 'ARTISAN',
  sourceId: number,
) {
  await page.route('**/api/v1/fiscal/preparations/*/', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({ json: preparation(kind, sourceId) })
  })
  await page.route(
    '**/api/v1/fiscal/configuration/entities/*/establishments/',
    (route) => route.fulfill({ json: [] }),
  )
}

test('preparación comercial permanece local y separa cobro y SRI', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await mockPreparation(page, 'COMMERCIAL', 7)
  await page.goto('/fiscal/preparations/11111111-1111-4111-8111-111111111111')
  await expect(page.getByText('Ambiente de ensayo')).toBeVisible()
  await expect(page.getByText('Sin envío realizado')).toBeVisible()
  await expect(
    page.getByText('Independiente; consulte la operación'),
  ).toBeVisible()
  await expect(page.getByText('Venta #7')).toBeVisible()
})

test('preparación artesanal conserva su ámbito propio', async ({ page }) => {
  await login(page, 'admin_e2e')
  await mockPreparation(page, 'ARTISAN', 9)
  await page.goto('/fiscal/preparations/22222222-1111-4111-8111-111111111111')
  await expect(page.getByText('Operación artesanal #9')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Volver a la operación' }),
  ).toHaveAttribute('href', '/maintenance/service-operations/9')
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
