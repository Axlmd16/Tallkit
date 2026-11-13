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
  await expect(body).toHaveCSS('background-color', 'rgb(244, 243, 240)')
  await expect(body).toHaveCSS('color', 'rgb(28, 31, 35)')
  await expect(body).toHaveCSS('font-family', /Montserrat/)

  const submit = page.getByRole('button', { name: 'Ingresar' })
  await expect(submit).toHaveCSS('background-color', 'rgb(181, 88, 42)')

  const username = page.getByLabel('Identificación de acceso')
  await username.focus()
  await expect(username).toHaveCSS('border-color', 'rgb(74, 98, 128)')

  await page.keyboard.press('Tab')
  const focused = page.locator(':focus-visible')
  await expect(focused).toHaveCSS('outline-color', 'rgb(74, 98, 128)')
})

test('carga Montserrat desde la instalación, sin solicitudes externas', async ({
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
    const light = await document.fonts.load('300 16px "Montserrat"')
    const regular = await document.fonts.load('400 16px "Montserrat"')
    const bold = await document.fonts.load('700 16px "Montserrat"')
    return { light: light.length, regular: regular.length, bold: bold.length }
  })

  expect(loaded.light).toBeGreaterThan(0)
  expect(loaded.regular).toBeGreaterThan(0)
  expect(loaded.bold).toBeGreaterThan(0)
  expect(fonts.length).toBeGreaterThan(0)
  for (const url of fonts) expect(new URL(url).hostname).toBe('127.0.0.1')
  expect(external).toEqual([])
})

test('IBM Plex solo se declara para la hoja impresa y también sale de la instalación', async ({
  page,
}) => {
  const external = await blockExternalRequests(page)
  await page.goto('/login')

  const faces = await page.evaluate(async () => {
    await document.fonts.ready
    const families = new Set<string>()
    document.fonts.forEach((face) =>
      families.add(face.family.replace(/"/g, '')),
    )
    const body = getComputedStyle(document.body).fontFamily
    const mono = await document.fonts.load('500 16px "IBM Plex Mono"')
    const sans = await document.fonts.load('400 16px "IBM Plex Sans"')
    return {
      families: [...families],
      body,
      print: mono.length + sans.length,
    }
  })

  expect(faces.body).not.toMatch(/IBM Plex/)
  expect(faces.families).toEqual(
    expect.arrayContaining(['Montserrat', 'IBM Plex Sans', 'IBM Plex Mono']),
  )
  expect(faces.print).toBeGreaterThan(0)
  expect(external).toEqual([])
})

test('no activa un tema oscuro aunque el dispositivo lo prefiera', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/login')

  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(244, 243, 240)',
  )
  expect(
    await page.evaluate(() =>
      document.documentElement.hasAttribute('data-theme'),
    ),
  ).toBe(false)
  await expect(page.getByRole('button', { name: /tema/i })).toHaveCount(0)
})
