import { expect, test, type Page } from '@playwright/test'

import { expectAdaptableAndAccessible } from './accessibility'
import { seedFiscalConfiguration, send } from './catalog-helpers'
import { login } from './helpers'

async function seedCustomer(page: Page, suffix: string) {
  const response = await send(page.request, 'post', '/customers/', {
    person_type: 'NATURAL',
    identification_type: 'CI',
    identification: `09123${suffix}`,
    name: `Cliente Navegacion ${suffix}`,
    phone: '0991112233',
    idempotency_key: `e2e-nav-cust-${suffix}`,
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as { id: number; name: string }
}

test.describe('navegación diaria y lenguaje visible (U4)', () => {
  test('menú de nueve entradas adaptable a 360, 768, 1024 y 1440 px con área táctil >= 44 px y teclado', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page, 'admin_e2e')

    for (const width of [1440, 1024, 768] as const) {
      await page.setViewportSize({ width, height: 900 })
      const nav = page.getByRole('navigation', { name: 'Navegación principal' })
      await expect(nav).toBeVisible()
      // Sin grupos plegables.
      await expect(nav.locator('button[aria-expanded]')).toHaveCount(0)

      const links = nav.getByRole('link')
      await expect(links).toHaveCount(9)
      for (const link of await links.all()) {
        const box = await link.boundingBox()
        expect(box, `altura táctil a ${width} px`).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      await expectAdaptableAndAccessible(page)
    }

    // Navegación por teclado en escritorio (foco + Enter).
    await page.setViewportSize({ width: 1440, height: 900 })
    const nav = page.getByRole('navigation', { name: 'Navegación principal' })
    const clientesLink = nav.getByRole('link', {
      name: 'Clientes',
      exact: true,
    })
    await clientesLink.focus()
    await expect(clientesLink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/customers$/)
    await expect(clientesLink).toHaveAttribute('aria-current', 'page')

    // En teléfono (360 px): panel temporal con 9 entradas, >= 44 px y cierre con Escape.
    await page.setViewportSize({ width: 360, height: 800 })
    const menuButton = page.getByRole('button', { name: 'Abrir navegación' })
    const btnBox = await menuButton.boundingBox()
    expect(btnBox!.height).toBeGreaterThanOrEqual(44)
    expect(btnBox!.width).toBeGreaterThanOrEqual(44)

    await menuButton.click()
    const drawer = page.getByRole('dialog', { name: 'Navegación principal' })
    await expect(drawer).toBeVisible()
    const mobileLinks = drawer.getByRole('link')
    await expect(mobileLinks).toHaveCount(9)
    for (const link of await mobileLinks.all()) {
      const box = await link.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    await expectAdaptableAndAccessible(page)
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
  })

  test('recorrido menú → ficha del cliente → cuentas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page, 'admin_e2e')
    await seedFiscalConfiguration(page)

    const suffix = String(Date.now()).slice(-5)
    const customer = await seedCustomer(page, suffix)

    // 1. Menú → Clientes → Ficha del cliente
    const nav = page.getByRole('navigation', { name: 'Navegación principal' })
    await nav.getByRole('link', { name: 'Clientes', exact: true }).click()
    await expect(page).toHaveURL(/\/customers$/)

    await page.goto(`/customers/${customer.id}`)
    await expect(
      page.getByRole('heading', { level: 1, name: customer.name }),
    ).toBeVisible()
    // No muestra «Versión de registro» en la ficha.
    await expect(page.getByText('Versión de registro')).toHaveCount(0)

    // Recorre las 4 pestañas de la ficha sin fijar etiquetas exactas.
    const tabs = page.getByRole('tablist').getByRole('tab')
    await expect(tabs).toHaveCount(4)
    for (const tab of await tabs.all()) {
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
    }

    // 2. Menú → Cuentas (tarjetas por negocio y segmentos Por cobrar / Retenciones)
    await nav.getByRole('link', { name: 'Cuentas', exact: true }).click()
    await expect(page).toHaveURL(/\/sales\/receivables$/)
    await expect(
      nav.getByRole('link', { name: 'Cuentas', exact: true }),
    ).toHaveAttribute('aria-current', 'page')

    // Cambia al segundo nivel «Retenciones» dentro del negocio comercial.
    await page.getByRole('radio', { name: 'Retenciones' }).click()
    await expect(page).toHaveURL(/\/sales\/withholdings$/)

    // Cambia a la tarjeta del negocio artesanal (nombre del negocio, sin «RUC artesanal»).
    await page.getByRole('link', { name: /Artesanal E2E/ }).click()
    await expect(page).toHaveURL(/\/maintenance\/withholdings$/)
    await page.getByRole('radio', { name: 'Por cobrar' }).click()
    await expect(page).toHaveURL(/\/maintenance\/receivables$/)
    await expect(
      nav.getByRole('link', { name: 'Cuentas', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
  })
})
