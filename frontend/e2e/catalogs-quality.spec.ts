import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { API, seedFiscalConfiguration, send } from './catalog-helpers'
import { expandNavigation, login } from './helpers'

const viewports = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

const pages = [
  { path: '/products', heading: 'Productos' },
  { path: '/services', heading: 'Servicios' },
  { path: '/suppliers', heading: 'Proveedores' },
  { path: '/product-categories', heading: 'Categorías de productos' },
  { path: '/measurement-units', heading: 'Unidades de medida' },
  { path: '/product-brands', heading: 'Marcas de producto' },
] as const

const LONG_WORDS = Array.from({ length: 30 }, (_, i) => `palabra${i}`)
  .join(' ')
  .slice(0, 250)
const LONG_UNBROKEN = 'X'.repeat(250)

test.describe.configure({ mode: 'serial', timeout: 120_000 })

async function seedRecords(page: Page) {
  await seedFiscalConfiguration(page)
  const tax = async (kind: 'products' | 'services') =>
    (await (await page.request.get(`${API}/${kind}/tax-options/`)).json())
      .results[0].id as number
  const stamp = Date.now()
  const category = await (
    await send(page.request, 'post', '/product-categories/', {
      name: `Categoría ${LONG_WORDS}`.slice(0, 255),
      idempotency_key: `q-cat-${stamp}`,
    })
  ).json()
  const unit = await (
    await send(page.request, 'post', '/measurement-units/', {
      name: `Unidad ${stamp}`,
      idempotency_key: `q-uni-${stamp}`,
    })
  ).json()
  for (const [suffix, name] of [
    ['a', LONG_WORDS],
    ['b', LONG_UNBROKEN],
  ] as const) {
    await send(page.request, 'post', '/product-brands/', {
      name: `${suffix}-${name}`.slice(0, 255),
      idempotency_key: `q-brd-${suffix}-${stamp}`,
    })
    await send(page.request, 'post', '/products/', {
      code: `Q-${suffix}-${stamp}`,
      name,
      category_id: category.id,
      unit_id: unit.id,
      tax_definition_id: await tax('products'),
      content_quantity: '1',
      sale_price: '1.00',
      idempotency_key: `q-prd-${suffix}-${stamp}`,
    })
    await send(page.request, 'post', '/services/', {
      name,
      reference_price: '1.00',
      tax_definition_id: await tax('services'),
      idempotency_key: `q-srv-${suffix}-${stamp}`,
    })
    await send(page.request, 'post', '/suppliers/', {
      name,
      email: `${'a'.repeat(60)}@${'b'.repeat(60)}.example`,
      address: LONG_UNBROKEN,
      idempotency_key: `q-sup-${suffix}-${stamp}`,
    })
  }
  await page.reload()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(
    overflow,
    'desbordamiento horizontal de la página',
  ).toBeLessThanOrEqual(0)
}

async function expectTouchTargets(
  page: Page,
  scope = page.locator('main, [role="dialog"]'),
) {
  const small = await scope
    .locator('button:visible, a:visible, select:visible, input:visible')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const type = (element as HTMLInputElement).type
          return type !== 'checkbox' && type !== 'radio' && type !== 'hidden'
        })
        .map((element) => {
          const box = element.getBoundingClientRect()
          return {
            label: (
              element.textContent ||
              element.getAttribute('aria-label') ||
              ''
            )
              .trim()
              .slice(0, 40),
            height: Math.round(box.height),
            width: Math.round(box.width),
          }
        })
        .filter(({ height, width }) => height < 40 && width < 40),
    )
  expect(small, 'controles táctiles menores de 40 px').toEqual([])
}

function evidencePath(
  testInfo: { outputPath: (name: string) => string },
  name: string,
) {
  return process.env.CATALOG_EVIDENCE_DIR
    ? path.join(process.env.CATALOG_EVIDENCE_DIR, 'actual', name)
    : testInfo.outputPath(name)
}

test('sin desbordamiento, con axe y controles táctiles en los cuatro anchos, con textos largos', async ({
  page,
}, testInfo) => {
  await login(page, 'admin_e2e')
  await seedRecords(page)
  for (const viewport of viewports) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    })
    for (const target of pages) {
      await page.goto(target.path)
      await expect(
        page.getByRole('heading', { name: target.heading, exact: true }),
      ).toBeVisible()
      await expect(page.getByRole('status').first()).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectNoSeriousAccessibilityViolations(page)
      if (viewport.width === 360) await expectTouchTargets(page)
      await page.screenshot({
        animations: 'disabled',
        fullPage: true,
        path: evidencePath(
          testInfo,
          `${target.path.slice(1)}-${viewport.width}.png`,
        ),
      })
    }
  }
})

test('los formularios no desbordan y cumplen axe en 360 y 1024, con textos largos', async ({
  page,
}, testInfo) => {
  await login(page, 'admin_e2e')
  for (const width of [360, 1024]) {
    await page.setViewportSize({ width, height: 800 })
    // Producto y proveedor usan página completa; servicio y categoría, un modal.
    for (const [route, button, form] of [
      ['/products', 'Nuevo producto', 'page'],
      ['/services', 'Nuevo servicio', 'Nuevo servicio'],
      ['/suppliers', 'Nuevo proveedor', 'page'],
      ['/product-categories', 'Nueva categoría', 'Nueva categoría'],
    ] as const) {
      await page.goto(route)
      await page.getByRole('button', { name: button }).first().click()
      const scope =
        form === 'page'
          ? page.getByRole('main')
          : page.getByRole('dialog', { name: form })
      if (form === 'page') await expect(page).toHaveURL(/\/new$/)
      await expect(scope).toBeVisible()
      await scope
        .getByLabel(/^Nombre/)
        .first()
        .fill(LONG_UNBROKEN)
      await expectNoHorizontalOverflow(page)
      await expectNoSeriousAccessibilityViolations(page)
      await expectTouchTargets(page, scope)
      await page.screenshot({
        animations: 'disabled',
        path: evidencePath(testInfo, `form-${route.slice(1)}-${width}.png`),
      })
      await scope.getByRole('button', { name: 'Cancelar' }).click()
      const discard = page.getByRole('button', { name: 'Descartar' })
      if (await discard.isVisible()) await discard.click()
      await expect(page).toHaveURL(new RegExp(`${route}$`))
    }
  }
})

test('se opera con teclado y el foco vuelve al control que abrió el modal', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  await page.goto('/services')
  const trigger = page.getByRole('button', { name: 'Nuevo servicio' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const modal = page.getByRole('dialog', { name: 'Nuevo servicio' })
  await expect(modal).toBeVisible()
  expect(
    await modal.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true)

  // El foco queda atrapado en el modal.
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab')
    expect(
      await modal.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(modal).not.toBeVisible()
  await expect(trigger).toBeFocused()

  // Con cambios sin guardar, Escape solicita confirmación y conserva lo escrito.
  await page.keyboard.press('Enter')
  await modal
    .getByLabel(/^Nombre/)
    .first()
    .fill('BORRADOR')
  // Una persona no pulsa Escape en el mismo cuadro en que termina de escribir: se deja
  // pintar el estado «con cambios» antes de cerrar.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  )
  await page.keyboard.press('Escape')
  const warning = page.getByRole('dialog', { name: 'Hay cambios sin guardar' })
  await expect(warning).toBeVisible()
  await warning.getByRole('button', { name: 'Seguir editando' }).click()
  await expect(modal.getByLabel(/^Nombre/).first()).toHaveValue('BORRADOR')
})

test('la navegación cambia de variante entre 1279 y 1280 con las entradas nuevas alcanzables', async ({
  page,
}) => {
  await login(page, 'admin_e2e')
  for (const [width, expanded] of [
    [1279, false],
    [1280, true],
  ] as const) {
    await page.setViewportSize({ width, height: 720 })
    await page.goto('/')
    const rail = page.locator('.app-rail')
    expect(Math.round((await rail.boundingBox())!.width)).toBe(
      expanded ? 240 : 72,
    )
    if (expanded) {
      await expandNavigation(page)
      for (const name of [
        'Productos',
        'Servicios',
        'Proveedores',
        'Marcas de vehículo',
      ]) {
        await expect(rail.getByRole('link', { name })).toBeAttached()
      }
    } else {
      // En modo compacto cada área es un icono con nombre accesible.
      await expect(
        rail.getByRole('button', { name: 'Catálogos' }),
      ).toBeVisible()
    }
    // El cierre de sesión sigue alcanzable aunque la navegación sea larga.
    await rail
      .getByRole('button', { name: 'Cerrar sesión' })
      .scrollIntoViewIfNeeded()
    await expect(
      rail.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInViewport()
  }
})
