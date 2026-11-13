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
 * Dirección visual «Grafito y cobre» (U3). Fuera de las hojas impresas no se permiten la fuente
 * anterior, la fuente monoespaciada, los tamaños de letra escritos a mano ni los de Tailwind por defecto (`text-xl`…), el ámbar suelto ni los valores crudos de
 * la paleta anterior: la escala `text-*`, la utilidad `code` y los tokens los reemplazan.
 */
const VISUAL =
  /IBM Plex|font-mono|text-\[\d+(\.\d+)?px\]|\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b|#c98a00|#224368|#15233a|#5b6474|#0f6b6f|#94460b|#e58439|#f3f4f6|#e2e5e9|#cbd1d8|#1a3453|#e6edf6|#e1f0ef|#fceee2|#eef0f3|#e6e9ed|#f8f9fa|#0a5255/i

/** Hojas impresas (PPF-09 y PPF-10) y la declaración de las fuentes: conservan IBM Plex. */
const PRINT = [
  'src/shared/styles/index.css',
  'src/shared/styles/tokens.css',
  'src/shared/ui/business/document-sheet.css',
  'src/shared/ui/business/DocumentSheet.tsx',
  'src/features/product-labels/product-label.css',
  'src/features/product-labels/product-label-print.css',
  'src/features/proformas/ProformaDocument.tsx',
  'src/features/sales/SalesDocument.tsx',
]

/**
 * Deuda conocida que los grupos 3 a 5 de U3 eliminan. Debe quedar vacía en la tarea 5.6: un
 * archivo nuevo que incumpla o un archivo ya limpio que siga aquí hacen fallar la prueba.
 */
const PENDING: string[] = []

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

const read = (file: string) =>
  fs.readFileSync(path.resolve(cwd, file), 'utf-8') as string

it('no quedan restos de la plantilla fuera de la deuda registrada', () => {
  const offenders = files('src')
    .filter((file) => LEGACY.test(read(file)))
    .sort()
  expect(offenders).toEqual([])
})

it('la dirección visual no se incumple fuera de las hojas impresas ni de la deuda registrada', () => {
  const offenders = files('src')
    .filter((file) => !PRINT.includes(file))
    .filter((file) => VISUAL.test(read(file)))
    .sort()
  expect(offenders).toEqual([...PENDING].sort())
})

it('las hojas impresas usan la fuente de impresión y la interfaz nunca la declara', () => {
  expect(read('src/shared/ui/business/document-sheet.css')).toMatch(
    /var\(--tk-font-print\)/,
  )
  expect(read('src/features/product-labels/product-label.css')).toMatch(
    /var\(--tk-font-print\)/,
  )
  const tokens = read('src/shared/styles/tokens.css')
  expect(tokens).toMatch(/--tk-font-sans:\s*'Montserrat'/)
  expect(tokens).toMatch(/--tk-font-print:\s*'IBM Plex Sans'/)
})
