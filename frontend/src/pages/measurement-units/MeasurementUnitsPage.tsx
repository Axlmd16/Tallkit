import { AuxiliaryCatalogPage } from '@/features/catalog-common/AuxiliaryCatalogPage'
import {
  useMeasurementUnitDetail,
  useMeasurementUnitList,
  useMeasurementUnitMutations,
} from '@/features/measurement-units/hooks'
import type { MeasurementUnit } from '@/features/measurement-units/types'

export function MeasurementUnitsPage() {
  return (
    <AuxiliaryCatalogPage<MeasurementUnit>
      deactivateText={(item) =>
        `¿Desactivar la unidad «${item.name}»? Los productos que ya la usan la conservan, pero no podrá elegirse en productos nuevos.`
      }
      description="Unidades en las que se expresa la presentación de un producto. No definen conversiones."
      extraField={{ name: 'symbol', label: 'Símbolo' }}
      feminine
      fields={[
        { name: 'name', label: 'Nombre', maxLength: 255, required: true },
        {
          name: 'symbol',
          label: 'Símbolo',
          maxLength: 32,
          hint: 'Solo descriptivo, por ejemplo gal o kg.',
        },
      ]}
      idPrefix="unit"
      noun="unidad de medida"
      nounPlural="unidades de medida"
      title="Unidades de medida"
      useDetail={useMeasurementUnitDetail}
      useList={useMeasurementUnitList}
      useMutations={useMeasurementUnitMutations}
    />
  )
}
