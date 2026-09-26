import {
  DotsThreeVertical,
  Gear,
  MagnifyingGlass,
  Trash,
} from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'

import {
  Button,
  Checkbox,
  Combobox,
  DataTable,
  DateControl,
  Dialog,
  DocumentSheet,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Field,
  FactList,
  FactRow,
  FiscalScopeBadge,
  ForbiddenState,
  FormModal,
  IconButton,
  InlineNotice,
  Input,
  Money,
  NoResultsState,
  Pagination,
  PartCode,
  PlateTag,
  RucPlate,
  ScopeLabel,
  SectionNav,
  SegmentedControl,
  Select,
  SkeletonRows,
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
      <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
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
  ['ink-muted', 'Tinta secundaria'],
  ['primary', 'Azul Tallkit'],
  ['accent', 'Petróleo'],
  ['accent-soft', 'Petróleo suave'],
  ['brand', 'Naranja del logotipo'],
  ['scope-commercial-soft', 'RUC comercial'],
  ['scope-artisan-soft', 'RUC artesanal'],
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
          <p className="mt-1 text-[12.5px] font-semibold">{name}</p>
          <p className="font-mono text-xs text-ink-muted">{token}</p>
        </div>
      ))}
    </div>
  )
}

function TypePreview() {
  return (
    <div className="space-y-2">
      <p className="text-[22px] leading-7 font-semibold">Nueva venta</p>
      <p className="text-[14.5px] font-semibold">Datos de la venta</p>
      <p className="text-[13.5px]">
        El precio final y el impuesto vienen del catálogo.
      </p>
      <p className="text-xs font-semibold">Condición de venta</p>
      <p className="font-mono text-[12.5px]">
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
        <Input className="font-mono" defaultValue="FLT-0915" />
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
      <label className="mb-1.5 block text-xs font-semibold" htmlFor="cat-combo">
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
            render: (row) => <span className="font-mono">{row.id}</span>,
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

function SheetPreview() {
  return (
    <div className="rounded-panel bg-workspace p-4">
      <div className="mx-auto max-w-[560px]">
        <DocumentSheet
          label="Comprobante de ejemplo"
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
          className="w-60 space-y-0.5 border-r border-line bg-surface p-3 text-[13.5px]"
        >
          <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            Ventas y cobros
          </p>
          <a
            aria-current="page"
            className="flex min-h-11 items-center rounded-control bg-accent-soft px-2.5 font-semibold text-accent-strong"
            href="#"
          >
            Ventas
          </a>
          <a
            className="flex min-h-11 items-center rounded-control px-2.5 text-ink-muted"
            href="#"
          >
            Cuentas por cobrar
          </a>
        </nav>
        <div className="flex h-15 flex-1 items-center justify-between border-b border-line bg-surface px-5 text-[13px]">
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
          <p className="text-[22px] leading-7 font-semibold">Ventas</p>
          <p className="text-[13px] text-ink-muted">
            Ventas directas de repuestos del RUC comercial.
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
}
