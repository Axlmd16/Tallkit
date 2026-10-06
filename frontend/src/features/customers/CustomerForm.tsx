import {
  AddressBook,
  Buildings,
  Envelope,
  FloppyDisk,
  IdentificationCard,
  MapPin,
  Phone,
  User,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Field,
  InlineNotice,
  Input,
  LeadingIcon,
  SectionPanel,
  Select,
} from '@/shared/ui'

import { customersApi, type CustomersApi } from './api'
import type {
  CustomerMatch,
  CustomerSummary,
  CustomerWrite,
  PersonType,
} from './types'

const empty: CustomerWrite = {
  person_type: 'NATURAL',
  identification_type: 'CI',
  identification: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  is_withholding_agent: false,
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function CustomerForm({
  customer,
  onSubmit,
  onCancel,
  onDirtyChange,
  onNavigateToCustomer,
  api = customersApi,
}: {
  customer?: CustomerSummary | undefined
  onSubmit: (data: CustomerWrite) => Promise<void>
  onCancel?: (() => void) | undefined
  onDirtyChange?: ((dirty: boolean) => void) | undefined
  onNavigateToCustomer?: ((id: number) => void) | undefined
  api?: CustomersApi | undefined
}) {
  const initial = useMemo<CustomerWrite>(
    () =>
      customer
        ? {
            person_type: customer.person_type,
            identification_type: customer.identification_type,
            identification: customer.identification,
            name: customer.name,
            phone: customer.phone,
            email: customer.email ?? '',
            address: customer.address ?? '',
            is_withholding_agent: customer.is_withholding_agent ?? false,
          }
        : empty,
    [customer],
  )

  const [draft, setDraft] = useState<CustomerWrite>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState('')
  const [conflictId, setConflictId] = useState<number | null>(null)
  const [matches, setMatches] = useState<CustomerMatch[]>([])
  const [pending, setPending] = useState(false)
  const locked = useRef(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  async function checkMatches(nameVal: string, phoneVal: string) {
    const trimmedName = nameVal.trim()
    const trimmedPhone = phoneVal.trim()
    if (!trimmedName && !trimmedPhone) {
      setMatches([])
      return
    }
    try {
      const results = await api.matches({
        name: trimmedName || undefined,
        phone: trimmedPhone || undefined,
        exclude_id: customer?.id,
      })
      setMatches(results)
    } catch {
      // Non-blocking query failure does not prevent workflow
    }
  }

  function validateClient(): boolean {
    const errors: Record<string, string> = {}
    if (!draft.name.trim()) {
      errors.name =
        draft.person_type === 'JURIDICA'
          ? 'La razón social es obligatoria.'
          : 'El nombre o razón social es obligatorio.'
    }
    const ident = draft.identification.trim()
    if (!ident) {
      errors.identification = 'La identificación es obligatoria.'
    } else if (draft.identification_type === 'CI' && ident.length !== 10) {
      errors.identification =
        'La cédula de identidad (CI) debe tener exactamente 10 caracteres.'
    } else if (draft.identification_type === 'RUC' && ident.length !== 13) {
      errors.identification = 'El RUC debe tener exactamente 13 caracteres.'
    }

    if (!draft.phone.trim()) {
      errors.phone = 'El teléfono es obligatorio.'
    }

    if (draft.email && draft.email.trim()) {
      const emailTrimmed = draft.email.trim()
      if (emailTrimmed.length > 254 || !EMAIL_REGEX.test(emailTrimmed)) {
        errors.email = 'El correo electrónico no tiene un formato válido.'
      }
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setSummary('Revise los campos señalados.')
      return false
    }
    return true
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return

    setSummary('')
    setConflictId(null)

    if (!validateClient()) return

    locked.current = true
    setPending(true)

    try {
      // La marca de agente de retención solo viaja cuando la persona la cambió.
      const { is_withholding_agent: marked, ...rest } = draft
      const payload: CustomerWrite = {
        ...rest,
        ...(Boolean(marked) !== Boolean(initial.is_withholding_agent)
          ? { is_withholding_agent: Boolean(marked) }
          : {}),
        name: draft.name.trim(),
        identification: draft.identification.trim(),
        phone: draft.phone.trim(),
        email: draft.email?.trim() || '',
        address: draft.address?.trim() || '',
      }
      if (customer?.version !== undefined) {
        payload.expected_version = customer.version
      }
      await onSubmit(payload)
    } catch (caught) {
      if (caught instanceof ProblemError) {
        if (caught.conflict && caught.conflict.type === 'customer') {
          setConflictId(caught.conflict.id)
          setSummary(caught.message)
          setFieldErrors((prev) => ({
            ...prev,
            identification: caught.message,
          }))
        } else if (caught.errors) {
          const mapped: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(caught.errors)) {
            const firstMsg = msgs[0]
            if (firstMsg) mapped[key] = firstMsg
          }
          setFieldErrors(mapped)
          setSummary(caught.message || 'Revise los campos señalados.')
        } else {
          setSummary(caught.message)
        }
      } else if (caught instanceof Error) {
        setSummary(caught.message)
      } else {
        setSummary('No fue posible guardar el cliente.')
      }
    } finally {
      locked.current = false
      setPending(false)
    }
  }

  const nameLabel =
    draft.person_type === 'JURIDICA' ? 'Razón social' : 'Nombres y apellidos'
  const identificationLength = draft.identification_type === 'RUC' ? 13 : 10
  const initials = draft.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
  const setField = (field: keyof CustomerWrite, value: string) => {
    setDraft({ ...draft, [field]: value })
    setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }
  const missing = (
    <span className="font-normal text-ink-muted">Sin ingresar</span>
  )

  return (
    <form
      className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <div className="min-w-0 space-y-4">
        {summary && !conflictId && (
          <InlineNotice title={summary} tone="danger" />
        )}

        <SectionPanel
          description="Una misma identificación no puede registrarse dos veces."
          icon={<IdentificationCard size={17} />}
          id="customer-form-identity"
          title="Identificación"
        >
          <div className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field
                error={fieldErrors.person_type}
                id="customer-person-type"
                label="Tipo de persona"
              >
                <Select
                  onChange={(event) => {
                    const pt = event.target.value as PersonType
                    setDraft({
                      ...draft,
                      person_type: pt,
                      identification_type:
                        pt === 'JURIDICA' ? 'RUC' : draft.identification_type,
                    })
                    setFieldErrors((prev) => ({ ...prev, person_type: '' }))
                  }}
                  value={draft.person_type}
                >
                  <option value="NATURAL">Persona natural</option>
                  <option value="JURIDICA">Persona jurídica</option>
                </Select>
              </Field>

              <Field
                error={fieldErrors.identification_type}
                id="customer-identification-type"
                label="Tipo de identificación"
              >
                <Select
                  onChange={(event) =>
                    setField('identification_type', event.target.value)
                  }
                  value={draft.identification_type}
                >
                  <option value="CI">Cédula de identidad (CI)</option>
                  <option value="RUC">RUC</option>
                </Select>
              </Field>

              <Field
                error={fieldErrors.identification}
                id="customer-identification"
                label="Número de identificación"
                required
              >
                <div className="relative">
                  <Input
                    className="pr-14 tabular-nums"
                    inputMode="numeric"
                    onChange={(event) =>
                      setField('identification', event.target.value)
                    }
                    value={draft.identification}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-ink-muted tabular-nums"
                  >
                    {draft.identification.trim().length}/{identificationLength}
                  </span>
                </div>
              </Field>

              <Field
                className="md:col-span-3"
                error={fieldErrors.name}
                id="customer-name"
                label={nameLabel}
                required
              >
                <Input
                  data-autofocus
                  onBlur={() => void checkMatches(draft.name, draft.phone)}
                  onChange={(event) => setField('name', event.target.value)}
                  value={draft.name}
                />
              </Field>
            </div>

            {summary && conflictId && (
              <InlineNotice title={summary} tone="danger">
                {onNavigateToCustomer && (
                  <div className="mt-2">
                    <Button
                      onClick={() => onNavigateToCustomer(conflictId)}
                      type="button"
                      variant="secondary"
                    >
                      Ver ficha del cliente registrado
                    </Button>
                  </div>
                )}
              </InlineNotice>
            )}

            {matches.length > 0 && (
              <InlineNotice
                title="Coincidencias encontradas: existen clientes con datos similares"
                tone="warning"
              >
                <p className="mb-2">
                  Esta advertencia no bloquea el registro si se trata de una
                  identidad diferente.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <span className="font-semibold">{m.name}</span> (
                      {m.identification_type}: {m.identification}) – Tel:{' '}
                      {m.phone}{' '}
                      <span className="text-xs">
                        [{m.is_active ? 'Activo' : 'Inactivo'}]
                      </span>
                    </li>
                  ))}
                </ul>
              </InlineNotice>
            )}
          </div>
        </SectionPanel>

        <SectionPanel
          description="El teléfono es obligatorio; correo y dirección son opcionales."
          icon={<Phone size={17} />}
          id="customer-form-contact"
          title="Contacto"
        >
          <div className="grid gap-4 p-4 md:grid-cols-3">
            <Field
              error={fieldErrors.phone}
              id="customer-phone"
              label="Teléfono"
              required
            >
              <LeadingIcon icon={<Phone size={17} />}>
                <Input
                  className="pl-10"
                  onBlur={() => void checkMatches(draft.name, draft.phone)}
                  onChange={(event) => setField('phone', event.target.value)}
                  type="tel"
                  value={draft.phone}
                />
              </LeadingIcon>
            </Field>

            <Field
              error={fieldErrors.email}
              id="customer-email"
              label="Correo electrónico (opcional)"
            >
              <LeadingIcon icon={<Envelope size={17} />}>
                <Input
                  autoComplete="email"
                  className="pl-10"
                  onChange={(event) => setField('email', event.target.value)}
                  type="email"
                  value={draft.email}
                />
              </LeadingIcon>
            </Field>

            <Field
              error={fieldErrors.address}
              id="customer-address"
              label="Dirección (opcional)"
            >
              <LeadingIcon icon={<MapPin size={17} />}>
                <Input
                  className="pl-10"
                  onChange={(event) => setField('address', event.target.value)}
                  value={draft.address}
                />
              </LeadingIcon>
            </Field>

            <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
              <input
                checked={Boolean(draft.is_withholding_agent)}
                className="mt-1"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    is_withholding_agent: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>
                <span className="font-semibold">Agente de retención</span>
                <span className="block text-[12.5px] text-ink-muted">
                  Márquelo si este cliente suele pagar un poco menos porque
                  retiene impuestos. Puede comprobarlo en la consulta de RUC del
                  SRI. Solo sirve para sugerir la retención al cobrar.
                </span>
              </span>
            </label>
          </div>
        </SectionPanel>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <SectionPanel
          icon={<AddressBook size={17} />}
          id="customer-form-summary"
          title={customer ? 'Ficha del cliente' : 'Resumen del cliente'}
        >
          <div className="flex items-center gap-3 border-b border-line p-4">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-semibold text-ink-muted"
            >
              {initials ||
                (draft.person_type === 'JURIDICA' ? (
                  <Buildings size={20} />
                ) : (
                  <User size={20} />
                ))}
            </span>
            <div className="min-w-0">
              <p className="font-medium break-words text-ink">
                {draft.name.trim() || (
                  <span className="font-normal text-ink-muted">Sin nombre</span>
                )}
              </p>
              <p className="text-xs text-ink-muted">
                {draft.person_type === 'JURIDICA'
                  ? 'Persona jurídica'
                  : 'Persona natural'}
              </p>
            </div>
          </div>
          <dl className="space-y-3 p-4 text-[13px]">
            <div>
              <dt className="text-xs text-ink-muted">Identificación</dt>
              <dd className="mt-0.5 text-ink tabular-nums">
                {draft.identification.trim()
                  ? `${draft.identification_type} · ${draft.identification.trim()}`
                  : missing}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Teléfono</dt>
              <dd className="mt-0.5 text-ink">
                {draft.phone.trim() || missing}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Correo</dt>
              <dd className="mt-0.5 break-words text-ink">
                {draft.email?.trim() || missing}
              </dd>
            </div>
            {!customer && (
              <p className="rounded-control bg-surface-subtle px-3 py-2 text-xs text-ink-muted">
                Los vehículos se registran después, desde la ficha del cliente.
              </p>
            )}
            {dirty && (
              <p className="text-xs font-semibold text-warning" role="status">
                Hay cambios sin guardar.
              </p>
            )}
          </dl>
          <div className="flex flex-col gap-2 border-t border-line p-4">
            <Button pending={pending} pendingLabel="Guardando…" type="submit">
              <FloppyDisk aria-hidden="true" size={16} />
              Guardar cliente
            </Button>
            {onCancel && (
              <Button onClick={onCancel} type="button" variant="secondary">
                Cancelar
              </Button>
            )}
          </div>
        </SectionPanel>
      </aside>
    </form>
  )
}
