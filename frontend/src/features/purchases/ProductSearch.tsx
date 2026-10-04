import { MagnifyingGlass } from '@phosphor-icons/react'
import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
} from 'react'

import { productsApi } from '@/features/products/api'
import type { Product } from '@/features/products/types'
import { getControlClasses } from '@/shared/ui'

import type { ProductChoice } from './entry'
import { useProductSuggestions } from './pickers'

function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const choiceOf = (product: Product): ProductChoice => ({
  id: product.id,
  code: product.code,
  name: product.name,
  unit: product.unit?.name ?? '',
})

const same = (a: string | null | undefined, b: string) =>
  Boolean(a) && a?.trim().toLowerCase() === b

/**
 * Buscador de productos de la entrada. Elegir uno lo agrega y deja el cursor listo para el
 * siguiente. Con Enter, un código interno o de fabricante exacto se resuelve contra el
 * servidor sin esperar a las sugerencias, de modo que un lector de códigos funciona tecleando.
 */
export const ProductSearch = forwardRef<
  HTMLInputElement,
  { onChoose: (product: ProductChoice) => void; disabled?: boolean }
>(function ProductSearch({ onChoose, disabled = false }, ref) {
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [message, setMessage] = useState('')
  const [looking, setLooking] = useState(false)
  const term = useDebounced(text.trim())
  const suggestions = useProductSuggestions(term)
  const options = term ? (suggestions.data?.results ?? []) : []

  useEffect(() => setActive(-1), [term])

  function choose(product: Product) {
    onChoose(choiceOf(product))
    setText('')
    setOpen(false)
    setActive(-1)
    setMessage(`Agregado: ${product.code} ${product.name}`)
  }

  async function resolve() {
    const wanted = text.trim().toLowerCase()
    if (!wanted || looking) return
    setLooking(true)
    try {
      const page = await productsApi.list({
        search: text.trim(),
        isActive: 'true',
        pageSize: 5,
      })
      const exact = page.results.find(
        (product) =>
          same(product.code, wanted) || same(product.manufacturer_code, wanted),
      )
      const only = page.results.length === 1 ? page.results[0] : undefined
      const found = exact ?? only
      if (found) choose(found)
      else if (page.results.length === 0) {
        setMessage('No hay un producto activo con ese código o nombre.')
      } else {
        setOpen(true)
        setMessage('Hay varias coincidencias: elija una de la lista.')
      }
    } catch {
      setMessage('No se pudo buscar. Reintente.')
    } finally {
      setLooking(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const highlighted = options[active]
      if (highlighted) choose(highlighted)
      else void resolve()
    } else if (event.key === 'Escape') {
      setOpen(false)
      setText('')
    }
  }

  const showList = open && options.length > 0
  return (
    <div className="relative">
      <MagnifyingGlass
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-ink-muted"
        size={18}
      />
      <input
        aria-activedescendant={
          showList && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        aria-label="Buscar producto por código o nombre"
        autoComplete="off"
        className={`${getControlClasses({ density: '50' })} w-full pl-10`}
        disabled={disabled}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          setMessage('')
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Escanee o escriba un código o nombre…"
        ref={ref}
        role="combobox"
        type="text"
        value={text}
      />
      <p
        aria-live="polite"
        className="mt-1.5 min-h-4 text-xs text-ink-muted"
        role="status"
      >
        {message}
      </p>
      {showList && (
        <ul
          aria-label="Productos sugeridos"
          className="absolute z-30 mt-[-1.1rem] max-h-72 w-full overflow-y-auto rounded-dialog border border-line bg-surface py-1 shadow-menu"
          id={listId}
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
        >
          {options.map((product, index) => (
            <li
              aria-selected={index === active}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-[13px] ${index === active ? 'bg-accent-soft text-accent-strong' : 'text-ink hover:bg-surface-subtle'}`}
              id={`${listId}-${index}`}
              key={product.id}
              onClick={() => choose(product)}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono font-semibold">{product.code}</span>{' '}
                {product.name}
              </span>
              <span className="shrink-0 text-xs text-ink-muted">
                {product.unit?.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
