import { ListBullets, Plus, Trash } from '@phosphor-icons/react'

import { Button, Field, InlineNotice, Input, Select } from '@/shared/ui'

import { emptyLine, type LineDraft } from './draft'
import { useProductOptions } from './pickers'
import { ReferencePicker } from './ReferencePicker'
import { usd } from './format'
import type { CommercialTaxOption, MoneyBlock } from './types'

export const MAX_LINES = 200

/**
 * Editor de líneas: cada línea es un grupo etiquetado (también en ancho móvil). Los
 * importes que se muestran son los calculados por el backend; nunca se calculan aquí.
 */
export function LinesEditor({
  lines,
  onChange,
  errors,
  taxOptions,
  amounts,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  errors: Record<string, string>
  taxOptions: CommercialTaxOption[]
  /** Importes calculados por el servidor para la última versión guardada. */
  amounts: (MoneyBlock | null)[]
}) {
  function patch(index: number, changes: Partial<LineDraft>) {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    )
  }

  return (
    <section aria-label="Líneas del ingreso" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-group bg-cyan-soft text-cyan">
          <ListBullets aria-hidden="true" size={22} />
        </span>
        <div>
          <h2 className="font-bold text-ink">Productos recibidos</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Registre cantidades, costos e impuesto por cada presentación.
          </p>
        </div>
      </div>
      {lines.length === 0 && (
        <InlineNotice title="Sin líneas" tone="info">
          Puede guardar el borrador sin líneas y continuar después; para
          confirmar necesita al menos una.
        </InlineNotice>
      )}
      {lines.map((line, index) => {
        const prefix = `lines.${index}`
        const option = taxOptions.find((o) => o.id === line.taxDefinitionId)
        const inactive = line.product?.inactive
        return (
          <fieldset
            className="space-y-4 rounded-group border border-line bg-surface p-5"
            key={line.key}
          >
            <legend className="px-2 font-semibold text-ink">
              Línea {index + 1}
            </legend>
            <ReferencePicker
              error={errors[`${prefix}.product_id`]}
              id={`line-${line.key}-product`}
              inactiveHelp="Producto inactivo: se conserva legible, pero impide confirmar mientras siga inactivo."
              label="Producto"
              onSelect={(product) =>
                patch(index, {
                  product,
                  ...(line.taxDefinitionId === null && product?.taxDefinitionId
                    ? { taxDefinitionId: product.taxDefinitionId }
                    : {}),
                })
              }
              selected={line.product}
              useOptions={useProductOptions}
            />
            {inactive && (
              <InlineNotice title="Producto inactivo" tone="warning">
                Reactive el producto o retire la línea antes de confirmar.
              </InlineNotice>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                error={errors[`${prefix}.quantity`]}
                id={`line-${line.key}-quantity`}
                label="Cantidad de presentaciones"
              >
                <Input
                  id={`line-${line.key}-quantity`}
                  inputMode="numeric"
                  onChange={(event) =>
                    patch(index, { quantity: event.target.value })
                  }
                  value={line.quantity}
                />
              </Field>
              <Field
                error={errors[`${prefix}.unit_cost`]}
                hint="USD sin impuesto"
                id={`line-${line.key}-cost`}
                label="Costo unitario"
              >
                <Input
                  id={`line-${line.key}-cost`}
                  inputMode="decimal"
                  onChange={(event) =>
                    patch(index, { unitCost: event.target.value })
                  }
                  value={line.unitCost}
                />
              </Field>
              <Field
                error={errors[`${prefix}.tax_definition_id`]}
                id={`line-${line.key}-tax`}
                label="Impuesto"
              >
                <Select
                  id={`line-${line.key}-tax`}
                  onChange={(event) =>
                    patch(index, {
                      taxDefinitionId: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  value={line.taxDefinitionId ?? ''}
                >
                  <option value="">Seleccione…</option>
                  {taxOptions.map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.code}
                      {tax.tax_status === 'applicable'
                        ? ` · ${tax.rate}%`
                        : ' · sin tarifa vigente'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                error={errors[`${prefix}.tax_recoverability`]}
                id={`line-${line.key}-recoverability`}
                label="Recuperabilidad del impuesto"
              >
                <Select
                  id={`line-${line.key}-recoverability`}
                  onChange={(event) =>
                    patch(index, {
                      recoverability: event.target
                        .value as LineDraft['recoverability'],
                    })
                  }
                  value={line.recoverability}
                >
                  <option value="">Seleccione…</option>
                  <option value="RECOVERABLE">Recuperable</option>
                  <option value="NON_RECOVERABLE">No recuperable</option>
                </Select>
              </Field>
            </div>
            {option && option.tax_status !== 'applicable' && (
              <InlineNotice title="Impuesto sin tarifa vigente" tone="warning">
                No se mostrarán importes ni podrá confirmar hasta que la
                configuración tenga una tarifa vigente única para la fecha del
                documento.
              </InlineNotice>
            )}
            <dl
              aria-label={`Importes de la línea ${index + 1}`}
              className="grid gap-2 text-sm sm:grid-cols-4"
            >
              {(
                [
                  ['Base', amounts[index]?.base],
                  ['Impuesto', amounts[index]?.tax],
                  ['Total', amounts[index]?.total],
                  ['Valor inventariable', amounts[index]?.inventory_value],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="font-semibold text-ink">
                    {value ? usd(value) : 'Calculado al guardar'}
                  </dd>
                </div>
              ))}
            </dl>
            <Button
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
              type="button"
              variant="quiet"
            >
              <Trash aria-hidden="true" size={15} />
              Quitar línea {index + 1}
            </Button>
          </fieldset>
        )
      })}
      <Button
        disabled={lines.length >= MAX_LINES}
        onClick={() => onChange([...lines, emptyLine()])}
        type="button"
        variant="secondary"
      >
        <Plus aria-hidden="true" size={15} />
        Agregar línea
      </Button>
      {lines.length >= MAX_LINES && (
        <p className="text-sm text-ink-muted">
          Máximo {MAX_LINES} líneas por ingreso.
        </p>
      )}
    </section>
  )
}
