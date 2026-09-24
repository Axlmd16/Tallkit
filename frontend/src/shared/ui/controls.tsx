import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'soft'
  | 'danger'
  | 'danger-solid'
  | 'ghost'
export type ButtonSize = '40' | '50'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-primary bg-primary text-white hover:border-primary-strong hover:bg-primary-strong',
  secondary: 'border-line-strong bg-surface text-ink hover:bg-surface-subtle',
  quiet:
    'border-transparent bg-transparent text-accent hover:bg-accent-soft hover:text-accent-strong',
  /** Acción de sección siempre visible: petróleo suave en reposo, borde petróleo al pasar el cursor. */
  soft: 'border-transparent bg-accent-soft text-accent hover:border-accent/40 hover:text-accent-strong',
  danger:
    'border-danger/30 bg-surface text-danger hover:border-danger/45 hover:bg-danger-soft',
  'danger-solid':
    'border-danger bg-danger text-white hover:border-danger/90 hover:bg-danger/90',
  ghost:
    'border-transparent bg-transparent text-ink-muted hover:bg-surface-subtle hover:text-ink',
}

const buttonSizes: Record<ButtonSize, string> = {
  '40': 'min-h-10 px-4 py-2 text-[13.5px]',
  '50': 'min-h-11 px-5 py-2.5 text-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean
  pendingLabel?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className = '',
      disabled,
      pending = false,
      pendingLabel = 'Procesando…',
      type = 'button',
      variant = 'primary',
      size = '40',
      ...props
    },
    ref,
  ) {
    return (
      <button
        aria-busy={pending || undefined}
        className={`ui-button inline-flex items-center justify-center gap-2 rounded-control border font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
        disabled={disabled || pending}
        ref={ref}
        type={type}
        {...props}
      >
        {pending ? pendingLabel : children}
      </button>
    )
  },
)

export type IconButtonShape = 'square' | 'circle'
export type IconButtonTarget = '40' | 'touch44'

export type IconButtonProps = Omit<ButtonProps, 'children' | 'aria-label'> & {
  icon: ReactNode
  label: string
  shape?: IconButtonShape
  targetSize?: IconButtonTarget
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      shape = 'square',
      targetSize = '40',
      className = '',
      ...props
    },
    ref,
  ) {
    const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-control'
    const sizeClass =
      targetSize === 'touch44' ? 'size-11 min-w-11 min-h-11' : 'size-10'

    return (
      <Button
        aria-label={label}
        className={`shrink-0 px-0 ${sizeClass} ${shapeClass} ${className}`}
        ref={ref}
        title={label}
        variant="ghost"
        {...props}
      >
        <span aria-hidden="true" className="grid place-items-center">
          {icon}
        </span>
      </Button>
    )
  },
)

export interface ButtonGroupProps {
  children: ReactNode
  label: string
  orientation?: 'horizontal' | 'vertical'
  wrap?: boolean
  className?: string
}

export function ButtonGroup({
  children,
  label,
  orientation = 'horizontal',
  wrap = true,
  className = '',
}: ButtonGroupProps) {
  const layoutClass =
    orientation === 'vertical'
      ? 'flex flex-col items-stretch gap-2'
      : wrap
        ? 'flex flex-wrap items-center gap-2'
        : 'flex items-center gap-2'

  return (
    <div
      aria-label={label}
      className={`${layoutClass} ${className}`}
      role="group"
    >
      {children}
    </div>
  )
}

type FieldContextValue = {
  describedBy: string | undefined
  id: string
  invalid: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

export function Field({
  children,
  error,
  hint,
  id: providedId,
  label,
  className = '',
  required = false,
  hideLabel = false,
}: {
  children: ReactNode
  error?: string | undefined
  hint?: string | undefined
  id?: string | undefined
  label: string
  className?: string
  /** Marca visual de obligatorio; va en CSS para no alterar el nombre accesible. */
  required?: boolean
  /** Etiqueta solo para tecnologías de asistencia, cuando el control es autoexplicativo. */
  hideLabel?: boolean
}) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ describedBy, id, invalid: Boolean(error) }}>
      <div className={`ui-field ${className}`}>
        <label
          className={`${hideLabel ? 'sr-only' : 'block text-xs font-semibold text-ink'} ${required ? "after:ml-0.5 after:text-danger after:content-['*']" : ''}`}
          htmlFor={id}
        >
          {label}
        </label>
        <div className={hideLabel ? '' : 'mt-1.5'}>{children}</div>
        {hint && (
          <p className="mt-1 text-xs leading-4 text-ink-muted" id={hintId}>
            {hint}
          </p>
        )}
        {error && (
          <p className="mt-1.5 text-xs font-semibold text-danger" id={errorId}>
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

export type ControlRadius = 'r5' | 'r10'
export type ControlDensity = '50' | 'compact42'

export function getControlClasses({
  density = '50',
  radius = 'r5',
}: {
  density?: ControlDensity
  radius?: ControlRadius
} = {}) {
  const radiusClass = radius === 'r10' ? 'rounded-group' : 'rounded-control'
  const densityClass = density === 'compact42' ? 'min-h-10' : 'min-h-10'
  return `ui-control ${densityClass} w-full ${radiusClass} border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:border-ink-muted/60 focus:border-accent focus:shadow-[0_0_0_3px_rgb(15_107_111_/_0.18)] disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 aria-invalid:border-danger aria-invalid:bg-[#fffaf9] aria-invalid:shadow-none`
}

export function useFieldProps() {
  const field = useContext(FieldContext)
  return field
    ? {
        'aria-describedby': field.describedBy,
        'aria-invalid': field.invalid,
        id: field.id,
      }
    : {}
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  density?: ControlDensity
  radius?: ControlRadius
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', density = '50', radius = 'r5', ...props },
  ref,
) {
  return (
    <input
      className={`${getControlClasses({ density, radius })} ${className}`}
      ref={ref}
      {...useFieldProps()}
      {...props}
    />
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  radius?: ControlRadius
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ children, className = '', radius = 'r5', ...props }, ref) {
    return (
      <select
        className={`${getControlClasses({ radius })} ${className}`}
        ref={ref}
        {...useFieldProps()}
        {...props}
      >
        {children}
      </select>
    )
  },
)

export type CheckboxSize = '15' | '20'

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean
  label: string
  sizeVariant?: CheckboxSize
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      className = '',
      indeterminate = false,
      label,
      sizeVariant = '20',
      ...props
    },
    forwardedRef,
  ) {
    const internalRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = Boolean(indeterminate)
      }
    }, [indeterminate])

    const setRefs = (node: HTMLInputElement | null) => {
      internalRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    const sizeClass = sizeVariant === '15' ? 'size-[15px]' : 'size-5'

    return (
      <label
        className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-1 text-[13.5px] font-medium text-ink ${className}`}
      >
        <input
          aria-checked={indeterminate ? 'mixed' : props.checked}
          className={`${sizeClass} rounded accent-accent`}
          ref={setRefs}
          type="checkbox"
          {...props}
        />
        <span>{label}</span>
      </label>
    )
  },
)

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold text-danger" role="alert">
      {children}
    </p>
  )
}
