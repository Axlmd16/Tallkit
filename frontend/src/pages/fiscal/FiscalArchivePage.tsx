import { DownloadSimple, UploadSimple } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'

import { useSession } from '@/features/auth/hooks'
import { fiscalApi } from '@/features/fiscal/api'
import { useArchive, useFiscalMutations } from '@/features/fiscal/hooks'
import type { ArchiveSummary } from '@/features/fiscal/types'
import { useFiscalEntities } from '@/features/workshop-configuration/queries'
import {
  Button,
  ErrorState,
  getControlClasses,
  InlineNotice,
  LoadingState,
  StatusBadge,
  Surface,
} from '@/shared/ui'

const MANAGE = 'fiscal.archivo.gestionar'

async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function UploadForm({ entityIds }: { entityIds: { id: number; label: string }[] }) {
  const { uploadArchive } = useFiscalMutations()
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('xml')
    if (!(file instanceof File) || file.size === 0) return
    uploadArchive.mutate(
      {
        entityId: Number(data.get('fiscal_entity_id')),
        sourceLabel: String(data.get('source_label')).trim(),
        xml: file,
      },
      { onSuccess: () => form.reset() },
    )
  }
  return (
    <Surface aria-label="Incorporar comprobante externo">
      <h2 className="font-bold text-ink">Incorporar comprobante externo</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Un XML por carga, máximo 2 MiB. Se conserva como evidencia externa no
        verificada; su declaración de autorización no equivale a comprobación oficial.
      </p>
      <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={submit}>
        <label className="text-sm font-semibold text-ink">
          Entidad fiscal
          <select className={`${getControlClasses()} mt-1.5`} name="fiscal_entity_id" required>
            {entityIds.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          Procedencia
          <input className={`${getControlClasses()} mt-1.5`} name="source_label" required />
        </label>
        <label className="text-sm font-semibold text-ink">
          Archivo XML
          <input
            accept="text/xml,application/xml,.xml"
            className={`${getControlClasses()} mt-1.5`}
            name="xml"
            required
            type="file"
          />
        </label>
        <div className="md:col-span-3">
          {uploadArchive.isError && (
            <div className="mb-3">
              <InlineNotice title="No se incorporó el comprobante" tone="warning">
                {uploadArchive.error.message}
              </InlineNotice>
            </div>
          )}
          {uploadArchive.isSuccess && (
            <p className="mb-3 text-sm text-success">
              Evidencia conservada como externa no verificada
              {uploadArchive.data.replayed ? ' (ya existente).' : '.'}
            </p>
          )}
          <Button pending={uploadArchive.isPending} type="submit">
            <UploadSimple aria-hidden="true" size={16} /> Incorporar
          </Button>
        </div>
      </form>
    </Surface>
  )
}

export function FiscalArchivePage() {
  const permissions = useSession().data?.permissions ?? []
  const entities = useFiscalEntities()
  const [entityId, setEntityId] = useState<number | undefined>(undefined)
  const archive = useArchive(entityId)
  const { exportArchive } = useFiscalMutations()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const entityOptions = useMemo(
    () =>
      (entities.data ?? []).map((entity) => ({
        id: entity.id,
        label: `${entity.entity_type === 'COMERCIAL' ? 'Comercial' : 'Artesanal'} · ${entity.ruc}`,
      })),
    [entities.data],
  )

  if (!permissions.includes(MANAGE)) {
    return (
      <InlineNotice title="Acceso restringido" tone="warning">
        El archivo fiscal general solo está disponible para el Administrador.
      </InlineNotice>
    )
  }

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const download = async (dossier: ArchiveSummary) => {
    setDownloadError(null)
    try {
      const blob = await fiscalApi.downloadArchive(dossier.dossier_id)
      await triggerDownload(blob, `${dossier.access_key}.xml`)
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : 'No se pudo descargar el original.',
      )
    }
  }

  const exportSelected = () => {
    if (!selected.size) return
    exportArchive.mutate(
      { dossierIds: [...selected] },
      {
        onSuccess: (blob) => void triggerDownload(blob, 'archivo-fiscal.zip'),
      },
    )
  }

  return (
    <div className="catalog-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Archivo fiscal</h1>
        <label className="text-sm font-semibold text-ink">
          Entidad
          <select
            className={`${getControlClasses()} mt-1.5`}
            onChange={(event) =>
              setEntityId(event.target.value ? Number(event.target.value) : undefined)
            }
            value={entityId ?? ''}
          >
            <option value="">Todas</option>
            {entityOptions.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <InlineNotice title="Evidencia externa no verificada" tone="info">
        Los comprobantes del archivo se conservan tal cual se incorporaron. El sistema no
        comprueba su autenticidad ni su autorización ante el SRI.
      </InlineNotice>

      <UploadForm entityIds={entityOptions} />

      {downloadError && <ErrorState message={downloadError} />}
      {exportArchive.isError && <ErrorState message={exportArchive.error.message} />}

      <Surface className="overflow-hidden p-0" aria-label="Comprobantes archivados">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold text-ink">Comprobantes archivados</h2>
          <Button
            disabled={!selected.size}
            onClick={exportSelected}
            pending={exportArchive.isPending}
            variant="secondary"
          >
            <DownloadSimple aria-hidden="true" size={16} /> Exportar seleccionados
          </Button>
        </div>
        {archive.isPending ? (
          <LoadingState label="Cargando archivo…" />
        ) : archive.isError ? (
          <ErrorState message="No se pudo cargar el archivo fiscal." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-subtle text-xs text-ink-muted">
                <tr>
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2">Clave de acceso</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Ambiente</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Condición</th>
                  <th className="px-4 py-2">Original</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(archive.data ?? []).map((dossier) => (
                  <tr key={dossier.dossier_id}>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Seleccionar ${dossier.access_key}`}
                        checked={selected.has(dossier.dossier_id)}
                        onChange={() => toggle(dossier.dossier_id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{dossier.access_key}</td>
                    <td className="px-4 py-3">{dossier.document_type}</td>
                    <td className="px-4 py-3">
                      {dossier.environment === '1' ? 'Pruebas' : 'Producción'}
                    </td>
                    <td className="px-4 py-3 text-right">USD {dossier.total}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label="Externa no verificada" tone="neutral" shape="pill" />
                    </td>
                    <td className="px-4 py-3">
                      <Button onClick={() => void download(dossier)} variant="secondary">
                        <DownloadSimple aria-hidden="true" size={16} /> Descargar
                      </Button>
                    </td>
                  </tr>
                ))}
                {!archive.data?.length && (
                  <tr>
                    <td className="px-4 py-6 text-center text-ink-muted" colSpan={7}>
                      No hay comprobantes archivados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  )
}
