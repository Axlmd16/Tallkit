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

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = '40' | '50'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-primary bg-primary text-white hover:border-primary-strong hover:bg-primary-strong',
  secondary:
    'border-transparent bg-primary-soft text-primary-strong hover:bg-primary/15',
  quiet:
    'border-transparent bg-transparent text-ink-muted hover:bg-surface-selected hover:text-primary',
  danger:
    'border-danger/10 bg-danger-soft text-danger hover:border-danger/20 hover:bg-danger/15',
}

const buttonSizes: Record<ButtonSize, string> = {
  '40': 'min-h-10 px-4 py-2 text-sm',
  '50': 'min-h-[50px] px-6 py-3 text-base',
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
        className={`ui-button inline-flex items-center justify-center gap-2 rounded-group border font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
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
    const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-group'
    const sizeClass =
      targetSize === 'touch44' ? 'size-11 min-w-11 min-h-11' : 'size-10'

    return (
      <Button
        aria-label={label}
        className={`shrink-0 px-0 ${sizeClass} ${shapeClass} ${className}`}
        ref={ref}
        title={label}
        variant="quiet"
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
}: {
  children: ReactNode
  error?: string | undefined
  hint?: string | undefined
  id?: string | undefined
  label: string
  className?: string
}) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ describedBy, id, invalid: Boolean(error) }}>
      <div className={`ui-field ${className}`}>
        <label className="block text-sm font-semibold text-ink" htmlFor={id}>
          {label}
        </label>
        {hint && (
          <p className="mt-1 text-sm text-ink-muted" id={hintId}>
            {hint}
          </p>
        )}
        <div className="mt-2">{children}</div>
        {error && (
          <p className="mt-2 text-sm font-semibold text-danger" id={errorId}>
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
  const densityClass = density === 'compact42' ? 'min-h-[42px]' : 'min-h-[50px]'
  return `ui-control ${densityClass} w-full ${radiusClass} border border-transparent bg-surface-muted px-4 py-2.5 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:bg-surface-selected/50 focus:border-primary/35 focus:bg-surface focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-danger/45 aria-invalid:bg-danger-soft aria-invalid:shadow-[0_0_0_3px_rgb(209_26_42_/_0.08)]`
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
        className={`inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-sm font-semibold text-ink ${className}`}
      >
        <input
          aria-checked={indeterminate ? 'mixed' : props.checked}
          className={`${sizeClass} rounded accent-primary`}
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
    <p className="text-sm font-semibold text-danger" role="alert">
      {children}
    </p>
  )
}
