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
    ['--tk-canvas', '#f3f4f6'],
    ['--tk-surface', '#ffffff'],
    ['--tk-line', '#e2e5e9'],
    ['--tk-line-strong', '#cbd1d8'],
    ['--tk-ink', '#15233a'],
    ['--tk-ink-muted', '#5b6474'],
    ['--tk-primary', '#224368'],
    ['--tk-accent', '#0f6b6f'],
    ['--tk-accent-soft', '#e1f0ef'],
    ['--tk-brand', '#e58439'],
    ['--tk-scope-commercial', '#224368'],
    ['--tk-scope-artisan', '#94460b'],
    ['--tk-workspace', '#e6e9ed'],
  ])('declara %s = %s en el tema claro', (name, value) => {
    expect(root.toLowerCase()).toMatch(new RegExp(`${name}:\\s*${value};`))
  })

  it('Tailwind referencia las variables en lugar de valores sueltos', () => {
    expect(index).toMatch(/@theme inline\s*{/)
    expect(index).toMatch(/--color-primary:\s*var\(--tk-primary\)/)
    expect(index).toMatch(/--color-accent:\s*var\(--tk-accent\)/)
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
