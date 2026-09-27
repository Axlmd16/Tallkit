import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import {
  fetchEntityLogos,
  useIssuerBrand,
  type EntityLogoSummary,
} from './entity-logos'

const SUMMARY: EntityLogoSummary = {
  COMERCIAL: {
    entity_id: 1,
    legal_name: 'Repuestos Andinos',
    logo: {
      url: '/api/v1/workshop-configuration/entity-logos/COMERCIAL/3/',
      revision: 3,
      content_type: 'image/png',
      width: 300,
      height: 100,
      size_bytes: 1200,
      uploaded_at: '2026-09-27T10:00:00Z',
    },
  },
  ARTESANAL: { entity_id: 2, legal_name: 'Taller Andino', logo: null },
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

afterEach(() => vi.unstubAllGlobals())

it('consulta el resumen de logotipos de las entidades', async () => {
  const request = vi.fn().mockResolvedValue(SUMMARY)
  await expect(fetchEntityLogos({ request } as never)).resolves.toBe(SUMMARY)
  expect(request).toHaveBeenCalledWith('/workshop-configuration/entity-logos/')
})

it('devuelve solo el logotipo de la entidad pedida', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(SUMMARY), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
  const commercial = renderHook(() => useIssuerBrand('COMERCIAL'), { wrapper })
  expect(commercial.result.current.logoUrl).toBeUndefined()
  await waitFor(() =>
    expect(commercial.result.current.logoUrl).toBe(
      '/api/v1/workshop-configuration/entity-logos/COMERCIAL/3/',
    ),
  )
  expect(commercial.result.current.legalName).toBe('Repuestos Andinos')

  const artisanal = renderHook(() => useIssuerBrand('ARTESANAL'), { wrapper })
  await waitFor(() => expect(artisanal.result.current.logoUrl).toBeNull())
  expect(artisanal.result.current.legalName).toBe('Taller Andino')
})

it('sin respuesta del servidor deja la hoja con el nombre del emisor', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('red')))
  const { result } = renderHook(() => useIssuerBrand('COMERCIAL'), { wrapper })
  await waitFor(() => expect(result.current.logoUrl).toBeNull())
})
