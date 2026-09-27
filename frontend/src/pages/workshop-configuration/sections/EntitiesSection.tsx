import { ImageSquare, PencilSimple, Trash } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import {
  destinationHref,
  ELECTRONIC_STATE_LABELS,
  type ConfigurationReadiness,
  type EntityReadinessSummary,
} from '@/features/fiscal/configuration/readiness'
import { EntityLogoModal } from '@/features/workshop-configuration/EntityLogoModal'
import {
  useAllDocumentSeries,
  useFiscalEntities,
  useRemoveEntityLogo,
  useUpdateFiscalEntity,
} from '@/features/workshop-configuration/queries'
import type { FiscalEntity } from '@/features/workshop-configuration/types'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  ConfirmationPanel,
  ErrorState,
  FactList,
  FactRow,
  Field,
  FormModal,
  getControlClasses,
  LoadingState,
  RucPlate,
  ScopeLabel,
  SheetHeading,
  StatusBadge,
  useFieldProps,
  useToast,
} from '@/shared/ui'

/** Ámbito operativo de cada RUC según las decisiones confirmadas. */
const USE_BY_TYPE = {
  COMERCIAL: 'Proveedores, ingresos, inventario y ventas de repuestos',
  ARTESANAL: 'Mantenimientos, reparaciones, servicios y mano de obra',
} as const

export function EntitiesSection({
  readiness,
}: {
  readiness: ConfigurationReadiness
}) {
  const entities = useFiscalEntities()
  const { data: series } = useAllDocumentSeries()

  if (entities.isLoading) return <LoadingState />
  if (entities.isError)
    return (
      <ErrorState message="No se pudieron cargar las entidades fiscales." />
    )

  return (
    <section aria-labelledby="entidades-titulo" className="space-y-7">
      <SheetHeading
        id="entidades-titulo"
        description="Las dos identidades tributarias del taller. Cada documento se emite a nombre de una de ellas."
        title="Entidades fiscales"
      />
      <div className="grid gap-8 xl:grid-cols-2 xl:gap-0">
        {entities.data?.map((entity, index) => (
          <EntityColumn
            activeSeries={
              series?.filter(
                (item) =>
                  item.is_active && item.entity_type === entity.entity_type,
              ).length ?? 0
            }
            entity={entity}
            first={index === 0}
            key={entity.id}
            readiness={readiness.byEntity[entity.id]}
            readinessLoading={readiness.isLoading}
          />
        ))}
      </div>
    </section>
  )
}

function EntityColumn({
  entity,
  first,
  activeSeries,
  readiness,
  readinessLoading,
}: {
  entity: FiscalEntity
  first: boolean
  activeSeries: number
  readiness: EntityReadinessSummary | undefined
  readinessLoading: boolean
}) {
  const [editing, setEditing] = useState(false)
  const commercial = entity.entity_type === 'COMERCIAL'

  return (
    <article
      aria-label={`Entidad ${commercial ? 'comercial' : 'artesanal'}`}
      className={
        first
          ? 'xl:pr-10'
          : 'border-t border-line pt-8 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-10'
      }
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <ScopeLabel scope={commercial ? 'commercial' : 'artesanal'} />
          <h3 className="mt-2.5 text-2xl leading-tight font-bold break-words text-ink">
            {entity.legal_name}
          </h3>
          <RucPlate className="mt-3" ruc={entity.ruc} />
        </div>
        <Button
          aria-label={`Editar entidad ${commercial ? 'comercial' : 'artesanal'}`}
          onClick={() => setEditing(true)}
          variant="secondary"
        >
          <PencilSimple aria-hidden="true" size={16} weight="bold" />
          Editar
        </Button>
      </header>

      <FactList className="mt-7">
        <FactRow label="Razón social">{entity.legal_name}</FactRow>
        <FactRow label="Nombre comercial">
          {entity.trade_name || (
            <span className="text-ink-muted">Sin nombre comercial</span>
          )}
        </FactRow>
        <FactRow label="Logo">
          <EntityLogoRow entity={entity} />
        </FactRow>
        <FactRow label="Dirección">
          {entity.address || (
            <span className="text-ink-muted">Sin dirección registrada</span>
          )}
        </FactRow>
        <FactRow label="Se usa para">{USE_BY_TYPE[entity.entity_type]}</FactRow>
        <FactRow label="Facturación electrónica">
          <BillingState loading={readinessLoading} readiness={readiness} />
        </FactRow>
        <FactRow label="Series">
          {activeSeries === 1 ? '1 activa' : `${activeSeries} activas`} ·{' '}
          <Link
            className="font-medium text-accent hover:text-accent-strong hover:underline"
            replace
            to="?tab=series"
          >
            Ver numeración
          </Link>
        </FactRow>
      </FactList>

      <EditEntityModal
        entity={entity}
        onClose={() => setEditing(false)}
        open={editing}
      />
    </article>
  )
}

function EntityLogoRow({ entity }: { entity: FiscalEntity }) {
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const removeRef = useRef<HTMLButtonElement>(null)
  const remove = useRemoveEntityLogo()
  const toast = useToast()
  const scope = entity.entity_type === 'COMERCIAL' ? 'comercial' : 'artesanal'

  async function confirmRemoval() {
    setConfirming(false)
    try {
      await remove.mutateAsync({ id: entity.id, key: crypto.randomUUID() })
      toast.success(`Logo de la entidad ${scope} quitado.`)
    } catch {
      toast.info('No se pudo quitar el logo. Inténtelo nuevamente.')
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {entity.logo ? (
        <img
          alt={`Logo de ${entity.legal_name}`}
          className="max-h-10 max-w-[180px] object-contain"
          src={entity.logo.url}
        />
      ) : (
        <span className="text-ink-muted">Sin logo</span>
      )}
      <span className="-ml-2 flex flex-wrap gap-x-0.5">
        <Button
          aria-label={`${entity.logo ? 'Cambiar' : 'Subir'} logo de la entidad ${scope}`}
          className="px-2"
          onClick={() => setUploading(true)}
          size="40"
          variant="quiet"
        >
          <ImageSquare aria-hidden="true" size={16} weight="bold" />
          {entity.logo ? 'Cambiar' : 'Subir logo'}
        </Button>
        {entity.logo && (
          <Button
            aria-label={`Quitar logo de la entidad ${scope}`}
            className="px-2"
            onClick={() => setConfirming(true)}
            ref={removeRef}
            size="40"
            variant="quiet"
          >
            <Trash aria-hidden="true" size={16} weight="bold" />
            Quitar
          </Button>
        )}
      </span>
      <EntityLogoModal
        entity={entity}
        onClose={() => setUploading(false)}
        open={uploading}
      />
      <ConfirmationPanel
        confirmLabel="Quitar logo"
        description={`Los comprobantes de ${entity.legal_name} mostrarán solo el nombre de la entidad.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void confirmRemoval()}
        open={confirming}
        returnFocusRef={removeRef}
        title="¿Quitar el logo?"
        tone="danger"
      />
    </div>
  )
}

function BillingState({
  readiness,
  loading,
}: {
  readiness: EntityReadinessSummary | undefined
  loading: boolean
}) {
  if (!readiness)
    return (
      <span className="text-ink-muted">
        {loading ? 'Evaluando…' : 'No se pudo evaluar'}
      </span>
    )

  const label = ELECTRONIC_STATE_LABELS[readiness.state]
  if (readiness.state === 'READY')
    return <StatusBadge label={label} shape="pill" tone="success" />

  const cause = readiness.causes[0]
  return (
    <span className="flex flex-col items-start gap-1.5">
      <StatusBadge
        label={label}
        shape="pill"
        tone={readiness.state === 'NOT_CONFIGURED' ? 'neutral' : 'warning'}
      />
      {cause && (
        <span className="text-[13px] text-ink-muted">
          {cause.message}{' '}
          {readiness.firstDestination && (
            <Link
              className="font-medium text-accent hover:text-accent-strong hover:underline"
              replace
              to={destinationHref(readiness.firstDestination)}
            >
              Resolver
            </Link>
          )}
        </span>
      )}
    </span>
  )
}

type EntityField = 'ruc' | 'legal_name' | 'address'

function EditEntityModal({
  entity,
  open,
  onClose,
}: {
  entity: FiscalEntity
  open: boolean
  onClose: () => void
}) {
  const mutation = useUpdateFiscalEntity()
  const toast = useToast()
  const [values, setValues] = useState({
    ruc: entity.ruc,
    legal_name: entity.legal_name,
    address: entity.address ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<EntityField, string>>>({})
  const commercial = entity.entity_type === 'COMERCIAL'
  const dirty =
    values.ruc !== entity.ruc ||
    values.legal_name !== entity.legal_name ||
    values.address !== (entity.address ?? '')

  function close() {
    setValues({
      ruc: entity.ruc,
      legal_name: entity.legal_name,
      address: entity.address ?? '',
    })
    setErrors({})
    onClose()
  }

  async function save() {
    const local: Partial<Record<EntityField, string>> = {}
    if (!/^\d{13}$/.test(values.ruc.trim()))
      local.ruc = 'El RUC debe tener exactamente 13 dígitos.'
    if (!values.legal_name.trim()) local.legal_name = 'Escriba la razón social.'
    setErrors(local)
    if (Object.keys(local).length) return false

    try {
      await mutation.mutateAsync({
        id: entity.id,
        data: {
          ruc: values.ruc.trim(),
          legal_name: values.legal_name.trim(),
          address: values.address.trim(),
          expected_version: entity.version,
        },
      })
    } catch (caught) {
      if (caught instanceof ProblemError && caught.errors) {
        const mapped: Partial<Record<EntityField, string>> = {}
        for (const field of ['ruc', 'legal_name', 'address'] as const) {
          const message = caught.errors[field]?.[0]
          if (message) mapped[field] = message
        }
        if (Object.keys(mapped).length) {
          setErrors(mapped)
          return false
        }
      }
      throw caught
    }
    toast.success(
      `Entidad ${commercial ? 'comercial' : 'artesanal'} actualizada.`,
    )
    setErrors({})
    return true
  }

  function bind(name: EntityField) {
    return {
      name,
      value: values[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => ({ ...current, [name]: event.target.value })),
    }
  }

  return (
    <FormModal
      description="Los cambios se aplican a las operaciones futuras; los documentos ya confirmados conservan sus datos."
      dirty={dirty}
      onClose={close}
      onSave={save}
      open={open}
      saveLabel="Guardar cambios"
      title={`Editar entidad ${commercial ? 'comercial' : 'artesanal'}`}
    >
      <div className="space-y-4">
        <Field error={errors.ruc} hint="13 dígitos." label="RUC" required>
          <EntityInput
            {...bind('ruc')}
            className="font-mono"
            inputMode="numeric"
            maxLength={13}
          />
        </Field>
        <Field error={errors.legal_name} label="Razón social" required>
          <EntityInput {...bind('legal_name')} maxLength={200} />
        </Field>
        <Field error={errors.address} label="Dirección (opcional)">
          <EntityInput {...bind('address')} maxLength={300} />
        </Field>
      </div>
    </FormModal>
  )
}

function EntityInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      {...props}
      className={`${getControlClasses()} ${className}`}
    />
  )
}
