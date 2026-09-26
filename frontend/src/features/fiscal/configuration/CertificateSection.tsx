import { PencilSimple } from '@phosphor-icons/react'
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
  StateMark,
  useFieldProps,
  useToast,
} from '@/shared/ui'

import { useElectronicProfile, useFiscalMutations } from '../hooks'
import type {
  CertificateMetadata,
  ElectronicProfile,
  StatusCause,
} from '../types'
import { PendingNotes } from './PendingNotes'

const FIELDS: Array<{
  name: keyof CertificateMetadata
  label: string
  help: string
  type?: 'date'
}> = [
  {
    name: 'reference',
    label: 'Referencia o identificador',
    help: 'Número de serie u otro identificador público del certificado; nunca la contraseña.',
  },
  {
    name: 'holder',
    label: 'Titular',
    help: 'Persona o empresa a cuyo nombre se emitió.',
  },
  {
    name: 'issuer',
    label: 'Entidad emisora del certificado',
    help: 'Entidad de certificación que lo emitió.',
  },
  {
    name: 'source',
    label: 'Fuente de la información',
    help: 'Documento del que se copiaron estos datos, por ejemplo el comprobante de compra del certificado.',
  },
  {
    name: 'starts_on',
    label: 'Fecha de inicio',
    help: 'Inicio de vigencia declarado.',
    type: 'date',
  },
  {
    name: 'ends_on',
    label: 'Fecha de vencimiento',
    help: 'Fin de vigencia declarado; su vencimiento solo genera una advertencia.',
    type: 'date',
  },
]

/** Evaluación local por fechas; no consulta al certificador ni la revocación. */
function localValidity(certificate: CertificateMetadata) {
  const today = new Date().toISOString().slice(0, 10)
  if (certificate.ends_on < today)
    return { label: 'Vencido por fechas', tone: 'unknown' as const }
  if (certificate.starts_on > today)
    return { label: 'Vigencia futura', tone: 'inactive' as const }
  return { label: 'Vigente por fechas', tone: 'success' as const }
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
    <section aria-labelledby={`certificado-${entityId}`} className="space-y-5">
      <SheetHeading
        id={`certificado-${entityId}`}
        actions={
          <Button onClick={() => setEditing(true)} variant="secondary">
            <PencilSimple aria-hidden="true" size={16} weight="bold" />
            {certificate ? 'Editar' : 'Declarar certificado'}
          </Button>
        }
        description="Opcional. Solo datos de referencia: no equivale a una firma ni habilita la emisión."
        level={3}
        title="Certificado electrónico"
      />
      {certificate && (
        <PendingNotes causes={warnings} label="Advertencias del certificado" />
      )}
      {certificate ? (
        <FactList className="max-w-3xl">
          <FactRow label="Referencia">
            <span className="font-mono">{certificate.reference}</span>
          </FactRow>
          <FactRow label="Titular">{certificate.holder}</FactRow>
          <FactRow label="Emisor">{certificate.issuer}</FactRow>
          <FactRow label="Vigencia">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-[13px]">
                {certificate.starts_on} — {certificate.ends_on}
              </span>
              <StateMark {...localValidity(certificate)} />
            </span>
          </FactRow>
          <FactRow label="Fuente">{certificate.source}</FactRow>
        </FactList>
      ) : (
        <p className="text-sm text-ink-muted">Sin certificado declarado.</p>
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
  const initial = Object.fromEntries(
    FIELDS.map(({ name }) => [name, profile.certificate?.[name] ?? '']),
  ) as Record<keyof CertificateMetadata, string>
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string>()
  const [attemptKey] = useState(() => crypto.randomUUID())
  const dirty = FIELDS.some(({ name }) => values[name] !== initial[name])

  async function save() {
    const trimmed = Object.fromEntries(
      FIELDS.map(({ name }) => [name, values[name].trim()]),
    ) as unknown as CertificateMetadata
    const filled = Object.values(trimmed).filter(Boolean).length
    if (filled > 0 && filled < FIELDS.length) {
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
      description="Declare todos los datos o déjelos vacíos. No se cargan archivos P12, claves privadas ni contraseñas."
      dirty={dirty}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Guardar certificado"
      title="Certificado electrónico"
    >
      <div className="space-y-4">
        {error && (
          <p className="text-xs font-semibold text-danger" role="alert">
            {error}
          </p>
        )}
        {FIELDS.map((field) => (
          <Field hint={field.help} key={field.name} label={field.label}>
            <Input
              onChange={(value) =>
                setValues((current) => ({ ...current, [field.name]: value }))
              }
              type={field.type ?? 'text'}
              value={values[field.name]}
            />
          </Field>
        ))}
      </div>
    </FormModal>
  )
}

function Input({
  value,
  onChange,
  type,
}: {
  value: string
  onChange: (value: string) => void
  type: string
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={getControlClasses()}
      onChange={(event) => onChange(event.target.value)}
      type={type}
      value={value}
    />
  )
}
