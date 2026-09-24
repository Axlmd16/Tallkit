import { Camera, Trash } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  ConfirmationPanel,
  Field,
  FormModal,
  IconButton,
  InlineNotice,
  Modal,
  Textarea,
} from '@/shared/ui'

import { timestamp } from './format'
import { useMaintenanceMutations } from './hooks'
import type { MaintenanceOrder, OrderPhoto } from './types'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTOS = 20

/**
 * Fotografías privadas de la orden: se cargan desde la API autenticada. Solo las de la
 * intervención abierta pueden retirarse; las demás se conservan como historia.
 */
export function PhotosSection({
  order,
  onDone,
}: {
  order: MaintenanceOrder
  onDone: (message: string) => void
}) {
  const canManage = order.allowed_actions.includes('manage_photos')
  const openIntervention = order.interventions.find((i) => i.is_open)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<OrderPhoto | null>(null)
  const [removing, setRemoving] = useState<OrderPhoto | null>(null)
  const [removeError, setRemoveError] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const full = order.photos.length >= MAX_PHOTOS

  async function remove(photo: OrderPhoto) {
    setRemoveError('')
    try {
      await tracker.run({ removePhoto: photo.id }, (key) =>
        mutations.removePhoto.mutateAsync({
          id: order.id,
          photoId: photo.id,
          key,
        }),
      )
      setRemoving(null)
      onDone('Fotografía retirada de la orden.')
    } catch (error) {
      setRemoveError(describeProblem(error).message)
    }
  }

  return (
    <section
      aria-labelledby="order-photos-title"
      className="rounded-panel border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2
            className="text-[14.5px] font-semibold text-ink"
            id="order-photos-title"
          >
            Fotografías
          </h2>
          <p className="text-xs text-ink-muted">
            {order.photos.length} de {MAX_PHOTOS} · JPEG, PNG o WebP hasta 10
            MiB.
          </p>
        </div>
        {canManage && openIntervention && (
          <Button
            disabled={full}
            onClick={(event) => {
              returnFocus.current = event.currentTarget
              setUploading(true)
            }}
            type="button"
            variant="secondary"
          >
            <Camera aria-hidden="true" size={16} />
            Adjuntar fotografía
          </Button>
        )}
      </div>
      <div className="p-4">
        {order.photos.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            La orden no tiene fotografías.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {order.photos.map((photo, index) => {
              const label = photo.description || `Fotografía ${index + 1}`
              const removable =
                canManage && photo.intervention_id === openIntervention?.id
              return (
                <li
                  className="overflow-hidden rounded-control border border-line"
                  key={photo.id}
                >
                  <button
                    aria-label={`Ver ${label}`}
                    className="block aspect-[4/3] w-full bg-surface-muted"
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget
                      setViewing(photo)
                    }}
                    type="button"
                  >
                    <img
                      alt={label}
                      className="size-full object-cover"
                      loading="lazy"
                      src={photo.thumbnail_url}
                    />
                  </button>
                  <div className="flex items-start justify-between gap-1 p-2">
                    <div className="min-w-0 text-xs">
                      <p className="truncate font-medium text-ink">{label}</p>
                      <p className="text-ink-muted">
                        {photo.uploaded_by.name} ·{' '}
                        {timestamp(photo.uploaded_at)}
                      </p>
                    </div>
                    {removable && (
                      <IconButton
                        icon={<Trash size={16} />}
                        label={`Retirar ${label}`}
                        onClick={(event) => {
                          returnFocus.current = event.currentTarget
                          setRemoveError('')
                          setRemoving(photo)
                        }}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {uploading && (
        <PhotoUploadDialog
          onClose={() => setUploading(false)}
          onDone={onDone}
          order={order}
          returnFocusRef={returnFocus}
        />
      )}
      <Modal
        description={
          viewing
            ? `${viewing.uploaded_by.name} · ${timestamp(viewing.uploaded_at)}`
            : undefined
        }
        onClose={() => setViewing(null)}
        open={viewing !== null}
        returnFocusRef={returnFocus}
        size="media"
        title={viewing?.description || 'Fotografía'}
      >
        {viewing && (
          <img
            alt={viewing.description || 'Fotografía de la orden'}
            className="max-h-[70vh] w-full object-contain"
            src={viewing.file_url}
          />
        )}
      </Modal>
      <ConfirmationPanel
        confirmLabel="Retirar fotografía"
        description="La fotografía dejará de mostrarse y su archivo se eliminará. El retiro queda registrado."
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
        open={removing !== null}
        returnFocusRef={returnFocus}
        title="Retirar fotografía"
        tone="danger"
      >
        {removeError && (
          <InlineNotice title="No se retiró la fotografía" tone="danger">
            {removeError}
          </InlineNotice>
        )}
      </ConfirmationPanel>
    </section>
  )
}

export function PhotoUploadDialog({
  order,
  onClose,
  onDone,
  returnFocusRef,
}: {
  order: MaintenanceOrder
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [description, setDescription] = useState('')
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function choose(selected: File | null) {
    setFileError('')
    if (selected && !ACCEPTED.includes(selected.type)) {
      setFileError('Seleccione una imagen JPEG, PNG o WebP.')
    } else if (selected && selected.size > MAX_BYTES) {
      setFileError('La imagen supera el máximo de 10 MiB.')
    }
    setFile(selected)
  }

  async function save(): Promise<boolean> {
    if (!file) {
      setFileError('Seleccione una imagen.')
      return false
    }
    if (fileError) return false
    try {
      await tracker.run(
        {
          name: file.name,
          size: file.size,
          modified: file.lastModified,
          description,
        },
        (key) =>
          mutations.uploadPhoto.mutateAsync({
            id: order.id,
            file,
            description: description.trim(),
            key,
          }),
      )
      onDone('Fotografía adjuntada a la orden.')
      return true
    } catch (error) {
      const problem = describeProblem(error)
      if (problem.fields.file) setFileError(problem.fields.file)
      throw new Error(problem.message, { cause: error })
    }
  }

  return (
    <FormModal
      description="La imagen se guarda de forma privada; solo usuarios autorizados pueden verla."
      dirty={Boolean(file) || Boolean(description)}
      onClose={onClose}
      onSave={save}
      open
      returnFocusRef={returnFocusRef}
      saveDisabled={Boolean(fileError)}
      saveLabel="Adjuntar"
      title="Adjuntar fotografía"
    >
      <div className="space-y-4">
        <Field
          error={fileError}
          hint="JPEG, PNG o WebP estático, máximo 10 MiB y 25 megapíxeles."
          id="photo-file"
          label="Imagen"
          required
        >
          <input
            accept={ACCEPTED.join(',')}
            className="block w-full text-[13px]"
            id="photo-file"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
            type="file"
          />
        </Field>
        {preview && !fileError && (
          <img
            alt="Vista previa de la imagen seleccionada"
            className="max-h-56 w-full rounded-control object-contain"
            src={preview}
          />
        )}
        <Field
          hint={`${description.length}/200`}
          id="photo-description"
          label="Descripción (opcional)"
        >
          <Textarea
            id="photo-description"
            maxLength={200}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            value={description}
          />
        </Field>
      </div>
    </FormModal>
  )
}
