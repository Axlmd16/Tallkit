import { expect, test, type Page, type Route } from '@playwright/test'

import {
  expectAdaptableAndAccessible,
  REPRESENTATIVE_WIDTHS,
} from './accessibility'
import { API } from './catalog-helpers'
import { login } from './helpers'

const products = [
  {
    id: 101,
    code: 'FIL-00125',
    manufacturer_code: 'PH-2870A',
    name: 'Filtro de aceite reforzado',
    description: '',
    category: { id: 1, name: 'Filtros', is_active: true },
    unit: { id: 1, name: 'Unidad', is_active: true },
    product_brand: { id: 1, name: 'Fleetguard', is_active: true },
    vehicle_brands: [],
    content_quantity: '1.000000',
    sale_price: '15.00',
    is_kit: false,
    tax: null,
    is_active: true,
    version: 1,
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
  },
  {
    id: 102,
    code: 'PAST-002',
    manufacturer_code: '',
    name: 'Pastillas de freno',
    description: '',
    category: { id: 2, name: 'Frenos', is_active: true },
    unit: { id: 1, name: 'Unidad', is_active: true },
    product_brand: null,
    vehicle_brands: [],
    content_quantity: '1.000000',
    sale_price: '35.00',
    is_kit: false,
    tax: null,
    is_active: false,
    version: 1,
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
  },
] as const

function projection(product: (typeof products)[number]) {
  return {
    id: product.id,
    code: product.code,
    manufacturer_code: product.manufacturer_code || null,
    name: product.name,
    product_brand: product.product_brand
      ? { id: product.product_brand.id, name: product.product_brand.name }
      : null,
  }
}

async function mockCatalog(
  page: Page,
  options: { logo?: boolean; incompatible?: boolean } = {},
) {
  await page.route('**/api/v1/products/**', async (route: Route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/products/label-data/')) {
      const result = options.incompatible
        ? [{ ...projection(products[0]), code: 'FILTRO-Ñ' }]
        : products.map(projection)
      await route.fulfill({ json: result })
      return
    }
    const detail = url.pathname.match(/\/products\/(\d+)\/$/)
    if (detail) {
      const product = products.find(({ id }) => id === Number(detail[1]))
      await route.fulfill({ json: product ?? products[0] })
      return
    }
    if (url.pathname.endsWith('/products/')) {
      const pageNumber = Number(url.searchParams.get('page') ?? 1)
      const result = products[pageNumber - 1] ?? products[0]
      await route.fulfill({
        json: {
          count: 2,
          page: pageNumber,
          page_size: 1,
          total_pages: 2,
          results: [result],
        },
      })
      return
    }
    await route.fallback()
  })
  await page.route('**/api/v1/workshop-configuration/entity-logos/', (route) =>
    route.fulfill({
      json: {
        COMERCIAL: {
          entity_id: 1,
          legal_name: 'Repuestos Andinos S. A.',
          display_name: 'Repuestos La Esquina',
          logo: options.logo
            ? {
                url: '/fake-label-logo.svg',
                revision: 1,
                content_type: 'image/svg+xml',
                width: 120,
                height: 40,
                size_bytes: 100,
                uploaded_at: '2026-09-27T00:00:00Z',
              }
            : null,
        },
        ARTESANAL: null,
      },
    }),
  )
  await page.route('**/fake-label-logo.svg', (route) =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0f6b6f"/></svg>',
      contentType: 'image/svg+xml',
    }),
  )
}

async function selectDesktopRow(page: Page, id: number) {
  await page.getByRole('checkbox', { name: `Seleccionar fila ${id}` }).check()
}

test.describe.configure({ mode: 'serial', timeout: 120_000 })

test('selección en dos páginas, copias, posición 8 e impresión conservan el estado', async ({
  page,
}, testInfo) => {
  await login(page, 'admin_e2e')
  await mockCatalog(page, { logo: true })
  await page.addInitScript(() => {
    window.print = () =>
      document.documentElement.setAttribute('data-print-called', 'true')
  })
  await page.goto('/products')

  await selectDesktopRow(page, 101)
  await page.getByRole('button', { name: 'Página siguiente' }).click()
  await selectDesktopRow(page, 102)
  await expect(page.getByText('2 seleccionados')).toBeVisible()
  await page.getByRole('button', { name: 'Imprimir etiquetas' }).click()

  const modal = page.getByRole('dialog', { name: 'Imprimir etiquetas' })
  await expect(modal.getByLabel('Ancho (mm)')).toHaveValue('63')
  await expect(modal.getByLabel('Alto (mm)')).toHaveValue('38')
  await expect(
    modal.getByRole('button', { name: 'Imprimir', exact: true }),
  ).toBeInViewport()
  const preview = modal.locator('.product-label-preview')
  const previewCanvas = modal.getByTestId('product-label-preview-canvas')
  const [previewBox, previewCanvasBox] = await Promise.all([
    preview.boundingBox(),
    previewCanvas.boundingBox(),
  ])
  expect(previewBox).not.toBeNull()
  expect(previewCanvasBox).not.toBeNull()
  expect(previewCanvasBox!.width).toBeGreaterThan(380)
  const leftGap = previewCanvasBox!.x - previewBox!.x
  const rightGap =
    previewBox!.x +
    previewBox!.width -
    (previewCanvasBox!.x + previewCanvasBox!.width)
  expect(Math.abs(leftGap - rightGap)).toBeLessThan(3)
  const fittedCanvas = await previewCanvas.boundingBox()
  await modal.getByRole('button', { name: 'Aumentar zoom' }).click()
  await modal.getByRole('button', { name: 'Aumentar zoom' }).click()
  await expect(modal.getByRole('status', { name: 'Nivel de zoom' })).toHaveText(
    '70 %',
  )
  const enlargedCanvas = await previewCanvas.boundingBox()
  expect(enlargedCanvas!.width).toBeGreaterThan(fittedCanvas!.width)
  await modal.getByRole('button', { name: 'Ajustar hoja' }).click()
  await modal.getByLabel('Copias de Filtro de aceite reforzado').fill('2')
  await modal.getByLabel('Copias de Pastillas de freno').fill('20')
  await modal.getByRole('button', { name: 'Empezar en posición 8' }).click()
  await expect(modal.getByText('Página 1 de 2')).toBeVisible()
  await modal.getByRole('button', { name: 'Página siguiente' }).click()
  await expect(modal.getByText('Página 2 de 2')).toBeVisible()
  await expect(modal).not.toContainText(/USD|precio/i)

  await modal.getByRole('button', { name: 'Imprimir', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute(
    'data-print-called',
    'true',
  )
  await expect(modal.getByLabel('Copias de Pastillas de freno')).toHaveValue(
    '20',
  )
  await expect(
    modal.getByRole('button', { name: 'Empezar en posición 8' }),
  ).toHaveAttribute('aria-pressed', 'true')

  const pdfPath = testInfo.outputPath('etiquetas-a4-chromium.pdf')
  await page.pdf({
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    path: pdfPath,
  })
  await testInfo.attach('etiquetas-a4-chromium', {
    body: await page.pdf({ format: 'A4', printBackground: true }),
    contentType: 'application/pdf',
  })
})

test('todos los del filtro usa el lote del servidor y la ficha admite inactivos', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await mockCatalog(page)
  let requestedUrl = ''
  page.on('request', (request) => {
    if (request.url().includes('/products/label-data/'))
      requestedUrl = request.url()
  })
  await page.goto(
    '/products?search=freno&is_active=all&category_id=2&product_brand_id=1&vehicle_brand_id=9',
  )
  await page
    .getByRole('button', { name: 'Todos los del filtro actual' })
    .click()
  const modal = page.getByRole('dialog', { name: 'Imprimir etiquetas' })
  await expect(modal).toBeVisible()
  expect(requestedUrl).toContain('search=freno')
  expect(requestedUrl).toContain('is_active=all')
  expect(requestedUrl).toContain('category_id=2')
  expect(requestedUrl).not.toContain('page=')
  await modal.getByRole('button', { name: 'Cancelar' }).click()

  await page.goto('/products/102')
  await expect(page.getByText('Inactivo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Imprimir etiquetas' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Imprimir etiquetas' }),
  ).toBeVisible()
})

test('los tres roles de consulta acceden y una sesión ausente no obtiene el lote', async ({
  page,
}) => {
  for (const username of ['admin_e2e', 'vendedor_e2e', 'taller_e2e']) {
    await login(page, username)
    await mockCatalog(page)
    await page.goto('/products')
    await expect(
      page.getByRole('button', { name: 'Todos los del filtro actual' }),
    ).toBeVisible()
    await page.context().clearCookies()
  }
  const response = await page.request.get(`${API}/products/label-data/`)
  expect([401, 403]).toContain(response.status())
})

test('marca opcional, código incompatible y cinco anchos mantienen accesibilidad', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await mockCatalog(page, { incompatible: true })
  await page.goto('/products')
  await page
    .getByRole('button', { name: 'Todos los del filtro actual' })
    .click()
  const modal = page.getByRole('dialog', { name: 'Imprimir etiquetas' })
  await expect(modal.getByRole('alert')).toContainText('FILTRO-Ñ')
  await expect(
    modal.getByRole('button', { name: 'Imprimir', exact: true }),
  ).toBeDisabled()

  await modal.getByRole('button', { name: 'Cancelar' }).click()
  for (const width of REPRESENTATIVE_WIDTHS) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 900 })
    await page
      .getByRole('button', { name: 'Todos los del filtro actual' })
      .click()
    await expectAdaptableAndAccessible(page)
    await page.getByRole('button', { name: 'Cancelar' }).click()
  }
})
