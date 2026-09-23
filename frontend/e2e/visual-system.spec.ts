import { expect, test, type Page } from '@playwright/test'

/** Bloquea todo lo que no sirve la instalación local y registra los intentos. */
async function blockExternalRequests(page: Page) {
  const external: string[] = []
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url())
    if (['127.0.0.1', 'localhost'].includes(hostname)) return route.continue()
    external.push(route.request().url())
    return route.abort()
  })
  return external
}

test('aplica los tokens Tallkit a lienzo, tipografía, acción principal y foco', async ({
  page,
}) => {
  await page.goto('/login')

  const body = page.locator('body')
  await expect(body).toHaveCSS('background-color', 'rgb(243, 244, 246)')
  await expect(body).toHaveCSS('color', 'rgb(21, 35, 58)')
  await expect(body).toHaveCSS('font-family', /IBM Plex Sans/)

  const submit = page.getByRole('button', { name: 'Ingresar' })
  await expect(submit).toHaveCSS('background-color', 'rgb(34, 67, 104)')

  const username = page.getByLabel('Identificación de acceso')
  await username.focus()
  await expect(username).toHaveCSS('border-color', 'rgb(15, 107, 111)')

  await page.keyboard.press('Tab')
  const focused = page.locator(':focus-visible')
  await expect(focused).toHaveCSS('outline-color', 'rgb(15, 107, 111)')
})

test('carga IBM Plex Sans y Mono desde la instalación, sin solicitudes externas', async ({
  page,
}) => {
  const external = await blockExternalRequests(page)
  const fonts: string[] = []
  page.on('requestfinished', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url())
  })

  await page.goto('/login')
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    const sans = await document.fonts.load('400 16px "IBM Plex Sans"')
    const mono = await document.fonts.load('500 16px "IBM Plex Mono"')
    return { sans: sans.length, mono: mono.length }
  })

  expect(loaded.sans).toBeGreaterThan(0)
  expect(loaded.mono).toBeGreaterThan(0)
  expect(fonts.length).toBeGreaterThan(0)
  for (const url of fonts) expect(new URL(url).hostname).toBe('127.0.0.1')
  expect(external).toEqual([])
})

test('no activa un tema oscuro aunque el dispositivo lo prefiera', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/login')

  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(243, 244, 246)',
  )
  expect(
    await page.evaluate(() =>
      document.documentElement.hasAttribute('data-theme'),
    ),
  ).toBe(false)
  await expect(page.getByRole('button', { name: /tema/i })).toHaveCount(0)
})
