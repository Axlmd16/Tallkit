import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { login } from './helpers'

test('captures representative visual surfaces', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: testInfo.outputPath('login.png'),
  })
  await expectNoSeriousAccessibilityViolations(page)

  await login(page, 'admin_e2e')
  for (const [name, path, heading] of [
    ['home', '/', 'Inicio'],
    ['users', '/users', 'Usuarios'],
    ['audit', '/audit', 'Auditoría'],
    ['technical-status', '/technical-status', 'Estado técnico'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    if (name === 'users') {
      await expect(page.getByRole('table', { name: 'Usuarios' })).toBeVisible()
    }
    if (name === 'audit') {
      await expect(
        page.getByRole('table', { name: 'Eventos de auditoría' }),
      ).toBeVisible()
    }
    if (name === 'technical-status') {
      await expect(
        page.getByText('Backend y PostgreSQL disponibles'),
      ).toBeVisible()
    }
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: testInfo.outputPath(`${name}.png`),
    })
    await expectNoSeriousAccessibilityViolations(page)
  }
})
