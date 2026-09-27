import { useQuery } from '@tanstack/react-query'

import { environment } from '@/shared/config/env'

import { ApiClient } from './client'

/** Entidad fiscal emisora de un documento interno. */
export type IssuerScope = 'COMERCIAL' | 'ARTESANAL'

export interface EntityLogo {
  url: string
  revision: number
  content_type: string
  width: number
  height: number
  size_bytes: number
  uploaded_at: string
}

export interface EntityBrand {
  entity_id: number
  legal_name: string
  display_name: string
  logo: EntityLogo | null
}

export type EntityLogoSummary = Record<IssuerScope, EntityBrand | null>

export const entityLogoKeys = {
  summary: ['entity-logos'] as const,
}

const defaultClient = new ApiClient(environment.apiBaseUrl)

export function fetchEntityLogos(
  client: Pick<ApiClient, 'request'> = defaultClient,
): Promise<EntityLogoSummary> {
  return client.request<EntityLogoSummary>(
    '/workshop-configuration/entity-logos/',
  )
}

export interface IssuerBrand {
  /** `undefined` mientras se consulta; `null` si la entidad no tiene logotipo. */
  logoUrl: string | null | undefined
  /** Razón social vigente de la entidad, útil para borradores sin datos conservados. */
  legalName: string | undefined
  /** Nombre comercial vigente, con reserva a la razón social. */
  displayName: string | undefined
}

export interface IssuerBrandStatus extends IssuerBrand {
  isPending: boolean
  isError: boolean
  retry: () => void
}

function useEntityLogosQuery() {
  return useQuery({
    queryKey: entityLogoKeys.summary,
    queryFn: () => fetchEntityLogos(),
    staleTime: 5 * 60_000,
  })
}

function selectIssuerBrand(
  query: ReturnType<typeof useEntityLogosQuery>,
  scope: IssuerScope,
): IssuerBrand {
  if (query.isPending) {
    return {
      logoUrl: undefined,
      legalName: undefined,
      displayName: undefined,
    }
  }
  const brand = query.data?.[scope] ?? null
  return {
    logoUrl: brand?.logo?.url ?? null,
    legalName: brand?.legal_name,
    displayName: brand?.display_name,
  }
}

/**
 * Identidad visual vigente del emisor de un documento. Solo devuelve el logotipo de la
 * entidad pedida, de modo que una hoja nunca muestra el de la otra; si la consulta falla,
 * la hoja se queda con el nombre del emisor.
 */
export function useIssuerBrand(scope: IssuerScope): IssuerBrand {
  const query = useEntityLogosQuery()
  return selectIssuerBrand(query, scope)
}

export function useIssuerBrandStatus(scope: IssuerScope): IssuerBrandStatus {
  const query = useEntityLogosQuery()
  return {
    ...selectIssuerBrand(query, scope),
    isPending: query.isPending,
    isError: query.isError,
    retry: () => {
      void query.refetch()
    },
  }
}
