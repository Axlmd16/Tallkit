import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import {
  Button,
  ButtonGroup,
  Field,
  InlineNotice,
  Input,
  Select,
} from '@/shared/ui'

import { useSupplierNameMatches } from './hooks'
import type {
  Supplier,
  SupplierIdentificationType,
  SupplierInput,
} from './types'

const LENGTH: Record<SupplierIdentificationType, number> = { CI: 10, RUC: 13 }

interface Draft {
  name: string
  type: '' | SupplierIdentificationType
  identification: string
  phone: string
  email: string
  address: string
}

const toDraft = (supplier?: Supplier): Draft => ({
  name: supplier?.name ?? '',
  type: supplier?.identification_type ?? '',
  identification: supplier?.identification ?? '',
  phone: supplier?.phone ?? '',
  email: supplier?.email ?? '',
  address: supplier?.address ?? '',
})

function useDebounced(value: string, delay = 400): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Proveedor liviano: solo el nombre es obligatorio; documento y contactos son opcionales. */
export function SupplierForm({
  supplier,
  onSubmit,
  onCancel,
  onDirtyChange,
  onReload,
}: {
  supplier?: Supplier | undefined
  onSubmit: (data: Partial<SupplierInput>) => Promise<void>
  onCancel: () => void
  onDirtyChange?: ((dirty: boolean) => void) | undefined
  onReload?: (() => void) | undefined
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(supplier))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [pending, setPending] = useState(false)
  const original = useMemo(() => toDraft(supplier), [supplier])
  const matches = useSupplierNameMatches(useDebounced(draft.name), supplier?.id)

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
    if (!draft.name.trim())
      next.name = 'El nombre o razón social es obligatorio.'
    else if (draft.name.trim().length > 255)
      next.name = 'El nombre no puede exceder 255 caracteres.'
    const identification = draft.identification.trim()
    if (Boolean(draft.type) !== Boolean(identification)) {
      next.identification =
        'Indique el tipo y el número de identificación, o ninguno de los dos.'
    } else if (draft.type && identification.length !== LENGTH[draft.type]) {
      next.identification = `Una ${draft.type === 'CI' ? 'cédula' : 'RUC'} debe tener exactamente ${LENGTH[draft.type]} caracteres.`
    }
    if (draft.email.trim() && !/^\S+@\S+\.\S+$/.test(draft.email.trim()))
      next.email = 'Ingrese un correo electrónico válido.'
    if (draft.phone.trim().length > 64)
      next.phone = 'El teléfono no puede exceder 64 caracteres.'
    if (draft.address.trim().length > 1024)
      next.address = 'La dirección no puede exceder 1024 caracteres.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function payload(): Partial<SupplierInput> {
    const trimmed = {
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      address: draft.address.trim(),
    }
    const identification = draft.type
      ? {
          identification_type: draft.type,
          identification: draft.identification.trim(),
        }
      : null
    if (!supplier) {
      return {
        name: trimmed.name,
        ...(trimmed.phone ? { phone: trimmed.phone } : {}),
        ...(trimmed.email ? { email: trimmed.email } : {}),
        ...(trimmed.address ? { address: trimmed.address } : {}),
        ...(identification ?? {}),
      }
    }
    const changes: Partial<SupplierInput> = {}
    if (trimmed.name !== original.name.trim()) changes.name = trimmed.name
    if (trimmed.phone !== original.phone.trim()) changes.phone = trimmed.phone
    if (trimmed.email !== original.email.trim()) changes.email = trimmed.email
    if (trimmed.address !== original.address.trim())
      changes.address = trimmed.address
    if (
      draft.type !== original.type ||
      draft.identification.trim() !== original.identification.trim()
    ) {
      // Quitar la identificación borra el par completo.
      changes.identification_type = identification?.identification_type ?? null
      changes.identification = identification?.identification ?? null
    }
    return changes
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setProblem(null)
    if (!validate()) return
    setPending(true)
    try {
      await onSubmit(payload())
    } catch (error) {
      const view = describeProblem(error)
      setProblem(view)
      setErrors(view.fields)
    } finally {
      setPending(false)
    }
  }

  const similar = matches.data?.results ?? []

  return (
    <form
      className="catalog-editor-form supplier-form space-y-6"
      noValidate
      onSubmit={submit}
    >
      {problem && (
        <InlineNotice title="No se pudo guardar el proveedor" tone="danger">
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
      <Field
        error={errors.name}
        id="supplier-name"
        label="Nombre o razón social"
      >
        <Input
          autoFocus
          disabled={pending}
          id="supplier-name"
          maxLength={255}
          onChange={(e) => update('name', e.target.value, 'name')}
          value={draft.name}
        />
      </Field>
      {similar.length > 0 && (
        <InlineNotice
          title="Ya existen proveedores con ese nombre"
          tone="warning"
        >
          {similar
            .map((match) => match.name + (match.is_active ? '' : ' (inactivo)'))
            .join(', ')}
          {matches.data?.has_more ? ' y más' : ''}. Es solo una advertencia:
          puede guardar de todos modos y los registros no se fusionan.
        </InlineNotice>
      )}

      <fieldset className="form-section space-y-4">
        <legend className="text-base font-bold text-ink">
          Identificación (opcional)
        </legend>
        <Field
          error={errors.identification_type}
          id="supplier-id-type"
          label="Tipo de identificación"
        >
          <Select
            disabled={pending}
            id="supplier-id-type"
            onChange={(e) =>
              update('type', e.target.value, 'identification_type')
            }
            value={draft.type}
          >
            <option value="">Sin identificación</option>
            <option value="CI">Cédula (10 caracteres)</option>
            <option value="RUC">RUC (13 caracteres)</option>
          </Select>
        </Field>
        <Field
          error={errors.identification}
          id="supplier-identification"
          label="Número de identificación"
        >
          <Input
            disabled={pending || !draft.type}
            id="supplier-identification"
            onChange={(e) =>
              update('identification', e.target.value, 'identification')
            }
            value={draft.identification}
          />
        </Field>
        {draft.type && (
          <Button
            onClick={() =>
              setDraft((prev) => ({ ...prev, type: '', identification: '' }))
            }
            type="button"
            variant="quiet"
          >
            Quitar identificación
          </Button>
        )}
      </fieldset>

      <fieldset className="form-section space-y-4">
        <legend className="text-base font-bold text-ink">
          Contacto (opcional)
        </legend>
        <Field error={errors.phone} id="supplier-phone" label="Teléfono">
          <Input
            disabled={pending}
            id="supplier-phone"
            maxLength={64}
            onChange={(e) => update('phone', e.target.value, 'phone')}
            value={draft.phone}
          />
        </Field>
        <Field
          error={errors.email}
          id="supplier-email"
          label="Correo electrónico"
        >
          <Input
            autoComplete="off"
            disabled={pending}
            id="supplier-email"
            maxLength={254}
            onChange={(e) => update('email', e.target.value, 'email')}
            type="email"
            value={draft.email}
          />
        </Field>
        <Field error={errors.address} id="supplier-address" label="Dirección">
          <Input
            disabled={pending}
            id="supplier-address"
            maxLength={1024}
            onChange={(e) => update('address', e.target.value, 'address')}
            value={draft.address}
          />
        </Field>
      </fieldset>

      <ButtonGroup
        className="justify-end pt-2"
        label="Acciones del formulario de proveedor"
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
          {pending
            ? 'Guardando…'
            : problem?.uncertain
              ? 'Reintentar envío'
              : supplier
                ? 'Guardar cambios'
                : 'Guardar proveedor'}
        </Button>
      </ButtonGroup>
    </form>
  )
}
