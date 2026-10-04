import { Barcode, MagnifyingGlass } from '@phosphor-icons/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

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

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

interface Anchor {
  top: number
  left: number
  width: number
}

/**
 * Buscador de productos de la entrada. Elegir uno lo agrega y deja el cursor listo para el
 * siguiente. Con Enter, un código interno o de fabricante exacto se resuelve contra el
 * servidor sin esperar a las sugerencias, de modo que un lector de códigos funciona tecleando.
 * Las sugerencias flotan en un portal para no quedar recortadas por el panel que las contiene.
 */
export const ProductSearch = forwardRef<
  HTMLInputElement,
  { onChoose: (product: ProductChoice) => void; disabled?: boolean }
>(function ProductSearch({ onChoose, disabled = false }, forwardedRef) {
  const listId = useId()
  const [input, setInput] = useState<HTMLInputElement | null>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState<{ text: string; tone: Tone }>({
    text: '',
    tone: 'neutral',
  })
  const [looking, setLooking] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const term = useDebounced(text.trim())
  const suggestions = useProductSuggestions(term)
  const options = term ? (suggestions.data?.results ?? []) : []
  const showList = open && options.length > 0

  useEffect(() => setActive(-1), [term])

  const place = useCallback(() => {
    if (!input) return
    const rect = input.getBoundingClientRect()
    setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [input])

  useLayoutEffect(() => {
    if (!showList) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [showList, place])

  function setRefs(node: HTMLInputElement | null) {
    setInput(node)
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  function choose(product: Product) {
    onChoose(choiceOf(product))
    setText('')
    setOpen(false)
    setActive(-1)
    setStatus({
      text: `Agregado: ${product.code} ${product.name}`,
      tone: 'success',
    })
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
        setStatus({
          text: 'No hay un producto activo con ese código o nombre.',
          tone: 'danger',
        })
      } else {
        setOpen(true)
        setStatus({
          text: 'Hay varias coincidencias: elija una de la lista.',
          tone: 'warning',
        })
      }
    } catch {
      setStatus({ text: 'No se pudo buscar. Reintente.', tone: 'danger' })
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
    } else if (event.key === 'Escape' && (open || text)) {
      setOpen(false)
      setText('')
    }
  }

  return (
    <div>
      <div className="entry-search-field">
        <MagnifyingGlass
          aria-hidden="true"
          className="entry-search-icon"
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
          className={`${getControlClasses({ density: '50' })} w-full`}
          disabled={disabled}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
            setStatus({ text: '', tone: 'neutral' })
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Escanee o escriba un código o nombre…"
          ref={setRefs}
          role="combobox"
          type="text"
          value={text}
        />
        <Barcode aria-hidden="true" className="entry-search-scan" size={20} />
      </div>
      <p
        aria-live="polite"
        className="entry-search-status"
        data-tone={status.tone}
        role="status"
      >
        {status.text}
      </p>
      {showList &&
        anchor &&
        createPortal(
          <ul
            aria-label="Productos sugeridos"
            className="entry-search-menu"
            id={listId}
            onMouseDown={(event) => event.preventDefault()}
            role="listbox"
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
          >
            {options.map((product, index) => (
              <li
                aria-selected={index === active}
                className="entry-search-option"
                id={`${listId}-${index}`}
                key={product.id}
                onClick={() => choose(product)}
                onMouseEnter={() => setActive(index)}
                role="option"
              >
                <span className="min-w-0 truncate">
                  <span className="entry-product-code">{product.code}</span>{' '}
                  {product.name}
                </span>
                <small>{product.unit?.name}</small>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
})
