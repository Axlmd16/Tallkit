import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { login } from './helpers'

const viewports = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

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
