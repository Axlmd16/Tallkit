import { expect, test, type Page } from '@playwright/test'

import { login } from './helpers'

const ENTITIES = [
  {
    id: 1,
    entity_type: 'COMERCIAL',
    ruc: '1790000000001',
    legal_name: 'Comercial E2E',
    trade_name: null,
    address: 'Matriz',
    phone: null,
    email: null,
    version: 1,
  },
  {
    id: 2,
    entity_type: 'ARTESANAL',
    ruc: '1790000000002',
    legal_name: 'Taller E2E',
    trade_name: null,
    address: 'Taller',
    phone: null,
    email: null,
    version: 1,
  },
]

const PAYMENT_FORMS = [
  ['01', 'Efectivo o sin sistema financiero', true],
  ['15', 'Compensación de deudas', false],
  ['16', 'Tarjeta de débito', false],
  ['17', 'Dinero electrónico', false],
  ['18', 'Tarjeta prepago', false],
  ['19', 'Tarjeta de crédito', false],
  ['20', 'Transferencia u otros con sistema financiero', true],
  ['21', 'Endoso de títulos', false],
].map(([code, display_name, enableable]) => ({
  code,
  description: String(display_name).toUpperCase(),
  display_name,
  catalog_version: 'SRI-2.34-TABLA24',
  source_document: 'Ficha técnica de comprobantes electrónicos esquema offline',
  source_version: '2.34',
  source_url: 'https://www.sri.gob.ec/',
  downloaded_on: '2026-09-26',
  valid_from: '2016-06-01',
  valid_to: null,
  is_current: true,
  enableable,
  enabled: enableable,
  is_default: code === '01',
  internal_method: enableable ? 'EFECTIVO' : null,
  version: 0,
}))

function establishments(entityId: number) {
  const points = entityId === 1 ? ['001', '002'] : ['001']
  return [
    {
      id: entityId * 10,
      entity_id: entityId,
      code: '001',
      address: entityId === 1 ? 'Local comercial' : 'Local del taller',
      is_active: true,
      version: 1,
      points: points.map((code, index) => ({
        id: entityId * 100 + index,
        establishment_id: entityId * 10,
        code,
        is_active: true,
        version: 1,
      })),
    },
  ]
}

async function mockConfiguration(page: Page) {
  const defaultsWrites: unknown[] = []
  const api = '**/api/v1'
  await page.route(`${api}/workshop-configuration/status/`, (route) =>
    route.fulfill({ json: { is_initialized: true } }),
  )
  await page.route(`${api}/workshop-configuration/entities/`, (route) =>
    route.fulfill({ json: ENTITIES }),
  )
  await page.route(`${api}/workshop-configuration/warehouse/`, (route) =>
    route.fulfill({
      json: { id: 1, name: 'Bodega Principal', is_active: true, version: 1 },
    }),
  )
  await page.route(`${api}/workshop-configuration/taxes/`, (route) =>
    route.fulfill({
      json: [
        {
          id: 10,
          code: 'IVA',
          name: 'IVA venta',
          fiscal_entity_id: 1,
          entity_type: 'COMERCIAL',
          current_rate: '15',
        },
      ],
    }),
  )
  await page.route(`${api}/workshop-configuration/series/`, (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          code: 'COM-VEN',
          is_active: true,
          last_number: 3,
          version: 1,
          document_type: 'VENTA',
          entity_type: 'COMERCIAL',
        },
      ],
    }),
  )
  await page.route(
    `${api}/fiscal/configuration/entities/*/electronic-status/`,
    (route) => {
      const id = Number(route.request().url().split('/').at(-3))
      return route.fulfill({
        json: {
          entity_id: id,
          state: id === 1 ? 'INCOMPLETE' : 'NOT_CONFIGURED',
          causes: [
            id === 1
              ? {
                  code: 'default_point_required',
                  kind: 'MISSING',
                  message:
                    'Hay varios puntos activos: designe el punto predeterminado para preparar.',
                }
              : {
                  code: 'profile',
                  kind: 'MISSING',
                  message: 'Todavía no existe una configuración guardada.',
                },
          ],
          warnings: [],
          environment: 'TEST',
          profile_revision: id === 1 ? 1 : null,
          default_point_id: null,
          default_payment_code: '01',
        },
      })
    },
  )
  await page.route(
    `${api}/fiscal/configuration/entities/*/electronic-profile/`,
    (route) => {
      const id = Number(route.request().url().split('/').at(-3))
      return route.fulfill({
        json: {
          entity_id: id,
          revision: id === 1 ? 1 : 0,
          conditions: {},
          certificate: null,
        },
      })
    },
  )
  await page.route(
    `${api}/fiscal/configuration/entities/*/establishments/`,
    (route) =>
      route.fulfill({
        json: establishments(Number(route.request().url().split('/').at(-3))),
      }),
  )
  await page.route(
    `${api}/fiscal/configuration/entities/*/preparation-defaults/`,
    async (route) => {
      const id = Number(route.request().url().split('/').at(-3))
      if (route.request().method() === 'PUT') {
        defaultsWrites.push(route.request().postDataJSON())
      }
      return route.fulfill({
        json: {
          entity_id: id,
          version: defaultsWrites.length,
          designated_point_id: null,
          effective_point_id: id === 2 ? 200 : null,
          point_issue: id === 1 ? 'default_point_required' : null,
          default_payment_code: '01',
          payment_issue: null,
        },
      })
    },
  )
  await page.route(
    `${api}/fiscal/configuration/entities/*/tax-mappings/`,
    (route) => route.fulfill({ json: [] }),
  )
  await page.route(
    `${api}/fiscal/configuration/entities/*/payment-forms/`,
    (route) => route.fulfill({ json: PAYMENT_FORMS }),
  )
  await page.route(`${api}/fiscal/configuration/catalogs/**`, (route) =>
    route.fulfill({ json: [] }),
  )
  return defaultsWrites
}

test('la configuración se organiza en pestañas navegables por teclado', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await mockConfiguration(page)
  await page.goto('/configuration')

  const tabs = page.getByRole('tablist', { name: 'Secciones de configuración' })
  await expect(tabs.getByRole('tab')).toHaveText([
    /Entidades fiscales/,
    /Bodega/,
    /Impuestos/,
    /Series y numeración/,
    /Facturación electrónica/,
  ])
  await expect(
    page.getByRole('heading', { name: 'Entidades fiscales' }),
  ).toBeVisible()

  await tabs.getByRole('tab', { name: /Bodega/ }).click()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: /Impuestos/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('End')
  await expect(page).toHaveURL(/tab=facturacion/)
  await expect(
    page.getByText(
      'Configuración para preparación local. La emisión electrónica todavía no está habilitada.',
    ),
  ).toBeVisible()
})

test('facturación electrónica designa el punto y separa las entidades', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  const writes = await mockConfiguration(page)
  await page.goto('/configuration?tab=facturacion&seccion=puntos')

  await expect(page.getByText('Local comercial', { exact: true })).toBeVisible()
  await page
    .getByLabel('Punto predeterminado para preparar')
    .selectOption({ label: '001-002 · Local comercial' })
  await page.getByRole('button', { name: 'Designar punto' }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toEqual({ expected_version: 0, default_point_id: 101 })

  await page.getByLabel('Entidad fiscal').selectOption('2')
  await expect(
    page.getByText('Local del taller', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Local comercial', { exact: true })).toHaveCount(
    0,
  )
  await expect(
    page.getByText('Todavía no existe una configuración guardada.'),
  ).toBeVisible()

  await page.getByRole('tab', { name: 'Formas de pago SRI' }).click()
  const table = page.getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(9)
  await expect(table.getByText('No habilitable en V1')).toHaveCount(6)
})

test('en un teléfono las pestañas se desplazan sin mover la página', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await login(page, 'admin_e2e')
  await mockConfiguration(page)
  await page.goto('/configuration?tab=facturacion')
  await expect(
    page.getByRole('tab', { name: 'Facturación electrónica' }),
  ).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('el Vendedor no accede a la configuración aunque prepare datos fiscales', async ({
  page,
}) => {
  await login(page, 'vendedor_e2e')
  await page.goto('/configuration?tab=facturacion')
  await expect(
    page.getByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeVisible()
  await expect(page.getByText('Formas de pago SRI')).toHaveCount(0)
})
