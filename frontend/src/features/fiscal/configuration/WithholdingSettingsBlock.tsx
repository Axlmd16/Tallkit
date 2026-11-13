import { PencilSimple } from '@phosphor-icons/react'
import { useState } from 'react'

import { ProblemError } from '@/shared/api/client'
import {
  Button,
  Field,
  FormModal,
  Input,
  LoadingState,
  StateMark,
  useToast,
} from '@/shared/ui'

import { useFiscalMutations, useWithholdingSettings } from '../hooks'
import type { WithholdingSettings } from '../types'

const PERCENTAGE = /^\d{1,3}(\.\d{1,2})?$/

function percentageValid(text: string): boolean {
  if (!PERCENTAGE.test(text.trim())) return false
  const value = Number(text)
  return value > 0 && value <= 100
}

/**
 * Retenciones que los clientes le hacen a esta entidad. Vive dentro del perfil tributario,
 * pero no forma parte de las condiciones declaradas: cambiarlo no altera el estado del
 * perfil ni las facturas preparadas.
 */
export function WithholdingSettingsBlock({ entityId }: { entityId: number }) {
  const settings = useWithholdingSettings(entityId)
  const [editing, setEditing] = useState(false)

  if (settings.isLoading) return <LoadingState />
  if (settings.isError || !settings.data) return null
  const data = settings.data

  return (
    <div
      aria-label="Retenciones que le hacen sus clientes"
      className="rounded-control border border-line bg-surface-subtle px-4 py-3"
      role="group"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink">
            Retenciones que le hacen sus clientes
          </h3>
          <p className="mt-0.5 max-w-[70ch] text-label text-ink-muted">
            Algunos clientes pagan un poco menos porque retienen impuestos y
            entregan un comprobante. Si le ocurre, déjelo activado para poder
            anotarlo al cobrar.
          </p>
        </div>
        <Button
          onClick={() => setEditing(true)}
          size="40"
          type="button"
          variant="soft"
        >
          <PencilSimple aria-hidden="true" size={14} weight="bold" />
          Editar
        </Button>
      </div>
      <dl className="mt-3 grid gap-3 text-body sm:grid-cols-2">
        <div>
          <dt className="text-label font-semibold text-ink-muted">
            Registrar retenciones al cobrar
          </dt>
          <dd className="mt-1">
            <StateMark
              label={data.registration_enabled ? 'Activado' : 'Desactivado'}
              tone={data.registration_enabled ? 'success' : 'inactive'}
            />
          </dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-ink-muted">
            Avisar si la retención supera
          </dt>
          <dd className="mt-1 font-semibold text-ink">
            {data.warning_percentage
              ? `${data.warning_percentage} % del total`
              : 'Sin aviso'}
          </dd>
        </div>
      </dl>
      {editing && (
        <WithholdingSettingsDialog
          entityId={entityId}
          onClose={() => setEditing(false)}
          settings={data}
        />
      )}
    </div>
  )
}

function WithholdingSettingsDialog({
  entityId,
  settings,
  onClose,
}: {
  entityId: number
  settings: WithholdingSettings
  onClose: () => void
}) {
  const mutations = useFiscalMutations()
  const toast = useToast()
  const [enabled, setEnabled] = useState(settings.registration_enabled)
  const [warn, setWarn] = useState(settings.warning_percentage !== null)
  const [percentage, setPercentage] = useState(
    settings.warning_percentage ?? '20',
  )
  const [attemptKey] = useState(() => crypto.randomUUID())
  const valid = !warn || percentageValid(percentage)
  const percentageError =
    warn && percentage && !percentageValid(percentage)
      ? 'Use un valor mayor que 0 y hasta 100, con máximo 2 decimales.'
      : undefined

  async function save(): Promise<boolean> {
    if (!valid) return false
    try {
      await mutations.saveWithholdingSettings.mutateAsync({
        entityId,
        attemptKey,
        data: {
          expected_version: settings.version,
          registration_enabled: enabled,
          warning_percentage: warn ? percentage.trim() : null,
        },
      })
      toast.success('Ajustes de retenciones guardados.')
      return true
    } catch (problem) {
      throw new Error(
        problem instanceof ProblemError
          ? problem.message
          : 'No se pudieron guardar los ajustes.',
        { cause: problem },
      )
    }
  }

  return (
    <FormModal
      description="Se aplica solo a esta entidad. No cambia retenciones ni cobros ya registrados."
      dirty={
        enabled !== settings.registration_enabled ||
        warn !== (settings.warning_percentage !== null) ||
        percentage !== (settings.warning_percentage ?? '20')
      }
      onClose={onClose}
      onSave={save}
      open
      saveDisabled={!valid}
      title="Retenciones que le hacen sus clientes"
    >
      <div className="space-y-4">
        <label className="flex items-start gap-2 text-body text-ink">
          <input
            checked={enabled}
            className="mt-1"
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="font-semibold">
              Registrar retenciones al cobrar
            </span>
            <span className="block text-label text-ink-muted">
              Desactívelo solo si sus clientes nunca retienen. Si un cliente
              retiene y está desactivado, ese valor quedará como deuda.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-body text-ink">
          <input
            checked={warn}
            className="mt-1"
            onChange={(event) => setWarn(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="font-semibold">Avisar de valores inusuales</span>
            <span className="block text-label text-ink-muted">
              Pide confirmar cuando la retención es muy alta, para detectar
              errores al escribir. Nunca bloquea el cobro.
            </span>
          </span>
        </label>
        {warn && (
          <Field
            error={percentageError}
            id={`withholding-warning-${entityId}`}
            label="Avisar si supera este porcentaje del total"
          >
            <Input
              id={`withholding-warning-${entityId}`}
              inputMode="decimal"
              onChange={(event) => setPercentage(event.target.value)}
              value={percentage}
            />
          </Field>
        )}
      </div>
    </FormModal>
  )
}
