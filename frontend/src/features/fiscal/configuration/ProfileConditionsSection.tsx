import { useState } from 'react'

import { ProblemError } from '@/shared/api/client'
import {
  AdvancedInfo,
  Button,
  ErrorState,
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

import { useElectronicProfile, useFiscalMutations } from '../hooks'
import type {
  ConditionStatus,
  DeclaredCondition,
  ElectronicProfile,
} from '../types'

export const CONDITIONS = [
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
] as const

type ConditionItem = (typeof CONDITIONS)[number]

const STATUS_LABELS: Record<ConditionStatus, string> = {
  UNKNOWN: 'Sin declarar',
  APPLICABLE: 'Aplica',
  NOT_APPLICABLE: 'No aplica',
}

const STATUS_TONES = {
  UNKNOWN: 'unknown',
  APPLICABLE: 'active',
  NOT_APPLICABLE: 'inactive',
} as const

export function ProfileConditionsSection({ entityId }: { entityId: number }) {
  const profile = useElectronicProfile(entityId)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  if (profile.isLoading) return <LoadingState />
  if (profile.isError || !profile.data)
    return <ErrorState message="No se pudo cargar el perfil tributario." />

  const data = profile.data
  const conditions = data.conditions ?? {}
  const selected = CONDITIONS.find((item) => item.key === selectedKey)
  const declared = CONDITIONS.filter(
    (item) => (conditions[item.key]?.status ?? 'UNKNOWN') !== 'UNKNOWN',
  )

  return (
    <section aria-labelledby={`perfil-${entityId}`} className="space-y-4">
      <SheetHeading
        id={`perfil-${entityId}`}
        description={
          data.revision
            ? 'Condiciones declaradas según el certificado de RUC. No son una validación del SRI.'
            : 'Sin configuración guardada. Declare cada condición según el certificado de RUC; el sistema no las deduce ni las valida con el SRI.'
        }
        level={3}
        title="Perfil tributario"
      />
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${sheetTableHead} w-[30%]`}>Condición</th>
              <th className={sheetTableHead}>Declaración</th>
              <th className={sheetTableHead}>Detalle</th>
              <th className={sheetTableHead}>Vigente desde</th>
              <th className={sheetTableHead}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {CONDITIONS.map((item) => {
              const condition = conditions[item.key]
              const status = condition?.status ?? 'UNKNOWN'
              const action = status === 'UNKNOWN' ? 'Declarar' : 'Editar'
              return (
                <tr key={item.key}>
                  <th
                    className={`${sheetTableCell} text-left font-normal text-ink`}
                    scope="row"
                  >
                    {item.label}
                  </th>
                  <td className={sheetTableCell}>
                    <StateMark
                      label={STATUS_LABELS[status]}
                      tone={STATUS_TONES[status]}
                    />
                  </td>
                  <td className={sheetTableCell}>
                    {status === 'APPLICABLE' && condition?.value ? (
                      condition.value
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className={`${sheetTableCell} font-mono text-[13px]`}>
                    {condition?.starts_on ?? (
                      <span className="font-sans text-ink-muted">—</span>
                    )}
                  </td>
                  <td className={sheetTableCell}>
                    <Button
                      aria-label={`${action} ${item.label}`}
                      className="px-2"
                      onClick={() => setSelectedKey(item.key)}
                      variant="quiet"
                    >
                      {action}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AdvancedInfo hint="sustentos, fechas de fin y revisión">
        <p>Revisión del perfil: {data.revision || 'sin guardar'}.</p>
        {declared.length === 0 ? (
          <p>Todavía no hay condiciones declaradas.</p>
        ) : (
          <ul className="list-none space-y-1 p-0">
            {declared.map((item) => {
              const condition = conditions[item.key]!
              return (
                <li key={item.key}>
                  <span className="font-semibold text-ink">{item.label}:</span>{' '}
                  {condition.source || 'sin sustento'}
                  {condition.ends_on ? ` · hasta ${condition.ends_on}` : ''}
                </li>
              )
            })}
          </ul>
        )}
      </AdvancedInfo>
      {selected && (
        <ConditionDialog
          entityId={entityId}
          item={selected}
          key={selected.key}
          onClose={() => setSelectedKey(null)}
          profile={data}
        />
      )}
    </section>
  )
}

export function ConditionDialog({
  entityId,
  item,
  onClose,
  profile,
}: {
  entityId: number
  item: ConditionItem
  onClose: () => void
  profile: ElectronicProfile
}) {
  const mutations = useFiscalMutations()
  const toast = useToast()
  const condition = profile.conditions[item.key]
  const initial = {
    status: condition?.status ?? ('UNKNOWN' as ConditionStatus),
    value: condition?.value ?? '',
    source: condition?.source ?? '',
    startsOn: condition?.starts_on ?? '',
    endsOn: condition?.ends_on ?? '',
  }
  const [values, setValues] = useState(initial)
  const [attemptKey] = useState(() => crypto.randomUUID())
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (key) => values[key] !== initial[key],
  )
  const set = (key: keyof typeof initial) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  async function save() {
    const next: DeclaredCondition =
      values.status === 'UNKNOWN'
        ? { status: 'UNKNOWN' }
        : {
            status: values.status,
            source: values.source.trim(),
            starts_on: values.startsOn,
            ...(values.endsOn ? { ends_on: values.endsOn } : {}),
            ...(values.status === 'APPLICABLE'
              ? { value: values.value.trim() }
              : {}),
          }
    // Se envía el perfil completo: las demás condiciones y el certificado no cambian.
    const preserved = Object.fromEntries(
      CONDITIONS.map(({ key }) => [
        key,
        profile.conditions[key] ?? { status: 'UNKNOWN' as const },
      ]),
    )
    try {
      await mutations.saveProfile.mutateAsync({
        entityId,
        data: {
          expected_revision: profile.revision,
          conditions: { ...preserved, [item.key]: next },
          certificate: profile.certificate ?? null,
        },
        attemptKey,
      })
    } catch (caught) {
      if (caught instanceof ProblemError && caught.status === 409)
        throw new Error(
          'Otro guardado cambió el perfil mientras editaba. Cierre este formulario para ver los datos actuales y vuelva a intentarlo; lo escrito se conserva hasta que lo cierre.',
          { cause: caught },
        )
      throw caught
    }
    toast.success('Condición guardada.')
    return true
  }

  const title = `${initial.status === 'UNKNOWN' ? 'Declarar' : 'Editar'}: ${item.label}`

  return (
    <FormModal
      description="Solo cambia esta condición; las demás se conservan."
      dirty={dirty}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Guardar condición"
      title={title}
    >
      <div className="space-y-4">
        <fieldset className="border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold text-ink">
            Declaración
          </legend>
          <div className="grid grid-cols-3 overflow-hidden rounded-control border border-line-strong">
            {(Object.keys(STATUS_LABELS) as ConditionStatus[]).map((option) => {
              const checked = values.status === option
              return (
                <label
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 border-l border-line-strong px-2 text-[13px] first:border-l-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-inset ${checked ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-ink'}`}
                  key={option}
                >
                  <input
                    checked={checked}
                    className="accent-accent"
                    name={`${item.key}-status`}
                    onChange={() => set('status')(option)}
                    type="radio"
                  />
                  {STATUS_LABELS[option]}
                </label>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">{item.help}</p>
        </fieldset>
        {values.status === 'APPLICABLE' && (
          <Field label={item.valueLabel} required>
            <TextInput onChange={set('value')} value={values.value} />
          </Field>
        )}
        {values.status !== 'UNKNOWN' && (
          <>
            <Field
              hint="Documento donde consta la condición, por ejemplo el certificado de RUC."
              label="Fuente o documento"
              required
            >
              <TextInput onChange={set('source')} value={values.source} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vigente desde" required>
                <TextInput
                  onChange={set('startsOn')}
                  type="date"
                  value={values.startsOn}
                />
              </Field>
              <Field
                hint="Vacío si no tiene fecha de fin."
                label="Vigente hasta"
              >
                <TextInput
                  onChange={set('endsOn')}
                  required={false}
                  type="date"
                  value={values.endsOn}
                />
              </Field>
            </div>
          </>
        )}
        <details className="group text-[13px]">
          <summary className="min-h-8 cursor-pointer font-semibold text-accent">
            ¿Por qué se solicita?
          </summary>
          <p className="mt-1.5 text-ink-muted">
            La preparación de datos fiscales usa esta condición tal como la
            declara el Administrador, con su fuente y vigencia, para que sea
            trazable. El sistema no la deduce del tipo de entidad ni la valida
            con el SRI; deberá revisarla el responsable tributario antes de
            emitir en producción.
          </p>
        </details>
      </div>
    </FormModal>
  )
}

function TextInput({
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={getControlClasses()}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      type={type}
      value={value}
    />
  )
}
