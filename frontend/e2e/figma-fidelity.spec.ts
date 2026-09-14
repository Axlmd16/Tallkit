import { mkdir } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'

// Neutral, deterministic API data is confined to visual tests. Existing E2E
// tests continue to exercise Django, permissions and mutations independently.
const permissions = [
  'usuarios.ver',
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.desactivar',
  'usuarios.restablecer_clave',
  'auditoria.ver',
  'operacion.ver_estado',
]
const roles = ['ADMINISTRADOR', 'VENDEDOR', 'ENCARGADO_TALLER'] as const
const users = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  username: `cuenta_${String(index + 1).padStart(2, '0')}`,
  first_name: 'Persona',
  last_name: String(index + 1).padStart(2, '0'),
  email: `cuenta${index + 1}@example.test`,
  roles: [roles[index % 3]],
  is_active: index !== 3 && index !== 8,
}))

async function fixtures(page: Page, authenticated = true) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let json: unknown
    if (path.endsWith('/auth/session/'))
      json = {
        authenticated,
        username: authenticated ? 'cuenta_local' : null,
        roles: authenticated ? ['ADMINISTRADOR'] : [],
        permissions: authenticated ? permissions : [],
        must_change_password: false,
      }
    else if (path.endsWith('/roles/'))
      json = roles.map((code) => ({ code, permissions }))
    else if (path.endsWith('/users/'))
      json = {
        count: 10,
        page: 1,
        page_size: 20,
        total_pages: 1,
        results: users,
      }
    else if (path.endsWith('/audit/'))
      json = {
        count: 10,
        page: 1,
        page_size: 20,
        total_pages: 1,
        results: users.map((user, i) => ({
          id: i + 1,
          actor: { id: user.id, username: user.username },
          action: ['user.updated', 'login.succeeded', 'user.created'][i % 3],
          target_type: 'user',
          target_id: String(user.id),
          result: ['SUCCESS', 'SUCCESS', 'DENIED', 'FAILURE'][i % 4],
          occurred_at: `2026-09-10T${String(19 - i).padStart(2, '0')}:30:00Z`,
          reason: null,
          request_id: `revision-${i + 1}`,
          operation_id: null,
          metadata: {},
        })),
      }
    else if (path.endsWith('/auth/csrf/')) json = {}
    else if (path.endsWith('/reset-password/'))
      json = { temporary_password: 'Solo-revision-visual' }
    else {
      await route.continue()
      return
    }
    await route.fulfill({
      json,
      ...(path.endsWith('/auth/csrf/')
        ? {
            headers: {
              'set-cookie': 'csrftoken=visual-test-csrf; Path=/; SameSite=Lax',
            },
          }
        : {}),
    })
  })
}

async function capture(page: Page, name: string) {
  await expect(page.getByRole('heading').first()).toBeVisible()
  if (['/users', '/audit'].includes(new URL(page.url()).pathname)) {
    await expect(page.locator('table')).toBeAttached()
  }
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  const directory = process.env.FIGMA_EVIDENCE_DIR
  if (directory) {
    await mkdir(directory, { recursive: true })
    await page.screenshot({
      path: `${directory}/${name}.png`,
      animations: 'disabled',
    })
  }
}

test('stage1: local Nunito and complete accent palette', async ({ page }) => {
  await fixtures(page, false)
  await page.setViewportSize({ width: 1440, height: 1112 })
  await page.goto('/login')
  await capture(page, 'login')
  await expect(page.locator('body')).toHaveCSS('font-family', /Nunito/)
  const fonts = await page.evaluate(async () => {
    await Promise.all(
      [400, 600, 700, 800].map((weight) =>
        document.fonts.load(`${weight} 16px Nunito`),
      ),
    )
    await document.fonts.ready
    return [400, 600, 700, 800].every((weight) =>
      document.fonts.check(`${weight} 16px Nunito`),
    )
  })
  expect(fonts).toBe(true)
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-pink')
        .trim(),
    ),
  ).toBe('#ef37ff')
})

test('stage2: expanded dashboard sidebar and content match frame coordinates', async ({
  page,
}) => {
  await fixtures(page)
  await page.setViewportSize({ width: 1440, height: 1047 })
  await page.goto('/')
  await capture(page, 'home')
  await expect(page.locator('aside .nav-glyph').first()).not.toHaveCSS(
    'mask-image',
    'none',
  )
  const rail = await page.locator('aside').boundingBox()
  expect(rail).toMatchObject({ x: 0, y: 0, width: 218, height: 1047 })
  const main = await page.locator('main').boundingBox()
  expect(main?.x).toBe(248)
  await expect(
    page.getByRole('link', { name: 'Usuarios', exact: true }),
  ).toBeVisible()
})

test('stage3: compact controls and flat rows retain table alignment', async ({
  page,
}) => {
  await fixtures(page)
  await page.setViewportSize({ width: 1440, height: 1016 })
  await page.goto('/users')
  await capture(page, 'users-invoice')
  await expect(page.getByRole('button', { name: 'Crear usuario' })).toHaveCSS(
    'border-radius',
    '10px',
  )
  await expect(page.getByRole('button', { name: 'Crear usuario' })).toHaveCSS(
    'height',
    '40px',
  )
  await expect(page.locator('table tbody tr').nth(1)).toHaveCSS(
    'box-shadow',
    'none',
  )
})

test('stage4: dashboard preserves panel geometry without fabricated metrics', async ({
  page,
}) => {
  await fixtures(page)
  await page.setViewportSize({ width: 1440, height: 1047 })
  await page.goto('/')
  await capture(page, 'home')
  const cards = page.locator('.dashboard-stats > article')
  await expect(cards).toHaveCount(4)
  const first = await cards.first().boundingBox()
  expect(first?.y).toBe(98)
  expect(first?.height).toBe(116)
  expect(
    await page.locator('.dashboard-panels > section').first().boundingBox(),
  ).toMatchObject({ x: 248, y: 242, width: 702, height: 408 })
  await expect(
    page.getByText('Sin datos disponibles', { exact: true }).first(),
  ).toBeVisible()
})

test('stage5: user drawer matches Add Customer width and single column', async ({
  page,
}) => {
  await fixtures(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/users')
  await capture(page, 'users')
  await page.getByRole('button', { name: 'Crear usuario' }).click()
  const drawer = page.getByRole('dialog', { name: 'Nuevo usuario' })
  await capture(page, 'drawer')
  expect((await drawer.boundingBox())?.width).toBe(409)
  const first = await page.getByLabel('Nombres', { exact: true }).boundingBox()
  const last = await page.getByLabel('Apellidos', { exact: true }).boundingBox()
  expect(first?.width).toBe(349)
  expect(first?.x).toBe(last?.x)
  expect(last!.y).toBeGreaterThan(first!.y)
})

test('stage6: audit keeps dense comparable rows and accessible detail', async ({
  page,
}) => {
  await fixtures(page)
  await page.setViewportSize({ width: 1440, height: 1016 })
  await page.goto('/audit')
  await capture(page, 'audit')
  expect(
    (await page.locator('table tbody tr').first().boundingBox())?.height,
  ).toBe(70)
  expect((await page.getByRole('search').boundingBox())?.height).toBeLessThan(
    100,
  )
  await page.getByRole('button', { name: 'Ver', exact: true }).first().click()
  await expect(
    page.getByRole('dialog', { name: 'Detalle del evento' }),
  ).toBeVisible()
  await capture(page, 'audit-detail')
})

test('stage7: login and administrative recovery keep Figma proportions', async ({
  page,
}) => {
  await fixtures(page, false)
  await page.setViewportSize({ width: 1440, height: 1112 })
  await page.goto('/login')
  await capture(page, 'login')
  expect(await page.locator('.login-art-scene').boundingBox()).toMatchObject({
    x: 636,
    y: 255,
    width: 647,
    height: 602,
  })
  expect(
    (await page.getByLabel('Contraseña', { exact: true }).boundingBox())
      ?.height,
  ).toBe(50)
  expect(
    (await page.getByLabel('Contraseña', { exact: true }).boundingBox())?.width,
  ).toBe(348)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toHaveCSS(
    'font-size',
    '25px',
  )
  await expect(page.locator('.scene-clock')).toBeVisible()
  await capture(page, 'login')
  await page.unroute('**/api/v1/**')
  await fixtures(page)
  await page.goto('/users')
  await page
    .getByRole('button', { name: 'Restablecer contraseña', exact: true })
    .first()
    .click()
  await capture(page, 'recover')
  expect(
    (
      await page
        .getByRole('dialog', { name: 'Restablecer contraseña' })
        .boundingBox()
    )?.width,
  ).toBe(658)
  await page.getByRole('button', { name: 'Confirmar restablecimiento' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Credencial temporal' }),
  ).toBeVisible()
  await capture(page, 'confirm')
  expect(
    (
      await page
        .getByRole('dialog', { name: 'Credencial temporal' })
        .boundingBox()
    )?.width,
  ).toBe(726)
})

test('stage8: responsive surfaces retain content, focus and contrast', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await fixtures(page)
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/users', '/audit']) {
      await page.goto(path)
      await expect(page.locator('main h1')).toBeVisible()
      await capture(page, `${path === '/' ? 'home' : path.slice(1)}-${width}`)
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true)
      await expectNoSeriousAccessibilityViolations(page)
    }
    await page.goto('/users')
    await page.getByRole('button', { name: 'Crear usuario' }).click()
    await capture(page, `drawer-${width}`)
    await expectNoSeriousAccessibilityViolations(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('stage8: credentials remain usable on small screens and errors do not overlap', async ({
  page,
}) => {
  test.setTimeout(180_000)
  for (const width of [360, 768, 1024, 1440]) {
    await page.unroute('**/api/v1/**')
    await fixtures(page, false)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login')
    await capture(page, `login-${width}`)
    await expectNoSeriousAccessibilityViolations(page)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await capture(page, `login-error-${width}`)
    await expectNoSeriousAccessibilityViolations(page)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await page.unroute('**/api/v1/**')
    await fixtures(page)
    await page.goto('/users')
    await page
      .getByRole('button', { name: 'Restablecer contraseña', exact: true })
      .first()
      .click()
    await capture(page, `recover-${width}`)
    expect(
      (await page.getByRole('dialog').boundingBox())!.width,
    ).toBeLessThanOrEqual(width - 32)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await expectNoSeriousAccessibilityViolations(page)
    await page
      .getByRole('button', { name: 'Confirmar restablecimiento' })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Credencial temporal' }),
    ).toBeVisible()
    await capture(page, `confirm-${width}`)
    expect(
      (await page.getByRole('dialog').boundingBox())!.width,
    ).toBeLessThanOrEqual(width - 32)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await expectNoSeriousAccessibilityViolations(page)
    await page.getByRole('button', { name: 'Ya la copié' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('stage8: tablet rows remain readable and dense', async ({ page }) => {
  await fixtures(page)
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/users')
  await capture(page, 'users-tablet')
  expect(
    (await page.locator('table tbody tr').first().boundingBox())?.height,
  ).toBeLessThanOrEqual(80)
  expect(
    (await page.locator('table tbody td').nth(1).boundingBox())?.width,
  ).toBeGreaterThanOrEqual(140)
})
