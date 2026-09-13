import { User } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { ProblemError } from '@/shared/api/client'
import {
  Button,
  ButtonGroup,
  Field,
  InlineNotice,
  Input,
  Select,
} from '@/shared/ui'

import { customersApi, type CustomersApi } from './api'
import type {
  CustomerMatch,
  CustomerSummary,
  CustomerWrite,
  IdentificationType,
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
      const payload: CustomerWrite = {
        ...draft,
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

  return (
    <form
      className="customer-form space-y-6"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <div className="customer-form-avatar" aria-hidden="true">
        {customer ? (
          customer.name.slice(0, 2).toUpperCase()
        ) : (
          <User size={62} weight="fill" />
        )}
      </div>

      {summary && (
        <InlineNotice title={summary} tone="danger">
          {conflictId && onNavigateToCustomer && (
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
            Esta advertencia no bloquea el registro si se trata de una identidad
            diferente.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {matches.map((m) => (
              <li key={m.id}>
                <span className="font-semibold">{m.name}</span> (
                {m.identification_type}: {m.identification}) – Tel: {m.phone}{' '}
                <span className="text-xs">
                  [{m.is_active ? 'Activo' : 'Inactivo'}]
                </span>
              </li>
            ))}
          </ul>
        </InlineNotice>
      )}

      <div
        className="grid grid-cols-1 gap-5 md:grid-cols-2"
        data-testid="customer-fields"
      >
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
            onChange={(event) => {
              setDraft({
                ...draft,
                identification_type: event.target.value as IdentificationType,
              })
              setFieldErrors((prev) => ({ ...prev, identification_type: '' }))
            }}
            value={draft.identification_type}
          >
            <option value="CI">Cédula de identidad (CI)</option>
            <option value="RUC">RUC</option>
          </Select>
        </Field>

        <Field
          className="md:col-span-2"
          error={fieldErrors.name}
          id="customer-name"
          label={nameLabel}
        >
          <Input
            data-autofocus
            onBlur={() => void checkMatches(draft.name, draft.phone)}
            onChange={(event) => {
              setDraft({ ...draft, name: event.target.value })
              setFieldErrors((prev) => ({ ...prev, name: '' }))
            }}
            value={draft.name}
          />
        </Field>

        <Field
          error={fieldErrors.identification}
          id="customer-identification"
          label="Número de identificación"
          hint={
            draft.identification_type === 'CI'
              ? 'Exactamente 10 dígitos'
              : 'Exactamente 13 dígitos'
          }
        >
          <Input
            onChange={(event) => {
              setDraft({ ...draft, identification: event.target.value })
              setFieldErrors((prev) => ({ ...prev, identification: '' }))
            }}
            value={draft.identification}
          />
        </Field>

        <Field error={fieldErrors.phone} id="customer-phone" label="Teléfono">
          <Input
            onBlur={() => void checkMatches(draft.name, draft.phone)}
            onChange={(event) => {
              setDraft({ ...draft, phone: event.target.value })
              setFieldErrors((prev) => ({ ...prev, phone: '' }))
            }}
            type="tel"
            value={draft.phone}
          />
        </Field>

        <Field
          className="md:col-span-2"
          error={fieldErrors.email}
          id="customer-email"
          label="Correo electrónico (opcional)"
        >
          <Input
            autoComplete="email"
            onChange={(event) => {
              setDraft({ ...draft, email: event.target.value })
              setFieldErrors((prev) => ({ ...prev, email: '' }))
            }}
            type="email"
            value={draft.email}
          />
        </Field>

        <Field
          className="md:col-span-2"
          error={fieldErrors.address}
          id="customer-address"
          label="Dirección (opcional)"
        >
          <Input
            onChange={(event) => {
              setDraft({ ...draft, address: event.target.value })
              setFieldErrors((prev) => ({ ...prev, address: '' }))
            }}
            value={draft.address}
          />
        </Field>
      </div>

      {dirty && (
        <p className="text-sm text-warning" role="status">
          Hay cambios sin guardar.
        </p>
      )}

      <ButtonGroup label="Acciones del formulario">
        <Button pending={pending} pendingLabel="Guardando…" type="submit">
          Guardar cliente
        </Button>
        {onCancel && (
          <Button onClick={onCancel} variant="secondary">
            Cancelar
          </Button>
        )}
      </ButtonGroup>
    </form>
  )
}
