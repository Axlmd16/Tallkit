import { expect, type Page } from '@playwright/test'

export const fixturePassword = 'Prueba-segura-2026'

export async function login(
  page: Page,
  username: string,
  password = fixturePassword,
) {
  await page.goto('/login')
  await page.getByLabel('Identificación de acceso').fill(username)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(
    page.getByRole('heading', { name: 'Iniciar sesión' }),
  ).toBeVisible()
}
