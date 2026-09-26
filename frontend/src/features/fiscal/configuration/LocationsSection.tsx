import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'

import {
  Button,
  Dialog,
  ErrorState,
  getControlClasses,
  InlineNotice,
  LoadingState,
  StatusBadge,
  Surface,
  useToast,
} from '@/shared/ui'

import {
  useEstablishments,
  useFiscalMutations,
  usePreparationDefaults,
} from '../hooks'
import { errorMessage, FieldHelp, SubsectionHeader } from './shared'

export function LocationsSection({ entityId }: { entityId: number }) {
  const establishments = useEstablishments(entityId)
  const defaults = usePreparationDefaults(entityId)
  const mutations = useFiscalMutations()
  const toast = useToast()
  const [addingLocation, setAddingLocation] = useState(false)
  const [pointFor, setPointFor] = useState<number | null>(null)

  if (establishments.isLoading || defaults.isLoading) return <LoadingState />
  if (establishments.isError) {
    return (
      <ErrorState message="No se pudieron cargar establecimientos y puntos." />
    )
  }
  const activePoints = (establishments.data ?? []).flatMap((establishment) =>
    establishment.is_active
      ? establishment.points
          .filter((point) => point.is_active)
          .map((point) => ({
            id: point.id,
            label: `${establishment.code}-${point.code} · ${establishment.address}`,
          }))
      : [],
  )
  const effective = defaults.data?.effective_point_id ?? null

  const designate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const pointId = Number(
      new FormData(event.currentTarget).get('default_point_id'),
    )
    mutations.savePreparationDefaults.mutate(
      {
        entityId,
        data: {
          expected_version: defaults.data?.version ?? 0,
          default_point_id: pointId,
        },
        attemptKey: crypto.randomUUID(),
      },
      { onSuccess: () => toast.success('Punto predeterminado actualizado.') },
    )
  }

  return (
    <Surface className="space-y-5">
      <SubsectionHeader
        title="Establecimientos y puntos de emisión"
        description="Códigos fiscales de tres dígitos. El punto predeterminado se usa automáticamente al preparar datos fiscales; los códigos no prueban registro ante el SRI."
        actions={
          <Button onClick={() => setAddingLocation(true)} variant="secondary">
            <Plus aria-hidden="true" size={18} />
            Añadir establecimiento
          </Button>
        }
      />
      {(mutations.createEstablishment.isError ||
        mutations.createPoint.isError) && (
        <ErrorState
          message={errorMessage(
            mutations.createEstablishment.error ?? mutations.createPoint.error,
          )}
        />
      )}
      {establishments.data?.length ? (
        <div className="divide-y divide-line border-y border-line">
          {establishments.data.map((establishment) => (
            <article className="py-4" key={establishment.id}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-mono text-sm font-semibold text-ink">
                  Establecimiento {establishment.code}
                </h4>
                <StatusBadge
                  label={establishment.is_active ? 'Activo' : 'Inactivo'}
                  shape="pill"
                  tone={establishment.is_active ? 'success' : 'neutral'}
                />
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {establishment.address}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {establishment.points.map((point) => (
                  <span
                    className="rounded-chip border border-line bg-surface-subtle px-2.5 py-1 font-mono text-xs text-ink"
                    key={point.id}
                  >
                    Punto {point.code}
                    {point.id === effective && ' · predeterminado'}
                    {!point.is_active && ' · inactivo'}
                  </span>
                ))}
                <Button
                  onClick={() => setPointFor(establishment.id)}
                  variant="quiet"
                >
                  <Plus aria-hidden="true" size={16} />
                  Añadir punto
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-panel border border-line bg-surface-subtle p-4 text-sm text-ink-muted">
          No hay establecimientos declarados para esta entidad.
        </p>
      )}

      {defaults.data?.point_issue === 'default_point_required' && (
        <InlineNotice title="Falta el punto predeterminado" tone="warning">
          Hay varios puntos activos. Designe cuál se usará al preparar datos
          fiscales.
        </InlineNotice>
      )}
      {mutations.savePreparationDefaults.isError && (
        <ErrorState
          message={errorMessage(mutations.savePreparationDefaults.error)}
        />
      )}
      {activePoints.length > 1 && (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={designate}
        >
          <div className="min-w-0 flex-1">
            <label className="ui-field block text-sm font-semibold text-ink">
              Punto predeterminado para preparar
              <select
                aria-describedby={`default-point-help-${entityId}`}
                className={`mt-1.5 ${getControlClasses()}`}
                defaultValue={effective ?? ''}
                key={effective ?? 'none'}
                name="default_point_id"
                required
              >
                <option disabled value="">
                  Seleccione un punto
                </option>
                {activePoints.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.label}
                  </option>
                ))}
              </select>
            </label>
            <FieldHelp id={`default-point-help-${entityId}`}>
              Solo puntos activos de esta entidad. Cambiarlo no altera
              preparaciones ya completadas.
            </FieldHelp>
          </div>
          <Button
            pending={mutations.savePreparationDefaults.isPending}
            type="submit"
          >
            Designar punto
          </Button>
        </form>
      )}
      {activePoints.length === 1 && (
        <p className="text-sm text-ink-muted">
          Hay un único punto activo y se usa automáticamente como
          predeterminado.
        </p>
      )}

      <LocationDialog
        onClose={() => setAddingLocation(false)}
        onSubmit={(code, address) =>
          mutations.createEstablishment.mutate(
            { entityId, code, address },
            { onSuccess: () => setAddingLocation(false) },
          )
        }
        open={addingLocation}
        pending={mutations.createEstablishment.isPending}
      />
      <PointDialog
        onClose={() => setPointFor(null)}
        onSubmit={(code) => {
          if (pointFor === null) return
          mutations.createPoint.mutate(
            { entityId, establishmentId: pointFor, code },
            { onSuccess: () => setPointFor(null) },
          )
        }}
        open={pointFor !== null}
        pending={mutations.createPoint.isPending}
      />
    </Surface>
  )
}

function CodeInput({
  label,
  name,
  help,
}: {
  label: string
  name: string
  help: string
}) {
  return (
    <div>
      <label className="ui-field block text-sm font-semibold text-ink">
        {label}
        <input
          aria-describedby={`${name}-help`}
          className={`mt-1.5 ${getControlClasses()}`}
          inputMode="numeric"
          maxLength={3}
          name={name}
          pattern="[0-9]{3}"
          required
        />
      </label>
      <FieldHelp id={`${name}-help`}>{help}</FieldHelp>
    </div>
  )
}

function PointDialog({
  open,
  onClose,
  pending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  onSubmit: (code: string) => void
}) {
  return (
    <Dialog
      description="El código pertenece al establecimiento seleccionado."
      onClose={onClose}
      open={open}
      title="Añadir punto de emisión"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(String(new FormData(event.currentTarget).get('point_code')))
        }}
      >
        <CodeInput
          help="Tres dígitos, por ejemplo 001. No puede ser 000."
          label="Código del punto de emisión"
          name="point_code"
        />
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="quiet">
            Cancelar
          </Button>
          <Button pending={pending} type="submit">
            Añadir punto
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function LocationDialog({
  open,
  onClose,
  pending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  pending: boolean
  onSubmit: (code: string, address: string) => void
}) {
  return (
    <Dialog
      description="Registre el código fiscal de tres dígitos y su dirección."
      onClose={onClose}
      open={open}
      title="Añadir establecimiento"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSubmit(String(data.get('code')), String(data.get('address')).trim())
        }}
      >
        <CodeInput
          help="Tres dígitos, por ejemplo 001. No puede ser 000."
          label="Código de establecimiento"
          name="code"
        />
        <label className="ui-field block text-sm font-semibold text-ink">
          Dirección del establecimiento
          <input
            className={`mt-1.5 ${getControlClasses()}`}
            maxLength={300}
            name="address"
            required
          />
        </label>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} type="button" variant="quiet">
            Cancelar
          </Button>
          <Button pending={pending} type="submit">
            Añadir
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
