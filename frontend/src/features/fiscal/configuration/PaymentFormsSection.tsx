import {
  AdvancedInfo,
  Button,
  ErrorState,
  LoadingState,
  SheetHeading,
  sheetTableCell,
  sheetTableHead,
  StateMark,
  useToast,
} from '@/shared/ui'

import {
  useFiscalMutations,
  usePaymentForms,
  usePreparationDefaults,
} from '../hooks'
import type { PaymentFormOption } from '../types'
import { errorMessage } from './shared'

function formState(form: PaymentFormOption) {
  if (form.enabled)
    return {
      label: form.is_default ? 'Habilitada · predeterminada' : 'Habilitada',
      tone: form.is_default ? ('active' as const) : ('success' as const),
    }
  return form.enableable
    ? { label: 'Deshabilitada', tone: 'inactive' as const }
    : { label: 'No habilitable en V1', tone: 'unknown' as const }
}

export function PaymentFormsSection({
  entityId,
  hints,
}: {
  entityId: number
  hints?: React.ReactNode
}) {
  const forms = usePaymentForms(entityId)
  const defaults = usePreparationDefaults(entityId)
  const mutations = useFiscalMutations()
  const toast = useToast()

  if (forms.isLoading) return <LoadingState />
  if (forms.isError || !forms.data)
    return (
      <ErrorState message="No se pudo cargar el catálogo de formas de pago." />
    )

  const source = forms.data[0]
  const failure =
    mutations.setPaymentForm.error ?? mutations.savePreparationDefaults.error

  return (
    <section aria-labelledby={`formas-pago-${entityId}`} className="space-y-5">
      <SheetHeading
        actions={<>{hints}</>}
        description="En V1 solo se habilitan efectivo (01) y transferencia (20)."
        id={`formas-pago-${entityId}`}
        title="Formas de pago SRI"
      />

      {failure && <ErrorState message={errorMessage(failure)} />}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${sheetTableHead} w-[40%]`}>Forma de pago</th>
              <th className={sheetTableHead}>Código</th>
              <th className={sheetTableHead}>Estado</th>
              <th className={sheetTableHead}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {forms.data.map((form) => (
              <tr key={form.code}>
                <td className={sheetTableCell}>
                  <span className="block font-semibold text-ink">
                    {form.display_name}
                  </span>
                  <span className="block text-[13px] text-ink-muted">
                    {form.description}
                  </span>
                </td>
                <td className={`${sheetTableCell} font-mono`}>{form.code}</td>
                <td className={sheetTableCell}>
                  <StateMark {...formState(form)} />
                </td>
                <td className={sheetTableCell}>
                  {form.enableable && (
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      {form.enabled && !form.is_default && (
                        <Button
                          className="px-2"
                          onClick={() =>
                            mutations.savePreparationDefaults.mutate(
                              {
                                entityId,
                                data: {
                                  expected_version: defaults.data?.version ?? 0,
                                  default_payment_code: form.code,
                                },
                                attemptKey: crypto.randomUUID(),
                              },
                              {
                                onSuccess: () =>
                                  toast.success(
                                    'Forma de pago predeterminada actualizada.',
                                  ),
                              },
                            )
                          }
                          variant="quiet"
                        >
                          Usar como predeterminada
                        </Button>
                      )}
                      <Button
                        aria-label={`${form.enabled ? 'Deshabilitar' : 'Habilitar'} ${form.display_name}`}
                        className="px-2"
                        onClick={() =>
                          mutations.setPaymentForm.mutate(
                            {
                              entityId,
                              code: form.code,
                              enabled: !form.enabled,
                              expectedVersion: form.version,
                              attemptKey: crypto.randomUUID(),
                            },
                            {
                              onSuccess: () =>
                                toast.success('Forma de pago actualizada.'),
                            },
                          )
                        }
                        variant="quiet"
                      >
                        {form.enabled ? 'Deshabilitar' : 'Habilitar'}
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {source && (
        <AdvancedInfo hint="catálogo, fuente y vigencias">
          <p>
            Catálogo oficial de la Tabla 24. Crédito es una condición interna de
            la venta y no una forma de pago.
          </p>
          <p>
            Fuente: {source.source_document}, versión{' '}
            <span className="font-mono">{source.source_version}</span>,
            descargada el{' '}
            <span className="font-mono">{source.downloaded_on}</span>.
          </p>
          <ul className="list-none space-y-0.5 p-0">
            {forms.data.map((form) => (
              <li key={form.code}>
                <span className="font-mono">{form.code}</span>:{' '}
                {form.valid_from
                  ? `vigente desde ${form.valid_from}`
                  : 'sin fecha publicada'}
              </li>
            ))}
          </ul>
        </AdvancedInfo>
      )}
    </section>
  )
}
