import { expect, test, type Page } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from './accessibility'
import { API, send, seedFiscalConfiguration } from './catalog-helpers'
import { goToSection, login } from './helpers'

const EVIDENCE = 'test-results/maintenance-evidence'
const RAIL_EXCEPTION = { exclude: ['.app-rail'] }

/** JPEG válido de 320×240 píxeles generado con Pillow para la carga real de una fotografía. */
const JPEG = Buffer.from(
  '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iD/jxT/rqP5Guer63Kf92Xqz47OP96fogooor1DyAooooAKKKKACiiigAooooAKKKKACtrw7/wAvH/Af61i1teHf+Xj/AID/AFrz8z/3Sfy/NHpZV/vkPn+TNuiiivjj7YKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigDL8Qf8eKf9dR/I1z1dD4g/48U/66j+Rrnq+tyn/dl6s+Ozj/AHp+iCiiivUPICiiigAooooAKKKKACiiigAooooAK2vDv/Lx/wAB/rWLW14d/wCXj/gP9a8/M/8AdJ/L80ellX++Q+f5M26KKK+OPtgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAMvxB/x4p/11H8jXPV0PiD/jxT/rqP5Guer63Kf92Xqz47OP96fogooor1DyAooooAKKKKACiiigAooooAKKKKACtrw7/wAvH/Af61i1teHf+Xj/AID/AFrz8z/3Sfy/NHpZV/vkPn+TNuiiivjj7YKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigDL8Qf8eKf9dR/I1z1dD4g/48U/66j+Rrnq+tyn/dl6s+Ozj/AHp+iCiiivUPICiiigAooooAKKKKACiiigAooooAK2vDv/Lx/wAB/rWLW14d/wCXj/gP9a8/M/8AdJ/L80ellX++Q+f5M26KKK+OPtgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAMvxB/x4p/11H8jXPV0PiD/jxT/rqP5Guer63Kf92Xqz47OP96fogooor1DyAooooAKKKKACiiigAooooAKKKKACtrw7/wAvH/Af61i1teHf+Xj/AID/AFrz8z/3Sfy/NHpZV/vkPn+TNuiiivjj7YKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigDL8Qf8eKf9dR/I1z1dD4g/48U/66j+Rrnq+tyn/dl6s+Ozj/AHp+iCiiivUPICiiigAooooAKKKKACiiigAooooAK0NK1CKx83zVc78Y2gds+/vWfRWVajGtB057M2o1p0aiqQ3R0P8AwkFp/wA85v8Avkf40f8ACQWn/POb/vkf41z1FcH9k4bs/vPR/tjFd19x0P8AwkFp/wA85v8Avkf40f8ACQWn/POb/vkf41z1FH9k4bs/vD+2MV3X3HQ/8JBaf885v++R/jR/wkFp/wA85v8Avkf41z1FH9k4bs/vD+2MV3X3HQ/8JBaf885v++R/jR/wkFp/zzm/75H+Nc9RR/ZOG7P7w/tjFd19x0P/AAkFp/zzm/75H+NH/CQWn/POb/vkf41z1FH9k4bs/vD+2MV3X3HQ/wDCQWn/ADzm/wC+R/jR/wAJBaf885v++R/jXPUUf2Thuz+8P7YxXdfcdD/wkFp/zzm/75H+NH/CQWn/ADzm/wC+R/jXPUUf2Thuz+8P7YxXdfcdD/wkFp/zzm/75H+NH/CQWn/POb/vkf41z1FH9k4bs/vD+2MV3X3HQ/8ACQWn/POb/vkf40f8JBaf885v++R/jXPUUf2Thuz+8P7YxXdfcdD/AMJBaf8APOb/AL5H+NH/AAkFp/zzm/75H+Nc9RR/ZOG7P7w/tjFd19x0P/CQWn/POb/vkf40f8JBaf8APOb/AL5H+Nc9RR/ZOG7P7w/tjFd19x0P/CQWn/POb/vkf40f8JBaf885v++R/jXPUUf2Thuz+8P7YxXdfcauqapBe2yxRJICHDfMB6H396yqKK7qFCFCHJDY8+vXnXnzz3CiiitjAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k=',
  'base64',
)

const ok = async (response: Awaited<ReturnType<typeof send>>) => {
  expect(response.ok(), await response.text()).toBeTruthy()
  return response.json()
}

async function seed(page: Page) {
  const tag = Date.now().toString(36)
  await seedFiscalConfiguration(page)
  const request = page.request
  const entities: Array<{ id: number; entity_type: string }> = await (
    await request.get(`${API}/workshop-configuration/entities/`)
  ).json()
  const artisan = entities.find((e) => e.entity_type === 'ARTESANAL')
  const taxes: Array<{ id: number; fiscal_entity_id: number }> = await (
    await request.get(`${API}/workshop-configuration/taxes/`)
  ).json()
  const tax = taxes.find((t) => t.fiscal_entity_id === artisan?.id)
  const identification = `17${Date.now().toString().slice(-8)}`
  const customer = await ok(
    await send(request, 'post', '/customers/', {
      person_type: 'NATURAL',
      name: `Ana Taller ${tag}`,
      identification_type: 'CI',
      identification,
      phone: '0999999999',
      idempotency_key: `e2e-mnt-cus-${tag}`,
    }),
  )
  const brand = await ok(
    await send(request, 'post', '/vehicle-brands/', { name: `Marca ${tag}` }),
  )
  const plate = `MNT-${tag.slice(-4).toUpperCase()}`
  const vehicle = await ok(
    await send(request, 'post', '/vehicles/', {
      plate,
      brand_id: brand.id,
      model: 'Hilux',
      owner_id: customer.id,
    }),
  )
  await ok(
    await send(request, 'post', '/services/', {
      name: `Alineación y balanceo de las cuatro ruedas con revisión de suspensión ${tag}`,
      reference_price: '25.00',
      tax_definition_id: tax?.id,
      idempotency_key: `e2e-mnt-srv-${tag}`,
    }),
  )
  await page.reload()
  return { tag, customer, vehicle, plate }
}

test('ciclo de una orden de mantenimiento y acceso por rol', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'admin_e2e')
  const world = await seed(page)

  await page.goto(
    `/maintenance/new?customer_id=${world.customer.id}&customer_name=${encodeURIComponent(world.customer.name)}`,
  )
  await page
    .getByLabel('Vehículo', { exact: true })
    .selectOption(String(world.vehicle.id))
  await page.getByLabel('Kilometraje (km)').fill('85000')
  await page.screenshot({ path: `${EVIDENCE}/01-editor.png`, fullPage: true })
  await page.getByRole('button', { name: 'Registrar orden' }).click()
  const heading = page.getByRole('heading', { name: /ART-OT-/ })
  await expect(heading).toBeVisible()
  const orderNumber = (await heading.textContent())?.trim() ?? ''
  await expectNoSeriousAccessibilityViolations(page, RAIL_EXCEPTION)

  await page.getByRole('button', { name: /Agregar servicio/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Servicio del catálogo' }).click()
  await page
    .getByRole('option', { name: new RegExp(`suspensión ${world.tag}`) })
    .click()
  await page.screenshot({ path: `${EVIDENCE}/06-agregar-servicio.png` })
  await dialog.getByLabel('Precio aplicado a esta orden (USD)').fill('30.00')
  await dialog.getByRole('button', { name: 'Agregar servicio' }).click()
  await expect(
    page.getByText('Total de servicios de la orden').first(),
  ).toBeVisible()

  // Las fotografías viven en su pestaña de la ficha de la orden.
  await page.getByRole('tab', { name: /Fotografías/ }).click()
  await page.getByRole('button', { name: /Adjuntar fotografía/ }).click()
  const upload = page.getByRole('dialog')
  await upload
    .getByLabel('Imagen', { exact: true })
    .setInputFiles({ name: 'golpe.jpg', mimeType: 'image/jpeg', buffer: JPEG })
  await upload.getByLabel('Descripción (opcional)').fill('Golpe lateral')
  await upload.getByRole('button', { name: 'Adjuntar' }).click()
  await expect(page.getByAltText('Golpe lateral')).toBeVisible()
  await page.getByRole('tab', { name: 'Trabajo y servicios' }).click()

  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(
    page.getByText('Requisitos pendientes para finalizar'),
  ).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/02-finalizar-pendiente.png` })
  await page.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: /Editar datos/ }).click()
  await page
    .getByLabel('Diagnóstico', { exact: true })
    .fill('Desalineación y golpe lateral')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await page.getByRole('button', { name: 'Finalizar orden' }).click()
  await expect(
    page.getByText('Orden finalizada', { exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: /Reabrir/ }).click()
  await page
    .getByLabel('Causa de la reapertura')
    .fill('Vibración tras la alineación')
  await page.getByRole('button', { name: 'Reabrir orden' }).click()
  await expect(
    page.getByRole('heading', { name: 'Corrección 1 en curso' }),
  ).toBeVisible()
  await page
    .getByLabel('Trabajo correctivo realizado')
    .fill('Se reajustó la convergencia y se verificó el balanceo.')
  await page.getByRole('button', { name: 'Guardar corrección' }).click()
  await expect(page.getByText('Sin cambios pendientes.')).toBeVisible()
  await page.screenshot({
    path: `${EVIDENCE}/03-detalle-reabierta.png`,
    fullPage: true,
  })

  await goToSection(page, 'Mantenimientos')
  await expect(
    page.getByRole('heading', { name: 'Mantenimientos' }),
  ).toBeVisible()
  // Deja terminar el repintado del esqueleto de carga antes de la evidencia visual.
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${EVIDENCE}/04-lista.png`, fullPage: true })

  await page.goto(`/vehicles/${world.vehicle.id}`)
  await expect(
    page.getByRole('heading', { name: 'Historial de mantenimientos' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: orderNumber })).toBeVisible()
  await page.screenshot({
    path: `${EVIDENCE}/05-historial-vehiculo.png`,
    fullPage: true,
  })

  const detailUrl = await page
    .getByRole('link', { name: /ART-OT-/ })
    .first()
    .getAttribute('href')
  const photo = await (
    await page.request.get(
      `${API}${detailUrl?.replace('/maintenance', '/maintenance-orders')}/`,
    )
  ).json()

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await login(page, 'vendedor_e2e')
  await page.goto('/maintenance')
  await expect(
    page.getByRole('heading', { name: 'Acceso no permitido' }),
  ).toBeVisible()
  const denied = await page.request.get(photo.photos[0].file_url)
  expect(denied.status()).toBe(403)
})
