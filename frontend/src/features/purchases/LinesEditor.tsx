import { Plus, Trash } from '@phosphor-icons/react'

import { Button, Combobox, Field, Input, Money, Select } from '@/shared/ui'

import { emptyLine, type LineDraft } from './draft'
import { useProductOptions } from './pickers'
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
    <section aria-label="Líneas del ingreso" className="sale-section">
      <div className="sale-section-head">
        <h2>Productos recibidos</h2>
        <span className="sale-section-hint">
          Cantidad, costo e impuesto por presentación; los importes los calcula
          el sistema.
        </span>
      </div>
      {lines.length === 0 && (
        <p className="px-3 py-4 text-[13px] text-ink-muted">
          No hay productos agregados. Puede guardar el borrador sin líneas y
          continuar después; para confirmar necesita al menos una.
        </p>
      )}
      {lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[13px]">
            <thead className="bg-surface-subtle text-left text-[11.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
              <tr className="border-b border-line">
                <th className="h-9 px-3" scope="col">
                  Código
                </th>
                <th className="h-9 px-3" scope="col">
                  Producto
                </th>
                <th className="h-9 px-3 text-right" scope="col">
                  Cantidad
                </th>
                <th className="h-9 px-3 text-right" scope="col">
                  Costo USD
                </th>
                <th className="h-9 px-3" scope="col">
                  Impuesto
                </th>
                <th className="h-9 px-3" scope="col">
                  Recuperabilidad
                </th>
                <th className="h-9 px-3 text-right" scope="col">
                  Total
                </th>
                <th className="h-9 px-3" scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const prefix = `lines.${index}`
                const option = taxOptions.find(
                  (tax) => tax.id === line.taxDefinitionId,
                )
                const [code = '—'] = (line.product?.label ?? '').split(' — ')
                return (
                  <tr
                    aria-label={`Línea ${index + 1}`}
                    className="border-t border-line align-top first:border-t-0"
                    key={line.key}
                    role="group"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-ink">
                      {code || '—'}
                    </td>
                    <td className="w-[260px] px-3 py-2.5">
                      <Combobox
                        clearable
                        error={errors[`${prefix}.product_id`]}
                        id={`line-${line.key}-product`}
                        inactiveHelp="Producto inactivo: se conserva legible, pero impide confirmar mientras siga inactivo."
                        label="Producto"
                        onSelect={(product) =>
                          patch(index, {
                            product,
                            ...(line.taxDefinitionId === null &&
                            product?.taxDefinitionId
                              ? { taxDefinitionId: product.taxDefinitionId }
                              : {}),
                          })
                        }
                        selected={line.product}
                        useOptions={useProductOptions}
                      />
                      {line.product?.inactive && (
                        <p className="mt-1 text-xs font-semibold text-warning">
                          Producto inactivo
                        </p>
                      )}
                    </td>
                    <td className="w-28 px-3 py-2.5">
                      <Field
                        error={errors[`${prefix}.quantity`]}
                        id={`line-${line.key}-quantity`}
                        hideLabel
                        label="Cantidad de presentaciones"
                      >
                        <Input
                          className="text-right tabular-nums"
                          id={`line-${line.key}-quantity`}
                          inputMode="numeric"
                          onChange={(event) =>
                            patch(index, { quantity: event.target.value })
                          }
                          value={line.quantity}
                        />
                      </Field>
                    </td>
                    <td className="w-32 px-3 py-2.5">
                      <Field
                        error={errors[`${prefix}.unit_cost`]}
                        id={`line-${line.key}-cost`}
                        hideLabel
                        label="Costo unitario"
                      >
                        <Input
                          className="text-right tabular-nums"
                          id={`line-${line.key}-cost`}
                          inputMode="decimal"
                          onChange={(event) =>
                            patch(index, { unitCost: event.target.value })
                          }
                          value={line.unitCost}
                        />
                      </Field>
                    </td>
                    <td className="w-36 px-3 py-2.5">
                      <Field
                        error={errors[`${prefix}.tax_definition_id`]}
                        id={`line-${line.key}-tax`}
                        hideLabel
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
                      {option && option.tax_status !== 'applicable' && (
                        <p className="mt-1 text-xs text-warning">
                          Sin tarifa vigente
                        </p>
                      )}
                    </td>
                    <td className="w-40 px-3 py-2.5">
                      <Field
                        error={errors[`${prefix}.tax_recoverability`]}
                        id={`line-${line.key}-recoverability`}
                        hideLabel
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
                          <option value="NON_RECOVERABLE">
                            No recuperable
                          </option>
                        </Select>
                      </Field>
                    </td>
                    <td
                      aria-label={`Importes de la línea ${index + 1}`}
                      className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-ink"
                    >
                      <Money amount={amounts[index]?.total} className="block" />
                      <span className="block text-xs font-normal text-ink-muted">
                        Imp. <Money amount={amounts[index]?.tax} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        aria-label={`Quitar línea ${index + 1}`}
                        onClick={() =>
                          onChange(lines.filter((_, i) => i !== index))
                        }
                        type="button"
                        variant="quiet"
                      >
                        <Trash aria-hidden="true" size={15} />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-line p-3">
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
          <p className="text-[12.5px] text-ink-muted">
            Máximo {MAX_LINES} líneas por ingreso.
          </p>
        )}
      </div>
    </section>
  )
}
