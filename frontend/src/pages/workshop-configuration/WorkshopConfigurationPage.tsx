import { useState } from 'react'
import {
  Buildings,
  CheckCircle,
  Clock,
  FileText,
  PencilSimple,
  Percent,
  Plus,
  Storefront,
  Warehouse as WarehouseIcon,
  WarningCircle,
  Wrench,
} from '@phosphor-icons/react'

import {
  Avatar,
  Button,
  ConfigurationMap,
  DetailCard,
  Dialog,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  Surface,
} from '@/shared/ui'

import {
  useAllDocumentSeries,
  useAllTaxDefinitions,
  useCreateTaxDefinition,
  useCreateTaxPeriod,
  useFiscalEntities,
  useInitializeWorkshop,
  useUpdateFiscalEntity,
  useUpdateSeriesCode,
  useUpdateWarehouse,
  useWarehouse,
  useWorkshopStatus,
} from '@/features/workshop-configuration/queries'
import type {
  DocumentSeries,
  FiscalEntity,
  TaxDefinition,
} from '@/features/workshop-configuration/types'

export function WorkshopConfigurationPage() {
  const statusQuery = useWorkshopStatus()

  if (statusQuery.isLoading) {
    return <LoadingState label="Cargando configuración..." />
  }

  if (statusQuery.isError) {
    return <ErrorState message="No se pudo cargar la configuración." />
  }

  if (!statusQuery.data?.is_initialized) {
    return (
      <section className="animate-fade-in">
        <InitializeWorkshopForm />
      </section>
    )
  }

  return <ConfiguredWorkshopContent />
}

function ConfiguredWorkshopContent() {
  const { data: entities } = useFiscalEntities()
  const { data: warehouse } = useWarehouse()
  const { data: taxes } = useAllTaxDefinitions()
  const { data: series } = useAllDocumentSeries()

  return (
    <section className="animate-fade-in space-y-6 lg:space-y-8">
      <PageHeader
        description="Un solo lugar para mantener en orden la identidad fiscal, el inventario y la documentación del taller."
        title="Configuración del taller"
        actions={
          <StatusBadge label="Sistema operativo" tone="success" shape="pill" />
        }
      />

      <ConfigurationMap
        items={[
          {
            href: '#fiscal-identities',
            label: 'Identidades fiscales',
            description: 'RUC y razón social',
            count: entities?.length ?? 0,
            icon: <Storefront size={19} weight="duotone" />,
            tone: 'primary',
          },
          {
            href: '#inventory-operation',
            label: 'Operación',
            description: 'Bodega principal',
            count: warehouse?.is_active ? 1 : 0,
            icon: <WarehouseIcon size={19} weight="duotone" />,
            tone: 'info',
          },
          {
            href: '#taxes',
            label: 'Impuestos',
            description: 'Tarifas y vigencias',
            count: taxes?.length ?? 0,
            icon: <Percent size={19} weight="bold" />,
            tone: 'warning',
          },
          {
            href: '#series',
            label: 'Documentos',
            description: 'Series y secuenciales',
            count: series?.length ?? 0,
            icon: <FileText size={19} weight="duotone" />,
            tone: 'success',
          },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div id="fiscal-identities" className="scroll-mt-6">
          <EntitiesSection />
        </div>
        <div id="inventory-operation" className="scroll-mt-6">
          <WarehouseSection />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div id="taxes" className="scroll-mt-6">
          <TaxesSection />
        </div>
        <div id="series" className="scroll-mt-6">
          <SeriesSection />
        </div>
      </div>
    </section>
  )
}

function InitializeWorkshopForm() {
  const initializeMutation = useInitializeWorkshop()

  const [commercialRuc, setCommercialRuc] = useState('')
  const [commercialLegalName, setCommercialLegalName] = useState('')
  const [artisanalRuc, setArtisanalRuc] = useState('')
  const [artisanalLegalName, setArtisanalLegalName] = useState('')
  const [warehouseName, setWarehouseName] = useState('')

  const isCommercialComplete =
    commercialRuc.trim().length === 13 && commercialLegalName.trim().length > 0
  const isArtisanalComplete =
    artisanalRuc.trim().length === 13 && artisanalLegalName.trim().length > 0
  const isWarehouseComplete = warehouseName.trim().length > 0
  const hasRucCollision =
    commercialRuc.trim().length === 13 &&
    artisanalRuc.trim().length === 13 &&
    commercialRuc.trim() === artisanalRuc.trim()
  const isAllCompleted =
    isCommercialComplete &&
    isArtisanalComplete &&
    isWarehouseComplete &&
    !hasRucCollision

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isAllCompleted) return

    const data = {
      commercial_ruc: commercialRuc.trim(),
      commercial_legal_name: commercialLegalName.trim(),
      artisanal_ruc: artisanalRuc.trim(),
      artisanal_legal_name: artisanalLegalName.trim(),
      warehouse_name: warehouseName.trim(),
    }

    const idempotencyKey = crypto.randomUUID()
    initializeMutation.mutate({ data, idempotencyKey })
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* 1. Header de página con badge de estado a la derecha */}
      <PageHeader
        title="Inicialización del taller"
        description="Complete los datos para configurar el sistema por primera vez."
        actions={
          <StatusBadge
            label={isAllCompleted ? 'Completo' : 'Configuración pendiente'}
            tone={isAllCompleted ? 'success' : 'warning'}
            shape="pill"
          />
        }
      />

      {initializeMutation.isError && (
        <ErrorState
          message={`Ha ocurrido un error al inicializar. Revise los datos y vuelva a intentar: ${(initializeMutation.error as Error).message}`}
        />
      )}

      {hasRucCollision && (
        <div className="rounded-group border border-danger/30 bg-danger-soft p-4 text-sm text-danger flex items-center gap-3">
          <WarningCircle size={20} className="shrink-0" />
          <span>El RUC comercial y el RUC artesanal deben ser diferentes.</span>
        </div>
      )}

      {/* 2. Layout principal: grid de 3 columnas (lg:grid-cols-3) */}
      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start"
      >
        {/* Columna izquierda + centro (col-span-2): Formulario */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sub-grid de 2 columnas para Entidad Comercial y Entidad Artesanal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card Entidad Comercial */}
            <Surface className="space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <Storefront
                    className="text-primary shrink-0"
                    size={24}
                    weight="duotone"
                  />
                  <h2 className="text-base font-bold text-ink">
                    Entidad Comercial
                  </h2>
                </div>
                <StatusBadge
                  label="Requerido"
                  tone="info"
                  kind="category"
                  shape="rectangle"
                  showIcon={false}
                  className="text-xs"
                />
              </div>

              <div className="space-y-4">
                <div className="ui-field">
                  <label
                    className="block text-sm font-semibold text-ink"
                    htmlFor="commercial_ruc"
                  >
                    RUC Comercial
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="commercial_ruc"
                      name="commercial_ruc"
                      required
                      value={commercialRuc}
                      onChange={(e) =>
                        setCommercialRuc(
                          e.target.value.replace(/\D/g, '').slice(0, 13),
                        )
                      }
                      pattern="^[0-9]{13}$"
                      title="13 dígitos numéricos"
                      maxLength={13}
                      placeholder="Ej. 0991234567001"
                      className="ui-control min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    13 dígitos numéricos. Se validará el formato SRI.
                  </p>
                </div>

                <div className="ui-field">
                  <label
                    className="block text-sm font-semibold text-ink"
                    htmlFor="commercial_legal_name"
                  >
                    Razón Social
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="commercial_legal_name"
                      name="commercial_legal_name"
                      required
                      value={commercialLegalName}
                      onChange={(e) => setCommercialLegalName(e.target.value)}
                      placeholder="Nombre legal completo"
                      className="ui-control min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Razón social comercial registrada ante la autoridad fiscal.
                  </p>
                </div>
              </div>
            </Surface>

            {/* Card Entidad Artesanal */}
            <Surface className="space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                  <Buildings
                    className="text-primary shrink-0"
                    size={24}
                    weight="duotone"
                  />
                  <h2 className="text-base font-bold text-ink">
                    Entidad Artesanal
                  </h2>
                </div>
                <StatusBadge
                  label="Requerido"
                  tone="info"
                  kind="category"
                  shape="rectangle"
                  showIcon={false}
                  className="text-xs"
                />
              </div>

              <div className="space-y-4">
                <div className="ui-field">
                  <label
                    className="block text-sm font-semibold text-ink"
                    htmlFor="artisanal_ruc"
                  >
                    RUC Artesanal
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="artisanal_ruc"
                      name="artisanal_ruc"
                      required
                      value={artisanalRuc}
                      onChange={(e) =>
                        setArtisanalRuc(
                          e.target.value.replace(/\D/g, '').slice(0, 13),
                        )
                      }
                      pattern="^[0-9]{13}$"
                      title="13 dígitos numéricos"
                      maxLength={13}
                      placeholder="Ej. 1791234567001"
                      className="ui-control min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    13 dígitos numéricos. Se validará el formato SRI.
                  </p>
                </div>

                <div className="ui-field">
                  <label
                    className="block text-sm font-semibold text-ink"
                    htmlFor="artisanal_legal_name"
                  >
                    Razón Social
                  </label>
                  <div className="mt-1.5">
                    <input
                      id="artisanal_legal_name"
                      name="artisanal_legal_name"
                      required
                      value={artisanalLegalName}
                      onChange={(e) => setArtisanalLegalName(e.target.value)}
                      placeholder="Nombre legal completo"
                      className="ui-control min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Razón social o nombre del titular artesanal calificado.
                  </p>
                </div>
              </div>
            </Surface>
          </div>

          {/* Card Bodega Principal (a todo el ancho de la columna) */}
          <Surface className="space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <WarehouseIcon
                  className="text-primary shrink-0"
                  size={24}
                  weight="duotone"
                />
                <h2 className="text-base font-bold text-ink">
                  Bodega Principal
                </h2>
              </div>
              <StatusBadge
                label="Requerido"
                tone="info"
                kind="category"
                shape="rectangle"
                showIcon={false}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div className="ui-field">
                <label
                  className="block text-sm font-semibold text-ink"
                  htmlFor="warehouse_name"
                >
                  Nombre de la bodega
                </label>
                <div className="mt-1.5">
                  <input
                    id="warehouse_name"
                    name="warehouse_name"
                    required
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="Ej. Bodega Central"
                    className="ui-control min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
                  />
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  Espacio físico principal para inventario, recepción y despacho
                  de repuestos.
                </p>
              </div>

              {/* Registro previo / información de bodega única del sistema */}
              <div className="rounded-group border border-line bg-surface-muted p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
                  <span>Bodegas iniciales del sistema</span>
                  <StatusBadge
                    label="1 bodega"
                    tone="neutral"
                    shape="pill"
                    showIcon={false}
                    className="text-[11px]"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-success"></span>
                    <span className="text-sm font-medium text-ink">
                      {warehouseName.trim() || 'Bodega Matriz (Pendiente)'}
                    </span>
                  </div>
                  <span className="text-xs text-ink-muted">
                    Activa por defecto
                  </span>
                </div>
              </div>
            </div>
          </Surface>
        </div>

        {/* 4. Panel de resumen (columna derecha, lg:col-span-1, sticky) */}
        <div className="lg:col-span-1 lg:sticky lg:top-6">
          <Surface className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-ink">
                Resumen de configuración
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                Verifique que los datos requeridos estén completos para
                continuar.
              </p>
            </div>

            {/* Lista de 3 ítems reactivos */}
            <div className="divide-y divide-line border-y border-line">
              {/* Ítem 1: Entidad Comercial */}
              <div className="py-3.5 flex items-start gap-3">
                {isCommercialComplete ? (
                  <CheckCircle
                    className="mt-0.5 text-success shrink-0"
                    size={20}
                    weight="fill"
                  />
                ) : (
                  <Clock className="mt-0.5 text-ink-muted shrink-0" size={20} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink-muted">
                      Entidad Comercial
                    </p>
                    <span className="text-[11px] font-medium text-ink-muted">
                      {isCommercialComplete ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-sm truncate ${commercialLegalName ? 'font-semibold text-ink' : 'text-ink-muted italic'}`}
                  >
                    {commercialLegalName || 'Sin completar'}
                  </p>
                  {commercialRuc && (
                    <p className="text-xs font-mono text-ink-muted mt-0.5">
                      RUC: {commercialRuc}
                    </p>
                  )}
                </div>
              </div>

              {/* Ítem 2: Entidad Artesanal */}
              <div className="py-3.5 flex items-start gap-3">
                {isArtisanalComplete ? (
                  <CheckCircle
                    className="mt-0.5 text-success shrink-0"
                    size={20}
                    weight="fill"
                  />
                ) : (
                  <Clock className="mt-0.5 text-ink-muted shrink-0" size={20} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink-muted">
                      Entidad Artesanal
                    </p>
                    <span className="text-[11px] font-medium text-ink-muted">
                      {isArtisanalComplete ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-sm truncate ${artisanalLegalName ? 'font-semibold text-ink' : 'text-ink-muted italic'}`}
                  >
                    {artisanalLegalName || 'Sin completar'}
                  </p>
                  {artisanalRuc && (
                    <p className="text-xs font-mono text-ink-muted mt-0.5">
                      RUC: {artisanalRuc}
                    </p>
                  )}
                </div>
              </div>

              {/* Ítem 3: Bodega Principal */}
              <div className="py-3.5 flex items-start gap-3">
                {isWarehouseComplete ? (
                  <CheckCircle
                    className="mt-0.5 text-success shrink-0"
                    size={20}
                    weight="fill"
                  />
                ) : (
                  <Clock className="mt-0.5 text-ink-muted shrink-0" size={20} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink-muted">
                      Bodega Principal
                    </p>
                    <span className="text-[11px] font-medium text-ink-muted">
                      {isWarehouseComplete ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-sm truncate ${warehouseName ? 'font-semibold text-ink' : 'text-ink-muted italic'}`}
                  >
                    {warehouseName || 'Sin completar'}
                  </p>
                </div>
              </div>
            </div>

            {/* Botón de acción principal al final de la card de resumen */}
            <div className="space-y-3 pt-1">
              <Button
                type="submit"
                variant="primary"
                disabled={!isAllCompleted || initializeMutation.isPending}
                pending={initializeMutation.isPending}
                className="w-full justify-center min-h-[44px]"
              >
                Guardar configuración inicial
              </Button>
              <p className="text-[11px] text-center text-ink-muted leading-relaxed">
                Esta acción creará de forma atómica las entidades fiscales, la
                bodega y las 4 series iniciales de comprobantes.
              </p>
            </div>
          </Surface>
        </div>
      </form>
    </div>
  )
}

function EntitiesSection() {
  const { data: entities, isLoading } = useFiscalEntities()

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Identidades fiscales</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Los dos contribuyentes operan separados, con su propia información
            oficial.
          </p>
        </div>
        <span className="text-sm font-bold text-ink-muted">
          {entities?.length ?? 0} registradas
        </span>
      </div>
      <Surface className="mt-5 divide-y divide-line p-0 sm:p-0">
        {entities?.map((entity: FiscalEntity) => (
          <EntityCard key={entity.id} entity={entity} />
        ))}
      </Surface>
    </div>
  )
}

function EntityCard({ entity }: { entity: FiscalEntity }) {
  const [editing, setEditing] = useState(false)
  const updateMutation = useUpdateFiscalEntity()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = {
      ruc: formData.get('ruc') as string,
      legal_name: formData.get('legal_name') as string,
      address: formData.get('address') as string,
    }

    updateMutation.mutate(
      {
        id: entity.id,
        data: { ...data, expected_version: entity.version },
      },
      {
        onSuccess: () => setEditing(false),
      },
    )
  }

  const isComercial = entity.entity_type === 'COMERCIAL'

  return (
    <>
      <article className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex items-center gap-3">
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-full ${
                isComercial
                  ? 'bg-primary-soft text-primary'
                  : 'bg-warning-soft text-warning'
              }`}
            >
              {isComercial ? (
                <Storefront size={22} weight="duotone" />
              ) : (
                <Wrench size={22} weight="duotone" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-lg font-bold leading-snug text-ink">
                  Entidad {isComercial ? 'Comercial' : 'Artesanal'}
                </h3>
                <StatusBadge
                  label={`v${entity.version}`}
                  tone="neutral"
                  shape="rectangle"
                  kind="category"
                  showIcon={false}
                  className="text-xs"
                />
              </div>
              <p className="mt-0.5 text-sm text-ink-muted">
                {isComercial
                  ? 'Repuestos, proveedores e ingresos comerciales'
                  : 'Servicios, mantenimientos y mano de obra'}
              </p>
            </div>
          </div>
          <Button onClick={() => setEditing(true)} variant="secondary">
            <PencilSimple size={18} />
            Editar
          </Button>
        </header>

        <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <span className="block text-xs font-semibold text-ink-muted">
              Estado
            </span>
            <span className="mt-1 block">
              <StatusBadge label="Activa" tone="success" shape="pill" />
            </span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-ink-muted">
              Régimen tributario
            </span>
            <span className="mt-1 block">
              <StatusBadge
                label={
                  isComercial
                    ? 'Régimen General / Comercio'
                    : 'Artesano Calificado (RIMPE)'
                }
                tone="info"
                shape="pill"
                kind="category"
                showIcon={false}
              />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 pt-1 sm:grid-cols-2">
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-ink-muted">
              RUC Registrado
            </span>
            <span className="mt-1 block font-mono text-sm font-bold tracking-wide text-ink">
              {entity.ruc}
            </span>
          </div>

          <div className="min-w-0">
            <span className="block text-xs font-semibold text-ink-muted">
              Razón Social
            </span>
            <span className="mt-1 block truncate text-sm font-semibold text-ink">
              {entity.legal_name}
            </span>
          </div>

          {entity.address && (
            <div className="min-w-0 sm:col-span-2">
              <span className="block text-xs font-semibold text-ink-muted">
                Dirección Fiscal
              </span>
              <span className="mt-1 block break-words text-sm font-medium text-ink">
                {entity.address}
              </span>
            </div>
          )}
        </div>
      </article>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={`Editar Entidad ${isComercial ? 'Comercial' : 'Artesanal'}`}
        description="Actualice el RUC, la razón social o la dirección."
      >
        <form onSubmit={onSubmit} className="w-full space-y-6">
          {updateMutation.isError && (
            <ErrorState
              message={`Error al actualizar: ${(updateMutation.error as Error).message || 'Verifique la versión y los datos.'}`}
            />
          )}
          <div className="ui-field">
            <label
              className="block text-sm font-semibold text-ink"
              htmlFor="ruc"
            >
              RUC
            </label>
            <input
              id="ruc"
              name="ruc"
              defaultValue={entity.ruc}
              required
              pattern="^[0-9]{13}$"
              maxLength={13}
              className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
            />
          </div>
          <div className="ui-field">
            <label
              className="block text-sm font-semibold text-ink"
              htmlFor="legal_name"
            >
              Razón Social
            </label>
            <input
              id="legal_name"
              name="legal_name"
              defaultValue={entity.legal_name}
              required
              className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
            />
          </div>
          <div className="ui-field">
            <label
              className="block text-sm font-semibold text-ink"
              htmlFor="address"
            >
              Dirección
            </label>
            <input
              id="address"
              name="address"
              defaultValue={entity.address ?? ''}
              className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="quiet"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" pending={updateMutation.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}

function WarehouseSection() {
  const { data: warehouse, isLoading } = useWarehouse()
  const [editing, setEditing] = useState(false)
  const updateMutation = useUpdateWarehouse()

  if (isLoading) return <LoadingState />

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!warehouse) return
    const formData = new FormData(e.currentTarget)
    const name = (formData.get('name') as string).trim()
    if (!name) return

    updateMutation.mutate(
      {
        name,
        expected_version: warehouse.version,
      },
      {
        onSuccess: () => setEditing(false),
      },
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink">Operación del inventario</h2>
        <p className="mt-1 text-sm text-ink-muted">
          La bodega activa concentra recepción, existencias y despacho.
        </p>
      </div>
      <DetailCard
        title="Bodega Principal"
        icon={
          <span className="grid size-11 place-items-center rounded-full bg-info-soft text-primary-strong shrink-0">
            <WarehouseIcon size={22} weight="duotone" />
          </span>
        }
        badge={
          <StatusBadge
            label={`v${warehouse?.version ?? 1}`}
            tone="neutral"
            shape="rectangle"
            kind="category"
            showIcon={false}
            className="text-xs"
          />
        }
        actions={
          <Button onClick={() => setEditing(true)} variant="secondary">
            <PencilSimple size={18} />
            Editar
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-ink-muted uppercase tracking-wider">
                <th className="pb-3 pr-4">Nombre</th>
                <th className="pb-3 px-4">Ubicación</th>
                <th className="pb-3 px-4">Responsable</th>
                <th className="pb-3 pl-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-3 pr-4 font-semibold text-ink">
                  {warehouse?.name || 'Bodega Central'}
                </td>
                <td className="py-3 px-4 text-ink-muted">
                  Área principal de taller (Matriz)
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name="Encargado de Taller"
                      size="36"
                      shape="circle"
                    />
                    <span className="text-sm font-medium text-ink">
                      Encargado de Taller
                    </span>
                  </div>
                </td>
                <td className="py-3 pl-4 text-right">
                  <StatusBadge
                    label={warehouse?.is_active ? 'Activa' : 'Inactiva'}
                    tone={warehouse?.is_active ? 'success' : 'neutral'}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </DetailCard>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar Bodega Principal"
        description="Actualice el nombre de la bodega operativa."
      >
        <form onSubmit={onSubmit} className="w-full space-y-6">
          {updateMutation.isError && (
            <ErrorState
              message={`Error al actualizar: ${(updateMutation.error as Error).message}`}
            />
          )}
          <div className="ui-field">
            <label
              className="block text-sm font-semibold text-ink"
              htmlFor="wh_name"
            >
              Nombre de la bodega
            </label>
            <input
              id="wh_name"
              name="name"
              defaultValue={warehouse?.name}
              required
              className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="quiet"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" pending={updateMutation.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function TaxesSection() {
  const { data: taxes, isLoading } = useAllTaxDefinitions()
  const { data: entities } = useFiscalEntities()
  const [creating, setCreating] = useState(false)
  const createTaxMutation = useCreateTaxDefinition()
  const createPeriodMutation = useCreateTaxPeriod()

  if (isLoading) return <LoadingState />

  const closeDrawer = () => {
    createTaxMutation.reset()
    createPeriodMutation.reset()
    setCreating(false)
  }

  const openDrawer = () => {
    createTaxMutation.reset()
    createPeriodMutation.reset()
    setCreating(true)
  }

  const onCreateTax = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const entityId = Number(formData.get('entity_id'))
    const code = (formData.get('code') as string).trim().toUpperCase()
    const name = (formData.get('name') as string).trim()
    const rate = (formData.get('rate') as string).trim()
    const startsOn = formData.get('starts_on') as string

    try {
      const taxDef = await createTaxMutation.mutateAsync({
        entity_id: entityId,
        code,
        name,
      })

      if (rate && startsOn) {
        await createPeriodMutation.mutateAsync({
          taxDefId: taxDef.id,
          data: {
            rate,
            starts_on: startsOn,
          },
        })
      }
      closeDrawer()
    } catch {
      // Error manejado por el estado de las mutaciones
    }
  }

  const hasTaxes = taxes && taxes.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">Impuestos y vigencias</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Tarifas aplicables por entidad fiscal.
          </p>
        </div>
        <Button onClick={openDrawer} variant="secondary">
          <Plus size={18} />
          Nuevo Impuesto
        </Button>
      </div>

      <DetailCard
        title="Impuestos Tributarios"
        icon={
          <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning shrink-0">
            <Percent size={22} weight="bold" />
          </span>
        }
        badge={
          <StatusBadge
            label={`${taxes?.length ?? 0} configurados`}
            tone="neutral"
            shape="pill"
            showIcon={false}
            className="text-xs"
          />
        }
      >
        {hasTaxes ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="pb-3 pr-4">Impuesto</th>
                  <th className="pb-3 px-4">Entidad</th>
                  <th className="pb-3 px-4">Tarifa</th>
                  <th className="pb-3 px-4">Vigencia</th>
                  <th className="pb-3 pl-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {taxes.map((t: TaxDefinition) => (
                  <tr key={t.id}>
                    <td className="py-3 pr-4">
                      <span className="font-semibold text-ink">{t.code}</span>
                      <span className="block text-xs text-ink-muted">
                        {t.name}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        label={
                          t.entity_type === 'COMERCIAL'
                            ? 'Comercial'
                            : 'Artesanal'
                        }
                        tone="info"
                        kind="category"
                        shape="rectangle"
                        showIcon={false}
                        className="text-xs"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-ink">
                      {t.current_rate ? `${parseFloat(t.current_rate)}%` : '0%'}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted">
                      {t.starts_on ? `Desde ${t.starts_on}` : 'Vigente'}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <StatusBadge
                        label={t.current_rate ? 'Vigente' : 'Sin tarifa'}
                        tone={t.current_rate ? 'success' : 'warning'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center rounded-group border border-dashed border-line bg-surface-muted/30">
            <Percent className="mx-auto text-ink-muted" size={32} />
            <p className="mt-2 text-sm font-bold text-ink">
              Aún no hay impuestos configurados
            </p>
            <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
              Registre las definiciones de impuestos (ej. IVA) y sus tarifas por
              entidad fiscal.
            </p>
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={openDrawer}>
                <Plus size={18} />
                Nuevo Impuesto
              </Button>
            </div>
          </div>
        )}
      </DetailCard>

      <Dialog
        open={creating}
        onClose={closeDrawer}
        title="Nuevo Impuesto y Vigencia"
        description="Configure un impuesto oficial (ej. IVA) y su porcentaje vigente."
      >
        <form onSubmit={onCreateTax} className="w-full space-y-5">
          {(createTaxMutation.isError || createPeriodMutation.isError) && (
            <ErrorState
              message={`Error: ${(createTaxMutation.error as Error)?.message || (createPeriodMutation.error as Error)?.message}`}
            />
          )}

          <div className="ui-field">
            <label
              className="block text-sm font-semibold text-ink"
              htmlFor="tax_entity"
            >
              Entidad Fiscal
            </label>
            <select
              id="tax_entity"
              name="entity_id"
              required
              className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
            >
              {entities?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.entity_type}: {e.legal_name} ({e.ruc})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="ui-field">
              <label
                className="block text-sm font-semibold text-ink"
                htmlFor="tax_code"
              >
                Código del impuesto
              </label>
              <input
                id="tax_code"
                name="code"
                required
                placeholder="Ej. IVA"
                maxLength={20}
                className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
              />
            </div>
            <div className="ui-field">
              <label
                className="block text-sm font-semibold text-ink"
                htmlFor="tax_rate"
              >
                Tarifa (%)
              </label>
              <input
                id="tax_rate"
                name="rate"
                required
                placeholder="Ej. 15.0000"
                className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
              />
            </div>
          </div>

          <div className="ui-field">
            <label
              className="block text-sm font-semibold text-ink"
              htmlFor="tax_name"
            >
              Nombre oficial
            </label>
            <input
              id="tax_name"
              name="name"
              required
              placeholder="Ej. Impuesto al Valor Agregado"
              className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
            />
          </div>

          <div className="ui-field">
            <label
              className="block text-sm font-semibold text-ink"
              htmlFor="starts_on"
            >
              Fecha de vigencia (desde)
            </label>
            <input
              id="starts_on"
              name="starts_on"
              type="date"
              required
              defaultValue={new Date().toISOString().split('T')[0]}
              className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="quiet" onClick={closeDrawer}>
              Cancelar
            </Button>
            <Button
              type="submit"
              pending={
                createTaxMutation.isPending || createPeriodMutation.isPending
              }
            >
              Crear impuesto
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

const docTypeLabels: Record<string, string> = {
  INGRESO: 'Comprobante de Ingreso',
  PROFORMA: 'Proforma de Taller',
  VENTA: 'Factura de Venta',
  SERVICIO: 'Orden de Servicio',
}

function SeriesSection() {
  const { data: seriesList, isLoading } = useAllDocumentSeries()
  const [editingSeries, setEditingSeries] = useState<DocumentSeries | null>(
    null,
  )
  const updateSeriesMutation = useUpdateSeriesCode()

  if (isLoading) return <LoadingState />

  const onUpdateSeries = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingSeries) return
    const formData = new FormData(e.currentTarget)
    const code = (formData.get('code') as string).trim().toUpperCase()

    updateSeriesMutation.mutate(
      {
        seriesId: editingSeries.id,
        data: {
          code,
          expected_version: editingSeries.version,
        },
      },
      {
        onSuccess: () => setEditingSeries(null),
      },
    )
  }

  const hasSeries = seriesList && seriesList.length > 0

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-ink">Series y secuenciales</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Prefijos y consecutivos de los documentos internos.
        </p>
      </div>
      <DetailCard
        title="Control de Secuenciales"
        icon={
          <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success shrink-0">
            <FileText size={22} weight="duotone" />
          </span>
        }
        badge={
          <StatusBadge
            label={`${seriesList?.length ?? 0} configuradas`}
            tone="neutral"
            shape="pill"
            showIcon={false}
            className="text-xs"
          />
        }
      >
        {hasSeries ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="pb-3 pr-4">Tipo de documento</th>
                  <th className="pb-3 px-4">Serie / Prefijo</th>
                  <th className="pb-3 px-4">Secuencial actual</th>
                  <th className="pb-3 px-4">Estado</th>
                  <th className="pb-3 pl-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {seriesList.map((s: DocumentSeries) => (
                  <tr key={s.id}>
                    <td className="py-3 pr-4">
                      <span className="font-semibold text-ink">
                        {docTypeLabels[s.document_type || ''] ||
                          s.document_type ||
                          s.code}
                      </span>
                      {s.entity_type && (
                        <span className="block text-xs text-ink-muted">
                          Entidad {s.entity_type.toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-primary">
                        {s.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold bg-surface-muted px-2.5 py-1 rounded text-xs">
                        {String(s.last_number).padStart(6, '0')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        label={s.is_active ? 'Activa' : 'Inactiva'}
                        tone={s.is_active ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <Button
                        variant="secondary"
                        onClick={() => setEditingSeries(s)}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center rounded-group border border-dashed border-line bg-surface-muted/30">
            <FileText className="mx-auto text-ink-muted" size={32} />
            <p className="mt-2 text-sm font-bold text-ink">
              Aún no hay series configuradas
            </p>
            <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
              Las series de comprobantes se generan automáticamente al
              inicializar el taller.
            </p>
          </div>
        )}
      </DetailCard>

      <Dialog
        open={editingSeries !== null}
        onClose={() => setEditingSeries(null)}
        title={`Editar Serie: ${editingSeries?.code ?? ''}`}
        description="Actualice el prefijo de la serie antes de su primer uso."
      >
        {editingSeries && (
          <form onSubmit={onUpdateSeries} className="w-full space-y-6">
            {updateSeriesMutation.isError && (
              <ErrorState
                message={`Error al actualizar: ${(updateSeriesMutation.error as Error).message}`}
              />
            )}
            <div className="ui-field">
              <label
                className="block text-sm font-semibold text-ink"
                htmlFor="series_code"
              >
                Código de serie / Prefijo
              </label>
              <input
                id="series_code"
                name="code"
                defaultValue={editingSeries.code}
                required
                maxLength={20}
                className="ui-control mt-2 min-h-[44px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] focus:border-primary/35 focus:bg-surface hover:bg-surface-selected/50 focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)]"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Solo se puede modificar si aún no ha emitido comprobantes.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="quiet"
                onClick={() => setEditingSeries(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" pending={updateSeriesMutation.isPending}>
                Guardar cambios
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  )
}
