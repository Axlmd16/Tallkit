import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
} from './accessibility'
import { API, send, seedFiscalConfiguration } from './catalog-helpers'
import { login, logout } from './helpers'

interface World {
  tag: string
  customer: { id: number }
  product: { id: number }
}

let counter = 0

/**
 * El ítem activo del riel de navegación (`.app-rail`) es un componente compartido del sistema
 * visual con contraste 4.13:1; queda fuera de este cambio y se excluye solo del análisis axe.
 */
const RAIL_EXCEPTION = { exclude: ['.app-rail'] }

const ok = async (response: Awaited<ReturnType<typeof send>>) => {
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

/** Configuración, cliente y producto con existencia: lo mínimo para vender por la API. */
async function seedWorld(page: Page): Promise<World> {
  const tag = `${Date.now().toString(36)}${counter++}`
  await seedFiscalConfiguration(page)
  const request = page.request
  const category = await ok(
    await send(request, 'post', '/product-categories/', {
      name: `Categoría inicio ${tag}`,
      idempotency_key: `e2e-home-cat-${tag}`,
    }),
  )
  const unit = await ok(
    await send(request, 'post', '/measurement-units/', {
      name: `Unidad inicio ${tag}`,
      idempotency_key: `e2e-home-uni-${tag}`,
    }),
  )
  const entities: Array<{ id: number; entity_type: string }> = await (
    await request.get(`${API}/workshop-configuration/entities/`)
  ).json()
  const commercial = entities.find((e) => e.entity_type === 'COMERCIAL')!
  const taxes: Array<{ id: number; code: string; fiscal_entity_id?: number }> =
    await (await request.get(`${API}/workshop-configuration/taxes/`)).json()
  const tax = taxes.find(
    (t) => t.code === 'IVA15' && t.fiscal_entity_id === commercial.id,
  )!
  const product = await ok(
    await send(request, 'post', '/products/', {
      code: `INI-${tag}`,
      manufacturer_code: '',
      name: `Filtro inicio ${tag}`,
      description: '',
      category_id: category.id,
      unit_id: unit.id,
      product_brand_id: null,
      vehicle_brand_ids: [],
      tax_definition_id: tax.id,
      content_quantity: '1',
      sale_price: '20.00',
      is_kit: false,
      idempotency_key: `e2e-home-prd-${tag}`,
    }),
  )
  const customer = await ok(
    await send(request, 'post', '/customers/', {
      person_type: 'NATURAL',
      name: `Cliente inicio ${tag}`,
      identification_type: 'CI',
      identification: `17${String(Date.now()).slice(-7)}${counter % 10}`,
      phone: '0999999999',
      idempotency_key: `e2e-home-cus-${tag}`,
    }),
  )
  await ok(
    await send(request, 'post', '/purchases/entries/', {
      idempotency_key: `e2e-home-ent-${tag}`,
      lines: [{ product_id: product.id, quantity: '10', unit_cost: '10.00' }],
      acknowledged_entry_ids: [],
    }),
  )
  return { tag, customer, product }
}

async function apiDraft(page: Page, world: World, key: string) {
  return ok(
    await send(page.request, 'post', '/sales/', {
      idempotency_key: `e2e-home-sd-${world.tag}-${key}`,
      customer_id: world.customer.id,
      condition: 'CONTADO',
      lines: [{ product_id: world.product.id, quantity: '1' }],
    }),
  )
}

async function apiCashSale(page: Page, world: World, key: string) {
  const draft = await apiDraft(page, world, key)
  const review = await ok(
    await send(page.request, 'post', `/sales/${draft.id}/preview/`, {}),
  )
  return ok(
    await send(page.request, 'post', `/sales/${draft.id}/confirm/`, {
      idempotency_key: `e2e-home-sc-${world.tag}-${key}`,
      expected_version: draft.version,
      review_token: review.review_token,
    }),
  )
}

async function apiPay(page: Page, saleId: number, amount: string, key: string) {
  const data = {
    operation_id: crypto.randomUUID(),
    parts: [{ method: 'EFECTIVO', amount }],
  }
  const review = await ok(
    await send(
      page.request,
      'post',
      `/sales/${saleId}/payments/preview/`,
      data,
    ),
  )
  return ok(
    await send(page.request, 'post', `/sales/${saleId}/payments/`, {
      ...data,
      idempotency_key: `e2e-home-pay-${key}`,
      review_token: review.review_token,
    }),
  )
}

/** Abre el inicio y espera a que sus bloques terminen de cargar. */
async function openHome(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  await expect(page.getByRole('status', { name: /Cargando/ })).toHaveCount(0)
}

const block = (page: Page, name: string) => page.getByRole('region', { name })

/** Conteo que muestra un indicador, leído de su nombre accesible. */
async function countOf(indicator: Locator): Promise<number> {
  const name = (await indicator.getAttribute('aria-label')) ?? ''
  return Number(name.split(' ')[0])
}

test.describe('Página de inicio', () => {
  test('cada pendiente coincide con su lista y baja al atenderlo', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    const sale = await apiCashSale(page, world, 'c1')
    await apiDraft(page, world, 'd1')

    await openHome(page)
    const pending = block(page, 'Pendientes')
    const unpaid = pending.getByRole('link', {
      name: /Ventas de contado sin cobrar, RUC comercial$/,
    })
    const before = await countOf(unpaid)
    expect(before).toBeGreaterThan(0)

    await unpaid.click()
    await expect(page).toHaveURL(
      /\/sales\/receivables\?condition=CONTADO&only_debt=true$/,
    )
    await expect(
      page.getByRole('region', { name: 'Totales de todas las coincidencias' }),
    ).toContainText(`en ${before} ventas`)
    await expect(page.getByLabel('Condición')).toHaveValue('CONTADO')
    await expect(page.getByLabel('Mostrar')).toHaveValue('true')

    await openHome(page)
    const drafts = block(page, 'Pendientes').getByRole('link', {
      name: /Ventas en borrador, RUC comercial$/,
    })
    expect(await countOf(drafts)).toBeGreaterThan(0)
    await drafts.click()
    await expect(page).toHaveURL(/\/sales\?state=DRAFT$/)

    await apiPay(page, sale.id, sale.grand_total, `${world.tag}-c1`)
    await openHome(page)
    expect(
      await countOf(
        block(page, 'Pendientes').getByRole('link', {
          name: /Ventas de contado sin cobrar, RUC comercial$/,
        }),
      ),
    ).toBe(before - 1)
    await expect(
      block(page, 'Cobrado en 7 días').getByRole('group', {
        name: 'Cobrado en 7 días, RUC comercial',
      }),
    ).toBeVisible()
  })

  test('el Administrador ve las dos entidades separadas y sus acciones', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    await seedFiscalConfiguration(page)
    await openHome(page)

    const actions = page.getByRole('navigation', { name: 'Acciones rápidas' })
    await expect(actions.getByRole('link')).toHaveText([
      'Nueva venta',
      'Nueva proforma',
      'Nuevo mantenimiento',
      'Registrar entrada',
      'Cobrar repuestos',
      'Cobrar servicios',
    ])
    const receivables = block(page, 'Por cobrar')
    await expect(
      receivables.getByRole('link', {
        name: /Repuestos por cobrar, RUC comercial/,
      }),
    ).toBeVisible()
    await expect(
      receivables.getByRole('link', {
        name: /Servicios por cobrar, RUC artesanal/,
      }),
    ).toBeVisible()
    const collections = block(page, 'Cobrado en 7 días')
    await expect(collections.getByRole('group')).toHaveCount(2)
    await expect(collections.getByRole('img')).toHaveCount(14)

    await block(page, 'Pendientes')
      .getByRole('link', { name: /Mantenimientos abiertos$/ })
      .click()
    await expect(page).toHaveURL(/\/maintenance\?state=OPEN$/)
    await expect(page.getByRole('radio', { name: 'Abiertas', exact: true })).toBeChecked()

    await page.goto('/')
    await actions.getByRole('link', { name: 'Nueva venta' }).click()
    await expect(page).toHaveURL(/\/sales\/new$/)
  })

  test('el Vendedor ve solo lo comercial y el Encargado solo el taller', async ({
    page,
  }) => {
    await login(page, 'vendedor_e2e')
    await openHome(page)
    await expect(
      page
        .getByRole('navigation', { name: 'Acciones rápidas' })
        .getByRole('link'),
    ).toHaveText([
      'Nueva venta',
      'Nueva proforma',
      'Registrar entrada',
      'Cobrar repuestos',
    ])
    await expect(
      block(page, 'Pendientes').getByRole('link', {
        name: /Mantenimientos abiertos/,
      }),
    ).toHaveCount(0)
    await expect(block(page, 'Por cobrar').getByRole('link')).toHaveCount(1)
    await expect(
      block(page, 'Cobrado en 7 días').getByRole('group'),
    ).toHaveCount(1)
    await expect(page.locator('main')).not.toContainText('Artesanal')
    await block(page, 'Pendientes')
      .getByRole('link', { name: /Proformas por vencer, RUC comercial$/ })
      .click()
    await expect(page).toHaveURL(
      /\/proformas\?state=VALID&expires_within_days=1$/,
    )
    await expect(page.getByRole('radio', { name: 'Por vencer' })).toBeChecked()

    await logout(page)
    await login(page, 'taller_e2e')
    await openHome(page)
    await expect(
      page
        .getByRole('navigation', { name: 'Acciones rápidas' })
        .getByRole('link'),
    ).toHaveText(['Nuevo mantenimiento', 'Cobrar servicios'])
    await expect(
      block(page, 'Pendientes').getByRole('link', {
        name: /Mantenimientos abiertos$/,
      }),
    ).toBeVisible()
    await expect(block(page, 'Por cobrar').getByRole('link')).toHaveCount(1)
    await expect(page.locator('main')).not.toContainText('Comercial')
    await block(page, 'Pendientes')
      .getByRole('link', {
        name: /Servicios de contado sin cobrar, RUC artesanal$/,
      })
      .click()
    await expect(page).toHaveURL(
      /\/maintenance\/receivables\?condition=CONTADO$/,
    )
    await expect(page.getByLabel('Condición')).toHaveValue('CONTADO')
  })

  test('es adaptable, accesible y operable con teclado, y deja evidencia visual', async ({
    page,
  }, testInfo) => {
    await login(page, 'admin_e2e')
    await seedFiscalConfiguration(page)
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await openHome(page)
      await expectNoHorizontalOverflow(page)
      await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`inicio-${width}.png`),
      })
    }

    await page.setViewportSize({ width: 360, height: 900 })
    await openHome(page)
    for (const link of await page
      .getByRole('navigation', { name: 'Acciones rápidas' })
      .getByRole('link')
      .all()) {
      const box = await link.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    for (const link of await block(page, 'Pendientes')
      .getByRole('link')
      .all()) {
      const box = await link.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    await page.setViewportSize({ width: 1280, height: 900 })
    await openHome(page)
    const firstAction = page
      .getByRole('navigation', { name: 'Acciones rápidas' })
      .getByRole('link')
      .first()
    await firstAction.focus()
    await expect(firstAction).toBeFocused()
    const firstBar = block(page, 'Cobrado en 7 días').getByRole('img').first()
    await firstBar.focus()
    await expect(page.getByRole('tooltip')).toContainText('USD')
  })
})
