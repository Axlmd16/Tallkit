import { useMemo, useState } from 'react'
import {
  Certificate,
  MapPin,
  PencilSimple,
  Plus,
  SealWarning,
} from '@phosphor-icons/react'

import type {
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'
import {
  Button,
  Dialog,
  ErrorState,
  getControlClasses,
  LoadingState,
  StatusBadge,
  Surface,
} from '@/shared/ui'

import {
  useElectronicProfile,
  useEstablishments,
  useFiscalMutations,
} from './hooks'
import type { CertificateMetadata, DeclaredCondition } from './types'

const conditionLabels: Record<string, string> = {
  tax_regime: 'Régimen tributario',
  accounting_obligation: 'Obligación de llevar contabilidad',
  special_taxpayer: 'Contribuyente especial',
  withholding_agent: 'Agente de retención',
  rimpe: 'RIMPE',
  artisan_qualification: 'Calificación artesanal',
}

function conditionText(condition: DeclaredCondition) {
  if (condition.status === 'UNKNOWN') return 'Condición desconocida'
  if (condition.status === 'NOT_APPLICABLE') return 'Declarada no aplicable'
  return condition.value || 'Declarada aplicable'
}

export function FiscalConfigurationSection({
  entities,
  taxDefinitions,
}: {
  entities: FiscalEntity[]
  taxDefinitions: TaxDefinition[]
}) {
  const [entityId, setEntityId] = useState(entities[0]?.id ?? 0)
  const selected =
    entities.find((entity) => entity.id === entityId) ?? entities[0]
  const profile = useElectronicProfile(selected?.id ?? 0)
  const establishments = useEstablishments(selected?.id ?? 0)
  const mutations = useFiscalMutations()
  const [editingProfile, setEditingProfile] = useState(false)
  const [addingLocation, setAddingLocation] = useState(false)
  const [pointFor, setPointFor] = useState<number | null>(null)
  const entityTaxes = useMemo(
    () =>
      taxDefinitions.filter(
        (definition) => definition.fiscal_entity_id === selected?.id,
      ),
    [selected?.id, taxDefinitions],
  )

  if (!selected) return null

  return (
    <section id="electronic-fiscal" className="scroll-mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">
            Configuración fiscal electrónica
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Declaraciones, establecimientos y correspondencias propias del
            sistema. Estos datos no acreditan habilitación ni autorización ante
            el SRI.
          </p>
        </div>
        <label className="ui-field min-w-64 text-sm font-semibold text-ink">
          Emisor
          <select
            className={`mt-1.5 ${getControlClasses()}`}
            value={selected.id}
            onChange={(event) => setEntityId(Number(event.target.value))}
          >
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.legal_name} · {entity.ruc}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Surface className="space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-control bg-primary-soft text-primary">
                <Certificate size={22} weight="duotone" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-bold text-ink">
                  Perfil tributario declarado
                </h3>
                <p className="text-sm text-ink-muted">
                  Revisión {profile.data?.revision ?? 0}
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setEditingProfile(true)}>
              <PencilSimple size={18} aria-hidden="true" />
              Editar perfil fiscal
            </Button>
          </header>

          {profile.isLoading ? (
            <LoadingState />
          ) : profile.isError ? (
            <ErrorState message="No se pudo cargar el perfil fiscal." />
          ) : (
            <>
              <dl className="divide-y divide-line border-y border-line">
                {Object.entries(profile.data?.conditions ?? {}).map(
                  ([name, condition]) => (
                    <div
                      key={name}
                      className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4"
                    >
                      <dt className="text-sm font-semibold text-ink">
                        {conditionLabels[name] ?? name}
                      </dt>
                      <dd className="text-sm text-ink-muted">
                        <span>{conditionText(condition)}</span>
                        {condition.starts_on && (
                          <span className="mt-1 block text-xs">
                            Vigencia declarada desde {condition.starts_on}
                            {condition.ends_on
                              ? ` hasta ${condition.ends_on}`
                              : ''}
                          </span>
                        )}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
              {profile.data?.certificate ? (
                <div className="rounded-panel border border-line bg-surface-subtle p-4">
                  <p className="font-semibold text-ink">
                    Metadatos del certificado
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {profile.data.certificate.reference} ·{' '}
                    {profile.data.certificate.issuer}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Vigencia declarada {profile.data.certificate.starts_on} —{' '}
                    {profile.data.certificate.ends_on}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-panel border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
                  <SealWarning size={20} aria-hidden="true" />
                  Certificado sin declarar
                </div>
              )}
            </>
          )}
        </Surface>

        <Surface className="space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-control bg-accent-soft text-accent">
                <MapPin size={22} weight="duotone" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-bold text-ink">
                  Establecimientos y puntos
                </h3>
                <p className="text-sm text-ink-muted">
                  Códigos fiscales de tres dígitos
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setAddingLocation(true)}>
              <Plus size={18} aria-hidden="true" />
              Añadir ubicación
            </Button>
          </header>
          {establishments.isLoading ? (
            <LoadingState />
          ) : establishments.isError ? (
            <ErrorState message="No se pudieron cargar establecimientos y puntos." />
          ) : establishments.data?.length ? (
            <div className="divide-y divide-line border-y border-line">
              {establishments.data.map((establishment) => (
                <article key={establishment.id} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-mono text-sm font-semibold text-ink">
                      Establecimiento {establishment.code}
                    </h4>
                    <StatusBadge
                      label={establishment.is_active ? 'Activo' : 'Inactivo'}
                      tone={establishment.is_active ? 'success' : 'neutral'}
                      shape="pill"
                    />
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {establishment.address}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {establishment.points.map((point) => (
                      <span
                        key={point.id}
                        className="rounded-chip border border-line bg-surface-subtle px-2.5 py-1 font-mono text-xs text-ink"
                      >
                        Punto {point.code}
                      </span>
                    ))}
                    <Button
                      variant="quiet"
                      onClick={() => setPointFor(establishment.id)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Añadir punto
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-panel border border-line bg-surface-subtle p-4 text-sm text-ink-muted">
              No hay establecimientos declarados para este emisor.
            </p>
          )}
        </Surface>
      </div>

      <TaxMappingForm
        definitions={entityTaxes}
        pending={mutations.createTaxMapping.isPending}
        onSubmit={(data) => mutations.createTaxMapping.mutate(data)}
      />

      <ProfileDialog
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        revision={profile.data?.revision ?? 0}
        conditions={profile.data?.conditions ?? {}}
        certificate={profile.data?.certificate ?? null}
        pending={mutations.saveProfile.isPending}
        error={
          mutations.saveProfile.isError ? mutations.saveProfile.error : null
        }
        onSubmit={(conditions, certificate) =>
          mutations.saveProfile.mutate(
            {
              entityId: selected.id,
              data: {
                expected_revision: profile.data?.revision ?? 0,
                conditions,
                certificate,
              },
              attemptKey: crypto.randomUUID(),
            },
            { onSuccess: () => setEditingProfile(false) },
          )
        }
      />
      <LocationDialog
        open={addingLocation}
        onClose={() => setAddingLocation(false)}
        pending={mutations.createEstablishment.isPending}
        onSubmit={(code, address) =>
          mutations.createEstablishment.mutate(
            { entityId: selected.id, code, address },
            { onSuccess: () => setAddingLocation(false) },
          )
        }
      />
      <PointDialog
        open={pointFor !== null}
        onClose={() => setPointFor(null)}
        pending={mutations.createPoint.isPending}
        onSubmit={(code) => {
          if (pointFor === null) return
          mutations.createPoint.mutate(
            { entityId: selected.id, establishmentId: pointFor, code },
            { onSuccess: () => setPointFor(null) },
          )
        }}
      />
    </section>
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
      open={open}
      onClose={onClose}
      title="Añadir punto de emisión"
      description="El código pertenece al establecimiento seleccionado y utiliza tres dígitos."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(String(new FormData(event.currentTarget).get('point_code')))
        }}
      >
        <label className="ui-field block text-sm font-semibold text-ink">
          Código del punto de emisión
          <input
            name="point_code"
            pattern="[0-9]{3}"
            maxLength={3}
            required
            className={`mt-1.5 ${getControlClasses()}`}
          />
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" pending={pending}>
            Añadir punto
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ProfileDialog({
  open,
  onClose,
  revision,
  conditions,
  certificate,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  revision: number
  conditions: Record<string, DeclaredCondition>
  certificate: CertificateMetadata | null
  pending: boolean
  error: Error | null
  onSubmit: (
    conditions: Record<string, DeclaredCondition>,
    certificate: CertificateMetadata | null,
  ) => void
}) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const reference = String(form.get('certificate_reference') ?? '').trim()
    const nextCertificate = reference
      ? {
          reference,
          holder: String(form.get('certificate_holder') ?? '').trim(),
          issuer: String(form.get('certificate_issuer') ?? '').trim(),
          source: String(form.get('certificate_source') ?? '').trim(),
          starts_on: String(form.get('certificate_starts_on') ?? ''),
          ends_on: String(form.get('certificate_ends_on') ?? ''),
        }
      : null
    onSubmit(conditions, nextCertificate)
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar perfil fiscal"
      description={`Metadatos declarados, revisión ${revision}. No cargue archivos ni claves privadas.`}
    >
      <form className="space-y-4" onSubmit={submit}>
        {error && <ErrorState message={error.message} />}
        {[
          [
            'certificate_reference',
            'Referencia del certificado',
            certificate?.reference,
          ],
          ['certificate_holder', 'Titular declarado', certificate?.holder],
          ['certificate_issuer', 'Emisor del certificado', certificate?.issuer],
          [
            'certificate_source',
            'Fuente de la declaración',
            certificate?.source,
          ],
        ].map(([name, label, value]) => (
          <label
            key={name}
            className="ui-field block text-sm font-semibold text-ink"
          >
            {label}
            <input
              id={name}
              name={name}
              defaultValue={value ?? ''}
              className={`mt-1.5 ${getControlClasses()}`}
            />
          </label>
        ))}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="ui-field text-sm font-semibold text-ink">
            Inicio de vigencia declarado
            <input
              name="certificate_starts_on"
              type="date"
              defaultValue={certificate?.starts_on ?? ''}
              className={`mt-1.5 ${getControlClasses()}`}
            />
          </label>
          <label className="ui-field text-sm font-semibold text-ink">
            Fin de vigencia declarado
            <input
              name="certificate_ends_on"
              type="date"
              defaultValue={certificate?.ends_on ?? ''}
              className={`mt-1.5 ${getControlClasses()}`}
            />
          </label>
        </div>
        <p className="text-xs text-ink-muted">
          El sistema conserva únicamente metadatos. La firma electrónica privada
          no se almacena en esta entrega.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" pending={pending}>
            Guardar perfil
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
      open={open}
      onClose={onClose}
      title="Añadir establecimiento"
      description="Registre el código fiscal de tres dígitos y su dirección declarada."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSubmit(String(data.get('code')), String(data.get('address')).trim())
        }}
      >
        <label className="ui-field block text-sm font-semibold text-ink">
          Código de establecimiento
          <input
            name="code"
            pattern="[0-9]{3}"
            maxLength={3}
            required
            className={`mt-1.5 ${getControlClasses()}`}
          />
        </label>
        <label className="ui-field block text-sm font-semibold text-ink">
          Dirección declarada
          <input
            name="address"
            maxLength={300}
            required
            className={`mt-1.5 ${getControlClasses()}`}
          />
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" pending={pending}>
            Añadir
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function TaxMappingForm({
  definitions,
  pending,
  onSubmit,
}: {
  definitions: TaxDefinition[]
  pending: boolean
  onSubmit: (data: {
    definition_id: number
    percentage_code: string
    starts_on: string
    source: string
  }) => void
}) {
  return (
    <Surface>
      <h3 className="font-bold text-ink">Correspondencia con catálogo SRI</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Relacione una definición interna con un código y vigencia documentados.
      </p>
      {definitions.length ? (
        <form
          className="mt-4 grid grid-cols-1 items-end gap-4 lg:grid-cols-[1fr_10rem_12rem_1.4fr_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            onSubmit({
              definition_id: Number(data.get('definition_id')),
              percentage_code: String(data.get('percentage_code')),
              starts_on: String(data.get('starts_on')),
              source: String(data.get('source')).trim(),
            })
          }}
        >
          <label className="ui-field text-sm font-semibold text-ink">
            Impuesto interno
            <select
              name="definition_id"
              className={`mt-1.5 ${getControlClasses()}`}
            >
              {definitions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field text-sm font-semibold text-ink">
            Código tarifa
            <input
              name="percentage_code"
              required
              maxLength={4}
              className={`mt-1.5 ${getControlClasses()}`}
            />
          </label>
          <label className="ui-field text-sm font-semibold text-ink">
            Inicio
            <input
              name="starts_on"
              type="date"
              required
              className={`mt-1.5 ${getControlClasses()}`}
            />
          </label>
          <label className="ui-field text-sm font-semibold text-ink">
            Fundamento
            <input
              name="source"
              required
              maxLength={500}
              className={`mt-1.5 ${getControlClasses()}`}
            />
          </label>
          <Button type="submit" pending={pending}>
            Guardar
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          Primero configure una definición tributaria para este emisor.
        </p>
      )}
    </Surface>
  )
}
