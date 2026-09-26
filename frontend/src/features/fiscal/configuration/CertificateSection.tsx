import { useState } from 'react'

import {
  Button,
  ErrorState,
  getControlClasses,
  InlineNotice,
  LoadingState,
  Surface,
  useToast,
} from '@/shared/ui'

import { useElectronicProfile, useFiscalMutations } from '../hooks'
import type { CertificateMetadata } from '../types'
import { errorMessage, FieldHelp, SubsectionHeader } from './shared'

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

export function CertificateSection({ entityId }: { entityId: number }) {
  const profile = useElectronicProfile(entityId)
  const mutations = useFiscalMutations()
  const toast = useToast()
  const [localError, setLocalError] = useState<string | null>(null)

  if (profile.isLoading) return <LoadingState />
  if (profile.isError)
    return <ErrorState message="No se pudo cargar el certificado." />
  const certificate = profile.data?.certificate ?? null

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(
      FIELDS.map(({ name }) => [name, String(form.get(name) ?? '').trim()]),
    ) as unknown as CertificateMetadata
    const filled = Object.values(values).filter(Boolean).length
    if (filled > 0 && filled < FIELDS.length) {
      setLocalError(
        'Complete todos los datos del certificado o déjelos todos vacíos.',
      )
      return
    }
    setLocalError(null)
    mutations.saveProfile.mutate(
      {
        entityId,
        data: {
          expected_revision: profile.data?.revision ?? 0,
          conditions: profile.data?.conditions ?? {},
          certificate: filled === 0 ? null : values,
        },
        attemptKey: crypto.randomUUID(),
      },
      { onSuccess: () => toast.success('Datos del certificado guardados.') },
    )
  }

  return (
    <Surface className="space-y-5">
      <SubsectionHeader
        title="Certificado electrónico"
        description="Metadatos opcionales del certificado de firma electrónica que podría utilizarse en una futura emisión."
      />
      <InlineNotice title="Solo datos descriptivos" tone="info">
        Estos datos no equivalen a una firma ni a una autorización y no permiten
        emitir. No se cargan archivos P12, claves privadas ni contraseñas.
        Pueden quedar vacíos sin impedir la preparación local.
      </InlineNotice>
      {localError && <ErrorState message={localError} />}
      {mutations.saveProfile.isError && (
        <ErrorState message={errorMessage(mutations.saveProfile.error)} />
      )}
      <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit}>
        {FIELDS.map((field) => {
          const helpId = `cert-${entityId}-${field.name}`
          return (
            <div key={field.name}>
              <label className="ui-field block text-sm font-semibold text-ink">
                {field.label}
                <input
                  aria-describedby={helpId}
                  className={`mt-1.5 ${getControlClasses()}`}
                  defaultValue={certificate?.[field.name] ?? ''}
                  name={field.name}
                  type={field.type ?? 'text'}
                />
              </label>
              <FieldHelp id={helpId}>{field.help}</FieldHelp>
            </div>
          )
        })}
        <div className="flex justify-end md:col-span-2">
          <Button pending={mutations.saveProfile.isPending} type="submit">
            Guardar certificado
          </Button>
        </div>
      </form>
    </Surface>
  )
}
