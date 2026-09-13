import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { useSession } from '@/features/auth/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { BrandForm } from '@/features/vehicle-brands/BrandForm'
import {
  useVehicleBrandMutations,
  useVehicleBrands,
} from '@/features/vehicle-brands/hooks'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  ButtonGroup,
  Field,
  InlineNotice,
  Input,
  Select,
} from '@/shared/ui'

import type { VehicleCreate, VehicleSummary, VehicleUpdate } from './types'

export interface VehicleFormProps {
  vehicle?: VehicleSummary | undefined
  defaultOwnerId?: number | undefined
  defaultOwnerName?: string | undefined
  onSubmit: (
    data: VehicleCreate | (VehicleUpdate & { id: number }),
  ) => Promise<void>
  onCancel?: (() => void) | undefined
  onDirtyChange?: ((dirty: boolean) => void) | undefined
  onCreateBrandRequested?: (() => void) | undefined
}

export function VehicleForm({
  vehicle,
  defaultOwnerId,
  defaultOwnerName,
  onSubmit,
  onCancel,
  onDirtyChange,
  onCreateBrandRequested,
}: VehicleFormProps) {
  const isEditing = Boolean(vehicle)

  const initialOwnerId = useMemo(
    () => vehicle?.current_owner?.id ?? defaultOwnerId ?? '',
    [vehicle, defaultOwnerId],
  )
  const initialBrandId = useMemo(
    () => (vehicle?.brand?.id ? String(vehicle.brand.id) : ''),
    [vehicle],
  )
  const initialPlate = useMemo(() => vehicle?.plate ?? '', [vehicle])
  const initialModel = useMemo(() => vehicle?.model ?? '', [vehicle])
  const initialColor = useMemo(() => vehicle?.color ?? '', [vehicle])
  const initialYear = useMemo(
    () => (vehicle?.year ? String(vehicle.year) : ''),
    [vehicle],
  )
  const initialVin = useMemo(() => vehicle?.vin ?? '', [vehicle])

  const [ownerId, setOwnerId] = useState<string | number>(initialOwnerId)
  const [brandId, setBrandId] = useState<string>(initialBrandId)
  const [plate, setPlate] = useState(initialPlate)
  const [model, setModel] = useState(initialModel)
  const [color, setColor] = useState(initialColor)
  const [year, setYear] = useState(initialYear)
  const [vin, setVin] = useState(initialVin)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const session = useSession().data
  const canManageBrands =
    session?.permissions?.includes('marcas_vehiculo.gestionar') ?? false
  const [isCreatingBrand, setIsCreatingBrand] = useState(false)
  const brandMutations = useVehicleBrandMutations()

  // Fetch active brands
  const brandsQuery = useVehicleBrands({ isActive: true, pageSize: 100 })
  const brands = brandsQuery.data?.results ?? []

  // If vehicle has an inactive brand, preserve it in the options
  const brandOptions = useMemo(() => {
    const list = [...brands]
    if (
      vehicle?.brand &&
      !vehicle.brand.is_active &&
      !list.some((b) => b.id === vehicle.brand.id)
    ) {
      list.push({
        ...vehicle.brand,
        name: `${vehicle.brand.name} (Inactiva)`,
        version: 1,
        created_at: '',
        updated_at: '',
      })
    }
    return list
  }, [brands, vehicle])

  // Fetch active customers for selector (if not fixed)
  const customersQuery = useCustomers({ isActive: true })
  const customers = customersQuery.data?.results ?? []

  const isDirty =
    String(ownerId) !== String(initialOwnerId) ||
    brandId !== initialBrandId ||
    plate !== initialPlate ||
    model !== initialModel ||
    color !== initialColor ||
    year !== initialYear ||
    vin !== initialVin

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
    if (!isEditing && (!ownerId || Number(ownerId) <= 0)) {
      errors.owner_id = 'Debe seleccionar un propietario para el vehículo.'
    }
    if (!brandId || Number(brandId) <= 0) {
      errors.brand_id = 'Debe seleccionar una marca para el vehículo.'
    }
    const trimmedPlate = plate.trim()
    if (!trimmedPlate) {
      errors.plate = 'La placa del vehículo es obligatoria.'
    }
    const trimmedModel = model.trim()
    if (!trimmedModel) {
      errors.model = 'El modelo del vehículo es obligatorio.'
    }
    if (year.trim()) {
      const numYear = Number(year)
      const currentYear = new Date().getFullYear()
      if (
        !Number.isInteger(numYear) ||
        numYear < 1900 ||
        numYear > currentYear + 1
      ) {
        errors.year = `El año debe ser un número entero entre 1900 y ${currentYear + 1}.`
      }
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
      if (isEditing && vehicle) {
        const updatePayload: VehicleUpdate & { id: number } = {
          id: vehicle.id,
          expected_version: vehicle.version,
          brand_id: Number(brandId),
          plate: plate.trim().toUpperCase(),
          model: model.trim(),
          color: color.trim(),
          year: year.trim() ? Number(year) : null,
          vin: vin.trim() || null,
        }
        await onSubmit(updatePayload)
      } else {
        const createPayload: VehicleCreate = {
          owner_id: Number(ownerId),
          brand_id: Number(brandId),
          plate: plate.trim().toUpperCase(),
          model: model.trim(),
          color: color.trim() || undefined,
          year: year.trim() ? Number(year) : undefined,
          vin: vin.trim() || undefined,
        }
        await onSubmit(createPayload)
      }
    } catch (err) {
      if (err instanceof ProblemError) {
        if (err.code === 'duplicate_plate') {
          setFieldErrors((prev) => ({
            ...prev,
            plate: 'Ya existe un vehículo registrado con esta placa.',
          }))
          setFormError('Ya existe un vehículo registrado con esta placa.')
        } else if (err.code === 'duplicate_vin') {
          setFieldErrors((prev) => ({
            ...prev,
            vin: 'Ya existe un vehículo registrado con este VIN.',
          }))
          setFormError('Ya existe un vehículo registrado con este VIN.')
        } else if (err.code === 'stale_record') {
          setFormError(
            'El registro fue modificado por otro usuario. Recargue la página para ver la versión más reciente.',
          )
        } else if (err.code === 'inactive_reference') {
          setFormError(
            'La marca o el cliente seleccionado se encuentra inactivo. Verifique la selección.',
          )
        } else {
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
        }
      } else if (err instanceof Error) {
        setFormError(err.message)
      } else {
        setFormError(
          'Ocurrió un error inesperado al procesar el vehículo. Revise la lista antes de reintentar.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCreatingBrand) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-surface-muted pb-3">
          <div>
            <h3 className="text-base font-bold text-ink">
              Nueva marca de vehículo
            </h3>
            <p className="text-xs text-ink-muted">
              Cree la marca y volverá al formulario del vehículo con la marca
              seleccionada.
            </p>
          </div>
          <Button
            variant="quiet"
            type="button"
            onClick={() => setIsCreatingBrand(false)}
            className="text-xs"
          >
            Volver
          </Button>
        </div>
        <BrandForm
          onSubmit={async ({ name }) => {
            const created = await brandMutations.createBrand.mutateAsync({
              name,
            })
            setBrandId(String(created.id))
            setIsCreatingBrand(false)
          }}
          onCancel={() => setIsCreatingBrand(false)}
        />
      </div>
    )
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {formError && (
        <InlineNotice tone="danger" title="Error en el formulario">
          {formError}
        </InlineNotice>
      )}

      {/* Propietario */}
      {isEditing ? (
        <div className="rounded-card border border-ink/10 bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Propietario actual
          </p>
          <p className="mt-1 font-medium text-ink">
            {vehicle?.current_owner?.name ?? 'Sin propietario asignado'} (
            {vehicle?.current_owner?.identification})
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            El cambio de propietario se realiza mediante la opción de
            transferencia.
          </p>
        </div>
      ) : defaultOwnerId && defaultOwnerName ? (
        <div className="rounded-card border border-ink/10 bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Propietario asignado
          </p>
          <p className="mt-1 font-medium text-ink">{defaultOwnerName}</p>
        </div>
      ) : (
        <Field
          label="Propietario *"
          hint="Seleccione el cliente propietario del vehículo."
          error={fieldErrors.owner_id}
        >
          <Select
            aria-label="Propietario"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            <option value="">Seleccione un cliente…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.identification})
              </option>
            ))}
          </Select>
        </Field>
      )}

      {/* Marca con opción de crear si falta */}
      <div className="space-y-2">
        <Field
          label="Marca de vehículo *"
          hint="Seleccione la marca del catálogo de marcas."
          error={fieldErrors.brand_id}
        >
          <div className="flex gap-2">
            <Select
              aria-label="Marca de vehículo"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="flex-1"
            >
              <option value="">Seleccione una marca…</option>
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            {(onCreateBrandRequested || canManageBrands) && (
              <Button
                variant="secondary"
                type="button"
                onClick={
                  onCreateBrandRequested
                    ? onCreateBrandRequested
                    : () => setIsCreatingBrand(true)
                }
                title="Crear nueva marca"
              >
                Nueva marca
              </Button>
            )}
          </div>
        </Field>
      </div>

      {/* Placa y Modelo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Placa *"
          hint="Ejemplo: ABC-1234 o ABC-123"
          error={fieldErrors.plate}
        >
          <Input
            aria-label="Placa"
            placeholder="ABC-1234"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            autoComplete="off"
          />
        </Field>

        <Field
          label="Modelo *"
          hint="Ejemplo: Corolla, Hilux, Yaris"
          error={fieldErrors.model}
        >
          <Input
            aria-label="Modelo"
            placeholder="Modelo del vehículo"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>

      {/* Color, Año, VIN opcionales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Color (opcional)" error={fieldErrors.color}>
          <Input
            aria-label="Color"
            placeholder="Ejemplo: Blanco, Gris"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            autoComplete="off"
          />
        </Field>

        <Field label="Año (opcional)" error={fieldErrors.year}>
          <Input
            aria-label="Año"
            type="number"
            placeholder="Ejemplo: 2023"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            autoComplete="off"
          />
        </Field>

        <Field label="VIN (opcional)" error={fieldErrors.vin}>
          <Input
            aria-label="VIN"
            placeholder="Número de chasis (17 caracteres)"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            autoComplete="off"
          />
        </Field>
      </div>

      <ButtonGroup label="Acciones del formulario">
        <Button
          type="submit"
          variant="primary"
          pending={isSubmitting}
          pendingLabel={isEditing ? 'Guardando…' : 'Registrando…'}
        >
          {isEditing ? 'Guardar cambios' : 'Guardar vehículo'}
        </Button>
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
      </ButtonGroup>
    </form>
  )
}
