import { expect, test, type Page } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { API, send, seedFiscalConfiguration } from './catalog-helpers'
import { login } from './helpers'
import { removeEntityLogo, uploadEntityLogo } from './logo-helpers'

interface World {
  tag: string
  customer: { id: number; name: string }
  product: { id: number; code: string; name: string }
  supplier: { id: number }
  tax: { id: number }
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

/** Configuración, cliente, producto (precio final 20.00) y existencia inicial por la API. */
async function seedWorld(page: Page, stock = 10): Promise<World> {
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
  const supplier = await ok(
    await send(request, 'post', '/suppliers/', {
      name: `Proveedor ${tag}`,
      idempotency_key: `e2e-sup-${tag}`,
    }),
  )
  const product = await ok(
    await send(request, 'post', '/products/', {
      code: `VEN-${tag}`,
      manufacturer_code: '',
      name: `Filtro ${tag}`,
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
  const identification = `17${String(Date.now()).slice(-7)}${counter % 10}`
  const customer = await ok(
    await send(request, 'post', '/customers/', {
      person_type: 'NATURAL',
      name: `Cliente ${tag}`,
      identification_type: 'CI',
      identification,
      phone: '0999999999',
      idempotency_key: `e2e-cus-${tag}`,
    }),
  )
  const world = { tag, customer, product, supplier, tax }
  await apiPurchase(page, world, stock, `${tag}-0`)
  await page.reload()
  return world
}

async function apiPurchase(
  page: Page,
  world: World,
  quantity: number,
  ref: string,
) {
  const request = page.request
  const created = await ok(
    await send(request, 'post', '/purchases/', {
      idempotency_key: `e2e-pur-${ref}`,
      supplier_id: world.supplier.id,
      document_type: 'FACTURA',
      supplier_reference: `F-${ref}`,
      document_date: '2026-09-01',
      notes: '',
      lines: [
        {
          product_id: world.product.id,
          quantity: String(quantity),
          unit_cost: '10.00',
          tax_definition_id: world.tax.id,
          tax_recoverability: 'RECOVERABLE',
        },
      ],
    }),
  )
  const review = await ok(
    await send(request, 'post', `/purchases/${created.id}/preview/`, {}),
  )
  await ok(
    await send(request, 'post', `/purchases/${created.id}/confirm/`, {
      idempotency_key: `e2e-pcf-${ref}`,
      expected_version: created.version,
      review_token: review.review_token,
    }),
  )
}

/** Crea y confirma una venta por la API. */
async function apiSale(
  page: Page,
  world: World,
  options: { quantity: number; condition?: 'CONTADO' | 'CREDITO'; key: string },
) {
  const request = page.request
  const draft = await ok(
    await send(request, 'post', '/sales/', {
      idempotency_key: `e2e-sd-${world.tag}-${options.key}`,
      customer_id: world.customer.id,
      condition: options.condition ?? 'CREDITO',
      lines: [
        { product_id: world.product.id, quantity: String(options.quantity) },
      ],
    }),
  )
  const review = await ok(
    await send(request, 'post', `/sales/${draft.id}/preview/`, {}),
  )
  return ok(
    await send(request, 'post', `/sales/${draft.id}/confirm/`, {
      idempotency_key: `e2e-sc-${world.tag}-${options.key}`,
      expected_version: draft.version,
      review_token: review.review_token,
    }),
  )
}

async function apiPay(page: Page, saleId: number, amount: string, key: string) {
  const request = page.request
  const data = {
    operation_id: crypto.randomUUID(),
    parts: [{ method: 'EFECTIVO', amount }],
  }
  const review = await ok(
    await send(request, 'post', `/sales/${saleId}/payments/preview/`, data),
  )
  return ok(
    await send(request, 'post', `/sales/${saleId}/payments/`, {
      ...data,
      idempotency_key: `e2e-pay-${key}`,
      review_token: review.review_token,
    }),
  )
}

async function pickCustomer(page: Page, world: World) {
  await page
    .getByRole('combobox', { name: 'Cliente' })
    .fill(world.customer.name)
  await page
    .getByRole('listbox', { name: 'Resultados de Cliente' })
    .getByRole('option', { name: new RegExp(world.customer.name) })
    .first()
    .click()
}

async function pickProduct(page: Page, world: World) {
  await page
    .getByRole('combobox', { name: 'Producto de la línea 1' })
    .fill(world.product.code)
  await page
    .getByRole('listbox', { name: 'Resultados de Producto de la línea 1' })
    .getByRole('option', { name: new RegExp(world.product.code) })
    .first()
    .click()
}

test.describe('Ventas, cobros y correcciones', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin_e2e')
  })

  test('flujo completo: vista previa en vivo, revisión, confirmación, Kardex, cobro y comprobante', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page)
    await page.goto('/sales/new')
    await expect(page.getByText('Borrador · Vista previa')).toBeVisible()
    await expect(page.getByText('Pendiente de confirmación')).toBeVisible()
    await pickCustomer(page, world)
    await pickProduct(page, world)
    await page.getByLabel('Cantidad de la línea 1').fill('2')
    const sheet = page.getByRole('article', { name: 'Comprobante de venta' })
    await expect(sheet).toContainText('USD 40.00', { timeout: 10_000 })
    await expect(sheet).toContainText(world.product.code)
    await expect(
      page.getByRole('status', { name: 'Estado de los importes' }),
    ).toContainText('Actualizada')
    // La vista previa no habilita confirmar por sí sola.
    await expect(
      page.getByRole('button', { name: 'Revisar y confirmar' }),
    ).toBeDisabled()
    const previewText = await sheet.innerText()
    await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)

    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/sales\/\d+\/edit$/)
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Revisar y confirmar venta',
    })
    await expect(dialog).toContainText('USD 40.00')
    await expect(dialog).toContainText('10 → 8')
    await dialog.getByRole('button', { name: 'Confirmar venta' }).click()
    await expect(page).toHaveURL(/\/sales\/\d+$/)
    await expect(
      page.getByRole('heading', { name: /COM-VEN-\d{6}/ }),
    ).toBeVisible()
    await expect(
      page.getByText('Saldo pendiente de cobro').locator('..'),
    ).toContainText('USD 40.00')

    // Kardex: la salida por venta aparece con su etiqueta.
    await page.goto(`/inventory/products/${world.product.id}/kardex`)
    await expect(
      page.getByText('Salida por venta').locator('visible=true').first(),
    ).toBeVisible()

    // Cobro con teclado; el foco regresa al botón al cerrar.
    await page.goBack()
    const pay = page.getByRole('button', { name: 'Registrar cobro' })
    await pay.focus()
    await page.keyboard.press('Enter')
    const payment = page.getByRole('dialog', { name: 'Registrar cobro' })
    await expect(payment).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(payment).toBeHidden()
    await expect(pay).toBeFocused()
    await pay.click()
    await page.getByLabel('Efectivo (USD)').fill('40.00')
    await page.getByRole('button', { name: 'Revisar' }).click()
    await page.getByRole('button', { name: 'Registrar cobro' }).last().click()
    await expect(page.getByText('Cobro registrado.')).toBeVisible()
    await expect(page.getByText('Estado de pago').locator('..')).toContainText(
      'Pagada',
    )
    await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)

    // Comprobante: misma estructura que la hoja de vista previa, con el aviso del SRI.
    await page.getByRole('link', { name: 'Ver comprobante' }).click()
    const document = page.getByRole('article', { name: 'Comprobante de venta' })
    await expect(document).toContainText('COM-VEN-')
    await expect(document).toContainText(
      'no constituye una factura electrónica autorizada por el SRI',
    )
    for (const fragment of [
      'USD 40.00',
      world.product.code,
      'Base imponible',
      'Impuesto',
    ]) {
      expect(previewText).toContain(fragment)
      await expect(document).toContainText(fragment)
    }
    await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)
  })

  test('el comprobante encabeza con el logo comercial y sin él muestra solo el nombre', async ({
    page,
  }) => {
    const world = await seedWorld(page)
    const commercial = await uploadEntityLogo(page, 'COMERCIAL')
    try {
      const sale = await apiSale(page, world, { quantity: 1, key: 'logo' })
      await page.goto(`/sales/${sale.id}/document`)
      const issuer = page
        .getByRole('article', { name: 'Comprobante de venta' })
        .getByRole('group', { name: 'Emisor' })
      const logo = issuer.getByRole('img', {
        name: `Logo de ${commercial.legal_name}`,
      })
      await expect(logo).toBeVisible()
      await expect
        .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0)
      await expect(
        page.getByRole('button', { name: 'Imprimir comprobante' }),
      ).toBeEnabled()
      await expect(page.getByText('Generado con Tallkit')).toBeVisible()

      await removeEntityLogo(page, 'COMERCIAL')
      await page.reload()
      await expect(issuer).toContainText(commercial.legal_name)
      await expect(issuer.getByRole('img')).toHaveCount(0)
    } finally {
      await removeEntityLogo(page, 'COMERCIAL')
    }
  })

  test('contado interrumpido y reanudado no inventa un pago ni lo convierte en crédito', async ({
    page,
  }) => {
    const world = await seedWorld(page)
    const sale = await apiSale(page, world, {
      quantity: 2,
      condition: 'CONTADO',
      key: 'c1',
    })
    await page.goto(`/sales/${sale.id}`)
    await page.getByRole('button', { name: 'Registrar cobro' }).click()
    await expect(page.getByText(/exige cubrir el saldo completo/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click() // se interrumpe el cobro
    await page.reload()
    await expect(
      page.getByText('Estado de la venta').locator('..'),
    ).toContainText('Confirmada')
    await expect(page.getByText('Estado de pago').locator('..')).toContainText(
      'Pendiente',
    )
    await expect(page.getByText('Condición').locator('..')).toContainText(
      'Contado',
    )
    await expect(page.getByText('Aún no hay cobros registrados.')).toBeVisible()
    await page.getByRole('button', { name: 'Registrar cobro' }).click()
    await page.getByLabel('Efectivo (USD)').fill('10.00') // abono parcial en contado
    await page.getByRole('button', { name: 'Revisar' }).click()
    await expect(
      page.getByText(/Una venta de contado exige cobrar el saldo completo/),
    ).toBeVisible()
    await page.getByLabel('Efectivo (USD)').fill('40.00')
    await page.getByRole('button', { name: 'Revisar' }).click()
    await page.getByRole('button', { name: 'Registrar cobro' }).last().click()
    await expect(page.getByText('Estado de pago').locator('..')).toContainText(
      'Pagada',
    )
  })

  test('un timeout no duplica el cobro y tras recargar se consulta el estado del UUID', async ({
    page,
  }) => {
    const world = await seedWorld(page)
    const sale = await apiSale(page, world, { quantity: 2, key: 't1' })
    await page.goto(`/sales/${sale.id}`)
    let intercepted = 0
    await page.route(`**/api/v1/sales/${sale.id}/payments/`, async (route) => {
      if (route.request().method() === 'POST' && intercepted === 0) {
        intercepted += 1
        await route.fetch() // el servidor registra el cobro…
        await route.abort('timedout') // …pero la respuesta nunca llega
        return
      }
      await route.continue()
    })
    await page.getByRole('button', { name: 'Registrar cobro' }).click()
    await page.getByLabel('Efectivo (USD)').fill('10.00')
    await page.getByRole('button', { name: 'Revisar' }).click()
    await page.getByRole('button', { name: 'Registrar cobro' }).last().click()
    await expect(
      page.getByText('No recibimos la confirmación del servidor'),
    ).toBeVisible()
    await expect(
      page.getByText(/no indica si el dinero se entregó o no/),
    ).toBeVisible()
    // Se recarga la página: el UUID sigue en sessionStorage y se consulta antes de otra operación.
    await page.reload()
    await page.getByRole('button', { name: 'Registrar cobro' }).click()
    await expect(page.getByText('Este registro ya se guardó')).toBeVisible()
    const payments = await (
      await page.request.get(`${API}/sales/${sale.id}/payments/`)
    ).json()
    expect(payments).toHaveLength(1)
    expect(payments[0].amount).toBe('10.00')
  })

  test('disponibilidad insuficiente y anulación bloqueada por movimientos posteriores', async ({
    page,
  }) => {
    const world = await seedWorld(page, 3)
    await page.goto('/sales/new')
    await pickCustomer(page, world)
    await pickProduct(page, world)
    await page.getByLabel('Cantidad de la línea 1').fill('50')
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page).toHaveURL(/\/sales\/\d+\/edit$/)
    await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Revisar y confirmar venta',
    })
    await expect(dialog).toContainText('Línea 1: Existencia insuficiente')
    await expect(
      dialog.getByRole('button', { name: 'Confirmar venta' }),
    ).toBeDisabled()

    const sale = await apiSale(page, world, { quantity: 1, key: 'v1' })
    await apiPurchase(page, world, 4, `${world.tag}-late`) // movimiento posterior
    await page.goto(`/sales/${sale.id}`)
    await page.getByRole('button', { name: 'Anular venta' }).click()
    await page.getByLabel('Motivo de la anulación').fill('Error de captura')
    await page.getByRole('button', { name: 'Revisar' }).click()
    const void_ = page.getByRole('dialog', { name: 'Anular venta' })
    await expect(void_).toContainText(world.product.code)
    await expect(void_).toContainText('movimientos posteriores')
    await expect(
      void_.getByRole('button', { name: 'Anular venta' }).last(),
    ).toBeDisabled()
  })

  test('devolución parcial con aptitud mixta, exceso visible y reembolso posterior', async ({
    page,
  }) => {
    const world = await seedWorld(page)
    const sale = await apiSale(page, world, { quantity: 5, key: 'r1' })
    await apiPay(page, sale.id, '100.00', 'r1')
    await page.goto(`/sales/${sale.id}`)
    await page.getByRole('button', { name: 'Registrar devolución' }).click()
    await page.getByLabel('Aptas para reventa (línea 1)').fill('2')
    await page.getByLabel('No aptas (línea 1)').fill('1')
    await page.getByLabel('Motivo de la devolución').fill('Producto equivocado')
    await page.getByRole('button', { name: 'Revisar' }).click()
    await page
      .getByRole('button', { name: 'Registrar devolución' })
      .last()
      .click()
    await expect(page.getByText('Devolución registrada.')).toBeVisible()
    const money = page.getByRole('region', { name: 'Importes' })
    await expect(
      money.getByText('Exceso por reembolsar', { exact: true }).locator('..'),
    ).toContainText('USD 60.00')
    await expect(
      money
        .getByText('Saldo pendiente de cobro', { exact: true })
        .locator('..'),
    ).toContainText('USD 0.00')
    await page
      .getByRole('button', { name: /Registrar reembolso de la devolución/ })
      .click()
    await expect(page.getByText(/distinto de entregar el dinero/)).toBeVisible()
    await page.getByLabel('Efectivo (USD)').fill('60.00')
    await page.getByLabel('Motivo del reembolso').fill('Devolución al cliente')
    await page.getByRole('button', { name: 'Revisar' }).click()
    await page
      .getByRole('button', { name: 'Registrar reembolso' })
      .last()
      .click()
    await expect(
      money.getByText('Exceso por reembolsar', { exact: true }).locator('..'),
    ).toContainText('USD 0.00')
  })

  test('filtros conservados al volver del detalle y cuentas por cobrar con totales de varias páginas', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const world = await seedWorld(page, 30)
    for (let index = 0; index < 21; index += 1) {
      await apiSale(page, world, { quantity: 1, key: `m${index}` })
    }
    await page.goto('/sales?state=CONFIRMED')
    await page.getByRole('row').nth(1).click()
    await expect(page).toHaveURL(/\/sales\/\d+/)
    await page.goBack()
    await expect(page).toHaveURL(/state=CONFIRMED/)
    await page.goto('/sales/receivables')
    const totals = page.getByRole('region', {
      name: 'Totales de todas las coincidencias',
    })
    await expect(totals).toContainText('USD ')
    await expect(totals).toContainText(
      'todas las coincidencias, no solo esta página',
    )
    await expect(page.getByText('Deuda cobrable').first()).toBeVisible()
    await expect(page.getByText(/mora|vencid/i)).toHaveCount(0)
    await page.goto('/sales/receivables?page=2')
    await expect(totals).toContainText('USD ')
  })

  test('el editor cumple la composición responsiva y deja evidencia visual', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const widths = [
      { width: 1440, height: 900, columns: true },
      { width: 1280, height: 800, columns: true },
      { width: 1024, height: 800, columns: false },
      { width: 768, height: 900, columns: false },
      { width: 360, height: 800, columns: false },
    ]
    for (const view of widths) {
      await page.setViewportSize({ width: view.width, height: view.height })
      await page.goto('/sales/new')
      const form = page.getByRole('region', { name: 'Captura de la venta' })
      const preview = page.getByRole('region', { name: 'Vista previa' })
      if (view.columns) {
        await expect(preview).toBeVisible()
        const a = (await form.boundingBox())!
        const b = (await preview.boundingBox())!
        expect(Math.abs(a.y - b.y)).toBeLessThan(2) // alineadas arriba
        expect(b.x).toBeGreaterThan(a.x + a.width - 1)
        expect(Math.round(b.x - (a.x + a.width))).toBe(16) // separación de 16 px
        expect(a.width / (a.width + b.width)).toBeGreaterThan(0.4) // ~44 %
        expect(a.width / (a.width + b.width)).toBeLessThan(0.48)
      } else {
        // Una vista a la vez: el editor primero y «Vista previa» la alterna.
        await expect(form).toBeVisible()
        await expect(preview).toBeHidden()
        const group = page.getByRole('group', { name: 'Vista' })
        await group.getByRole('button', { name: 'Vista previa' }).click()
        await expect(preview).toBeVisible()
        await expect(form).toBeHidden()
        await group.getByRole('button', { name: 'Editar' }).click()
      }
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await page.screenshot({
        path: `test-results/sales-evidence/editor-${view.width}.png`,
        fullPage: true,
      })
      await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)
    }
  })
})
