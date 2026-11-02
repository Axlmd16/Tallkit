import { expect, test, type Page } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { API, send, seedFiscalConfiguration } from './catalog-helpers'
import { login } from './helpers'
import { removeEntityLogo, uploadEntityLogo } from './logo-helpers'

const EVIDENCE = 'test-results/maintenance-billing-evidence'
const RAIL_EXCEPTION = { exclude: ['.app-rail'] }

const ok = async (response: Awaited<ReturnType<typeof send>>) => {
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

async function relogin(page: Page, username: string) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, username)
}

/** Configuración, repuesto con existencia 5, servicio artesanal, cliente y vehículo. */
async function seed(page: Page) {
  const tag = Date.now().toString(36)
  await seedFiscalConfiguration(page)
  const request = page.request
  const entities: Array<{ id: number; entity_type: string }> = await (
    await request.get(`${API}/workshop-configuration/entities/`)
  ).json()
  const taxes: Array<{ id: number; code: string; fiscal_entity_id: number }> =
    await (await request.get(`${API}/workshop-configuration/taxes/`)).json()
  const taxOf = (type: string) => {
    const entity = entities.find((e) => e.entity_type === type)!
    return taxes.find(
      (t) => t.code === 'IVA15' && t.fiscal_entity_id === entity.id,
    )!
  }
  const category = await ok(
    await send(request, 'post', '/product-categories/', {
      name: `Repuestos ${tag}`,
      idempotency_key: `e2e-bil-cat-${tag}`,
    }),
  )
  const unit = await ok(
    await send(request, 'post', '/measurement-units/', {
      name: `Unidad ${tag}`,
      idempotency_key: `e2e-bil-uni-${tag}`,
    }),
  )
  const product = await ok(
    await send(request, 'post', '/products/', {
      code: `REP-${tag}`,
      manufacturer_code: '',
      name: `Pastillas ${tag}`,
      description: '',
      category_id: category.id,
      unit_id: unit.id,
      product_brand_id: null,
      vehicle_brand_ids: [],
      tax_definition_id: taxOf('COMERCIAL').id,
      content_quantity: '1',
      sale_price: '23.00',
      is_kit: false,
      idempotency_key: `e2e-bil-prd-${tag}`,
    }),
  )
  const supplier = await ok(
    await send(request, 'post', '/suppliers/', {
      name: `Proveedor ${tag}`,
      idempotency_key: `e2e-bil-sup-${tag}`,
    }),
  )
  // Entrada de stock por la API vigente (DP-030): sin documento ni impuestos de compra.
  await ok(
    await send(request, 'post', '/purchases/entries/', {
      idempotency_key: `e2e-bil-ent-${tag}`,
      supplier_id: supplier.id,
      lines: [{ product_id: product.id, quantity: '5', unit_cost: '10.00' }],
      acknowledged_entry_ids: [],
    }),
  )
  const service = await ok(
    await send(request, 'post', '/services/', {
      name: `Cambio de pastillas ${tag}`,
      reference_price: '46.00',
      tax_definition_id: taxOf('ARTESANAL').id,
      idempotency_key: `e2e-bil-srv-${tag}`,
    }),
  )
  const customer = await ok(
    await send(request, 'post', '/customers/', {
      person_type: 'NATURAL',
      name: `Cliente Integración ${tag}`,
      identification_type: 'CI',
      identification: `17${Date.now().toString().slice(-8)}`,
      phone: '0999999999',
      idempotency_key: `e2e-bil-cus-${tag}`,
    }),
  )
  const brand = await ok(
    await send(request, 'post', '/vehicle-brands/', { name: `Marca ${tag}` }),
  )
  const vehicle = await ok(
    await send(request, 'post', '/vehicles/', {
      plate: `BIL-${tag.slice(-4).toUpperCase()}`,
      brand_id: brand.id,
      model: 'Corolla',
      owner_id: customer.id,
    }),
  )
  return { tag, product, service, customer, vehicle }
}

test('repuestos, venta vinculada, servicios y cobros separados por RUC', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'admin_e2e')
  const world = await seed(page)
  const artisan = await uploadEntityLogo(page, 'ARTESANAL')

  // 1. El Encargado registra la orden con un servicio y reserva un repuesto.
  await relogin(page, 'taller_e2e')
  const order = await ok(
    await send(page.request, 'post', '/maintenance-orders/', {
      customer_id: world.customer.id,
      vehicle_id: world.vehicle.id,
      odometer_km: 42000,
      diagnosis: 'Pastillas delanteras gastadas',
      idempotency_key: `e2e-bil-ord-${world.tag}`,
    }),
  )
  await ok(
    await send(
      page.request,
      'post',
      `/maintenance-orders/${order.id}/service-lines/`,
      {
        service_id: world.service.id,
        detail: 'frenos delanteros',
        expected_version: order.version,
        idempotency_key: `e2e-bil-lin-${world.tag}`,
      },
    ),
  )
  await page.goto(`/maintenance/${order.id}`)
  await page.getByRole('tab', { name: 'Repuestos' }).click()
  await page.getByRole('button', { name: 'Agregar repuesto' }).click()
  const partDialog = page.getByRole('dialog')
  await partDialog
    .getByRole('combobox', { name: 'Repuesto del catálogo' })
    .click()
  await page
    .getByRole('option', { name: new RegExp(world.product.code) })
    .click()
  await expect(partDialog.getByText(/disponible 5/)).toBeVisible()
  await partDialog.getByLabel('Cantidad').fill('2')
  await partDialog.getByRole('button', { name: 'Reservar repuesto' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByText('Reservado, pendiente de confirmar'),
  ).toBeVisible()
  await page.screenshot({
    path: `${EVIDENCE}/01-repuesto-reservado.png`,
    fullPage: true,
  })
  await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)

  // Finalizar se bloquea mientras la venta abierta tenga líneas.
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(
    page
      .getByRole('dialog')
      .getByText(/venta de repuestos abierta tiene 1 línea/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // 2. El Vendedor confirma la venta vinculada a crédito: sale una sola vez del inventario.
  await relogin(page, 'vendedor_e2e')
  const drafts = await (
    await page.request.get(`${API}/sales/?origin=MAINTENANCE&state=DRAFT`)
  ).json()
  const draft = drafts.results.find(
    (row: { origin: { order_id: number } }) => row.origin.order_id === order.id,
  )
  const credit = await ok(
    await send(page.request, 'patch', `/sales/${draft.id}/`, {
      condition: 'CREDITO',
      expected_version: draft.version,
      idempotency_key: `e2e-bil-cnd-${world.tag}`,
    }),
  )
  const saleReview = await ok(
    await send(page.request, 'post', `/sales/${draft.id}/preview/`, {}),
  )
  await ok(
    await send(page.request, 'post', `/sales/${draft.id}/confirm/`, {
      expected_version: credit.version,
      review_token: saleReview.review_token,
      idempotency_key: `e2e-bil-scf-${world.tag}`,
    }),
  )
  await page.goto(`/sales/${draft.id}`)
  await expect(
    page.getByText(`Venta vinculada a ${order.number}`),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Anular venta' })).toHaveCount(
    0,
  )
  await page.getByRole('link', { name: 'Ver orden de origen' }).click()
  await expect(page.getByRole('heading', { name: order.number })).toBeVisible()
  await expect(page.getByText('Diagnóstico')).toHaveCount(0)
  await page.screenshot({
    path: `${EVIDENCE}/02-vista-vendedor.png`,
    fullPage: true,
  })
  await page.goto('/maintenance/service-operations/1')
  await expect(
    page.getByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeVisible()

  // 3. El Encargado documenta y cobra los servicios del RUC artesanal.
  await relogin(page, 'taller_e2e')
  await page.goto(`/maintenance/${order.id}?tab=billing`)
  const economy = page.getByLabel('Resumen económico por RUC')
  await expect(economy.getByLabel('Ámbito fiscal: RUC comercial')).toBeVisible()
  await expect(economy.getByText('Confirmada', { exact: true })).toBeVisible()
  await expect(
    economy.getByRole('button', { name: 'Cobrar repuestos (RUC comercial)' }),
  ).toHaveCount(0)
  await economy
    .getByRole('button', { name: 'Generar comprobante de servicios' })
    .click()
  const serviceDialog = page.getByRole('dialog')
  await expect(
    serviceDialog.getByText(/No afecta inventario ni registra pagos/),
  ).toBeVisible()
  await expect(
    serviceDialog.getByText(
      'Comprobante interno: no es una factura electrónica autorizada por el SRI.',
    ),
  ).toBeVisible()
  // La nota que escribió el Encargado llega a la vista previa para revisarla (DP-035).
  await expect(serviceDialog.getByText('frenos delanteros')).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/03-documentar-servicios.png` })
  await serviceDialog
    .getByRole('button', { name: 'Generar comprobante' })
    .click()
  await expect(economy.getByRole('link', { name: /ART-SER-/ })).toBeVisible()

  // El comprobante de servicios encabeza con el logo artesanal, nunca con el comercial.
  const operationHref = await economy
    .getByRole('link', { name: /ART-SER-/ })
    .getAttribute('href')
  const operationId = operationHref?.match(/service-operations\/(\d+)/)?.[1]
  expect(operationId).toBeTruthy()
  await page.goto(`/maintenance/service-operations/${operationId}/document`)
  await expect(page.getByText('frenos delanteros')).toBeVisible()
  const issuer = page.getByRole('group', { name: 'Emisor' })
  await expect(
    issuer.getByRole('img', { name: `Logo de ${artisan.legal_name}` }),
  ).toBeVisible()
  await expect(issuer.getByRole('img')).toHaveCount(1)
  await expect(
    issuer.getByRole('img', { name: `Logo de ${artisan.legal_name}` }),
  ).toHaveAttribute('src', /entity-logos\/ARTESANAL\//)
  await page.goto(`/maintenance/${order.id}?tab=billing`)
  await economy
    .getByRole('button', { name: 'Cobrar servicios (RUC artesanal)' })
    .click()
  const payDialog = page.getByRole('dialog')
  await expect(
    payDialog.getByText(/no se\s+aplica a los repuestos/),
  ).toBeVisible()
  await payDialog.getByLabel('Efectivo (USD)').fill('46.00')
  await payDialog.getByRole('button', { name: /Registrar cobro/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    economy.getByText('Pagado', { exact: true }).first(),
  ).toBeVisible()
  await expect(economy.getByText('Total combinado (informativo)')).toHaveCount(
    0,
  )
  await page.screenshot({
    path: `${EVIDENCE}/04-documentos-y-cobros.png`,
    fullPage: true,
  })
  await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)

  // 4. Finalizar y reabrir no cambian documentos ni pagos; no se agregan repuestos cobrables.
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await page.getByRole('button', { name: 'Finalizar orden' }).click()
  await expect(
    page.getByText('Orden finalizada', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Reabrir/ }).click()
  await expect(
    page.getByText('Documentos y pagos conservan sus efectos'),
  ).toBeVisible()
  await page.getByLabel('Causa de la reapertura').fill('Chirrido al frenar')
  await page.getByRole('button', { name: 'Reabrir orden' }).click()
  await page.getByRole('tab', { name: 'Repuestos' }).click()
  await expect(
    page.getByText(/El trabajo correctivo no genera cobro/),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Agregar repuesto' }),
  ).toHaveCount(0)
  await page.screenshot({
    path: `${EVIDENCE}/05-reabierta.png`,
    fullPage: true,
  })

  // 5. El Administrador ve el total combinado solo como información.
  await relogin(page, 'admin_e2e')
  await removeEntityLogo(page, 'ARTESANAL')
  await page.goto(`/maintenance/${order.id}?tab=billing`)
  await expect(page.getByText('Total combinado (informativo)')).toBeVisible()
  await page.goto('/maintenance/receivables?payment_state=PAID')
  await expect(
    page.getByRole('heading', { name: 'Cuentas por cobrar de servicios' }),
  ).toBeVisible()
})

test('cobro de servicios con retención: baja la deuda sin ser dinero y el Administrador puede anularla', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'admin_e2e')
  const world = await seed(page)
  const request = page.request
  const order = await ok(
    await send(request, 'post', '/maintenance-orders/', {
      customer_id: world.customer.id,
      vehicle_id: world.vehicle.id,
      odometer_km: 51000,
      diagnosis: 'Revisión de frenos',
      idempotency_key: `e2e-wh-ord-${world.tag}`,
    }),
  )
  const withLine = await ok(
    await send(
      request,
      'post',
      `/maintenance-orders/${order.id}/service-lines/`,
      {
        service_id: world.service.id,
        expected_version: order.version,
        idempotency_key: `e2e-wh-lin-${world.tag}`,
      },
    ),
  )
  const preview = await ok(
    await send(
      request,
      'post',
      `/maintenance-orders/${order.id}/service-operations/preview/`,
      { condition: 'CONTADO' },
    ),
  )
  const operation = await ok(
    await send(
      request,
      'post',
      `/maintenance-orders/${order.id}/service-operations/`,
      {
        condition: 'CONTADO',
        review_digest: preview.review_digest,
        expected_version: withLine.version,
        idempotency_key: `e2e-wh-op-${world.tag}`,
      },
    ),
  )
  const total = Number(operation.grand_total)
  const money = (total - 1).toFixed(2)

  await page.goto(`/maintenance/service-operations/${operation.id}`)
  await page
    .getByRole('button', { name: 'Cobrar servicios (RUC artesanal)' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Transferencia (USD)').fill(money)
  await dialog.getByRole('checkbox', { name: /el cliente retuvo/ }).check()
  await expect(dialog.getByLabel('Valor retenido (USD)')).toHaveValue('1.00')
  await expect(dialog.getByLabel(/comprobante/i)).toHaveCount(0)
  await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)
  await dialog.getByRole('button', { name: /Registrar cobro/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const balance = page.getByLabel('Saldo de la operación')
  await expect(balance.getByText('Retenido por el cliente')).toBeVisible()
  const row = page.getByRole('listitem', { name: /^Retención \d+$/ })
  await expect(row.getByText('Comprobante pendiente')).toBeVisible()
  let detail = await (
    await request.get(`${API}/service-operations/${operation.id}/`)
  ).json()
  expect(detail).toMatchObject({
    paid: money,
    withheld: '1.00',
    balance: '0.00',
    payment_state: 'PAID',
  })
  await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)

  // Solo el Administrador anula: el valor vuelve al saldo y el registro se conserva.
  await row.getByRole('button', { name: 'Anular retención' }).click()
  const voidDialog = page.getByRole('dialog', { name: 'Anular retención' })
  await voidDialog.getByLabel('Motivo').fill('Registrada por error')
  await voidDialog.getByRole('button', { name: 'Anular retención' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(row.getByText('Anulada')).toBeVisible()
  detail = await (
    await request.get(`${API}/service-operations/${operation.id}/`)
  ).json()
  expect(detail).toMatchObject({ withheld: '0.00', balance: '1.00' })
})
