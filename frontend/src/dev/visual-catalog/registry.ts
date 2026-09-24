/**
 * Catálogo visual Tallkit: registro de componentes y patrones compartidos. Cada entrada
 * indica el tablero de la maqueta Tallkit que la origina o que es una adaptación del
 * proyecto; ninguna se atribuye a plantillas de terceros.
 */

export type CatalogFamily =
  | 'fundamentos'
  | 'acciones'
  | 'campos'
  | 'combobox'
  | 'tablas'
  | 'estados'
  | 'taller'
  | 'superposiciones'
  | 'notificaciones'
  | 'navegacion'
  | 'patrones'

export const FAMILY_LABELS: Record<CatalogFamily, string> = {
  fundamentos: 'Fundamentos',
  acciones: 'Acciones',
  campos: 'Campos',
  combobox: 'Combobox',
  tablas: 'Tablas y listas',
  estados: 'Estados',
  taller: 'Piezas del taller',
  superposiciones: 'Superposiciones',
  notificaciones: 'Notificaciones',
  navegacion: 'Navegación',
  patrones: 'Patrones de pantalla',
}

/** Tablero de la maqueta «Tallkit — Sistema visual», o adaptación propia del proyecto. */
export type CatalogSource =
  | { kind: 'tablero'; board: string }
  | { kind: 'adaptacion'; reason: string }

export interface CatalogEntry {
  id: string
  name: string
  family: CatalogFamily
  source: CatalogSource
  tokens: string[]
  variants: string[]
  consumers: string[]
  description: string
  acceptanceCriteria: string[]
  knownDifferences: string[]
}

type CatalogEntryDefinition = Omit<
  CatalogEntry,
  'acceptanceCriteria' | 'knownDifferences'
> & {
  acceptanceCriteria?: string[]
  knownDifferences?: string[]
}

function defineEntry(entry: CatalogEntryDefinition): CatalogEntry {
  return {
    ...entry,
    acceptanceCriteria: entry.acceptanceCriteria ?? [entry.description],
    knownDifferences:
      entry.knownDifferences ??
      (entry.source.kind === 'adaptacion' ? [entry.source.reason] : []),
  }
}

const board = (name: string): CatalogSource => ({
  kind: 'tablero',
  board: name,
})

export const CATALOG: CatalogEntry[] = (
  [
    {
      id: 'TK-01',
      name: 'Color y superficies',
      family: 'fundamentos',
      source: board('Fundamentos'),
      tokens: [
        'canvas',
        'surface',
        'line',
        'ink',
        'primary',
        'accent',
        'brand',
      ],
      variants: ['Marca', 'Neutros', 'Estados', 'Ámbitos fiscales'],
      consumers: ['Toda la aplicación'],
      description:
        'Azul Tallkit para la acción, petróleo para selección y foco, neutros en capas y el naranja del logotipo solo como acento.',
    },
    {
      id: 'TK-02',
      name: 'Tipografía',
      family: 'fundamentos',
      source: board('Fundamentos'),
      tokens: ['font-sans', 'font-mono'],
      variants: ['Página', 'Panel', 'Cuerpo', 'Tabla', 'Etiqueta', 'Código'],
      consumers: ['Toda la aplicación'],
      description:
        'IBM Plex Sans para la interfaz e IBM Plex Mono para códigos, placas, RUC y números internos, servidas desde la instalación.',
    },
    {
      id: 'TK-03',
      name: 'Botones',
      family: 'acciones',
      source: board('Fundamentos'),
      tokens: ['primary', 'line-strong', 'accent', 'danger', 'radius-control'],
      variants: [
        'Principal',
        'Secundario',
        'Discreto',
        'Peligro',
        'Peligro sólido',
        'Icono',
        'Deshabilitado',
        'Procesando',
      ],
      acceptanceCriteria: [
        'La variante procesando impide envíos repetidos.',
        'Las acciones principal, secundaria y destructiva conservan jerarquías distintas.',
      ],
      consumers: ['Formularios', 'Listas', 'Diálogos'],
      description:
        'La acción principal domina; la destructiva se reconoce por texto y tratamiento, no solo por color.',
    },
    {
      id: 'TK-04',
      name: 'Campos de formulario',
      family: 'campos',
      source: board('Fundamentos'),
      tokens: ['surface', 'line-strong', 'accent', 'danger'],
      variants: ['Texto', 'Selector', 'Casilla', 'Área', 'Fecha', 'Error'],
      consumers: ['Formularios en página y en modal'],
      description:
        'Etiqueta real, ayuda y error asociados al control; el valor se conserva ante un error.',
    },
    {
      id: 'TK-05',
      name: 'Selección segmentada y pestañas',
      family: 'campos',
      source: board('Nueva venta'),
      tokens: ['surface-muted', 'accent'],
      variants: ['Condición de venta', 'Pestañas de ficha'],
      consumers: ['Editor de venta', 'Fichas'],
      description:
        'Contado y crédito como opciones exclusivas; pestañas con subrayado petróleo.',
    },
    {
      id: 'TK-06',
      name: 'Combobox de referencias',
      family: 'combobox',
      source: board('Nueva venta'),
      tokens: ['surface', 'line-strong', 'shadow-menu', 'accent-soft'],
      variants: ['Vacío', 'Con resultados', 'Seleccionado', 'Inactivo'],
      consumers: ['Clientes y productos en ventas', 'Proveedores en ingresos'],
      description:
        'Búsqueda en servidor con resultados flotantes, teclado completo y referencias inactivas no seleccionables.',
    },
    {
      id: 'TK-07',
      name: 'Tabla contenida',
      family: 'tablas',
      source: board('Lista de ventas'),
      tokens: ['surface', 'surface-subtle', 'line', 'radius-panel'],
      variants: ['Escritorio', 'Filas compactas en teléfono', 'Paginación'],
      consumers: ['Todas las listas'],
      description:
        'Tabla en un panel con encabezado gris, filas compactas e importes alineados a la derecha.',
    },
    {
      id: 'TK-08',
      name: 'Estados y ámbitos fiscales',
      family: 'estados',
      source: board('Fundamentos'),
      tokens: ['success', 'warning', 'danger', 'info', 'scope-*'],
      variants: ['Borrador', 'Confirmada', 'Pendiente', 'Anulada', 'RUC'],
      consumers: ['Listas', 'Fichas', 'Barra superior'],
      description:
        'Distintivo rectangular con marcador y texto; cada RUC con su tono e icono.',
    },
    {
      id: 'TK-09',
      name: 'Estados de contenido',
      family: 'estados',
      source: board('Estados'),
      tokens: ['surface', 'surface-muted', 'danger-soft'],
      variants: ['Vacío', 'Sin resultados', 'Carga', 'Error', 'Sin permiso'],
      consumers: ['Paneles que consultan datos'],
      description:
        'Viven dentro de su panel y nunca muestran datos inventados.',
    },
    {
      id: 'TK-10',
      name: 'Avisos en línea',
      family: 'estados',
      source: board('Estados'),
      tokens: ['info-soft', 'warning-soft', 'danger-soft', 'success-soft'],
      variants: ['Información', 'Advertencia', 'Error', 'Éxito'],
      consumers: ['Formularios', 'Diálogos', 'Visor del documento'],
      description:
        'Advertencias y errores que exigen actuar permanecen junto a lo afectado.',
    },
    {
      id: 'TK-11',
      name: 'Placa, código, existencias e importes',
      family: 'taller',
      source: board('Fundamentos'),
      tokens: ['font-mono', 'line-strong', 'success', 'danger'],
      variants: ['Placa', 'Código copiable', 'Existencias', 'Importe o guion'],
      consumers: ['Vehículos', 'Productos', 'Ventas', 'Inventario'],
      description:
        'Piezas propias del negocio; las existencias muestran la cantidad y «Agotado» en cero, sin umbrales.',
    },
    {
      id: 'TK-12',
      name: 'Hoja del documento interno',
      family: 'taller',
      source: board('Nueva venta'),
      tokens: ['surface', 'shadow-sheet', 'workspace'],
      variants: ['Borrador', 'Confirmado'],
      consumers: ['Vista previa de venta', 'Comprobante', 'Impresión'],
      description:
        'Hoja A4 con marca Tallkit, número pendiente o asignado y el aviso de que no es una factura electrónica.',
    },
    {
      id: 'TK-13',
      name: 'Modal de formulario corto',
      family: 'superposiciones',
      source: board('Formulario corto en modal'),
      tokens: ['radius-dialog', 'shadow-dialog', 'surface-subtle'],
      variants: ['Nuevo', 'Con cambios sin guardar', 'Guardar y crear otro'],
      consumers: ['Catálogos auxiliares', 'Servicios', 'Usuarios', 'Ajustes'],
      description:
        'Formulario de pocos campos sobre la lista de origen; advierte antes de descartar cambios.',
    },
    {
      id: 'TK-14',
      name: 'Diálogos de confirmación',
      family: 'superposiciones',
      source: board('Diálogos de ventas'),
      tokens: ['radius-dialog', 'shadow-dialog', 'danger'],
      variants: ['Confirmación', 'Peligro'],
      consumers: ['Confirmar, cobrar, anular, desactivar'],
      description:
        'Nombra el objeto, explica el efecto en el cuerpo y usa un texto breve en la acción.',
    },
    {
      id: 'TK-15',
      name: 'Menú contextual',
      family: 'superposiciones',
      source: {
        kind: 'adaptacion',
        reason: 'La maqueta solo muestra el disparador de acciones por fila.',
      },
      tokens: ['shadow-menu', 'line', 'danger'],
      variants: ['Acciones', 'Destructiva'],
      consumers: ['Acciones por fila'],
      description:
        'Menú flotante con borde fino y sombra; la opción destructiva se nombra en rojo.',
    },
    {
      id: 'TK-16',
      name: 'Notificación temporal',
      family: 'notificaciones',
      source: board('Toasts: variantes y reglas'),
      tokens: ['ink', 'shadow-toast'],
      variants: ['Creado', 'Actualizado', 'Informativo'],
      consumers: ['Toda acción terminada con éxito'],
      description:
        'Abajo a la derecha, 6 s, pausable, hasta tres; nunca para errores.',
    },
    {
      id: 'TK-17',
      name: 'Navegación y barra superior',
      family: 'navegacion',
      source: board('Lista de ventas'),
      tokens: ['surface', 'accent-soft', 'accent-strong'],
      variants: ['Escritorio 240 px', 'Tableta 72 px', 'Teléfono'],
      consumers: ['Marco autenticado'],
      description:
        'Grupos por área de trabajo, ruta de migas y ámbito fiscal; sin búsqueda global.',
    },
    {
      id: 'TK-18',
      name: 'Patrones de pantalla',
      family: 'patrones',
      source: board('Lista de ventas'),
      tokens: ['canvas', 'surface', 'line'],
      variants: ['Lista', 'Ficha', 'Formulario por secciones', 'Editor'],
      consumers: ['Todas las pantallas'],
      description:
        'Composición de encabezado, filtros, panel de datos y acciones que siguen todas las páginas.',
    },
  ] satisfies CatalogEntryDefinition[]
).map(defineEntry)

export function findEntry(id: string | null): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.id === id)
}

export function filterCatalog(
  query: string,
  family: CatalogFamily | null,
): CatalogEntry[] {
  const needle = query.trim().toLowerCase()
  return CATALOG.filter(
    (entry) =>
      (family === null || entry.family === family) &&
      (needle === '' ||
        `${entry.id} ${entry.name} ${entry.description}`
          .toLowerCase()
          .includes(needle)),
  )
}
