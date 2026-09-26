import { useState } from 'react'

import {
  useAllDocumentSeries,
  useFiscalEntities,
  useReplaceSeries,
  useUpdateSeriesCode,
} from '@/features/workshop-configuration/queries'
import type {
  DocumentSeries,
  FiscalEntity,
} from '@/features/workshop-configuration/types'
import { ProblemError } from '@/shared/api/client'
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

import { EntityGroupRow } from './EntityGroupRow'

const DOCUMENT_LABELS: Record<string, string> = {
  INGRESO: 'Ingreso de mercadería',
  PROFORMA: 'Proforma',
  VENTA: 'Venta de repuestos',
  SERVICIO: 'Operación de servicios',
}

function documentLabel(series: DocumentSeries) {
  return DOCUMENT_LABELS[series.document_type ?? ''] ?? series.document_type
}

function internalNumber(series: DocumentSeries, value: number) {
  return `${series.code}-${String(value).padStart(6, '0')}`
}

type Editing = { series: DocumentSeries; mode: 'code' | 'replace' } | null

export function SeriesSection() {
  const seriesQuery = useAllDocumentSeries()
  const { data: entities } = useFiscalEntities()
  const [editing, setEditing] = useState<Editing>(null)

  if (seriesQuery.isLoading) return <LoadingState />
  if (seriesQuery.isError)
    return <ErrorState message="No se pudieron cargar las series." />

  const series = seriesQuery.data ?? []

  return (
    <section aria-labelledby="series-titulo" className="space-y-6">
      <SheetHeading
        id="series-titulo"
        description="Numeración interna de los documentos del taller. Antes del primer uso se corrige el código; una serie usada se sustituye por otra."
        title="Series y numeración"
      />

      {series.length === 0 ? (
        <EmptyState
          description="Las series internas se crean al inicializar el taller."
          title="Aún no hay series configuradas"
        />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${sheetTableHead} w-[32%]`}>Documento</th>
                <th className={sheetTableHead}>Serie</th>
                <th className={sheetTableHead}>Último número</th>
                <th className={sheetTableHead}>Estado</th>
                <th className={sheetTableHead}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(entities ?? []).map((entity) => (
                <SeriesGroup
                  entity={entity}
                  key={entity.id}
                  onEdit={setEditing}
                  series={series.filter(
                    (item) => item.entity_type === entity.entity_type,
                  )}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[13px] text-ink-muted">
        Son números internos; no acreditan una factura electrónica ni una
        autorización del SRI.
      </p>

      {editing && (
        <SeriesModal
          key={`${editing.series.id}-${editing.mode}`}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          series={editing.series}
        />
      )}
    </section>
  )
}

function SeriesGroup({
  entity,
  series,
  onEdit,
}: {
  entity: FiscalEntity
  series: DocumentSeries[]
  onEdit: (editing: Editing) => void
}) {
  const ordered = [...series].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active),
  )
  return (
    <>
      <EntityGroupRow colSpan={5} entity={entity} />
      {ordered.length === 0 && (
        <tr>
          <td className={`${sheetTableCell} text-ink-muted`} colSpan={5}>
            Sin series internas para esta entidad.
          </td>
        </tr>
      )}
      {ordered.map((item) => {
        const used = item.last_number > 0
        return (
          <tr key={item.id}>
            <td className={sheetTableCell}>{documentLabel(item)}</td>
            <td className={sheetTableCell}>
              <span className="rounded-chip border border-line bg-surface-subtle px-2 py-0.5 font-mono font-semibold tracking-[0.04em]">
                {item.code}
              </span>
            </td>
            <td className={`${sheetTableCell} font-mono tabular-nums`}>
              {used ? (
                internalNumber(item, item.last_number)
              ) : (
                <span className="font-sans text-ink-muted">Sin uso</span>
              )}
            </td>
            <td className={sheetTableCell}>
              <StateMark
                label={item.is_active ? 'Activa' : 'Sustituida'}
                tone={item.is_active ? 'success' : 'inactive'}
              />
            </td>
            <td className={sheetTableCell}>
              {item.is_active && (
                <Button
                  aria-label={`${used ? 'Sustituir serie' : 'Editar código'} ${item.code}`}
                  className="px-2"
                  onClick={() =>
                    onEdit({ series: item, mode: used ? 'replace' : 'code' })
                  }
                  variant="quiet"
                >
                  {used ? 'Sustituir serie' : 'Editar código'}
                </Button>
              )}
            </td>
          </tr>
        )
      })}
    </>
  )
}

function SeriesModal({
  series,
  mode,
  onClose,
}: {
  series: DocumentSeries
  mode: 'code' | 'replace'
  onClose: () => void
}) {
  const updateCode = useUpdateSeriesCode()
  const replace = useReplaceSeries()
  const toast = useToast()
  const initial = mode === 'code' ? series.code : ''
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string>()

  async function save() {
    const code = value.trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9-]{2,19}$/.test(code)) {
      setError(
        'Use de 3 a 20 caracteres: letras mayúsculas, dígitos o guion, empezando por una letra.',
      )
      return false
    }
    try {
      if (mode === 'code')
        await updateCode.mutateAsync({
          seriesId: series.id,
          data: { code, expected_version: series.version },
        })
      else
        await replace.mutateAsync({
          seriesId: series.id,
          data: { new_code: code, expected_version: series.version },
        })
    } catch (caught) {
      const message =
        caught instanceof ProblemError
          ? (caught.errors?.code?.[0] ?? caught.errors?.new_code?.[0])
          : undefined
      if (message) {
        setError(message)
        return false
      }
      throw caught
    }
    toast.success(
      mode === 'code'
        ? `Serie ${code} actualizada.`
        : `Serie ${series.code} sustituida por ${code}.`,
    )
    return true
  }

  return (
    <FormModal
      description={
        mode === 'code'
          ? 'La serie todavía no ha asignado números; el primer número será 000001.'
          : `La serie ${series.code} ya asignó ${internalNumber(series, series.last_number)}. Se cerrará y la sucesora quedará activa; los números emitidos no cambian.`
      }
      dirty={value !== initial}
      onClose={onClose}
      onSave={save}
      open
      saveLabel={mode === 'code' ? 'Guardar código' : 'Sustituir serie'}
      title={
        mode === 'code'
          ? `Editar código de ${series.code}`
          : `Sustituir ${series.code}`
      }
    >
      <Field
        error={error}
        hint="No puede reutilizar el código de otra serie."
        label={
          mode === 'code' ? 'Código de la serie' : 'Código de la serie sucesora'
        }
        required
      >
        <CodeInput onChange={setValue} value={value} />
      </Field>
    </FormModal>
  )
}

function CodeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      className={`${getControlClasses()} font-mono uppercase`}
      maxLength={20}
      name="code"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  )
}
