import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import documentSource from './ProformaDocument.tsx?raw'
// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'
import pageSource from '@/pages/proformas/ProformaDocumentPage.tsx?raw'

const mocks = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))

vi.mock('./hooks', () => ({
  useProformaDocument: () => mocks.query,
}))
vi.mock('@/features/proformas/hooks', () => ({
  useProformaDocument: () => mocks.query,
}))

import { ProformaDocumentPage } from '@/pages/proformas/ProformaDocumentPage'

import { ProformaDocument } from './ProformaDocument'
import type { ProformaDocument as DocumentData } from './types'

const data = (overrides: Partial<DocumentData> = {}): DocumentData => ({
  notice:
    'Cotización interna e informativa. No reserva unidades ni garantiza disponibilidad o precio al comprar: la venta revalida los valores vigentes. No es una factura electrónica autorizada por el SRI.',
  number: 'COM-PRO-000001',
  state: 'VALID',
  issue_date: '2026-10-06',
  valid_until: '2026-10-13',
  issuer: {
    id: 1,
    type: 'COMERCIAL',
    ruc: '1790000000001',
    legal_name: 'Comercial SA',
    trade_name: 'Repuestos Andinos',
    address: null,
    phone: null,
    email: null,
  },
  has_logo: true,
  customer: {
    id: 3,
    name: 'Ana Pérez',
    identification_type: 'CI',
    identification: '1712345678',
    phone: '0999999999',
  },
  lines: [
    {
      position: 1,
      product_code: 'FIL-1',
      manufacturer_code: 'FAB-778',
      brand_name: 'Eaton',
      product_name: 'Filtro',
      is_kit: false,
      quantity: '3',
      unit_price: '11.50',
      tax_rate: '15',
      base_amount: '30.00',
      tax_amount: '4.50',
      total_amount: '34.50',
      availability_at_issue: '1',
      availability_sufficient: false,
    },
  ],
  base_total: '30.00',
  tax_total: '4.50',
  grand_total: '34.50',
  availability_observed_at: '2026-10-06T10:00:00-05:00',
  current_availability: [
    { position: 1, product_code: 'FIL-1', available: '6' },
  ],
  origin: null,
  ...overrides,
})

describe('ProformaDocument', () => {
  it('muestra identidad, vigencia, líneas, impuestos, totales, avisos y estado históricos', () => {
    render(<ProformaDocument data={data()} id={7} />)
    const sheet = screen.getByRole('article', { name: 'Proforma' })
    expect(within(sheet).getByText('COTIZACIÓN')).toBeInTheDocument()
    expect(within(sheet).queryByText('COMPROBANTE INTERNO')).toBeNull()
    expect(within(sheet).getByText('Vigente')).toBeInTheDocument()
    expect(within(sheet).getByText('COM-PRO-000001')).toHaveClass('font-mono')
    expect(within(sheet).getByText('06/10/2026')).toBeInTheDocument()
    expect(within(sheet).getByText('13/10/2026')).toBeInTheDocument()
    expect(
      within(sheet).getByText(/Ana Pérez · CI 1712345678/),
    ).toBeInTheDocument()
    expect(within(sheet).getByText('1790000000001')).toBeInTheDocument()
    expect(within(sheet).getByText('USD 30.00')).toBeInTheDocument()
    expect(within(sheet).getByText('USD 4.50')).toBeInTheDocument()
    expect(within(sheet).getAllByText('USD 34.50').length).toBeGreaterThan(0)
  })

  it('muestra el código del producto, el del fabricante y la marca', () => {
    render(<ProformaDocument data={data()} id={7} />)
    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Código',
      'Cód. fabricante',
      'Marca',
      'Descripción',
      'Cantidad',
      'Precio',
      'Total',
    ])
    const row = screen.getByRole('row', { name: /FIL-1/ })
    expect(within(row).getByText('FAB-778')).toHaveClass('font-mono')
    expect(within(row).getByText('Eaton')).toBeInTheDocument()
  })

  it('un producto sin código de fabricante ni marca muestra guiones', () => {
    const base = data()
    render(
      <ProformaDocument
        data={{
          ...base,
          lines: [{ ...base.lines[0]!, manufacturer_code: '', brand_name: '' }],
        }}
        id={7}
      />,
    )
    expect(
      within(screen.getByRole('row', { name: /FIL-1/ })).getAllByText('—'),
    ).toHaveLength(2)
  })

  it('una descripción extensa baja de línea sin deformar la tabla', () => {
    const base = data()
    const long =
      'Kit de embrague reforzado con disco, plato de presión, rodamiento axial y guía de centrado para transmisión de 18 velocidades servicio pesado'
    render(
      <ProformaDocument
        data={{ ...base, lines: [{ ...base.lines[0]!, product_name: long }] }}
        id={7}
      />,
    )
    const table = screen.getByRole('table')
    expect(table).toHaveClass('quote-lines')
    expect(table.querySelectorAll('col')).toHaveLength(7)
    expect(within(table).getByText(long)).toBeInTheDocument()
    const sheetStyles: string = fs.readFileSync(
      'src/shared/ui/business/document-sheet.css',
      'utf8',
    )
    expect(sheetStyles).toMatch(
      /table\.quote-lines \{[^}]*table-layout: fixed[^}]*font-size: 11\.5px/,
    )
    expect(sheetStyles).toMatch(/overflow-wrap: break-word/)
  })

  it('es la hoja para el cliente: sin disponibilidad, avisos internos ni pie de sistema', () => {
    render(<ProformaDocument data={data()} id={7} />)
    const text = screen.getByRole('article').textContent ?? ''
    expect(text).not.toMatch(/disponib|insuficiente|reserva/i)
    expect(text).not.toMatch(/Cotización interna|factura electrónica|SRI/i)
    expect(text).not.toMatch(/Generado con Tallkit/i)
    expect(documentSource).not.toMatch(/availability|data\.notice/)
  })

  it('usa el logo histórico de la oferta y nunca la marca vigente', () => {
    render(<ProformaDocument data={data()} id={7} />)
    const logo = screen.getByRole('img', { name: 'Logo de Repuestos Andinos' })
    expect(logo.getAttribute('src')).toMatch(
      /\/proformas\/7\/document\/logo\/$/,
    )
    for (const source of [documentSource, pageSource]) {
      expect(source).not.toMatch(/useIssuerBrand|entity-logos/)
    }
  })

  it('emitida sin logo muestra solo el emisor, sin hueco ni otro logo', () => {
    const ready = vi.fn()
    render(
      <ProformaDocument
        data={data({ has_logo: false })}
        id={7}
        onBrandReady={ready}
      />,
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(
      within(screen.getByRole('group', { name: 'Emisor' })).getByText(
        'Repuestos Andinos',
      ),
    ).toBeInTheDocument()
    expect(ready).toHaveBeenCalledWith(true)
  })

  it('no incluye condición de cobro, costos ni identidad artesanal', () => {
    render(<ProformaDocument data={data()} id={7} />)
    const text = screen.getByRole('article').textContent ?? ''
    expect(text).not.toMatch(/contado|crédito|costo|artesanal|ART-/i)
    expect(documentSource).not.toMatch(
      /conditionLabels|\.condition|cost_|average|ARTESANAL/,
    )
  })

  it.each([
    ['EXPIRED', 'Vencida', /Proforma vencida/],
    ['VOIDED', 'Anulada', /Proforma anulada/],
    ['CONVERTED', 'Convertida', /Proforma convertida/],
  ] as const)(
    'en estado %s indica el estado y conserva vigencia y valores',
    (state, label, note) => {
      render(<ProformaDocument data={data({ state })} id={7} />)
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
      expect(screen.getByText(note)).toHaveTextContent(
        'Se conservan el número, la vigencia y los valores originales',
      )
      expect(screen.getAllByText('USD 34.50').length).toBeGreaterThan(0)
      expect(screen.getByText(/13\/10\/2026/)).toBeInTheDocument()
    },
  )
})

describe('ProformaDocumentPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/proformas/7/document']}>
        <Routes>
          <Route
            element={<ProformaDocumentPage />}
            path="/proformas/:id/document"
          />
        </Routes>
      </MemoryRouter>,
    )
  }

  beforeEach(() => {
    mocks.query = { isPending: false, isError: false, data: data() }
  })

  it('espera la imagen antes de habilitar imprimir y usa la impresión del navegador', async () => {
    const user = userEvent.setup()
    const print = vi.fn()
    vi.stubGlobal('print', print)
    renderPage()
    const button = screen.getByRole('button', {
      name: 'Imprimir o guardar PDF',
    })
    expect(button).toBeDisabled()
    fireEvent.load(screen.getByRole('img', { name: /Logo de/ }))
    expect(button).toBeEnabled()
    await user.click(button)
    expect(print).toHaveBeenCalledTimes(1)
    expect(pageSource).not.toMatch(/jspdf|html2pdf|pdfmake|\.pdf/i)
    vi.unstubAllGlobals()
  })

  it('si el logo histórico no carga, se imprime sin imagen incompleta', () => {
    renderPage()
    fireEvent.error(screen.getByRole('img', { name: /Logo de/ }))
    expect(screen.queryByRole('img')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Imprimir o guardar PDF' }),
    ).toBeEnabled()
  })

  it('sin logo original imprimir está disponible de inmediato', () => {
    mocks.query = {
      isPending: false,
      isError: false,
      data: data({ has_logo: false }),
    }
    renderPage()
    expect(
      screen.getByRole('button', { name: 'Imprimir o guardar PDF' }),
    ).toBeEnabled()
  })

  it('un borrador no tiene documento y ofrece volver', () => {
    mocks.query = { isPending: false, isError: true }
    renderPage()
    expect(
      screen.getByText('El documento solo existe para proformas emitidas.', {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Volver a la proforma' }),
    ).toHaveAttribute('href', '/proformas/7')
  })
})
