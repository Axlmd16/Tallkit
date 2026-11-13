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
        'graphite',
        'primary',
        'accent',
        'scope-*',
      ],
      variants: ['Cobre', 'Grafito', 'Neutros', 'Estados', 'Negocios'],
      consumers: ['Toda la aplicación'],
      description:
        'Neutros cálidos para casi todo, grafito para la barra lateral y las tarjetas oscuras, cobre solo para la acción principal y lo activo, pizarra y arena para cada negocio, y tres estados apagados.',
    },
    {
      id: 'TK-02',
      name: 'Tipografía',
      family: 'fundamentos',
      source: board('Fundamentos'),
      tokens: [
        'font-sans',
        'text-micro',
        'text-label',
        'text-body',
        'text-lead',
        'text-block',
        'text-figure',
        'text-page',
        'text-display',
        'code',
      ],
      variants: [
        'Página',
        'Bloque',
        'Cuerpo',
        'Etiqueta',
        'Cifra destacada',
        'Código',
      ],
      consumers: ['Toda la aplicación'],
      description:
        'Montserrat servida desde la instalación, con la escala text-* y la utilidad code (cifras tabulares y espaciado) para placas, códigos y números; sin fuente monoespaciada. Las hojas impresas conservan su propia fuente.',
    },
    {
      id: 'TK-03',
      name: 'Botones',
      family: 'acciones',
      source: board('Fundamentos'),
      tokens: [
        'primary',
        'ink',
        'accent',
        'accent-soft',
        'danger',
        'radius-control',
      ],
      variants: [
        'Principal',
        'Secundario',
        'Discreto',
        'Suave',
        'Peligro',
        'Peligro sólido',
        'Icono',
        'Deshabilitado',
        'Procesando',
      ],
      acceptanceCriteria: [
        'La variante procesando impide envíos repetidos.',
        'Las acciones principal, secundaria y destructiva conservan jerarquías distintas.',
        'La variante suave (adaptación del proyecto) conserva el fondo pizarra suave en reposo para acciones de sección.',
        'Solo hay una acción principal en cobre por pantalla.',
      ],
      consumers: [
        'Formularios',
        'Listas',
        'Diálogos',
        'Acciones de sección de la ficha de mantenimiento',
      ],
      description:
        'La acción principal domina; la destructiva se reconoce por texto y tratamiento, no solo por color.',
    },
    {
      id: 'TK-04',
      name: 'Campos de formulario',
      family: 'campos',
      source: board('Fundamentos'),
      tokens: ['surface', 'line-strong', 'accent', 'danger'],
      variants: [
        'Texto',
        'Selector',
        'Casilla',
        'Área',
        'Fecha',
        'Error',
        'Búsqueda subrayada',
      ],
      consumers: ['Formularios en página y en modal'],
      description:
        'Etiqueta real, ayuda y error asociados al control; el valor se conserva ante un error.',
    },
    {
      id: 'TK-05',
      name: 'Selección segmentada y pestañas',
      family: 'campos',
      source: board('Nueva venta'),
      tokens: ['workspace', 'surface', 'primary'],
      variants: [
        'Condición de venta',
        'Segmentos con contador',
        'Pestañas de ficha',
      ],
      consumers: ['Editor de venta', 'Listas', 'Fichas'],
      description:
        'Segmentos en píldora con la opción activa blanca y un contador opcional; pestañas con subrayado cobre de 2 px.',
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
        'Distintivo en píldora con punto y texto; los estados neutros usan grafito sobre gris cálido; cada RUC con su tono e icono.',
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
      tokens: ['code', 'ink', 'surface-muted', 'danger-soft'],
      variants: [
        'Placa',
        'Placa sobre fondo oscuro',
        'Código copiable',
        'Existencias',
        'Importe o guion',
      ],
      consumers: ['Vehículos', 'Productos', 'Ventas', 'Inventario'],
      description:
        'Placa en pieza de tinta (invertida sobre grafito), código en chip gris y existencias en un marcador; muestran la cantidad y «Agotado» en cero, sin umbrales.',
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
      variants: [
        'Nuevo',
        'Con cambios sin guardar',
        'Guardar y crear otro',
        'Ancho (600 px)',
      ],
      consumers: [
        'Catálogos auxiliares',
        'Servicios',
        'Usuarios',
        'Ajustes',
        'Servicios del mantenimiento (ancho)',
        'Visor de fotografías (tamaño media)',
      ],
      description:
        'Formulario de pocos campos sobre la lista de origen; advierte antes de descartar cambios. Los tamaños ancho (600 px) y de visor de imagen son adaptaciones del proyecto; el ancho por omisión sigue siendo 466 px.',
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
      tokens: ['graphite', 'shadow-toast'],
      variants: ['Creado', 'Actualizado', 'Informativo'],
      consumers: ['Toda acción terminada con éxito'],
      description:
        'Grafito con icono, abajo a la derecha, 6 s, pausable, hasta tres; nunca para errores.',
    },
    {
      id: 'TK-17',
      name: 'Navegación y barra superior',
      family: 'navegacion',
      source: board('Lista de ventas'),
      tokens: ['graphite', 'graphite-raised', 'graphite-ink', 'primary'],
      variants: ['Escritorio 264 px', 'Tableta 72 px', 'Teléfono'],
      consumers: ['Marco autenticado'],
      description:
        'Barra lateral grafito con la opción activa elevada y barra cobre, el tacómetro al pie, ruta de migas y ámbito fiscal; sin búsqueda global.',
    },
    {
      id: 'TK-18',
      name: 'Patrones de pantalla',
      family: 'patrones',
      source: board('Lista de ventas'),
      tokens: ['canvas', 'surface', 'line', 'text-page'],
      variants: ['Lista', 'Ficha', 'Formulario por secciones', 'Editor'],
      consumers: ['Todas las pantallas'],
      description:
        'Composición de encabezado, filtros, panel de datos y acciones que siguen todas las páginas.',
    },
    {
      id: 'TK-19',
      name: 'Indicador con conteo',
      family: 'taller',
      source: {
        kind: 'adaptacion',
        reason:
          'Pieza propia del resumen de inicio; la maqueta Tallkit no incluye un tablero de indicadores.',
      },
      tokens: ['surface', 'line', 'ink', 'ink-muted', 'accent', 'scope-*'],
      variants: [
        'Conteo',
        'Importe con detalle',
        'Con ámbito fiscal',
        'Cero atenuado',
        'Carga',
        'Error',
      ],
      consumers: ['Inicio'],
      description:
        'Un valor, su etiqueta y su ámbito fiscal, como enlace a la lista que lo explica. Varios comparten un panel separados por líneas, sin sombra ni una tarjeta por dato.',
    },
    {
      id: 'TK-20',
      name: 'Gráfico breve',
      family: 'taller',
      source: {
        kind: 'adaptacion',
        reason:
          'Pieza propia del resumen de inicio, dibujada con los tokens del sistema y sin librería externa.',
      },
      tokens: ['scope-commercial', 'scope-artisan', 'line-strong', 'ink'],
      variants: [
        'RUC comercial',
        'RUC artesanal',
        'Semana en cero',
        'Sin datos',
        'Carga',
        'Error',
      ],
      consumers: ['Inicio'],
      description:
        'Serie corta de barras de un solo ámbito fiscal con su total. Cada barra se lee como texto con puntero, foco o toque; el cero conserva una línea de base y no hay animación con movimiento reducido.',
    },
    {
      id: 'TK-21',
      name: 'Resumen de inicio',
      family: 'patrones',
      source: {
        kind: 'adaptacion',
        reason:
          'Composición propia de la página de inicio con las piezas del sistema; la maqueta Tallkit no incluye este tablero.',
      },
      tokens: ['canvas', 'surface', 'surface-subtle', 'line', 'scope-*'],
      variants: [
        'Acciones rápidas',
        'Pendientes',
        'Por cobrar',
        'Cobrado en 7 días',
        'Aviso de calificación',
        'Todo al día',
      ],
      consumers: ['Inicio'],
      description:
        'Acciones secundarias con icono, pendientes en un solo panel, saldos por cobrar y cobros recientes separados por entidad fiscal. Cada bloque carga y falla por separado.',
    },
    {
      id: 'TK-22',
      name: 'Motivo del tacómetro',
      family: 'fundamentos',
      source: {
        kind: 'adaptacion',
        reason:
          'Motivo gráfico propio de la dirección «Grafito y cobre» aprobada en U2; la maqueta anterior no lo incluye.',
      },
      tokens: ['graphite', 'graphite-line', 'graphite-ink', 'primary'],
      variants: ['Barra lateral', 'Tarjeta oscura'],
      consumers: ['Barra lateral', 'Ficha de vehículo'],
      description:
        'Tacómetro en líneas finas con un arco y una aguja cobre; es solo decorativo, no recibe foco ni se anuncia.',
    },
    {
      id: 'TK-23',
      name: 'Marca de negocio',
      family: 'taller',
      source: {
        kind: 'adaptacion',
        reason:
          'Pieza nueva de U3 para distinguir a las dos entidades fiscales, cuyos nombres comerciales empiezan igual.',
      },
      tokens: ['scope-artisan', 'scope-commercial', 'radius-control'],
      variants: [
        'Iniciales del taller',
        'Iniciales del almacén',
        'Con logotipo',
      ],
      consumers: ['Rótulo de ámbito fiscal', 'Bloques económicos por negocio'],
      description:
        'Logotipo de la entidad o sus iniciales: círculo pizarra para la artesanal y cuadrado redondeado arena para la comercial; anuncia el nombre de la entidad.',
    },
    {
      id: 'TK-24',
      name: 'Maestro y detalle',
      family: 'patrones',
      source: {
        kind: 'adaptacion',
        reason:
          'Patrón PPF-11 definido en U3; ninguna pantalla lo adopta todavía y se demuestra aquí.',
      },
      tokens: ['surface', 'primary-soft', 'primary', 'line'],
      variants: ['Escritorio', 'Teléfono', 'Sin registro elegido'],
      consumers: ['Ninguna pantalla todavía'],
      description:
        'Lista agrupada a la izquierda y vista previa a la derecha; el elegido se marca con fondo suave, barra de acento y aria-current, y en teléfono se muestran una después de la otra.',
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
