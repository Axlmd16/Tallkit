import type { TaxDefinition } from '@/features/workshop-configuration/types'
import {
  Button,
  ErrorState,
  getControlClasses,
  LoadingState,
  StatusBadge,
  Surface,
  useToast,
} from '@/shared/ui'

import { useCatalog, useFiscalMutations, useTaxMappings } from '../hooks'
import { errorMessage, FieldHelp, SubsectionHeader } from './shared'

export function TaxMappingsSection({
  entityId,
  definitions,
}: {
  entityId: number
  definitions: TaxDefinition[]
}) {
  const catalog = useCatalog('TAX_RATE', true)
  const mappings = useTaxMappings(entityId)
  const mutations = useFiscalMutations()
  const toast = useToast()

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const endsOn = String(data.get('ends_on') ?? '')
    mutations.createTaxMapping.mutate(
      {
        definition_id: Number(data.get('definition_id')),
        catalog_entry_id: Number(data.get('catalog_entry_id')),
        starts_on: String(data.get('starts_on')),
        ends_on: endsOn || null,
        source: String(data.get('source')).trim(),
      },
      {
        onSuccess: () => {
          form.reset()
          toast.success('Correspondencia tributaria guardada.')
        },
      },
    )
  }

  const single = definitions.length === 1 ? definitions[0] : undefined

  return (
    <Surface className="space-y-5">
      <SubsectionHeader
        title="Impuestos y catálogo SRI"
        description="Relacione cada impuesto interno con la tarifa oficial del catálogo del SRI. Una correspondencia no acredita por sí sola que un beneficio tributario sea aplicable."
      />
      {definitions.length === 0 ? (
        <p className="rounded-panel border border-line bg-surface-subtle p-4 text-sm text-ink-muted">
          Primero debe configurarse el catálogo tributario de esta entidad.
        </p>
      ) : (
        <form
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          onSubmit={submit}
        >
          {mutations.createTaxMapping.isError && (
            <div className="lg:col-span-2">
              <ErrorState
                message={errorMessage(mutations.createTaxMapping.error)}
              />
            </div>
          )}
          {single ? (
            <div className="text-sm">
              <input name="definition_id" type="hidden" value={single.id} />
              <p className="font-semibold text-ink">Impuesto interno</p>
              <p className="mt-1.5 text-ink">
                {single.name}
                {single.current_rate !== null && ` · ${single.current_rate} %`}
              </p>
              <FieldHelp id={`single-${entityId}`}>
                Es el único impuesto interno de esta entidad.
              </FieldHelp>
            </div>
          ) : (
            <label className="ui-field text-sm font-semibold text-ink">
              Impuesto interno
              <select
                className={`mt-1.5 ${getControlClasses()}`}
                name="definition_id"
              >
                {definitions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.current_rate !== null
                      ? ` · ${item.current_rate} %`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <label className="ui-field block text-sm font-semibold text-ink">
              Tarifa del catálogo SRI
              {catalog.isLoading ? (
                <LoadingState />
              ) : (
                <select
                  aria-describedby={`catalog-help-${entityId}`}
                  className={`mt-1.5 ${getControlClasses()}`}
                  name="catalog_entry_id"
                  required
                >
                  {(catalog.data ?? []).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.display_name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <FieldHelp id={`catalog-help-${entityId}`}>
              Ficha técnica del SRI versión{' '}
              {catalog.data?.[0]?.source_version ?? '—'}. La tarifa debe
              coincidir con la del impuesto interno.
            </FieldHelp>
          </div>
          <label className="ui-field text-sm font-semibold text-ink">
            Vigente desde
            <input
              className={`mt-1.5 ${getControlClasses()}`}
              name="starts_on"
              required
              type="date"
            />
          </label>
          <label className="ui-field text-sm font-semibold text-ink">
            Vigente hasta (opcional)
            <input
              className={`mt-1.5 ${getControlClasses()}`}
              name="ends_on"
              type="date"
            />
          </label>
          <div className="lg:col-span-2">
            <label className="ui-field block text-sm font-semibold text-ink">
              Fundamento
              <input
                aria-describedby={`source-help-${entityId}`}
                className={`mt-1.5 ${getControlClasses()}`}
                maxLength={500}
                name="source"
                required
              />
            </label>
            <FieldHelp id={`source-help-${entityId}`}>
              Fuente o referencia que justifica esta correspondencia tributaria.
            </FieldHelp>
          </div>
          <div className="flex justify-end lg:col-span-2">
            <Button
              pending={mutations.createTaxMapping.isPending}
              type="submit"
            >
              Guardar correspondencia
            </Button>
          </div>
        </form>
      )}

      <section aria-label="Correspondencias registradas" className="space-y-2">
        <h4 className="text-sm font-semibold text-ink">
          Correspondencias registradas
        </h4>
        {mappings.isError && (
          <ErrorState message="No se pudieron cargar las correspondencias." />
        )}
        {mappings.data?.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {mappings.data.map((mapping) => (
              <li
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                key={mapping.id}
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {mapping.definition_name} →{' '}
                    {mapping.display_name ?? 'Sin entrada del catálogo'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Desde {mapping.starts_on}
                    {mapping.ends_on ? ` hasta ${mapping.ends_on}` : ''} ·{' '}
                    {mapping.source}
                  </p>
                  <details className="text-xs text-ink-muted">
                    <summary className="cursor-pointer">
                      Información avanzada
                    </summary>
                    Código SRI {mapping.percentage_code} · catálogo{' '}
                    {mapping.catalog_version}
                  </details>
                </div>
                <StatusBadge
                  label={mapping.is_current ? 'Vigente' : 'Fuera de vigencia'}
                  shape="pill"
                  tone={mapping.is_current ? 'success' : 'neutral'}
                />
              </li>
            ))}
          </ul>
        ) : (
          !mappings.isLoading && (
            <p className="text-sm text-ink-muted">
              Todavía no hay correspondencias registradas.
            </p>
          )
        )}
      </section>
    </Surface>
  )
}
