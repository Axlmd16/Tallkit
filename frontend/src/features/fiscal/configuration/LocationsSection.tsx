import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'

import {
  Button,
  ErrorState,
  FactList,
  FactRow,
  Field,
  FormModal,
  getControlClasses,
  LoadingState,
  SheetHeading,
  sheetTableCell,
  sheetTableHead,
  StateMark,
  useFieldProps,
  useToast,
} from '@/shared/ui'

import {
  useEstablishments,
  useFiscalMutations,
  usePreparationDefaults,
} from '../hooks'
import type { Establishment } from '../types'

type Dialog =
  | { kind: 'establishment' }
  | { kind: 'point'; establishment: Establishment }
  | { kind: 'default' }
  | null

export function LocationsSection({ entityId }: { entityId: number }) {
  const establishments = useEstablishments(entityId)
  const defaults = usePreparationDefaults(entityId)
  const [dialog, setDialog] = useState<Dialog>(null)

  if (establishments.isLoading || defaults.isLoading) return <LoadingState />
  if (establishments.isError)
    return (
      <ErrorState message="No se pudieron cargar establecimientos y puntos." />
    )

  const list = establishments.data ?? []
  const activePoints = list.flatMap((establishment) =>
    establishment.is_active
      ? establishment.points
          .filter((point) => point.is_active)
          .map((point) => ({
            id: point.id,
            code: `${establishment.code}-${point.code}`,
            address: establishment.address,
          }))
      : [],
  )
  const effectiveId = defaults.data?.effective_point_id ?? null
  const designatedId = defaults.data?.designated_point_id ?? null
  const effective = activePoints.find((point) => point.id === effectiveId)

  return (
    <section aria-labelledby={`puntos-${entityId}`} className="space-y-5">
      <SheetHeading
        id={`puntos-${entityId}`}
        actions={
          <Button
            onClick={() => setDialog({ kind: 'establishment' })}
            variant="secondary"
          >
            <Plus aria-hidden="true" size={16} weight="bold" />
            Añadir establecimiento
          </Button>
        }
        description="Códigos fiscales de tres dígitos. Los códigos no prueban registro ante el SRI."
        level={3}
        title="Establecimientos y puntos de emisión"
      />

      <FactList className="max-w-3xl">
        <FactRow label="Punto predeterminado">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {effective ? (
              <>
                <span className="font-mono font-semibold">
                  {effective.code}
                </span>
                <span className="text-[13px] text-ink-muted">
                  {designatedId === effective.id
                    ? 'Designado por el Administrador'
                    : 'Automático: es el único punto activo'}
                </span>
              </>
            ) : (
              <span className="font-semibold text-warning">
                {activePoints.length > 1
                  ? 'Falta seleccionar un punto predeterminado.'
                  : 'Registre un punto de emisión activo.'}
              </span>
            )}
            {activePoints.length > 1 && (
              <Button
                className="px-2"
                onClick={() => setDialog({ kind: 'default' })}
                variant="quiet"
              >
                {effective ? 'Cambiar' : 'Designar punto'}
              </Button>
            )}
          </span>
        </FactRow>
        <FactRow label="Ambiente">Pruebas (único disponible)</FactRow>
      </FactList>

      {list.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No hay establecimientos declarados para esta entidad.
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${sheetTableHead} w-[30%]`}>
                  Punto de emisión
                </th>
                <th className={sheetTableHead}>Estado</th>
                <th className={sheetTableHead}>Uso</th>
                <th className={sheetTableHead}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((establishment) => (
                <EstablishmentRows
                  effectiveId={effectiveId}
                  establishment={establishment}
                  key={establishment.id}
                  onAddPoint={() => setDialog({ kind: 'point', establishment })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'establishment' && (
        <EstablishmentModal
          entityId={entityId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'point' && (
        <PointModal
          entityId={entityId}
          establishment={dialog.establishment}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'default' && (
        <DefaultPointModal
          current={effectiveId}
          entityId={entityId}
          onClose={() => setDialog(null)}
          points={activePoints}
          version={defaults.data?.version ?? 0}
        />
      )}
    </section>
  )
}

function EstablishmentRows({
  establishment,
  effectiveId,
  onAddPoint,
}: {
  establishment: Establishment
  effectiveId: number | null
  onAddPoint: () => void
}) {
  return (
    <>
      <tr>
        <th
          className="border-b border-line-strong pt-6 pb-2.5 text-left font-normal"
          colSpan={3}
          scope="rowgroup"
        >
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-ink">
              Establecimiento{' '}
              <span className="font-mono">{establishment.code}</span>
            </span>
            <span className="text-[13px] text-ink-muted">
              {establishment.address}
            </span>
            {!establishment.is_active && (
              <StateMark label="Inactivo" tone="inactive" />
            )}
          </span>
        </th>
        <td className="border-b border-line-strong pt-6 pb-1.5 text-right">
          {establishment.is_active && (
            <Button
              aria-label={`Añadir punto al establecimiento ${establishment.code}`}
              className="px-2"
              onClick={onAddPoint}
              variant="quiet"
            >
              <Plus aria-hidden="true" size={14} weight="bold" />
              Añadir punto
            </Button>
          )}
        </td>
      </tr>
      {establishment.points.length === 0 ? (
        <tr>
          <td className={`${sheetTableCell} text-ink-muted`} colSpan={4}>
            Sin puntos de emisión.
          </td>
        </tr>
      ) : (
        establishment.points.map((point) => (
          <tr key={point.id}>
            <td className={`${sheetTableCell} font-mono font-semibold`}>
              {establishment.code}-{point.code}
            </td>
            <td className={sheetTableCell}>
              <StateMark
                label={point.is_active ? 'Activo' : 'Inactivo'}
                tone={point.is_active ? 'success' : 'inactive'}
              />
            </td>
            <td className={`${sheetTableCell} text-[13px]`}>
              {point.id === effectiveId ? (
                <span className="font-semibold text-accent-strong">
                  Predeterminado
                </span>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
            </td>
            <td className={sheetTableCell} />
          </tr>
        ))
      )}
    </>
  )
}

function CodeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={`${getControlClasses()} font-mono`}
      inputMode="numeric"
      maxLength={3}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  )
}

function validCode(code: string) {
  return /^\d{3}$/.test(code) && code !== '000'
}

const CODE_ERROR = 'Use tres dígitos, por ejemplo 001. No puede ser 000.'

function EstablishmentModal({
  entityId,
  onClose,
}: {
  entityId: number
  onClose: () => void
}) {
  const mutations = useFiscalMutations()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<{ code?: string; address?: string }>({})

  async function save() {
    const local = {
      ...(validCode(code) ? {} : { code: CODE_ERROR }),
      ...(address.trim() ? {} : { address: 'Escriba la dirección.' }),
    }
    setErrors(local)
    if (Object.keys(local).length) return false
    await mutations.createEstablishment.mutateAsync({
      entityId,
      code,
      address: address.trim(),
    })
    toast.success(`Establecimiento ${code} añadido.`)
    return true
  }

  return (
    <FormModal
      description="Registre el código fiscal de tres dígitos y su dirección."
      dirty={Boolean(code || address)}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Añadir establecimiento"
      title="Añadir establecimiento"
    >
      <div className="space-y-4">
        <Field error={errors.code} label="Código de establecimiento" required>
          <CodeInput onChange={setCode} value={code} />
        </Field>
        <Field
          error={errors.address}
          hint="Obligatoria para preparar datos fiscales."
          label="Dirección del establecimiento"
          required
        >
          <AddressInput onChange={setAddress} value={address} />
        </Field>
      </div>
    </FormModal>
  )
}

function AddressInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={getControlClasses()}
      maxLength={300}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  )
}

function PointModal({
  entityId,
  establishment,
  onClose,
}: {
  entityId: number
  establishment: Establishment
  onClose: () => void
}) {
  const mutations = useFiscalMutations()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()

  async function save() {
    if (!validCode(code)) {
      setError(CODE_ERROR)
      return false
    }
    await mutations.createPoint.mutateAsync({
      entityId,
      establishmentId: establishment.id,
      code,
    })
    toast.success(`Punto ${establishment.code}-${code} añadido.`)
    return true
  }

  return (
    <FormModal
      description={`El punto pertenece al establecimiento ${establishment.code} de esta entidad.`}
      dirty={Boolean(code)}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Añadir punto"
      title="Añadir punto de emisión"
    >
      <Field error={error} label="Código del punto de emisión" required>
        <CodeInput onChange={setCode} value={code} />
      </Field>
    </FormModal>
  )
}

function DefaultPointModal({
  entityId,
  points,
  current,
  version,
  onClose,
}: {
  entityId: number
  points: { id: number; code: string; address: string }[]
  current: number | null
  version: number
  onClose: () => void
}) {
  const mutations = useFiscalMutations()
  const toast = useToast()
  const [selected, setSelected] = useState(current ? String(current) : '')
  const [attemptKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string>()

  async function save() {
    if (!selected) {
      setError('Seleccione un punto activo.')
      return false
    }
    await mutations.savePreparationDefaults.mutateAsync({
      entityId,
      data: { expected_version: version, default_point_id: Number(selected) },
      attemptKey,
    })
    toast.success('Punto predeterminado actualizado.')
    return true
  }

  return (
    <FormModal
      description="Se usa automáticamente al preparar datos fiscales. Cambiarlo no altera preparaciones ya completadas."
      dirty={selected !== (current ? String(current) : '')}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Guardar punto"
      title="Punto predeterminado"
    >
      <Field
        error={error}
        hint="Solo puntos activos de esta entidad."
        label="Punto de emisión"
        required
      >
        <PointSelect onChange={setSelected} points={points} value={selected} />
      </Field>
    </FormModal>
  )
}

function PointSelect({
  points,
  value,
  onChange,
}: {
  points: { id: number; code: string; address: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const field = useFieldProps()
  return (
    <select
      {...field}
      className={getControlClasses()}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option disabled value="">
        Seleccione un punto
      </option>
      {points.map((point) => (
        <option key={point.id} value={point.id}>
          {point.code} · {point.address}
        </option>
      ))}
    </select>
  )
}
