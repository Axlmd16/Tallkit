import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  Check,
  Eye,
  EyeSlash,
  FileText,
  Funnel,
  Gear,
  Key,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShieldCheck,
  SquaresFour,
  Trash,
  User,
  X,
  type IconProps as PhosphorIconProps,
} from '@phosphor-icons/react'
import type { ComponentType, SVGProps } from 'react'

export type IconName =
  | 'category'
  | 'document'
  | 'chart'
  | 'user'
  | 'calendar'
  | 'search'
  | 'filter'
  | 'settings'
  | 'plus'
  | 'pencil'
  | 'trash'
  | 'check'
  | 'x'
  | 'caret-down'
  | 'caret-up'
  | 'caret-left'
  | 'caret-right'
  | 'eye'
  | 'eye-slash'
  | 'key'
  | 'shield-check'

export interface IconDefinition {
  label: string
  component: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>
}

function adaptPhosphor(Component: ComponentType<PhosphorIconProps>) {
  return function PhosphorAdapter({
    size = 20,
    ...props
  }: SVGProps<SVGSVGElement> & { size?: number | string }) {
    return <Component size={size} {...(props as PhosphorIconProps)} />
  }
}

export const ICON_MAP: Record<IconName, IconDefinition> = {
  category: {
    label: 'Categoría / Menú',
    component: adaptPhosphor(SquaresFour),
  },
  chart: {
    label: 'Gráfico / Estadísticas',
    component: adaptPhosphor(ChartBar),
  },
  document: {
    label: 'Documento / Factura',
    component: adaptPhosphor(FileText),
  },
  user: { label: 'Usuario / Perfil', component: adaptPhosphor(User) },
  calendar: {
    label: 'Calendario / Fecha',
    component: adaptPhosphor(CalendarBlank),
  },
  search: { label: 'Buscar', component: adaptPhosphor(MagnifyingGlass) },
  filter: { label: 'Filtrar', component: adaptPhosphor(Funnel) },
  settings: { label: 'Configuración', component: adaptPhosphor(Gear) },
  plus: { label: 'Añadir / Crear', component: adaptPhosphor(Plus) },
  pencil: { label: 'Editar', component: adaptPhosphor(PencilSimple) },
  trash: { label: 'Eliminar', component: adaptPhosphor(Trash) },
  check: { label: 'Confirmar / Marcado', component: adaptPhosphor(Check) },
  x: { label: 'Cerrar / Cancelar', component: adaptPhosphor(X) },
  'caret-down': { label: 'Desplegar', component: adaptPhosphor(CaretDown) },
  'caret-up': { label: 'Plegar', component: adaptPhosphor(CaretUp) },
  'caret-left': { label: 'Anterior', component: adaptPhosphor(CaretLeft) },
  'caret-right': { label: 'Siguiente', component: adaptPhosphor(CaretRight) },
  eye: { label: 'Mostrar / Ver', component: adaptPhosphor(Eye) },
  'eye-slash': { label: 'Ocultar', component: adaptPhosphor(EyeSlash) },
  key: { label: 'Seguridad / Contraseña', component: adaptPhosphor(Key) },
  'shield-check': {
    label: 'Verificado / Permiso',
    component: adaptPhosphor(ShieldCheck),
  },
}

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number | string
  'aria-label'?: string
}

export function Icon({
  name,
  size = 20,
  className = '',
  'aria-label': ariaLabel,
  ...props
}: IconProps) {
  const iconDef = ICON_MAP[name]
  if (!iconDef) return null

  const isAccessible = Boolean(ariaLabel)

  const IconComponent = iconDef.component

  return (
    <IconComponent
      size={size}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden={!isAccessible}
      role={isAccessible ? 'img' : undefined}
      aria-label={ariaLabel}
      {...props}
    />
  )
}
