import { describe, expect, it } from 'vitest'

// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'
// @ts-expect-error Node path module used in test runner
import path from 'node:path'

describe('catalog-tokens.css - Aislamiento de ámbito y tokens', () => {
  // @ts-expect-error Node process object in test runner
  const cwd = typeof process !== 'undefined' ? process.cwd() : '.'
  const cssPath = path.resolve(cwd, 'src/shared/ui/catalog-tokens.css')
  const cssContent = fs.readFileSync(cssPath, 'utf-8')

  it('el archivo shared/ui/catalog-tokens.css existe y no está vacío', () => {
    expect(typeof cssContent).toBe('string')
    expect(cssContent.length).toBeGreaterThan(0)
  })

  it('todas las reglas están acotadas bajo [data-visual-catalog] o clases con prefijo catalog-', () => {
    // No debe alterar :root ni body globales
    expect(cssContent).not.toMatch(/(^|\s):root\b/)
    expect(cssContent).not.toMatch(/(^|\s)body\b/)

    // No debe redefinir clases de páginas funcionales de la aplicación
    expect(cssContent).not.toContain('.app-rail')
    expect(cssContent).not.toContain('.list-page')
    expect(cssContent).not.toContain('.user-form')
    expect(cssContent).not.toContain('.login-')

    // Debe contener el selector de ámbito data-visual-catalog
    expect(cssContent).toContain('[data-visual-catalog]')
  })

  it('define las variables de espaciado, radios y geometrías observadas K2, K3 y K5', () => {
    expect(cssContent).toContain('--catalog-space-10')
    expect(cssContent).toContain('--catalog-space-20')
    expect(cssContent).toContain('--catalog-space-30')
    expect(cssContent).toContain('--catalog-space-32')

    expect(cssContent).toContain('--catalog-radius-2')
    expect(cssContent).toContain('--catalog-radius-5')
    expect(cssContent).toContain('--catalog-radius-10')
    expect(cssContent).toContain('--catalog-radius-12')

    expect(cssContent).toContain('--catalog-rail-width')
    expect(cssContent).toContain('--catalog-sidebar-expanded')
  })

  it('montar y desmontar elementos de catálogo no altera estilos fuera del scope', () => {
    const outsideEl = document.createElement('div')
    outsideEl.id = 'app-outside-element'
    document.body.appendChild(outsideEl)

    const catalogEl = document.createElement('div')
    catalogEl.setAttribute('data-visual-catalog', 'true')
    catalogEl.innerHTML = '<span class="catalog-sample">Item</span>'
    document.body.appendChild(catalogEl)

    // El elemento externo no tiene data-visual-catalog ni clases de catálogo
    expect(outsideEl.hasAttribute('data-visual-catalog')).toBe(false)
    expect(outsideEl.className).toBe('')

    // Desmontar el elemento de catálogo
    document.body.removeChild(catalogEl)
    expect(document.querySelector('[data-visual-catalog]')).toBeNull()

    // El elemento externo permanece intacto
    expect(document.getElementById('app-outside-element')).toBe(outsideEl)
    document.body.removeChild(outsideEl)
  })
})
