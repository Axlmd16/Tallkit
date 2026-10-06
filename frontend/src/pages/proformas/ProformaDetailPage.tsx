import {
  ArrowLeft,
  ArrowsClockwise,
  CopySimple,
  NotePencil,
  Printer,
  Prohibit,
  Warning,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { ConvertDialog } from '@/features/proformas/ConvertDialog'
import {
  documentDate,
  ProformaStateBadge,
  usd,
} from '@/features/proformas/format'
import { useProforma, useProformaMutations } from '@/features/proformas/hooks'
import { IssueDialog } from '@/features/proformas/IssueDialog'
import {
  proformaStateLabels,
  type Proforma,
  type ProformaReference,
} from '@/features/proformas/types'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  ConfirmationPanel,
  FactList,
  FactRow,
  InlineNotice,
  LoadingState,
  Money,
  Tabs,
  Tooltip,
  useToast,
} from '@/shared/ui'

function ReferenceLink({ reference }: { reference: ProformaReference }) {
  return (
    <Link
      className="font-semibold text-accent hover:underline"
      to={`/proformas/${reference.id}`}
    >
      <span className="font-mono">{reference.number ?? 'Borrador'}</span> ·{' '}
      {proformaStateLabels[reference.state]}
    </Link>
  )
}

function Lines({ proforma }: { proforma: Proforma }) {
  const issued = Boolean(proforma.internal_number)
  return (
    <div>
      {/* Región desplazable accesible con teclado en pantallas estrechas. */}
      <div
        aria-label="Productos de la proforma"
        className="overflow-x-auto"
        role="region"
        tabIndex={0}
      >
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Productos de la proforma</caption>
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="py-2 pr-3 font-semibold" scope="col">
                Producto
              </th>
              <th className="px-2 py-2 text-right font-semibold" scope="col">
                Cantidad
              </th>
              <th className="px-2 py-2 text-right font-semibold" scope="col">
                {issued ? 'Disponible al emitir' : 'Disponible'}
              </th>
              <th className="px-2 py-2 text-right font-semibold" scope="col">
                Precio final
              </th>
              <th className="py-2 pl-2 text-right font-semibold" scope="col">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {proforma.lines.length === 0 && (
              <tr>
                <td className="py-4 text-ink-muted" colSpan={5}>
                  Sin productos.
                </td>
              </tr>
            )}
            {proforma.lines.map((line) => (
              <tr className="border-t border-line" key={line.position}>
                <th className="py-2.5 pr-3 text-left font-normal" scope="row">
                  <span className="font-mono">{line.product_code}</span>{' '}
                  {line.product_name}
                  {line.product_active === false && (
                    <span className="ml-2 text-xs font-semibold text-danger">
                      Inactivo
                    </span>
                  )}
                </th>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {line.quantity}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-1">
                    {!line.availability_sufficient && (
                      <Tooltip
                        content="Disponibilidad insuficiente; la proforma no reserva unidades."
                        position="top"
                      >
                        <Warning
                          aria-label="Disponibilidad insuficiente"
                          className="text-warning"
                          size={16}
                          weight="fill"
                        />
                      </Tooltip>
                    )}
                    {line.availability_at_issue ?? line.availability ?? '—'}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  <Money amount={line.unit_price} />
                </td>
                <td className="py-2.5 pl-2 text-right font-semibold tabular-nums">
                  <Money amount={line.total_amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 ml-auto grid max-w-[280px] grid-cols-2 gap-1 text-sm">
        <dt className="text-ink-muted">Base imponible</dt>
        <dd className="text-right tabular-nums">
          {proforma.totals?.base ? usd(proforma.totals.base) : '—'}
        </dd>
        <dt className="text-ink-muted">Impuesto</dt>
        <dd className="text-right tabular-nums">
          {proforma.totals?.tax ? usd(proforma.totals.tax) : '—'}
        </dd>
        <dt className="font-bold">Total</dt>
        <dd className="text-right font-bold tabular-nums">
          {proforma.totals?.total ? usd(proforma.totals.total) : '—'}
        </dd>
      </dl>
    </div>
  )
}

function Related({ proforma }: { proforma: Proforma }) {
  const sale = proforma.sale
  return (
    <FactList>
      <FactRow label="Proforma anterior">
        {proforma.origin ? (
          <ReferenceLink reference={proforma.origin} />
        ) : (
          <span className="text-ink-muted">Ninguna</span>
        )}
      </FactRow>
      <FactRow label="Nuevas proformas">
        {proforma.derived.length === 0 ? (
          <span className="text-ink-muted">Ninguna</span>
        ) : (
          <ul className="space-y-1">
            {proforma.derived.map((item) => (
              <li key={item.id}>
                <ReferenceLink reference={item} />
              </li>
            ))}
          </ul>
        )}
      </FactRow>
      <FactRow label="Venta generada">
        {!sale ? (
          <span className="text-ink-muted">Ninguna</span>
        ) : sale.can_open ? (
          <Link
            className="font-semibold text-accent hover:underline"
            to={`/sales/${sale.id}`}
          >
            <span className="font-mono">
              {sale.internal_number ?? 'Venta en borrador'}
            </span>
          </Link>
        ) : (
          <span className="font-mono">
            {sale.internal_number ?? 'Venta en borrador'}
          </span>
        )}
      </FactRow>
    </FactList>
  )
}

/**
 * Ficha de la proforma. Las acciones provienen de `allowed_actions`, que el servidor calcula
 * según estado y permisos; aquí solo se presentan. Copiar, anular y convertir conservan la
 * clave del intento ante una respuesta incierta, de modo que un reintento no duplica nada.
 */
export function ProformaDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const query = useProforma(Number.isFinite(id) ? id : null)
  const mutations = useProformaMutations()
  const copyTracker = useIntentTracker()
  const voidTracker = useIntentTracker()
  const [tab, setTab] = useState('lines')
  const [dialog, setDialog] = useState<'issue' | 'convert' | 'void' | null>(
    null,
  )
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [busy, setBusy] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const inFlight = useRef(false)

  if (query.isPending) return <LoadingState label="Cargando proforma…" />
  if (query.isError || !query.data) {
    return (
      <InlineNotice title="No se pudo cargar la proforma" tone="danger">
        Compruebe que existe y que tiene permiso para consultarla.{' '}
        <Link
          className="font-semibold text-accent hover:underline"
          to="/proformas"
        >
          Volver a proformas
        </Link>
      </InlineNotice>
    )
  }
  const proforma = query.data
  const can = (action: Proforma['allowed_actions'][number]) =>
    proforma.allowed_actions.includes(action)
  const from = (location.state as { from?: string } | null)?.from ?? ''

  // Candado síncrono: un doble clic llega antes de que React vuelva a pintar el botón.
  async function run(
    action: () => Promise<Proforma>,
    done: (result: Proforma) => void,
    options: { leaves?: boolean } = {},
  ) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setProblem(null)
    try {
      done(await action())
      // Si la acción navega fuera de la ficha, el candado se conserva hasta desmontar.
      if (!options.leaves) inFlight.current = false
    } catch (error) {
      inFlight.current = false
      setProblem(describeProblem(error))
    } finally {
      setBusy(false)
    }
  }

  const copy = () =>
    run(
      () =>
        copyTracker.run({ id: proforma.id, action: 'copy' }, (key) =>
          mutations.copy.mutateAsync({ id: proforma.id, key }),
        ),
      (created) => {
        toast.success('Nueva proforma creada con valores actuales.')
        navigate(`/proformas/${created.id}/edit`)
      },
      { leaves: true },
    )

  const voidOffer = () =>
    run(
      () =>
        voidTracker.run(
          { id: proforma.id, action: 'void', version: proforma.version },
          (key) =>
            mutations.void.mutateAsync({
              id: proforma.id,
              expectedVersion: proforma.version,
              key,
            }),
        ),
      () => {
        setDialog(null)
        toast.success('Proforma anulada.')
      },
    )

  return (
    <div className="catalog-page space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          aria-label="Volver a proformas"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver a proformas"
          to={`/proformas${from}`}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted">Proforma</p>
          <h1 className="flex flex-wrap items-center gap-3 text-[22px] leading-7 font-semibold text-ink">
            <span className="font-mono">
              {proforma.internal_number ?? 'Sin número'}
            </span>
            <ProformaStateBadge state={proforma.state} />
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can('edit') && (
            <Button
              onClick={() => navigate(`/proformas/${proforma.id}/edit`)}
              type="button"
              variant="secondary"
            >
              <NotePencil aria-hidden="true" size={16} />
              Editar
            </Button>
          )}
          {can('print') && (
            <Button
              onClick={() => navigate(`/proformas/${proforma.id}/document`)}
              type="button"
              variant="secondary"
            >
              <Printer aria-hidden="true" size={16} />
              Imprimir
            </Button>
          )}
          {can('copy') && (
            <Button
              disabled={busy}
              onClick={() => void copy()}
              type="button"
              variant="secondary"
            >
              <CopySimple aria-hidden="true" size={16} />
              Nueva vinculada
            </Button>
          )}
          {can('void') && (
            <Button
              onClick={() => setDialog('void')}
              type="button"
              variant="secondary"
            >
              <Prohibit aria-hidden="true" size={16} />
              Anular
            </Button>
          )}
          {can('issue') && (
            <Button
              onClick={() => setDialog('issue')}
              ref={trigger}
              type="button"
            >
              Revisar y emitir
            </Button>
          )}
          {can('convert') && (
            <Button
              onClick={() => setDialog('convert')}
              ref={trigger}
              type="button"
            >
              <ArrowsClockwise aria-hidden="true" size={16} />
              Convertir en venta
            </Button>
          )}
        </div>
      </div>
      {problem && (
        <InlineNotice
          title={
            problem.uncertain
              ? 'No sabemos si la acción se aplicó'
              : 'No se completó la acción'
          }
          tone="danger"
        >
          {problem.message}
        </InlineNotice>
      )}
      <section className="rounded-panel border border-line bg-surface p-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-muted">Cliente</dt>
            <dd className="font-medium text-ink">{proforma.customer.name}</dd>
            <dd className="text-[13px] text-ink-muted">
              {proforma.customer.identification_type}{' '}
              {proforma.customer.identification}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Emisión</dt>
            <dd className="font-medium text-ink">
              {proforma.issue_date ? documentDate(proforma.issue_date) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Vigente hasta</dt>
            <dd className="font-medium text-ink">
              {proforma.valid_until
                ? documentDate(proforma.valid_until)
                : proforma.suggested_valid_until
                  ? `${documentDate(proforma.suggested_valid_until)} (7 días)`
                  : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Total USD</dt>
            <dd className="text-xl font-bold text-ink tabular-nums">
              <Money amount={proforma.totals?.total ?? null} />
            </dd>
          </div>
        </dl>
      </section>
      <section className="rounded-panel border border-line bg-surface p-4">
        <Tabs
          activeId={tab}
          aria-label="Secciones de la proforma"
          items={[
            {
              id: 'lines',
              label: 'Productos',
              count: proforma.lines.length,
              content: <Lines proforma={proforma} />,
            },
            {
              id: 'related',
              label: 'Relacionadas',
              count:
                proforma.derived.length +
                (proforma.origin ? 1 : 0) +
                (proforma.sale ? 1 : 0),
              content: <Related proforma={proforma} />,
            },
          ]}
          onChange={setTab}
        />
      </section>
      <ConfirmationPanel
        confirmLabel={busy ? 'Anulando…' : 'Anular proforma'}
        description="Conserva el número y el contenido. No se podrá convertir ni reactivar; puede crear una nueva vinculada."
        onCancel={() => setDialog(null)}
        onConfirm={() => void voidOffer()}
        open={dialog === 'void'}
        title="¿Anular esta proforma?"
        tone="danger"
      />
      <IssueDialog
        onClose={() => setDialog(null)}
        onIssued={(issued) => {
          setDialog(null)
          toast.success(`Proforma ${issued.internal_number} emitida.`, {
            href: `/proformas/${issued.id}/document`,
            linkLabel: 'Imprimir',
          })
        }}
        open={dialog === 'issue'}
        proforma={proforma}
        returnFocusRef={trigger}
      />
      <ConvertDialog
        onClose={() => setDialog(null)}
        onConverted={(converted) => {
          setDialog(null)
          toast.success('Venta en borrador creada.')
          if (converted.sale?.can_open) navigate(`/sales/${converted.sale.id}`)
        }}
        open={dialog === 'convert'}
        proforma={proforma}
        returnFocusRef={trigger}
      />
    </div>
  )
}
