import {
  ArrowCounterClockwise,
  Barcode,
  CheckCircle,
  MagnifyingGlass,
  Plus,
  ShoppingBag,
  X,
} from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { describeProblem } from '@/features/catalog-common/problem'
import { checkoutApi } from '@/features/checkout/api'
import type { CheckoutExecuteResponse } from '@/features/checkout/types'
import { QuantityStepper } from '@/features/maintenance/QuantityStepper'
import { salesApi } from '@/features/sales/api'
import { useCustomerOptions, useProductOptions } from '@/features/sales/hooks'
import type { QuickPayMethod } from '@/features/sales/quickSale'
import type { CustomerOption, ProductOption } from '@/features/sales/types'
import { useBusinessName } from '@/shared/api/entity-logos'
import {
  Checkbox,
  InlineNotice,
  Money,
  StatusBadge,
  useToast,
} from '@/shared/ui'

interface Line {
  product: ProductOption
  quantity: number
}

const METHODS: { value: QuickPayMethod; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CREDITO', label: 'Queda debiendo' },
]

const card = 'rounded-card border border-line bg-surface'

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = `${words[0]?.[0] ?? ''}${words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''}`
  return letters.toLocaleUpperCase('es') || '?'
}

/** Caja de búsqueda con resultados que flotan encima del contenido, sin alargar la página. */
function FloatingSearch({
  label,
  placeholder,
  icon,
  text,
  onText,
  onEnter,
  open,
  children,
}: {
  label: string
  placeholder: string
  icon: ReactNode
  text: string
  onText: (value: string) => void
  onEnter?: () => void
  open: boolean
  children: ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false)
      }}
      onFocus={() => setFocused(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setFocused(false)
      }}
    >
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <span
          className="absolute top-3 left-0.5 text-ink-muted"
          aria-hidden="true"
        >
          {icon}
        </span>
        <input
          autoComplete="off"
          className="h-12 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent pl-8 text-lead font-medium text-ink placeholder:font-normal placeholder:text-ink-muted focus:border-ink"
          onChange={(event) => {
            onText(event.target.value)
            setFocused(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onEnter) {
              event.preventDefault()
              onEnter()
            }
          }}
          placeholder={placeholder}
          style={{ outline: 'none' }}
          value={text}
        />
      </label>
      {open && focused && (
        <ul
          aria-label="Resultados"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-group border border-line bg-surface p-1 shadow-menu"
        >
          {children}
        </ul>
      )}
    </div>
  )
}

/**
 * Venta rápida de mostrador (pantalla 4): se elige al cliente, se pasan los productos y se
 * cobra. Usa el borrador de venta de siempre: al cobrar encadena confirmar y registrar el cobro.
 * Los importes los calcula el servidor con la vista previa del borrador; aquí no se suman.
 * La factura llega con U6; hoy queda el recibo interno.
 */
export function QuickSalePage() {
  const session = useSession().data
  const canManageCustomer = Boolean(
    session?.permissions?.includes('clientes.gestionar'),
  )
  const business = useBusinessName('commercial')
  const toast = useToast()
  const productInput = useRef<HTMLDivElement>(null)

  // Desde la ficha de un cliente llega su identificación para buscarlo de inmediato.
  const [params] = useSearchParams()
  const [customer, setCustomer] = useState<CustomerOption | null>(null)
  const [customerText, setCustomerText] = useState(params.get('customer') ?? '')
  const [email, setEmail] = useState('')
  const [saveEmail, setSaveEmail] = useState(true)
  const [productText, setProductText] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [method, setMethod] = useState<QuickPayMethod>('EFECTIVO')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CheckoutExecuteResponse | null>(null)
  const [intentKey, setIntentKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    setEmail(customer?.email ?? '')
  }, [customer])

  const customerTerm = useDebounced(customerText.trim())
  const productTerm = useDebounced(productText.trim())
  const customers = useCustomerOptions(customerTerm, 1)
  const products = useProductOptions(productTerm, 1)

  const input = lines.map((line) => ({
    product_id: line.product.id,
    quantity: String(line.quantity),
  }))
  const signature = JSON.stringify([customer?.id ?? null, method, input])
  const preview = useQuery({
    queryKey: ['sales', 'quick-preview', signature],
    queryFn: () =>
      salesApi.draftPreview({
        ...(customer ? { customer_id: customer.id } : {}),
        condition: method === 'CREDITO' ? 'CREDITO' : 'CONTADO',
        notes: '',
        lines: input,
      }),
    enabled: lines.length > 0,
    placeholderData: keepPreviousData,
  })
  const byPosition = new Map(
    (preview.data?.lines ?? []).map((line) => [line.position, line]),
  )
  const total =
    lines.length > 0 ? (preview.data?.totals?.total ?? null) : '0.00'

  function addProduct(product: ProductOption) {
    setLines((current) => {
      const found = current.find((line) => line.product.id === product.id)
      if (found)
        return current.map((line) =>
          line === found ? { ...line, quantity: line.quantity + 1 } : line,
        )
      return [...current, { product, quantity: 1 }]
    })
    setProductText('')
  }

  // El lector de códigos escribe el código y pulsa Intro: se busca ya, sin esperar.
  async function addByCode() {
    const text = productText.trim()
    if (!text) return
    try {
      const page = await salesApi.productOptions(text, 1)
      const exact = page.results.find(
        (p) => p.code.toLocaleLowerCase() === text.toLocaleLowerCase(),
      )
      const pick = exact ?? (page.results.length === 1 ? page.results[0] : null)
      if (pick) addProduct(pick)
    } catch {
      /* La lista de resultados sigue disponible para elegir a mano. */
    }
  }

  function reset() {
    setCustomer(null)
    setCustomerText('')
    setEmail('')
    setProductText('')
    setLines([])
    setMethod('EFECTIVO')
    setError('')
    setResult(null)
    setIntentKey(crypto.randomUUID())
  }

  async function charge(includeInvoices: boolean) {
    if (!customer || lines.length === 0 || running) return
    setRunning(true)
    setError('')
    try {
      const outcome = await checkoutApi.execute(
        {
          origin_kind: 'QUICK_SALE',
          customer_id: customer.id,
          lines: lines.map((line) => ({
            product_id: line.product.id,
            quantity: line.quantity,
          })),
          payment_mode:
            method === 'EFECTIVO'
              ? 'CASH'
              : method === 'TRANSFERENCIA'
                ? 'TRANSFER'
                : 'CREDIT',
          include_invoices: includeInvoices,
          receiver_mode: 'CUSTOMER',
          receiver_email: email.trim(),
          save_email_to_customer:
            includeInvoices && saveEmail && canManageCustomer,
          credit_term_days: method === 'CREDITO' ? 30 : null,
        },
        intentKey,
      )
      setResult(outcome)
      setIntentKey(crypto.randomUUID())
      const number = outcome.commercial.document_number ?? ''
      if (method === 'CREDITO') {
        toast.success(`Venta ${number} registrada a crédito.`)
      } else {
        toast.success(
          includeInvoices && outcome.commercial.fiscal_state === 'PREPARED'
            ? `Venta ${number} cobrada y factura local preparada (sin enviar).`
            : `Venta ${number} cobrada.`,
        )
      }
    } catch (failure) {
      setError(describeProblem(failure).message)
    } finally {
      setRunning(false)
    }
  }

  const done = result !== null
  const locked = running || done
  const missingEmail = email.trim().length === 0
  const blocker = !customer
    ? 'Elija al cliente'
    : lines.length === 0
      ? 'Agregue un producto'
      : null

  return (
    <div className="catalog-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-card bg-scope-commercial-soft text-scope-commercial-ink"
          >
            <ShoppingBag size={26} />
          </span>
          <div>
            <p className="text-label font-medium text-ink-muted">
              Mostrador · {business}
            </p>
            <h1 className="text-page font-bold tracking-tight">Venta rápida</h1>
            <p className="mt-1 text-lead text-ink-muted">
              Elija al cliente, pase los productos y cobre.
            </p>
          </div>
        </div>
        <button
          className="ui-button inline-flex min-h-10 items-center gap-2 rounded-control px-3.5 text-body font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
          onClick={reset}
          type="button"
        >
          <ArrowCounterClockwise aria-hidden="true" size={16} />
          Empezar de nuevo
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_35rem] flex-col gap-4">
          <section
            aria-labelledby="quick-customer-title"
            className={`${card} flex flex-col gap-2 px-5 py-4`}
          >
            <h2 className="text-block font-bold" id="quick-customer-title">
              Cliente
            </h2>
            {customer ? (
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-full bg-surface-muted text-label font-bold text-ink"
                >
                  {initials(customer.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-snug">
                  <span className="font-semibold">{customer.name}</span>
                  <span className="text-label text-ink-muted tabular-nums">
                    {customer.identification_type} {customer.identification}
                  </span>
                </span>
                {!locked && (
                  <button
                    className="ui-button min-h-9 rounded-control px-2.5 text-body font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
                    onClick={() => {
                      setCustomer(null)
                      setCustomerText('')
                    }}
                    type="button"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            ) : (
              <FloatingSearch
                icon={<MagnifyingGlass size={19} />}
                label="Buscar cliente"
                onText={setCustomerText}
                open={customerTerm !== ''}
                placeholder="Nombre o cédula del cliente"
                text={customerText}
              >
                {(customers.data?.results ?? []).map((option) => (
                  <li key={option.id}>
                    <button
                      className="flex min-h-12 w-full items-center gap-3.5 rounded-control px-3 py-2 text-left hover:bg-surface-subtle"
                      onClick={() => {
                        setCustomer(option)
                        productInput.current?.querySelector('input')?.focus()
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-9 place-items-center rounded-full bg-surface-muted text-label font-bold"
                      >
                        {initials(option.name)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col leading-snug">
                        <span className="truncate font-semibold">
                          {option.name}
                        </span>
                        <span className="text-label text-ink-muted tabular-nums">
                          {option.identification_type} {option.identification}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {customers.data?.results.length === 0 && (
                  <li className="px-3 py-3 text-body text-ink-muted">
                    Ningún cliente con «{customerTerm}».
                  </li>
                )}
              </FloatingSearch>
            )}
          </section>

          <section
            aria-labelledby="quick-products-title"
            className={`${card} pb-1`}
          >
            <div className="flex flex-col gap-1.5 px-5 pt-4 pb-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-block font-bold" id="quick-products-title">
                  Productos
                </h2>
                <span className="text-label text-ink-muted">
                  {lines.length === 1
                    ? '1 producto'
                    : `${lines.length} productos`}
                </span>
              </div>
              {!locked && (
                <div ref={productInput}>
                  <FloatingSearch
                    icon={<Barcode size={20} />}
                    label="Buscar producto"
                    onEnter={() => void addByCode()}
                    onText={setProductText}
                    open={productTerm !== ''}
                    placeholder="Escriba el nombre o pase el lector de códigos"
                    text={productText}
                  >
                    {(products.data?.results ?? []).slice(0, 6).map((p) => (
                      <li key={p.id}>
                        <button
                          aria-label={`Agregar ${p.name}`}
                          className="group flex min-h-12 w-full items-center gap-4 rounded-control px-3.5 py-2.5 text-left hover:bg-surface-subtle"
                          onClick={() => addProduct(p)}
                          type="button"
                        >
                          <span className="flex min-w-0 flex-1 flex-col leading-snug">
                            <span className="truncate font-semibold">
                              {p.name}
                            </span>
                            <span className="text-label text-ink-muted">
                              Código {p.code}
                            </span>
                          </span>
                          <Money
                            amount={p.unit_price}
                            className="font-semibold text-ink-muted"
                          />
                          <span
                            aria-hidden="true"
                            className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent-strong group-hover:bg-accent group-hover:text-white"
                          >
                            <Plus size={14} weight="bold" />
                          </span>
                        </button>
                      </li>
                    ))}
                    {products.data?.results.length === 0 && (
                      <li className="px-3 py-3 text-body text-ink-muted">
                        Ningún producto con «{productTerm}».
                      </li>
                    )}
                  </FloatingSearch>
                </div>
              )}
            </div>
            {lines.map((line, index) => {
              const values = byPosition.get(index + 1)
              return (
                <div
                  className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line px-5 py-4"
                  key={line.product.id}
                >
                  <div className="min-w-[14rem] flex-1">
                    <div className="font-semibold">{line.product.name}</div>
                    <div className="text-label text-ink-muted">
                      Código {line.product.code} ·{' '}
                      <Money amount={line.product.unit_price} /> c/u
                    </div>
                  </div>
                  <QuantityStepper
                    name={line.product.name}
                    onChange={
                      locked
                        ? undefined
                        : async (quantity) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.product.id === line.product.id
                                  ? { ...item, quantity }
                                  : item,
                              ),
                            )
                    }
                    value={line.quantity}
                  />
                  <Money
                    amount={values?.total_amount ?? null}
                    className="w-24 text-block font-bold"
                  />
                  {!locked && (
                    <button
                      aria-label={`Quitar ${line.product.name}`}
                      className="grid size-10 place-items-center rounded-full text-ink-muted hover:bg-danger-soft hover:text-danger"
                      onClick={() =>
                        setLines((current) =>
                          current.filter(
                            (item) => item.product.id !== line.product.id,
                          ),
                        )
                      }
                      type="button"
                    >
                      <X aria-hidden="true" size={16} />
                    </button>
                  )}
                </div>
              )
            })}
            {lines.length === 0 && (
              <div className="px-5 pt-1 pb-4">
                <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-group border-[1.5px] border-dashed border-line-dashed text-center text-ink-muted">
                  <Barcode aria-hidden="true" size={28} />
                  <span className="font-semibold text-ink">
                    Pase el primer producto por el lector
                  </span>
                  <span className="text-label">o escriba su nombre arriba</span>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 flex-[1_1_22rem]">
          {done && result ? (
            <section
              aria-labelledby="quick-done-title"
              className={`${card} flex flex-col gap-4 px-6 py-6`}
            >
              <CheckCircle
                aria-hidden="true"
                className="text-success"
                size={44}
                weight="fill"
              />
              <div>
                <h2 className="text-figure font-bold" id="quick-done-title">
                  Venta {result.commercial.document_number ?? ''}{' '}
                  {result.commercial.paid ? 'cobrada' : 'a crédito'}
                </h2>
                <p className="text-display font-light tracking-tight tabular-nums">
                  <Money
                    amount={
                      result.commercial.paid
                        ? (result.commercial.paid_amount ?? total)
                        : total
                    }
                    className="text-left"
                  />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={
                    result.commercial.paid
                      ? 'Cobro registrado'
                      : 'Queda debiendo'
                  }
                  tone={result.commercial.paid ? 'success' : 'warning'}
                />
                <StatusBadge
                  label={
                    result.commercial.fiscal_state === 'PREPARED'
                      ? 'Factura preparada (sin enviar)'
                      : result.commercial.fiscal_state === 'FAILED'
                        ? 'Factura pendiente'
                        : 'Sin factura aún'
                  }
                  tone={
                    result.commercial.fiscal_state === 'PREPARED'
                      ? 'info'
                      : 'warning'
                  }
                />
              </div>
              {result.commercial.fiscal_error && (
                <InlineNotice title="Factura pendiente" tone="warning">
                  <p className="text-caption">
                    {result.commercial.fiscal_error}
                  </p>
                </InlineNotice>
              )}
              <div className="flex flex-wrap gap-2.5">
                {result.commercial.sale_id && (
                  <Link
                    className="ui-button inline-flex min-h-12 flex-1 items-center justify-center rounded-control border border-ink px-4 text-body font-semibold text-ink hover:bg-ink hover:text-white"
                    to={`/sales/${result.commercial.sale_id}/document`}
                  >
                    Imprimir recibo
                  </Link>
                )}
                <button
                  className="ui-button min-h-12 flex-1 rounded-control border border-primary bg-primary px-4 text-body font-semibold text-white hover:bg-primary-strong"
                  onClick={reset}
                  type="button"
                >
                  Nueva venta
                </button>
              </div>
            </section>
          ) : (
            <section
              aria-labelledby="quick-total-title"
              className={`${card} flex flex-col gap-5 px-6 py-6`}
            >
              <div>
                <h2
                  className="text-label font-medium text-ink-muted"
                  id="quick-total-title"
                >
                  Total a cobrar
                </h2>
                <p className="text-display font-light tracking-tight tabular-nums">
                  <Money amount={total} className="text-left" />
                </p>
              </div>
              <div
                aria-label="Cómo paga"
                className="flex flex-col gap-2"
                role="group"
              >
                <span className="text-label font-medium text-ink-muted">
                  ¿Cómo paga?
                </span>
                <div className="flex flex-wrap gap-2">
                  {METHODS.map((option) => {
                    const on = method === option.value
                    return (
                      <button
                        aria-pressed={on}
                        className={`inline-flex min-h-11 items-center rounded-full border px-4 text-body font-semibold transition-colors ${on ? 'border-primary bg-primary-soft text-primary-strong' : 'border-line-strong bg-surface text-ink-muted hover:text-ink'}`}
                        disabled={running}
                        key={option.value}
                        onClick={() => setMethod(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {customer && (
                <div className="space-y-2 border-t border-line pt-3">
                  <label className="flex flex-col gap-1 text-caption font-medium text-ink-muted">
                    Correo para la factura
                    <input
                      className="h-10 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent text-body text-ink focus:border-ink focus:outline-none"
                      disabled={running}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      type="email"
                      value={email}
                    />
                  </label>
                  {canManageCustomer && (
                    <Checkbox
                      checked={saveEmail}
                      disabled={running}
                      label="Guardar este correo en la ficha del cliente"
                      onChange={(e) => setSaveEmail(e.target.checked)}
                    />
                  )}
                </div>
              )}
              {error && (
                <InlineNotice title="No se registró la venta" tone="danger">
                  {error}
                </InlineNotice>
              )}
              <button
                className="ui-button min-h-14 w-full rounded-control border border-primary bg-primary px-4 text-lead font-semibold text-white hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-45"
                disabled={blocker !== null || running || missingEmail}
                onClick={() => void charge(true)}
                type="button"
              >
                {running
                  ? 'Registrando…'
                  : (blocker ??
                    (missingEmail
                      ? 'Escribe el correo para facturar'
                      : method === 'CREDITO'
                        ? 'Registrar a crédito y facturar'
                        : 'Cobrar y facturar'))}
              </button>
              {blocker === null && missingEmail && (
                <button
                  className="ui-button min-h-11 w-full rounded-control border border-line-strong bg-surface px-4 text-body-sm font-semibold text-ink hover:bg-surface-muted disabled:opacity-45"
                  disabled={running}
                  onClick={() => void charge(false)}
                  type="button"
                >
                  {method === 'CREDITO'
                    ? 'Solo registrar a crédito (facturar después)'
                    : 'Solo cobrar (facturar después)'}
                </button>
              )}
              <p className="text-center text-label text-ink-muted">
                Facturación en modo pruebas: la factura queda preparada
                localmente (sin enviar al SRI).
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
