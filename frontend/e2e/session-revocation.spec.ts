import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('verification: invalidated session leaves open users page without reload', async ({
  page,
  browser,
}) => {
  await login(page, 'admin_e2e')
  await page.getByRole('link', { name: 'Usuarios', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: 'multirrol_e2e' })
  await row.getByRole('button', { name: 'Editar' }).click()
  await page
    .getByRole('checkbox', { name: 'Administrador', exact: true })
    .check()
  await page.getByRole('button', { name: 'Guardar usuario' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const context = await browser.newContext()
  const worker = await context.newPage()
  await login(worker, 'multirrol_e2e')
  await worker.getByRole('link', { name: 'Usuarios', exact: true }).click()
  await expect(worker.getByPlaceholder('Buscar usuario')).toBeVisible()
  await row.getByRole('button', { name: 'Editar' }).click()
  await page
    .getByRole('checkbox', { name: 'Administrador', exact: true })
    .uncheck()
  await page.getByRole('button', { name: 'Guardar usuario' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const rejected = worker.waitForResponse(
    (r) => r.url().includes('/users/') && r.status() === 403,
  )
  await worker.getByPlaceholder('Buscar usuario').fill('Ada')
  await rejected
  await expect(
    worker.getByRole('heading', { name: 'Iniciar sesión' }),
  ).toBeVisible({ timeout: 6000 })
  await context.close()
})
