import { describe, expect, it } from 'vitest'

// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'
// @ts-expect-error Node path module used in test runner
import path from 'node:path'

// @ts-expect-error Node process object in test runner
const cwd: string = process.cwd()
const read = (file: string) =>
  fs.readFileSync(path.resolve(cwd, file), 'utf-8') as string

function sourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(path.resolve(cwd, dir), {
    withFileTypes: true,
  }) as { name: string; isDirectory: () => boolean }[]
  return entries.flatMap((entry) => {
    const full = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [full]
      : []
  })
}

describe('tokens Tallkit', () => {
  const tokens = read('src/shared/styles/tokens.css')
  const index = read('src/shared/styles/index.css')
  const root = tokens.slice(
    tokens.indexOf(':root'),
    tokens.indexOf('}', tokens.indexOf(':root')),
  )

  it.each([
    ['--tk-canvas', '#f4f3f0'],
    ['--tk-surface', '#ffffff'],
    ['--tk-surface-subtle', '#f8f7f4'],
    ['--tk-surface-muted', '#efeeeb'],
    ['--tk-line', '#e4e1dc'],
    ['--tk-line-strong', '#d5d1cb'],
    ['--tk-line-dashed', '#ccc8c1'],
    ['--tk-ink', '#1c1f23'],
    ['--tk-ink-muted', '#5e6369'],
    ['--tk-graphite', '#1e2226'],
    ['--tk-graphite-raised', '#2c3137'],
    ['--tk-graphite-line', '#30353b'],
    ['--tk-graphite-ink', '#bec2c7'],
    ['--tk-primary', '#b5582a'],
    ['--tk-primary-strong', '#9c4a22'],
    ['--tk-primary-soft', '#f5e8e0'],
    ['--tk-accent', '#4a6280'],
    ['--tk-accent-strong', '#3e546f'],
    ['--tk-scope-artisan', '#4a6280'],
    ['--tk-scope-artisan-ink', '#3e546f'],
    ['--tk-scope-artisan-soft', '#e9edf2'],
    ['--tk-scope-commercial', '#8c6b3f'],
    ['--tk-scope-commercial-ink', '#6e5430'],
    ['--tk-scope-commercial-soft', '#f2ece2'],
    ['--tk-success', '#2f6b4a'],
    ['--tk-warning', '#855e16'],
    ['--tk-danger', '#a8392f'],
    ['--tk-info', '#44484e'],
    ['--tk-info-soft', '#ecebe8'],
    ['--tk-workspace', '#eae7e2'],
  ])('declara %s = %s en el tema claro', (name, value) => {
    expect(root.toLowerCase()).toMatch(new RegExp(`${name}:\\s*${value};`))
  })

  it('la marca es un alias del cobre y las fuentes son Montserrat e IBM Plex solo para impresión', () => {
    expect(root).toMatch(/--tk-brand:\s*var\(--tk-primary\)/)
    expect(root).toMatch(/--tk-font-sans:\s*'Montserrat'/)
    expect(root).toMatch(/--tk-font-print:\s*'IBM Plex Sans'/)
    expect(root).not.toMatch(/--tk-font-sans:[^;]*IBM Plex/)
  })

  it('declara la escala de letra --text-* y la utilidad code', () => {
    const scale: [string, string][] = [
      ['micro', '0.71875rem'],
      ['label', '0.78125rem'],
      ['body', '0.875rem'],
      ['lead', '0.9375rem'],
      ['block', '1rem'],
      ['figure', '1.25rem'],
      ['page', '1.5rem'],
      ['display', '1.875rem'],
    ]
    for (const [name, size] of scale) {
      expect(index).toMatch(new RegExp(`--text-${name}:\\s*${size};`))
      expect(index).toMatch(new RegExp(`--text-${name}--line-height:`))
    }
    expect(index).toMatch(/@utility code\s*{[^}]*tabular-nums/)
    expect(index).toMatch(/@utility code\s*{[^}]*letter-spacing:\s*0\.04em/)
  })

  it('declara Montserrat local en 300, 400, 500, 600 y 700', () => {
    for (const weight of [300, 400, 500, 600, 700]) {
      expect(index).toContain(
        `@fontsource/montserrat/files/montserrat-latin-${weight}-normal.woff2`,
      )
    }
  })

  it('Tailwind referencia las variables en lugar de valores sueltos', () => {
    expect(index).toMatch(/@theme inline\s*{/)
    expect(index).toMatch(/--color-primary:\s*var\(--tk-primary\)/)
    expect(index).toMatch(/--color-accent:\s*var\(--tk-accent\)/)
    expect(index).toMatch(/--color-graphite:\s*var\(--tk-graphite\)/)
    expect(index).toMatch(/--radius-card:\s*1rem/)
    expect(index).not.toMatch(/@theme static/)
  })

  it('documenta el tema oscuro sin activarlo en ninguna parte', () => {
    expect(tokens).toMatch(/\[data-theme='dark'\]\s*{/)
    for (const file of sourceFiles('src')) {
      const text = read(file)
      expect(text, file).not.toMatch(/prefers-color-scheme:\s*dark/)
      if (!file.endsWith('tokens.css')) {
        expect(text, file).not.toMatch(/data-theme/)
      }
    }
  })
})
