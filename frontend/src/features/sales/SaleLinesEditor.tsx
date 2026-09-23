import { Plus, Trash } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { Button, getControlClasses, Tooltip, Money } from '@/shared/ui'

import { emptyLine, WHOLE, type LineDraft } from './draft'
import { useProductPickerOptions } from './pickers'
import { Combobox } from '@/shared/ui/forms/Combobox'
import type { DocumentLine } from './types'

export const MAX_LINES = 200

/**
 * Tabla editable de productos. Cada fila conserva su clave estable; los importes de
 * precio, impuesto y total son de solo lectura y llegan de la proyección del servidor
 * (`priced`, por clave de línea): sin dato se muestran guiones, nunca ceros inventados.
 */
export function SaleLinesEditor({
  lines,
  onChange,
  errors,
  priced,
  pending = false,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  errors: Record<string, string>
  priced: Record<string, DocumentLine | undefined>
  /** Los importes visibles están desactualizados o recalculándose. */
  pending?: boolean
}) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const focusNew = useRef(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusNew.current) return
    focusNew.current = false
    const last = lines.length - 1
    wrapper.current
      ?.querySelector<HTMLInputElement>(`#sale-line-${last}-product`)
      ?.focus()
  }, [lines.length])

  function patch(index: number, changes: Partial<LineDraft>) {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    )
  }

  const money = (value: string | null | undefined) => <Money amount={value} />

  return (
    <section aria-label="Líneas de la venta" className="sale-section">
      <div className="sale-section-head">
        <h2>Productos</h2>
        <span className="sale-section-hint">
          Precio e impuesto vienen del catálogo; sin descuentos.
        </span>
      </div>
      <div className="sale-lines-wrap" ref={wrapper}>
        <table className="sale-lines">
          <caption className="sr-only">
            Productos de la venta: producto, cantidad, precio final, impuesto y
            total
          </caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th className="num" scope="col">
                Cantidad
              </th>
              <th className="num" scope="col">
                Precio final
              </th>
              <th className="num" scope="col">
                Impuesto
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
                <td colSpan={6}>
                  No hay productos agregados. Añada al menos uno para confirmar
                  la venta.
                </td>
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
              const quantityErrorId = `sale-line-${index}-quantity-error`
              return (
                <tr
                  className="sale-line"
                  data-error={Boolean(productError || quantityError)}
                  data-focused={focusedKey === line.key}
                  key={line.key}
                >
                  <td data-label="Producto">
                    <Combobox
                      error={productError}
                      id={`sale-line-${index}-product`}
                      inactiveHelp="No puede confirmarse una venta con este producto: cámbielo o retire la línea."
                      label={`Producto de la línea ${index + 1}`}
                      onFocusChange={(focused) =>
                        setFocusedKey(focused ? line.key : null)
                      }
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
                      id={`sale-line-${index}-quantity`}
                      inputMode="numeric"
                      onBlur={() => setFocusedKey(null)}
                      onChange={(event) =>
                        patch(index, { quantity: event.target.value })
                      }
                      onFocus={() => setFocusedKey(line.key)}
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
                    className={`num readonly ${pending ? 'pending-value' : ''}`}
                    data-label="Precio final"
                  >
                    {money(row?.unit_price)}
                  </td>
                  <td
                    className={`num readonly ${pending ? 'pending-value' : ''}`}
                    data-label="Impuesto"
                  >
                    {money(row?.tax_amount)}
                  </td>
                  <td
                    className={`num readonly strong ${pending ? 'pending-value' : ''}`}
                    data-label="Total"
                  >
                    {money(row?.total_amount)}
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
