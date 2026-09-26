import { Plus } from '@phosphor-icons/react'
import { useState } from 'react'

import type { TaxDefinition } from '@/features/workshop-configuration/types'
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

import { useCatalog, useFiscalMutations, useTaxMappings } from '../hooks'
import type { StatusCause } from '../types'
import { PendingNotes } from './PendingNotes'

export function TaxMappingsSection({
  entityId,
  definitions,
  pending = [],
}: {
  entityId: number
  definitions: TaxDefinition[]
  pending?: StatusCause[]
}) {
  const mappings = useTaxMappings(entityId)
  const [creating, setCreating] = useState(false)
  const list = mappings.data ?? []

  return (
    <section
      aria-labelledby={`impuestos-sri-${entityId}`}
      className="space-y-5"
    >
      <SheetHeading
        id={`impuestos-sri-${entityId}`}
        actions={
          definitions.length > 0 && (
            <Button onClick={() => setCreating(true)} variant="secondary">
              <Plus aria-hidden="true" size={16} weight="bold" />
              Nueva correspondencia
            </Button>
          )
        }
        description="Relacione cada impuesto interno con su tarifa oficial del SRI."
        level={3}
        title="Impuestos y catálogo SRI"
      />
      <PendingNotes causes={pending} />

      {definitions.length === 0 && (
        <p className="rounded-control bg-surface-subtle px-4 py-3 text-sm text-ink-muted">
          Primero debe configurarse el catálogo tributario de esta entidad.
        </p>
      )}

      {mappings.isLoading ? (
        <LoadingState />
      ) : mappings.isError ? (
        <ErrorState message="No se pudieron cargar las correspondencias." />
      ) : list.length === 0 ? (
        definitions.length > 0 && (
          <p className="text-sm text-ink-muted">
            Todavía no hay correspondencias registradas.
          </p>
        )
      ) : (
        <>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">
                Correspondencias vigentes e históricas
              </caption>
              <thead>
                <tr>
                  <th className={sheetTableHead}>Impuesto interno</th>
                  <th className={sheetTableHead}>Tarifa SRI</th>
                  <th className={sheetTableHead}>Vigencia</th>
                  <th className={sheetTableHead}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {list.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className={sheetTableCell}>
                      {mapping.definition_name}
                    </td>
                    <td className={`${sheetTableCell} font-semibold`}>
                      {mapping.display_name ?? 'Sin entrada del catálogo'}
                    </td>
                    <td className={`${sheetTableCell} text-[13px]`}>
                      Desde{' '}
                      <span className="font-mono">{mapping.starts_on}</span>
                      {mapping.ends_on && (
                        <>
                          {' '}
                          hasta{' '}
                          <span className="font-mono">{mapping.ends_on}</span>
                        </>
                      )}
                    </td>
                    <td className={sheetTableCell}>
                      <StateMark
                        label={
                          mapping.is_current ? 'Vigente' : 'Fuera de vigencia'
                        }
                        tone={mapping.is_current ? 'success' : 'inactive'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdvancedInfo hint="códigos oficiales, catálogo y fundamento">
            <ul className="list-none space-y-1 p-0">
              {list.map((mapping) => (
                <li key={mapping.id}>
                  <span className="font-semibold text-ink">
                    {mapping.display_name ?? mapping.definition_name}:
                  </span>{' '}
                  código SRI{' '}
                  <span className="font-mono">{mapping.percentage_code}</span> ·
                  catálogo{' '}
                  <span className="font-mono">{mapping.catalog_version}</span> ·
                  fundamento: {mapping.source}
                </li>
              ))}
            </ul>
          </AdvancedInfo>
        </>
      )}

      {creating && (
        <MappingModal
          definitions={definitions}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  )
}

function MappingModal({
  definitions,
  onClose,
}: {
  definitions: TaxDefinition[]
  onClose: () => void
}) {
  const catalog = useCatalog('TAX_RATE', true)
  const mutations = useFiscalMutations()
  const toast = useToast()
  const single = definitions.length === 1 ? definitions[0] : undefined
  const [values, setValues] = useState({
    definition: String(definitions[0]?.id ?? ''),
    entry: '',
    startsOn: '',
    endsOn: '',
    source: '',
  })
  const dirty = Boolean(
    values.entry || values.startsOn || values.endsOn || values.source,
  )
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  async function save() {
    await mutations.createTaxMapping.mutateAsync({
      definition_id: Number(values.definition),
      catalog_entry_id: Number(values.entry),
      starts_on: values.startsOn,
      ends_on: values.endsOn || null,
      source: values.source.trim(),
    })
    toast.success('Correspondencia tributaria guardada.')
    return true
  }

  const entries = catalog.data ?? []

  return (
    <FormModal
      description="La tarifa elegida debe coincidir con la del impuesto interno. Una correspondencia no acredita por sí sola que un beneficio tributario sea aplicable."
      dirty={dirty}
      onClose={onClose}
      onSave={save}
      open
      saveLabel="Guardar correspondencia"
      title="Nueva correspondencia tributaria"
    >
      <div className="space-y-4">
        {single ? (
          <div className="text-sm">
            <p className="text-xs font-semibold text-ink">Impuesto interno</p>
            <p className="mt-1.5 text-ink">
              {single.name}
              {single.current_rate != null && ` · ${single.current_rate} %`}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Es el único impuesto interno de esta entidad.
            </p>
          </div>
        ) : (
          <Field label="Impuesto interno" required>
            <Select onChange={set('definition')} value={values.definition}>
              {definitions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.current_rate != null ? ` · ${item.current_rate} %` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          hint={`Catálogo oficial del SRI, ficha ${entries[0]?.source_version ?? '—'}.`}
          label="Tarifa del catálogo SRI"
          required
        >
          {catalog.isLoading ? (
            <LoadingState />
          ) : (
            <Select onChange={set('entry')} value={values.entry}>
              <option disabled value="">
                Seleccione una tarifa
              </option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.display_name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vigente desde" required>
            <Input
              onChange={set('startsOn')}
              type="date"
              value={values.startsOn}
            />
          </Field>
          <Field hint="Vacío si no tiene fecha de fin." label="Vigente hasta">
            <Input
              onChange={set('endsOn')}
              required={false}
              type="date"
              value={values.endsOn}
            />
          </Field>
        </div>
        <Field
          hint="Fuente o referencia que justifica esta correspondencia tributaria."
          label="Fundamento"
          required
        >
          <Input
            maxLength={500}
            onChange={set('source')}
            value={values.source}
          />
        </Field>
      </div>
    </FormModal>
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  const field = useFieldProps()
  return (
    <select
      {...field}
      className={getControlClasses()}
      onChange={(event) => onChange(event.target.value)}
      required
      value={value}
    >
      {children}
    </select>
  )
}

function Input({
  value,
  onChange,
  type = 'text',
  required = true,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  maxLength?: number
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={getControlClasses()}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      type={type}
      value={value}
    />
  )
}
