import { Info } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { ProblemError } from '@/shared/api/client'
import {
  Field,
  FormModal,
  HintPopover,
  useFieldProps,
  useToast,
} from '@/shared/ui'

import { useUploadEntityLogo } from './queries'
import type { FiscalEntity } from './types'

const ACCEPTED = 'image/png,image/jpeg,image/webp'

/**
 * Sube o cambia el logotipo de una entidad fiscal. La clave de idempotencia pertenece al
 * archivo elegido: se conserva en los reintentos y se renueva al elegir otro. El servidor
 * valida el contenido real; la vista previa solo ayuda a revisar antes de guardar.
 */
export function EntityLogoModal({
  entity,
  open,
  onClose,
}: {
  entity: FiscalEntity
  open: boolean
  onClose: () => void
}) {
  const upload = useUploadEntityLogo()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>()
  const key = useRef('')
  const scope = entity.entity_type === 'COMERCIAL' ? 'comercial' : 'artesanal'

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  function choose(next: File | null) {
    setError(undefined)
    setFile(next)
    setPreview(next ? URL.createObjectURL(next) : null)
    key.current = next ? crypto.randomUUID() : ''
  }

  function close() {
    choose(null)
    onClose()
  }

  async function save() {
    if (!file) return false
    try {
      await upload.mutateAsync({ id: entity.id, file, key: key.current })
    } catch (caught) {
      const message =
        caught instanceof ProblemError ? caught.errors?.file?.[0] : undefined
      if (message) {
        setError(message)
        return false
      }
      throw caught
    }
    toast.success(`Logo de la entidad ${scope} actualizado.`)
    choose(null)
    return true
  }

  return (
    <FormModal
      description={`Se mostrará en los comprobantes de ${entity.legal_name}.`}
      dirty={file !== null}
      onClose={close}
      onSave={save}
      open={open}
      saveDisabled={file === null}
      saveLabel="Guardar logo"
      title={`Logo de la entidad ${scope}`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <Field
            className="min-w-0 flex-1"
            error={error}
            label="Imagen del logo"
            required
          >
            <LogoFileInput onChoose={choose} />
          </Field>
          <HintPopover
            align="end"
            label="Formatos admitidos"
            trigger={<Info aria-hidden="true" size={16} weight="bold" />}
          >
            <ul className="list-none space-y-1 p-0">
              <li>PNG, JPEG o WebP estático.</li>
              <li>Hasta 2 MiB.</li>
              <li>Máximo 25 megapíxeles.</li>
            </ul>
          </HintPopover>
        </div>
        {preview && (
          <div className="grid place-items-center rounded-control border border-line bg-surface-muted p-4">
            <img
              alt="Vista previa del logo"
              className="max-h-32 max-w-full object-contain"
              src={preview}
            />
          </div>
        )}
      </div>
    </FormModal>
  )
}

function LogoFileInput({
  onChoose,
}: {
  onChoose: (file: File | null) => void
}) {
  const field = useFieldProps()
  return (
    <input
      {...field}
      accept={ACCEPTED}
      className="block w-full text-body"
      onChange={(event) => onChoose(event.target.files?.[0] ?? null)}
      type="file"
    />
  )
}
