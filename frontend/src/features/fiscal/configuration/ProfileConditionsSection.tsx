import { PencilSimple, Plus, WarningCircle } from '@phosphor-icons/react'
import { useState } from 'react'

import { ProblemError } from '@/shared/api/client'
import {
  AdvancedInfo,
  Button,
  ErrorState,
  Field,
  FormModal,
  getControlClasses,
  HintPopover,
  LoadingState,
  Select,
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
  StatusCause,
} from '../types'

type ConditionKind = 'choice' | 'designation' | 'qualification'

export interface ConditionItem {
  key: string
  kind: ConditionKind
  label: string
  help: string
  valueLabel: string
  maxLength?: number
  numeric?: boolean
}

/**
 * Las cinco condiciones del perfil. El régimen RIMPE ya no es una condición aparte: la
 * leyenda del comprobante se deriva del régimen y la pone el sistema.
 */
export const CONDITIONS: readonly ConditionItem[] = [
  {
    key: 'tax_regime',
    kind: 'choice',
    label: 'Régimen tributario',
    help: 'Régimen que figura en el certificado de RUC.',
    valueLabel: 'Régimen',
  },
  {
    key: 'accounting_obligation',
    kind: 'choice',
    label: 'Obligado a llevar contabilidad',
    help: 'Indique lo que señala el certificado de RUC.',
    valueLabel: 'Obligado a llevar contabilidad',
  },
  {
    key: 'withholding_agent',
    kind: 'designation',
    label: 'Agente de retención',
    help: 'Solo si el SRI lo designó mediante resolución; registre su número.',
    valueLabel: 'Número de resolución',
    maxLength: 8,
    numeric: true,
  },
  {
    key: 'special_taxpayer',
    kind: 'designation',
    label: 'Contribuyente especial',
    help: 'Solo si el SRI lo designó mediante resolución; registre su número.',
    valueLabel: 'Número de resolución',
    maxLength: 13,
  },
  {
    key: 'artisan_qualification',
    kind: 'qualification',
    label: 'Calificación artesanal',
    help: 'Calificación vigente otorgada por la Junta Nacional de Defensa del Artesano. El tipo ARTESANAL del sistema no la acredita.',
    valueLabel: 'Número de calificación',
  },
]

/** Nombres de las condiciones de un perfil anterior, que conservaba la clave `rimpe`. */
const LEGACY_LABELS: Record<string, string> = {
  ...Object.fromEntries(CONDITIONS.map((item) => [item.key, item.label])),
  rimpe: 'RIMPE',
}

const STATUS_LABELS: Record<ConditionStatus, string> = {
  UNKNOWN: 'Sin declarar',
  APPLICABLE: 'Aplica',
  NOT_APPLICABLE: 'No aplica',
}

const STATUS_TONES = {
  UNKNOWN: 'unknown',
  APPLICABLE: 'success',
  NOT_APPLICABLE: 'inactive',
} as const

const EXPIRING_LABEL = 'Calificación por vencer'
const LEGACY_LABEL = 'Perfil anterior'

function optionLabel(
  profile: ElectronicProfile,
  item: ConditionItem,
  value: string,
) {
  const options =
    item.key === 'tax_regime'
      ? profile.options.tax_regime
      : item.key === 'accounting_obligation'
        ? profile.options.accounting_obligation
        : []
  return options.find((option) => option.value === value)?.label ?? value
}

function conditionDetail(
  profile: ElectronicProfile,
  item: ConditionItem,
  condition: DeclaredCondition | undefined,
) {
  if (condition?.status !== 'APPLICABLE' || !condition.value)
    return <span className="text-ink-muted">—</span>
  if (item.kind === 'choice') return optionLabel(profile, item, condition.value)
  if (item.kind === 'qualification')
    return `${condition.value} · vence ${condition.ends_on ?? 'sin fecha'}`
  return condition.value
}

export function ProfileConditionsSection({
  entityId,
  hints,
  warnings = [],
}: {
  entityId: number
  hints?: React.ReactNode
  warnings?: StatusCause[]
}) {
  const profile = useElectronicProfile(entityId)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  if (profile.isLoading) return <LoadingState />
  if (profile.isError || !profile.data)
    return <ErrorState message="No se pudo cargar el perfil tributario." />

  const data = profile.data
  // Un perfil anterior conserva texto libre: se muestra como pendiente de declarar de nuevo.
  const legacy = data.conditions_format === 1
  const conditions = legacy ? {} : (data.conditions ?? {})
  const selected = CONDITIONS.find((item) => item.key === selectedKey)
  const declared = CONDITIONS.filter(
    (item) => (conditions[item.key]?.status ?? 'UNKNOWN') !== 'UNKNOWN',
  )

  return (
    <section aria-labelledby={`perfil-${entityId}`} className="space-y-4">
      <SheetHeading
        actions={
          <>
            {legacy && <LegacyNotice />}
            {warnings.length > 0 && <ExpiringNotice warnings={warnings} />}
            {hints}
          </>
        }
        description="Declare cada condición según el certificado de RUC."
        id={`perfil-${entityId}`}
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
                    {conditionDetail(data, item, condition)}
                    {item.key === 'tax_regime' &&
                      status === 'APPLICABLE' &&
                      data.regime_legend && (
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          Leyenda en la factura: {data.regime_legend}
                        </span>
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
                      {status === 'UNKNOWN' ? (
                        <Plus aria-hidden="true" size={14} weight="bold" />
                      ) : (
                        <PencilSimple
                          aria-hidden="true"
                          size={14}
                          weight="bold"
                        />
                      )}
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
                  {condition.issuing_body ? ` · ${condition.issuing_body}` : ''}
                  {condition.ends_on ? ` · hasta ${condition.ends_on}` : ''}
                </li>
              )
            })}
          </ul>
        )}
        {legacy && (
          <>
            <p className="mt-2 font-semibold text-ink">
              Declaración anterior (solo lectura)
            </p>
            <ul className="list-none space-y-1 p-0">
              {Object.entries(data.conditions ?? {}).map(([key, condition]) => (
                <li key={key}>
                  <span className="font-semibold text-ink">
                    {LEGACY_LABELS[key] ?? key}:
                  </span>{' '}
                  {condition.value ?? STATUS_LABELS[condition.status]}
                </li>
              ))}
            </ul>
          </>
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

function LegacyNotice() {
  return (
    <HintPopover
      align="end"
      label={LEGACY_LABEL}
      trigger={
        <>
          <WarningCircle
            aria-hidden="true"
            className="text-[#c98a00]"
            size={16}
            weight="fill"
          />
          {LEGACY_LABEL}
        </>
      }
      variant="button"
    >
      <p className="font-semibold text-ink">Declare de nuevo el perfil</p>
      <p className="mt-1 text-ink-muted">
        La declaración vigente está escrita como texto libre. Declare cada
        condición con las opciones actuales; la anterior se conserva como
        historia y no se convierte sola.
      </p>
    </HintPopover>
  )
}

function ExpiringNotice({ warnings }: { warnings: StatusCause[] }) {
  return (
    <HintPopover
      align="end"
      label={EXPIRING_LABEL}
      trigger={
        <>
          <WarningCircle
            aria-hidden="true"
            className="text-[#c98a00]"
            size={16}
            weight="fill"
          />
          {EXPIRING_LABEL}
        </>
      }
      variant="button"
    >
      <p className="font-semibold text-ink">Renueve la calificación</p>
      <ul className="mt-1.5 list-none space-y-1.5 p-0">
        {warnings.map((warning) => (
          <li className="text-ink-muted" key={warning.code}>
            {warning.message}
          </li>
        ))}
      </ul>
    </HintPopover>
  )
}

type FieldErrors = Record<string, string>

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
  // Un perfil anterior no se reenvía: se vuelve a declarar desde cero.
  const stored = profile.conditions_format === 1 ? {} : profile.conditions
  const condition = stored[item.key]
  const initial = {
    status: condition?.status ?? ('UNKNOWN' as ConditionStatus),
    value: condition?.value ?? '',
    source: condition?.source ?? '',
    startsOn: condition?.starts_on ?? '',
    endsOn: condition?.ends_on ?? '',
    issuingBody: condition?.issuing_body ?? '',
  }
  const [values, setValues] = useState(initial)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [attemptKey] = useState(() => crypto.randomUUID())
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (key) => values[key] !== initial[key],
  )
  const set = (key: keyof typeof initial) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  const isChoice = item.kind === 'choice'
  const declared = isChoice ? values.value !== '' : values.status !== 'UNKNOWN'
  const applies = isChoice ? declared : values.status === 'APPLICABLE'
  const isQualification = item.kind === 'qualification'

  function buildCondition(): DeclaredCondition {
    if (!declared) return { status: 'UNKNOWN' }
    const status: ConditionStatus = applies ? 'APPLICABLE' : 'NOT_APPLICABLE'
    return {
      status,
      source: values.source.trim(),
      starts_on: values.startsOn,
      ...(values.endsOn ? { ends_on: values.endsOn } : {}),
      ...(applies ? { value: values.value.trim() } : {}),
      ...(applies && isQualification
        ? { issuing_body: values.issuingBody.trim() }
        : {}),
    }
  }

  async function save() {
    setFieldErrors({})
    // Se envía el perfil completo: las demás condiciones y el certificado no cambian.
    const preserved = Object.fromEntries(
      CONDITIONS.map(({ key }) => [
        key,
        stored[key] ?? { status: 'UNKNOWN' as const },
      ]),
    )
    try {
      await mutations.saveProfile.mutateAsync({
        entityId,
        data: {
          expected_revision: profile.revision,
          conditions: { ...preserved, [item.key]: buildCondition() },
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
      if (caught instanceof ProblemError && caught.errors) {
        const own: FieldErrors = {}
        const prefix = `${item.key}.`
        let other: string | undefined
        for (const [path, messages] of Object.entries(caught.errors)) {
          if (path.startsWith(prefix))
            own[path.slice(prefix.length)] = messages[0] ?? ''
          else other ??= messages[0]
        }
        if (Object.keys(own).length > 0) {
          setFieldErrors(own)
          return false
        }
        if (other) throw new Error(other, { cause: caught })
      }
      throw caught
    }
    toast.success('Condición guardada.')
    return true
  }

  const title = `${initial.status === 'UNKNOWN' ? 'Declarar' : 'Editar'}: ${item.label}`
  const options =
    item.key === 'tax_regime'
      ? profile.options.tax_regime
      : item.key === 'accounting_obligation'
        ? profile.options.accounting_obligation
        : []

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
        {isChoice ? (
          <Field
            error={fieldErrors.value}
            hint={item.help}
            label={item.valueLabel}
          >
            <Select
              onChange={(event) => set('value')(event.target.value)}
              value={values.value}
            >
              <option value="">Seleccione…</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <fieldset className="border-0 p-0">
            <legend className="mb-2 p-0 text-xs font-semibold text-ink">
              Declaración
            </legend>
            <div className="grid grid-cols-3 overflow-hidden rounded-control border border-line-strong">
              {(Object.keys(STATUS_LABELS) as ConditionStatus[]).map(
                (option) => {
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
                },
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">{item.help}</p>
            {fieldErrors.status && (
              <p className="mt-1.5 text-xs font-semibold text-danger">
                {fieldErrors.status}
              </p>
            )}
          </fieldset>
        )}

        {item.key === 'tax_regime' && (
          <p className="text-xs text-ink-muted">
            La leyenda del régimen la pone el sistema en el comprobante; no se
            escribe aquí.
          </p>
        )}

        {!isChoice && applies && (
          <Field error={fieldErrors.value} label={item.valueLabel} required>
            <TextInput
              inputMode={item.numeric ? 'numeric' : undefined}
              maxLength={
                isQualification ? 50 : (item.maxLength as number | undefined)
              }
              onChange={set('value')}
              value={values.value}
            />
          </Field>
        )}
        {isQualification && applies && (
          <Field
            error={fieldErrors.issuing_body}
            label="Organismo que la otorgó"
            required
          >
            <TextInput
              maxLength={200}
              onChange={set('issuingBody')}
              value={values.issuingBody}
            />
          </Field>
        )}

        {declared && (
          <>
            <Field
              error={fieldErrors.source}
              hint="Documento donde consta la condición, por ejemplo el certificado de RUC."
              label="Fuente o documento"
              required
            >
              <TextInput onChange={set('source')} value={values.source} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                error={fieldErrors.starts_on}
                label="Vigente desde"
                required
              >
                <TextInput
                  onChange={set('startsOn')}
                  type="date"
                  value={values.startsOn}
                />
              </Field>
              {isQualification && applies ? (
                <Field
                  error={fieldErrors.ends_on}
                  hint="El sistema avisa antes de que venza."
                  label="Vence el"
                  required
                >
                  <TextInput
                    onChange={set('endsOn')}
                    type="date"
                    value={values.endsOn}
                  />
                </Field>
              ) : (
                <Field
                  error={fieldErrors.ends_on}
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
              )}
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
  maxLength,
  inputMode,
}: {
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  maxLength?: number | undefined
  inputMode?: 'numeric' | undefined
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={getControlClasses()}
      inputMode={inputMode}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      type={type}
      value={value}
    />
  )
}
