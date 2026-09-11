import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean
  pendingLabel?: string
  variant?: ButtonVariant
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
      ...props
    },
    ref,
  ) {
    return (
      <button
        aria-busy={pending || undefined}
        className={`ui-button inline-flex min-h-10 items-center justify-center gap-2 rounded-group border px-4 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
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

type IconButtonProps = Omit<ButtonProps, 'children' | 'aria-label'> & {
  icon: ReactNode
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, label, ...props }, ref) {
    return (
      <Button
        aria-label={label}
        className="size-10 shrink-0 px-0"
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

export function ButtonGroup({
  children,
  label,
  className = '',
}: {
  children: ReactNode
  label: string
  className?: string
}) {
  return (
    <div
      aria-label={label}
      className={`flex flex-wrap items-center gap-2 ${className}`}
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

const controlClass =
  'ui-control min-h-[50px] w-full rounded-control border border-transparent bg-surface-muted px-4 py-2.5 text-sm text-ink outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:bg-surface-selected/50 focus:border-primary/35 focus:bg-surface focus:shadow-[0_0_0_3px_rgb(96_91_255_/_0.12)] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-danger/45 aria-invalid:bg-danger-soft aria-invalid:shadow-[0_0_0_3px_rgb(209_26_42_/_0.08)]'

function useFieldProps() {
  const field = useContext(FieldContext)
  return field
    ? {
        'aria-describedby': field.describedBy,
        'aria-invalid': field.invalid,
        id: field.id,
      }
    : {}
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = '', ...props }, ref) {
  return (
    <input
      className={`${controlClass} ${className}`}
      ref={ref}
      {...useFieldProps()}
      {...props}
    />
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ children, className = '', ...props }, ref) {
  return (
    <select
      className={`${controlClass} ${className}`}
      ref={ref}
      {...useFieldProps()}
      {...props}
    >
      {children}
    </select>
  )
})

export function Checkbox({
  label,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
}) {
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-sm font-semibold text-ink ${className}`}
    >
      <input
        className="size-5 rounded accent-primary"
        type="checkbox"
        {...props}
      />
      <span>{label}</span>
    </label>
  )
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold text-danger" role="alert">
      {children}
    </p>
  )
}
