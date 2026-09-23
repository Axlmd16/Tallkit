import { expect, test, type Page } from '@playwright/test'

import { API, csrf, seedFiscalConfiguration, send } from './catalog-helpers'
import { expandNavigation, goToSection, login } from './helpers'

async function createAuxiliary(
  page: Page,
  path: string,
  heading: string,
  button: string,
  save: string,
  name: string,
) {
  await page.goto(path)
  await expect(
    page.getByRole('heading', { name: heading, exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: button }).click()
  const drawer = page.getByRole('dialog', { name: button })
  await drawer.getByLabel('Nombre').fill(name)
  await drawer.getByRole('button', { name: save }).click()
  await expect(drawer).not.toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible()
}

test.describe.configure({ mode: 'serial', timeout: 90_000 })

test.describe('catálogos de productos, servicios y proveedores', () => {
  test('el Administrador completa los ciclos principales de auxiliares, productos y proveedores', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    await seedFiscalConfiguration(page)

    await createAuxiliary(
      page,
      '/product-categories',
      'Categorías de productos',
      'Nueva categoría',
      'Guardar categoría',
      'Lubricantes E2E',
    )
    await createAuxiliary(
      page,
      '/measurement-units',
      'Unidades de medida',
      'Nueva unidad de medida',
      'Guardar unidad de medida',
      'Galón E2E',
    )
    await createAuxiliary(
      page,
      '/product-brands',
      'Marcas de producto',
      'Nueva marca de producto',
      'Guardar marca de producto',
      'Castrol E2E',
    )

    // Un nombre duplicado se rechaza sin cerrar el formulario y conserva lo escrito.
    await page.goto('/product-categories')
    await page.getByRole('button', { name: 'Nueva categoría' }).click()
    const dup = page.getByRole('dialog', { name: 'Nueva categoría' })
    await dup.getByLabel('Nombre').fill('  lubricantes e2e ')
    await dup.getByRole('button', { name: 'Guardar categoría' }).click()
    await expect(dup.getByRole('alert')).toBeVisible()
    await expect(dup.getByLabel('Nombre')).toHaveValue('  lubricantes e2e ')
    await dup.getByRole('button', { name: 'Cancelar' }).click()

    // Alta de producto con importe exacto.
    await page.goto('/products')
    await page.getByRole('button', { name: 'Nuevo producto' }).click()
    // Producto usa página completa: su formulario tiene secciones (PPF-03).
    await expect(page).toHaveURL(/\/products\/new$/)
    const form = page.locator('main')
    await form.getByLabel('Código interno', { exact: true }).fill('ace-e2e')
    await form
      .getByLabel('Código del fabricante', { exact: true })
      .fill('bp-e2e-500')
    await form.getByLabel('Nombre', { exact: true }).fill('Aceite 20W50 E2E')
    await form.getByLabel('Contenido').fill('0.500000')
    await form
      .getByLabel('Unidad de medida')
      .selectOption({ label: 'Galón E2E' })
    await form
      .getByLabel('Categoría', { exact: true })
      .selectOption({ label: 'Lubricantes E2E' })
    await form
      .getByLabel('Marca de producto (opcional)')
      .selectOption({ label: 'Castrol E2E' })
    await form.getByLabel('Precio final (USD)').fill('10.999')
    await form.getByLabel('Impuesto (RUC comercial)').selectOption({ index: 1 })
    await form.getByRole('button', { name: 'Guardar producto' }).click()
    await expect(form.getByText(/hasta 12 enteros y 2 decimales/)).toBeVisible()
    await expect(form.getByLabel('Precio final (USD)')).toHaveValue('10.999')
    await form.getByLabel('Precio final (USD)').fill('10.50')
    await form.getByRole('button', { name: 'Guardar producto' }).click()
    await expect(page).toHaveURL(/\/products\/\d+$/)
    await expect(
      page.getByText(/Producto «Aceite 20W50 E2E» creado/),
    ).toBeVisible()
    await page.goto('/products')

    const row = page.getByRole('row').filter({ hasText: 'ACE-E2E' })
    await expect(row).toContainText('Aceite 20W50 E2E')
    await expect(row).toContainText('BP-E2E-500')
    await expect(row).toContainText('USD 10.50')
    await expect(row).toContainText('Lubricantes E2E')
    await expect(
      page.getByRole('table', { name: 'Productos' }),
    ).not.toContainText(/stock|existencia|costo/i)

    // Búsqueda por código y nombre, y filtro por estado.
    await page
      .getByLabel('Buscar por código, código del fabricante o nombre')
      .fill('aceite')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: 'ACE-E2E' }),
    ).toBeVisible()
    await page
      .getByLabel('Buscar por código, código del fabricante o nombre')
      .fill('ace-e2e')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: 'ACE-E2E' }),
    ).toBeVisible()
    await page
      .getByLabel('Buscar por código, código del fabricante o nombre')
      .fill('bp-e2e-500')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: 'ACE-E2E' }),
    ).toBeVisible()

    // Baja y reactivación conservando identidad.
    await page
      .getByRole('row')
      .filter({ hasText: 'ACE-E2E' })
      .getByRole('button', { name: 'Acciones de ACE-E2E' })
      .click()
    await page.getByRole('menuitem', { name: 'Desactivar' }).click()
    await page
      .getByRole('dialog', { name: 'Desactivar producto' })
      .getByRole('button', { name: 'Confirmar desactivación' })
      .click()
    await expect(
      page.getByRole('row').filter({ hasText: 'ACE-E2E' }),
    ).toHaveCount(0)
    await page.getByLabel('Estado', { exact: true }).selectOption('false')
    const inactive = page.getByRole('row').filter({ hasText: 'ACE-E2E' })
    await expect(inactive).toContainText('Inactivo')
    await inactive.getByRole('button', { name: 'Acciones de ACE-E2E' }).click()
    await page.getByRole('menuitem', { name: 'Reactivar' }).click()
    await page
      .getByRole('dialog', { name: 'Reactivar producto' })
      .getByRole('button', { name: 'Confirmar reactivación' })
      .click()
    await page.getByLabel('Estado', { exact: true }).selectOption('all')
    await expect(
      page.getByRole('row').filter({ hasText: 'ACE-E2E' }),
    ).toContainText('Activo')

    // Proveedor sin documento ni contacto y proveedor con cédula (formulario en página).
    const newSupplier = async () => {
      await page.goto('/suppliers')
      await page.getByRole('button', { name: 'Nuevo proveedor' }).click()
      await expect(page).toHaveURL(/\/suppliers\/new$/)
      return page.getByRole('main')
    }
    let supplier = await newSupplier()
    await supplier
      .getByLabel('Nombre o razón social')
      .fill('Juan Ocasional E2E')
    await supplier.getByRole('button', { name: 'Guardar proveedor' }).click()
    await expect(page).toHaveURL(/\/suppliers\/\d+$/)
    await page.goto('/suppliers')
    await expect(
      page.getByRole('row').filter({ hasText: 'Juan Ocasional E2E' }),
    ).toBeVisible()

    supplier = await newSupplier()
    await supplier
      .getByLabel('Nombre o razón social')
      .fill('Juan Ocasional E2E')
    await expect(
      supplier.getByText(/Ya existen proveedores con ese nombre/),
    ).toBeVisible()
    await supplier.getByLabel('Tipo de identificación').selectOption('CI')
    await supplier.getByLabel('Número de identificación').fill('0912345678')
    await supplier.getByRole('button', { name: 'Guardar proveedor' }).click()
    await expect(page).toHaveURL(/\/suppliers\/\d+$/)
    await page.goto('/suppliers')
    await expect(
      page.getByRole('row').filter({ hasText: 'CI 0912345678' }),
    ).toBeVisible()

    supplier = await newSupplier()
    await supplier.getByLabel('Nombre o razón social').fill('Otro nombre')
    await supplier.getByLabel('Tipo de identificación').selectOption('CI')
    await supplier.getByLabel('Número de identificación').fill('0912345678')
    await supplier.getByRole('button', { name: 'Guardar proveedor' }).click()
    await expect(supplier.getByRole('alert').first()).toContainText(
      /identificación/i,
    )
    await expect(page).toHaveURL(/\/suppliers\/new$/)
    await supplier.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page).toHaveURL(/\/suppliers$/)
  })

  test('el Encargado del taller administra servicios pero no productos ni proveedores', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    await seedFiscalConfiguration(page)
    await page.context().clearCookies()

    await login(page, 'taller_e2e')
    await expect(page.getByRole('link', { name: 'Proveedores' })).toHaveCount(0)
    await goToSection(page, 'Servicios')
    await page.getByRole('button', { name: 'Nuevo servicio' }).click()
    const form = page.getByRole('dialog', { name: 'Nuevo servicio' })
    await form.getByLabel('Nombre', { exact: true }).fill('Alineación E2E')
    await form.getByLabel('Precio referencial final (USD)').fill('25.00')
    await form.getByLabel('Impuesto (RUC artesanal)').selectOption({ index: 1 })
    await form.getByRole('button', { name: 'Guardar servicio' }).click()
    await expect(form).not.toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: 'Alineación E2E' }),
    ).toContainText('USD 25.00')

    await goToSection(page, 'Productos')
    await expect(
      page.getByRole('button', { name: 'Nuevo producto' }),
    ).toHaveCount(0)
    await page.context().clearCookies()
  })

  test('las llamadas directas y la interfaz respetan la matriz de permisos', async ({
    page,
  }) => {
    await login(page, 'vendedor_e2e')
    const request = page.request
    await expandNavigation(page)
    await expect(page.getByRole('link', { name: 'Proveedores' })).toHaveCount(0)
    await expect(
      page
        .getByRole('navigation', { name: 'Navegación principal' })
        .getByRole('link', { name: 'Servicios', exact: true }),
    ).toBeVisible()
    expect((await request.get(`${API}/suppliers/`)).status()).toBe(403)
    expect((await request.get(`${API}/products/`)).status()).toBe(200)
    expect(
      (await send(request, 'post', '/products/', { name: 'x' })).status(),
    ).toBe(403)
    expect(
      (await send(request, 'post', '/services/', { name: 'x' })).status(),
    ).toBe(403)
    expect((await request.get(`${API}/products/tax-options/`)).status()).toBe(
      403,
    )
    await page.goto('/suppliers')
    await expect(
      page.getByRole('heading', { name: 'Acceso no permitido' }),
    ).toBeVisible()
    await page.context().clearCookies()

    await login(page, 'taller_e2e')
    expect(
      (await send(page.request, 'post', '/products/', { name: 'x' })).status(),
    ).toBe(403)
    expect((await page.request.get(`${API}/suppliers/`)).status()).toBe(403)
    expect(
      (
        await page.request.delete(`${API}/services/1/`, {
          headers: { 'X-CSRFToken': await csrf(page.request) },
        })
      ).status(),
    ).toBe(405)
    await page.context().clearCookies()
  })

  test('los filtros vuelven con la ficha, la baja de categoría se bloquea y los conflictos son recuperables', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    await page.goto('/products?is_active=all&search=ace')
    await page
      .getByRole('row')
      .filter({ hasText: 'ACE-E2E' })
      .getByText('Aceite 20W50 E2E')
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Aceite 20W50 E2E' }),
    ).toBeVisible()
    await expect(page.getByText('USD 10.50')).toBeVisible()
    await page.getByRole('link', { name: 'Volver a productos' }).click()
    await expect(page).toHaveURL(/search=ace/)
    await expect(page).toHaveURL(/is_active=all/)

    await page.goto('/product-categories')
    await page
      .getByRole('row')
      .filter({ hasText: 'Lubricantes E2E' })
      .getByRole('button', { name: 'Desactivar' })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Desactivar categoría' })
    await dialog
      .getByRole('button', { name: 'Confirmar desactivación' })
      .click()
    await expect(dialog.getByRole('alert')).toContainText(/productos activos/i)
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    // Cancelar conserva el estado y devuelve el foco al disparador.
    await expect(dialog).not.toBeVisible()
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Lubricantes E2E' })
        .getByRole('button', { name: 'Desactivar' }),
    ).toBeFocused()

    // Servicios y proveedores conservan filtros al volver desde su ficha.
    for (const [route, search, name, back] of [
      ['/services', 'Alineaci', 'Alineación E2E', 'Volver a servicios'],
      ['/suppliers', 'Juan', 'Juan Ocasional E2E', 'Volver a proveedores'],
    ] as const) {
      await page.goto(`${route}?search=${search}&is_active=all`)
      await page
        .getByRole('row')
        .filter({ hasText: name })
        .getByText(name)
        .first()
        .click()
      await expect(
        page.getByRole('heading', { name, exact: true }),
      ).toBeVisible()
      await page.getByRole('link', { name: back }).click()
      await expect(page).toHaveURL(new RegExp(`search=${search}`))
      await expect(page).toHaveURL(/is_active=all/)
    }

    // Conflicto de versión: otro usuario edita mientras el borrador sigue abierto.
    await page.goto('/products')
    await page
      .getByRole('row')
      .filter({ hasText: 'ACE-E2E' })
      .getByRole('button', { name: 'Acciones de ACE-E2E' })
      .click()
    await page.getByRole('menuitem', { name: 'Editar' }).click()
    await expect(page).toHaveURL(/\/products\/\d+\/edit$/)
    const form = page.locator('main')
    const list = await (
      await page.request.get(`${API}/products/?search=ACE-E2E`)
    ).json()
    const current = list.results[0]
    const other = await send(
      page.request,
      'patch',
      `/products/${current.id}/`,
      {
        expected_version: current.version,
        name: 'Aceite cambiado por otro',
        idempotency_key: `e2e-conflict-${Date.now()}`,
      },
    )
    expect(other.ok()).toBeTruthy()
    await form.getByLabel('Descripción (opcional)').fill('Mi borrador')
    await form.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(form.getByRole('alert')).toContainText(
      /cambió desde que lo abrió/i,
    )
    await expect(form.getByLabel('Descripción (opcional)')).toHaveValue(
      'Mi borrador',
    )
    const reloaded = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === `/api/v1/products/${current.id}/`,
    )
    await form.getByRole('button', { name: 'Cargar versión vigente' }).click()
    await reloaded
    await form.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page).toHaveURL(/\/products\/\d+$/)
  })

  test('un fallo de red conserva la clave y el reintento no duplica el registro', async ({
    page,
  }) => {
    await login(page, 'admin_e2e')
    await page.goto('/product-brands')
    await page.getByRole('button', { name: 'Nueva marca de producto' }).click()
    const form = page.getByRole('dialog', { name: 'Nueva marca de producto' })
    await form.getByLabel('Nombre').fill('Marca reintento E2E')

    const keys: string[] = []
    let aborted = false
    await page.route('**/api/v1/product-brands/', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      keys.push(JSON.parse(route.request().postData() ?? '{}').idempotency_key)
      if (!aborted) {
        aborted = true
        // El servidor procesa la solicitud, pero el navegador no recibe la respuesta.
        await route.fetch()
        return route.abort('failed')
      }
      return route.continue()
    })
    await form
      .getByRole('button', { name: 'Guardar marca de producto' })
      .click()
    await expect(form.getByRole('alert')).toContainText(/sin duplicarla/i)
    await form.getByRole('button', { name: 'Reintentar envío' }).click()
    await expect(form).not.toBeVisible()

    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
    await expect(
      page.getByRole('row').filter({ hasText: 'Marca reintento E2E' }),
    ).toHaveCount(1)
  })
})
