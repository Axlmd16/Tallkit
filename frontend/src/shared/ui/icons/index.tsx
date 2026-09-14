import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Check,
  Eye,
  EyeSlash,
  Funnel,
  Gear,
  Key,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShieldCheck,
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

// Iconos nativos exactos de Figma exportados localmente
function CategoryIcon({
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.54 0H5.92C7.33 0 8.46 1.15 8.46 2.561V5.97C8.46 7.39 7.33 8.53 5.92 8.53H2.54C1.14 8.53 0 7.39 0 5.97V2.561C0 1.15 1.14 0 2.54 0ZM2.54 11.4697H5.92C7.33 11.4697 8.46 12.6107 8.46 14.0307V17.4397C8.46 18.8497 7.33 19.9997 5.92 19.9997H2.54C1.14 19.9997 0 18.8497 0 17.4397V14.0307C0 12.6107 1.14 11.4697 2.54 11.4697ZM17.4601 0H14.0801C12.6701 0 11.5401 1.15 11.5401 2.561V5.97C11.5401 7.39 12.6701 8.53 14.0801 8.53H17.4601C18.8601 8.53 20.0001 7.39 20.0001 5.97V2.561C20.0001 1.15 18.8601 0 17.4601 0ZM14.0801 11.4697H17.4601C18.8601 11.4697 20.0001 12.6107 20.0001 14.0307V17.4397C20.0001 18.8497 18.8601 19.9997 17.4601 19.9997H14.0801C12.6701 19.9997 11.5401 18.8497 11.5401 17.4397V14.0307C11.5401 12.6107 12.6701 11.4697 14.0801 11.4697Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ChartIcon({
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.33 0H14.669C18.07 0 19.99 1.929 20 5.33V14.67C20 18.07 18.07 20 14.669 20H5.33C1.929 20 0 18.07 0 14.67V5.33C0 1.929 1.929 0 5.33 0ZM10.049 15.86C10.48 15.86 10.839 15.54 10.879 15.11V4.92C10.919 4.61 10.77 4.299 10.5 4.13C10.219 3.96 9.879 3.96 9.61 4.13C9.339 4.299 9.19 4.61 9.219 4.92V15.11C9.27 15.54 9.629 15.86 10.049 15.86ZM14.65 15.86C15.07 15.86 15.429 15.54 15.48 15.11V11.83C15.509 11.509 15.36 11.21 15.089 11.04C14.82 10.87 14.48 10.87 14.2 11.04C13.929 11.21 13.78 11.509 13.82 11.83V15.11C13.86 15.54 14.219 15.86 14.65 15.86ZM6.219 15.11C6.179 15.54 5.82 15.86 5.389 15.86C4.959 15.86 4.599 15.54 4.56 15.11V8.2C4.53 7.889 4.679 7.58 4.95 7.41C5.219 7.24 5.56 7.24 5.83 7.41C6.099 7.58 6.25 7.889 6.219 8.2V15.11Z"
        fill="currentColor"
      />
    </svg>
  )
}

function DocumentIcon({
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.81 0H13.191C16.28 0 18 1.78 18 4.83V15.16C18 18.26 16.28 20 13.191 20H4.81C1.77 20 0 18.26 0 15.16V4.83C0 1.78 1.77 0 4.81 0ZM5.08 4.66V4.65H8.069C8.5 4.65 8.85 5 8.85 5.429C8.85 5.87 8.5 6.22 8.069 6.22H5.08C4.649 6.22 4.3 5.87 4.3 5.44C4.3 5.01 4.649 4.66 5.08 4.66ZM5.08 10.74H12.92C13.35 10.74 13.7 10.39 13.7 9.96C13.7 9.53 13.35 9.179 12.92 9.179H5.08C4.649 9.179 4.3 9.53 4.3 9.96C4.3 10.39 4.649 10.74 5.08 10.74ZM5.08 15.31H12.92C13.319 15.27 13.62 14.929 13.62 14.53C13.62 14.12 13.319 13.78 12.92 13.74H5.08C4.78 13.71 4.49 13.85 4.33 14.11C4.17 14.36 4.17 14.69 4.33 14.95C4.49 15.2 4.78 15.35 5.08 15.31Z"
        fill="currentColor"
      />
    </svg>
  )
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
  category: { label: 'Categoría / Menú', component: CategoryIcon },
  chart: { label: 'Gráfico / Estadísticas', component: ChartIcon },
  document: { label: 'Documento / Factura', component: DocumentIcon },
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

  const IconComponent = iconDef.component
  const isAccessible = Boolean(ariaLabel)

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
