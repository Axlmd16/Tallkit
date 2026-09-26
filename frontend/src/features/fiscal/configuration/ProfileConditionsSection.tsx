import { useState } from 'react'

import {
  Button,
  ErrorState,
  getControlClasses,
  LoadingState,
  Surface,
  useToast,
} from '@/shared/ui'

import { useElectronicProfile, useFiscalMutations } from '../hooks'
import type { ConditionStatus, DeclaredCondition } from '../types'
import { errorMessage, FieldHelp, SubsectionHeader } from './shared'

export const CONDITIONS: Array<{
  key: string
  label: string
  help: string
  valueLabel: string
}> = [
  {
    key: 'tax_regime',
    label: 'Régimen tributario',
    help: 'Régimen que figura en el certificado de RUC, por ejemplo General o RIMPE.',
    valueLabel: 'Régimen declarado',
  },
  {
    key: 'accounting_obligation',
    label: 'Obligado a llevar contabilidad',
    help: 'Indique si el certificado de RUC señala la obligación de llevar contabilidad.',
    valueLabel: 'Detalle',
  },
  {
    key: 'special_taxpayer',
    label: 'Contribuyente especial',
    help: 'Solo si el SRI lo designó mediante resolución; registre su número.',
    valueLabel: 'Número de resolución',
  },
  {
    key: 'withholding_agent',
    label: 'Agente de retención',
    help: 'Solo si el SRI lo designó mediante resolución; registre su número.',
    valueLabel: 'Número de resolución',
  },
  {
    key: 'rimpe',
    label: 'RIMPE',
    help: 'Emprendedor o Negocio popular, según el certificado de RUC vigente.',
    valueLabel: 'Categoría RIMPE',
  },
  {
    key: 'artisan_qualification',
    label: 'Calificación artesanal',
    help: 'Número de calificación artesanal vigente, si existe. El tipo ARTESANAL del sistema no la acredita.',
    valueLabel: 'Número de calificación',
  },
]

const STATUS_LABELS: Record<ConditionStatus, string> = {
  UNKNOWN: 'Sin declarar',
  APPLICABLE: 'Aplica',
  NOT_APPLICABLE: 'No aplica',
}

function readCondition(form: FormData, key: string): DeclaredCondition {
  const status = String(
    form.get(`${key}.status`) ?? 'UNKNOWN',
  ) as ConditionStatus
  if (status === 'UNKNOWN') return { status }
  const text = (name: string) => String(form.get(`${key}.${name}`) ?? '').trim()
  const condition: DeclaredCondition = {
    status,
    source: text('source'),
    starts_on: text('starts_on'),
  }
  if (text('ends_on')) condition.ends_on = text('ends_on')
  if (status === 'APPLICABLE') condition.value = text('value')
  return condition
}

export function ProfileConditionsSection({ entityId }: { entityId: number }) {
  const profile = useElectronicProfile(entityId)
  const mutations = useFiscalMutations()
  const toast = useToast()
  const [statuses, setStatuses] = useState<Record<string, ConditionStatus>>({})

  if (profile.isLoading) return <LoadingState />
  if (profile.isError)
    return <ErrorState message="No se pudo cargar el perfil tributario." />
  const conditions = profile.data?.conditions ?? {}
  const revision = profile.data?.revision ?? 0
  const statusOf = (key: string): ConditionStatus =>
    statuses[key] ?? conditions[key]?.status ?? 'UNKNOWN'

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next = Object.fromEntries(
      CONDITIONS.map(({ key }) => [key, readCondition(form, key)]),
    )
    mutations.saveProfile.mutate(
      {
        entityId,
        data: {
          expected_revision: revision,
          conditions: next,
          certificate: profile.data?.certificate ?? null,
        },
        attemptKey: crypto.randomUUID(),
      },
      { onSuccess: () => toast.success('Perfil tributario guardado.') },
    )
  }

  return (
    <Surface className="space-y-5">
      <SubsectionHeader
        title="Perfil tributario declarado"
        description={
          revision === 0
            ? 'Sin configuración guardada. Declare cada condición según el certificado de RUC y la documentación vigente; el sistema no las deduce ni las valida con el SRI.'
            : 'Condiciones declaradas por el Administrador según el certificado de RUC. No constituyen una validación del SRI y deberán revisarse con el responsable tributario antes de emitir en producción.'
        }
      />
      {mutations.saveProfile.isError && (
        <ErrorState message={errorMessage(mutations.saveProfile.error)} />
      )}
      <form className="space-y-4" onSubmit={submit}>
        {CONDITIONS.map((item) => {
          const current = conditions[item.key]
          const status = statusOf(item.key)
          const helpId = `help-${entityId}-${item.key}`
          return (
            <fieldset
              className="rounded-panel border border-line p-4"
              key={item.key}
              aria-describedby={helpId}
            >
              <legend className="px-1 text-sm font-semibold text-ink">
                {item.label}
              </legend>
              <FieldHelp id={helpId}>{item.help}</FieldHelp>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="ui-field text-sm font-semibold text-ink">
                  Situación
                  <select
                    className={`mt-1.5 ${getControlClasses()}`}
                    name={`${item.key}.status`}
                    onChange={(event) =>
                      setStatuses((prev) => ({
                        ...prev,
                        [item.key]: event.target.value as ConditionStatus,
                      }))
                    }
                    value={status}
                  >
                    {(Object.keys(STATUS_LABELS) as ConditionStatus[]).map(
                      (value) => (
                        <option key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {status === 'APPLICABLE' && (
                  <label className="ui-field text-sm font-semibold text-ink">
                    {item.valueLabel}
                    <input
                      className={`mt-1.5 ${getControlClasses()}`}
                      defaultValue={current?.value ?? ''}
                      name={`${item.key}.value`}
                      required
                    />
                  </label>
                )}
                {status !== 'UNKNOWN' && (
                  <>
                    <label className="ui-field text-sm font-semibold text-ink">
                      Fuente o documento
                      <input
                        className={`mt-1.5 ${getControlClasses()}`}
                        defaultValue={current?.source ?? ''}
                        name={`${item.key}.source`}
                        placeholder="Certificado de RUC"
                        required
                      />
                    </label>
                    <label className="ui-field text-sm font-semibold text-ink">
                      Vigente desde
                      <input
                        className={`mt-1.5 ${getControlClasses()}`}
                        defaultValue={current?.starts_on ?? ''}
                        name={`${item.key}.starts_on`}
                        required
                        type="date"
                      />
                    </label>
                    <label className="ui-field text-sm font-semibold text-ink">
                      Vigente hasta (opcional)
                      <input
                        className={`mt-1.5 ${getControlClasses()}`}
                        defaultValue={current?.ends_on ?? ''}
                        name={`${item.key}.ends_on`}
                        type="date"
                      />
                    </label>
                  </>
                )}
              </div>
            </fieldset>
          )
        })}
        <div className="flex justify-end">
          <Button pending={mutations.saveProfile.isPending} type="submit">
            Guardar perfil tributario
          </Button>
        </div>
      </form>
    </Surface>
  )
}
