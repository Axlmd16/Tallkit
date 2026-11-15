import {
  DotsThreeVertical,
  Gear,
  MagnifyingGlass,
  Trash,
} from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

import {
  BusinessMark,
  Button,
  Checkbox,
  Combobox,
  DataTable,
  DateControl,
  Dialog,
  DocumentSheet,
  DetailCard,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Field,
  FactList,
  FactRow,
  FiscalScopeBadge,
  ForbiddenState,
  FormModal,
  GaugeMotif,
  IconButton,
  InlineNotice,
  Input,
  MasterDetail,
  MiniBarChart,
  Money,
  NoResultsState,
  Pagination,
  PartCode,
  PlateTag,
  RucPlate,
  ScopeLabel,
  SearchInput,
  SectionNav,
  SegmentedControl,
  Select,
  SkeletonRows,
  StatGrid,
  StatLink,
  StatusBadge,
  StockIndicator,
  AdvancedInfo,
  Tabs,
  Textarea,
  ToastProvider,
  useToast,
  type ComboboxOption,
  type ComboboxResults,
} from '@/shared/ui'
import { CashToday } from '@/pages/home/CashToday'
import { CounterHero } from '@/pages/home/CounterHero'
import { QualificationBanner } from '@/pages/home/QualificationBanner'

/** Datos de ejemplo fijos: el catálogo no consulta la API ni guarda nada. */
const SAMPLE_ROWS = [
  {
    id: 'COM-VEN-000131',
    customer: 'Andrés Paredes',
    state: 'Confirmada',
    total: '133.40',
  },
  {
    id: 'COM-VEN-000130',
    customer: 'Talleres Loja Cía. Ltda.',
    state: 'Pendiente',
    total: '412.85',
  },
  { id: 'Borrador', customer: 'Lucía Guamán', state: 'Borrador', total: null },
]

const PRODUCTS: ComboboxOption[] = [
  {
    id: 1,
    label: 'FLT-0915 — Filtro de aceite Toyota',
    detail: 'Precio final USD 8.05',
  },
  {
    id: 2,
    label: 'PST-2231 — Pastillas de freno delanteras',
    detail: 'Precio final USD 43.70',
  },
  { id: 3, label: 'OLD-0001 — Bujía descontinuada', inactive: true },
]

function useSampleProducts(term: string): ComboboxResults {
  const needle = term.toLowerCase()
  return {
    isPending: false,
    isError: false,
    data: {
      totalPages: 1,
      options: PRODUCTS.filter((option) =>
        option.label.toLowerCase().includes(needle),
      ),
    },
  }
}

function Row({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-micro font-semibold tracking-wider text-ink-muted uppercase">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const SWATCHES = [
  ['canvas', 'Lienzo'],
  ['surface', 'Superficie'],
  ['surface-subtle', 'Cabecera'],
  ['line', 'Línea'],
  ['ink', 'Tinta'],
  ['ink-muted', 'Tinta de apoyo'],
  ['graphite', 'Grafito'],
  ['graphite-raised', 'Grafito elevado'],
  ['primary', 'Cobre'],
  ['primary-soft', 'Cobre suave'],
  ['accent', 'Enlaces y foco'],
  ['scope-artisan', 'Negocio de servicios'],
  ['scope-commercial', 'Negocio de repuestos'],
]

function ColorPreview() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SWATCHES.map(([token, name]) => (
        <div key={token}>
          <div
            className="h-12 rounded-control border border-line"
            style={{ background: `var(--color-${token})` }}
          />
          <p className="mt-1 text-label font-semibold">{name}</p>
          <p className="code text-label text-ink-muted">{token}</p>
        </div>
      ))}
    </div>
  )
}

function TypePreview() {
  return (
    <div className="space-y-2">
      <p className="text-page font-bold">Nueva venta</p>
      <p className="text-block font-bold">Datos de la venta</p>
      <p className="text-figure font-light">USD 1,240.30</p>
      <p className="text-body font-semibold">Detalle de la venta</p>
      <p className="text-body">
        El precio final y el impuesto vienen del catálogo.
      </p>
      <p className="text-label font-semibold">Condición de venta</p>
      <p className="code text-label">
        COM-VEN-000131 · FLT-0915 · 1790012345001
      </p>
    </div>
  )
}

function ButtonsPreview() {
  return (
    <div className="space-y-4">
      <Row label="Variantes">
        <Button>Guardar producto</Button>
        <Button variant="secondary">Guardar borrador</Button>
        <Button variant="quiet">Ver detalle</Button>
        <Button variant="soft">Agregar servicio</Button>
        <Button variant="danger">Desactivar</Button>
        <Button variant="danger-solid">Anular venta</Button>
      </Row>
      <Row label="Estados">
        <IconButton icon={<Trash size={18} />} label="Quitar línea" />
        <Button disabled>Deshabilitado</Button>
        <Button pending pendingLabel="Guardando…">
          Guardar
        </Button>
      </Row>
    </div>
  )
}

function FieldsPreview() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field hint="Único en el catálogo." id="cat-code" label="Código interno">
        <Input className="code" defaultValue="FLT-0915" />
      </Field>
      <Field id="cat-search" label="Buscar en la lista">
        <SearchInput placeholder="Placa, nombre o código" variant="underline" />
      </Field>
      <Field
        error="La cantidad debe ser un entero positivo."
        id="cat-qty"
        label="Cantidad"
      >
        <Input defaultValue="1.5" inputMode="numeric" />
      </Field>
      <Field id="cat-unit" label="Unidad de medida">
        <Select defaultValue="u">
          <option value="u">Unidad (u)</option>
          <option value="gal">Galón (gal)</option>
        </Select>
      </Field>
      <Field id="cat-date" label="Fecha del documento">
        <DateControl defaultValue="2026-09-21" />
      </Field>
      <Field id="cat-notes" label="Notas">
        <Textarea defaultValue="Rosca 3/4-16 UNF." rows={2} />
      </Field>
      <Checkbox label="Es un kit comprado completo" />
    </div>
  )
}

function SegmentsPreview() {
  const [condition, setCondition] = useState('CONTADO')
  const [tab, setTab] = useState('mantenimientos')
  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label="Condición de venta"
        onChange={setCondition}
        options={[
          { value: 'CONTADO', label: 'Contado' },
          { value: 'CREDITO', label: 'Crédito' },
        ]}
        value={condition}
      />
      <SegmentedControl
        aria-label="Estado de la lista"
        onChange={setCondition}
        options={[
          { value: 'CONTADO', label: 'Todos', count: 12 },
          { value: 'CREDITO', label: 'Abiertos', count: 5 },
        ]}
        value={condition}
      />
      <Tabs
        activeId={tab}
        aria-label="Secciones del vehículo"
        items={[
          { id: 'mantenimientos', label: 'Mantenimientos', count: 4 },
          { id: 'datos', label: 'Datos técnicos' },
        ]}
        onChange={setTab}
      />
    </div>
  )
}

function ComboboxPreview() {
  const [selected, setSelected] = useState<ComboboxOption | null>(null)
  return (
    <div className="max-w-md">
      <label
        className="mb-1.5 block text-label font-semibold"
        htmlFor="cat-combo"
      >
        Producto
      </label>
      <Combobox
        clearable
        id="cat-combo"
        inactiveHelp="Este producto está inactivo."
        label="Producto"
        onSelect={setSelected}
        selected={selected}
        useOptions={useSampleProducts}
      />
    </div>
  )
}

function TablePreview() {
  return (
    <div>
      <DataTable
        actions={(row) => (
          <IconButton
            icon={<DotsThreeVertical size={18} />}
            label={`Acciones de ${row.id}`}
          />
        )}
        columns={[
          {
            header: 'Número',
            key: 'id',
            priority: 'primary',
            render: (row) => <span className="code">{row.id}</span>,
          },
          { header: 'Cliente', key: 'customer' },
          {
            header: 'Estado',
            key: 'state',
            render: (row) => (
              <StatusBadge
                label={row.state}
                tone={
                  row.state === 'Confirmada'
                    ? 'success'
                    : row.state === 'Pendiente'
                      ? 'warning'
                      : 'neutral'
                }
              />
            ),
          },
          {
            header: 'Total USD',
            key: 'total',
            align: 'end',
            render: (row) => <Money amount={row.total} />,
          },
        ]}
        getRowKey={(row) => row.id}
        label="Ventas de ejemplo"
        rows={SAMPLE_ROWS}
      />
      <Pagination
        onNext={() => undefined}
        onPrevious={() => undefined}
        page={1}
        totalItems={131}
        totalPages={14}
      />
    </div>
  )
}

function BadgesPreview() {
  return (
    <div className="space-y-4">
      <Row label="Estados">
        <StatusBadge label="Borrador" />
        <StatusBadge label="Confirmada" tone="success" />
        <StatusBadge label="Pendiente" tone="warning" />
        <StatusBadge label="Parcial" tone="info" />
        <StatusBadge label="Anulada" tone="danger" />
      </Row>
      <Row label="Ámbito fiscal">
        <FiscalScopeBadge scope="commercial" />
        <FiscalScopeBadge scope="artesanal" />
      </Row>
    </div>
  )
}

function ContentStatesPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EmptyState
        action={<Button>Nuevo proveedor</Button>}
        description="Registre el primero para poder cargar ingresos."
        title="Aún no hay proveedores"
      />
      <NoResultsState
        onClear={() => undefined}
        title="Sin resultados para «bujía iridium»"
      />
      <div className="rounded-panel border border-line bg-surface">
        <SkeletonRows label="Cargando productos…" rows={4} />
      </div>
      <ErrorState
        message="El servidor no respondió. Lo que escribió se conserva."
        onRetry={() => undefined}
        title="No se pudo cargar el inventario"
      />
      <ForbiddenState
        description="Solo el rol Administrador puede verla."
        title="No tiene acceso a la auditoría"
      />
    </div>
  )
}

function NoticesPreview() {
  return (
    <div className="space-y-2">
      <InlineNotice title="Las existencias entran con un ingreso" tone="info" />
      <InlineNotice
        title="Faltan datos: seleccione un cliente"
        tone="warning"
      />
      <InlineNotice title="No se guardó el borrador" tone="danger">
        La venta cambió desde que la abrió.
      </InlineNotice>
      <InlineNotice title="Cambios guardados" tone="success" />
    </div>
  )
}

function WorkshopPiecesPreview() {
  return (
    <div className="space-y-4">
      <Row label="Placa y código">
        <PlateTag plate="PBA-1234" />
        <RucPlate ruc="1140258475001" />
        <PartCode code="FLT-0915" />
      </Row>
      <div
        className="rounded-panel bg-graphite p-3"
        data-variant="Placa sobre fondo oscuro"
      >
        <PlateTag onDark plate="PBA-1234" />
      </div>
      <Row label="Ámbito fiscal">
        <ScopeLabel scope="commercial" />
        <ScopeLabel scope="artesanal" />
      </Row>
      <Row label="Existencias">
        <StockIndicator quantity="24" />
        <StockIndicator quantity="2" />
        <StockIndicator quantity="0" />
      </Row>
      <Row label="Importes">
        <Money amount="133.40" />
        <Money amount={null} />
      </Row>
      <FactList>
        <FactRow label="Razón social">DICISOL</FactRow>
        <FactRow label="RUC">
          <RucPlate ruc="1140258475001" size="sm" />
        </FactRow>
      </FactList>
      <AdvancedInfo>Fuente: ficha técnica SRI 2.34</AdvancedInfo>
    </div>
  )
}

/** Logotipo ficticio del emisor para el catálogo; no es la marca Tallkit ni un logotipo real. */
const SAMPLE_ISSUER_LOGO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64"><rect width="240" height="64" rx="10" fill="#0f4c5c"/><text x="120" y="40" font-family="sans-serif" font-size="22" fill="#fff" text-anchor="middle">EMISOR</text></svg>',
)}`

function SheetPreview() {
  return (
    <div className="grid gap-4 rounded-panel bg-workspace p-4 xl:grid-cols-2">
      {[SAMPLE_ISSUER_LOGO, null].map((logoUrl) => (
        <div className="mx-auto w-full max-w-[560px]" key={String(logoUrl)}>
          <DocumentSheet
            issuer={{ name: 'Repuestos del Valle S.A.', logoUrl }}
            label={
              logoUrl
                ? 'Comprobante de ejemplo con logotipo'
                : 'Comprobante de ejemplo sin logotipo'
            }
            meta={[
              { label: 'Fecha operativa', value: '21/09/2026' },
              { label: 'Condición de venta', value: 'Contado' },
              {
                label: 'Cliente',
                value: 'Andrés Paredes · CI 1712345678',
                wide: true,
              },
            ]}
            notice="Documento interno; no constituye una factura electrónica autorizada por el SRI."
            number={null}
            state="Borrador · Vista previa"
          >
            <p className="py-6 text-center text-ink-muted">
              Líneas del documento
            </p>
          </DocumentSheet>
        </div>
      ))}
    </div>
  )
}

function FormModalPreview() {
  const [open, setOpen] = useState(false)
  const [wide, setWide] = useState(false)
  const [name, setName] = useState('')
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setOpen(true)}>Nueva marca</Button>
      <Button onClick={() => setWide(true)} variant="secondary">
        Modal ancho (600 px)
      </Button>
      <FormModal
        description="Ancho para nombres de catálogo extensos."
        onClose={() => setWide(false)}
        onSave={() => true}
        open={wide}
        saveLabel="Agregar servicio"
        size="wide"
        title="Agregar servicio"
      >
        <Field id="cat-wide-service" label="Servicio del catálogo">
          <Input defaultValue="Alineación y balanceo de las cuatro ruedas con revisión de suspensión" />
        </Field>
      </FormModal>
      <FormModal
        description="Se podrá elegir al registrar vehículos."
        dirty={name !== ''}
        onClose={() => {
          setOpen(false)
          setName('')
        }}
        onSave={() => {
          setName('')
          return true
        }}
        onSaveAndCreateAnother={() => {
          setName('')
          return true
        }}
        open={open}
        saveLabel="Guardar marca"
        title="Nueva marca de vehículo"
      >
        <Field id="cat-brand" label="Nombre de la marca">
          <Input
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
      </FormModal>
    </div>
  )
}

function DialogPreview() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <Button onClick={() => setOpen(true)} variant="danger">
        Anular venta
      </Button>
      <Dialog
        description="Se conservan el número y los valores originales."
        onClose={() => setOpen(false)}
        open={open}
        title="Anular venta"
        tone="danger"
      >
        <Button onClick={() => setOpen(false)} variant="secondary">
          Conservar venta
        </Button>
        <Button onClick={() => setOpen(false)} variant="danger-solid">
          Anular venta
        </Button>
      </Dialog>
    </div>
  )
}

function MenuPreview() {
  return (
    <DropdownMenu
      items={[
        { id: 'ver', label: 'Ver detalle' },
        { id: 'editar', label: 'Editar' },
        { id: 'div', label: '', divider: true },
        { id: 'desactivar', label: 'Desactivar', destructive: true },
      ]}
      trigger={
        <IconButton icon={<DotsThreeVertical size={18} />} label="Acciones" />
      }
    />
  )
}

function ToastTrigger() {
  const toast = useToast()
  const count = useRef(0)
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() =>
          toast.success('Producto ACE-1030 creado.', {
            href: '#',
            linkLabel: 'Ver',
          })
        }
      >
        Crear producto
      </Button>
      <Button
        onClick={() => {
          count.current += 1
          toast.info(`Marca desactivada (${count.current}).`)
        }}
        variant="secondary"
      >
        Aviso informativo
      </Button>
    </div>
  )
}

function ToastPreview() {
  return (
    <ToastProvider>
      <ToastTrigger />
    </ToastProvider>
  )
}

function NavigationPreview() {
  return (
    <div className="space-y-4">
      <div className="flex overflow-hidden rounded-panel border border-line">
        <nav
          aria-label="Navegación de ejemplo"
          className="w-60 space-y-0.5 border-r border-graphite-line bg-graphite p-3 text-body"
        >
          <p className="px-2.5 pb-1 text-micro font-semibold tracking-wider text-graphite-ink uppercase">
            Ventas y cobros
          </p>
          <a
            aria-current="page"
            className="relative flex min-h-11 items-center rounded-control bg-graphite-raised px-2.5 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[2.5px] before:rounded-r-full before:bg-primary"
            href="#"
          >
            Ventas
          </a>
          <a
            className="flex min-h-11 items-center rounded-control px-2.5 text-graphite-ink"
            href="#"
          >
            Cuentas por cobrar
          </a>
          <GaugeMotif className="mx-auto mt-4 h-14 w-28" variant="rail" />
        </nav>
        <div className="flex h-15 flex-1 items-center justify-between border-b border-line bg-surface px-5 text-body">
          <span>
            <span className="text-ink-muted">Ventas y cobros / </span>
            <strong>Ventas</strong>
          </span>
          <FiscalScopeBadge scope="commercial" />
        </div>
      </div>
      <SectionNav
        activeId="entidades"
        aria-label="Secciones de ejemplo"
        items={[
          {
            id: 'entidades',
            label: 'Entidades fiscales',
            href: '#entidades',
            icon: Gear,
            indicator: '2',
          },
          {
            id: 'bodega',
            label: 'Bodega',
            href: '#bodega',
            icon: Gear,
            indicator: '1',
          },
        ]}
        onSelect={() => {}}
      />
    </div>
  )
}

function PatternsPreview() {
  return (
    <div className="space-y-3 rounded-panel bg-canvas p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-page font-bold">Ventas</p>
          <p className="text-body text-ink-muted">
            Ventas directas de repuestos.
          </p>
        </div>
        <Button>Nueva venta</Button>
      </div>
      <div className="flex flex-wrap gap-2 rounded-panel border border-line bg-surface p-3">
        <Input
          aria-label="Buscar ventas"
          className="max-w-xs"
          placeholder="Número o cliente"
        />
        <Button variant="secondary">
          <MagnifyingGlass aria-hidden="true" size={16} />
          Buscar
        </Button>
      </div>
      <TablePreview />
    </div>
  )
}

const SAMPLE_WEEK = [
  { date: '2026-09-30', amount: '120.00' },
  { date: '2026-10-01', amount: '340.50' },
  { date: '2026-10-02', amount: '95.00' },
  { date: '2026-10-03', amount: '0.00' },
  { date: '2026-10-04', amount: '410.00' },
  { date: '2026-10-05', amount: '260.25' },
  { date: '2026-10-06', amount: '180.00' },
]

function StatPreview() {
  return (
    <MemoryRouter>
      <div className="space-y-4">
        <div className="rounded-panel border border-line bg-surface">
          <StatGrid label="Pendientes de ejemplo">
            <StatLink label="Mantenimientos abiertos" to="/" value={4} />
            <StatLink
              label="Ventas de contado sin cobrar"
              scope="commercial"
              to="/"
              value={3}
            />
            <StatLink
              label="Servicios de contado sin cobrar"
              scope="artesanal"
              to="/"
              value={0}
            />
            <StatLink
              amount="1300.50"
              detail="2 clientes"
              label="Por cobrar"
              scope="commercial"
              to="/"
            />
          </StatGrid>
        </div>
        <div className="rounded-panel border border-line bg-surface">
          <SkeletonRows label="Cargando pendientes…" rows={2} />
        </div>
        <ErrorState
          message="El servidor no respondió."
          onRetry={() => undefined}
          title="No se pudieron cargar los pendientes"
        />
      </div>
    </MemoryRouter>
  )
}

function BarsPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-panel border border-line bg-surface">
        <MiniBarChart
          days={SAMPLE_WEEK}
          scope="commercial"
          title="Cobrado en 7 días"
          total="1405.75"
        />
      </div>
      <div className="rounded-panel border border-line bg-surface">
        <MiniBarChart
          days={SAMPLE_WEEK.map((day, index) => ({
            ...day,
            amount: index % 2 ? '60.00' : '25.00',
          }))}
          scope="artesanal"
          title="Cobrado en 7 días"
          total="280.00"
        />
      </div>
      <div className="rounded-panel border border-line bg-surface">
        <MiniBarChart
          days={SAMPLE_WEEK.map((day) => ({ ...day, amount: '0.00' }))}
          scope="commercial"
          title="Semana en cero"
          total="0.00"
        />
      </div>
      <div className="rounded-panel border border-line bg-surface">
        <MiniBarChart
          days={[]}
          scope="artesanal"
          title="Sin datos"
          total={null}
        />
      </div>
      <div className="rounded-panel border border-line bg-surface">
        <SkeletonRows label="Cargando cobros…" rows={2} />
      </div>
      <ErrorState
        message="El servidor no respondió."
        onRetry={() => undefined}
        title="No se pudieron cargar los cobros"
      />
    </div>
  )
}

const loaded = <T,>(data: T) => ({
  isPending: false,
  isError: false,
  data,
  refetch: () => undefined,
})

function HomePreview() {
  return (
    <MemoryRouter>
      <div className="space-y-4">
        <CounterHero
          aside={
            <CashToday
              query={loaded({
                timezone: 'America/Guayaquil',
                items: [
                  { scope: 'artisan', total: '280.00', days: SAMPLE_WEEK },
                  { scope: 'commercial', total: '1405.75', days: SAMPLE_WEEK },
                ],
              })}
            />
          }
          onNewMaintenance={() => undefined}
          quickSaleTo="/sales/new"
          searchTarget="/maintenance"
        />
        <QualificationBanner
          query={loaded({
            qualification: {
              entity_id: 2,
              expires_on: '2026-11-20',
              days_left: 45,
              expired: false,
            },
            items: [],
          })}
        />
      </div>
    </MemoryRouter>
  )
}

function GaugePreview() {
  return (
    <div className="flex flex-wrap gap-4">
      <div
        className="rounded-panel bg-graphite p-4"
        data-variant="Barra lateral"
      >
        <GaugeMotif className="h-16 w-32" variant="rail" />
      </div>
      <DetailCard
        className="w-72"
        subtitle="Toyota Hilux · 2018"
        title="PBA-1234"
        variant="dark"
      />
    </div>
  )
}

function BusinessMarkPreview() {
  const workshop = 'Transmisiones y Embragues Jimenez'
  const store = 'Transmisiones y Embragues Jimenez Repuestos Automotrices'
  return (
    <div className="space-y-4">
      <Row label="Iniciales del taller">
        <BusinessMark name={workshop} scope="artesanal" size="lg" />
        <BusinessMark name={workshop} scope="artesanal" />
        <BusinessMark name={workshop} scope="artesanal" size="sm" />
      </Row>
      <Row label="Iniciales del almacén">
        <BusinessMark name={store} scope="commercial" size="lg" />
        <BusinessMark name={store} scope="commercial" />
        <BusinessMark name={store} scope="commercial" size="sm" />
      </Row>
      <Row label="Con logotipo">
        <BusinessMark
          logoUrl={SAMPLE_ISSUER_LOGO}
          name={workshop}
          scope="artesanal"
          size="lg"
        />
      </Row>
    </div>
  )
}

const MASTER_SAMPLE = [
  { id: 'c1', name: 'Alvarado Mena, Luis', vehicles: 2 },
  { id: 'c2', name: 'Andrade Torres, Rosa', vehicles: 1 },
  { id: 'c3', name: 'Bravo Ortiz, Carlos', vehicles: 3 },
]

function MasterDetailPreview() {
  const [selected, setSelected] = useState<string | null>('c1')
  const [term, setTerm] = useState('')
  const visible = MASTER_SAMPLE.filter((customer) =>
    customer.name.toLowerCase().includes(term.trim().toLowerCase()),
  )
  return (
    <MasterDetail
      detailLabel="Vista previa del cliente"
      getGroup={(customer) => customer.name[0] ?? ''}
      getKey={(customer) => customer.id}
      items={visible}
      listLabel="Clientes de ejemplo"
      onSelect={setSelected}
      renderDetail={(customer) => (
        <div className="space-y-1">
          <p className="text-block font-bold">{customer.name}</p>
          <p className="text-body text-ink-muted">
            {customer.vehicles} vehículos registrados
          </p>
        </div>
      )}
      renderItem={(customer) => (
        <span className="font-semibold">{customer.name}</span>
      )}
      selectedKey={selected}
      toolbar={
        <SearchInput
          aria-label="Buscar cliente"
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar cliente"
          value={term}
          variant="underline"
        />
      }
    />
  )
}

export const PREVIEWS: Record<string, () => ReactNode> = {
  'TK-01': ColorPreview,
  'TK-02': TypePreview,
  'TK-03': ButtonsPreview,
  'TK-04': FieldsPreview,
  'TK-05': SegmentsPreview,
  'TK-06': ComboboxPreview,
  'TK-07': TablePreview,
  'TK-08': BadgesPreview,
  'TK-09': ContentStatesPreview,
  'TK-10': NoticesPreview,
  'TK-11': WorkshopPiecesPreview,
  'TK-12': SheetPreview,
  'TK-13': FormModalPreview,
  'TK-14': DialogPreview,
  'TK-15': MenuPreview,
  'TK-16': ToastPreview,
  'TK-17': NavigationPreview,
  'TK-18': PatternsPreview,
  'TK-19': StatPreview,
  'TK-20': BarsPreview,
  'TK-21': HomePreview,
  'TK-22': GaugePreview,
  'TK-23': BusinessMarkPreview,
  'TK-24': MasterDetailPreview,
}
