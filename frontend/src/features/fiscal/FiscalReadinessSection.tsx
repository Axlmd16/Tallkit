import { useArchiveReadiness, useFiscalMutations } from './hooks'
import {
  Button,
  ErrorState,
  getControlClasses,
  InlineNotice,
  LoadingState,
  StatusBadge,
  Surface,
} from '@/shared/ui'

export function FiscalReadinessSection({
  entityId,
}: {
  entityId: number | undefined
}) {
  const query = useArchiveReadiness(entityId ?? 0)
  const mutations = useFiscalMutations()
  if (!entityId) {
    return (
      <InlineNotice title="Seleccione una entidad" tone="info">
        El readiness productivo se registra y evalúa por entidad fiscal.
      </InlineNotice>
    )
  }
  if (query.isPending)
    return <LoadingState label="Consultando preparación operativa…" />
  if (query.isError || !query.data) {
    return (
      <ErrorState message="No se pudo consultar la preparación del archivo." />
    )
  }
  const status = query.data
  return (
    <Surface
      className="space-y-4"
      aria-label="Preparación operativa del archivo"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">
            Preparación operativa del archivo
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Registro administrativo. No comprueba por sí solo que exista una
            copia externa.
          </p>
        </div>
        <StatusBadge
          label={
            status.productive_archive_ready ? 'Declarado listo' : 'Bloqueado'
          }
          tone={status.productive_archive_ready ? 'success' : 'warning'}
          shape="pill"
        />
      </div>
      {!status.productive_archive_ready && (
        <InlineNotice title="Incorporación productiva bloqueada" tone="warning">
          Pendiente: {status.pending.join(', ')}. Los ensayos sintéticos en
          ambiente de pruebas permanecen disponibles.
        </InlineNotice>
      )}
      {mutations.saveArchivePolicy.isError && (
        <ErrorState message={mutations.saveArchivePolicy.error.message} />
      )}
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          Registrar nueva versión de política
        </summary>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            mutations.saveArchivePolicy.mutate({
              fiscal_entity_id: entityId,
              responsible: String(data.get('responsible')).trim(),
              purpose: String(data.get('purpose')).trim(),
              legal_basis: String(data.get('legal_basis')).trim(),
              retention: {
                fiscal_xml: String(data.get('retention_xml')).trim(),
                operational_contact: String(
                  data.get('retention_contact'),
                ).trim(),
                audit: String(data.get('retention_audit')).trim(),
                exports: String(data.get('retention_exports')).trim(),
                backups: String(data.get('retention_backups')).trim(),
              },
              rights_channel: String(data.get('rights_channel')).trim(),
              rights_procedure: String(data.get('rights_procedure')).trim(),
              end_of_retention_review: String(data.get('end_review')).trim(),
              storage_fingerprint: String(
                data.get('storage_fingerprint'),
              ).trim(),
              procedure_version: String(data.get('procedure_version')).trim(),
            })
          }}
        >
          {[
            ['responsible', 'Responsable fiscal'],
            ['purpose', 'Finalidad'],
            ['legal_basis', 'Fundamento'],
            ['rights_channel', 'Canal de derechos'],
            ['rights_procedure', 'Procedimiento de derechos'],
            ['end_review', 'Revisión al finalizar conservación'],
            ['storage_fingerprint', 'Identificador del almacenamiento'],
            ['procedure_version', 'Versión del procedimiento'],
            ['retention_xml', 'Retención de XML'],
            ['retention_contact', 'Retención de contacto operativo'],
            ['retention_audit', 'Retención de auditoría'],
            ['retention_exports', 'Retención de exportaciones'],
            ['retention_backups', 'Retención de copias'],
          ].map(([name, label]) => (
            <label className="text-sm font-semibold text-ink" key={name}>
              {label}
              <input
                className={`${getControlClasses()} mt-1.5`}
                name={name}
                required
              />
            </label>
          ))}
          <div className="md:col-span-2">
            <Button
              pending={mutations.saveArchivePolicy.isPending}
              type="submit"
            >
              Registrar versión
            </Button>
          </div>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          Registrar evidencia de restauración
        </summary>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            mutations.recordRestoration.mutate({
              restored_at: new Date(
                String(data.get('restored_at')),
              ).toISOString(),
              procedure_version: String(data.get('restore_procedure')).trim(),
              storage_fingerprint: String(data.get('restore_storage')).trim(),
              responsible: String(data.get('restore_responsible')).trim(),
              backup_identifier: String(data.get('backup_identifier')).trim(),
              report_reference: String(data.get('report_reference')).trim(),
              destination: String(data.get('destination')).trim(),
              content_hashes_ok: data.get('content_hashes_ok') === 'on',
              identities_ok: data.get('identities_ok') === 'on',
              permissions_ok: data.get('permissions_ok') === 'on',
              links_ok: data.get('links_ok') === 'on',
              deletion_reviewed: data.get('deletion_reviewed') === 'on',
              notes: String(data.get('notes')).trim(),
            })
          }}
        >
          {[
            ['restored_at', 'Fecha y hora', 'datetime-local'],
            ['restore_procedure', 'Versión del procedimiento', 'text'],
            ['restore_storage', 'Identificador del almacenamiento', 'text'],
            ['restore_responsible', 'Responsable del ensayo', 'text'],
            ['backup_identifier', 'Identificador de copia', 'text'],
            ['report_reference', 'Referencia del informe', 'text'],
            ['destination', 'Destino aislado', 'text'],
            ['notes', 'Notas', 'text'],
          ].map(([name, label, type]) => (
            <label className="text-sm font-semibold text-ink" key={name}>
              {label}
              <input
                className={`${getControlClasses()} mt-1.5`}
                name={name}
                required={name !== 'notes'}
                type={type}
              />
            </label>
          ))}
          <fieldset className="space-y-2 md:col-span-2">
            <legend className="text-sm font-semibold text-ink">
              Comprobaciones realizadas
            </legend>
            {[
              ['content_hashes_ok', 'Contenido y hashes'],
              ['identities_ok', 'Identidades'],
              ['permissions_ok', 'Permisos'],
              ['links_ok', 'Vínculos'],
              [
                'deletion_reviewed',
                'Decisiones de eliminación posteriores revisadas',
              ],
            ].map(([name, label]) => (
              <label
                className="mr-4 inline-flex items-center gap-2 text-sm"
                key={name}
              >
                <input name={name} required type="checkbox" /> {label}
              </label>
            ))}
          </fieldset>
          <div className="md:col-span-2">
            <Button
              pending={mutations.recordRestoration.isPending}
              type="submit"
            >
              Registrar evidencia
            </Button>
          </div>
        </form>
      </details>
    </Surface>
  )
}
