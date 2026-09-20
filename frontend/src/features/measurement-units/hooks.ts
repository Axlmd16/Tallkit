import { createCatalogHooks } from '@/shared/api/catalog-hooks'

import { measurementUnitsApi } from './api'
import type { MeasurementUnit } from './types'

/** Categorías, unidades y marcas alimentan filtros y formularios de productos. */
const hooks = createCatalogHooks<MeasurementUnit>({
  key: 'measurement-units',
  api: measurementUnitsApi,
  related: ['products'],
})

export const useMeasurementUnitList = hooks.useList
export const useMeasurementUnitDetail = hooks.useDetail
export const useMeasurementUnitMutations = hooks.useMutations
