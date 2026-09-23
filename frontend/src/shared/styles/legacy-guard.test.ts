import { expect, it } from 'vitest'

// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'
// @ts-expect-error Node path module used in test runner
import path from 'node:path'

// @ts-expect-error Node process object in test runner
const cwd: string = process.cwd()

/** Restos de la plantilla SAAS Dashboard retirada por el rediseño Tallkit. */
const LEGACY = /Nunito|#605bff|#4f4ae8|#efeeff|@\/assets\/figma/i

/**
 * Deuda conocida que las fases 2 a 4 eliminan. La lista debe quedar vacía en la tarea 11.3:
 * un archivo nuevo con restos o un archivo ya limpio que siga aquí hacen fallar la prueba.
 */
const PENDING = [
  'src/assets/figma/category.svg',
  'src/shared/styles/index.css',
  'src/shared/ui/charts/BarChart.tsx',
  'src/shared/ui/charts/DonutChart.tsx',
  'src/shared/ui/charts/LineAreaChart.tsx',
  'src/shared/ui/data/Progress.tsx',
  'src/shared/ui/icons/index.tsx',
]

function files(dir: string): string[] {
  const entries = fs.readdirSync(path.resolve(cwd, dir), {
    withFileTypes: true,
  }) as { name: string; isDirectory: () => boolean }[]
  return entries.flatMap((entry) => {
    const full = `${dir}/${entry.name}`
    if (entry.isDirectory()) return files(full)
    return /\.(tsx?|css|svg)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [full]
      : []
  })
}

it('no quedan restos de la plantilla fuera de la deuda registrada', () => {
  const offenders = files('src')
    .filter((file) =>
      LEGACY.test(fs.readFileSync(path.resolve(cwd, file), 'utf-8')),
    )
    .sort()
  expect(offenders).toEqual([...PENDING].sort())
})
