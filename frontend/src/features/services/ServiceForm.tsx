import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import type { TaxProjection } from '@/features/products/types'
import {
  Button,
  ButtonGroup,
  Field,
  InlineNotice,
  Input,
  Select,
  Textarea,
} from '@/shared/ui'

import { useServiceTaxOptions } from './hooks'
import type { Service, ServiceInput } from './types'

const PRICE = /^\d{1,12}(\.\d{1,2})?$/

interface Draft {
  name: string
  description: string
  price: string
  taxId: string
}

const toDraft = (service?: Service): Draft => ({
  name: service?.name ?? '',
  description: service?.description ?? '',
  price: service?.reference_price ?? '',
  taxId: service?.tax ? String(service.tax.id) : '',
})

function taxLabel(option: TaxProjection): string {
  const status =
    option.tax_status === 'applicable'
      ? `${option.rate}%`
      : option.tax_status === 'missing'
        ? 'vigencia pendiente'
        : 'vigencias ambiguas'
  return `${option.code} — ${option.name} (${status})`
}

export interface ServiceFormHandle {
  submit: () => Promise<boolean>
}

interface ServiceFormProps {
  service?: Service | undefined
  onSubmit: (data: Partial<ServiceInput>) => Promise<void>
  onCancel?: (() => void) | undefined
  onDirtyChange?: ((dirty: boolean) => void) | undefined
  onReload?: (() => void) | undefined
  onSubmitLabelChange?: ((label: string) => void) | undefined
  embedded?: boolean
}

/** Formulario de servicio: precio referencial final e impuesto del ámbito artesanal. */
export const ServiceForm = forwardRef<ServiceFormHandle, ServiceFormProps>(
  function ServiceForm(
    {
      service,
      onSubmit,
      onCancel,
      onDirtyChange,
      onReload,
      onSubmitLabelChange,
      embedded = false,
    },
    ref,
  ) {
    const [draft, setDraft] = useState<Draft>(() => toDraft(service))
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [problem, setProblem] = useState<ProblemView | null>(null)
    const [pending, setPending] = useState(false)
    const taxes = useServiceTaxOptions({ pageSize: 100 })
    const taxOptions = taxes.data?.results ?? []
    const selectedTax =
      taxOptions.find((option) => String(option.id) === draft.taxId) ??
      (service?.tax && String(service.tax.id) === draft.taxId
        ? service.tax
        : null)

    const original = useMemo(() => toDraft(service), [service])
    const dirty = (Object.keys(draft) as Array<keyof Draft>).some(
      (name) => draft[name].trim() !== original[name].trim(),
    )
    useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

    function update(name: keyof Draft, value: string, field: string) {
      setDraft((prev) => ({ ...prev, [name]: value }))
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }

    function validate(): boolean {
      const next: Record<string, string> = {}
      if (!draft.name.trim()) next.name = 'El nombre es obligatorio.'
      else if (draft.name.trim().length > 255)
        next.name = 'El nombre no puede exceder 255 caracteres.'
      if (draft.description.trim().length > 2000)
        next.description = 'La descripción no puede exceder 2000 caracteres.'
      if (!PRICE.test(draft.price.trim()))
        next.reference_price =
          'Use un importe en USD, con hasta 12 enteros y 2 decimales, con punto decimal. No se redondea automáticamente.'
      if (!draft.taxId)
        next.tax_definition_id = 'Seleccione la configuración tributaria.'
      setErrors(next)
      return Object.keys(next).length === 0
    }

    function payload(): Partial<ServiceInput> {
      const full: ServiceInput = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        reference_price: draft.price.trim(),
        tax_definition_id: Number(draft.taxId),
      }
      if (!service) {
        const { description, ...required } = full
        return description ? { ...required, description } : required
      }
      const changes: Partial<ServiceInput> = {}
      if (full.name !== original.name.trim()) changes.name = full.name
      if (full.description !== original.description.trim())
        changes.description = full.description
      if (full.reference_price !== original.price.trim())
        changes.reference_price = full.reference_price
      if (draft.taxId !== original.taxId)
        changes.tax_definition_id = full.tax_definition_id
      return changes
    }

    async function saveForm() {
      if (pending) return false
      setProblem(null)
      if (!validate()) return false
      setPending(true)
      try {
        await onSubmit(payload())
        return true
      } catch (error) {
        const view = describeProblem(error)
        setProblem(view)
        setErrors(view.fields)
        return false
      } finally {
        setPending(false)
      }
    }

    const noTaxConfiguration = taxes.isSuccess && taxOptions.length === 0
    const saveLabel = problem?.uncertain
      ? 'Reintentar envío'
      : service
        ? 'Guardar cambios'
        : 'Guardar servicio'

    useImperativeHandle(ref, () => ({ submit: saveForm }))
    useEffect(
      () => onSubmitLabelChange?.(saveLabel),
      [onSubmitLabelChange, saveLabel],
    )

    function submit(event: FormEvent) {
      event.preventDefault()
      void saveForm()
    }

    const fields = (
      <>
        {problem && (
          <InlineNotice title="No se pudo guardar el servicio" tone="danger">
            {problem.message}
            {problem.staleRecord && onReload && (
              <div className="mt-3">
                <Button onClick={onReload} type="button" variant="secondary">
                  Cargar versión vigente
                </Button>
              </div>
            )}
          </InlineNotice>
        )}
        <Field error={errors.name} id="service-name" label="Nombre">
          <Input
            autoFocus
            disabled={pending}
            id="service-name"
            maxLength={255}
            onChange={(e) => update('name', e.target.value, 'name')}
            value={draft.name}
          />
        </Field>
        <Field
          className="service-description-field"
          error={errors.description}
          id="service-description"
          label="Descripción (opcional)"
        >
          <Textarea
            disabled={pending}
            id="service-description"
            maxLength={2000}
            onChange={(e) =>
              update('description', e.target.value, 'description')
            }
            value={draft.description}
          />
        </Field>
        <Field
          error={errors.reference_price}
          hint="Valor final con impuesto incluido. Puede ajustarse al confirmar cada mantenimiento sin cambiar el catálogo."
          id="service-price"
          label="Precio referencial final (USD)"
        >
          <Input
            disabled={pending}
            id="service-price"
            inputMode="decimal"
            onChange={(e) => update('price', e.target.value, 'reference_price')}
            value={draft.price}
          />
        </Field>
        {noTaxConfiguration ? (
          <InlineNotice
            title="Configuración tributaria pendiente"
            tone="warning"
          >
            No hay definiciones de impuesto del RUC artesanal. Un Administrador
            debe configurarlas antes de registrar servicios.
          </InlineNotice>
        ) : (
          <Field
            error={errors.tax_definition_id}
            hint="El precio no se recalcula al cambiar la tarifa del impuesto."
            id="service-tax"
            label="Impuesto (RUC artesanal)"
          >
            <Select
              disabled={pending || taxes.isPending}
              id="service-tax"
              onChange={(e) =>
                update('taxId', e.target.value, 'tax_definition_id')
              }
              value={draft.taxId}
            >
              <option value="">Seleccione…</option>
              {selectedTax &&
                !taxOptions.some((o) => o.id === selectedTax.id) && (
                  <option value={selectedTax.id}>
                    {taxLabel(selectedTax)}
                  </option>
                )}
              {taxOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {taxLabel(option)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {selectedTax && selectedTax.tax_status !== 'applicable' && (
          <InlineNotice title="Vigencia tributaria pendiente" tone="warning">
            Puede guardar el servicio, pero no podrá usarse en operaciones
            económicas hasta que se configure una vigencia aplicable.
          </InlineNotice>
        )}
      </>
    )

    if (embedded) {
      return (
        <div className="catalog-editor-form service-form space-y-6">
          {fields}
        </div>
      )
    }

    return (
      <form
        className="catalog-editor-form service-form space-y-6"
        noValidate
        onSubmit={submit}
      >
        {fields}
        <ButtonGroup
          className="justify-end pt-2"
          label="Acciones del formulario de servicio"
        >
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="quiet"
          >
            Cancelar
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending}
            type="submit"
            variant="primary"
          >
            {pending ? 'Guardando…' : saveLabel}
          </Button>
        </ButtonGroup>
      </form>
    )
  },
)
