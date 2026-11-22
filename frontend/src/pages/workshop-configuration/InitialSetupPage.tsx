import { ArrowRight, Check, CheckCircle, Wrench } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { useConfigurationReadiness } from '@/features/fiscal/configuration/readiness'
import {
  useAllTaxDefinitions,
  useFiscalEntities,
  useInitializeWorkshop,
  useUpdateFiscalEntity,
  useWorkshopStatus,
} from '@/features/workshop-configuration/queries'
import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  GaugeMotif,
  InlineNotice,
  LoadingState,
  ToastProvider,
  useToast,
} from '@/shared/ui'

const STEPS = [
  { id: 1, title: 'Los dos negocios', subtitle: 'Nombre y RUC' },
  {
    id: 2,
    title: 'Facturación electrónica',
    subtitle: 'Punto de emisión y firma',
  },
  { id: 3, title: 'Impuestos', subtitle: 'Artesano e IVA' },
  { id: 4, title: 'Personas con acceso', subtitle: 'Quién usa el sistema' },
  { id: 5, title: 'Listo', subtitle: 'Revisar y empezar' },
] as const

type StepId = (typeof STEPS)[number]['id']

/**
 * Asistente de configuración inicial en 5 pasos (pantalla 14a).
 * Funciona tanto en la primera puesta en marcha como al repetir la guía desde Ajustes.
 */
export function InitialSetupPage() {
  return (
    <ToastProvider>
      <InitialSetupContent />
    </ToastProvider>
  )
}

function InitialSetupContent() {
  const navigate = useNavigate()
  const toast = useToast()
  const tracker = useIntentTracker()
  const statusQuery = useWorkshopStatus()
  const initialized = statusQuery.data?.is_initialized ?? false
  const entitiesQuery = useFiscalEntities()
  const taxesQuery = useAllTaxDefinitions()
  const initMutation = useInitializeWorkshop()
  const updateEntity = useUpdateFiscalEntity()

  const entities = entitiesQuery.data ?? []
  const artisan = entities.find((e) => e.entity_type === 'ARTESANAL')
  const commercial = entities.find((e) => e.entity_type === 'COMERCIAL')
  const readiness = useConfigurationReadiness(entities.map((e) => e.id))

  const [step, setStep] = useState<StepId>(1)
  const [artisanTrade, setArtisanTrade] = useState('')
  const [artisanLegal, setArtisanLegal] = useState('')
  const [artisanRuc, setArtisanRuc] = useState('')
  const [commercialTrade, setCommercialTrade] = useState('')
  const [commercialLegal, setCommercialLegal] = useState('')
  const [commercialRuc, setCommercialRuc] = useState('')
  const [warehouseName, setWarehouseName] = useState('Bodega principal')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (artisan) {
      setArtisanTrade(artisan.trade_name ?? '')
      setArtisanLegal(artisan.legal_name)
      setArtisanRuc(artisan.ruc)
    }
    if (commercial) {
      setCommercialTrade(commercial.trade_name ?? '')
      setCommercialLegal(commercial.legal_name)
      setCommercialRuc(commercial.ruc)
    }
  }, [artisan, commercial])

  async function handleStep1Save() {
    setError(null)
    const aRuc = artisanRuc.trim()
    const cRuc = commercialRuc.trim()
    const aLegal = (artisanLegal.trim() || artisanTrade.trim()).trim()
    const cLegal = (commercialLegal.trim() || commercialTrade.trim()).trim()

    if (!/^\d{13}$/.test(aRuc) || !/^\d{13}$/.test(cRuc)) {
      setError('Cada negocio necesita un RUC válido de 13 dígitos.')
      return
    }
    if (!aLegal || !cLegal) {
      setError('Escribe el nombre o razón social de ambos negocios.')
      return
    }

    setSaving(true)
    try {
      if (!initialized) {
        const payload = {
          artisanal_ruc: aRuc,
          artisanal_legal_name: aLegal,
          commercial_ruc: cRuc,
          commercial_legal_name: cLegal,
          warehouse_name: warehouseName.trim() || 'Bodega principal',
        }
        const tradeNames: { artisanal?: string; commercial?: string } = {}
        if (artisanTrade.trim()) tradeNames.artisanal = artisanTrade.trim()
        if (commercialTrade.trim())
          tradeNames.commercial = commercialTrade.trim()
        await tracker.run({ op: 'init', ...payload }, (idempotencyKey) =>
          initMutation.mutateAsync({
            data: payload,
            idempotencyKey,
            tradeNames,
          }),
        )
        toast.success('Los dos negocios quedaron registrados.')
      } else {
        if (artisan) {
          await updateEntity.mutateAsync({
            id: artisan.id,
            data: {
              ruc: aRuc,
              legal_name: aLegal,
              trade_name: artisanTrade.trim() || null,
              expected_version: artisan.version,
            },
          })
        }
        if (commercial) {
          await updateEntity.mutateAsync({
            id: commercial.id,
            data: {
              ruc: cRuc,
              legal_name: cLegal,
              trade_name: commercialTrade.trim() || null,
              expected_version: commercial.version,
            },
          })
        }
        toast.success('Datos de los negocios actualizados.')
      }
      setStep(2)
    } catch (caught) {
      setError(describeProblem(caught).message)
    } finally {
      setSaving(false)
    }
  }

  function nextStep() {
    setError(null)
    if (step < 5) setStep((step + 1) as StepId)
  }

  if (statusQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <LoadingState label="Cargando configuración inicial…" />
      </div>
    )
  }

  const progress = (step / STEPS.length) * 100

  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      <aside className="relative flex w-full shrink-0 flex-col overflow-hidden bg-graphite px-6 py-7 text-white md:w-72">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-control bg-primary text-white"
          >
            <Wrench size={18} weight="bold" />
          </span>
          <span className="text-lead font-bold tracking-tight">Tallkit</span>
        </div>

        <div className="mt-8">
          <h1 className="text-page font-bold tracking-tight text-white">
            Preparemos el taller
          </h1>
          <p className="mt-2 text-label leading-relaxed text-graphite-ink">
            Cinco pasos que se hacen una sola vez. Puedes volver a cualquiera
            más tarde desde Ajustes.
          </p>
        </div>

        <nav aria-label="Pasos de la configuración inicial" className="mt-8">
          <ol className="space-y-1.5">
            {STEPS.map((item) => {
              const current = item.id === step
              const done = item.id < step
              return (
                <li key={item.id}>
                  <button
                    aria-current={current ? 'step' : undefined}
                    className={`flex w-full items-center gap-3 rounded-panel px-3 py-2.5 text-left transition-colors ${
                      current
                        ? 'bg-white/10 text-white'
                        : 'text-graphite-ink hover:bg-white/5 hover:text-white'
                    }`}
                    onClick={() => setStep(item.id)}
                    type="button"
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-micro font-bold ${
                        current
                          ? 'bg-white text-graphite'
                          : done
                            ? 'bg-success text-white'
                            : 'border border-white/25 text-graphite-ink'
                      }`}
                    >
                      {done ? <Check size={12} weight="bold" /> : item.id}
                    </span>
                    <span className="min-w-0 leading-snug">
                      <span
                        className={`block text-label ${current ? 'font-bold text-white' : 'font-medium'}`}
                      >
                        {item.title}
                      </span>
                      <span className="block text-micro text-graphite-ink">
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <GaugeMotif
          className="pointer-events-none absolute -bottom-10 -left-10 w-56 opacity-30"
          variant="card"
        />
      </aside>

      <main className="flex flex-1 flex-col px-6 py-8 md:px-14 md:py-10">
        <div className="mx-auto w-full max-w-4xl flex-1">
          <div className="flex items-center gap-4">
            <span className="shrink-0 text-label font-medium text-ink-muted">
              Paso {step} de {STEPS.length}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="mt-5">
              <InlineNotice title="Revisa los datos" tone="danger">
                {error}
              </InlineNotice>
            </div>
          )}

          {step === 1 && (
            <section className="mt-8 space-y-6">
              <div>
                <h2 className="text-page font-bold tracking-tight text-ink">
                  Los dos negocios
                </h2>
                <p className="mt-1 text-body text-ink-muted">
                  El taller factura la mano de obra y el almacén factura las
                  piezas. Cada uno tiene su RUC.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="overflow-hidden rounded-card border border-line bg-surface">
                  <div className="border-b border-line bg-[#EEF2F6] px-5 py-3">
                    <h3 className="text-body font-bold text-[#3B5168]">
                      Taller · mano de obra
                    </h3>
                  </div>
                  <div className="space-y-4 p-5">
                    <label className="block">
                      <span className="block text-label font-medium text-ink-muted">
                        Nombre que verán los clientes
                      </span>
                      <input
                        className="mt-1 w-full border-0 border-b border-line-strong bg-transparent py-2 text-body text-ink outline-none focus:border-ink"
                        onChange={(e) => setArtisanTrade(e.target.value)}
                        placeholder="Nombre comercial del taller"
                        value={artisanTrade}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-label font-medium text-ink-muted">
                        Razón social
                      </span>
                      <input
                        className="mt-1 w-full border-0 border-b border-line-strong bg-transparent py-2 text-body text-ink outline-none focus:border-ink"
                        onChange={(e) => setArtisanLegal(e.target.value)}
                        placeholder="Razón social registrada en el SRI"
                        value={artisanLegal}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-label font-medium text-ink-muted">
                        RUC
                      </span>
                      <input
                        className="code mt-1 w-full border-0 border-b border-line-strong bg-transparent py-2 text-body text-ink outline-none focus:border-ink"
                        inputMode="numeric"
                        maxLength={13}
                        onChange={(e) => setArtisanRuc(e.target.value)}
                        placeholder="13 dígitos"
                        value={artisanRuc}
                      />
                    </label>
                  </div>
                </div>

                <div className="overflow-hidden rounded-card border border-line bg-surface">
                  <div className="border-b border-line bg-[#F5EFE6] px-5 py-3">
                    <h3 className="text-body font-bold text-[#7A5B32]">
                      Almacén · repuestos
                    </h3>
                  </div>
                  <div className="space-y-4 p-5">
                    <label className="block">
                      <span className="block text-label font-medium text-ink-muted">
                        Nombre que verán los clientes
                      </span>
                      <input
                        className="mt-1 w-full border-0 border-b border-line-strong bg-transparent py-2 text-body text-ink outline-none focus:border-ink"
                        onChange={(e) => setCommercialTrade(e.target.value)}
                        placeholder="Nombre comercial del almacén"
                        value={commercialTrade}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-label font-medium text-ink-muted">
                        Razón social
                      </span>
                      <input
                        className="mt-1 w-full border-0 border-b border-line-strong bg-transparent py-2 text-body text-ink outline-none focus:border-ink"
                        onChange={(e) => setCommercialLegal(e.target.value)}
                        placeholder="Razón social registrada en el SRI"
                        value={commercialLegal}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-label font-medium text-ink-muted">
                        RUC
                      </span>
                      <input
                        className="code mt-1 w-full border-0 border-b border-line-strong bg-transparent py-2 text-body text-ink outline-none focus:border-ink"
                        inputMode="numeric"
                        maxLength={13}
                        onChange={(e) => setCommercialRuc(e.target.value)}
                        placeholder="13 dígitos"
                        value={commercialRuc}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {!initialized && (
                <div className="rounded-card border border-line bg-surface p-5">
                  <label className="block max-w-sm">
                    <span className="block text-label font-medium text-ink-muted">
                      Nombre de la bodega inicial
                    </span>
                    <input
                      className="mt-1 w-full border-0 border-b border-line-strong bg-transparent py-2 text-body text-ink outline-none focus:border-ink"
                      onChange={(e) => setWarehouseName(e.target.value)}
                      value={warehouseName}
                    />
                  </label>
                </div>
              )}

              <p className="text-label text-ink-muted">
                La razón social se ingresa manualmente y puedes revisarla o
                completar el logo y dirección más tarde desde Ajustes.
              </p>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
                <Button onClick={nextStep} type="button" variant="ghost">
                  Hacerlo después
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => void handleStep1Save()}
                  type="button"
                >
                  {saving ? 'Guardando…' : 'Guardar y seguir'}
                </Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="mt-8 space-y-6">
              <div>
                <h2 className="text-page font-bold tracking-tight text-ink">
                  Facturación electrónica
                </h2>
                <p className="mt-1 text-body text-ink-muted">
                  Configura el punto de emisión y la firma electrónica de cada
                  negocio. Puedes dejarlo listo ahora o completarlo después.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {entities.map((entity) => {
                  const summary = readiness.byEntity[entity.id]
                  const pointsOk = summary
                    ? summary.bySection.puntos.length === 0
                    : false
                  const certOk = summary
                    ? summary.bySection.certificado.length === 0
                    : false
                  return (
                    <div
                      className="space-y-3 rounded-card border border-line bg-surface p-5"
                      key={entity.id}
                    >
                      <h3 className="font-bold text-ink">
                        {entity.trade_name || entity.legal_name}
                      </h3>
                      <div className="space-y-2 text-label">
                        <div className="flex items-center justify-between">
                          <span className="text-ink-muted">
                            Punto de emisión
                          </span>
                          <Link
                            className="font-semibold text-accent hover:underline"
                            to={`/configuration?tab=facturacion&seccion=puntos&entidad=${entity.id}`}
                          >
                            {pointsOk ? 'Completo · revisar' : 'Configurar'}
                          </Link>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-ink-muted">
                            Firma electrónica
                          </span>
                          <Link
                            className="font-semibold text-accent hover:underline"
                            to={`/configuration?tab=facturacion&seccion=certificado&entidad=${entity.id}`}
                          >
                            {certOk ? 'Cargada · revisar' : 'Cargar firma'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
                <Button onClick={nextStep} type="button" variant="ghost">
                  Hacerlo después
                </Button>
                <Button onClick={nextStep} type="button">
                  Guardar y seguir
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="mt-8 space-y-6">
              <div>
                <h2 className="text-page font-bold tracking-tight text-ink">
                  Impuestos
                </h2>
                <p className="mt-1 text-body text-ink-muted">
                  Revisa la tarifa de IVA para los repuestos y la calificación
                  artesanal del taller.
                </p>
              </div>
              <div className="rounded-card border border-line bg-surface p-5 space-y-3">
                {(taxesQuery.data ?? []).length > 0 ? (
                  <ul className="divide-y divide-line">
                    {(taxesQuery.data ?? []).map((tax) => (
                      <li
                        className="flex items-center justify-between py-2.5 text-body"
                        key={tax.id}
                      >
                        <span className="font-medium text-ink">{tax.name}</span>
                        <span className="code text-label text-ink-muted">
                          {tax.current_rate ? `${tax.current_rate}%` : tax.code}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-ink-muted">
                    Aún no hay impuestos definidos.
                  </p>
                )}
                <div className="pt-2">
                  <Link
                    className="inline-flex items-center gap-1.5 text-body font-semibold text-accent hover:underline"
                    to="/configuration?tab=impuestos"
                  >
                    Configurar impuestos y vigencias
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
                <Button onClick={nextStep} type="button" variant="ghost">
                  Hacerlo después
                </Button>
                <Button onClick={nextStep} type="button">
                  Guardar y seguir
                </Button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="mt-8 space-y-6">
              <div>
                <h2 className="text-page font-bold tracking-tight text-ink">
                  Personas con acceso
                </h2>
                <p className="mt-1 text-body text-ink-muted">
                  Crea usuarios para el vendedor, el encargado del taller o
                  administradores. Cada rol ve solo lo que corresponde a su
                  negocio.
                </p>
              </div>
              <div className="rounded-card border border-line bg-surface p-5">
                <p className="text-body text-ink-muted">
                  Puedes crear cuentas ahora o invitar al equipo más tarde desde
                  la pestaña <strong>Personas con acceso</strong> en Ajustes.
                </p>
                <div className="mt-4">
                  <Link
                    className="ui-button inline-flex min-h-10 items-center gap-2 rounded-control border border-ink px-4 text-body font-semibold text-ink hover:bg-ink hover:text-white"
                    to="/users"
                  >
                    Gestionar personas con acceso
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
                <Button onClick={nextStep} type="button" variant="ghost">
                  Hacerlo después
                </Button>
                <Button onClick={nextStep} type="button">
                  Guardar y seguir
                </Button>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="mt-8 space-y-6">
              <div className="flex items-start gap-3.5">
                <CheckCircle
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-success"
                  size={32}
                  weight="fill"
                />
                <div>
                  <h2 className="text-page font-bold tracking-tight text-ink">
                    Listo para trabajar
                  </h2>
                  <p className="mt-1 text-body text-ink-muted">
                    Ya puedes registrar mantenimientos, ventas y clientes. Si
                    quedó algún dato fiscal pendiente, lo verás en Ajustes.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={() => void navigate('/')} type="button">
                  Ir al inicio
                </Button>
                <Button
                  onClick={() => void navigate('/settings')}
                  type="button"
                  variant="secondary"
                >
                  Ir a Ajustes
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
