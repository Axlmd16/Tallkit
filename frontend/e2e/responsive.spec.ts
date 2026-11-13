import { expect, test, type Page } from '@playwright/test'

import {
  expectAdaptableAndAccessible,
  REPRESENTATIVE_WIDTHS,
} from './accessibility'
import { send } from './catalog-helpers'
import { login } from './helpers'

let counter = 0

async function settled(page: Page) {
  await expect(page.locator('h1').first()).toBeVisible()
  await expect(page.getByText(/^Cargando/)).toHaveCount(0)
}

/** Proveedor mínimo para abrir una ficha y su diálogo de desactivación. */
async function seedSupplier(page: Page): Promise<number> {
  const tag = `${Date.now().toString(36)}${counter++}`
  const response = await send(page.request, 'post', '/suppliers/', {
    name: `Proveedor responsivo ${tag}`,
    idempotency_key: `e2e-resp-sup-${tag}`,
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const supplier = (await response.json()) as { id: number }
  await page.reload()
  return supplier.id
}

const railVariants = [
  { width: 768, railWidth: 72, labels: false },
  { width: 1024, railWidth: 72, labels: false },
  { width: 1279, railWidth: 72, labels: false },
  { width: 1280, railWidth: 264, labels: true },
  { width: 1440, railWidth: 264, labels: true },
] as const

test('en teléfono la navegación es un panel temporal que se cierra al elegir', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await login(page, 'admin_e2e')
  await expect(page.locator('.app-rail')).toBeHidden()
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  const panel = page.getByRole('dialog', { name: 'Navegación principal' })
  await expect(panel).toBeVisible()
  await expectAdaptableAndAccessible(page)
  await panel.getByRole('button', { name: 'Administración y control' }).click()
  await panel.getByRole('link', { name: 'Usuarios', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()
})

for (const variant of railVariants) {
  test(`barra lateral de ${variant.railWidth} px a ${variant.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: variant.width, height: 900 })
    await login(page, 'admin_e2e')
    const rail = page.locator('.app-rail')
    const box = await rail.boundingBox()
    expect(Math.round(box!.width)).toBe(variant.railWidth)
    const home = rail.getByRole('link', { name: 'Inicio' })
    await expect(home).toHaveAttribute('aria-current', 'page')
    if (variant.labels) await expect(home).toContainText('Inicio')
    else await expect(home).not.toContainText('Inicio')
    const main = await page
      .locator('.app-main')
      .evaluate((element) => element.getBoundingClientRect().left)
    expect(main).toBeGreaterThanOrEqual(variant.railWidth)
  })
}

test('el acceso se adapta y es accesible en los cinco anchos', async ({
  page,
}) => {
  for (const width of REPRESENTATIVE_WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login')
    await settled(page)
    await expectAdaptableAndAccessible(page)
  }
})

for (const width of REPRESENTATIVE_WIDTHS) {
  test(`pantallas representativas sin desplazamiento horizontal ni violaciones graves a ${width} px`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    await login(page, 'admin_e2e')
    const supplierId = await seedSupplier(page)

    // Inicio, lista, formulario en página y editor de venta.
    for (const path of ['/', '/sales', '/products/new', '/sales/new']) {
      await page.goto(path)
      await settled(page)
      await expectAdaptableAndAccessible(page)
    }

    // Ficha y diálogo de confirmación.
    await page.goto(`/suppliers/${supplierId}`)
    await settled(page)
    await expectAdaptableAndAccessible(page)
    await page.getByRole('button', { name: 'Desactivar' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectAdaptableAndAccessible(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Formulario corto en modal.
    await page.goto('/vehicle-brands')
    await settled(page)
    await page.getByRole('button', { name: 'Nueva marca' }).first().click()
    const modal = page.getByRole('dialog', { name: 'Nueva marca de vehículo' })
    await expect(modal).toBeVisible()
    const box = await modal.boundingBox()
    if (width < 640) expect(Math.round(box!.width)).toBe(width)
    else expect(box!.width).toBeLessThanOrEqual(520)
    await expectAdaptableAndAccessible(page)
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
  })
}

test('conserva foco y movimiento reducido con el contenido ampliado', async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  // Con la página recién cargada la primera pulsación puede llegar antes de que React pinte el formulario.
  await expect(page.getByLabel('Identificación de acceso')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Identificación de acceso')).toBeFocused()
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
  const transitionDuration = await page
    .getByRole('button', { name: 'Ingresar' })
    .evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(transitionDuration).toBe('1e-05s')
})
