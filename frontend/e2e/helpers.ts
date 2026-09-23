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

/**
 * Abre una opción de la navegación principal. Las opciones viven dentro de grupos plegables:
 * se despliegan los grupos cerrados antes de pulsar el enlace.
 */
export async function goToSection(page: Page, label: string) {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  const link = nav.getByRole('link', { name: label, exact: true })
  const collapsed = nav.locator('button[aria-expanded="false"][aria-controls]')
  // Se vuelve a consultar en cada vuelta: al desplegar un grupo la lista cambia.
  for (
    let attempt = 0;
    attempt < 8 && !(await link.isVisible());
    attempt += 1
  ) {
    if ((await collapsed.count()) === 0) break
    await collapsed.first().click()
  }
  await link.click()
}

/** Despliega todos los grupos de la navegación principal para comprobar qué opciones ofrece. */
export async function expandNavigation(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  const collapsed = nav.locator('button[aria-expanded="false"][aria-controls]')
  for (
    let attempt = 0;
    attempt < 12 && (await collapsed.count()) > 0;
    attempt += 1
  ) {
    await collapsed.first().click()
  }
}
