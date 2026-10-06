import { Plus, Trash, Warning } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'

import '@/features/sales/sales.css'
import { Button, getControlClasses, Money, Tooltip } from '@/shared/ui'
import { Combobox } from '@/shared/ui/forms/Combobox'

import { emptyLine, WHOLE, type LineDraft } from './draft'
import { useProductPickerOptions } from './pickers'
import type { ProformaLine } from './types'

export const MAX_LINES = 200

/**
 * Tabla editable de productos de la oferta. Precio, impuesto y total son de solo lectura y
 * llegan del servidor (`priced`, por clave de línea): sin dato se muestran guiones, nunca
 * ceros inventados. La disponibilidad es informativa: su insuficiencia avisa, no bloquea.
 */
export function ProformaLinesEditor({
  lines,
  onChange,
  errors,
  priced,
  pending = false,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  errors: Record<string, string>
  priced: Record<string, ProformaLine | undefined>
  /** Los importes visibles están desactualizados o recalculándose. */
  pending?: boolean
}) {
  const focusNew = useRef(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusNew.current) return
    focusNew.current = false
    wrapper.current
      ?.querySelector<HTMLInputElement>(
        `#proforma-line-${lines.length - 1}-product`,
      )
      ?.focus()
  }, [lines.length])

  function patch(index: number, changes: Partial<LineDraft>) {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    )
  }

  const stale = pending ? 'pending-value' : ''
  return (
    <section aria-label="Productos de la proforma" className="sale-section">
      <div className="sale-section-head">
        <h2>Productos</h2>
        <span className="sale-section-hint">
          Precio de catálogo; sin descuentos ni reserva.
        </span>
      </div>
      <div className="sale-lines-wrap" ref={wrapper}>
        <table className="sale-lines">
          <caption className="sr-only">
            Productos de la proforma: producto, cantidad, disponibilidad
            informativa, precio final y total
          </caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th className="num" scope="col">
                Cantidad
              </th>
              <th className="num" scope="col">
                Disponible
              </th>
              <th className="num" scope="col">
                Precio final
              </th>
              <th className="num" scope="col">
                Total
              </th>
              <th scope="col">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr className="sale-lines-empty">
                <td colSpan={6}>Agregue al menos un producto para emitir.</td>
              </tr>
            )}
            {lines.map((line, index) => {
              const prefix = `lines.${index}`
              const productError = errors[`${prefix}.product_id`]
              const quantityError =
                errors[`${prefix}.quantity`] ??
                (line.quantity && !WHOLE.test(line.quantity)
                  ? 'La cantidad debe ser un entero positivo.'
                  : undefined)
              const row = priced[line.key]
              const quantityErrorId = `proforma-line-${index}-quantity-error`
              const insufficient = row?.availability_sufficient === false
              return (
                <tr
                  className="sale-line"
                  data-error={Boolean(productError || quantityError)}
                  key={line.key}
                >
                  <td data-label="Producto">
                    <Combobox
                      error={productError}
                      id={`proforma-line-${index}-product`}
                      inactiveHelp="El producto está inactivo: cámbielo o retire la línea para emitir."
                      label={`Producto de la línea ${index + 1}`}
                      onSelect={(product) => patch(index, { product })}
                      placeholder="Código o nombre"
                      selected={line.product}
                      useOptions={useProductPickerOptions}
                    />
                  </td>
                  <td className="num" data-label="Cantidad">
                    <input
                      aria-describedby={
                        quantityError ? quantityErrorId : undefined
                      }
                      aria-invalid={quantityError ? true : undefined}
                      aria-label={`Cantidad de la línea ${index + 1}`}
                      className={`${getControlClasses({ density: 'compact42' })} sale-quantity`}
                      id={`proforma-line-${index}-quantity`}
                      inputMode="numeric"
                      onChange={(event) =>
                        patch(index, { quantity: event.target.value })
                      }
                      value={line.quantity}
                    />
                    {quantityError && (
                      <p
                        className="sale-field-note font-semibold text-danger"
                        id={quantityErrorId}
                        role="alert"
                      >
                        {quantityError}
                      </p>
                    )}
                  </td>
                  <td
                    className={`num readonly ${stale}`}
                    data-label="Disponible"
                  >
                    {row?.availability === undefined ? (
                      '—'
                    ) : (
                      <span
                        className={`inline-flex items-center justify-end gap-1 ${insufficient ? 'font-semibold text-warning' : ''}`}
                      >
                        {insufficient && (
                          <Tooltip
                            content="Disponibilidad insuficiente. Puede cotizar: la proforma no reserva unidades."
                            position="top"
                          >
                            <Warning
                              aria-label="Disponibilidad insuficiente"
                              size={16}
                              weight="fill"
                            />
                          </Tooltip>
                        )}
                        {row.availability}
                      </span>
                    )}
                  </td>
                  <td
                    className={`num readonly ${stale}`}
                    data-label="Precio final"
                  >
                    <Money amount={row?.unit_price} />
                  </td>
                  <td
                    className={`num readonly strong ${stale}`}
                    data-label="Total"
                  >
                    <Money amount={row?.total_amount} />
                  </td>
                  <td className="action">
                    <Tooltip
                      content={`Quitar línea ${index + 1}`}
                      position="left"
                    >
                      <button
                        aria-label={`Quitar línea ${index + 1}`}
                        className="sale-icon-button danger"
                        onClick={() =>
                          onChange(lines.filter((_, i) => i !== index))
                        }
                        type="button"
                      >
                        <Trash aria-hidden="true" size={18} />
                      </button>
                    </Tooltip>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="sale-lines-foot">
        <Button
          disabled={lines.length >= MAX_LINES}
          onClick={() => {
            focusNew.current = true
            onChange([...lines, emptyLine()])
          }}
          size="40"
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" size={16} />
          Agregar producto
        </Button>
      </div>
    </section>
  )
}
