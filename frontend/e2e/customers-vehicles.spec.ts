import { expect, test } from '@playwright/test'

import { login, logout } from './helpers'

test.describe('customer registry', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin_e2e')
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
  })

  test('customer registry journey: natural and juridica creation, search, edit, duplicate rejection, and non-blocking match warning', async ({
    page,
  }) => {
    // 1. Register a Persona Natural without email or address
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    const drawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await expect(drawer).toBeVisible()

    await drawer.getByLabel('Nombres y apellidos').fill('Carlos Vera Natural')
    await drawer.getByLabel('Número de identificación').fill('0912345678')
    await drawer.getByLabel('Teléfono').fill('0991112233')
    await drawer.getByRole('button', { name: 'Guardar cliente' }).click()

    await expect(drawer).not.toBeVisible()
    let naturalRow = page
      .getByRole('row')
      .filter({ hasText: 'Carlos Vera Natural' })
    await expect(naturalRow).toBeVisible()
    await expect(naturalRow).toContainText('CI: 0912345678')
    await expect(naturalRow).toContainText('0991112233')
    await expect(naturalRow).toContainText('Activo')

    // 2. Register a Persona Jurídica with razón social, RUC of 13 digits, without email or address
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    await expect(drawer).toBeVisible()

    await drawer.getByLabel('Tipo de persona').selectOption('JURIDICA')
    await expect(drawer.getByLabel('Razón social')).toBeVisible()
    await drawer
      .getByLabel('Razón social')
      .fill('Mecánica del Puerto Cía. Ltda.')
    await drawer.getByLabel('Número de identificación').fill('0991234567001')
    await drawer.getByLabel('Teléfono').fill('042998877')
    await drawer.getByRole('button', { name: 'Guardar cliente' }).click()

    await expect(drawer).not.toBeVisible()
    const juridicaRow = page
      .getByRole('row')
      .filter({ hasText: 'Mecánica del Puerto Cía. Ltda.' })
    await expect(juridicaRow).toBeVisible()
    await expect(juridicaRow).toContainText('RUC: 0991234567001')
    await expect(juridicaRow).toContainText('042998877')
    await expect(juridicaRow).toContainText('Activo')

    // 3. Locate by each of the three fields (name, identification, phone)
    // Search by name
    await page.getByLabel('Buscar cliente').fill('Carlos')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: 'Carlos Vera Natural' }),
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: 'Mecánica del Puerto' }),
    ).toHaveCount(0)

    // Search by identification
    await page.getByLabel('Buscar cliente').fill('0991234567001')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Mecánica del Puerto Cía. Ltda.' }),
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: 'Carlos Vera Natural' }),
    ).toHaveCount(0)

    // Search by phone
    await page.getByLabel('Buscar cliente').fill('099111')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: 'Carlos Vera Natural' }),
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: 'Mecánica del Puerto' }),
    ).toHaveCount(0)

    // Reset filters
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: 'Carlos Vera Natural' }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Mecánica del Puerto Cía. Ltda.' }),
    ).toBeVisible()

    // 4. Edit customer: correct phone
    naturalRow = page
      .getByRole('row')
      .filter({ hasText: 'Carlos Vera Natural' })
    await naturalRow.getByRole('button', { name: 'Editar' }).click()
    const editDrawer = page.getByRole('dialog', { name: /editar cliente/i })
    await expect(editDrawer).toBeVisible()
    await expect(editDrawer.getByLabel('Nombres y apellidos')).toHaveValue(
      'Carlos Vera Natural',
    )

    await editDrawer.getByLabel('Teléfono').fill('0999998888')
    await editDrawer.getByRole('button', { name: 'Guardar cliente' }).click()
    await expect(editDrawer).not.toBeVisible()

    naturalRow = page
      .getByRole('row')
      .filter({ hasText: 'Carlos Vera Natural' })
    await expect(naturalRow).toContainText('0999998888')

    // 5. Reject duplicate identification
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    await expect(drawer).toBeVisible()

    await drawer.getByLabel('Nombres y apellidos').fill('Intento Duplicado')
    await drawer.getByLabel('Número de identificación').fill('0912345678')
    await drawer.getByLabel('Teléfono').fill('0987654321')
    await drawer.getByRole('button', { name: 'Guardar cliente' }).click()

    await expect(
      drawer.getByRole('alert').getByText(/ya existe un cliente con/i),
    ).toBeVisible()
    await expect(
      drawer.getByRole('button', { name: 'Ver ficha del cliente registrado' }),
    ).toBeVisible()
    // Values are preserved
    await expect(drawer.getByLabel('Nombres y apellidos')).toHaveValue(
      'Intento Duplicado',
    )
    await expect(drawer.getByLabel('Número de identificación')).toHaveValue(
      '0912345678',
    )
    await expect(drawer.getByLabel('Teléfono')).toHaveValue('0987654321')

    await drawer.getByRole('button', { name: 'Cancelar' }).click()
    await expect(drawer).not.toBeVisible()

    // 6. Review non-blocking match warning with same phone, and confirm independent record
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    await expect(drawer).toBeVisible()

    await drawer
      .getByLabel('Nombres y apellidos')
      .fill('Familiar de Carlos Vera')
    await drawer.getByLabel('Número de identificación').fill('0923456789')
    await drawer.getByLabel('Teléfono').fill('0999998888')
    // Trigger onBlur by clicking or tabbing
    await drawer.getByLabel('Nombres y apellidos').click()

    await expect(drawer.getByText(/coincidencias encontradas/i)).toBeVisible()
    await expect(drawer.getByText(/Carlos Vera Natural/i)).toBeVisible()

    // Confirmation is non-blocking: save succeeds
    await drawer.getByRole('button', { name: 'Guardar cliente' }).click()
    await expect(drawer).not.toBeVisible()

    const familiarRow = page
      .getByRole('row')
      .filter({ hasText: 'Familiar de Carlos Vera' })
    await expect(familiarRow).toBeVisible()
    await expect(familiarRow).toContainText('CI: 0923456789')
  })
})

test.describe('vehicle brands', () => {
  test('vehicle brands journey: consultation by all three roles, creation and editing by Encargado, write denial for Vendedor, deactivation denial for Encargado, and deactivation/reactivation by Administrador', async ({
    page,
  }) => {
    // 1. Consultation by Vendedor and direct write denial
    await login(page, 'vendedor_e2e')
    await page.getByRole('link', { name: 'Marcas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Marcas' })).toBeVisible()

    // Vendedor should NOT see the "Nueva marca" button
    await expect(page.getByRole('button', { name: 'Nueva marca' })).toHaveCount(
      0,
    )

    // Direct write attempt from Vendedor must be rejected by backend with 403 Forbidden
    const writeAttempt = await page.evaluate(async () => {
      const getCookie = (name: string) => {
        return document.cookie
          .split(';')
          .map((p) => p.trim())
          .find((p) => p.startsWith(name + '='))
          ?.slice(name.length + 1)
      }
      const csrf = getCookie('csrftoken')
      const res = await fetch('/api/v1/vehicle-brands/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf || '',
        },
        body: JSON.stringify({ name: 'Marca Denegada' }),
      })
      return { status: res.status }
    })
    expect(writeAttempt.status).toBe(403)

    await logout(page)

    // 2. Creation and editing by Encargado del taller, and deactivation denial
    await login(page, 'taller_e2e')
    await page.getByRole('link', { name: 'Marcas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Marcas' })).toBeVisible()

    // Encargado creates a brand
    await page.getByRole('button', { name: 'Nueva marca' }).click()
    const brandDrawer = page.getByRole('dialog', { name: 'Nueva marca' })
    await expect(brandDrawer).toBeVisible()

    await brandDrawer.getByLabel('Nombre de la marca').fill('Chevrolet')
    await brandDrawer.getByRole('button', { name: 'Guardar marca' }).click()
    await expect(brandDrawer).not.toBeVisible()

    let brandRow = page.getByRole('row').filter({ hasText: 'Chevrolet' })
    await expect(brandRow).toBeVisible()
    await expect(brandRow).toContainText('Activo')

    // Encargado edits the brand
    await brandRow.getByRole('button', { name: 'Editar' }).click()
    const editDrawer = page.getByRole('dialog', { name: 'Editar marca' })
    await expect(editDrawer).toBeVisible()
    await expect(editDrawer.getByLabel('Nombre de la marca')).toHaveValue(
      'Chevrolet',
    )

    await editDrawer.getByLabel('Nombre de la marca').fill('Chevrolet Motors')
    await editDrawer.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(editDrawer).not.toBeVisible()

    brandRow = page.getByRole('row').filter({ hasText: 'Chevrolet Motors' })
    await expect(brandRow).toBeVisible()

    // Encargado should NOT see deactivation/reactivation controls
    await expect(
      brandRow.getByRole('button', { name: 'Desactivar' }),
    ).toHaveCount(0)
    await expect(
      brandRow.getByRole('button', { name: 'Reactivar' }),
    ).toHaveCount(0)

    // Direct deactivation attempt from Encargado must be rejected by backend with 403 Forbidden
    const brandId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/vehicle-brands/?search=Chevrolet')
      const data = await res.json()
      return data.results[0].id
    })

    const deactivationAttempt = await page.evaluate(async (id) => {
      const getCookie = (name: string) => {
        return document.cookie
          .split(';')
          .map((p) => p.trim())
          .find((p) => p.startsWith(name + '='))
          ?.slice(name.length + 1)
      }
      const csrf = getCookie('csrftoken')
      const res = await fetch(`/api/v1/vehicle-brands/${id}/deactivate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf || '',
        },
      })
      return { status: res.status }
    }, brandId)
    expect(deactivationAttempt.status).toBe(403)

    await logout(page)

    // 3. Consultation and deactivation/reactivation by Administrador
    await login(page, 'admin_e2e')
    await page.getByRole('link', { name: 'Marcas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Marcas' })).toBeVisible()

    brandRow = page.getByRole('row').filter({ hasText: 'Chevrolet Motors' })
    await expect(brandRow).toBeVisible()
    await expect(brandRow).toContainText('Activo')

    // Administrador deactivates the brand
    await brandRow.getByRole('button', { name: 'Desactivar' }).click()
    const deactivateDialog = page.getByRole('dialog', {
      name: 'Desactivar marca',
    })
    await expect(deactivateDialog).toBeVisible()
    await deactivateDialog
      .getByRole('button', { name: 'Confirmar desactivación' })
      .click()
    await expect(deactivateDialog).not.toBeVisible()

    brandRow = page.getByRole('row').filter({ hasText: 'Chevrolet Motors' })
    await expect(brandRow).toContainText('Inactivo')
    await expect(
      brandRow.getByRole('button', { name: 'Reactivar' }),
    ).toBeVisible()

    // Administrador reactivates the brand
    await brandRow.getByRole('button', { name: 'Reactivar' }).click()
    const reactivateDialog = page.getByRole('dialog', {
      name: 'Reactivar marca',
    })
    await expect(reactivateDialog).toBeVisible()
    await reactivateDialog
      .getByRole('button', { name: 'Confirmar reactivación' })
      .click()
    await expect(reactivateDialog).not.toBeVisible()

    brandRow = page.getByRole('row').filter({ hasText: 'Chevrolet Motors' })
    await expect(brandRow).toContainText('Activo')
    await expect(
      brandRow.getByRole('button', { name: 'Desactivar' }),
    ).toBeVisible()
  })
})

test.describe('vehicles and ownership', () => {
  test('vehicle lifecycle: creation without optionals, consultation from customer and vehicle, required plate rejection, normalized duplicates, inline brand creation, inactive reference rejection, and role authorization', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    // 1. Setup as admin_e2e: ensure customer and brand exist
    await login(page, 'admin_e2e')

    // Create a customer "Valeria Vehículos"
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    const customerDrawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await customerDrawer
      .getByLabel('Nombres y apellidos')
      .fill('Valeria Vehículos')
    await customerDrawer
      .getByLabel('Número de identificación')
      .fill('0955667788')
    await customerDrawer.getByLabel('Teléfono').fill('0987654321')
    await customerDrawer
      .getByRole('button', { name: 'Guardar cliente' })
      .click()
    await expect(customerDrawer).not.toBeVisible()

    // Create a brand "Toyota E2E"
    await page.getByRole('link', { name: 'Marcas', exact: true }).click()
    await page.getByRole('button', { name: 'Nueva marca' }).click()
    const brandDrawer = page.getByRole('dialog', { name: 'Nueva marca' })
    await brandDrawer.getByLabel('Nombre de la marca').fill('Toyota E2E')
    await brandDrawer.getByRole('button', { name: 'Guardar marca' }).click()
    await expect(brandDrawer).not.toBeVisible()

    // Also create a brand "Marca Para Desactivar" and deactivate it
    await page.getByRole('button', { name: 'Nueva marca' }).click()
    await brandDrawer
      .getByLabel('Nombre de la marca')
      .fill('Marca Para Desactivar')
    await brandDrawer.getByRole('button', { name: 'Guardar marca' }).click()
    await expect(brandDrawer).not.toBeVisible()

    const inactiveBrandRow = page
      .getByRole('row')
      .filter({ hasText: 'Marca Para Desactivar' })
    await inactiveBrandRow.getByRole('button', { name: 'Desactivar' }).click()
    const deactivateDialog = page.getByRole('dialog', {
      name: 'Desactivar marca',
    })
    await deactivateDialog
      .getByRole('button', { name: 'Confirmar desactivación' })
      .click()
    await expect(deactivateDialog).not.toBeVisible()
    await expect(inactiveBrandRow).toContainText('Inactivo')

    await logout(page)

    // 2. Encargado del taller tests creation and validations
    await login(page, 'taller_e2e')
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Vehículos' })).toBeVisible()

    // Check that "Marca Para Desactivar" is NOT present in brand options
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    const vehicleDrawer = page.getByRole('dialog', {
      name: 'Registrar vehículo',
    })
    await expect(vehicleDrawer).toBeVisible()

    const brandSelect = vehicleDrawer.getByLabel('Marca de vehículo')
    await expect(
      brandSelect.locator('option', { hasText: 'Marca Para Desactivar' }),
    ).toHaveCount(0)

    // Test rejection without plate
    await vehicleDrawer
      .getByLabel('Propietario')
      .selectOption({ label: 'Valeria Vehículos (0955667788)' })
    await vehicleDrawer
      .getByLabel('Marca de vehículo')
      .selectOption({ label: 'Toyota E2E' })
    await vehicleDrawer.getByLabel('Modelo').fill('Hilux')
    await vehicleDrawer
      .getByRole('button', { name: 'Guardar vehículo' })
      .click()
    await expect(
      vehicleDrawer.getByText('La placa del vehículo es obligatoria.'),
    ).toBeVisible()

    // Test creation without optional fields (color, year, vin)
    await vehicleDrawer.getByLabel('Placa').fill('gbe-1234')
    await vehicleDrawer
      .getByRole('button', { name: 'Guardar vehículo' })
      .click()
    await expect(vehicleDrawer).not.toBeVisible()

    // Verify row in vehicles list: normalized plate GBE-1234, Toyota E2E Hilux, Activo
    let vehicleRow = page.getByRole('row').filter({ hasText: 'GBE-1234' })
    await expect(vehicleRow).toBeVisible()
    await expect(vehicleRow).toContainText('Toyota E2E Hilux')
    await expect(vehicleRow).toContainText('Valeria Vehículos')
    await expect(vehicleRow).toContainText('Activo')

    // Test duplicate plate rejection (case-insensitive and trimmed)
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    await expect(vehicleDrawer).toBeVisible()
    await vehicleDrawer
      .getByLabel('Propietario')
      .selectOption({ label: 'Valeria Vehículos (0955667788)' })
    await vehicleDrawer
      .getByLabel('Marca de vehículo')
      .selectOption({ label: 'Toyota E2E' })
    await vehicleDrawer.getByLabel('Placa').fill('  GBE-1234  ')
    await vehicleDrawer.getByLabel('Modelo').fill('Corolla')
    await vehicleDrawer
      .getByRole('button', { name: 'Guardar vehículo' })
      .click()
    await expect(
      vehicleDrawer
        .getByText(/ya existe un vehículo registrado con esta placa/i)
        .first(),
    ).toBeVisible()
    await vehicleDrawer.getByRole('button', { name: 'Cancelar' }).click()
    await expect(vehicleDrawer).not.toBeVisible()

    // Test creating missing brand during vehicle form without losing draft
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    await expect(vehicleDrawer).toBeVisible()
    await vehicleDrawer
      .getByLabel('Propietario')
      .selectOption({ label: 'Valeria Vehículos (0955667788)' })
    await vehicleDrawer.getByLabel('Placa').fill('pba-7890')
    await vehicleDrawer.getByLabel('Modelo').fill('Forester')

    // Click "Nueva marca" inside drawer
    await vehicleDrawer.getByRole('button', { name: 'Nueva marca' }).click()
    await expect(
      vehicleDrawer.getByRole('heading', { name: 'Nueva marca de vehículo' }),
    ).toBeVisible()
    await vehicleDrawer.getByLabel('Nombre de la marca').fill('Subaru E2E')
    await vehicleDrawer.getByRole('button', { name: 'Guardar marca' }).click()

    // Returns to vehicle form with Subaru E2E selected and plate/model draft preserved!
    await expect(
      vehicleDrawer.getByRole('heading', { name: 'Nueva marca de vehículo' }),
    ).not.toBeVisible()
    await expect(vehicleDrawer.getByLabel('Placa')).toHaveValue('PBA-7890')
    await expect(vehicleDrawer.getByLabel('Modelo')).toHaveValue('Forester')
    await expect(vehicleDrawer.getByLabel('Marca de vehículo')).toContainText(
      'Subaru E2E',
    )

    await vehicleDrawer
      .getByRole('button', { name: 'Guardar vehículo' })
      .click()
    await expect(vehicleDrawer).not.toBeVisible()

    const subaruRow = page.getByRole('row').filter({ hasText: 'PBA-7890' })
    await expect(subaruRow).toBeVisible()
    await expect(subaruRow).toContainText('Subaru E2E')

    // 3. Bidirectional navigation and consultation from customer and vehicle
    await vehicleRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(page.getByRole('heading', { name: 'GBE-1234' })).toBeVisible()
    await expect(page.getByText('Toyota E2E Hilux')).toBeVisible()

    const currentOwnerSection = page
      .locator('section')
      .filter({ hasText: 'Propietario actual' })
    await expect(
      currentOwnerSection.getByText('Valeria Vehículos'),
    ).toBeVisible()

    // Click on the owner link to navigate to Customer detail
    await currentOwnerSection
      .getByRole('link', { name: /Valeria Vehículos/ })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Valeria Vehículos' }),
    ).toBeVisible()

    // Both vehicles owned by Valeria must appear under "Vehículos asociados"
    const vehiclesSection = page
      .locator('section')
      .filter({ hasText: 'Vehículos asociados' })
    await expect(vehiclesSection).toContainText('GBE-1234')
    await expect(vehiclesSection).toContainText('Toyota E2E Hilux')
    await expect(vehiclesSection).toContainText('PBA-7890')
    await expect(vehiclesSection).toContainText('Subaru E2E Forester')

    // Click GBE-1234 to navigate back to vehicle detail
    await vehiclesSection.getByRole('link', { name: 'GBE-1234' }).click()
    await expect(page.getByRole('heading', { name: 'GBE-1234' })).toBeVisible()

    // Direct backend rejection check: inactive reference cannot be selected
    const inactiveBrandId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/vehicle-brands/?is_active=false')
      const data = await res.json()
      const found = data.results.find(
        (b: { name: string; id: number }) => b.name === 'Marca Para Desactivar',
      )
      return found?.id
    })

    const customerId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/customers/?search=Valeria')
      const data = await res.json()
      return data.results[0].id
    })

    const inactiveReferenceAttempt = await page.evaluate(
      async ({ bId, cId }) => {
        const getCookie = (name: string) => {
          return document.cookie
            .split(';')
            .map((p) => p.trim())
            .find((p) => p.startsWith(name + '='))
            ?.slice(name.length + 1)
        }
        const csrf = getCookie('csrftoken')
        const res = await fetch('/api/v1/vehicles/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf || '',
          },
          body: JSON.stringify({
            owner_id: cId,
            brand_id: bId,
            plate: 'INACT-001',
            model: 'Test Inactive',
          }),
        })
        return { status: res.status }
      },
      { bId: inactiveBrandId, cId: customerId },
    )
    expect(inactiveReferenceAttempt.status).toBe(400)

    await logout(page)

    // 4. Vendedor authorization check: read-only access
    await login(page, 'vendedor_e2e')
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Vehículos' })).toBeVisible()

    // Vendedor can see rows and "Ver ficha", but NOT "Registrar vehículo" or "Editar"
    await expect(
      page.getByRole('button', { name: 'Registrar vehículo' }),
    ).toHaveCount(0)
    vehicleRow = page.getByRole('row').filter({ hasText: 'GBE-1234' })
    await expect(vehicleRow).toBeVisible()
    await expect(
      vehicleRow.getByRole('button', { name: 'Editar' }),
    ).toHaveCount(0)
    await vehicleRow.getByRole('link', { name: 'Ver ficha' }).click()

    // In vehicle detail, Vendedor sees details and owner, but cannot edit
    await expect(page.getByRole('heading', { name: 'GBE-1234' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Editar vehículo' }),
    ).toHaveCount(0)

    // Direct POST attempt by Vendedor returns 403
    const vendedorPostAttempt = await page.evaluate(
      async ({ cId }) => {
        const getCookie = (name: string) => {
          return document.cookie
            .split(';')
            .map((p) => p.trim())
            .find((p) => p.startsWith(name + '='))
            ?.slice(name.length + 1)
        }
        const csrf = getCookie('csrftoken')
        const res = await fetch('/api/v1/vehicles/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrf || '',
          },
          body: JSON.stringify({
            owner_id: cId,
            brand_id: 1,
            plate: 'VEND-0001',
            model: 'Deny Model',
          }),
        })
        return { status: res.status }
      },
      { cId: customerId },
    )
    expect(vendedorPostAttempt.status).toBe(403)
  })

  test('vehicle ownership transfer journey: transfer from Customer A to Customer B, disappearance from A, appearance in B, consultation of previous and current ownership periods, and idempotent repetition', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    // 1. Setup as admin_e2e: ensure Customer A, Customer B, and brand exist
    await login(page, 'admin_e2e')

    // Create Customer A "Propietario Origen"
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    let customerDrawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await customerDrawer
      .getByLabel('Nombres y apellidos')
      .fill('Propietario Origen')
    await customerDrawer
      .getByLabel('Número de identificación')
      .fill('0911223344')
    await customerDrawer.getByLabel('Teléfono').fill('0911223344')
    await customerDrawer
      .getByRole('button', { name: 'Guardar cliente' })
      .click()
    await expect(customerDrawer).not.toBeVisible()

    // Create Customer B "Propietario Destino"
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    customerDrawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await customerDrawer
      .getByLabel('Nombres y apellidos')
      .fill('Propietario Destino')
    await customerDrawer
      .getByLabel('Número de identificación')
      .fill('0922334455')
    await customerDrawer.getByLabel('Teléfono').fill('0922334455')
    await customerDrawer
      .getByRole('button', { name: 'Guardar cliente' })
      .click()
    await expect(customerDrawer).not.toBeVisible()

    // Create a brand "Mazda E2E"
    await page.getByRole('link', { name: 'Marcas', exact: true }).click()
    await page.getByRole('button', { name: 'Nueva marca' }).click()
    const brandDrawer = page.getByRole('dialog', { name: 'Nueva marca' })
    await brandDrawer.getByLabel('Nombre de la marca').fill('Mazda E2E')
    await brandDrawer.getByRole('button', { name: 'Guardar marca' }).click()
    await expect(brandDrawer).not.toBeVisible()

    // Create a vehicle "TRF-9999" owned by Customer A
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    const vehicleDrawer = page.getByRole('dialog', {
      name: 'Registrar vehículo',
    })
    await vehicleDrawer
      .getByLabel('Propietario')
      .selectOption({ label: 'Propietario Origen (0911223344)' })
    await vehicleDrawer
      .getByLabel('Marca de vehículo')
      .selectOption({ label: 'Mazda E2E' })
    await vehicleDrawer.getByLabel('Placa').fill('trf-9999')
    await vehicleDrawer.getByLabel('Modelo').fill('CX-5')
    await vehicleDrawer
      .getByRole('button', { name: 'Guardar vehículo' })
      .click()
    await expect(vehicleDrawer).not.toBeVisible()

    await logout(page)

    // 2. Encargado del taller performs ownership transfer
    await login(page, 'taller_e2e')
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    const trfRow = page.getByRole('row').filter({ hasText: 'TRF-9999' })
    await expect(trfRow).toBeVisible()
    await expect(trfRow).toContainText('Propietario Origen')
    await trfRow.getByRole('link', { name: 'Ver ficha' }).click()

    // Vehicle detail
    await expect(page.getByRole('heading', { name: 'TRF-9999' })).toBeVisible()
    const currentOwnerSection = page
      .locator('section')
      .filter({ hasText: 'Propietario actual' })
    await expect(
      currentOwnerSection.getByText('Propietario Origen'),
    ).toBeVisible()

    // Initial period in history table
    const historySection = page
      .locator('section')
      .filter({ hasText: 'Historial de períodos de propiedad' })
    let periodRows = historySection.getByRole('row')
    await expect(periodRows).toHaveCount(2) // header + 1 period
    await expect(historySection).toContainText('Propietario Origen')
    await expect(historySection).toContainText('Vigente')

    // Open transfer modal
    await currentOwnerSection
      .getByRole('button', { name: 'Cambiar propietario' })
      .click()
    const transferDialog = page.getByRole('dialog', {
      name: 'Cambiar propietario',
    })
    await expect(transferDialog).toBeVisible()

    // Select Customer B
    await transferDialog
      .getByLabel('Nuevo cliente propietario')
      .selectOption({ label: 'Propietario Destino (0922334455)' })

    await transferDialog
      .getByRole('button', { name: 'Confirmar transferencia' })
      .click()
    await expect(transferDialog).not.toBeVisible()
    await expect(
      page.getByText('La propiedad del vehículo fue transferida exitosamente.'),
    ).toBeVisible()

    // Vehicle detail now shows Customer B as current owner
    await expect(
      currentOwnerSection.getByText('Propietario Destino'),
    ).toBeVisible()

    // Ownership periods history now has 2 entries: Customer B (Vigente) and Customer A (Finalizado)
    periodRows = historySection.getByRole('row')
    await expect(periodRows).toHaveCount(3) // header + 2 periods
    await expect(historySection).toContainText('Propietario Destino')
    await expect(historySection).toContainText('Propietario Origen')
    await expect(historySection).toContainText('Finalizado')
    await expect(historySection).toContainText('Vigente')

    // 3. Verify Customer A no longer has TRF-9999 under active vehicles
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    const originRow = page
      .getByRole('row')
      .filter({ hasText: 'Propietario Origen' })
    await originRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(
      page.getByRole('heading', { name: 'Propietario Origen' }),
    ).toBeVisible()
    const originVehicles = page
      .locator('section')
      .filter({ hasText: 'Vehículos asociados' })
    await expect(originVehicles.getByText('TRF-9999')).toHaveCount(0)

    // 4. Verify Customer B HAS TRF-9999 under active vehicles
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    const destinationRow = page
      .getByRole('row')
      .filter({ hasText: 'Propietario Destino' })
    await destinationRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(
      page.getByRole('heading', { name: 'Propietario Destino' }),
    ).toBeVisible()
    const destinationVehicles = page
      .locator('section')
      .filter({ hasText: 'Vehículos asociados' })
    await expect(destinationVehicles.getByText('TRF-9999')).toBeVisible()

    // Navigate back to vehicle detail from Customer B's list
    await destinationVehicles.getByRole('link', { name: 'TRF-9999' }).click()
    await expect(page.getByRole('heading', { name: 'TRF-9999' })).toBeVisible()

    // 5. Test idempotent transfer (repeating transfer to same owner)
    await currentOwnerSection
      .getByRole('button', { name: 'Cambiar propietario' })
      .click()
    await expect(transferDialog).toBeVisible()

    // Select Customer B again
    await transferDialog
      .getByLabel('Nuevo cliente propietario')
      .selectOption({ label: 'Propietario Destino (0922334455)' })

    // Notice about same owner should appear
    await expect(transferDialog.getByText(/mismo propietario/i)).toBeVisible()

    await transferDialog
      .getByRole('button', { name: 'Confirmar transferencia' })
      .click()
    await expect(transferDialog).not.toBeVisible()

    // History must NOT have duplicated: still header + 2 periods = 3 rows
    await expect(periodRows).toHaveCount(3)
  })
})

test.describe('customer and vehicle deactivation and reactivation', () => {
  test('lifecycle: customer and vehicle deactivation/reactivation, inactive record consultations, duplicate attempts, and permission enforcement for Vendedor and Encargado', async ({
    page,
  }) => {
    // 1. Admin creates customer and vehicle
    await login(page, 'admin_e2e')
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    let customerDrawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await customerDrawer
      .getByLabel('Nombres y apellidos')
      .fill('Cliente Ciclo Estado')
    await customerDrawer
      .getByLabel('Número de identificación')
      .fill('0944556677')
    await customerDrawer.getByLabel('Teléfono').fill('0994455667')
    await customerDrawer
      .getByRole('button', { name: 'Guardar cliente' })
      .click()
    await expect(customerDrawer).not.toBeVisible()

    let custRow = page
      .getByRole('row')
      .filter({ hasText: 'Cliente Ciclo Estado' })
    await expect(custRow).toBeVisible()
    await expect(custRow).toContainText('Activo')

    // Create brand "Kia E2E"
    await page.getByRole('link', { name: 'Marcas', exact: true }).click()
    await page.getByRole('button', { name: 'Nueva marca' }).click()
    const brandDrawer = page.getByRole('dialog', { name: 'Nueva marca' })
    await brandDrawer.getByLabel('Nombre de la marca').fill('Kia E2E')
    await brandDrawer.getByRole('button', { name: 'Guardar marca' }).click()
    await expect(brandDrawer).not.toBeVisible()

    // Create vehicle for this customer
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    let vehicleDrawer = page.getByRole('dialog', {
      name: 'Registrar vehículo',
    })
    await vehicleDrawer
      .getByLabel('Propietario')
      .selectOption({ label: 'Cliente Ciclo Estado (0944556677)' })
    await vehicleDrawer
      .getByLabel('Marca de vehículo')
      .selectOption({ label: 'Kia E2E' })
    await vehicleDrawer.getByLabel('Placa').fill('INA-1234')
    await vehicleDrawer.getByLabel('Modelo').fill('Fortuner')
    await vehicleDrawer
      .getByRole('button', { name: 'Guardar vehículo' })
      .click()
    await expect(vehicleDrawer).not.toBeVisible()

    let vehRow = page.getByRole('row').filter({ hasText: 'INA-1234' })
    await expect(vehRow).toBeVisible()
    await expect(vehRow).toContainText('Activo')

    // 2. Negative permissions check for Vendedor
    await logout(page)
    await login(page, 'vendedor_e2e')
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    custRow = page.getByRole('row').filter({ hasText: 'Cliente Ciclo Estado' })
    await expect(custRow).toBeVisible()
    await expect(
      custRow.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)
    await custRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(
      page.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)

    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    vehRow = page.getByRole('row').filter({ hasText: 'INA-1234' })
    await expect(vehRow).toBeVisible()
    await expect(
      vehRow.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)
    await vehRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(
      page.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)

    // 3. Negative permissions check for Encargado
    await logout(page)
    await login(page, 'taller_e2e')
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    custRow = page.getByRole('row').filter({ hasText: 'Cliente Ciclo Estado' })
    await expect(custRow).toBeVisible()
    await expect(
      custRow.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)
    await custRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(
      page.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)

    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    vehRow = page.getByRole('row').filter({ hasText: 'INA-1234' })
    await expect(vehRow).toBeVisible()
    await expect(
      vehRow.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)
    await vehRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(
      page.getByRole('button', { name: /Desactivar|Activar/i }),
    ).toHaveCount(0)

    // 4. Vehicle deactivation and reactivation by Administrador
    await logout(page)
    await login(page, 'admin_e2e')
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    vehRow = page.getByRole('row').filter({ hasText: 'INA-1234' })
    await expect(vehRow).toBeVisible()

    // Deactivate vehicle via row button
    await vehRow.getByRole('button', { name: 'Desactivar' }).click()
    let deactDialog = page.getByRole('dialog', { name: 'Desactivar vehículo' })
    await expect(deactDialog).toBeVisible()
    await expect(deactDialog).toContainText('INA-1234')
    await deactDialog
      .getByRole('button', { name: 'Confirmar desactivación' })
      .click()
    await expect(deactDialog).not.toBeVisible()

    // Status is now Inactivo
    vehRow = page.getByRole('row').filter({ hasText: 'INA-1234' })
    await expect(vehRow).toContainText('Inactivo')

    // Filter Activos: INA-1234 not visible
    await page.getByLabel('Filtrar por estado').selectOption('true')
    await expect(
      page.getByRole('row').filter({ hasText: 'INA-1234' }),
    ).toHaveCount(0)

    // Filter Inactivos: INA-1234 is visible
    await page.getByLabel('Filtrar por estado').selectOption('false')
    vehRow = page.getByRole('row').filter({ hasText: 'INA-1234' })
    await expect(vehRow).toBeVisible()

    // Check vehicle detail: consultable, history intact, "Cambiar propietario" NOT shown
    await vehRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(page.getByRole('heading', { name: 'INA-1234' })).toBeVisible()
    await expect(
      page.locator('.page-header').getByText('Inactivo'),
    ).toBeVisible()
    await expect(page.getByText('Kia E2E Fortuner')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Cambiar propietario' }),
    ).toHaveCount(0)

    // Attempt duplicate vehicle creation with same plate (normalized duplicate test)
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    vehicleDrawer = page.getByRole('dialog', {
      name: 'Registrar vehículo',
    })
    await vehicleDrawer
      .getByLabel('Propietario')
      .selectOption({ label: 'Cliente Ciclo Estado (0944556677)' })
    await vehicleDrawer
      .getByLabel('Marca de vehículo')
      .selectOption({ label: 'Kia E2E' })
    await vehicleDrawer.getByLabel('Placa').fill('ina-1234')
    await vehicleDrawer.getByLabel('Modelo').fill('Otro Modelo')
    await vehicleDrawer
      .getByRole('button', { name: 'Guardar vehículo' })
      .click()
    await expect(
      vehicleDrawer
        .getByText(/ya existe un vehículo registrado con esta placa/i)
        .first(),
    ).toBeVisible()
    await vehicleDrawer.getByRole('button', { name: 'Cancelar' }).click()
    await expect(vehicleDrawer).not.toBeVisible()

    // Reactivate vehicle via detail page
    await page.getByLabel('Filtrar por estado').selectOption('false')
    vehRow = page.getByRole('row').filter({ hasText: 'INA-1234' })
    await vehRow.getByRole('link', { name: 'Ver ficha' }).click()
    await page.getByRole('button', { name: 'Activar' }).click()
    let actDialog = page.getByRole('dialog', { name: 'Activar vehículo' })
    await expect(actDialog).toBeVisible()
    await actDialog
      .getByRole('button', { name: 'Confirmar activación' })
      .click()
    await expect(actDialog).not.toBeVisible()
    await expect(page.locator('.page-header').getByText('Activo')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Cambiar propietario' }),
    ).toBeVisible()

    // 5. Customer deactivation and reactivation by Administrador
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    custRow = page.getByRole('row').filter({ hasText: 'Cliente Ciclo Estado' })
    await expect(custRow).toBeVisible()

    // Deactivate customer via row button
    await custRow.getByRole('button', { name: 'Desactivar' }).click()
    deactDialog = page.getByRole('dialog', { name: 'Desactivar cliente' })
    await expect(deactDialog).toBeVisible()
    await expect(deactDialog).toContainText('Cliente Ciclo Estado')
    await deactDialog
      .getByRole('button', { name: 'Confirmar desactivación' })
      .click()
    await expect(deactDialog).not.toBeVisible()

    // Status is now Inactivo
    custRow = page.getByRole('row').filter({ hasText: 'Cliente Ciclo Estado' })
    await expect(custRow).toContainText('Inactivo')

    // Filter Activos: Customer not visible
    await page.locator('#customer-status-filter').selectOption('true')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(
      page.getByRole('row').filter({ hasText: 'Cliente Ciclo Estado' }),
    ).toHaveCount(0)

    // Filter Inactivos: Customer is visible
    await page.locator('#customer-status-filter').selectOption('false')
    await page.getByRole('button', { name: 'Buscar' }).click()
    custRow = page.getByRole('row').filter({ hasText: 'Cliente Ciclo Estado' })
    await expect(custRow).toBeVisible()

    // Check customer detail: consultable, associated vehicle intact
    await custRow.getByRole('link', { name: 'Ver ficha' }).click()
    await expect(
      page.getByRole('heading', { name: 'Cliente Ciclo Estado' }),
    ).toBeVisible()
    await expect(
      page.getByRole('status', { name: 'Estado: Inactivo' }),
    ).toBeVisible()
    const customerVehicles = page
      .locator('section')
      .filter({ hasText: 'Vehículos asociados' })
    await expect(customerVehicles.getByText('INA-1234')).toBeVisible()

    // Inactive customer cannot be selected for new vehicle
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    vehicleDrawer = page.getByRole('dialog', {
      name: 'Registrar vehículo',
    })
    await expect(vehicleDrawer.getByLabel('Propietario')).not.toContainText(
      'Cliente Ciclo Estado',
    )
    await vehicleDrawer.getByRole('button', { name: 'Cancelar' }).click()

    // Attempt duplicate customer creation with same identification
    await page.getByRole('link', { name: 'Clientes', exact: true }).click()
    await page.getByRole('button', { name: 'Nuevo cliente' }).click()
    customerDrawer = page.getByRole('dialog', { name: 'Nuevo cliente' })
    await customerDrawer
      .getByLabel('Nombres y apellidos')
      .fill('Duplicado Inactivo')
    await customerDrawer
      .getByLabel('Número de identificación')
      .fill('0944556677')
    await customerDrawer.getByLabel('Teléfono').fill('0999999999')
    await customerDrawer
      .getByRole('button', { name: 'Guardar cliente' })
      .click()
    await expect(
      customerDrawer.getByRole('alert').getByText(/ya existe un cliente con/i),
    ).toBeVisible()
    await customerDrawer.getByRole('button', { name: 'Cancelar' }).click()
    await expect(customerDrawer).not.toBeVisible()

    // Reactivate customer via detail page
    await page.locator('#customer-status-filter').selectOption('false')
    await page.getByRole('button', { name: 'Buscar' }).click()
    custRow = page.getByRole('row').filter({ hasText: 'Cliente Ciclo Estado' })
    await custRow.getByRole('link', { name: 'Ver ficha' }).click()
    await page.getByRole('button', { name: 'Activar' }).click()
    actDialog = page.getByRole('dialog', { name: 'Activar cliente' })
    await expect(actDialog).toBeVisible()
    await actDialog
      .getByRole('button', { name: 'Confirmar activación' })
      .click()
    await expect(actDialog).not.toBeVisible()
    await expect(
      page.getByRole('status', { name: 'Estado: Activo' }),
    ).toBeVisible()

    // Customer is now available again for vehicle registration
    await page.getByRole('link', { name: 'Vehículos', exact: true }).click()
    await page
      .getByRole('button', { name: 'Registrar vehículo' })
      .first()
      .click()
    vehicleDrawer = page.getByRole('dialog', {
      name: 'Registrar vehículo',
    })
    await expect(vehicleDrawer.getByLabel('Propietario')).toContainText(
      'Cliente Ciclo Estado',
    )
    await vehicleDrawer.getByRole('button', { name: 'Cancelar' }).click()
  })
})
