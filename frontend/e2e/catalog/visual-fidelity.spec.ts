import path from 'node:path'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

test('resuelve los baselines aprobados fuera del repositorio', () => {
  const evidenceDir = process.env.CATALOG_EVIDENCE_DIR
  expect(evidenceDir).toBeTruthy()
  expect(test.info().snapshotPath('probe.png')).toContain(
    path.join(evidenceDir!, 'approved'),
  )
})

test('valida el manifiesto y los checksums de las 22 referencias Figma', async () => {
  const evidenceDir = process.env.CATALOG_EVIDENCE_DIR!
  expect(path.resolve(evidenceDir)).not.toContain(
    path.resolve(process.cwd()) + path.sep,
  )

  for (const directory of ['figma', 'actual', 'diff', 'approved']) {
    await expect(access(path.join(evidenceDir, directory))).resolves.toBe(
      undefined,
    )
  }

  const manifest = JSON.parse(
    await readFile(path.join(evidenceDir, 'manifest.json'), 'utf8'),
  ) as {
    componentSchema: { required: string[] }
    components: Array<{
      actual: string
      id: string
      kind: 'A' | 'E'
      nodesOrAdaptation: string[] | 'A'
      sha256: string
      status: string
    }>
    frames: Array<{ file: string; nodeId: string; sha256: string }>
  }
  expect(manifest.frames).toHaveLength(22)
  expect(manifest.componentSchema.required).toEqual(
    expect.arrayContaining([
      'id',
      'variant',
      'frameRef',
      'nodesOrAdaptation',
      'viewport',
      'deviceScaleFactor',
      'browser',
      'source',
      'masks',
      'threshold',
      'sha256',
    ]),
  )

  for (const frame of manifest.frames) {
    expect(frame.nodeId).toMatch(/^4:\d+$/)
    const bytes = await readFile(path.join(evidenceDir, frame.file))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(frame.sha256)
  }

  expect(manifest.components).toHaveLength(66)
  expect(
    new Set(manifest.components.map((component) => component.id)).size,
  ).toBe(66)
  for (const component of manifest.components) {
    expect(component.kind === 'A' || component.nodesOrAdaptation !== 'A').toBe(
      true,
    )
    expect(component.status).toBe('in-progress')
    const bytes = await readFile(path.join(evidenceDir, component.actual))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      component.sha256,
    )
  }
})

test('los tokens canónicos evitan bordes currentColor y superficies transparentes', async ({
  page,
}) => {
  await page.goto('/visual-catalog.html#isolate=true&id=C22')
  const metricCard = page.getByRole('article').first()
  await expect(metricCard).toBeVisible()
  await expect(metricCard).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(metricCard).toHaveCSS('border-top-width', '0px')

  await page.goto('/visual-catalog.html#isolate=true&id=C34')
  const table = page.getByRole('table', { name: 'Historial sintético' })
  await expect(table).toBeVisible()
  await expect(table.locator('thead')).toHaveCSS(
    'background-color',
    'rgb(250, 250, 251)',
  )
  await expect(table).toHaveCSS('border-top-color', 'rgb(231, 230, 235)')
})
