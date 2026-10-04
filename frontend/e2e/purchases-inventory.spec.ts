import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { API, send, seedFiscalConfiguration } from './catalog-helpers'
import { login, logout } from './helpers'

interface World {
  tag: string
  supplier: { id: number; name: string }
  product: { id: number; code: string; name: string }
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
  return { tag, supplier, product }
}

/** Registra una entrada por la API (con la sesión actual) para preparar escenarios de lectura. */
async function apiEntry(
  page: Page,
  world: World,
  options: { quantity: string; key: string; cost?: string; reference?: string },
) {
  const response = await send(page.request, 'post', '/purchases/entries/', {
    idempotency_key: `e2e-ent-${world.tag}-${options.key}`,
    lines: [
      {
        product_id: world.product.id,
        quantity: options.quantity,
        ...(options.cost ? { unit_cost: options.cost } : {}),
      },
    ],
    ...(options.reference ? { reference: options.reference } : {}),
    acknowledged_entry_ids: await duplicateIds(page, world, options.quantity),
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

/** Reconoce las coincidencias del día: varios escenarios repiten contenido a propósito. */
async function duplicateIds(page: Page, world: World, quantity: string) {
  const review = await (
    await send(page.request, 'post', '/purchases/entries/review/', {
      lines: [{ product_id: world.product.id, quantity }],
    })
  ).json()
  return (review.duplicates ?? []).map(
    (d: { purchase_id: number }) => d.purchase_id,
  )
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

/** Elige una opción de un combobox; los resultados se muestran en un portal. */
async function pickOption(
  page: Page,
  scope: Page | Locator,
  label: string,
  text: string,
) {
  await scope.getByRole('combobox', { name: label }).fill(text)
  await page
    .getByRole('listbox', { name: `Resultados de ${label}` })
    .getByRole('option', { name: new RegExp(text) })
    .first()
    .click()
}

const searchBox = (page: Page) =>
  page.getByRole('combobox', { name: /buscar producto/i })

/** Agrega un producto tecleando su código y pulsando Enter, como lo haría un lector. */
async function addByCode(page: Page, code: string) {
  await searchBox(page).fill(code)
  await searchBox(page).press('Enter')
  await expect(page.getByLabel(`Cantidad de ${code}`)).toBeVisible()
}

/** Cambia de sesión: el mismo navegador pasa del Administrador al Vendedor. */
async function switchTo(page: Page, username: string) {
  await logout(page)
  await login(page, username)
}

test.describe('Entradas de stock, inventario y Kardex', () => {
  test('el Vendedor registra una entrada en un paso y el Administrador la ve en el Kardex', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await switchTo(page, 'vendedor_e2e')

    await page.goto('/purchases/new')
    await expect(searchBox(page)).toBeFocused()
    await addByCode(page, world.product.code)
    await page.getByLabel(`Cantidad de ${world.product.code}`).fill('4')
    await expect(page.getByText('1 producto · 4 unidades')).toBeVisible()
    // Lo opcional está plegado: no hay campos de costo ni de proveedor a la vista.
    await expect(page.getByLabel('Referencia')).toHaveCount(0)
    await expect(page.getByLabel(/Costo de/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Entran 1 producto · 4 unidades')
    await expect(dialog).toContainText(world.product.code)
    await expect(dialog).not.toContainText(/USD/)
    await dialog.getByRole('button', { name: 'Confirmar entrada' }).click()

    await expect(
      page.getByText(/Entrada COM-ING-\d{6} registrada\./),
    ).toBeVisible()
    await expect(searchBox(page)).toBeFocused()
    await expect(page.getByText('Nada por registrar')).toBeVisible()

    await page.getByRole('link', { name: 'Ver entrada' }).click()
    await expect(
      page.getByRole('heading', { name: /COM-ING-\d{6}/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('status', { name: 'Estado: Registrada' }),
    ).toBeVisible()
    await expect(page.getByText(/costo|USD/i)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Anular entrada' }),
    ).toHaveCount(0)

    await switchTo(page, 'admin_e2e')
    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    const period = page.getByLabel('Saldos del período')
    await expect(period).toContainText('1 movimientos · entradas 4 · salidas 0')
    await expect(page.getByText('Sin costo').first()).toBeVisible()
  })

  test('con detalles y costos el Administrador ve el costo y el Vendedor no', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await switchTo(page, 'vendedor_e2e')

    await page.goto('/purchases/new')
    await addByCode(page, world.product.code)
    await page.getByRole('button', { name: /más detalles/i }).click()
    await pickOption(page, page, 'Proveedor', world.supplier.name)
    await page.getByLabel('Referencia').fill(`F-${world.tag}`)
    await page.getByRole('checkbox', { name: 'Registrar costos' }).check()
    await page.getByLabel(`Costo de ${world.product.code}`).fill('4.5')
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(world.supplier.name)
    await expect(dialog).toContainText(`F-${world.tag}`)
    await expect(dialog).not.toContainText('4.5')
    await dialog.getByRole('button', { name: 'Confirmar entrada' }).click()
    await page.getByRole('link', { name: 'Ver entrada' }).click()
    const entryUrl = page.url()
    await expect(page.getByText(`F-${world.tag}`)).toBeVisible()
    await expect(page.getByText('4.50')).toHaveCount(0)

    await switchTo(page, 'admin_e2e')
    await page.goto(entryUrl)
    await expect(page.getByLabel('Línea 1')).toContainText('USD 4.50')
    await page.goto('/inventory')
    await page
      .getByLabel('Código, código de fabricante o nombre')
      .fill(world.product.code)
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByLabel('Valor del inventario')).toContainText('USD')
  })

  test('una entrada igual de hoy exige reconocerla antes de confirmar', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await switchTo(page, 'vendedor_e2e')
    await page.goto('/purchases/new')
    const registered = page.getByText(/Entrada COM-ING-\d{6} registrada\./)
    const numberOf = (text: string | null) =>
      text?.match(/COM-ING-\d{6}/)?.[0] ?? ''

    await addByCode(page, world.product.code)
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirmar entrada' })
      .click()
    await expect(registered).toBeVisible()
    const first = numberOf(await registered.first().textContent())

    await addByCode(page, world.product.code)
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Parece una entrada repetida')
    await expect(dialog).toContainText(first)
    const confirm = dialog.getByRole('button', { name: 'Confirmar entrada' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('checkbox', { name: /otra entrada/i }).check()
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(registered).toHaveCount(2)
    const second = numberOf(await registered.last().textContent())
    expect(second).not.toBe(first)
  })

  test('doble envío y tiempo agotado no duplican efectos y reutilizan la clave', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await switchTo(page, 'vendedor_e2e')
    await page.goto('/purchases/new')
    await addByCode(page, world.product.code)
    await page.getByLabel(`Cantidad de ${world.product.code}`).fill('3')
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const keys: string[] = []
    let first = true
    await page.route('**/api/v1/purchases/entries/', async (route) => {
      keys.push(JSON.parse(route.request().postData() ?? '{}').idempotency_key)
      if (first) {
        first = false
        await route.abort('timedout') // el servidor pudo aplicar la operación o no
        return
      }
      await route.continue()
    })
    await dialog.getByRole('button', { name: 'Confirmar entrada' }).click()
    await expect(
      page.getByText(/no sabemos si el cambio se aplicó/i),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirmar entrada' })
      .click()
    await expect(
      page.getByText(/Entrada COM-ING-\d{6} registrada\./),
    ).toBeVisible()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])

    await switchTo(page, 'admin_e2e')
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
    const entry = await apiEntry(page, world, {
      quantity: '5',
      key: 'b',
      cost: '2.00',
    })
    await apiAdjust(page, world, 'ADJUSTMENT_OUT', '1', 'a')

    await page.goto('/inventory')
    await page.getByRole('button', { name: /carga inicial o ajuste/i }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByLabel('Tipo de operación').selectOption('ADJUSTMENT_OUT')
    await pickOption(page, drawer, 'Producto', world.product.code)
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

    await page.goto(`/purchases/${entry.id}`)
    await page.getByRole('button', { name: 'Anular entrada' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(world.product.code)
    await expect(dialog).toContainText(/movimientos posteriores/)
    await expect(dialog.getByRole('link', { name: /INV-\d+/ })).toBeVisible()
    await dialog.getByLabel('Motivo de la anulación').fill('Error')
    await expect(
      dialog.getByRole('button', { name: 'Anular entrada' }),
    ).toBeDisabled()
  })

  test('el Administrador anula una entrada del Vendedor y su efecto se compensa', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    await switchTo(page, 'vendedor_e2e')
    const entry = await apiEntry(page, world, { quantity: '2', key: 'v' })
    await switchTo(page, 'admin_e2e')
    await page.goto(`/purchases/${entry.id}`)
    await page.getByRole('button', { name: 'Anular entrada' }).click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Motivo de la anulación')
      .fill('Registrada por error')
    await dialog.getByRole('button', { name: 'Anular entrada' }).click()
    await expect(page.getByText(/anulada y su efecto compensado/)).toBeVisible()
    await expect(page.getByText('Entrada anulada')).toBeVisible()
    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    await expect(page.getByLabel('Saldos del período')).toContainText(
      '2 movimientos · entradas 2 · salidas 2',
    )
  })

  test('filtros conservados al volver del detalle y corte estable al paginar el Kardex', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    const entry = await apiEntry(page, world, {
      quantity: '30',
      key: 'k',
      cost: '1.00',
    })
    for (let i = 0; i < 21; i += 1) {
      await apiAdjust(page, world, 'ADJUSTMENT_OUT', '1', `k${i}`)
    }

    await page.goto('/purchases?state=CONFIRMED')
    await page.getByText(entry.internal_number).first().click()
    await expect(page).toHaveURL(new RegExp(`/purchases/${entry.id}$`))
    await page.getByRole('link', { name: 'Volver a entradas' }).click()
    await expect(page).toHaveURL(/state=CONFIRMED/)
    await expect(
      page.getByRole('radio', { name: 'Registradas' }),
    ).toHaveAttribute('aria-checked', 'true')

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
    await apiEntry(page, world, { quantity: '2', key: 'a' })

    for (const path of ['/purchases', '/purchases/new', '/inventory']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      await expectNoSeriousAccessibilityViolations(page)
    }
    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    await expect(page.getByLabel('Saldos del período')).toBeVisible()
    await expectNoSeriousAccessibilityViolations(page)

    // Con teclado: buscar, revisar y cerrar con Escape devuelve el foco al buscador.
    await page.goto('/purchases/new')
    await expect(searchBox(page)).toBeFocused()
    await searchBox(page).fill(world.product.code)
    await page.keyboard.press('Enter')
    await expect(
      page.getByLabel(`Cantidad de ${world.product.code}`),
    ).toBeVisible()
    const trigger = page.getByRole('button', { name: 'Revisar y confirmar' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoSeriousAccessibilityViolations(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(searchBox(page)).toBeFocused()
  })

  test('evidencia visual a 360, 768, 1024, 1279, 1280 y 1440', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await login(page, 'admin_e2e')
    const world = await seedWorld(page)
    const entry = await apiEntry(page, world, {
      quantity: '4',
      key: 'vv',
      cost: '2.00',
    })
    const views: Array<[string, string]> = [
      ['entradas-lista', '/purchases'],
      ['entrada-nueva', '/purchases/new'],
      ['entrada-detalle', `/purchases/${entry.id}`],
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
