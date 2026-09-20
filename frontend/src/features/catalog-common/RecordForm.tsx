import { useEffect, useState, type FormEvent } from 'react'

import {
  Button,
  ButtonGroup,
  Field,
  InlineNotice,
  Input,
  Textarea,
} from '@/shared/ui'

import { describeProblem, type ProblemView } from './problem'

export interface TextFieldSpec {
  name: string
  label: string
  maxLength: number
  required?: boolean
  multiline?: boolean
  hint?: string
  placeholder?: string
}

export type RecordValues = Record<string, string>

/** Formulario de campos de texto para catálogos auxiliares, con borrador en memoria. */
export function RecordForm({
  idPrefix,
  fields,
  record,
  noun,
  onSubmit,
  onCancel,
  onDirtyChange,
  onReload,
}: {
  idPrefix: string
  fields: TextFieldSpec[]
  record?: RecordValues | undefined
  noun: string
  onSubmit: (values: RecordValues) => Promise<void>
  onCancel: () => void
  onDirtyChange?: ((dirty: boolean) => void) | undefined
  onReload?: (() => void) | undefined
}) {
  const initial = (): RecordValues =>
    Object.fromEntries(fields.map((f) => [f.name, record?.[f.name] ?? '']))
  const [values, setValues] = useState<RecordValues>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [pending, setPending] = useState(false)

  const dirty = fields.some(
    (f) => (values[f.name] ?? '').trim() !== (record?.[f.name] ?? '').trim(),
  )
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  function validate(): boolean {
    const next: Record<string, string> = {}
    for (const field of fields) {
      const text = (values[field.name] ?? '').trim()
      if (field.required && !text)
        next[field.name] = `${field.label} es obligatorio.`
      else if (text.length > field.maxLength)
        next[field.name] =
          `${field.label} no puede exceder ${field.maxLength} caracteres.`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setProblem(null)
    if (!validate()) return
    setPending(true)
    try {
      await onSubmit(
        Object.fromEntries(
          fields.map((f) => [f.name, (values[f.name] ?? '').trim()]),
        ),
      )
    } catch (error) {
      const view = describeProblem(error)
      setProblem(view)
      setErrors(view.fields)
    } finally {
      setPending(false)
    }
  }

  const retrying = problem?.uncertain ?? false

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      {problem && (
        <InlineNotice title="No se pudo guardar" tone="danger">
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
      {fields.map((field, index) => {
        const id = `${idPrefix}-${field.name}`
        const Control = field.multiline ? Textarea : Input
        return (
          <Field
            error={errors[field.name]}
            hint={field.hint}
            id={id}
            key={field.name}
            label={field.required ? field.label : `${field.label} (opcional)`}
          >
            <Control
              autoFocus={index === 0}
              disabled={pending}
              id={id}
              maxLength={field.maxLength}
              onChange={(event) => {
                setValues((prev) => ({
                  ...prev,
                  [field.name]: event.target.value,
                }))
                setErrors((prev) => ({ ...prev, [field.name]: '' }))
              }}
              placeholder={field.placeholder}
              value={values[field.name] ?? ''}
            />
          </Field>
        )
      })}
      <ButtonGroup
        className="justify-end pt-2"
        label={`Acciones del formulario de ${noun}`}
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
            : retrying
              ? 'Reintentar envío'
              : record
                ? 'Guardar cambios'
                : `Guardar ${noun}`}
        </Button>
      </ButtonGroup>
    </form>
  )
}
