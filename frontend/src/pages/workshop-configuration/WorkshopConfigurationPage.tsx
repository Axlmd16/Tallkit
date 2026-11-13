import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Buildings,
  CheckCircle,
  Clock,
  Hash,
  Percent,
  Receipt,
  Storefront,
  Warehouse as WarehouseIcon,
  WarningCircle,
  SlidersHorizontal,
} from '@phosphor-icons/react'

import {
  Button,
  ErrorState,
  getControlClasses,
  LoadingState,
  PageHeader,
  PendingCount,
  SectionNav,
  StatusBadge,
  SubsectionIndicator,
  Surface,
} from '@/shared/ui'

import {
  useAllDocumentSeries,
  useAllTaxDefinitions,
  useFiscalEntities,
  useInitializeWorkshop,
  useWarehouse,
  useWorkshopStatus,
} from '@/features/workshop-configuration/queries'
import { FiscalConfigurationSection } from '@/features/fiscal/FiscalConfigurationSection'
import {
  READINESS_SECTION_SHORT_LABELS,
  READINESS_SECTIONS,
  sectionIndicator,
  useConfigurationReadiness,
} from '@/features/fiscal/configuration/readiness'
import { ConfigurationSummary } from './ConfigurationSummary'
import { EntitiesSection } from './sections/EntitiesSection'
import { SeriesSection } from './sections/SeriesSection'
import { TaxesSection } from './sections/TaxesSection'
import { WarehouseSection } from './sections/WarehouseSection'

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

const CONFIGURATION_TABS = [
  'entidades',
  'bodega',
  'impuestos',
  'series',
  'facturacion',
] as const
type ConfigurationTab = (typeof CONFIGURATION_TABS)[number]

function isConfigurationTab(value: string | null): value is ConfigurationTab {
  return CONFIGURATION_TABS.includes(value as ConfigurationTab)
}

const TAB_LABELS: Record<ConfigurationTab, string> = {
  entidades: 'Entidades fiscales',
  bodega: 'Bodega',
  impuestos: 'Impuestos',
  series: 'Series y numeración',
  facturacion: 'Facturación electrónica',
}

const FISCAL_CHILD_PREFIX = 'fiscal-'

function ConfiguredWorkshopContent() {
  const { data: entities } = useFiscalEntities()
  const { data: warehouse } = useWarehouse()
  const { data: taxes } = useAllTaxDefinitions()
  const { data: series } = useAllDocumentSeries()
  const readiness = useConfigurationReadiness(
    (entities ?? []).map((entity) => entity.id),
  )
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: ConfigurationTab = isConfigurationTab(requested)
    ? requested
    : 'entidades'
  const requestedSection = params.get('seccion')
  const fiscalSection =
    READINESS_SECTIONS.find((section) => section === requestedSection) ??
    'perfil'
  const requestedEntity = Number(params.get('entidad'))
  const selectedEntity =
    entities?.find((entity) => entity.id === requestedEntity) ?? entities?.[0]
  const selectedReadiness = selectedEntity
    ? readiness.byEntity[selectedEntity.id]
    : undefined

  // Facturación electrónica se monta al visitarla por primera vez y después se conserva.
  const [billingVisited, setBillingVisited] = useState(tab === 'facturacion')
  useEffect(() => {
    if (tab === 'facturacion') setBillingVisited(true)
  }, [tab])

  function hrefFor(next: ConfigurationTab, section?: string) {
    const nextParams = new URLSearchParams(params)
    if (next === 'entidades') nextParams.delete('tab')
    else nextParams.set('tab', next)
    if (next !== 'facturacion') nextParams.delete('seccion')
    else if (section && section !== 'perfil') nextParams.set('seccion', section)
    else if (section === 'perfil') nextParams.delete('seccion')
    const query = nextParams.toString()
    return query ? `?${query}` : '?'
  }

  function select(id: string) {
    const target = id.startsWith(FISCAL_CHILD_PREFIX)
      ? hrefFor('facturacion', id.slice(FISCAL_CHILD_PREFIX.length))
      : hrefFor(id as ConfigurationTab)
    setParams(new URLSearchParams(target.slice(1)), { replace: true })
  }

  const activeSeries = series?.filter((item) => item.is_active).length ?? 0

  return (
    <section className="animate-fade-in flex flex-col gap-6 md:h-[calc(100dvh-100px)]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-micro font-semibold tracking-[0.12em] text-ink-muted uppercase">
            <span
              aria-hidden="true"
              className="size-2 rounded-[2px] bg-brand"
            />
            Administración
          </p>
          <h1 className="mt-2 text-page font-bold text-ink">
            Configuración del taller
          </h1>
          <p className="mt-1 text-body text-ink-muted">
            Datos base del taller: entidades fiscales, bodega, impuestos,
            numeración y facturación electrónica.
          </p>
        </div>
        <div className="shrink-0">
          <ConfigurationSummary readiness={readiness} />
        </div>
      </header>

      <div className="relative grid min-h-[24rem] flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] md:min-h-0 lg:grid-rows-[minmax(0,1fr)] overflow-hidden rounded-panel border border-line bg-surface lg:grid-cols-[272px_minmax(0,1fr)]">
        <SectionNav
          activeChildId={
            tab === 'facturacion'
              ? `${FISCAL_CHILD_PREFIX}${fiscalSection}`
              : undefined
          }
          activeId={tab}
          aria-label="Secciones de configuración"
          className="min-w-0 border-b border-line lg:overflow-y-auto lg:border-r lg:border-b-0 lg:py-5"
          items={[
            {
              id: 'entidades',
              label: TAB_LABELS.entidades,
              href: hrefFor('entidades'),
              icon: Buildings,
              indicator: entities?.length ?? 0,
            },
            {
              id: 'bodega',
              label: TAB_LABELS.bodega,
              href: hrefFor('bodega'),
              icon: WarehouseIcon,
              indicator: warehouse?.is_active ? 1 : 0,
            },
            {
              id: 'impuestos',
              label: TAB_LABELS.impuestos,
              href: hrefFor('impuestos'),
              icon: Percent,
              indicator: taxes?.length ?? 0,
            },
            {
              id: 'series',
              label: TAB_LABELS.series,
              href: hrefFor('series'),
              icon: Hash,
              indicator: activeSeries,
            },
            {
              id: 'facturacion',
              label: TAB_LABELS.facturacion,
              href: hrefFor('facturacion'),
              icon: Receipt,
              ...(readiness.pending > 0
                ? { indicator: <PendingCount count={readiness.pending} /> }
                : {}),
              children: READINESS_SECTIONS.map((section) => ({
                id: `${FISCAL_CHILD_PREFIX}${section}`,
                label: READINESS_SECTION_SHORT_LABELS[section],
                href: hrefFor('facturacion', section),
                ...(selectedReadiness
                  ? {
                      indicator: (
                        <SubsectionIndicator
                          {...sectionIndicator(selectedReadiness, section)}
                        />
                      ),
                    }
                  : {}),
              })),
            },
          ]}
          onSelect={select}
          title="Secciones"
        />

        <div className="min-h-0 min-w-0 px-4 py-6 sm:px-6 md:overflow-y-auto lg:px-10 lg:py-8">
          <div hidden={tab !== 'entidades'}>
            <EntitiesSection readiness={readiness} />
          </div>
          <div hidden={tab !== 'bodega'}>
            <WarehouseSection />
          </div>
          <div hidden={tab !== 'impuestos'}>
            <TaxesSection />
          </div>
          <div hidden={tab !== 'series'}>
            <SeriesSection />
          </div>
          {(billingVisited || tab === 'facturacion') && (
            <div hidden={tab !== 'facturacion'}>
              <FiscalConfigurationSection
                entities={entities ?? []}
                readiness={readiness}
                taxDefinitions={taxes ?? []}
              />
            </div>
          )}
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
        icon={<SlidersHorizontal />}
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
        <div className="rounded-group border border-danger/30 bg-danger-soft p-4 text-body text-danger flex items-center gap-3">
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
                    className="shrink-0 text-ink-muted"
                    size={24}
                    weight="duotone"
                  />
                  <h2 className="text-block font-bold text-ink">
                    Entidad Comercial
                  </h2>
                </div>
                <StatusBadge
                  label="Requerido"
                  tone="info"
                  kind="category"
                  shape="rectangle"
                  showIcon={false}
                  className="text-label"
                />
              </div>

              <div className="space-y-4">
                <div className="ui-field">
                  <label
                    className="block text-body font-semibold text-ink"
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
                      className={getControlClasses()}
                    />
                  </div>
                  <p className="mt-1 text-label text-ink-muted">
                    13 dígitos numéricos. Se validará el formato SRI.
                  </p>
                </div>

                <div className="ui-field">
                  <label
                    className="block text-body font-semibold text-ink"
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
                      className={getControlClasses()}
                    />
                  </div>
                  <p className="mt-1 text-label text-ink-muted">
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
                    className="shrink-0 text-ink-muted"
                    size={24}
                    weight="duotone"
                  />
                  <h2 className="text-block font-bold text-ink">
                    Entidad Artesanal
                  </h2>
                </div>
                <StatusBadge
                  label="Requerido"
                  tone="info"
                  kind="category"
                  shape="rectangle"
                  showIcon={false}
                  className="text-label"
                />
              </div>

              <div className="space-y-4">
                <div className="ui-field">
                  <label
                    className="block text-body font-semibold text-ink"
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
                      className={getControlClasses()}
                    />
                  </div>
                  <p className="mt-1 text-label text-ink-muted">
                    13 dígitos numéricos. Se validará el formato SRI.
                  </p>
                </div>

                <div className="ui-field">
                  <label
                    className="block text-body font-semibold text-ink"
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
                      className={getControlClasses()}
                    />
                  </div>
                  <p className="mt-1 text-label text-ink-muted">
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
                  className="shrink-0 text-ink-muted"
                  size={24}
                  weight="duotone"
                />
                <h2 className="text-block font-bold text-ink">
                  Bodega Principal
                </h2>
              </div>
              <StatusBadge
                label="Requerido"
                tone="info"
                kind="category"
                shape="rectangle"
                showIcon={false}
                className="text-label"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div className="ui-field">
                <label
                  className="block text-body font-semibold text-ink"
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
                    className={getControlClasses()}
                  />
                </div>
                <p className="mt-1 text-label text-ink-muted">
                  Espacio físico principal para inventario, recepción y despacho
                  de repuestos.
                </p>
              </div>

              {/* Registro previo / información de bodega única del sistema */}
              <div className="rounded-group border border-line bg-surface-muted p-4 space-y-2">
                <div className="flex items-center justify-between text-label font-semibold text-ink-muted">
                  <span>Bodegas iniciales del sistema</span>
                  <StatusBadge
                    label="1 bodega"
                    tone="neutral"
                    shape="pill"
                    showIcon={false}
                    className="text-micro"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-success"></span>
                    <span className="text-body font-medium text-ink">
                      {warehouseName.trim() || 'Bodega Matriz (Pendiente)'}
                    </span>
                  </div>
                  <span className="text-label text-ink-muted">
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
              <h3 className="text-block font-bold text-ink">
                Resumen de configuración
              </h3>
              <p className="mt-1 text-label text-ink-muted">
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
                    <p className="text-label font-semibold text-ink-muted">
                      Entidad Comercial
                    </p>
                    <span className="text-micro font-medium text-ink-muted">
                      {isCommercialComplete ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-body truncate ${commercialLegalName ? 'font-semibold text-ink' : 'text-ink-muted italic'}`}
                  >
                    {commercialLegalName || 'Sin completar'}
                  </p>
                  {commercialRuc && (
                    <p className="text-label code text-ink-muted mt-0.5">
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
                    <p className="text-label font-semibold text-ink-muted">
                      Entidad Artesanal
                    </p>
                    <span className="text-micro font-medium text-ink-muted">
                      {isArtisanalComplete ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-body truncate ${artisanalLegalName ? 'font-semibold text-ink' : 'text-ink-muted italic'}`}
                  >
                    {artisanalLegalName || 'Sin completar'}
                  </p>
                  {artisanalRuc && (
                    <p className="text-label code text-ink-muted mt-0.5">
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
                    <p className="text-label font-semibold text-ink-muted">
                      Bodega Principal
                    </p>
                    <span className="text-micro font-medium text-ink-muted">
                      {isWarehouseComplete ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-body truncate ${warehouseName ? 'font-semibold text-ink' : 'text-ink-muted italic'}`}
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
              <p className="text-micro text-center text-ink-muted leading-relaxed">
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
