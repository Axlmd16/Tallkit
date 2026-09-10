import { expect, test } from '@playwright/test'

import { fixturePassword, login, logout } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page, 'admin_e2e')
  await page.getByRole('link', { name: 'Usuarios' }).click()
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()
})

test('creates, edits, combines roles, deactivates and reactivates a user', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Crear usuario' }).click()
  await page.getByLabel('Identificación de acceso').fill('nuevo_e2e')
  await page.getByLabel('Nombres').fill('Nuevo')
  await page.getByRole('checkbox', { name: 'Vendedor' }).check()
  await page.getByRole('button', { name: 'Guardar usuario' }).click()

  let row = page.getByRole('row').filter({ hasText: 'nuevo_e2e' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('checkbox', { name: 'Encargado del taller' }).check()
  await page.getByRole('button', { name: 'Guardar usuario' }).click()
  row = page.getByRole('row').filter({ hasText: 'nuevo_e2e' })
  await expect(row).toContainText('Vendedor')
  await expect(row).toContainText('Encargado del taller')

  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Desactivar' }).click()
  await expect(row).toContainText('Inactivo')
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Activar' }).click()
  await expect(row).toContainText('Activo')
})

test('rejects deactivation of the last active administrator', async ({
  page,
}) => {
  const row = page.getByRole('row').filter({ hasText: 'admin_e2e' })
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Desactivar' }).click()
  await expect(page.getByRole('status')).toContainText(
    'No se puede desactivar el último Administrador activo.',
  )
})

test('invalidates another active session after reducing its roles', async ({
  browser,
  page,
}) => {
  const workerContext = await browser.newContext()
  const workerPage = await workerContext.newPage()
  await login(workerPage, 'multirrol_e2e')

  const row = page.getByRole('row').filter({ hasText: 'multirrol_e2e' })
  await row.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('checkbox', { name: 'Vendedor' }).uncheck()
  await page.getByRole('button', { name: 'Guardar usuario' }).click()

  await workerPage.reload()
  await expect(
    workerPage.getByRole('heading', { name: 'Iniciar sesión' }),
  ).toBeVisible()
  await workerContext.close()
})

test('shows a temporary credential once and forces its replacement', async ({
  page,
}) => {
  const row = page.getByRole('row').filter({ hasText: 'vendedor_e2e' })
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Restablecer contraseña' }).click()
  const dialog = page.getByRole('dialog')
  const temporary = (await dialog.locator('code').textContent()) ?? ''
  expect(temporary).not.toBe('')
  await dialog.getByRole('button', { name: 'Ya la copié' }).click()
  await expect(dialog).toHaveCount(0)
  await logout(page)

  await page.getByLabel('Identificación de acceso').fill('vendedor_e2e')
  await page.getByLabel('Contraseña').fill(temporary)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Cambiar contraseña' }),
  ).toBeVisible()
  await page.getByLabel('Contraseña actual').fill(temporary)
  await page
    .getByLabel('Nueva contraseña', { exact: true })
    .fill(fixturePassword)
  await page.getByLabel('Confirmar nueva contraseña').fill(fixturePassword)
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
})
