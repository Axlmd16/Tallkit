import { CalendarPlus, Plus } from '@phosphor-icons/react'
import { useRef, useState } from 'react'

import {
  useAllTaxDefinitions,
  useCreateTaxDefinition,
  useCreateTaxPeriod,
  useFiscalEntities,
  useScheduleSuccessor,
  useTaxPeriods,
} from '@/features/workshop-configuration/queries'
import { EntityGroupRow } from './EntityGroupRow'
import type {
  FiscalEntity,
  TaxDefinition,
  TaxPeriod,
} from '@/features/workshop-configuration/types'
import {
  Button,
  EmptyState,
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

export function TaxesSection() {
  const taxes = useAllTaxDefinitions()
  const { data: entities } = useFiscalEntities()
  const [creating, setCreating] = useState(false)

  if (taxes.isLoading) return <LoadingState />
  if (taxes.isError)
    return <ErrorState message="No se pudieron cargar los impuestos." />

  const definitions = taxes.data ?? []
  const createAction = (
    <Button onClick={() => setCreating(true)} variant="secondary">
      <Plus aria-hidden="true" size={16} weight="bold" />
      Nuevo impuesto
    </Button>
  )

  return (
    <section aria-labelledby="impuestos-titulo" className="space-y-6">
      <SheetHeading
        id="impuestos-titulo"
        actions={createAction}
        description="Tarifas internas por entidad fiscal, cada una con su vigencia. Una tarifa ya utilizada no se edita: se programa otra."
        title="Impuestos"
      />

      {definitions.length === 0 ? (
        <EmptyState
          description="Registre las definiciones de impuestos (por ejemplo, IVA) y su tarifa vigente para cada entidad."
          title="Aún no hay impuestos configurados"
        />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-body">
            <thead>
              <tr>
                <th className={`${sheetTableHead} w-[34%]`}>Impuesto</th>
                <th className={sheetTableHead}>Tarifa vigente</th>
                <th className={sheetTableHead}>Vigencia</th>
                <th className={sheetTableHead}>Estado</th>
                <th className={sheetTableHead}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(entities ?? []).map((entity) => (
                <EntityGroup
                  definitions={definitions
                    .filter(
                      (definition) =>
                        definition.fiscal_entity_id === entity.id ||
                        (definition.fiscal_entity_id === undefined &&
                          definition.entity_type === entity.entity_type),
                    )
                    .sort(byStart)}
                  entity={entity}
                  key={entity.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTaxModal
        entities={entities ?? []}
        onClose={() => setCreating(false)}
        open={creating}
      />
    </section>
  )
}

function byStart(a: TaxDefinition, b: TaxDefinition) {
  return (a.starts_on ?? '').localeCompare(b.starts_on ?? '')
}

function EntityGroup({
  entity,
  definitions,
}: {
  entity: FiscalEntity
  definitions: TaxDefinition[]
}) {
  return (
    <>
      <EntityGroupRow colSpan={5} entity={entity} />
      {definitions.length === 0 ? (
        <tr>
          <td className={`${sheetTableCell} text-ink-muted`} colSpan={5}>
            Sin impuestos registrados para esta entidad.
          </td>
        </tr>
      ) : (
        definitions.map((definition) => (
          <TaxRow definition={definition} key={definition.id} />
        ))
      )}
    </>
  )
}

function todayInEcuador() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Guayaquil',
  })
}

function TaxRow({ definition }: { definition: TaxDefinition }) {
  const periods = useTaxPeriods(definition.id)
  const [scheduling, setScheduling] = useState(false)
  const list = periods.data ?? []
  const open = list.find((period) => period.ends_on === null)
  const today = todayInEcuador()
  const upcoming = list
    .filter((period) => period.starts_on > today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))

  return (
    <tr>
      <td className={sheetTableCell}>
        <span className="code font-semibold text-ink">{definition.code}</span>
        <span className="block text-body text-ink-muted">
          {definition.name}
        </span>
      </td>
      <td className={`${sheetTableCell} code tabular-nums`}>
        {definition.current_rate ? `${definition.current_rate} %` : '—'}
      </td>
      <td className={`${sheetTableCell} text-body`}>
        {definition.starts_on ? (
          <>
            Desde <span className="code">{definition.starts_on}</span>
            {definition.ends_on && (
              <>
                {' '}
                hasta <span className="code">{definition.ends_on}</span>
              </>
            )}
          </>
        ) : (
          <span className="text-ink-muted">Sin vigencia</span>
        )}
        {upcoming.map((period) => (
          <span className="mt-1 block text-ink-muted" key={period.id}>
            Luego <span className="code">{Number(period.rate)} %</span> desde{' '}
            <span className="code">{period.starts_on}</span>
          </span>
        ))}
      </td>
      <td className={sheetTableCell}>
        <StateMark
          label={definition.current_rate ? 'Vigente' : 'Sin tarifa vigente'}
          tone={definition.current_rate ? 'success' : 'unknown'}
        />
      </td>
      <td className={sheetTableCell}>
        {open && (
          <Button
            aria-label={`Programar tarifa de ${definition.code}`}
            className="px-2"
            onClick={() => setScheduling(true)}
            variant="quiet"
          >
            <CalendarPlus aria-hidden="true" size={14} weight="bold" />
            Programar tarifa
          </Button>
        )}
      </td>
      {scheduling && open && (
        <ScheduleRateModal
          definition={definition}
          onClose={() => setScheduling(false)}
          period={open}
        />
      )}
    </tr>
  )
}

function ScheduleRateModal({
  definition,
  period,
  onClose,
}: {
  definition: TaxDefinition
  period: TaxPeriod
  onClose: () => void
}) {
  const schedule = useScheduleSuccessor()
  const toast = useToast()
  const [values, setValues] = useState({ rate: '', startsOn: '' })
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  async function save() {
    await schedule.mutateAsync({
      periodId: period.id,
      data: {
        new_rate: values.rate.trim(),
        successor_starts_on: values.startsOn,
        expected_version: period.version,
      },
    })
    toast.success('Tarifa programada.')
    return true
  }

  return (
    <FormModal
      description="La tarifa actual no se modifica: termina el día anterior y la nueva rige desde la fecha elegida. Lo vendido antes conserva su tarifa."
      dirty={Boolean(values.rate || values.startsOn)}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Programar tarifa"
      title={`Programar tarifa de ${definition.code}`}
    >
      <div className="space-y-4">
        <div className="text-body">
          <p className="text-label font-semibold text-ink">Tarifa actual</p>
          <p className="mt-1.5 text-ink">
            <span className="code">{Number(period.rate)} %</span> · desde{' '}
            <span className="code">{period.starts_on}</span>
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            hint="Entre 0 y 100, hasta cuatro decimales."
            label="Nueva tarifa (%)"
            required
          >
            <Control
              inputMode="decimal"
              onChange={(event) => set('rate')(event.target.value)}
              placeholder="0"
              value={values.rate}
            />
          </Field>
          <Field hint="Debe ser posterior a hoy." label="Rige desde" required>
            <Control
              onChange={(event) => set('startsOn')(event.target.value)}
              type="date"
              value={values.startsOn}
            />
          </Field>
        </div>
      </div>
    </FormModal>
  )
}

function CreateTaxModal({
  entities,
  open,
  onClose,
}: {
  entities: FiscalEntity[]
  open: boolean
  onClose: () => void
}) {
  const createTax = useCreateTaxDefinition()
  const createPeriod = useCreateTaxPeriod()
  const toast = useToast()
  const [dirty, setDirty] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const fieldsRef = useRef<HTMLFieldSetElement>(null)

  function close() {
    setDirty(false)
    setFormKey((key) => key + 1)
    onClose()
  }

  async function save() {
    const form = fieldsRef.current
    if (!form) return false
    const read = (name: string) =>
      (
        form.querySelector(`[name="${name}"]`) as HTMLInputElement | null
      )?.value.trim() ?? ''
    const code = read('code').toUpperCase()
    const taxDef = await createTax.mutateAsync({
      entity_id: Number(read('entity_id')),
      code,
      name: read('name'),
    })
    await createPeriod.mutateAsync({
      taxDefId: taxDef.id,
      data: { rate: read('rate'), starts_on: read('starts_on') },
    })
    toast.success(`Impuesto ${code} creado.`)
    setDirty(false)
    setFormKey((key) => key + 1)
    return true
  }

  return (
    <FormModal
      description="Registre un impuesto interno y su primera tarifa vigente para una entidad fiscal."
      dirty={dirty}
      onClose={close}
      onSave={save}
      open={open}
      saveLabel="Crear impuesto"
      title="Nuevo impuesto"
    >
      <fieldset
        className="min-w-0 space-y-4 border-0 p-0"
        key={formKey}
        ref={fieldsRef}
        onInput={() => setDirty(true)}
      >
        <Field label="Entidad fiscal" required>
          <Control as="select" name="entity_id">
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.entity_type === 'COMERCIAL' ? 'Comercial' : 'Artesanal'}{' '}
                · {entity.legal_name} · RUC {entity.ruc}
              </option>
            ))}
          </Control>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            hint="Letras, dígitos, guion o guion bajo; empieza por letra."
            label="Código"
            required
          >
            <Control maxLength={20} name="code" placeholder="IVA" />
          </Field>
          <Field
            hint="Entre 0 y 100, hasta cuatro decimales."
            label="Tarifa (%)"
            required
          >
            <Control inputMode="decimal" name="rate" placeholder="15" />
          </Field>
        </div>
        <Field label="Nombre" required>
          <Control
            maxLength={120}
            name="name"
            placeholder="Impuesto al Valor Agregado"
          />
        </Field>
        <Field label="Vigente desde" required>
          <Control
            defaultValue={new Date().toISOString().split('T')[0]}
            name="starts_on"
            type="date"
          />
        </Field>
      </fieldset>
    </FormModal>
  )
}

function Control({
  as = 'input',
  children,
  ...props
}: { as?: 'input' | 'select' } & React.InputHTMLAttributes<HTMLInputElement> &
  React.SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useFieldProps()
  if (as === 'select')
    return (
      <select {...field} {...props} className={getControlClasses()} required>
        {children}
      </select>
    )
  return (
    <input {...field} {...props} className={getControlClasses()} required />
  )
}
