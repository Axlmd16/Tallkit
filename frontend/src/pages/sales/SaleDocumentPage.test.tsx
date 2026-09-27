import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  brands: {} as Record<
    string,
    { logoUrl: string | null | undefined; legalName?: string }
  >,
  scopes: [] as string[],
}))
vi.mock('@/features/sales/hooks', () => ({
  useSaleDocument: () => mocks.query,
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrand: (scope: string) => {
    mocks.scopes.push(scope)
    return mocks.brands[scope] ?? { logoUrl: null, legalName: undefined }
  },
}))

import { SaleDocumentPage } from './SaleDocumentPage'

const document = {
  notice:
    'Documento interno; no constituye una factura electrónica autorizada por el SRI.',
  number: 'COM-VEN-000001',
  state: 'CONFIRMED',
  voided: false,
  void_reason: '',
  voided_at: null,
  issuer: {
    type: 'COMERCIAL',
    ruc: '1790000000001',
    legal_name: 'Comercial SA',
  },
  series_code: 'COM-VEN',
  customer: {
    id: 1,
    name: 'Ana',
    identification_type: 'CI',
    identification: '17',
  },
  condition: 'CREDITO',
  operational_date: '2026-09-20',
  lines: [
    {
      position: 1,
      product_code: 'ACE-1',
      product_name: 'Aceite',
      quantity: '2',
      unit_price: '11.50',
      tax_rate: '15',
      base_amount: '20.00',
      tax_amount: '3.00',
      total_amount: '23.00',
    },
  ],
  base_total: '20.00',
  tax_total: '3.00',
  grand_total: '23.00',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sales/1/document']}>
      <Routes>
        <Route element={<SaleDocumentPage />} path="/sales/:id/document" />
      </Routes>
    </MemoryRouter>,
  )
}

const COMMERCIAL_LOGO =
  '/api/v1/workshop-configuration/entity-logos/COMERCIAL/2/'

beforeEach(() => {
  mocks.query = { isPending: false, isError: false, data: document }
  mocks.brands = {
    COMERCIAL: { logoUrl: null, legalName: 'Comercial SA' },
    ARTESANAL: {
      logoUrl: '/api/v1/workshop-configuration/entity-logos/ARTESANAL/1/',
      legalName: 'Taller SA',
    },
  }
  mocks.scopes = []
})

it('encabeza el comprobante con el logotipo comercial y nunca con el artesanal', () => {
  mocks.brands.COMERCIAL = {
    logoUrl: COMMERCIAL_LOGO,
    legalName: 'Comercial SA',
  }
  renderPage()
  const logo = screen.getByRole('img', { name: 'Logo de Comercial SA' })
  expect(logo).toHaveAttribute('src', COMMERCIAL_LOGO)
  expect(mocks.scopes.every((scope) => scope === 'COMERCIAL')).toBe(true)
  expect(screen.getByRole('group', { name: 'Emisor' })).toHaveTextContent(
    'Comercial SA',
  )
})

it('sin logotipo comercial muestra solo el nombre del emisor', () => {
  renderPage()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Emisor' })).toHaveTextContent(
    'Comercial SA',
  )
})

it('espera a que cargue el logotipo antes de permitir imprimir', () => {
  mocks.brands.COMERCIAL = {
    logoUrl: COMMERCIAL_LOGO,
    legalName: 'Comercial SA',
  }
  renderPage()
  const button = screen.getByRole('button', { name: 'Imprimir comprobante' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
  fireEvent.load(screen.getByRole('img', { name: 'Logo de Comercial SA' }))
  expect(button).toBeEnabled()
})

it('muestra datos históricos, número, RUC comercial, cliente, desglose y el aviso del SRI', () => {
  renderPage()
  const sheet = screen.getByRole('article', { name: 'Comprobante de venta' })
  expect(sheet).toHaveTextContent('COM-VEN-000001')
  expect(sheet).toHaveTextContent(
    'Comercial SA · RUC 1790000000001 (comercial)',
  )
  expect(sheet).toHaveTextContent('Ana')
  expect(sheet).toHaveTextContent('USD 20.00')
  expect(sheet).toHaveTextContent('USD 3.00')
  expect(sheet).toHaveTextContent('USD 23.00')
  expect(sheet).toHaveTextContent(
    'no constituye una factura electrónica autorizada por el SRI',
  )
  expect(sheet).toHaveTextContent('Confirmada')
  expect(sheet).not.toHaveTextContent(/costo/i)
})

it('los controles de navegación y acciones se marcan para ocultarse al imprimir', () => {
  renderPage()
  const controls = screen.getByRole('link', {
    name: 'Volver a la venta',
  }).parentElement
  expect(controls).toHaveClass('no-print')
  expect(
    screen.getByRole('button', { name: 'Imprimir comprobante' }),
  ).toBeInTheDocument()
})

it('imprime con la impresión del navegador, sin PDF ni motor adicional', async () => {
  const print = vi.fn()
  vi.stubGlobal('print', print)
  renderPage()
  await userEvent.click(
    screen.getByRole('button', { name: 'Imprimir comprobante' }),
  )
  expect(print).toHaveBeenCalledTimes(1)
})

it('una venta anulada conserva número y valores e indica la anulación', () => {
  mocks.query = {
    isPending: false,
    isError: false,
    data: {
      ...document,
      state: 'VOIDED',
      voided: true,
      void_reason: 'Error de captura',
    },
  }
  renderPage()
  const sheet = screen.getByRole('article', { name: 'Comprobante de venta' })
  expect(sheet).toHaveTextContent('Venta anulada: Error de captura')
  expect(sheet).toHaveTextContent('COM-VEN-000001')
  expect(sheet).toHaveTextContent('USD 23.00')
})

it('presenta carga y error con ruta de retorno', () => {
  mocks.query = { isPending: true, isError: false }
  const first = renderPage()
  expect(screen.getByText('Cargando comprobante…')).toBeInTheDocument()
  first.unmount()
  mocks.query = { isPending: false, isError: true }
  renderPage()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se pudo cargar el comprobante',
  )
})

it('el CSS de impresión oculta navegación y quita el marco de la hoja', async () => {
  // @ts-expect-error Node fs module used in test runner
  const fs = await import('node:fs')
  const css: string = fs.readFileSync(
    'src/shared/ui/business/document-sheet.css',
    'utf-8',
  )
  expect(css).toMatch(
    /@media print[\s\S]*\.no-print[\s\S]*display:\s*none\s*!important/,
  )
  expect(css).toMatch(/@media print[\s\S]*\.document-sheet\s*{[^}]*border:\s*0/)
})
