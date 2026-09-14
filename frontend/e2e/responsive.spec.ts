import path from 'node:path'

import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { login } from './helpers'

const viewports = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

const navigationVariants = [
  { width: 768, expectedWidth: 80, expectedLeft: 30, labelsVisible: false },
  { width: 1024, expectedWidth: 80, expectedLeft: 30, labelsVisible: false },
  { width: 1279, expectedWidth: 80, expectedLeft: 30, labelsVisible: false },
  { width: 1280, expectedWidth: 218, expectedLeft: 0, labelsVisible: true },
  { width: 1366, expectedWidth: 218, expectedLeft: 0, labelsVisible: true },
  { width: 1440, expectedWidth: 218, expectedLeft: 0, labelsVisible: true },
] as const

test('sidebar uses the approved navigation variant at 360px', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await login(page, 'admin_e2e')
  await expect(page.locator('.app-rail')).toBeHidden()
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Navegación principal' }),
  ).toBeVisible()
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: process.env.CATALOG_EVIDENCE_DIR
      ? path.join(process.env.CATALOG_EVIDENCE_DIR, 'actual', 'sidebar-360.png')
      : testInfo.outputPath('sidebar-360.png'),
  })
})

for (const variant of navigationVariants) {
  test(`sidebar uses the approved navigation variant at ${variant.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: variant.width, height: 900 })
    await login(page, 'admin_e2e')

    const sidebar = page.locator('.app-rail')
    const box = await sidebar.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box!.width)).toBe(variant.expectedWidth)
    expect(Math.round(box!.x)).toBe(variant.expectedLeft)

    const homeLabel = sidebar
      .getByRole('link', { name: 'Inicio' })
      .getByText('Inicio')
    await expect(homeLabel).toHaveCSS(
      'position',
      variant.labelsVisible ? 'static' : 'absolute',
    )

    const contentLeft = await page
      .locator('.app-main')
      .evaluate((element) => element.getBoundingClientRect().left)
    expect(contentLeft).toBeGreaterThanOrEqual(
      variant.labelsVisible ? 248 : 140,
    )
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: process.env.CATALOG_EVIDENCE_DIR
        ? path.join(
            process.env.CATALOG_EVIDENCE_DIR,
            'actual',
            `sidebar-${variant.width}.png`,
          )
        : testInfo.outputPath(`sidebar-${variant.width}.png`),
    })
  })
}

for (const viewport of viewports) {
  test(`authorized navigation adapts without page overflow: ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await login(page, 'admin_e2e')

    if (viewport.width < 768) {
      await page.getByRole('button', { name: 'Abrir navegación' }).click()
      const dialog = page.getByRole('dialog', { name: 'Navegación principal' })
      await dialog.getByRole('link', { name: 'Usuarios' }).click()
      await expect(dialog).toHaveCount(0)
    } else {
      await page.getByRole('link', { name: 'Usuarios', exact: true }).click()
    }

    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()
    if (viewport.width < 768) {
      await expect(
        page.getByRole('list', { name: 'Usuarios en pantalla estrecha' }),
      ).toBeVisible()
    } else {
      await expect(page.getByRole('table', { name: 'Usuarios' })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Crear usuario' }).click()
    const userDrawer = page.getByRole('dialog', { name: 'Nuevo usuario' })
    await expect(userDrawer).toBeVisible()
    const drawerBox = await userDrawer.boundingBox()
    expect(drawerBox).not.toBeNull()
    if (viewport.width < 768) {
      expect(drawerBox!.width).toBe(viewport.width)
    } else {
      expect(drawerBox!.width).toBeLessThan(viewport.width)
    }
    await page.keyboard.press('Escape')
    await expect(userDrawer).toHaveCount(0)

    const hasHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)
    await expectNoSeriousAccessibilityViolations(page)
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: testInfo.outputPath(`users-${viewport.name}.png`),
    })
  })
}

test('keeps keyboard focus and reduced motion usable at enlarged content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
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

for (const viewport of viewports) {
  test(`customers, brands and vehicles adapt without page overflow: ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    await page.setViewportSize(viewport)
    await login(page, 'admin_e2e')

    const navigateTo = async (name: string) => {
      if (viewport.width < 768) {
        await page.getByRole('button', { name: 'Abrir navegación' }).click()
        const dialog = page.getByRole('dialog', {
          name: 'Navegación principal',
        })
        await dialog.getByRole('link', { name, exact: true }).click()
        await expect(dialog).toHaveCount(0)
      } else {
        await page.getByRole('link', { name, exact: true }).click()
      }
    }

    const checkOverflow = async () => {
      const hasHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      )
      expect(hasHorizontalOverflow).toBe(false)
    }

    // 1. Clientes
    await navigateTo('Clientes')
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
    await checkOverflow()
    await page.getByRole('button', { name: 'Nuevo cliente' }).first().click()
    const customerDrawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await expect(customerDrawer).toBeVisible()
    await checkOverflow()
    await page.keyboard.press('Escape')
    await expect(customerDrawer).not.toBeVisible()

    // 2. Marcas
    await navigateTo('Marcas')
    await expect(
      page.getByRole('heading', { name: 'Marcas', exact: true }),
    ).toBeVisible()
    await checkOverflow()
    await page.getByRole('button', { name: 'Nueva marca' }).first().click()
    const brandDrawer = page.getByRole('dialog', { name: 'Nueva marca' })
    await expect(brandDrawer).toBeVisible()
    await checkOverflow()
    await page.keyboard.press('Escape')
    await expect(brandDrawer).not.toBeVisible()

    // 3. Vehículos
    await navigateTo('Vehículos')
    await expect(page.getByRole('heading', { name: 'Vehículos' })).toBeVisible()
    await checkOverflow()
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    const vehicleDrawer = page.getByRole('dialog', {
      name: 'Registrar vehículo',
    })
    await expect(vehicleDrawer).toBeVisible()
    await checkOverflow()
    await page.keyboard.press('Escape')
    await expect(vehicleDrawer).not.toBeVisible()

    await expectNoSeriousAccessibilityViolations(page)
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: testInfo.outputPath(`registry-${viewport.name}.png`),
    })
  })
}

test('vehicle transfer adapts to narrow 360px viewport without overflow', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 360, height: 800 })
  await login(page, 'admin_e2e')

  // Navigate to Clientes and ensure at least one customer exists
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  let navDialog = page.getByRole('dialog', { name: 'Navegación principal' })
  await navDialog.getByRole('link', { name: 'Clientes', exact: true }).click()
  await expect(navDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  const customerDrawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
  await customerDrawer
    .getByLabel('Nombres y apellidos')
    .fill('Dueño Transferencia')
  await customerDrawer.getByLabel('Número de identificación').fill('0912345678')
  await customerDrawer.getByLabel('Teléfono').fill('0987654321')
  await customerDrawer.getByRole('button', { name: 'Guardar cliente' }).click()
  await expect(customerDrawer).not.toBeVisible()

  // Ensure brand exists
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  navDialog = page.getByRole('dialog', { name: 'Navegación principal' })
  await navDialog.getByRole('link', { name: 'Marcas', exact: true }).click()
  await expect(navDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Nueva marca' }).click()
  const brandDrawer = page.getByRole('dialog', { name: 'Nueva marca' })
  await brandDrawer.getByLabel('Nombre de la marca').fill('Nissan Responsive')
  await brandDrawer.getByRole('button', { name: 'Guardar marca' }).click()
  await expect(brandDrawer).not.toBeVisible()

  // Create vehicle
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  navDialog = page.getByRole('dialog', { name: 'Navegación principal' })
  await navDialog.getByRole('link', { name: 'Vehículos', exact: true }).click()
  await expect(navDialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Registrar vehículo' }).first().click()
  const vehicleDrawer = page.getByRole('dialog', {
    name: 'Registrar vehículo',
  })
  await vehicleDrawer
    .getByLabel('Propietario')
    .selectOption({ label: 'Dueño Transferencia (0912345678)' })
  await vehicleDrawer
    .getByLabel('Marca de vehículo')
    .selectOption({ label: 'Nissan Responsive' })
  await vehicleDrawer.getByLabel('Placa').fill('PBX-9988')
  await vehicleDrawer.getByLabel('Modelo').fill('Sentra')
  await vehicleDrawer.getByRole('button', { name: 'Guardar vehículo' }).click()
  await expect(vehicleDrawer).not.toBeVisible()

  // Open vehicle detail
  const vehicleRow = page
    .getByRole('listitem')
    .filter({ hasText: 'PBX-9988' })
    .or(page.getByRole('row').filter({ hasText: 'PBX-9988' }))
  await vehicleRow.getByRole('link', { name: 'Ver ficha' }).click()
  await expect(page.getByRole('heading', { name: 'PBX-9988' })).toBeVisible()

  // Open transfer dialog
  await page.getByRole('button', { name: 'Cambiar propietario' }).click()
  const transferDialog = page.getByRole('dialog', {
    name: 'Cambiar propietario',
  })
  await expect(transferDialog).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
  await expectNoSeriousAccessibilityViolations(page)

  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('vehicle-transfer-360px.png'),
  })

  await page.keyboard.press('Escape')
  await expect(transferDialog).not.toBeVisible()
})
