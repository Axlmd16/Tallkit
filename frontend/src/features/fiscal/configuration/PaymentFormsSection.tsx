import {
  Button,
  ErrorState,
  InlineNotice,
  LoadingState,
  StatusBadge,
  Surface,
  useToast,
} from '@/shared/ui'

import {
  useFiscalMutations,
  usePaymentForms,
  usePreparationDefaults,
} from '../hooks'
import { errorMessage, SubsectionHeader } from './shared'

export function PaymentFormsSection({ entityId }: { entityId: number }) {
  const forms = usePaymentForms(entityId)
  const defaults = usePreparationDefaults(entityId)
  const mutations = useFiscalMutations()
  const toast = useToast()

  if (forms.isLoading) return <LoadingState />
  if (forms.isError || !forms.data) {
    return (
      <ErrorState message="No se pudo cargar el catálogo de formas de pago." />
    )
  }
  const source = forms.data[0]
  const error =
    mutations.setPaymentForm.error ?? mutations.savePreparationDefaults.error

  return (
    <Surface className="space-y-5">
      <SubsectionHeader
        title="Formas de pago SRI"
        description="Catálogo oficial de la Tabla 24. Al preparar, el usuario elige entre las formas habilitadas; crédito es una condición interna y no una forma de pago."
      />
      {source && (
        <p className="text-xs text-ink-muted">
          Fuente: {source.source_document}, versión {source.source_version},
          descargada el {source.downloaded_on}.
        </p>
      )}
      <InlineNotice title="Habilitación en V1" tone="info">
        Solo efectivo (01) y transferencia (20) pueden habilitarse. Las demás
        formas, incluidas las tarjetas, requieren una decisión que las incorpore
        a cobros, caja y cierres.
      </InlineNotice>
      {(mutations.setPaymentForm.isError ||
        mutations.savePreparationDefaults.isError) && (
        <ErrorState message={errorMessage(error)} />
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-subtle text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2">Forma de pago</th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Vigencia</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {forms.data.map((form) => (
              <tr key={form.code}>
                <td className="px-3 py-3">
                  <span className="block font-semibold text-ink">
                    {form.display_name}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {form.description}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{form.code}</td>
                <td className="px-3 py-3 text-xs text-ink-muted">
                  {form.valid_from
                    ? `Desde ${form.valid_from}`
                    : 'Sin fecha publicada'}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge
                    label={
                      form.enabled
                        ? form.is_default
                          ? 'Habilitada · predeterminada'
                          : 'Habilitada'
                        : form.enableable
                          ? 'Deshabilitada'
                          : 'No habilitable en V1'
                    }
                    shape="pill"
                    tone={form.enabled ? 'success' : 'neutral'}
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  {form.enableable ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {form.enabled && !form.is_default && (
                        <Button
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
                        variant="secondary"
                      >
                        {form.enabled ? 'Deshabilitar' : 'Habilitar'}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-muted">Sin acciones</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  )
}
