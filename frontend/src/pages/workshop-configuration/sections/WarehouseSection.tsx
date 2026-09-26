import { PencilSimple } from '@phosphor-icons/react'
import { useState } from 'react'

import {
  useUpdateWarehouse,
  useWarehouse,
} from '@/features/workshop-configuration/queries'
import { ProblemError } from '@/shared/api/client'
import {
  Button,
  ErrorState,
  FactList,
  FactRow,
  Field,
  FormModal,
  getControlClasses,
  LoadingState,
  SheetHeading,
  StateMark,
  useFieldProps,
  useToast,
} from '@/shared/ui'

export function WarehouseSection() {
  const warehouse = useWarehouse()
  const [editing, setEditing] = useState(false)

  if (warehouse.isLoading) return <LoadingState />
  if (warehouse.isError || !warehouse.data)
    return <ErrorState message="No se pudo cargar la bodega." />

  const data = warehouse.data
  return (
    <section aria-labelledby="bodega-titulo" className="space-y-7">
      <SheetHeading
        id="bodega-titulo"
        actions={
          <Button onClick={() => setEditing(true)} variant="secondary">
            <PencilSimple aria-hidden="true" size={16} weight="bold" />
            Editar nombre
          </Button>
        }
        description="V1 opera con una sola bodega: recibe los ingresos y controla las existencias de repuestos."
        title="Bodega"
      />
      <FactList className="max-w-3xl">
        <FactRow label="Nombre">
          <span className="font-semibold">{data.name}</span>
        </FactRow>
        <FactRow label="Estado">
          <StateMark
            label={data.is_active ? 'Activa' : 'Inactiva'}
            tone={data.is_active ? 'success' : 'inactive'}
          />
        </FactRow>
        <FactRow label="Alcance">
          Bodega única del taller. No admite transferencias ni otras bodegas.
        </FactRow>
      </FactList>
      <EditWarehouseModal
        name={data.name}
        onClose={() => setEditing(false)}
        open={editing}
        version={data.version}
      />
    </section>
  )
}

function EditWarehouseModal({
  name,
  version,
  open,
  onClose,
}: {
  name: string
  version: number
  open: boolean
  onClose: () => void
}) {
  const mutation = useUpdateWarehouse()
  const toast = useToast()
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string>()

  function close() {
    setValue(name)
    setError(undefined)
    onClose()
  }

  async function save() {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Escriba el nombre de la bodega.')
      return false
    }
    try {
      await mutation.mutateAsync({ name: trimmed, expected_version: version })
    } catch (caught) {
      const message =
        caught instanceof ProblemError ? caught.errors?.name?.[0] : undefined
      if (message) {
        setError(message)
        return false
      }
      throw caught
    }
    setError(undefined)
    toast.success('Bodega actualizada.')
    return true
  }

  return (
    <FormModal
      description="El nombre se usa en consultas y documentos futuros; la bodega conserva su identidad."
      dirty={value !== name}
      onClose={close}
      onSave={save}
      open={open}
      saveLabel="Guardar cambios"
      title="Editar bodega"
    >
      <Field error={error} label="Nombre de la bodega" required>
        <NameInput onChange={setValue} value={value} />
      </Field>
    </FormModal>
  )
}

function NameInput({
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
      className={getControlClasses()}
      maxLength={120}
      name="name"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  )
}
