import { expect, test, type Page } from '@playwright/test'

import {
  expectAdaptableAndAccessible,
  REPRESENTATIVE_WIDTHS,
} from './accessibility'
import { seedFiscalConfiguration } from './catalog-helpers'
import { login } from './helpers'
import { LOGO_PNG, LOGO_SVG, removeEntityLogo } from './logo-helpers'

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

const PROFILE_OPTIONS = {
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
  const profileWrites: unknown[] = []
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
      if (route.request().method() === 'PUT') {
        profileWrites.push(route.request().postDataJSON())
      }
      return route.fulfill({
        json: {
          entity_id: id,
          revision: id === 1 ? 1 : 0,
          conditions_format: 2,
          conditions: {},
          certificate: null,
          regime_legend: null,
          options: PROFILE_OPTIONS,
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
  return { defaultsWrites, profileWrites }
}

test('la configuración se recorre como una hoja con navegación de secciones', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await mockConfiguration(page)
  await page.goto('/configuration')

  const sections = page.getByRole('navigation', {
    name: 'Secciones de configuración',
  })
  await expect(sections.getByRole('link')).toHaveText([
    /Entidades fiscales/,
    /Bodega/,
    /Impuestos/,
    /Series y numeración/,
    /Facturación electrónica/,
  ])
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(
    sections.getByRole('link', { name: /Entidades fiscales/ }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(
    page
      .getByRole('article', { name: 'Entidad comercial' })
      .getByText('RUC 1790000000001'),
  ).toBeVisible()

  await sections.getByRole('link', { name: /Bodega/ }).focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/tab=impuestos/)
  await expect(
    page.getByRole('heading', { level: 2, name: 'Impuestos' }),
  ).toBeVisible()

  await page
    .getByRole('link', { name: '2 pendientes en Facturación electrónica' })
    .click()
  await expect(page).toHaveURL(/tab=facturacion&entidad=1&seccion=puntos/)
  await expect(
    sections.getByRole('link', { name: /Puntos de emisión/ }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('button', { name: 'Estado de la factura electrónica' }),
  ).toHaveAccessibleDescription(
    'Por ahora nada se envía al SRI: la factura electrónica todavía no está habilitada.',
  )
})

test('facturación electrónica designa el punto en un modal y separa las entidades', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  const { defaultsWrites } = await mockConfiguration(page)
  await page.goto('/configuration?tab=facturacion&seccion=puntos')

  const points = page.getByRole('region', {
    name: 'Establecimientos y puntos de emisión',
  })
  await expect(points.getByText('Local comercial')).toBeVisible()
  await points.getByRole('button', { name: 'Designar punto' }).click()
  const dialog = page.getByRole('dialog', { name: 'Punto predeterminado' })
  await dialog
    .getByLabel('Punto de emisión')
    .selectOption({ label: '001-002 · Local comercial' })
  await dialog.getByRole('button', { name: 'Guardar punto' }).click()
  await expect.poll(() => defaultsWrites.length).toBe(1)
  expect(defaultsWrites[0]).toEqual({
    expected_version: 0,
    default_point_id: 101,
  })

  await page
    .getByRole('group', { name: 'Entidad fiscal' })
    .getByText('Taller E2E', { exact: true })
    .click()
  await expect(page).toHaveURL(/entidad=2/)
  await expect(points.getByText('Local del taller')).toBeVisible()
  await expect(page.getByText('Local comercial')).toHaveCount(0)
  await expect(
    page.getByRole('radio', { name: /Taller E2E/ }).locator('..'),
  ).toContainText('Sin configurar')
  await page
    .getByRole('navigation', { name: 'Secciones de configuración' })
    .getByRole('link', { name: /Perfil tributario/ })
    .click()
  await page.getByRole('button', { name: '1 pendiente' }).click()
  await expect(page.getByRole('list', { name: 'Pendientes' })).toContainText(
    'Todavía no existe una configuración guardada.',
  )

  await page
    .getByRole('navigation', { name: 'Secciones de configuración' })
    .getByRole('link', { name: /Formas de pago/ })
    .click()
  const table = page
    .getByRole('region', { name: 'Formas de pago SRI' })
    .getByRole('table')
  await expect(table.getByRole('row')).toHaveCount(9)
  await expect(table.getByText('No habilitable en V1')).toHaveCount(6)
})

test('el perfil tributario se declara con opciones cerradas y la calificación con su vencimiento', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  const { profileWrites } = await mockConfiguration(page)
  await page.goto('/configuration?tab=facturacion&entidad=2')

  const profile = page.getByRole('region', { name: 'Perfil tributario' })
  await expect(profile.getByRole('row')).toHaveCount(7)
  await expect(profile.getByText('RIMPE', { exact: true })).toHaveCount(0)

  await profile
    .getByRole('button', { name: 'Declarar Régimen tributario' })
    .click()
  const regime = page.getByRole('dialog', {
    name: 'Declarar: Régimen tributario',
  })
  await regime.getByLabel('Régimen').selectOption('GENERAL')
  await regime.getByLabel('Fuente o documento').fill('Certificado de RUC')
  await regime.getByLabel('Vigente desde').fill('2026-01-01')
  await regime.getByRole('button', { name: 'Guardar condición' }).click()

  await expect.poll(() => profileWrites.length).toBe(1)
  expect(Object.keys(profileWrites[0]!.conditions)).toEqual([
    'tax_regime',
    'accounting_obligation',
    'withholding_agent',
    'special_taxpayer',
    'large_taxpayer',
    'artisan_qualification',
  ])
  expect(profileWrites[0]).toMatchObject({
    expected_revision: 0,
    conditions: {
      tax_regime: {
        status: 'APPLICABLE',
        value: 'GENERAL',
        source: 'Certificado de RUC',
        starts_on: '2026-01-01',
      },
      accounting_obligation: { status: 'UNKNOWN' },
    },
  })

  await profile
    .getByRole('button', { name: 'Declarar Calificación artesanal' })
    .click()
  const qualification = page.getByRole('dialog', {
    name: 'Declarar: Calificación artesanal',
  })
  await qualification.getByText('Aplica', { exact: true }).click()
  await qualification.getByLabel('Número de calificación').fill('JNDA-12345')
  await qualification
    .getByLabel('Organismo que la otorgó')
    .fill('Junta Nacional de Defensa del Artesano')
  await qualification.getByLabel('Fuente o documento').fill('Carné vigente')
  await qualification.getByLabel('Vigente desde').fill('2026-01-01')
  await qualification.getByLabel('Vence el').fill('2028-05-31')
  await qualification.getByRole('button', { name: 'Guardar condición' }).click()

  await expect.poll(() => profileWrites.length).toBe(2)
  expect(profileWrites[1]).toMatchObject({
    conditions: {
      artisan_qualification: {
        status: 'APPLICABLE',
        value: 'JNDA-12345',
        issuing_body: 'Junta Nacional de Defensa del Artesano',
        starts_on: '2026-01-01',
        ends_on: '2028-05-31',
      },
    },
  })
})

test('el Administrador ve el aviso de vencimiento de la calificación en el perfil', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await mockConfiguration(page)
  await page.route(
    '**/api/v1/fiscal/configuration/entities/2/electronic-status/',
    (route) =>
      route.fulfill({
        json: {
          entity_id: 2,
          state: 'READY',
          causes: [],
          warnings: [
            {
              code: 'artisan_qualification_expiring',
              kind: 'REVIEW',
              message:
                'Calificación artesanal: vence el 2026-11-10 (faltan 45 días). Renuévela antes de esa fecha.',
            },
          ],
          environment: 'TEST',
          profile_revision: 3,
          default_point_id: 200,
          default_payment_code: '01',
        },
      }),
  )
  await page.goto('/configuration?tab=facturacion&entidad=2')
  const notice = page.getByRole('button', { name: 'Calificación por vencer' })
  await notice.hover()
  await expect(page.getByRole('note')).toContainText('faltan 45 días')
})

test('en un teléfono las secciones se desplazan sin mover la página', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await login(page, 'admin_e2e')
  await mockConfiguration(page)
  await page.goto('/configuration?tab=facturacion')
  await expect(
    page
      .getByRole('navigation', { name: 'Secciones de configuración' })
      .getByRole('link', { name: /Facturación electrónica/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', {
      name: 'Subsecciones de facturación electrónica',
    }),
  ).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

for (const width of REPRESENTATIVE_WIDTHS) {
  test(`la configuración es adaptable y accesible a ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page, 'admin_e2e')
    await mockConfiguration(page)
    for (const search of [
      '',
      '?tab=series',
      '?tab=facturacion&seccion=puntos',
    ]) {
      await page.goto(`/configuration${search}`)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.getByText(/^Cargando|^Evaluando/)).toHaveCount(0)
      await expectAdaptableAndAccessible(page)
    }
  })
}

test('la hoja conserva su altura hasta el borde inferior al cambiar de sección', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, 'admin_e2e')
  await mockConfiguration(page)
  await page.goto('/configuration')
  const sheet = page
    .getByRole('navigation', { name: 'Secciones de configuración' })
    .locator('..')
  await expect(
    page.getByRole('heading', { level: 2, name: 'Entidades fiscales' }),
  ).toBeVisible()
  const first = await sheet.boundingBox()
  await page
    .getByRole('navigation', { name: 'Secciones de configuración' })
    .getByRole('link', { name: /Bodega/ })
    .click()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Bodega' }),
  ).toBeVisible()
  const second = await sheet.boundingBox()
  expect(second?.height).toBe(first?.height)
  expect((second?.y ?? 0) + (second?.height ?? 0)).toBeGreaterThanOrEqual(
    900 - 21,
  )
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

test('el Administrador sube, rechaza un SVG y quita el logo de una entidad', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await seedFiscalConfiguration(page)
  const commercial = await removeEntityLogo(page, 'COMERCIAL')
  await page.goto('/configuration')

  const card = page.getByRole('article', { name: 'Entidad comercial' })
  await expect(card.getByText('Sin logo')).toBeVisible()
  await card
    .getByRole('button', { name: 'Subir logo de la entidad comercial' })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Logo de la entidad comercial',
  })
  await dialog.getByLabel(/Imagen del logo/).setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: LOGO_PNG,
  })
  await expect(
    dialog.getByRole('img', { name: 'Vista previa del logo' }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Guardar logo' }).click()
  await expect(
    page.getByText('Logo de la entidad comercial actualizado.'),
  ).toBeVisible()
  await expect(
    card.getByRole('img', { name: `Logo de ${commercial.legal_name}` }),
  ).toBeVisible()

  await card
    .getByRole('button', { name: 'Cambiar logo de la entidad comercial' })
    .click()
  await dialog.getByLabel(/Imagen del logo/).setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: LOGO_SVG,
  })
  await dialog.getByRole('button', { name: 'Guardar logo' }).click()
  await expect(dialog.getByText(/PNG, JPEG o WebP/).first()).toBeVisible()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  const discard = page.getByRole('button', { name: /Descartar/ })
  if (await discard.isVisible()) await discard.click()
  await expect(
    card.getByRole('img', { name: `Logo de ${commercial.legal_name}` }),
  ).toBeVisible()

  await card
    .getByRole('button', { name: 'Quitar logo de la entidad comercial' })
    .click()
  await page
    .getByRole('dialog', { name: '¿Quitar el logo?' })
    .getByRole('button', { name: 'Quitar logo' })
    .click()
  await expect(
    page.getByText('Logo de la entidad comercial quitado.'),
  ).toBeVisible()
  await expect(card.getByText('Sin logo')).toBeVisible()
})
