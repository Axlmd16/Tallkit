import { expect, test, type Page } from '@playwright/test'

import {
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
} from './accessibility'
import { API, send, seedFiscalConfiguration } from './catalog-helpers'
import { login } from './helpers'
import { removeEntityLogo, uploadEntityLogo } from './logo-helpers'

interface World {
  tag: string
  customer: { id: number; name: string }
  product: { id: number; code: string; name: string }
  catalog: { categoryId: number; unitId: number; taxId: number }
}

let counter = 0

/** Mismo criterio que ventas: el riel compartido queda fuera del análisis axe de este cambio. */
const RAIL_EXCEPTION = { exclude: ['.app-rail'] }
/** La evidencia visual se guarda fuera del repositorio (carpeta ignorada o la indicada). */
const EVIDENCE =
  process.env.PROFORMA_EVIDENCE_DIR ?? 'test-results/proformas-evidence'

const ok = async (response: Awaited<ReturnType<typeof send>>) => {
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

/** Configuración, cliente, producto (precio final 20.00) y existencia inicial por la API. */
async function seedWorld(page: Page, stock: number): Promise<World> {
  const tag = `${Date.now().toString(36)}${counter++}`
  await seedFiscalConfiguration(page)
  const request = page.request
  const category = await ok(
    await send(request, 'post', '/product-categories/', {
      name: `Categoría ${tag}`,
      idempotency_key: `e2e-cat-${tag}`,
    }),
  )
  const unit = await ok(
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
  const product = await ok(
    await send(request, 'post', '/products/', {
      code: `PRO-${tag}`,
      manufacturer_code: '',
      name: `Pastilla ${tag}`,
      description: '',
      category_id: category.id,
      unit_id: unit.id,
      product_brand_id: null,
      vehicle_brand_ids: [],
      tax_definition_id: tax.id,
      content_quantity: '1',
      sale_price: '20.00',
      is_kit: false,
      idempotency_key: `e2e-prd-${tag}`,
    }),
  )
  const customer = await ok(
    await send(request, 'post', '/customers/', {
      person_type: 'NATURAL',
      name: `Cliente ${tag}`,
      identification_type: 'CI',
      identification: `17${String(Date.now()).slice(-7)}${counter % 10}`,
      phone: '0999999999',
      idempotency_key: `e2e-cus-${tag}`,
    }),
  )
  if (stock > 0) {
    const lines = [{ product_id: product.id, quantity: String(stock) }]
    const review = await (
      await send(request, 'post', '/purchases/entries/review/', { lines })
    ).json()
    await ok(
      await send(request, 'post', '/purchases/entries/', {
        idempotency_key: `e2e-ent-${tag}`,
        lines: lines.map((line) => ({ ...line, unit_cost: '10.00' })),
        acknowledged_entry_ids: (review.duplicates ?? []).map(
          (d: { purchase_id: number }) => d.purchase_id,
        ),
      }),
    )
  }
  await page.reload()
  return {
    tag,
    customer,
    product,
    catalog: { categoryId: category.id, unitId: unit.id, taxId: tax.id },
  }
}

/** Disponibilidad informativa vigente según el selector de proformas. */
async function available(page: Page, world: World): Promise<string> {
  const options = await (
    await page.request.get(
      `${API}/proformas/product-options/?search=${world.product.code}`,
    )
  ).json()
  return options.results[0].available
}

/** Crea y emite una proforma por la API; `lines` repite el producto para forzar varias páginas. */
async function apiIssued(page: Page, world: World, quantity = 2, lines = 1) {
  const request = page.request
  const draft = await ok(
    await send(request, 'post', '/proformas/', {
      idempotency_key: `e2e-pd-${world.tag}-${counter++}`,
      customer_id: world.customer.id,
      lines: Array.from({ length: lines }, () => ({
        product_id: world.product.id,
        quantity: String(quantity),
      })),
    }),
  )
  const review = await (
    await request.get(`${API}/proformas/${draft.id}/issue-preview/`)
  ).json()
  expect(review.can_issue, JSON.stringify(review.issues)).toBe(true)
  return ok(
    await send(request, 'post', `/proformas/${draft.id}/issue/`, {
      idempotency_key: `e2e-pi-${world.tag}-${counter++}`,
      expected_version: review.version,
      review_token: review.review_token,
    }),
  )
}

async function pick(page: Page, combobox: string, text: string) {
  await page.getByRole('combobox', { name: combobox }).fill(text)
  await page
    .getByRole('listbox', { name: `Resultados de ${combobox}` })
    .getByRole('option', { name: new RegExp(text) })
    .first()
    .click()
}

test.describe('Proformas comerciales', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin_e2e')
  })

  test('crear, revisar, emitir, imprimir, convertir, ajustar líneas y confirmar', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const world = await seedWorld(page, 10)

    // Crear el borrador: precio y total vienen del servidor.
    await page.goto('/proformas/new')
    await pick(page, 'Cliente', world.customer.name)
    await pick(page, 'Producto de la línea 1', world.product.code)
    const quantity = page.getByLabel('Cantidad de la línea 1')
    await quantity.fill('2')
    const table = page.getByRole('table')
    await expect(table.getByText('USD 20.00')).toBeVisible()
    await expect(table.getByText('USD 40.00')).toBeVisible()
    await expect(page.getByText('Cambios sin guardar')).toBeVisible()
    await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/proformas\/\d+\/edit$/)
    await expect(page.getByText('Cambios sin guardar')).toBeHidden()

    // Revisar y emitir.
    await page.getByRole('button', { name: 'Revisar y emitir' }).click()
    const review = page.getByRole('dialog', {
      name: 'Revisar y emitir proforma',
    })
    await expect(review.getByText('USD 40.00')).toBeVisible()
    await review.getByRole('button', { name: 'Emitir proforma' }).click()
    await expect(page).toHaveURL(/\/proformas\/\d+$/)
    const heading = page.getByRole('heading', { name: /COM-PRO-\d{6}/ })
    await expect(heading).toContainText('Vigente')
    const number = (await heading.textContent())!.match(/COM-PRO-\d{6}/)![0]
    const proformaId = Number(page.url().match(/proformas\/(\d+)/)![1])
    expect(await available(page, world)).toBe('10')
    await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)

    // Imprimir: datos históricos, sin efectos.
    await page.getByRole('button', { name: 'Imprimir' }).click()
    const sheet = page.getByRole('article', { name: 'Proforma' })
    await expect(
      sheet.getByRole('heading', { name: `PROFORMA N.º ${number}` }),
    ).toBeVisible()
    await expect(
      sheet.getByRole('group', { name: 'Datos del emisor' }),
    ).toContainText('RUC:')
    await expect(
      sheet.getByRole('columnheader', { name: 'Cód. fabricante' }),
    ).toBeVisible()
    await expect(
      sheet.getByRole('columnheader', { name: 'Marca' }),
    ).toBeVisible()
    await expect(sheet).not.toContainText(
      /Disponible|Generado con Tallkit|SRI|Vigente\b/,
    )
    await expect(
      page.getByRole('button', { name: 'Imprimir o guardar PDF' }),
    ).toBeEnabled()
    await page.getByRole('link', { name: 'Volver a la proforma' }).click()

    // Convertir: una única venta en borrador, sin número ni movimiento de stock.
    await page.getByRole('button', { name: 'Convertir en venta' }).click()
    const convert = page.getByRole('dialog', { name: 'Convertir en venta' })
    await expect(convert.getByText('Sin cambios')).toBeVisible()
    await convert.getByRole('button', { name: 'Convertir en venta' }).click()
    await expect(page).toHaveURL(/\/sales\/\d+$/)
    const saleId = Number(page.url().match(/sales\/(\d+)/)![1])
    const origin = page.getByRole('region', { name: 'Origen proforma' })
    await expect(origin.getByRole('link', { name: number })).toBeVisible()
    expect(await available(page, world)).toBe('10')

    // Ajustar líneas en la venta: la oferta no cambia.
    await page.goto(`/sales/${saleId}/edit`)
    await expect(page.getByText(/Originada en la proforma/)).toBeVisible()
    await page.getByLabel('Cantidad de la línea 1').fill('1')
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByText('Cambios sin guardar')).toBeHidden()
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const confirm = page.getByRole('dialog', {
      name: 'Revisar y confirmar venta',
    })
    await expect(
      confirm.getByRole('region', { name: 'Diferencias con la proforma' }),
    ).toContainText('Cambió cantidad')
    await confirm.getByRole('button', { name: 'Confirmar venta' }).click()
    await expect(page).toHaveURL(new RegExp(`/sales/${saleId}$`))
    await expect(
      page.getByRole('heading', { name: /COM-VEN-\d{6}/ }),
    ).toBeVisible()
    expect(await available(page, world)).toBe('9')

    // Vínculos, números y estados coherentes; una sola venta.
    const proforma = await (
      await page.request.get(`${API}/proformas/${proformaId}/`)
    ).json()
    expect(proforma.state).toBe('CONVERTED')
    expect(proforma.internal_number).toBe(number)
    expect(proforma.sale.id).toBe(saleId)
    expect(proforma.lines[0].quantity).toBe('2')
    expect(proforma.grand_total).toBe('40.00')
    const sales = await (
      await page.request.get(
        `${API}/sales/?origin=PROFORMA&customer_id=${world.customer.id}`,
      )
    ).json()
    expect(sales.count).toBe(1)
    expect(sales.results[0].origin.proforma_number).toBe(number)
    await page.goto(`/proformas/${proformaId}`)
    await expect(
      page.getByRole('heading', { name: new RegExp(number) }),
    ).toContainText('Convertida')
    await expect(
      page.getByRole('button', { name: 'Convertir en venta' }),
    ).toHaveCount(0)
    await page.getByRole('tab', { name: /Relacionadas/ }).click()
    await expect(
      page.getByRole('link', { name: /COM-VEN-\d{6}/ }),
    ).toBeVisible()
  })

  test('una respuesta perdida al emitir se recupera sin otro número', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page, 5)
    const draft = await ok(
      await send(page.request, 'post', '/proformas/', {
        idempotency_key: `e2e-lost-${world.tag}`,
        customer_id: world.customer.id,
        lines: [{ product_id: world.product.id, quantity: '1' }],
      }),
    )
    let lost = 0
    const keys: string[] = []
    await page.route('**/proformas/*/issue/', async (route) => {
      keys.push(route.request().postDataJSON().idempotency_key)
      if (lost++ === 0) {
        // El servidor emite, pero la respuesta nunca llega al navegador.
        await route.fetch()
        await route.abort('connectionreset')
        return
      }
      await route.continue()
    })
    await page.goto(`/proformas/${draft.id}`)
    await page.getByRole('button', { name: 'Revisar y emitir' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Revisar y emitir proforma',
    })
    await dialog.getByRole('button', { name: 'Emitir proforma' }).click()
    await expect(
      dialog.getByText('No sabemos si la proforma se emitió'),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Reintentar emisión' }).click()
    const heading = page.getByRole('heading', { name: /COM-PRO-\d{6}/ })
    await expect(heading).toContainText('Vigente')
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
    const number = (await heading.textContent())!.match(/COM-PRO-\d{6}/)![0]
    const listed = await (
      await page.request.get(`${API}/proformas/?search=${number}`)
    ).json()
    expect(listed.count).toBe(1)
    const mine = await (
      await page.request.get(
        `${API}/proformas/?customer_id=${world.customer.id}`,
      )
    ).json()
    expect(mine.count).toBe(1)
  })

  test('cotizar y convertir sin stock suficiente avisa y la venta no se confirma', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page, 1)
    await page.goto('/proformas/new')
    await pick(page, 'Cliente', world.customer.name)
    await pick(page, 'Producto de la línea 1', world.product.code)
    await page.getByLabel('Cantidad de la línea 1').fill('3')
    await expect(
      page.getByLabel('Disponibilidad insuficiente').first(),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/proformas\/\d+\/edit$/)
    await page.getByRole('button', { name: 'Revisar y emitir' }).click()
    const review = page.getByRole('dialog', {
      name: 'Revisar y emitir proforma',
    })
    await expect(
      review.getByRole('list', { name: 'Avisos de disponibilidad' }),
    ).toContainText('hay 1 y se cotizan 3')
    await review.getByRole('button', { name: 'Emitir proforma' }).click()
    await expect(
      page.getByRole('heading', { name: /COM-PRO-\d{6}/ }),
    ).toContainText('Vigente')
    await page.getByRole('button', { name: 'Convertir en venta' }).click()
    const convert = page.getByRole('dialog', { name: 'Convertir en venta' })
    await expect(
      convert.getByRole('list', { name: 'Avisos de disponibilidad' }),
    ).toContainText('La venta no podrá confirmarse así')
    await convert.getByRole('button', { name: 'Convertir en venta' }).click()
    await expect(page).toHaveURL(/\/sales\/\d+$/)
    const saleId = Number(page.url().match(/sales\/(\d+)/)![1])
    await page.goto(`/sales/${saleId}/edit`)
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const confirm = page.getByRole('dialog', {
      name: 'Revisar y confirmar venta',
    })
    await expect(confirm.getByText(/Existencia insuficiente/)).toBeVisible()
    await expect(
      confirm.getByRole('button', { name: 'Confirmar venta' }),
    ).toBeDisabled()
    expect(await available(page, world)).toBe('1')
    const sale = await (
      await page.request.get(`${API}/sales/${saleId}/`)
    ).json()
    expect(sale.state).toBe('DRAFT')
    expect(sale.internal_number).toBeNull()
  })

  test('una oferta vencida no ofrece convertir y permite una nueva vinculada', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page, 5)
    const issued = await apiIssued(page, world)
    // El vencimiento depende del día local del servidor, que la prueba no controla: se
    // presenta el estado efectivo vencido que el servidor devolvería al día siguiente. La
    // regla de fechas y su rechazo en servidor se prueban en el backend con reloj controlado.
    await page.route(`**/proformas/${issued.id}/`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const response = await route.fetch()
      const body = await response.json()
      await route.fulfill({
        response,
        json: {
          ...body,
          state: 'EXPIRED',
          allowed_actions: ['void', 'copy', 'print'],
        },
      })
    })
    await page.goto(`/proformas/${issued.id}`)
    await expect(
      page.getByRole('heading', { name: /COM-PRO-\d{6}/ }),
    ).toContainText('Vencida')
    await expect(
      page.getByRole('button', { name: 'Convertir en venta' }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Nueva vinculada' }).click()
    await expect(page).toHaveURL(/\/proformas\/\d+\/edit$/)
    await expect(
      page.getByRole('link', { name: issued.internal_number }),
    ).toBeVisible()
    const copies = await (
      await page.request.get(
        `${API}/proformas/?customer_id=${world.customer.id}&state=DRAFT`,
      )
    ).json()
    expect(copies.count).toBe(1)
    expect(copies.results[0].origin.number).toBe(issued.internal_number)
    const original = await (
      await page.request.get(`${API}/proformas/${issued.id}/`)
    ).json()
    expect(original.state).toBe('VALID')
    expect(original.grand_total).toBe('40.00')
  })

  test('el logo emitido se conserva aunque se reemplace o se retire', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page, 5)
    await removeEntityLogo(page, 'COMERCIAL')
    const withoutLogo = await apiIssued(page, world, 1)
    await uploadEntityLogo(page, 'COMERCIAL')
    const withLogo = await apiIssued(page, world, 1)
    const original = await page.request.get(
      `${API}/proformas/${withLogo.id}/document/logo/`,
    )
    expect(original.status()).toBe(200)
    const bytes = await original.body()
    await removeEntityLogo(page, 'COMERCIAL')

    await page.goto(`/proformas/${withLogo.id}/document`)
    const sheet = page.getByRole('article', { name: 'Proforma' })
    await expect(sheet.getByRole('img', { name: /Logo de/ })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Imprimir o guardar PDF' }),
    ).toBeEnabled()
    const after = await page.request.get(
      `${API}/proformas/${withLogo.id}/document/logo/`,
    )
    expect(Buffer.compare(await after.body(), bytes)).toBe(0)

    // Emitida sin logo: conserva esa ausencia y no reserva hueco.
    await page.goto(`/proformas/${withoutLogo.id}/document`)
    await expect(sheet.getByRole('img')).toHaveCount(0)
    await expect(sheet.getByRole('group', { name: 'Emisor' })).toBeVisible()
    const none = await page.request.get(
      `${API}/proformas/${withoutLogo.id}/document/logo/`,
    )
    expect(none.status()).toBe(204)
  })

  test('cotizar sin cliente y elegirlo al convertir en venta', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page, 5)
    await page.goto('/proformas/new')
    await pick(page, 'Producto de la línea 1', world.product.code)
    await expect(page.getByRole('table').getByText('USD 20.00')).toHaveCount(2)
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/proformas\/\d+\/edit$/)
    await page.getByRole('button', { name: 'Revisar y emitir' }).click()
    await page
      .getByRole('dialog', { name: 'Revisar y emitir proforma' })
      .getByRole('button', { name: 'Emitir proforma' })
      .click()
    await expect(
      page.getByRole('heading', { name: /COM-PRO-\d{6}/ }),
    ).toContainText('Vigente')
    await expect(page.getByText('Sin cliente')).toBeVisible()
    const proformaId = Number(page.url().match(/proformas\/(\d+)/)![1])

    // El impreso no lleva bloque de cliente.
    await page.goto(`/proformas/${proformaId}/document`)
    const sheet = page.getByRole('article', { name: 'Proforma' })
    await expect(sheet.getByText('COTIZACIÓN', { exact: true })).toBeVisible()
    await expect(sheet).not.toContainText('Cliente')

    // Al convertir, la venta exige elegir un cliente registrado.
    await page.goto(`/proformas/${proformaId}`)
    await page.getByRole('button', { name: 'Convertir en venta' }).click()
    const dialog = page.getByRole('dialog', { name: 'Convertir en venta' })
    const convert = dialog.getByRole('button', { name: 'Convertir en venta' })
    await expect(convert).toBeDisabled()
    await dialog
      .getByRole('combobox', { name: 'Cliente de la venta' })
      .fill(world.customer.name)
    await page
      .getByRole('listbox', { name: 'Resultados de Cliente de la venta' })
      .getByRole('option', { name: new RegExp(world.customer.name) })
      .first()
      .click()
    await expect(convert).toBeEnabled()
    await convert.click()
    await expect(page).toHaveURL(/\/sales\/\d+$/)
    const saleId = Number(page.url().match(/sales\/(\d+)/)![1])
    const sale = await (
      await page.request.get(`${API}/sales/${saleId}/`)
    ).json()
    expect(sale.customer.id).toBe(world.customer.id)
    expect(sale.origin.proforma_id).toBe(proformaId)
    const proforma = await (
      await page.request.get(`${API}/proformas/${proformaId}/`)
    ).json()
    expect(proforma.state).toBe('CONVERTED')
    expect(proforma.customer).toBeNull()
  })

  test('una descripción extensa, con marca y código de fabricante, entra en la hoja', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page, 5)
    const request = page.request
    const brand = await ok(
      await send(request, 'post', '/product-brands/', {
        name: `Marca Larga Internacional ${world.tag}`,
        idempotency_key: `e2e-brand-${world.tag}`,
      }),
    )
    const longName =
      'Kit de embrague reforzado con disco de 15 pulgadas, plato de presión, rodamiento axial y guía de centrado para transmisión de 18 velocidades de servicio pesado'
    const long = await ok(
      await send(request, 'post', '/products/', {
        code: `LARGO-${world.tag}`,
        manufacturer_code: 'FAB-4303420-XL-REFORZADO',
        name: longName,
        description: '',
        category_id: world.catalog.categoryId,
        unit_id: world.catalog.unitId,
        product_brand_id: brand.id,
        vehicle_brand_ids: [],
        tax_definition_id: world.catalog.taxId,
        content_quantity: '1',
        sale_price: '12345.67',
        is_kit: false,
        idempotency_key: `e2e-long-${world.tag}`,
      }),
    )
    const draft = await ok(
      await send(request, 'post', '/proformas/', {
        idempotency_key: `e2e-longd-${world.tag}`,
        customer_id: world.customer.id,
        lines: [
          { product_id: long.id, quantity: '12' },
          { product_id: world.product.id, quantity: '1' },
        ],
      }),
    )
    const review = await (
      await request.get(`${API}/proformas/${draft.id}/issue-preview/`)
    ).json()
    await ok(
      await send(request, 'post', `/proformas/${draft.id}/issue/`, {
        idempotency_key: `e2e-longi-${world.tag}`,
        expected_version: review.version,
        review_token: review.review_token,
      }),
    )
    await page.goto(`/proformas/${draft.id}/document`)
    const sheet = page.getByRole('article', { name: 'Proforma' })
    const row = sheet.getByRole('row', { name: /LARGO-/ })
    await expect(row.getByText(longName)).toBeVisible()
    await expect(row.getByText(brand.name)).toBeVisible()
    await expect(row.getByText('FAB-4303420-XL-REFORZADO')).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    // Nada se sale de la hoja: ni la tabla ni la columna del total.
    const fit = await sheet.evaluate((element) => {
      const table = element.querySelector('table')!
      const edge = element.getBoundingClientRect().right
      const cells = [...table.querySelectorAll('td, th')]
      return {
        overflow: table.scrollWidth - table.clientWidth,
        outside: cells.filter(
          (cell) => cell.getBoundingClientRect().right > edge + 1,
        ).length,
        clipped: cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
          .length,
      }
    })
    expect(fit).toEqual({ overflow: 0, outside: 0, clipped: 0 })
    await expect(row.getByText('USD 148148.04')).toBeVisible()
    await page.pdf({
      preferCSSPageSize: true,
      path: `${EVIDENCE}/proforma-descripcion-larga.pdf`,
    })
  })

  test('impresión A4 de varias páginas, 360 px, teclado y accesibilidad', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const world = await seedWorld(page, 5)
    await uploadEntityLogo(page, 'COMERCIAL')
    const issued = await apiIssued(page, world, 1, 60)

    // Documento con 60 líneas: imprime en varias páginas sin recortar filas ni totales.
    await page.goto(`/proformas/${issued.id}/document`)
    const sheet = page.getByRole('article', { name: 'Proforma' })
    await expect(sheet.getByRole('row')).toHaveCount(61)
    await expect(
      page.getByRole('button', { name: 'Imprimir o guardar PDF' }),
    ).toBeEnabled()
    await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)
    await page.screenshot({
      path: `${EVIDENCE}/documento-pantalla.png`,
      fullPage: true,
    })
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.app-rail')).toBeHidden()
    // Sin la barra del marco («RUC comercial») y con la hoja alineada al ancho de la página.
    await expect(page.getByTestId('app-topbar')).toBeHidden()
    // La hoja ocupa el ancho de la página y su contenido queda centrado con margen propio.
    const box = await sheet.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const inner = element
        .querySelector('.sheet-head')!
        .getBoundingClientRect()
      return {
        left: rect.left,
        right: window.innerWidth - rect.right,
        marginLeft: inner.left - rect.left,
        marginRight: rect.right - inner.right,
      }
    })
    expect(box.left).toBeLessThan(2)
    expect(box.right).toBeLessThan(2)
    expect(box.marginLeft).toBeGreaterThan(40)
    expect(Math.abs(box.marginLeft - box.marginRight)).toBeLessThan(2)
    await expect(sheet.getByText('USD 1200.00')).toBeVisible()
    const clipped = await sheet.evaluate((element) => {
      const hidden = ['hidden', 'clip', 'scroll', 'auto']
      const nodes = [element, ...element.querySelectorAll('*')]
      return nodes.filter((node) => {
        const style = getComputedStyle(node)
        return (
          hidden.includes(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 1
        )
      }).length
    })
    expect(clipped).toBe(0)
    const pdf = await page.pdf({
      // Respeta el tamaño y los márgenes de @page, como la impresión real del navegador.
      preferCSSPageSize: true,
      path: `${EVIDENCE}/proforma-a4-60-lineas.pdf`,
    })
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [])
      .length
    expect(pages).toBeGreaterThan(1)
    await page.emulateMedia({ media: 'screen' })

    // 360 px: lista, ficha, editor y documento sin desplazamiento horizontal de página.
    await page.setViewportSize({ width: 360, height: 780 })
    for (const path of [
      '/proformas',
      `/proformas/${issued.id}`,
      '/proformas/new',
      `/proformas/${issued.id}/document`,
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)
      await page.screenshot({
        path: `${EVIDENCE}/360-${path.replace(/\W+/g, '-')}.png`,
        fullPage: true,
      })
    }

    // Teclado: el editor se recorre y opera sin ratón, con foco visible.
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/proformas/new')
    const customer = page.getByRole('combobox', { name: 'Cliente' })
    await customer.focus()
    await expect(customer).toBeFocused()
    await page.keyboard.type(world.customer.name)
    const options = page
      .getByRole('listbox', { name: 'Resultados de Cliente' })
      .getByRole('option')
    await expect(options).toHaveCount(1)
    await expect(options.first()).toContainText(world.customer.name)
    await page.keyboard.press('Enter')
    await expect(customer).toHaveValue(new RegExp(world.customer.name))
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement
      const style = getComputedStyle(element)
      return {
        tag: element.tagName,
        outlined: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
      }
    })
    expect(['INPUT', 'BUTTON', 'A']).toContain(focused.tag)
    expect(focused.outlined).toBe(true)
    // Estado con texto, no solo color.
    await page.goto('/proformas')
    await expect(
      page
        .getByRole('table', { name: 'Proformas' })
        .getByText('Vigente')
        .first(),
    ).toBeVisible()
  })
})
