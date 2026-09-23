import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'

import { DocumentSheet } from './DocumentSheet'

const NOTICE =
  'Documento interno; no constituye una factura electrónica autorizada por el SRI.'

it('presenta la hoja A4 con marca, tipo, estado, número pendiente y aviso del SRI', () => {
  render(
    <DocumentSheet
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
