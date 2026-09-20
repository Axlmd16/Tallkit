import { expect, test, type Page } from '@playwright/test'

import { login } from './helpers'

/** Estilos computados que definen la identidad visual (tokens de DESIGN.md). */
async function styleOf(page: Page, selector: string, properties: string[]) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, props) => {
      const style = getComputedStyle(element)
      return Object.fromEntries(
        props.map((name) => [name, style.getPropertyValue(name)]),
      )
    }, properties)
}

const TEXT = ['font-family', 'font-size', 'font-weight', 'color', 'line-height']
const BUTTON = [
  'background-color',
  'color',
  'border-radius',
  'min-height',
  'font-weight',
]

test('los catálogos nuevos reutilizan los tokens y componentes de la marca de vehículo', async ({
  page,
}) => {
  await login(page, 'admin_e2e')

  await page.goto('/vehicle-brands')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const reference = {
    title: await styleOf(page, 'h1', TEXT),
    primary: await styleOf(page, 'button.bg-primary', BUTTON),
    input: await styleOf(page, 'input:not([type=hidden])', [
      'background-color',
      'border-radius',
      'font-family',
      'min-height',
    ]),
    body: await styleOf(page, 'body', [
      'font-family',
      'background-color',
      'color',
    ]),
  }
  expect(reference.body['font-family']).toMatch(/Nunito/i)

  for (const [path, heading] of [
    ['/products', 'Productos'],
    ['/services', 'Servicios'],
    ['/suppliers', 'Proveedores'],
    ['/product-categories', 'Categorías de productos'],
  ] as const) {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    expect(await styleOf(page, 'h1', TEXT), `${path} título`).toEqual(
      reference.title,
    )
    expect(
      await styleOf(page, 'button.bg-primary', BUTTON),
      `${path} botón primario`,
    ).toEqual(reference.primary)
    expect(
      await styleOf(page, 'input:not([type=hidden])', [
        'background-color',
        'border-radius',
        'font-family',
        'min-height',
      ]),
      `${path} campo`,
    ).toEqual(reference.input)
    expect(
      await styleOf(page, 'body', ['font-family', 'background-color', 'color']),
    ).toEqual(reference.body)
    // Superficie de lista elevada: mismo fondo y radio que la lista de marcas.
    await expect(
      page.locator('.ui-surface, [class*="shadow-card"]').first(),
    ).toBeAttached()
  }
})

test('las etiquetas fiscales usan las variantes del sistema visual', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await page.goto('/products')
  const commercial = page.getByLabel('Ámbito fiscal: RUC comercial').first()
  await expect(commercial).toBeVisible()
  await expect(commercial).toHaveClass(/bg-primary-soft/)
  await page.goto('/services')
  await expect(
    page.getByLabel('Ámbito fiscal: RUC artesanal').first(),
  ).toHaveClass(/bg-warning-soft/)
})
