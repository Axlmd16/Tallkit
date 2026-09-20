import { ApiClient } from '@/shared/api/client'
import { createCatalogResource } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type { MeasurementUnit } from './types'

export function createMeasurementUnitApi(client: ApiClient) {
  return createCatalogResource<MeasurementUnit>(client, '/measurement-units')
}

export const measurementUnitsApi = createMeasurementUnitApi(
  new ApiClient(environment.apiBaseUrl),
)
