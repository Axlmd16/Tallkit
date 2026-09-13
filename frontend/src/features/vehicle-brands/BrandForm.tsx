import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { ProblemError } from '@/shared/api/client'
import { Button, ButtonGroup, Field, InlineNotice, Input } from '@/shared/ui'

import type { VehicleBrandSummary } from './types'

export interface BrandFormProps {
  brand?: VehicleBrandSummary | undefined
  onSubmit: (data: {
    name: string
    expected_version?: number | undefined
  }) => Promise<void>
  onCancel?: (() => void) | undefined
  onDirtyChange?: ((dirty: boolean) => void) | undefined
}

export function BrandForm({
  brand,
  onSubmit,
  onCancel,
  onDirtyChange,
}: BrandFormProps) {
  const initialName = useMemo(() => brand?.name ?? '', [brand])
  const [name, setName] = useState(initialName)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = name !== initialName

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    const trimmed = name.trim()
    if (!trimmed) {
      errors.name = 'El nombre de la marca es obligatorio.'
    } else if (trimmed.length > 255) {
      errors.name = 'El nombre de la marca no puede exceder 255 caracteres.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setFormError(null)
    setFieldErrors({})

    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        expected_version: brand?.version ?? undefined,
      })
    } catch (err) {
      if (err instanceof ProblemError) {
        if (err.errors) {
          const mapped: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(err.errors)) {
            if (msgs.length > 0) {
              mapped[key] = msgs[0]!
            }
          }
          setFieldErrors(mapped)
        }
        setFormError(err.message)
      } else if (err instanceof Error) {
        setFormError(err.message)
      } else {
        setFormError(
          'Ocurrió un error inesperado al procesar la marca. Revise la lista antes de reintentar.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {formError && (
        <InlineNotice tone="danger" title="Error en el registro">
          {formError}
        </InlineNotice>
      )}

      <Field
        id="brand-name"
        label="Nombre de la marca"
        error={fieldErrors.name}
      >
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (fieldErrors.name) {
              setFieldErrors((prev) => ({ ...prev, name: '' }))
            }
          }}
          placeholder="Ej. Toyota, Chevrolet, Ford"
          maxLength={255}
          disabled={isSubmitting}
          autoFocus
        />
      </Field>

      <ButtonGroup
        label="Acciones del formulario de marca"
        className="justify-end pt-4"
      >
        {onCancel && (
          <Button
            type="button"
            variant="quiet"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting
            ? 'Guardando...'
            : brand
              ? 'Guardar cambios'
              : 'Guardar marca'}
        </Button>
      </ButtonGroup>
    </form>
  )
}
