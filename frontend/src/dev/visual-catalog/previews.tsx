import { useRef, useState, type Key, type ReactNode } from 'react'

import { Button, ButtonGroup, IconButton } from '@/shared/ui/actions'
import { DataList, DataTable, Pagination, RowActions } from '@/shared/ui/data'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  SuccessState,
} from '@/shared/ui/feedback'
import {
  Checkbox,
  DateControl,
  Field,
  FieldError,
  Input,
  PasswordInput,
  SearchInput,
  Select,
  Textarea,
} from '@/shared/ui/forms'
import { Icon, ICON_MAP, type IconName } from '@/shared/ui/icons'
import {
  AppFrame,
  AuthLayout,
  DashboardLayout,
  FilterPanel,
  FormLayout,
  MasterDetailLayout,
  PageHeader,
  PreviewLayout,
  Toolbar,
} from '@/shared/ui/layout'
import { Avatar, AvatarGroup, MediaSlot } from '@/shared/ui/media'
import {
  NavigationItem,
  SegmentedControl,
  Sidebar,
  Tabs,
} from '@/shared/ui/navigation'
import { Drawer } from '@/shared/ui/Drawer'
import {
  ConfirmationPanel,
  DetailPanel,
  DropdownMenu,
  Modal,
  Tooltip,
} from '@/shared/ui/overlays'
import { StatusBadge } from '@/shared/ui/states'
import { DetailCard, Divider, MetricCard, Surface } from '@/shared/ui/surfaces'
import {
  BarChart,
  ChartContainer,
  ChartLegend,
  DonutChart,
  LineAreaChart,
} from '@/shared/ui/charts'
import { Progress } from '@/shared/ui/data'
import {
  CalendarToolbar,
  DayCalendar,
  MiniCalendar,
  MonthCalendar,
  YearCalendar,
  type CalendarEventItem,
  type CalendarView,
  type DayCalendarEvent,
} from '@/shared/ui/calendar'
import { Timeline, type TimelineRow } from '@/shared/ui/timeline'
import { Board, type BoardColumn } from '@/shared/ui/board'
import {
  ConversationList,
  MessageBubble,
  MessageComposer,
  type ConversationItem,
} from '@/shared/ui/conversation'

function SegmentedControlPreview() {
  const [period, setPeriod] = useState('week')
  const [status, setStatus] = useState('active')

  return (
    <div className="space-y-6 w-full max-w-xl" data-testid="preview-c14">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Selección de periodo con acento violeta (F12 4:6195)
        </h4>
        <SegmentedControl
          accent="violet"
          aria-label="Periodo de elementos"
          onChange={setPeriod}
          options={[
            { value: 'day', label: 'Día' },
            { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mes' },
          ]}
          value={period}
        />
      </div>
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Filtro de estado con acento coral (F06 4:2258)
        </h4>
        <SegmentedControl
          accent="coral"
          aria-label="Estado de elementos"
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Activos' },
            { value: 'archived', label: 'Archivados', disabled: true },
          ]}
          value={status}
        />
      </div>
    </div>
  )
}

function TabsPreview() {
  const [lineTab, setLineTab] = useState('board')
  const [pillTab, setPillTab] = useState('active')

  return (
    <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c15">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Pestañas estilo línea con contadores (F13 4:6443)
        </h4>
        <div className="p-4 rounded-group bg-surface border border-line">
          <Tabs
            activeId={lineTab}
            aria-label="Vistas de elementos sintéticos"
            items={[
              {
                id: 'list',
                label: 'Lista',
                count: 18,
                content: (
                  <p className="text-sm text-ink-muted p-2">
                    Vista detallada de elementos sintéticos en formato lista.
                  </p>
                ),
              },
              {
                id: 'board',
                label: 'Tablero',
                count: 5,
                content: (
                  <p className="text-sm text-ink-muted p-2">
                    Vista en columnas por etapa neutral.
                  </p>
                ),
              },
              {
                id: 'timeline',
                label: 'Cronograma',
                content: (
                  <p className="text-sm text-ink-muted p-2">
                    Distribución temporal de bloques sintéticos.
                  </p>
                ),
              },
            ]}
            onChange={setLineTab}
            variant="line"
          />
        </div>
      </div>
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Pestañas estilo píldora (F22 4:7590)
        </h4>
        <div className="p-4 rounded-group bg-surface border border-line">
          <Tabs
            activeId={pillTab}
            aria-label="Categorías de elementos"
            items={[
              {
                id: 'all',
                label: 'Todos los ítems',
                content: (
                  <p className="text-sm text-ink-muted p-2">
                    Conjunto general de elementos sintéticos.
                  </p>
                ),
              },
              {
                id: 'active',
                label: 'En existencia',
                count: 42,
                content: (
                  <p className="text-sm text-ink-muted p-2">
                    Elementos disponibles en el ejemplo local.
                  </p>
                ),
              },
              {
                id: 'low',
                label: 'Bajo stock',
                count: 3,
                content: (
                  <p className="text-sm text-ink-muted p-2">
                    Elementos con indicador neutral de nivel bajo.
                  </p>
                ),
              },
            ]}
            onChange={setPillTab}
            variant="pill"
          />
        </div>
      </div>
    </div>
  )
}

function DataTablePreview() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['ROW-001'])
  const [sortColumn, setSortColumn] = useState<string>('code')
  const [sortDirection, setSortDirection] = useState<
    'ascending' | 'descending' | 'none'
  >('ascending')

  const rows = [
    {
      id: 'ROW-001',
      code: 'ITEM-001',
      customer: 'Elemento Alfa',
      plate: 'REF-A',
      status: 'En proceso',
      tech: 'Grupo A',
    },
    {
      id: 'ROW-002',
      code: 'ITEM-002',
      customer: 'Elemento Beta',
      plate: 'REF-B',
      status: 'Pendiente',
      tech: 'Grupo B',
    },
    {
      id: 'ROW-003',
      code: 'ITEM-003',
      customer: 'Elemento Gamma',
      plate: 'REF-C',
      status: 'Finalizado',
      tech: 'Grupo C',
    },
  ]

  const handleSelectRow = (key: Key, selected: boolean) => {
    setSelectedKeys((prev) =>
      selected ? [...prev, String(key)] : prev.filter((k) => k !== String(key)),
    )
  }

  const handleSelectAll = (selected: boolean) => {
    setSelectedKeys(selected ? rows.map((r) => r.id) : [])
  }

  const handleSort = (
    columnKey: string,
    nextDirection: 'ascending' | 'descending' | 'none',
  ) => {
    setSortColumn(columnKey)
    setSortDirection(nextDirection)
  }

  return (
    <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c34">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Tabla flotante con selección, orden y altura 70px (F03 4:661 / 4:964)
        </h4>
        <DataTable
          actions={(row) => (
            <Button size="40" variant="secondary">
              Ver {row.code}
            </Button>
          )}
          columns={[
            {
              header: 'Código',
              key: 'code',
              priority: 'primary',
              sortable: true,
            },
            {
              header: 'Elemento',
              key: 'customer',
              priority: 'primary',
              sortable: true,
            },
            { header: 'Referencia', key: 'plate', priority: 'secondary' },
            {
              header: 'Estado',
              key: 'status',
              priority: 'secondary',
              render: (row) => (
                <StatusBadge
                  label={row.status}
                  tone={
                    row.status === 'Finalizado'
                      ? 'success'
                      : row.status === 'Pendiente'
                        ? 'warning'
                        : 'info'
                  }
                />
              ),
            },
            { header: 'Grupo', key: 'tech', priority: 'secondary' },
          ]}
          getRowKey={(row) => row.id}
          label="Elementos sintéticos"
          onSelectAll={handleSelectAll}
          onSelectRow={handleSelectRow}
          onSort={handleSort}
          rowHeight="70"
          rows={rows}
          selectedKeys={selectedKeys}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
        />
      </div>

      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Tabla contenida con bordes continuos y altura 60px (F09 4:4325 / F07
          4:3086)
        </h4>
        <DataTable
          columns={[
            { header: 'Código', key: 'code', priority: 'primary' },
            { header: 'Elemento', key: 'customer', priority: 'primary' },
            { header: 'Referencia', key: 'plate', priority: 'secondary' },
            { header: 'Grupo', key: 'tech', priority: 'secondary' },
          ]}
          getRowKey={(row) => row.id}
          label="Historial sintético"
          rowHeight="60"
          rows={rows}
          variant="contained"
        />
      </div>
    </div>
  )
}

function PaginationPreview() {
  const [page, setPage] = useState(2)

  return (
    <div className="space-y-6 w-full max-w-xl" data-testid="preview-c36">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Control de paginación con total de registros y navegación accesible
        </h4>
        <div className="p-4 rounded-group bg-surface border border-line">
          <Pagination
            onNext={() => setPage((p) => Math.min(p + 1, 5))}
            onPrevious={() => setPage((p) => Math.max(p - 1, 1))}
            page={page}
            totalItems={94}
            totalPages={5}
          />
        </div>
      </div>
    </div>
  )
}

function DetailPanelPreview() {
  const [open, setOpen] = useState(true)

  return (
    <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c39">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Panel lateral persistente no modal (F07 4:2804 / 4:2806 - 302px)
        </h4>
        <p className="text-sm text-ink-muted mb-4">
          Panel complementario que no bloquea la interacción ni el foco del
          contenido vecino.
        </p>
        <div className="mb-4">
          <Button onClick={() => setOpen(!open)} size="40" variant="secondary">
            {open ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          </Button>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 items-start border border-line rounded-dialog p-4 bg-canvas min-h-[400px]">
          <div className="flex-1 bg-surface p-6 rounded-group border border-line w-full">
            <h5 className="font-bold text-ink text-base mb-2">
              Contenido principal de trabajo
            </h5>
            <p className="text-sm text-ink-muted mb-4">
              Este espacio de trabajo mantiene el foco y accesibilidad activa
              sin atrapar al usuario.
            </p>
            <div className="space-y-3 max-w-md">
              <Field label="Comentario técnico">
                <Input placeholder="Escriba una nota..." />
              </Field>
              <Button size="40" variant="primary">
                Guardar nota
              </Button>
            </div>
          </div>
          {open && (
            <DetailPanel
              description="Detalles de la unidad y estado técnico"
              onClose={() => setOpen(false)}
              title="Ficha técnica"
            >
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs text-ink-muted block">Vehículo</span>
                  <span className="font-semibold text-ink">
                    Toyota Hilux 2023 · 4x4
                  </span>
                </div>
                <div>
                  <span className="text-xs text-ink-muted block">Placa</span>
                  <span className="font-mono text-ink">ABC-1234</span>
                </div>
                <div>
                  <span className="text-xs text-ink-muted block">
                    Kilometraje
                  </span>
                  <span className="text-ink">45,200 km</span>
                </div>
                <div>
                  <span className="text-xs text-ink-muted block">
                    Responsable
                  </span>
                  <span className="text-ink">
                    Carlos Méndez (Mecánico líder)
                  </span>
                </div>
              </div>
            </DetailPanel>
          )}
        </div>
      </div>
    </div>
  )
}

function DrawerPreview() {
  const [drawer409Open, setDrawer409Open] = useState(false)
  const [drawer369Open, setDrawer369Open] = useState(false)
  const open409Ref = useRef<HTMLButtonElement>(null)
  const open369Ref = useRef<HTMLButtonElement>(null)

  return (
    <div className="space-y-6 w-full max-w-xl" data-testid="preview-c40">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Drawer lateral con variantes de ancho y overlay (F08 4:3261 / F10
          4:5399)
        </h4>
        <p className="text-sm text-ink-muted mb-4">
          Paneles deslizantes con trampa de foco, bloqueo seguro de scroll y
          cierre con Escape.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setDrawer409Open(true)}
            ref={open409Ref}
            variant="primary"
          >
            Abrir Drawer 409px (sin overlay)
          </Button>
          <Button
            onClick={() => setDrawer369Open(true)}
            ref={open369Ref}
            variant="secondary"
          >
            Abrir Drawer 369px (overlay 30%)
          </Button>
        </div>

        <Drawer
          description="Filtros avanzados de órdenes per F08 4:3261"
          onClose={() => setDrawer409Open(false)}
          open={drawer409Open}
          overlay="none"
          returnFocusRef={open409Ref}
          title="Filtros avanzados (409px)"
          width="409"
        >
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Variante de 409px de ancho con overlay transparente
              (overlay=&quot;none&quot;).
            </p>
            <Field label="Buscar por cliente o placa">
              <Input placeholder="Ej. Juan Pérez" />
            </Field>
            <Field label="Estado de orden">
              <Select defaultValue="all">
                <option value="all">Todos los estados</option>
                <option value="active">En proceso</option>
                <option value="pending">Pendiente</option>
              </Select>
            </Field>
            <div className="pt-4 flex gap-2">
              <Button onClick={() => setDrawer409Open(false)} variant="primary">
                Aplicar filtros
              </Button>
              <Button onClick={() => setDrawer409Open(false)} variant="quiet">
                Cerrar
              </Button>
            </div>
          </div>
        </Drawer>

        <Drawer
          description="Detalle rápido per F10 4:5399"
          onClose={() => setDrawer369Open(false)}
          open={drawer369Open}
          overlay="30"
          returnFocusRef={open369Ref}
          title="Resumen rápido (369px)"
          width="369"
        >
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Variante compacta de 369px de ancho con overlay tenue del 30%
              (overlay=&quot;30&quot;).
            </p>
            <div className="p-3 bg-canvas rounded-group border border-line">
              <span className="text-xs text-ink-muted block">
                Diagnóstico inicial
              </span>
              <span className="text-sm text-ink font-medium">
                Revisión de frenos delanteros y cambio de pastillas.
              </span>
            </div>
            <div className="pt-4">
              <Button
                onClick={() => setDrawer369Open(false)}
                variant="secondary"
              >
                Entendido
              </Button>
            </div>
          </div>
        </Drawer>
      </div>
    </div>
  )
}

function ModalPreview() {
  const [open, setOpen] = useState(false)
  const openModalRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="space-y-6 w-full max-w-xl" data-testid="preview-c41">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Modal centrado 466px (F12 4:6177)
        </h4>
        <p className="text-sm text-ink-muted mb-4">
          Diálogo centrado accesible con trampa de foco, bloqueo seguro de
          scroll y acciones.
        </p>
        <Button
          onClick={() => setOpen(true)}
          ref={openModalRef}
          variant="primary"
        >
          Abrir Modal (466px)
        </Button>

        <Modal
          actions={
            <>
              <Button onClick={() => setOpen(false)} variant="quiet">
                Cancelar
              </Button>
              <Button onClick={() => setOpen(false)} variant="primary">
                Guardar cambios
              </Button>
            </>
          }
          description="Actualice el estado operativo y asigne un técnico responsable."
          onClose={() => setOpen(false)}
          open={open}
          returnFocusRef={openModalRef}
          title="Editar estado de orden"
        >
          <div className="space-y-4 py-2">
            <Field label="Nuevo estado">
              <Select defaultValue="diagnostico">
                <option value="diagnostico">En diagnóstico</option>
                <option value="reparacion">En reparación</option>
                <option value="completado">Listo para entrega</option>
              </Select>
            </Field>
            <Field label="Notas para el cliente">
              <Textarea
                placeholder="Describa el trabajo realizado..."
                rows={3}
              />
            </Field>
          </div>
        </Modal>
      </div>
    </div>
  )
}

function ConfirmationPanelPreview() {
  const [panel658Open, setPanel658Open] = useState(false)
  const [panel726Open, setPanel726Open] = useState(false)
  const open658Ref = useRef<HTMLButtonElement>(null)
  const open726Ref = useRef<HTMLButtonElement>(null)

  return (
    <div className="space-y-6 w-full max-w-xl" data-testid="preview-c42">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Paneles de confirmación (F19 4:9303 / F20 4:9335)
        </h4>
        <p className="text-sm text-ink-muted mb-4">
          Estructuras de confirmación de 658px y 726px de ancho, sin gráficos
          ajenos ni ilustraciones de demo.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => setPanel658Open(true)}
            ref={open658Ref}
            variant="secondary"
          >
            Abrir confirmación 658px (F19)
          </Button>
          <Button
            onClick={() => setPanel726Open(true)}
            ref={open726Ref}
            variant="primary"
          >
            Abrir confirmación 726px (F20)
          </Button>
        </div>

        <ConfirmationPanel
          cancelLabel="Revisar datos"
          confirmLabel="Confirmar cancelación"
          description="Esta acción marcará la orden de servicio como anulada y liberará la bahía técnica."
          onCancel={() => setPanel658Open(false)}
          onConfirm={() => setPanel658Open(false)}
          open={panel658Open}
          returnFocusRef={open658Ref}
          title="¿Confirmar anulación de la orden OT-2026-089?"
          tone="danger"
          width="658"
        >
          <div className="p-4 bg-feedback-danger-subtle rounded-group border border-feedback-danger-muted text-sm text-feedback-danger">
            <p className="font-medium">
              Atención: La orden tiene repuestos asignados en almacén.
            </p>
            <p className="mt-1 text-xs">
              Los repuestos retornarán automáticamente al inventario general.
            </p>
          </div>
        </ConfirmationPanel>

        <ConfirmationPanel
          cancelLabel="Cerrar"
          confirmLabel="Aceptar y ver resumen"
          description="La orden de servicio ha sido cerrada satisfactoriamente y el comprobante ha sido generado."
          onCancel={() => setPanel726Open(false)}
          onConfirm={() => setPanel726Open(false)}
          open={panel726Open}
          returnFocusRef={open726Ref}
          title="Orden completada y liquidada"
          tone="primary"
          width="726"
        >
          <div className="p-4 bg-canvas rounded-group border border-line text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-ink-muted">Total liquidado:</span>
              <span className="font-semibold text-ink font-mono">
                $1,450.00
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Bahía asignada:</span>
              <span className="font-medium text-ink">Bahía #3 (Liberada)</span>
            </div>
          </div>
        </ConfirmationPanel>
      </div>
    </div>
  )
}

function PreviewLayoutPreview() {
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor')
  const [docTitle, setDocTitle] = useState(
    'Orden de Mantenimiento Mayor #OT-2026-089',
  )
  const [notes, setNotes] = useState(
    'Revisión general de sistema de frenos y cambio de fluidos hidráulicos.',
  )

  return (
    <div className="space-y-6 w-full max-w-5xl" data-testid="preview-c33">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Layout de vista previa y editor (F09 4:4240 / 4:4315)
        </h4>
        <p className="text-sm text-ink-muted mb-4">
          Composición de edición y documento previo con escala tipográfica
          accesible (adaptación sin microfuente de 6px).
        </p>

        <div className="lg:hidden mb-4 flex gap-2">
          <Button
            onClick={() => setMobileView('editor')}
            size="40"
            variant={mobileView === 'editor' ? 'primary' : 'secondary'}
          >
            Ver editor
          </Button>
          <Button
            onClick={() => setMobileView('preview')}
            size="40"
            variant={mobileView === 'preview' ? 'primary' : 'secondary'}
          >
            Ver documento
          </Button>
        </div>

        <PreviewLayout
          activeMobileView={mobileView}
          editor={
            <div className="space-y-4">
              <h5 className="font-bold text-ink text-base">
                Parámetros del documento
              </h5>
              <Field label="Título de la orden">
                <Input
                  onChange={(e) => setDocTitle(e.target.value)}
                  value={docTitle}
                />
              </Field>
              <Field label="Observaciones técnicas">
                <Textarea
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  value={notes}
                />
              </Field>
              <div className="pt-2">
                <Button size="40" variant="primary">
                  Guardar borrador
                </Button>
              </div>
            </div>
          }
          preview={
            <div className="space-y-6">
              <div className="border-b border-line pb-4">
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                  Vista preliminar
                </span>
                <h3 className="text-lg font-extrabold text-ink mt-1">
                  {docTitle}
                </h3>
                <p className="text-xs text-ink-muted mt-1">
                  Generado en ambiente de desarrollo · Sys-Taller
                </p>
              </div>

              <div className="space-y-2">
                <h6 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Conceptos de servicio
                </h6>
                <div className="overflow-x-auto border border-line rounded-group">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-canvas border-b border-line text-ink font-semibold">
                      <tr>
                        <th className="p-2.5">Concepto</th>
                        <th className="p-2.5 text-center">Cant.</th>
                        <th className="p-2.5 text-right">Referencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink-muted">
                      <tr>
                        <td className="p-2.5 font-medium text-ink">
                          Diagnóstico electrónico computarizado
                        </td>
                        <td className="p-2.5 text-center">1</td>
                        <td className="p-2.5 text-right font-mono">DIAG-01</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-medium text-ink">
                          Revisión de pastillas y discos delanteros
                        </td>
                        <td className="p-2.5 text-center">2</td>
                        <td className="p-2.5 text-right font-mono">FREN-02</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-canvas rounded-group border border-line text-xs text-ink-muted">
                <span className="font-semibold text-ink block mb-1">
                  Notas registradas:
                </span>
                <p className="break-words">{notes}</p>
              </div>
            </div>
          }
          toolbar={
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-ink">
                Editor interactivo
              </span>
              <div className="flex gap-2">
                <Button size="40" variant="secondary">
                  Actualizar
                </Button>
                <Button size="40" variant="quiet">
                  Restablecer
                </Button>
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}

function AuthLayoutPreview() {
  const [variant, setVariant] = useState<'short' | 'extended'>('short')

  return (
    <div className="space-y-6 w-full max-w-5xl" data-testid="preview-c43">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Layout de autenticación y acceso (F17 4:8585 / F18 4:8485)
        </h4>
        <p className="text-sm text-ink-muted mb-4">
          Estructura de acceso con columna 448px, controles 348px y omisión
          deliberada de ilustraciones importadas.
        </p>

        <div className="mb-4 flex gap-2">
          <Button
            onClick={() => setVariant('short')}
            size="40"
            variant={variant === 'short' ? 'primary' : 'secondary'}
          >
            Variante corta (login)
          </Button>
          <Button
            onClick={() => setVariant('extended')}
            size="40"
            variant={variant === 'extended' ? 'primary' : 'secondary'}
          >
            Variante extendida (recuperación)
          </Button>
        </div>

        <div className="border border-line rounded-dialog overflow-hidden">
          <AuthLayout
            footer={
              <div className="space-y-2">
                <p className="text-xs text-ink-muted">
                  ¿Problemas para acceder? Contacte al administrador del taller.
                </p>
                <a
                  className="text-xs text-primary font-medium hover:underline block"
                  href="#soporte"
                >
                  Guía de soporte y seguridad
                </a>
              </div>
            }
            header={
              <div>
                <h3 className="text-xl font-extrabold text-ink">Sys-Taller</h3>
                <p className="text-sm text-ink-muted mt-1">
                  {variant === 'short'
                    ? 'Inicie sesión en su cuenta'
                    : 'Restablecimiento seguro de credenciales'}
                </p>
              </div>
            }
            hero={
              <div className="space-y-3">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Gestión Operativa
                </span>
                <h4 className="text-lg font-bold text-ink">
                  Sistema de Administración de Taller
                </h4>
                <p className="text-sm text-ink-muted">
                  Control integral de órdenes mecánicas, vehículos, clientes y
                  bahías de servicio con trazabilidad técnica.
                </p>
              </div>
            }
            variant={variant}
          >
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <Field label="Nombre de usuario o correo">
                <Input placeholder="ejemplo@systaller.com" />
              </Field>
              <Field label="Contraseña">
                <PasswordInput placeholder="••••••••" />
              </Field>
              {variant === 'extended' && (
                <Field label="Confirmar contraseña">
                  <PasswordInput placeholder="••••••••" />
                </Field>
              )}
              <div className="pt-2">
                <Button
                  className="w-full"
                  size="50"
                  type="submit"
                  variant="primary"
                >
                  {variant === 'short'
                    ? 'Iniciar sesión'
                    : 'Actualizar contraseña'}
                </Button>
              </div>
            </form>
          </AuthLayout>
        </div>
      </div>
    </div>
  )
}

function CalendarDemoPreview() {
  const [currentView, setCurrentView] = useState<CalendarView>('month')
  const [selectedDate, setSelectedDate] = useState('2026-09-13')
  const [currentMonth, setCurrentMonth] = useState('2026-09')

  const monthEvents: CalendarEventItem[] = [
    {
      id: '1',
      date: '2026-09-14',
      title: 'Elemento A',
      tone: 'primary',
      time: '09:00',
    },
    {
      id: '2',
      date: '2026-09-14',
      title: 'Elemento B',
      tone: 'warning',
      time: '14:00',
    },
    {
      id: '3',
      date: '2026-09-18',
      title: 'Elemento C',
      tone: 'info',
      time: '11:30',
    },
    {
      id: '4',
      date: '2026-09-22',
      title: 'Elemento D',
      tone: 'success',
      time: '16:00',
    },
  ]

  const dayEvents: DayCalendarEvent[] = [
    {
      id: 'd1',
      title: 'Bloque A',
      subtitle: 'Recurso 1',
      startTime: '09:00',
      endTime: '10:30',
      tone: 'primary',
    },
    {
      id: 'd2',
      title: 'Bloque B',
      subtitle: 'Recurso 2',
      startTime: '10:00',
      endTime: '11:00',
      tone: 'warning',
    },
    {
      id: 'd3',
      title: 'Bloque C',
      subtitle: 'Recurso 3',
      startTime: '14:00',
      endTime: '15:30',
      tone: 'success',
    },
  ]

  const getTitle = () => {
    if (currentView === 'year') return 'Año 2026'
    if (currentView === 'day') return `Día: ${selectedDate}`
    return 'Septiembre 2026'
  }

  return (
    <div
      className="space-y-4 w-full max-w-4xl"
      data-testid="calendar-orchestration-demo"
    >
      <CalendarToolbar
        currentView={currentView}
        onNext={() => {}}
        onPrevious={() => {}}
        onToday={() => {
          setSelectedDate('2026-09-13')
          setCurrentMonth('2026-09')
        }}
        onViewChange={setCurrentView}
        title={getTitle()}
      />

      <div className="p-1 bg-canvas rounded-xl border border-line/40 overflow-hidden">
        {currentView === 'month' && (
          <MonthCalendar
            currentMonth={currentMonth}
            events={monthEvents}
            onSelectDate={(date) => {
              setSelectedDate(date)
            }}
            selectedDate={selectedDate}
            today="2026-09-13"
          />
        )}

        {currentView === 'day' && (
          <DayCalendar
            date={selectedDate}
            endHour={18}
            events={dayEvents}
            startHour={8}
          />
        )}

        {currentView === 'year' && (
          <YearCalendar
            onSelectDate={(date) => {
              setSelectedDate(date)
              setCurrentMonth(date.slice(0, 7))
              setCurrentView('month')
            }}
            onSelectMonth={(m) => {
              setCurrentMonth(m)
              setCurrentView('month')
            }}
            selectedDate={selectedDate}
            today="2026-09-13"
            year={2026}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted px-1">
        <div className="flex items-center gap-2">
          <span>Fecha seleccionada:</span>
          <span
            className="font-bold text-ink"
            data-testid="selected-date-indicator"
          >
            {selectedDate}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Vista activa:</span>
          <span
            className="font-bold text-primary"
            data-testid="current-view-indicator"
          >
            {currentView}
          </span>
        </div>
      </div>
    </div>
  )
}

function CalendarToolbarPreview() {
  const [view, setView] = useState<CalendarView>('month')
  const [title, setTitle] = useState('Septiembre 2026')

  return (
    <div className="space-y-6 w-full max-w-3xl" data-testid="preview-c55">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Barra de herramientas con selector de vista y acciones (F21 4:5456)
        </h4>
        <CalendarToolbar
          actions={
            <Button size="40" variant="primary">
              Acción local
            </Button>
          }
          currentView={view}
          onNext={() => setTitle('Octubre 2026')}
          onPrevious={() => setTitle('Agosto 2026')}
          onToday={() => setTitle('Septiembre 2026')}
          onViewChange={setView}
          title={title}
        />
      </div>

      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Orquestación completa del calendario (Día / Mes / Año)
        </h4>
        <CalendarDemoPreview />
      </div>
    </div>
  )
}

function MiniCalendarPreview() {
  const [selectedDate, setSelectedDate] = useState('2026-09-13')
  const [currentMonth, setCurrentMonth] = useState('2026-09')

  return (
    <div className="space-y-6 w-full max-w-3xl" data-testid="preview-c56">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
            Selector interactivo estándar con navegación (F05 4:2042)
          </h4>
          <MiniCalendar
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
            today="2026-09-13"
          />
          <p
            className="text-xs text-ink-muted mt-2"
            data-testid="mini-calendar-selected"
          >
            Seleccionado: <strong className="text-ink">{selectedDate}</strong>
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
            Año bisiesto 2028 (29 días en febrero)
          </h4>
          <MiniCalendar
            ariaLabel="Calendario de febrero 2028 bisiesto"
            compact
            currentMonth="2028-02"
            today="2028-02-15"
          />
        </div>
      </div>
    </div>
  )
}

function MonthCalendarPreview() {
  const [selectedDate, setSelectedDate] = useState('2026-09-14')
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  const events: CalendarEventItem[] = [
    {
      id: 'e1',
      date: '2026-09-14',
      title: 'Elemento A',
      tone: 'primary',
      time: '09:00',
    },
    {
      id: 'e2',
      date: '2026-09-14',
      title: 'Elemento B con una etiqueta extensa de demostración',
      tone: 'warning',
      time: '14:00',
    },
    {
      id: 'e3',
      date: '2026-09-18',
      title: 'Elemento C',
      tone: 'info',
      time: '11:00',
    },
    {
      id: 'e4',
      date: '2026-09-22',
      title: 'Elemento D',
      tone: 'success',
      time: '16:30',
    },
  ]

  return (
    <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c57">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Calendario mensual estructurado de 7 columnas (F21 4:5474)
        </h4>
        <div className="rounded-xl border border-line/40 bg-canvas p-1 overflow-hidden">
          <MonthCalendar
            currentMonth="2026-09"
            events={events}
            onSelectDate={setSelectedDate}
            onSelectEvent={(ev) =>
              setSelectedEvent(`${ev.title} (${ev.time ?? 'Sin hora'})`)
            }
            selectedDate={selectedDate}
            today="2026-09-13"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-ink-muted gap-2 px-1">
        <div>
          Fecha seleccionada:{' '}
          <strong className="text-ink" data-testid="month-selected-date">
            {selectedDate}
          </strong>
        </div>
        {selectedEvent && (
          <div data-testid="month-selected-event">
            Evento pulsado:{' '}
            <strong className="text-primary">{selectedEvent}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

function YearCalendarPreview() {
  const [selectedDate, setSelectedDate] = useState('2026-09-13')
  const [activeMonth, setActiveMonth] = useState<string | null>(null)

  return (
    <div className="space-y-6 w-full max-w-5xl" data-testid="preview-c58">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Visión anual panorámica 12 meses (Retícula 3x4 nativa)
        </h4>
        <div className="rounded-xl border border-line/40 bg-canvas p-3 overflow-hidden">
          <YearCalendar
            onSelectDate={setSelectedDate}
            onSelectMonth={setActiveMonth}
            selectedDate={selectedDate}
            today="2026-09-13"
            year={2026}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-ink-muted gap-2 px-1">
        <div>
          Fecha seleccionada:{' '}
          <strong className="text-ink" data-testid="year-selected-date">
            {selectedDate}
          </strong>
        </div>
        {activeMonth && (
          <div data-testid="year-selected-month">
            Mes inspeccionado:{' '}
            <strong className="text-primary">{activeMonth}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

function DayCalendarPreview() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  const events: DayCalendarEvent[] = [
    {
      id: 'de1',
      title: 'Bloque A',
      subtitle: 'Recurso 1',
      startTime: '08:30',
      endTime: '10:00',
      tone: 'primary',
    },
    {
      id: 'de2',
      title: 'Bloque B',
      subtitle: 'Recurso 2 · Solapado',
      startTime: '09:30',
      endTime: '11:00',
      tone: 'warning',
    },
    {
      id: 'de3',
      title: 'Bloque C',
      subtitle: 'Recurso 3 · Solapado',
      startTime: '10:00',
      endTime: '11:30',
      tone: 'info',
    },
    {
      id: 'de4',
      title: 'Bloque D con texto largo para comprobar adaptación',
      subtitle: 'Recurso 1',
      startTime: '13:30',
      endTime: '15:00',
      tone: 'success',
    },
    {
      id: 'de5',
      title: 'Bloque E',
      subtitle: 'Recurso 4',
      startTime: '16:00',
      endTime: '17:00',
      tone: 'neutral',
    },
  ]

  return (
    <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c59">
      <div>
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
          Vista de día con eje horario 08:00–18:00 y solapamientos en columnas
          (F16 4:3943)
        </h4>
        <div className="rounded-xl border border-line/40 bg-canvas p-2 overflow-hidden">
          <DayCalendar
            date="2026-09-13"
            endHour={18}
            events={events}
            onSelectEvent={(ev) =>
              setSelectedEvent(`${ev.title} (${ev.startTime}-${ev.endTime})`)
            }
            onSelectTimeSlot={setSelectedSlot}
            startHour={8}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-ink-muted gap-2 px-1">
        <div>
          {selectedSlot ? (
            <span>
              Franja seleccionada:{' '}
              <strong className="text-ink" data-testid="day-selected-slot">
                {selectedSlot}
              </strong>
            </span>
          ) : (
            'Seleccione una franja horaria para demostrar el estado local'
          )}
        </div>
        {selectedEvent && (
          <div data-testid="day-selected-event">
            Evento: <strong className="text-primary">{selectedEvent}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelinePreview() {
  const [selectedRowId, setSelectedRowId] = useState('row-b')
  const rows: TimelineRow[] = [
    {
      id: 'row-a',
      label: 'Elemento A',
      description: 'Intervalo sintético inicial',
      start: 0,
      end: 30,
      tone: 'primary',
    },
    {
      id: 'row-b',
      label: 'Elemento B con etiqueta extensa',
      description: 'Intervalo sintético superpuesto',
      start: 20,
      end: 65,
      tone: 'warning',
    },
    {
      id: 'row-c',
      label: 'Elemento C',
      start: 70,
      end: 110,
      tone: 'success',
    },
  ]

  return (
    <div className="w-full max-w-5xl space-y-4" data-testid="preview-c60">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
        Cronograma controlado y acotado (F15 4:3638)
      </p>
      <Timeline
        ariaLabel="Cronograma sintético"
        end={100}
        onSelectRow={(row) => setSelectedRowId(row.id)}
        rows={rows}
        selectedRowId={selectedRowId}
        start={0}
        ticks={[
          { value: 0, label: 'Inicio' },
          { value: 25, label: 'T1' },
          { value: 50, label: 'T2' },
          { value: 75, label: 'T3' },
          { value: 100, label: 'Fin' },
        ]}
      />
      <p className="text-xs text-ink-muted">
        Selección local:{' '}
        <strong className="text-ink" data-testid="timeline-selection">
          {selectedRowId}
        </strong>
      </p>
    </div>
  )
}

function BoardPreview() {
  const [selectedCardId, setSelectedCardId] = useState('card-b')
  const [actionMessage, setActionMessage] = useState('Sin acción')
  const columns: BoardColumn[] = [
    {
      id: 'group-a',
      title: 'Grupo A',
      cards: [
        {
          id: 'card-a',
          title: 'Elemento A',
          description: 'Contenido sintético corto.',
          avatars: [{ name: 'Alpha Abstracto', label: 'Inicial AA' }],
          indicators: <StatusBadge kind="category" label="Tipo 1" />,
        },
        {
          id: 'card-b',
          title: 'Elemento B con un título deliberadamente extenso',
          description:
            'Texto neutral extenso para comprobar ajuste, lectura y conservación de las acciones sin usar estados de negocio.',
          avatars: [
            { name: 'Beta Abstracto', label: 'Inicial BA' },
            { name: 'Gamma Abstracto', label: 'Inicial GA' },
          ],
          media: true,
          actions: (
            <Button
              onClick={() => setActionMessage('Acción B activada')}
              size="40"
              variant="quiet"
            >
              Acción B
            </Button>
          ),
        },
      ],
    },
    {
      id: 'group-b',
      title: 'Grupo B',
      cards: [
        {
          id: 'card-c',
          title: 'Elemento C',
          description: 'Contenido sintético intermedio.',
          avatars: [{ name: 'Delta Abstracto', label: 'Inicial DA' }],
        },
      ],
    },
    {
      id: 'group-c',
      title: 'Grupo C con encabezado largo',
      cards: [],
    },
  ]

  return (
    <div className="w-full max-w-6xl space-y-4" data-testid="preview-board">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
        Tablero de columnas con scroll regional (F06 4:2639)
      </p>
      <Board
        columns={columns}
        label="Tablero sintético"
        onSelectCard={(card) => setSelectedCardId(card.id)}
        selectedCardId={selectedCardId}
      />
      <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
        <span>
          Selección local:{' '}
          <strong className="text-ink" data-testid="board-selection">
            {selectedCardId}
          </strong>
        </span>
        <strong className="text-ink" data-testid="board-action-message">
          {actionMessage}
        </strong>
      </div>
    </div>
  )
}

const neutralConversations: ConversationItem[] = [
  {
    id: 'thread-a',
    title: 'Hilo A',
    preview: 'Mensaje sintético reciente.',
    time: '09:12',
    group: 'Recientes',
    unreadCount: 2,
  },
  {
    id: 'thread-b',
    title: 'Hilo B con una etiqueta extensa para comprobar adaptación',
    preview: 'Segundo mensaje sintético sin contacto real.',
    time: '08:45',
    group: 'Recientes',
  },
  {
    id: 'thread-c',
    title: 'Hilo C',
    preview: 'Ejemplo anterior.',
    time: 'Ayer',
    group: 'Anteriores',
  },
]

function ConversationListPreview() {
  const [selectedId, setSelectedId] = useState('thread-a')
  const [query, setQuery] = useState('')
  const filtered = neutralConversations.filter((item) =>
    `${item.title} ${item.preview}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="w-full max-w-md space-y-4" data-testid="preview-c63">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
        Lista neutral agrupada (F22 4:7527)
      </p>
      <ConversationList
        conversations={filtered}
        label="Conversaciones sintéticas"
        onQueryChange={setQuery}
        onSelect={(item) => setSelectedId(item.id)}
        query={query}
        selectedId={selectedId}
      />
      <p className="text-xs text-ink-muted">
        Selección local:{' '}
        <strong className="text-ink" data-testid="conversation-selection">
          {selectedId}
        </strong>
      </p>
    </div>
  )
}

function MessageBubblePreview() {
  return (
    <div className="w-full max-w-2xl space-y-2" data-testid="preview-c64">
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-muted">
        Agrupación entrante/saliente (F22 4:7460/4:7474)
      </p>
      <MessageBubble
        direction="incoming"
        groupPosition="start"
        sender="Origen A"
        text="Texto neutral A con longitud suficiente para demostrar el ajuste de una burbuja sin copiar conversaciones ni datos personales."
        time="09:10"
      />
      <MessageBubble
        direction="incoming"
        groupPosition="end"
        sender="Origen A"
        text="Texto neutral B."
        time="09:11"
      />
      <MessageBubble
        direction="outgoing"
        text="Respuesta sintética C, controlada por el consumidor."
        time="09:12"
      />
    </div>
  )
}

function MessageComposerPreview() {
  const [value, setValue] = useState('')
  const [pending, setPending] = useState(false)
  const [lastSubmission, setLastSubmission] = useState('Sin envío local')

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="preview-c65">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
        Compositor local sin transporte ni adjuntos (F22 4:7442)
      </p>
      <MessageComposer
        onChange={setValue}
        onSubmit={(text) => {
          setLastSubmission(text)
          setValue('')
        }}
        pending={pending}
        value={value}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setPending((current) => !current)}
          size="40"
          variant="secondary"
        >
          {pending ? 'Desactivar pending' : 'Activar pending'}
        </Button>
        <span className="break-words text-xs text-ink-muted">
          Último callback local:{' '}
          <strong className="text-ink" data-testid="composer-result">
            {lastSubmission}
          </strong>
        </span>
      </div>
    </div>
  )
}

export function renderComponentPreview(id: string): ReactNode {
  switch (id) {
    case 'C01':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c01">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Iconos nativos y adaptados (20px / 24px)
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {(Object.keys(ICON_MAP) as IconName[])
                .slice(0, 12)
                .map((name) => (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-1.5 p-3 rounded border border-line bg-surface text-center"
                  >
                    <Icon name={name} size={20} className="text-ink" />
                    <span className="text-[10px] font-mono text-ink-muted truncate w-full">
                      {name}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Modo accesible (con aria-label)
            </h4>
            <div className="flex items-center gap-3 p-3 rounded bg-surface border border-line">
              <Icon
                name="document"
                size={20}
                aria-label="Ver documento de factura"
                className="text-primary"
              />
              <span className="text-xs text-ink">
                Icono con etiqueta semántica para lectores de pantalla
              </span>
            </div>
          </div>
        </div>
      )

    case 'C02':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c02">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Variantes de tono (Tamaño estándar 40px)
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primario</Button>
              <Button variant="secondary">Secundario</Button>
              <Button variant="quiet">Quiet</Button>
              <Button variant="danger">Peligro</Button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Variante opt-in 50px (Formularios / Nodos F08 4:3292)
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="50" variant="primary">
                Guardar registro (50px)
              </Button>
              <Button size="50" variant="secondary">
                Cancelar (50px)
              </Button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Estados interactivos (Deshabilitado / Ocupado)
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled variant="primary">
                Deshabilitado
              </Button>
              <Button
                pending
                pendingLabel="Guardando cambios…"
                variant="primary"
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )

    case 'C03':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c03">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Formas (Cuadrada redondeada y circular)
            </h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <IconButton
                  icon={<Icon name="user" />}
                  label="Usuario cuadrado"
                  shape="square"
                />
                <span className="text-xs text-ink-muted">Cuadrado (40px)</span>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  icon={<Icon name="pencil" />}
                  label="Editar circular"
                  shape="circle"
                />
                <span className="text-xs text-ink-muted">
                  Circular (F08 4:3297)
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Objetivo táctil accesible (44x44px con separación 8px)
            </h4>
            <div className="flex items-center gap-2">
              <IconButton
                icon={<Icon name="trash" />}
                label="Eliminar con objetivo táctil"
                targetSize="touch44"
                variant="danger"
              />
              <IconButton
                icon={<Icon name="settings" />}
                label="Configuración táctil"
                targetSize="touch44"
              />
            </div>
          </div>
        </div>
      )

    case 'C04':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c04">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Grupo de botones horizontal con separación estándar (8px)
            </h4>
            <ButtonGroup label="Acciones de diálogo">
              <Button variant="quiet">Cancelar</Button>
              <Button variant="secondary">Borrador</Button>
              <Button variant="primary">Confirmar</Button>
            </ButtonGroup>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Grupo vertical (F19 4:9336)
            </h4>
            <div className="max-w-xs">
              <ButtonGroup label="Acciones apiladas" orientation="vertical">
                <Button size="50" variant="primary">
                  Continuar
                </Button>
                <Button variant="quiet">Volver al inicio</Button>
              </ButtonGroup>
            </div>
          </div>
        </div>
      )

    case 'C05':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c05">
          <Field id="f-nom" label="Nombre del cliente">
            <Input placeholder="Ej. Juan Pérez" />
          </Field>
          <Field
            hint="Use el formato institucional usuario@dominio.com"
            id="f-email"
            label="Correo electrónico"
          >
            <Input placeholder="usuario@ejemplo.com" type="email" />
          </Field>
          <Field
            error="El documento debe tener al menos 8 dígitos"
            id="f-doc"
            label="Número de documento"
          >
            <Input defaultValue="123" />
          </Field>
        </div>
      )

    case 'C06':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c06">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Altura 50px y Radio r5 (Estándar de control)
            </h4>
            <Input
              aria-label="Entrada estándar"
              placeholder="Entrada estándar 50px r5"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Variante Radio r10 (Formularios amplios F10 4:5440)
            </h4>
            <Input
              aria-label="Entrada con radio r10"
              placeholder="Entrada con radio r10"
              radius="r10"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Variante Compacta 42px (F12 4:6205)
            </h4>
            <Input
              aria-label="Entrada compacta"
              density="compact42"
              placeholder="Entrada compacta 42px"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado Deshabilitado
            </h4>
            <Input
              aria-label="Campo bloqueado para edición"
              disabled
              placeholder="Campo bloqueado para edición"
            />
          </div>
        </div>
      )

    case 'C07':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c07">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Select estándar (Radio r5)
            </h4>
            <Select
              aria-label="Seleccionar categoría"
              defaultValue="mantenimiento"
            >
              <option value="mantenimiento">Mantenimiento preventivo</option>
              <option value="reparacion">Reparación general</option>
              <option value="diagnostico">Diagnóstico computarizado</option>
            </Select>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Variante Radio r10 (F10 4:5429)
            </h4>
            <Select aria-label="Seleccionar estado" radius="r10">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado Deshabilitado
            </h4>
            <Select disabled aria-label="Selector deshabilitado">
              <option>No modificable</option>
            </Select>
          </div>
        </div>
      )

    case 'C08':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c08">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Tamaño estándar (20px)
            </h4>
            <div className="flex flex-col gap-2">
              <Checkbox
                defaultChecked
                label="Notificar por correo electrónico"
              />
              <Checkbox label="Requiere autorización previa de repuestos" />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Variante compacta (15px - F18 4:8495)
            </h4>
            <Checkbox
              label="Filtro compacto en lista de auditoría"
              sizeVariant="15"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado Indeterminado (Parcialmente seleccionado)
            </h4>
            <Checkbox
              indeterminate
              label="Seleccionar todos los vehículos (5 de 12)"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado Deshabilitado
            </h4>
            <Checkbox disabled label="Opción restringida por política" />
          </div>
        </div>
      )

    case 'C09':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c09">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Mensaje de error accesible independiente
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line space-y-2">
              <p className="text-sm text-ink">
                Estado de validación de formulario:
              </p>
              <FieldError>
                El cliente ya se encuentra registrado con ese número de
                identificación.
              </FieldError>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Asociación mediante contenedor Field
            </h4>
            <Field
              error="Debe asignar un rol válido al usuario"
              id="f-c09"
              label="Rol de acceso"
            >
              <Select defaultValue="">
                <option disabled value="">
                  Seleccione un rol…
                </option>
                <option value="admin">Administrador</option>
                <option value="operador">Operador</option>
              </Select>
            </Field>
          </div>
        </div>
      )

    case 'C10':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c10">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Textarea estándar multilínea (Radio r10 - F10 4:5412)
            </h4>
            <Field
              hint="Describa detalladamente el fallo reportado por el cliente"
              id="c10-desc"
              label="Observaciones del vehículo"
            >
              <Textarea placeholder="Indique ruidos, testigos encendidos o síntomas observados…" />
            </Field>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Variante Radio r5 y sin redimensionado
            </h4>
            <Textarea
              aria-label="Comentario breve"
              placeholder="Comentario breve..."
              radius="r5"
              resize="none"
              rows={2}
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado Deshabilitado
            </h4>
            <Textarea
              aria-label="Registro histórico deshabilitado"
              disabled
              defaultValue="Registro histórico bloqueado para edición."
            />
          </div>
        </div>
      )

    case 'C11':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c11">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Alternancia interactiva de visibilidad (F17 4:9228)
            </h4>
            <Field
              hint="Haga clic en el icono del ojo para revelar u ocultar la clave"
              id="c11-pass"
              label="Contraseña de usuario"
            >
              <PasswordInput defaultValue="ClaveTaller#2026" />
            </Field>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado Deshabilitado
            </h4>
            <PasswordInput
              aria-label="Contraseña bloqueada"
              disabled
              defaultValue="ContraseñaOculta"
            />
          </div>
        </div>
      )

    case 'C12':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c12">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Búsqueda con icono y botón de limpieza automática (F03 4:1024)
            </h4>
            <Field
              hint="Escriba texto para ver aparecer el botón de limpiar"
              id="c12-search"
              label="Buscar en inventario o catálogo"
            >
              <SearchInput
                defaultValue="Filtro de prueba"
                placeholder="Buscar por placa, cliente o factura..."
              />
            </Field>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Variante compacta (42px)
            </h4>
            <SearchInput
              aria-label="Búsqueda rápida en barra"
              density="compact42"
              placeholder="Búsqueda rápida en barra..."
            />
          </div>
        </div>
      )

    case 'C13':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c13">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Control de fecha con selector nativo (F02 4:222)
            </h4>
            <Field
              hint="Formato estándar YYYY-MM-DD"
              id="c13-date"
              label="Fecha inicial de trabajo"
            >
              <DateControl defaultValue="2026-09-13" />
            </Field>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Variante compacta (42px) y radio r10 (F02 4:223)
            </h4>
            <Field id="c13-date-compact" label="Fecha final estimada">
              <DateControl
                defaultValue="2026-09-20"
                density="compact42"
                radius="r10"
              />
            </Field>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado deshabilitado
            </h4>
            <DateControl
              aria-label="Fecha bloqueada"
              defaultValue="2026-01-01"
              disabled
            />
          </div>
        </div>
      )

    case 'C14':
      return <SegmentedControlPreview />

    case 'C15':
      return <TabsPreview />

    case 'C16':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c16">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Tooltip contextual con captura estática (F02 4:157)
            </h4>
            <div className="flex items-center gap-6 p-8 rounded-group bg-surface border border-line">
              <Tooltip
                content="Descargar informe consolidado (PDF)"
                open
                position="top"
              >
                <IconButton
                  icon={<Icon name="document" />}
                  label="Descargar informe"
                  shape="square"
                  targetSize="touch44"
                  variant="secondary"
                />
              </Tooltip>
              <Tooltip content="Configuración del sistema" position="bottom">
                <IconButton
                  icon={<Icon name="settings" />}
                  label="Ajustes de sistema"
                  shape="circle"
                  targetSize="touch44"
                  variant="quiet"
                />
              </Tooltip>
            </div>
          </div>
        </div>
      )

    case 'C17':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c17">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Menú desplegable con acciones y opción destructiva (F04 4:1497)
            </h4>
            <div className="p-8 pb-32 rounded-group bg-surface border border-line">
              <DropdownMenu
                align="left"
                items={[
                  { id: 'details', label: 'Ver detalles de ficha' },
                  { id: 'edit', label: 'Editar información' },
                  { id: 'history', label: 'Historial de cambios' },
                  { id: 'sep', label: '', divider: true },
                  {
                    id: 'delete',
                    label: 'Eliminar vehículo',
                    destructive: true,
                  },
                ]}
                open
                trigger={
                  <Button size="40" variant="secondary">
                    Opciones de ficha
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      )

    case 'C18':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c18">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Encabezado completo con descripción y acciones (F08 4:3259)
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line">
              <PageHeader
                actions={<Button variant="primary">Nueva orden</Button>}
                description="Gestión general de mantenimientos, diagnósticos y entregas de vehículos."
                title="Órdenes de Trabajo"
              />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Encabezado simple solo título
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line">
              <PageHeader title="Inventario de Repuestos" />
            </div>
          </div>
        </div>
      )

    case 'C19':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c19">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Barra de herramientas para filtros y comandos (F03 4:1017)
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line">
              <Toolbar label="Barra de herramientas de órdenes">
                <div className="w-64">
                  <SearchInput
                    aria-label="Buscar orden"
                    density="compact42"
                    placeholder="Buscar orden…"
                  />
                </div>
                <Button size="40" variant="secondary">
                  Filtrar
                </Button>
                <Button size="40" variant="quiet">
                  Exportar CSV
                </Button>
              </Toolbar>
            </div>
          </div>
        </div>
      )

    case 'C20':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c20">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Panel de filtros modular con limpieza (F06 4:2247 / F03 4:1024)
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line">
              <FilterPanel
                clearLabel="Restablecer"
                label="Filtros de inventario"
                layout="inline"
                onClear={() => {}}
              >
                <div className="w-56">
                  <Field id="c20-search" label="Término de búsqueda">
                    <SearchInput
                      density="compact42"
                      placeholder="Buscar por código..."
                    />
                  </Field>
                </div>
                <div className="w-48">
                  <Field id="c20-status" label="Estado de orden">
                    <Select defaultValue="all">
                      <option value="all">Todas las órdenes</option>
                      <option value="pending">Pendientes</option>
                      <option value="completed">Completadas</option>
                    </Select>
                  </Field>
                </div>
              </FilterPanel>
            </div>
          </div>
        </div>
      )

    case 'C21':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c21">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Superficie base neutral con borde y sombra sutil (F02 4:93)
            </h4>
            <Surface aria-label="Bloque de información">
              <h3 className="text-base font-bold text-ink mb-2">
                Datos del Taller
              </h3>
              <p className="text-sm text-ink-muted">
                Superficie estructurada para contener fichas, tablas o
                formularios sin acoplamiento a páginas específicas.
              </p>
            </Surface>
          </div>
        </div>
      )

    case 'C22':
      return (
        <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c22">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Métricas estándar (116px de altura, icono 60px y valor 22px, F01
              4:506 / F02 4:164)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                accent="primary"
                detail="12 en proceso activo"
                icon={<Icon name="chart" size={24} />}
                label="Órdenes Abiertas"
                value="48"
              />
              <MetricCard
                accent="success"
                detail="+14% vs mes anterior"
                icon={<Icon name="shield-check" size={24} />}
                label="Entregas Exitosas"
                value="124"
              />
              <MetricCard
                accent="warning"
                detail="Requieren diagnóstico"
                icon={<Icon name="calendar" size={24} />}
                label="Citas Pendientes"
                value="7"
              />
              <MetricCard
                accent="info"
                detail="Total registrados"
                icon={<Icon name="user" size={24} />}
                label="Clientes Activos"
                value="850"
              />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Variante compacta (altura 96px / icono 48px)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MetricCard
                accent="primary"
                icon={<Icon name="chart" size={20} />}
                label="Tasa de Ocupación"
                size="compact"
                value="82%"
              />
              <MetricCard
                accent="success"
                icon={<Icon name="check" size={20} />}
                label="Reparaciones a Tiempo"
                size="compact"
                value="96%"
              />
            </div>
          </div>
        </div>
      )

    case 'C23':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c23">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Ficha de detalle con metadatos y acciones (F07 4:2807 / F02 4:3)
            </h4>
            <DetailCard
              actions={
                <Button size="40" variant="secondary">
                  Editar ficha
                </Button>
              }
              badge={<StatusBadge label="En Bahía" tone="warning" />}
              metadata={[
                { label: 'Placa', value: 'ABC-123' },
                { label: 'Marca / Modelo', value: 'Toyota Corolla 2021' },
                { label: 'Kilometraje', value: '45,200 km' },
                { label: 'Técnico asignado', value: 'Carlos Mendoza' },
                { label: 'Fecha de ingreso', value: '2026-09-10' },
                { label: 'Presupuesto base', value: '$350.00' },
              ]}
              subtitle="Mantenimiento preventivo mayor y cambio de aceite"
              title="Vehículo Toyota Corolla"
            >
              <p className="text-sm text-ink-muted">
                Observaciones técnicas: El cliente reporta ruido intermitente en
                el tren delantero al girar a la izquierda a baja velocidad.
              </p>
            </DetailCard>
          </div>
        </div>
      )

    case 'C24':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c24">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Tamaños circulares (36px, 70px, 134px) e iniciales accesibles
            </h4>
            <div className="flex flex-wrap items-center gap-6 p-4 rounded-group bg-surface border border-line">
              <div className="flex flex-col items-center gap-2">
                <Avatar name="Carlos Mendoza" size="36" />
                <span className="text-xs text-ink-muted">36px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar name="Administrador Principal" size="70" />
                <span className="text-xs text-ink-muted">
                  70px (F07 4:2815)
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar name="Taller Central" size="134" />
                <span className="text-xs text-ink-muted">
                  134px (F08 4:3284)
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Variante rectangular 45x43 (F01 4:580) y fallback de icono neutral
            </h4>
            <div className="flex items-center gap-6 p-4 rounded-group bg-surface border border-line">
              <div className="flex flex-col items-center gap-2">
                <Avatar name="Empresa Aliada" size="45x43" />
                <span className="text-xs text-ink-muted">45x43px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar label="Usuario sin nombre" size="36" />
                <span className="text-xs text-ink-muted">Fallback SVG</span>
              </div>
            </div>
          </div>
        </div>
      )

    case 'C25':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c25">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Grupo de avatares solapados con contador residual (F06 4:2647)
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Mecánicos Asignados
                </p>
                <p className="text-xs text-ink-muted">
                  Equipo a cargo de las órdenes prioritarias
                </p>
              </div>
              <AvatarGroup
                aria-label="Equipo de mecánicos asignados"
                items={[
                  { name: 'Carlos Mendoza' },
                  { name: 'Diana Morales' },
                  { name: 'Eduardo Silva' },
                  { name: 'Fernando Gómez' },
                  { name: 'Gabriela Ortiz' },
                ]}
                max={3}
              />
            </div>
          </div>
        </div>
      )

    case 'C26':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c26">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Divisor horizontal estándar
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line">
              <p className="text-sm text-ink">Sección superior</p>
              <Divider />
              <p className="text-sm text-ink">Sección inferior</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Divisor con texto intercalado (F17 4:9255)
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line">
              <Divider label="o continuar con" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Divisor vertical
            </h4>
            <div className="flex items-center h-10 p-4 rounded-group bg-surface border border-line">
              <span className="text-sm text-ink">Elemento A</span>
              <Divider orientation="vertical" />
              <span className="text-sm text-ink">Elemento B</span>
            </div>
          </div>
        </div>
      )

    case 'C27':
      return (
        <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c27">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Barra lateral expandida (218px) y colapsada (80px) (F01 4:575 /
              F02 4:233)
            </h4>
            <div className="flex gap-6 h-[420px] rounded-group border border-line overflow-hidden bg-canvas">
              <Sidebar
                activeId="orders"
                header={
                  <span className="font-bold text-ink text-sm">SYS-TALLER</span>
                }
                items={[
                  {
                    id: 'dashboard',
                    label: 'Tablero General',
                    icon: <Icon name="chart" size={20} />,
                  },
                  {
                    id: 'orders',
                    label: 'Órdenes de Trabajo',
                    icon: <Icon name="document" size={20} />,
                    badge: 8,
                  },
                  {
                    id: 'vehicles',
                    label: 'Parque Automotor',
                    icon: <Icon name="settings" size={20} />,
                  },
                  {
                    id: 'users',
                    label: 'Personal y Clientes',
                    icon: <Icon name="user" size={20} />,
                    disabled: true,
                  },
                ]}
              />
              <Sidebar
                activeId="orders"
                collapsed
                header={<span className="font-bold text-ink text-xs">ST</span>}
                items={[
                  {
                    id: 'dashboard',
                    label: 'Tablero General',
                    icon: <Icon name="chart" size={20} />,
                  },
                  {
                    id: 'orders',
                    label: 'Órdenes de Trabajo',
                    icon: <Icon name="document" size={20} />,
                    badge: 8,
                  },
                  {
                    id: 'vehicles',
                    label: 'Parque Automotor',
                    icon: <Icon name="settings" size={20} />,
                  },
                  {
                    id: 'users',
                    label: 'Personal y Clientes',
                    icon: <Icon name="user" size={20} />,
                    disabled: true,
                  },
                ]}
              />
              <div className="flex-1 p-6 flex items-center justify-center text-ink-muted text-sm">
                Área de trabajo del frame
              </div>
            </div>
          </div>
        </div>
      )

    case 'C28':
      return (
        <div className="space-y-6 w-full max-w-md" data-testid="preview-c28">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Elementos de navegación (Activo, inactivo, con badge y colapsado,
              F01 4:643)
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line space-y-2">
              <NavigationItem
                active
                badge={12}
                icon={<Icon name="document" size={20} />}
                id="c28-active"
                label="Órdenes de Servicio (Activo)"
              />
              <NavigationItem
                icon={<Icon name="chart" size={20} />}
                id="c28-inactive"
                label="Métricas de Bahía (Inactivo)"
              />
              <NavigationItem
                disabled
                icon={<Icon name="settings" size={20} />}
                id="c28-disabled"
                label="Ajustes Restringidos (Deshabilitado)"
              />
              <div className="pt-2 border-t border-line flex items-center gap-3">
                <NavigationItem
                  active
                  collapsed
                  icon={<Icon name="document" size={20} />}
                  id="c28-col-active"
                  label="Órdenes Colapsado"
                />
                <NavigationItem
                  collapsed
                  icon={<Icon name="chart" size={20} />}
                  id="c28-col-inactive"
                  label="Métricas Colapsado"
                />
              </div>
            </div>
          </div>
        </div>
      )

    case 'C29':
      return (
        <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c29">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              AppFrame estructural con navegación, cabecera y cuerpo (F01 4:344
              / F02 4:2)
            </h4>
            <div className="h-[460px] rounded-group border border-line overflow-hidden">
              <AppFrame
                className="h-full min-h-0"
                footer={
                  <p>© 2026 Sys-Taller · Versión Demostración Catálogo</p>
                }
                header={
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink text-sm">
                      Bahía Principal
                    </span>
                    <span className="text-xs text-ink-muted">
                      Sesión Activa
                    </span>
                  </div>
                }
                sidebar={
                  <div className="w-48 bg-surface p-4 border-r border-line text-xs text-ink-muted">
                    Slot de Sidebar
                  </div>
                }
              >
                <div className="p-4 rounded-control bg-surface border border-line">
                  <h3 className="font-bold text-ink text-base mb-1">
                    Contenido Principal de la Aplicación
                  </h3>
                  <p className="text-sm text-ink-muted">
                    AppFrame orquesta los contenedores estructurales de forma
                    pura y desacoplada.
                  </p>
                </div>
              </AppFrame>
            </div>
          </div>
        </div>
      )

    case 'C30':
      return (
        <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c30">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              DashboardLayout con 4 métricas y retícula de paneles (F01 4:344 /
              F02 4:164)
            </h4>
            <div className="p-4 rounded-group bg-canvas border border-line">
              <DashboardLayout
                metrics={
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard accent="primary" label="Órdenes" value="32" />
                    <MetricCard
                      accent="success"
                      label="Completadas"
                      value="115"
                    />
                    <MetricCard accent="warning" label="Demoradas" value="4" />
                    <MetricCard accent="info" label="Técnicos" value="8" />
                  </div>
                }
                sidePanel={
                  <Surface aria-label="Panel lateral del tablero">
                    <h4 className="font-bold text-ink text-sm mb-2">
                      Resumen Diario
                    </h4>
                    <p className="text-xs text-ink-muted">
                      4 vehículos programados para entrega antes de las 18:00.
                    </p>
                  </Surface>
                }
              >
                <Surface aria-label="Panel principal de actividad">
                  <h4 className="font-bold text-ink text-sm mb-2">
                    Actividad de Taller
                  </h4>
                  <p className="text-xs text-ink-muted">
                    Gráfico o lista central de mantenimiento en curso.
                  </p>
                </Surface>
              </DashboardLayout>
            </div>
          </div>
        </div>
      )

    case 'C31':
      return (
        <div className="space-y-6 w-full max-w-4xl" data-testid="preview-c31">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              MasterDetailLayout para lista/tabla y panel de detalle (F07 4:2804
              / F22 4:7439)
            </h4>
            <div className="p-4 rounded-group bg-canvas border border-line">
              <MasterDetailLayout
                detail={
                  <Surface aria-label="Detalle del elemento seleccionado">
                    <h4 className="font-bold text-ink text-sm mb-1">
                      Detalle de Selección
                    </h4>
                    <p className="text-xs text-ink-muted">
                      Información complementaria del registro activo en la tabla
                      maestra.
                    </p>
                  </Surface>
                }
                detailWidth="md"
                master={
                  <Surface aria-label="Tabla de registros">
                    <h4 className="font-bold text-ink text-sm mb-1">
                      Registro Maestro de Órdenes
                    </h4>
                    <p className="text-xs text-ink-muted">
                      Lista o tabla navegable con selección interactiva.
                    </p>
                  </Surface>
                }
              />
            </div>
          </div>
        </div>
      )

    case 'C32':
      return (
        <div className="space-y-6 w-full max-w-3xl" data-testid="preview-c32">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              FormLayout en dos columnas con barra de acciones (F09 4:4315 / F08
              4:3262)
            </h4>
            <div className="p-6 rounded-group bg-surface border border-line">
              <FormLayout
                actions={
                  <>
                    <Button variant="secondary">Cancelar</Button>
                    <Button variant="primary">Guardar orden</Button>
                  </>
                }
                columns={2}
              >
                <Field id="c32-client" label="Nombre del cliente">
                  <Input defaultValue="Alejandro Morales" />
                </Field>
                <Field id="c32-plate" label="Placa del vehículo">
                  <Input defaultValue="P-892301" />
                </Field>
                <Field id="c32-brand" label="Marca y modelo">
                  <Input defaultValue="Nissan Frontier 2020" />
                </Field>
                <Field id="c32-status" label="Estado inicial">
                  <Select defaultValue="diag">
                    <option value="diag">En diagnóstico</option>
                    <option value="rep">En reparación</option>
                  </Select>
                </Field>
              </FormLayout>
            </div>
          </div>
        </div>
      )

    case 'C33':
      return <PreviewLayoutPreview />

    case 'C66':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c66">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              MediaSlot para reserva geométrica neutral (F07 4:2807 / F02 4:3)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MediaSlot aspectRatio="16:9" label="Diagrama 16:9" />
              <MediaSlot aspectRatio="4:3" label="Fotografía de bahía 4:3" />
            </div>
          </div>
        </div>
      )

    case 'C34':
      return <DataTablePreview />

    case 'C35':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c35">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Lista adaptable agrupada con acciones de registro (F05 4:1636 /
              F13 4:6243)
            </h4>
            <DataList
              groupBy={(item) => item.category}
              items={[
                {
                  id: '1',
                  title: 'Alejandro Morales',
                  category: 'Clientes VIP',
                  phone: '099111222',
                  vehicles: 'Toyota Corolla',
                },
                {
                  id: '2',
                  title: 'Beatriz Solís',
                  category: 'Clientes Nuevos',
                  phone: '099333444',
                  vehicles: 'Nissan Versa',
                },
                {
                  id: '3',
                  title: 'Carlos Delgado',
                  category: 'Clientes VIP',
                  phone: '099555666',
                  vehicles: 'Chevrolet D-Max',
                },
              ]}
              keyExtractor={(item) => item.id}
              label="Directorio de Clientes"
              renderItem={(item) => (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="text-xs text-ink-muted">
                      {item.vehicles} · {item.phone}
                    </p>
                  </div>
                  <RowActions label={`Acciones para ${item.title}`}>
                    <Button size="40" variant="secondary">
                      Ficha
                    </Button>
                  </RowActions>
                </div>
              )}
            />
          </div>
        </div>
      )

    case 'C36':
      return <PaginationPreview />

    case 'C38':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c38">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Acciones de fila con botones directos y menú contextual (F05
              4:2009 / F04 4:1497)
            </h4>
            <div className="p-6 rounded-group bg-surface border border-line flex items-center justify-between">
              <div>
                <p className="font-bold text-ink">Orden #OT-2026-089</p>
                <p className="text-xs text-ink-muted">
                  Toyota Hilux · Mantenimiento mayor
                </p>
              </div>
              <RowActions label="Acciones de la orden OT-2026-089">
                <Button size="40" variant="secondary">
                  Ver detalle
                </Button>
                <DropdownMenu
                  items={[
                    { id: 'print', label: 'Imprimir comprobante' },
                    { id: 'share', label: 'Compartir enlace' },
                    { id: 'sep', label: '', divider: true },
                    { id: 'cancel', label: 'Anular orden', destructive: true },
                  ]}
                  trigger={
                    <Button size="40" variant="quiet">
                      Más
                    </Button>
                  }
                />
              </RowActions>
            </div>
          </div>
        </div>
      )

    case 'C39':
      return <DetailPanelPreview />

    case 'C40':
      return <DrawerPreview />

    case 'C41':
      return <ModalPreview />

    case 'C42':
      return <ConfirmationPanelPreview />

    case 'C43':
      return <AuthLayoutPreview />

    case 'C37':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c37">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Insignias de estado (Forma de píldora estándar con rol status)
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge label="Activo" tone="success" />
              <StatusBadge label="En proceso" tone="info" />
              <StatusBadge label="Pendiente" tone="warning" />
              <StatusBadge label="Anulado" tone="danger" />
              <StatusBadge label="Borrador" tone="neutral" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Variante rectangular (F03 4:976)
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                label="Completado"
                shape="rectangle"
                tone="success"
              />
              <StatusBadge label="Rechazado" shape="rectangle" tone="danger" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">
              Variante de etiqueta de categoría (sin anunciar como resultado de
              estado, F13 4:6246)
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                kind="category"
                label="Mantenimiento preventivo"
                tone="neutral"
              />
              <StatusBadge
                kind="category"
                label="Mecánica especializada"
                tone="neutral"
              />
            </div>
          </div>
        </div>
      )

    case 'C44':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c44">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado de carga con spinner y reduced-motion accesible
            </h4>
            <div className="p-4 rounded-group bg-surface border border-line">
              <LoadingState label="Cargando historial del vehículo…" />
            </div>
          </div>
        </div>
      )

    case 'C45':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c45">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado vacío inicial con acción de creación
            </h4>
            <EmptyState
              action={<Button variant="primary">Crear primer registro</Button>}
              description="Aún no se han registrado órdenes en esta sede del taller."
              title="No hay órdenes registradas"
            />
          </div>
        </div>
      )

    case 'C46':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c46">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado de error con detalle y botón de reintento
            </h4>
            <ErrorState
              message="No se pudo establecer conexión con el servidor de auditoría. Verifique su red."
              onRetry={() => {}}
              title="Fallo al cargar datos"
            />
          </div>
        </div>
      )

    case 'C47':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c47">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Estado de éxito para confirmación de operaciones (F20 4:9341)
            </h4>
            <SuccessState
              message="La orden de servicio #1042 ha sido registrada y notificada al cliente."
              title="Operación completada"
            />
          </div>
        </div>
      )

    case 'C48':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c48">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Búsqueda sin coincidencias con acción para restablecer filtros
            </h4>
            <NoResultsState onClear={() => {}} />
          </div>
        </div>
      )

    case 'C49':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c49">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              ChartContainer con conmutación gráfica / tabla accesible (F02
              4:117, 4:92)
            </h4>
            <ChartContainer
              title="Resumen de actividad semanal"
              subtitle="Métricas comparativas del taller"
              legend={
                <ChartLegend
                  items={[
                    {
                      id: '1',
                      label: 'Órdenes ingresadas',
                      color: '#605bff',
                      value: 92,
                    },
                    {
                      id: '2',
                      label: 'Órdenes completadas',
                      color: '#10b981',
                      value: 84,
                    },
                  ]}
                />
              }
              tableAlternative={
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="py-2 font-semibold">Día</th>
                      <th className="py-2 font-semibold">Órdenes</th>
                      <th className="py-2 font-semibold">Completadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-line/50">
                      <td className="py-1.5">Lun</td>
                      <td>12</td>
                      <td>10</td>
                    </tr>
                    <tr className="border-b border-line/50">
                      <td className="py-1.5">Mar</td>
                      <td>15</td>
                      <td>14</td>
                    </tr>
                    <tr className="border-b border-line/50">
                      <td className="py-1.5">Mié</td>
                      <td>18</td>
                      <td>16</td>
                    </tr>
                    <tr className="border-b border-line/50">
                      <td className="py-1.5">Jue</td>
                      <td>22</td>
                      <td>20</td>
                    </tr>
                    <tr>
                      <td className="py-1.5">Vie</td>
                      <td>25</td>
                      <td>24</td>
                    </tr>
                  </tbody>
                </table>
              }
            >
              <LineAreaChart
                data={[
                  { label: 'Lun', value: 12 },
                  { label: 'Mar', value: 15 },
                  { label: 'Mié', value: 18 },
                  { label: 'Jue', value: 22 },
                  { label: 'Vie', value: 25 },
                ]}
                showArea
                color="#605bff"
                height={200}
              />
            </ChartContainer>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              ChartContainer en estado vacío
            </h4>
            <ChartContainer
              title="Métricas mensuales"
              empty
              emptyMessage="No se registran datos para el periodo seleccionado."
            >
              <div />
            </ChartContainer>
          </div>
        </div>
      )

    case 'C50':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c50">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              LineAreaChart con relleno de área y puntos accesibles (F02 4:123,
              4:148)
            </h4>
            <div className="rounded-xl border border-line/40 bg-surface p-4">
              <LineAreaChart
                data={[
                  { label: 'Sem 1', value: 24 },
                  { label: 'Sem 2', value: 42 },
                  { label: 'Sem 3', value: 35 },
                  { label: 'Sem 4', value: 68 },
                  { label: 'Sem 5', value: 50 },
                ]}
                showArea
                color="#605bff"
                height={220}
                ariaLabel="Tendencia mensual de servicios"
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              LineAreaChart con valores en cero y valores nulos
            </h4>
            <div className="rounded-xl border border-line/40 bg-surface p-4">
              <LineAreaChart
                data={[
                  { label: 'Ene', value: 15 },
                  { label: 'Feb', value: 0 },
                  { label: 'Mar', value: null },
                  { label: 'Abr', value: 30 },
                  { label: 'May', value: 45 },
                ]}
                color="#10b981"
                height={180}
                ariaLabel="Serie con valores nulos y ceros"
              />
            </div>
          </div>
        </div>
      )

    case 'C51':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c51">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              DonutChart con segmentos y total central (F02 4:104, F11 4:4581)
            </h4>
            <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-line/40 bg-surface p-6">
              <DonutChart
                data={[
                  {
                    id: '1',
                    label: 'Mantenimiento Preventivo',
                    value: 52,
                    color: '#605bff',
                  },
                  {
                    id: '2',
                    label: 'Reparación Mayor',
                    value: 28,
                    color: '#10b981',
                  },
                  {
                    id: '3',
                    label: 'Diagnóstico Electrónico',
                    value: 20,
                    color: '#f59e0b',
                  },
                ]}
                centerLabel="Total Servicios"
                size={190}
                strokeWidth={22}
                ariaLabel="Distribución de tipos de servicios"
              />
              <ChartLegend
                orientation="vertical"
                items={[
                  {
                    id: '1',
                    label: 'Mantenimiento Preventivo',
                    color: '#605bff',
                    value: 52,
                  },
                  {
                    id: '2',
                    label: 'Reparación Mayor',
                    color: '#10b981',
                    value: 28,
                  },
                  {
                    id: '3',
                    label: 'Diagnóstico Electrónico',
                    color: '#f59e0b',
                    value: 20,
                  },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col items-center rounded-xl border border-line/40 bg-surface p-4">
              <h5 className="text-xs font-semibold text-ink-muted mb-2">
                Total en Cero
              </h5>
              <DonutChart
                data={[
                  { label: 'Tipo A', value: 0 },
                  { label: 'Tipo B', value: 0 },
                ]}
                centerLabel="Sin registros"
                size={140}
                strokeWidth={16}
              />
            </div>
            <div className="flex flex-col items-center rounded-xl border border-line/40 bg-surface p-4">
              <h5 className="text-xs font-semibold text-ink-muted mb-2">
                Sin Datos
              </h5>
              <DonutChart
                data={[]}
                emptyMessage="Sin información"
                size={140}
                strokeWidth={16}
              />
            </div>
          </div>
        </div>
      )

    case 'C52':
      return (
        <div className="space-y-6 w-full max-w-2xl" data-testid="preview-c52">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              BarChart vertical con rejilla y etiquetas (F07 4:2819)
            </h4>
            <div className="rounded-xl border border-line/40 bg-surface p-4">
              <BarChart
                data={[
                  { id: 'b1', label: 'Lun', value: 45, color: '#605bff' },
                  { id: 'b2', label: 'Mar', value: 78, color: '#605bff' },
                  { id: 'b3', label: 'Mié', value: 62, color: '#605bff' },
                  { id: 'b4', label: 'Jue', value: 90, color: '#605bff' },
                  { id: 'b5', label: 'Vie', value: 84, color: '#605bff' },
                  { id: 'b6', label: 'Sáb', value: 35, color: '#605bff' },
                ]}
                orientation="vertical"
                height={220}
                ariaLabel="Productividad semanal por día"
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              BarChart horizontal con barras proporcionales y valores (F11
              4:4729)
            </h4>
            <div className="rounded-xl border border-line/40 bg-surface p-4">
              <BarChart
                data={[
                  { id: 'h1', label: 'Frenos', value: 34, color: '#605bff' },
                  { id: 'h2', label: 'Motor', value: 28, color: '#10b981' },
                  {
                    id: 'h3',
                    label: 'Suspensión',
                    value: 19,
                    color: '#f59e0b',
                  },
                  { id: 'h4', label: 'Eléctrico', value: 15, color: '#06b6d4' },
                ]}
                orientation="horizontal"
                ariaLabel="Distribución de averías mecánicas"
              />
            </div>
          </div>
        </div>
      )

    case 'C53':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c53">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              ChartLegend horizontal con valores numéricos (F02 4:94)
            </h4>
            <div className="rounded-xl border border-line/40 bg-surface p-4">
              <ChartLegend
                orientation="horizontal"
                items={[
                  {
                    id: 'l1',
                    label: 'Pendientes',
                    color: '#f59e0b',
                    value: 14,
                  },
                  {
                    id: 'l2',
                    label: 'En proceso',
                    color: '#605bff',
                    value: 28,
                  },
                  {
                    id: 'l3',
                    label: 'Completadas',
                    color: '#10b981',
                    value: 65,
                  },
                ]}
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              ChartLegend vertical estructurada (F11 4:4571)
            </h4>
            <div className="rounded-xl border border-line/40 bg-surface p-4 max-w-xs">
              <ChartLegend
                orientation="vertical"
                items={[
                  {
                    id: 'v1',
                    label: 'Taller Norte',
                    color: '#605bff',
                    value: '124 trab.',
                  },
                  {
                    id: 'v2',
                    label: 'Taller Sur',
                    color: '#10b981',
                    value: '98 trab.',
                  },
                  {
                    id: 'v3',
                    label: 'Taller Central',
                    color: '#06b6d4',
                    value: '142 trab.',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )

    case 'C54':
      return (
        <div className="space-y-6 w-full max-w-xl" data-testid="preview-c54">
          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Progress lineal por tonos y tamaños (F07 4:2877)
            </h4>
            <div className="space-y-4 rounded-xl border border-line/40 bg-surface p-4">
              <Progress
                label="Capacidad de taller (sm - primary)"
                size="sm"
                tone="primary"
                value={65}
                showValue
              />
              <Progress
                label="Eficiencia operativa (md - success)"
                size="md"
                tone="success"
                value={88}
                showValue
              />
              <Progress
                label="Tiempo de espera (lg - warning)"
                size="lg"
                tone="warning"
                value={45}
                showValue
              />
              <Progress
                label="Alerta de retraso (md - danger)"
                size="md"
                tone="danger"
                value={92}
                showValue
              />
              <Progress
                label="Sincronizando estado (indeterminado)"
                indeterminate
                tone="primary"
              />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Progress circular por tamaños (F11 4:4732)
            </h4>
            <div className="flex items-center justify-around rounded-xl border border-line/40 bg-surface p-6">
              <Progress
                variant="circular"
                size="sm"
                tone="primary"
                value={40}
                showValue
                label="sm (40%)"
              />
              <Progress
                variant="circular"
                size="md"
                tone="success"
                value={75}
                showValue
                label="md (75%)"
              />
              <Progress
                variant="circular"
                size="lg"
                tone="warning"
                value={90}
                showValue
                label="lg (90%)"
              />
              <Progress
                variant="circular"
                size="md"
                tone="primary"
                indeterminate
                label="Cargando"
              />
            </div>
          </div>
        </div>
      )

    case 'C55':
      return <CalendarToolbarPreview />

    case 'C56':
      return <MiniCalendarPreview />

    case 'C57':
      return <MonthCalendarPreview />

    case 'C58':
      return <YearCalendarPreview />

    case 'C59':
      return <DayCalendarPreview />

    case 'C60':
      return <TimelinePreview />

    case 'C61':
    case 'C62':
      return <BoardPreview />

    case 'C63':
      return <ConversationListPreview />

    case 'C64':
      return <MessageBubblePreview />

    case 'C65':
      return <MessageComposerPreview />

    default:
      return null
  }
}
