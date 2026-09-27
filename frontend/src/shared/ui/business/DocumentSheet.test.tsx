import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'

import { DocumentSheet } from './DocumentSheet'

const NOTICE =
  'Documento interno; no constituye una factura electrónica autorizada por el SRI.'

it('presenta la hoja A4 con marca, tipo, estado, número pendiente y aviso del SRI', () => {
  render(
    <DocumentSheet
      issuer={{ name: 'Repuestos Andinos', logoUrl: null }}
      label="Comprobante de venta"
      meta={[
        { label: 'Fecha operativa', value: '21/09/2026' },
        { label: 'Cliente', value: 'Ana Pérez', wide: true },
      ]}
      notice={NOTICE}
      number={null}
      state="Borrador · Vista previa"
    >
      <p>Líneas</p>
    </DocumentSheet>,
  )
  const sheet = screen.getByRole('article', { name: 'Comprobante de venta' })
  expect(sheet).toHaveTextContent('Tallkit')
  expect(sheet).toHaveTextContent('COMPROBANTE INTERNO')
  expect(sheet).toHaveTextContent('Borrador · Vista previa')
  expect(sheet).toHaveTextContent('Pendiente de confirmación')
  expect(sheet).toHaveTextContent('Ana Pérez')
  expect(sheet).toHaveTextContent(NOTICE)
  expect(sheet).not.toHaveTextContent(/factura electrónica autorizada\s*$/)
  expect(sheet).toHaveClass('document-sheet')
})

it('muestra el número asignado y marca la hoja ocupada mientras se actualiza', () => {
  render(
    <DocumentSheet
      busy
      issuer={{ name: 'Repuestos Andinos', logoUrl: null }}
      label="Comprobante de venta"
      meta={[]}
      notice={NOTICE}
      number="COM-VEN-000131"
      state="Confirmada"
    >
      <p>Líneas</p>
    </DocumentSheet>,
  )
  const sheet = screen.getByRole('article', { name: 'Comprobante de venta' })
  expect(sheet).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('COM-VEN-000131')).toHaveClass('font-mono')
})

it('la impresión quita el marco de la hoja y oculta la navegación', () => {
  const css: string = fs.readFileSync(
    'src/shared/ui/business/document-sheet.css',
    'utf-8',
  )
  expect(css).toMatch(/@media print[\s\S]*\.document-sheet\s*{[^}]*border:\s*0/)
  expect(css).toMatch(/@media print[\s\S]*nav[\s\S]*display:\s*none/)
})

const LOGO = '/api/v1/workshop-configuration/entity-logos/COMERCIAL/2/'

function sheet(logoUrl: string | null | undefined, onBrandReady = vi.fn()) {
  render(
    <DocumentSheet
      issuer={{ name: 'Repuestos Andinos', logoUrl }}
      label="Comprobante"
      meta={[]}
      notice={NOTICE}
      number="COM-VEN-000001"
      onBrandReady={onBrandReady}
      state="Confirmada"
    >
      <p>Líneas</p>
    </DocumentSheet>,
  )
  return onBrandReady
}

it('encabeza la hoja con el logotipo y el nombre del emisor', () => {
  sheet(LOGO)
  const header = screen.getByRole('group', { name: 'Emisor' })
  const logo = screen.getByRole('img', { name: 'Logo de Repuestos Andinos' })
  expect(header).toContainElement(logo)
  expect(logo).toHaveAttribute('src', LOGO)
  expect(logo).toHaveClass('sheet-logo')
  expect(header).toHaveTextContent('Repuestos Andinos')
  expect(header).not.toHaveTextContent('Tallkit')
})

it('sin logotipo muestra solo el nombre del emisor, sin isotipo de Tallkit', () => {
  const ready = sheet(null)
  const header = screen.getByRole('group', { name: 'Emisor' })
  expect(header).toHaveTextContent('Repuestos Andinos')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(header.querySelector('img')).toBeNull()
  expect(ready).toHaveBeenCalledWith(true)
})

it('si la imagen no carga vuelve al nombre sin imagen rota', () => {
  const ready = sheet(LOGO)
  expect(ready).not.toHaveBeenCalled()
  fireEvent.error(
    screen.getByRole('img', { name: 'Logo de Repuestos Andinos' }),
  )
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Emisor' })).toHaveTextContent(
    'Repuestos Andinos',
  )
  expect(ready).toHaveBeenCalledWith(true)
})

it('avisa que la marca está lista cuando el logotipo termina de cargar', () => {
  const ready = sheet(LOGO)
  fireEvent.load(screen.getByRole('img', { name: 'Logo de Repuestos Andinos' }))
  expect(ready).toHaveBeenCalledWith(true)
})

it('mientras se consulta el emisor no declara la marca lista', () => {
  const ready = sheet(undefined)
  expect(ready).not.toHaveBeenCalled()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('deja Tallkit como mención discreta al pie', () => {
  sheet(LOGO)
  const credit = screen.getByText('Generado con Tallkit')
  expect(credit).toHaveClass('sheet-credit')
})

it('acota el logotipo sin deformarlo', () => {
  const css: string = fs.readFileSync(
    'src/shared/ui/business/document-sheet.css',
    'utf-8',
  )
  expect(css).toMatch(/\.sheet-logo\s*{[^}]*object-fit:\s*contain/)
  expect(css).toMatch(/\.sheet-logo\s*{[^}]*max-height:/)
  expect(css).toMatch(/\.sheet-logo\s*{[^}]*max-width:/)
})
