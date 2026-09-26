import {
  Certificate,
  LockSimple,
  PencilSimple,
  Plus,
  ShieldCheck,
  WarningCircle,
} from '@phosphor-icons/react'
import { useState } from 'react'

import {
  Button,
  ErrorState,
  Field,
  FormModal,
  getControlClasses,
  HintPopover,
  LoadingState,
  StateChip,
  useFieldProps,
  useToast,
  type StateChipTone,
} from '@/shared/ui'

import { useElectronicProfile, useFiscalMutations } from '../hooks'
import type {
  CertificateMetadata,
  ElectronicProfile,
  StatusCause,
} from '../types'

type Values = Record<keyof CertificateMetadata, string>

const EMPTY: Values = {
  reference: '',
  holder: '',
  issuer: '',
  source: '',
  starts_on: '',
  ends_on: '',
}

const DAY = 86_400_000

function today() {
  return new Date().toISOString().slice(0, 10)
}

function addYears(date: string, years: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year! + years, month! - 1, day!))
  return next.toISOString().slice(0, 10)
}

/** Evaluación local por fechas; no consulta al certificador ni la revocación. */
export function certificateValidity(
  startsOn: string,
  endsOn: string,
  on = today(),
): { label: string; tone: StateChipTone; progress: number | null } {
  if (!startsOn || !endsOn)
    return { label: 'Sin fechas', tone: 'neutral', progress: null }
  if (endsOn <= startsOn)
    return { label: 'Fechas inválidas', tone: 'danger', progress: null }
  const start = Date.parse(startsOn)
  const end = Date.parse(endsOn)
  const now = Date.parse(on)
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)))
  if (on > endsOn)
    return { label: 'Vencido por fechas', tone: 'danger', progress }
  if (on < startsOn) return { label: 'Vigencia futura', tone: 'info', progress }
  const days = Math.ceil((end - now) / DAY)
  if (days <= 30)
    return {
      label: days === 1 ? 'Vence mañana' : `Vence en ${days} días`,
      tone: 'warning',
      progress,
    }
  return { label: 'Vigente por fechas', tone: 'success', progress }
}

const BAR_TONES: Record<StateChipTone, string> = {
  success: 'bg-success',
  warning: 'bg-[#c98a00]',
  danger: 'bg-danger',
  info: 'bg-info',
  primary: 'bg-primary',
  neutral: 'bg-line-strong',
}

export function CertificateSection({
  entityId,
  warnings = [],
}: {
  entityId: number
  warnings?: StatusCause[]
}) {
  const profile = useElectronicProfile(entityId)
  const [editing, setEditing] = useState(false)

  if (profile.isLoading) return <LoadingState />
  if (profile.isError || !profile.data)
    return <ErrorState message="No se pudo cargar el certificado." />
  const certificate = profile.data.certificate

  return (
    <section aria-label="Certificado electrónico" className="space-y-5">
      {certificate ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <CertificateCard className="w-full max-w-md" values={certificate} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setEditing(true)} variant="secondary">
              <PencilSimple aria-hidden="true" size={16} weight="bold" />
              Editar certificado
            </Button>
            {warnings.length > 0 && (
              <HintPopover
                label="Advertencias del certificado"
                trigger={
                  <>
                    <WarningCircle aria-hidden="true" size={16} weight="fill" />
                    Revisar
                  </>
                }
                triggerClassName="bg-warning-soft text-warning"
              >
                <ul className="list-none space-y-1.5 p-0">
                  {warnings.map((warning) => (
                    <li key={warning.code}>{warning.message}</li>
                  ))}
                </ul>
              </HintPopover>
            )}
          </div>
        </div>
      ) : (
        <button
          className="ui-button group flex w-full max-w-md items-center gap-4 rounded-panel border-2 border-dashed border-line-strong bg-surface-subtle px-5 py-5 text-left transition-colors hover:border-primary hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none motion-reduce:transition-none"
          onClick={() => setEditing(true)}
          type="button"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-soft text-primary group-hover:bg-surface">
            <Certificate aria-hidden="true" size={22} weight="duotone" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">
              Declarar certificado
            </span>
            <span className="block text-[13px] text-ink-muted">
              Sin certificado declarado. No impide la preparación local.
            </span>
          </span>
          <Plus
            aria-hidden="true"
            className="ml-auto text-primary"
            size={18}
            weight="bold"
          />
        </button>
      )}
      {editing && (
        <CertificateModal
          entityId={entityId}
          onClose={() => setEditing(false)}
          profile={profile.data}
        />
      )}
    </section>
  )
}

/** Tarjeta del certificado: consulta y vista previa en vivo del formulario. */
function CertificateCard({
  values,
  className = '',
}: {
  values: Values | CertificateMetadata
  className?: string
}) {
  const validity = certificateValidity(values.starts_on, values.ends_on)
  return (
    <article
      aria-label="Certificado declarado"
      className={`overflow-hidden rounded-panel border border-line bg-surface ${className}`}
    >
      <header className="flex items-center gap-2 bg-primary px-4 py-3 text-white">
        <ShieldCheck aria-hidden="true" size={18} weight="duotone" />
        <span className="text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase">
          Certificado de firma
        </span>
        <span className="ml-auto">
          <StateChip label={validity.label} tone={validity.tone} />
        </span>
      </header>
      <div className="space-y-3 px-4 py-4">
        <div>
          <p className="text-lg leading-snug font-bold break-words text-ink">
            {values.holder || (
              <span className="font-normal text-ink-muted">Titular</span>
            )}
          </p>
          <p className="text-[13px] text-ink-muted">
            {values.issuer || 'Entidad emisora'}
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          Referencia
          <span className="rounded-chip border border-line bg-surface-subtle px-2 py-0.5 font-mono text-[13px] text-ink">
            {values.reference || '—'}
          </span>
        </p>
        <div>
          <div className="flex justify-between font-mono text-xs text-ink-muted">
            <span>{values.starts_on || 'Inicio'}</span>
            <span>{values.ends_on || 'Vencimiento'}</span>
          </div>
          <div
            aria-hidden="true"
            className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted"
          >
            {validity.progress !== null && (
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${BAR_TONES[validity.tone]}`}
                style={{ width: `${Math.max(4, validity.progress * 100)}%` }}
              />
            )}
          </div>
        </div>
        {values.source && (
          <p className="text-xs text-ink-muted">Fuente: {values.source}</p>
        )}
      </div>
    </article>
  )
}

function CertificateModal({
  entityId,
  profile,
  onClose,
}: {
  entityId: number
  profile: ElectronicProfile
  onClose: () => void
}) {
  const mutations = useFiscalMutations()
  const toast = useToast()
  const initial: Values = { ...EMPTY, ...(profile.certificate ?? {}) }
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string>()
  const [attemptKey] = useState(() => crypto.randomUUID())
  const keys = Object.keys(EMPTY) as (keyof Values)[]
  const dirty = keys.some((key) => values[key] !== initial[key])
  const set = (key: keyof Values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  function setDuration(years: number) {
    const start = values.starts_on || today()
    setValues((current) => ({
      ...current,
      starts_on: start,
      ends_on: addYears(start, years),
    }))
  }

  async function save() {
    const trimmed = Object.fromEntries(
      keys.map((key) => [key, values[key].trim()]),
    ) as unknown as CertificateMetadata
    const filled = Object.values(trimmed).filter(Boolean).length
    if (filled > 0 && filled < keys.length) {
      setError(
        'Complete todos los datos del certificado o déjelos todos vacíos.',
      )
      return false
    }
    if (filled && trimmed.ends_on <= trimmed.starts_on) {
      setError('El vencimiento debe ser posterior a la fecha de inicio.')
      return false
    }
    setError(undefined)
    await mutations.saveProfile.mutateAsync({
      entityId,
      data: {
        expected_revision: profile.revision,
        conditions: profile.conditions,
        certificate: filled === 0 ? null : trimmed,
      },
      attemptKey,
    })
    toast.success('Datos del certificado guardados.')
    return true
  }

  return (
    <FormModal
      description="Datos de referencia del certificado de firma. Declárelos todos o déjelos vacíos."
      dirty={dirty}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Guardar certificado"
      size="large"
      title="Certificado electrónico"
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="space-y-5">
          {error && (
            <p className="text-xs font-semibold text-danger" role="alert">
              {error}
            </p>
          )}
          <Step number={1} title="Identificación">
            <Field
              hint="Número de serie u otro identificador público; nunca la contraseña."
              label="Referencia o identificador"
            >
              <Input
                className="font-mono"
                onChange={set('reference')}
                value={values.reference}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                hint="Persona o empresa a cuyo nombre se emitió."
                label="Titular"
              >
                <Input onChange={set('holder')} value={values.holder} />
              </Field>
              <Field
                hint="Entidad de certificación que lo emitió."
                label="Entidad emisora del certificado"
              >
                <Input onChange={set('issuer')} value={values.issuer} />
              </Field>
            </div>
          </Step>
          <Step number={2} title="Vigencia">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio">
                <Input
                  onChange={set('starts_on')}
                  type="date"
                  value={values.starts_on}
                />
              </Field>
              <Field
                hint="Su vencimiento solo genera una advertencia."
                label="Fecha de vencimiento"
              >
                <Input
                  onChange={set('ends_on')}
                  type="date"
                  value={values.ends_on}
                />
              </Field>
            </div>
            <div
              aria-label="Duración rápida"
              className="flex flex-wrap items-center gap-2"
              role="group"
            >
              <span className="text-xs text-ink-muted">Duración:</span>
              {[1, 2, 3].map((years) => (
                <button
                  className="ui-button min-h-8 rounded-full border border-line-strong bg-surface px-3 text-xs font-semibold text-ink hover:border-accent hover:bg-accent-soft hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  key={years}
                  onClick={() => setDuration(years)}
                  type="button"
                >
                  {years === 1 ? '1 año' : `${years} años`}
                </button>
              ))}
            </div>
          </Step>
          <Step number={3} title="Fuente">
            <Field
              hint="Documento del que se copiaron estos datos, por ejemplo el comprobante de compra."
              label="Fuente de la información"
            >
              <Input onChange={set('source')} value={values.source} />
            </Field>
          </Step>
        </div>
        <aside aria-label="Vista previa del certificado" className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
            Vista previa
          </p>
          <CertificateCard values={values} />
          <p className="flex items-start gap-2 rounded-control bg-surface-subtle px-3 py-2.5 text-xs text-ink-muted">
            <LockSimple
              aria-hidden="true"
              className="mt-px shrink-0"
              size={14}
              weight="bold"
            />
            No se cargan archivos P12, claves privadas ni contraseñas. Estos
            datos no permiten firmar ni emitir.
          </p>
        </aside>
      </div>
    </FormModal>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="min-w-0 space-y-3 border-0 p-0">
      <legend className="mb-3 flex items-center gap-2.5 p-0 text-sm font-semibold text-ink">
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary"
        >
          {number}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function Input({
  value,
  onChange,
  type = 'text',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  type?: string
  className?: string
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={`${getControlClasses()} ${className}`}
      onChange={(event) => onChange(event.target.value)}
      type={type}
      value={value}
    />
  )
}
