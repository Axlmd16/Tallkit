import { expect, test, type Page } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { API, csrf, send, seedFiscalConfiguration } from './catalog-helpers'
import { login } from './helpers'

interface World {
  tag: string
  supplier: { id: number; name: string }
  product: { id: number; code: string; name: string }
  tax: { id: number }
}

let counter = 0

/** Deja configuración, proveedor y producto nuevos y devuelve sus identidades. */
async function seedWorld(page: Page): Promise<World> {
  const tag = `${Date.now().toString(36)}${counter++}`
  await seedFiscalConfiguration(page)
  const request = page.request
  const json = async (response: Awaited<ReturnType<typeof send>>) => {
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  const category = await json(
    await send(request, 'post', '/product-categories/', {
      name: `Categoría ${tag}`,
      idempotency_key: `e2e-cat-${tag}`,
    }),
  )
  const unit = await json(
    await send(request, 'post', '/measurement-units/', {
      name: `Unidad ${tag}`,
      idempotency_key: `e2e-uni-${tag}`,
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
  const supplier = await json(
    await send(request, 'post', '/suppliers/', {
      name: `Proveedor ${tag}`,
      idempotency_key: `e2e-sup-${tag}`,
    }),
  )
  const product = await json(
    await send(request, 'post', '/products/', {
      code: `E2E-${tag}`,
      manufacturer_code: '',
      name: `Aceite ${tag}`,
      description: '',
      category_id: category.id,
      unit_id: unit.id,
      product_brand_id: null,
      vehicle_brand_ids: [],
      tax_definition_id: tax.id,
      content_quantity: '1',
      sale_price: '30.00',
      is_kit: false,
      idempotency_key: `e2e-prd-${tag}`,
    }),
  )
  await page.reload()
  return { tag, supplier, product, tax }
}

/** Crea y confirma un ingreso por la API para preparar escenarios de lectura. */
async function apiConfirmedPurchase(
  page: Page,
  world: World,
  options: { quantity: string; reference: string },
) {
  const request = page.request
  const created = await (
    await send(request, 'post', '/purchases/', {
      idempotency_key: `e2e-pur-${world.tag}-${options.reference}`,
      supplier_id: world.supplier.id,
      document_type: 'FACTURA',
      supplier_reference: options.reference,
      document_date: '2026-09-01',
      notes: '',
      lines: [
        {
          product_id: world.product.id,
          quantity: options.quantity,
          unit_cost: '10.00',
          tax_definition_id: world.tax.id,
          tax_recoverability: 'RECOVERABLE',
        },
      ],
    })
  ).json()
  const review = await (
    await send(request, 'post', `/purchases/${created.id}/preview/`, {})
  ).json()
  const confirmed = await send(
    request,
    'post',
    `/purchases/${created.id}/confirm/`,
    {
      idempotency_key: `e2e-conf-${world.tag}-${options.reference}`,
      expected_version: created.version,
      review_token: review.review_token,
    },
  )
  expect(confirmed.ok(), await confirmed.text()).toBeTruthy()
  return confirmed.json()
}

async function apiAdjust(
  page: Page,
  world: World,
  kind: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
  quantity: string,
  key: string,
) {
  const request = page.request
  const op = await (
    await send(request, 'post', '/inventory/operations/', {
      idempotency_key: `e2e-op-${world.tag}-${key}`,
      kind,
      product_id: world.product.id,
      quantity,
      ...(kind === 'ADJUSTMENT_IN' ? { unit_cost: '1.00' } : {}),
      reason: 'Ajuste de prueba',
    })
  ).json()
  const review = await (
    await send(request, 'post', `/inventory/operations/${op.id}/preview/`, {})
  ).json()
  const done = await send(
    request,
    'post',
    `/inventory/operations/${op.id}/confirm/`,
    {
      idempotency_key: `e2e-opc-${world.tag}-${key}`,
      expected_version: op.version,
      review_token: review.review_token,
    },
  )
  expect(done.ok(), await done.text()).toBeTruthy()
}

async function chooseSupplier(page: Page, name: string) {
  await page.getByPlaceholder('Buscar…').first().fill(name)
  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Elegir' })
    .click()
}

async function fillFirstLine(page: Page, world: World, quantity: string) {
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  const line = page.getByRole('group', { name: /Línea 1/ })
  await line.getByPlaceholder('Buscar…').fill(world.product.code)
  await line
    .getByRole('listitem')
    .filter({ hasText: world.product.code })
    .getByRole('button', { name: 'Elegir' })
    .click()
  await line.getByLabel('Cantidad de presentaciones').fill(quantity)
  await line.getByLabel('Costo unitario').fill('10.00')
  await line
    .getByLabel('Recuperabilidad del impuesto')
    .selectOption('RECOVERABLE')
  return line
}

test.describe('Ingresos, inventario y Kardex', () => {
  test('flujo completo: borrador, revisión de importes, confirmación y Kardex', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await page.goto('/purchases/new')
    await chooseSupplier(page, world.supplier.name)
    await page.getByLabel('Referencia del proveedor').fill(`F-${world.tag}`)
    await page.getByLabel('Fecha del documento').fill('2026-09-01')
    const line = await fillFirstLine(page, world, '2')
    await expect(line.getByLabel('Impuesto', { exact: true })).toHaveValue(
      String(world.tax.id),
    )
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/purchases\/\d+\/edit$/)
    await expect(page.getByLabel('Totales')).toContainText('USD 23.00')

    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(world.product.code)
    await expect(dialog).toContainText(
      'recibirá 2 presentaciones; pasa de 0 a 2',
    )
    await expect(
      dialog.getByLabel('Totales calculados por el sistema'),
    ).toContainText('USD 23.00')
    await dialog.getByRole('button', { name: 'Confirmar ingreso' }).click()
    await expect(
      page.getByRole('heading', { name: /COM-ING-\d{6}/ }),
    ).toBeVisible()
    await expect(page.getByText('Confirmado')).toBeVisible()

    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    const period = page.getByLabel('Saldos del período')
    await expect(period).toContainText('Saldo final')
    await expect(page.getByRole('table').first()).toContainText('2')
    await expect(period).toContainText('1 movimientos · entradas 2 · salidas 0')
    await page.goto('/inventory')
    await page
      .getByLabel('Código, código de fabricante o nombre')
      .fill(world.product.code)
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByRole('table').first()).toContainText(
      world.product.code,
    )
  })

  test('doble envío y tiempo agotado no duplican efectos y reutilizan la clave', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await page.goto('/purchases/new')
    await chooseSupplier(page, world.supplier.name)
    await page.getByLabel('Referencia del proveedor').fill(`T-${world.tag}`)
    await page.getByLabel('Fecha del documento').fill('2026-09-01')
    await fillFirstLine(page, world, '3')
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/purchases\/\d+\/edit$/)
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const keys: string[] = []
    let first = true
    await page.route('**/api/v1/purchases/*/confirm/', async (route) => {
      keys.push(JSON.parse(route.request().postData() ?? '{}').idempotency_key)
      if (first) {
        first = false
        await route.abort('timedout') // el servidor pudo aplicar la operación o no
        return
      }
      await route.continue()
    })
    await dialog.getByRole('button', { name: 'Confirmar ingreso' }).click()
    await expect(
      page.getByText(/no sabemos si el cambio se aplicó/i),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirmar ingreso' }).click()
    await expect(
      page.getByRole('heading', { name: /COM-ING-\d{6}/ }),
    ).toBeVisible()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])

    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    await expect(page.getByLabel('Saldos del período')).toContainText(
      '1 movimientos · entradas 3',
    )
  })

  test('stock insuficiente y anulación bloqueada por movimientos posteriores', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    const purchase = await apiConfirmedPurchase(page, world, {
      quantity: '5',
      reference: `B-${world.tag}`,
    })
    await apiAdjust(page, world, 'ADJUSTMENT_OUT', '1', 'a')

    await page.goto('/inventory')
    await page.getByRole('button', { name: /carga inicial o ajuste/i }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByLabel('Tipo de operación').selectOption('ADJUSTMENT_OUT')
    await drawer.getByPlaceholder('Buscar…').fill(world.product.code)
    await drawer
      .getByRole('listitem')
      .filter({ hasText: world.product.code })
      .getByRole('button', { name: 'Elegir' })
      .click()
    await drawer.getByLabel('Cantidad de presentaciones').fill('50')
    await drawer.getByLabel('Motivo').fill('Salida excesiva de prueba')
    await drawer.getByRole('button', { name: 'Preparar y revisar' }).click()
    await expect(drawer.getByLabel('Revisión del efecto')).toContainText(
      'La existencia es insuficiente',
    )
    await expect(
      drawer.getByRole('button', { name: 'Confirmar operación' }),
    ).toBeDisabled()
    await drawer
      .getByRole('button', { name: 'Abandonar sin confirmar' })
      .click()

    await page.goto(`/purchases/${purchase.id}`)
    await page.getByRole('button', { name: 'Anular ingreso' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(world.product.code)
    await expect(dialog).toContainText(/movimientos posteriores/)
    await expect(dialog.getByRole('link', { name: /INV-\d+/ })).toBeVisible()
    await dialog.getByLabel('Motivo de la anulación').fill('Error')
    await expect(
      dialog.getByRole('button', { name: 'Anular ingreso' }),
    ).toBeDisabled()
  })

  test('filtros conservados al volver del detalle y corte estable al paginar el Kardex', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    const purchase = await apiConfirmedPurchase(page, world, {
      quantity: '30',
      reference: `K-${world.tag}`,
    })
    for (let i = 0; i < 21; i += 1) {
      await apiAdjust(page, world, 'ADJUSTMENT_OUT', '1', `k${i}`)
    }

    await page.goto('/purchases?state=CONFIRMED')
    await page.getByText(purchase.internal_number).first().click()
    await expect(page).toHaveURL(new RegExp(`/purchases/${purchase.id}$`))
    await page.getByRole('button', { name: 'Volver a la lista' }).click()
    await expect(page).toHaveURL(/state=CONFIRMED/)
    await expect(page.locator('#purchase-state')).toHaveValue('CONFIRMED')

    const cuts: Array<string | null> = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname.endsWith('/kardex/'))
        cuts.push(url.searchParams.get('cut_token'))
    })
    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    await expect(page.getByLabel('Saldos del período')).toBeVisible()
    await page
      .getByRole('button', { name: /siguiente|página siguiente/i })
      .first()
      .click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByLabel('Saldos del período')).toBeVisible()
    const withCut = cuts.filter(Boolean)
    expect(withCut.length).toBeGreaterThan(0)
    expect(new Set(withCut).size).toBe(1) // la página dos usa el mismo corte
    expect(cuts[0]).toBeNull() // la primera lectura solicita un corte nuevo
  })

  test('foco, teclado, movimiento reducido y accesibilidad sin violaciones graves', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await apiConfirmedPurchase(page, world, {
      quantity: '2',
      reference: `A-${world.tag}`,
    })

    for (const path of ['/purchases', '/purchases/new', '/inventory']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      await expectNoSeriousAccessibilityViolations(page)
    }
    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    await expect(page.getByLabel('Saldos del período')).toBeVisible()
    await expectNoSeriousAccessibilityViolations(page)

    // El diálogo devuelve el foco al disparador al cerrarse con Escape.
    await page.goto('/purchases/new')
    await chooseSupplier(page, world.supplier.name)
    await page.getByLabel('Referencia del proveedor').fill(`AC-${world.tag}`)
    await page.getByLabel('Fecha del documento').fill('2026-09-01')
    await fillFirstLine(page, world, '1')
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/purchases\/\d+\/edit$/)
    const trigger = page.getByRole('button', { name: 'Revisar y confirmar' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoSeriousAccessibilityViolations(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('evidencia visual a 360, 768, 1024, 1279, 1280 y 1440', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    const purchase = await apiConfirmedPurchase(page, world, {
      quantity: '4',
      reference: `V-${world.tag}`,
    })
    const views: Array<[string, string]> = [
      ['compras-lista', '/purchases'],
      ['compra-detalle', `/purchases/${purchase.id}`],
      ['inventario', '/inventory'],
      ['kardex', `/inventory/products/${world.product.id}/kardex`],
    ]
    for (const width of [360, 768, 1024, 1279, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const [name, path] of views) {
        await page.goto(path)
        await expect(page.locator('h1')).toBeVisible()
        await expect(page.getByText(/^Cargando/)).toHaveCount(0)
        await page.waitForLoadState('networkidle')
        const overflowing = await page.evaluate(() => {
          if (document.documentElement.scrollWidth <= window.innerWidth)
            return []
          return Array.from(document.querySelectorAll('body *'))
            .filter(
              (el) => el.getBoundingClientRect().right > window.innerWidth + 1,
            )
            .slice(0, 6)
            .map(
              (el) =>
                `${el.tagName}.${String((el as HTMLElement).className).slice(0, 50)}`,
            )
        })
        expect.soft(overflowing, `${name} desborda a ${width}px`).toEqual([])
        await page.screenshot({
          path: `test-results/purchases-inventory/${name}-${width}.png`,
          fullPage: true,
        })
      }
    }
  })
})

// La cookie CSRF puede rotar entre llamadas directas; se reutiliza el helper compartido.
void csrf
