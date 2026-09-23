import { expect, test, type Page } from '@playwright/test'

import { login } from './helpers'

let counter = 0
const uniqueName = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${counter++}`

async function openNewBrand(page: Page) {
  await page.goto('/vehicle-brands')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Nueva marca' }).first().click()
  const modal = page.getByRole('dialog', { name: 'Nueva marca de vehículo' })
  await expect(modal).toBeVisible()
  return modal
}

test.describe('Notificaciones temporales y cierre de modales', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin_e2e')
  })

  test('al guardar aparece un toast sin mover el foco y la lista refleja el registro', async ({
    page,
  }) => {
    const name = uniqueName('Marca toast')
    const modal = await openNewBrand(page)
    const field = modal.getByLabel('Nombre de la marca')
    await field.fill(name)
    await modal.getByRole('button', { name: 'Guardar y crear otra' }).click()

    const toasts = page.getByRole('status', { name: 'Notificaciones' })
    await expect(toasts).toContainText(`Marca «${name}» creada.`)
    // El modal sigue abierto para crear otra: el foco vuelve al primer campo, no al toast.
    await expect(field).toHaveValue('')
    await expect(field).toBeFocused()
    expect(
      await toasts.evaluate((region) =>
        region.contains(document.activeElement),
      ),
    ).toBe(false)

    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    await expect(page.getByRole('table').first()).toContainText(name)
    // El toast desaparece solo a los 6 segundos.
    await expect(toasts).not.toContainText(name, { timeout: 9_000 })
  })

  test('cerrar un modal con cambios advierte y permite seguir editando o descartar', async ({
    page,
  }) => {
    const name = uniqueName('Marca descartada')
    const modal = await openNewBrand(page)
    const field = modal.getByLabel('Nombre de la marca')
    await field.fill(name)

    await page.keyboard.press('Escape')
    const warning = page.getByRole('dialog', {
      name: 'Hay cambios sin guardar',
    })
    await expect(warning).toBeVisible()
    await warning.getByRole('button', { name: 'Seguir editando' }).click()
    await expect(warning).toHaveCount(0)
    await expect(field).toHaveValue(name)

    await modal.getByRole('button', { name: 'Cancelar' }).click()
    await expect(warning).toBeVisible()
    await warning.getByRole('button', { name: 'Descartar' }).click()
    await expect(modal).toHaveCount(0)
    await expect(page.getByText(name)).toHaveCount(0)
    await expect(
      page.getByRole('status', { name: 'Notificaciones' }),
    ).not.toContainText(name)
  })
})
