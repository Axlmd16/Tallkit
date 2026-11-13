import { CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react'
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

import { getControlClasses } from '../controls'

export interface ComboboxOption {
  id: number
  label: string
  detail?: string | undefined
  inactive?: boolean | undefined
  taxDefinitionId?: number | undefined
}

export interface ComboboxResults {
  isPending: boolean
  isError: boolean
  data?: { options: ComboboxOption[]; totalPages: number } | undefined
  refetch?: (() => unknown) | undefined
}

export interface ComboboxProps {
  id: string
  label: string
  selected: ComboboxOption | null
  onSelect: (option: ComboboxOption | null) => void
  useOptions: (term: string, page: number) => ComboboxResults
  inactiveHelp: string
  placeholder?: string
  error?: string | undefined
  clearable?: boolean
  disabled?: boolean
  onFocusChange?: (focused: boolean) => void
}

function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface Anchor {
  top: number
  left: number
  width: number
}

/**
 * Combobox compacto (patrón ARIA «editable combobox with list»): la selección vive dentro
 * del control, los resultados flotan en un menú y la búsqueda es en servidor con paginación
 * explícita. Las referencias inactivas se etiquetan y no pueden elegirse como selección nueva.
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  function Combobox(
    {
      id,
      label,
      selected,
      onSelect,
      useOptions,
      inactiveHelp,
      placeholder = 'Buscar por código o nombre',
      error,
      clearable = false,
      disabled = false,
      onFocusChange,
    },
    forwardedRef,
  ) {
    const listId = `${id}-listbox`
    const errorId = `${id}-error`
    const helpId = `${id}-help`
    const statusId = useId()
    const [input, setInput] = useState<HTMLInputElement | null>(null)
    const [editing, setEditing] = useState(false)
    const [term, setTerm] = useState('')
    const [page, setPage] = useState(1)
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(0)
    const [anchor, setAnchor] = useState<Anchor | null>(null)
    const debounced = useDebounced(term)
    const results = useOptions(debounced, page)
    const options = results.data?.options ?? []
    const totalPages = results.data?.totalPages ?? 1

    useEffect(() => {
      setPage(1)
      setActive(0)
    }, [debounced])

    const place = useCallback(() => {
      if (!input) return
      const rect = input.getBoundingClientRect()
      setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }, [input])

    useLayoutEffect(() => {
      if (!open) return
      place()
      window.addEventListener('resize', place)
      window.addEventListener('scroll', place, true)
      return () => {
        window.removeEventListener('resize', place)
        window.removeEventListener('scroll', place, true)
      }
    }, [open, place])

    function setRefs(node: HTMLInputElement | null) {
      setInput(node)
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    }

    function close() {
      setOpen(false)
      setEditing(false)
      setTerm('')
    }

    function choose(option: ComboboxOption) {
      if (option.inactive) return
      onSelect(option)
      close()
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (!open) setOpen(true)
        else setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
      } else if (event.key === 'PageDown' && open && page < totalPages) {
        event.preventDefault()
        setPage((p) => p + 1)
        setActive(0)
      } else if (event.key === 'PageUp' && open && page > 1) {
        event.preventDefault()
        setPage((p) => p - 1)
        setActive(0)
      } else if (event.key === 'Enter' && open) {
        const option = options[active]
        if (option) {
          event.preventDefault()
          choose(option)
        }
      } else if (event.key === 'Escape' && open) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }

    const value = editing ? term : (selected?.label ?? '')
    const describedBy =
      [error ? errorId : null, selected?.inactive ? helpId : null]
        .filter(Boolean)
        .join(' ') || undefined
    const activeId =
      open && options[active] ? `${listId}-option-${active}` : undefined

    return (
      <div className="space-y-1.5">
        <div className="relative">
          <MagnifyingGlass
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-ink-muted"
            size={16}
          />
          <input
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-describedby={describedBy}
            aria-expanded={open}
            aria-invalid={error ? true : undefined}
            aria-label={label}
            className={`${getControlClasses({ density: 'compact42' })} w-full pr-9 pl-9`}
            disabled={disabled}
            id={id}
            onBlur={() => {
              close()
              onFocusChange?.(false)
            }}
            onChange={(event) => {
              setEditing(true)
              setTerm(event.target.value)
              setOpen(true)
            }}
            onClick={() => setOpen(true)}
            onFocus={() => {
              setEditing(true)
              setTerm('')
              setOpen(true)
              onFocusChange?.(true)
            }}
            onKeyDown={onKeyDown}
            placeholder={selected ? undefined : placeholder}
            ref={setRefs}
            role="combobox"
            title={selected?.label}
            type="text"
            value={value}
          />
          {clearable && selected && !disabled ? (
            <button
              aria-label={`Quitar selección: ${selected.label}`}
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              onClick={() => {
                onSelect(null)
                input?.focus()
              }}
              title="Quitar selección"
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          ) : (
            <CaretDown
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
              size={14}
            />
          )}
        </div>
        {selected?.inactive && (
          <p className="text-label text-warning" id={helpId}>
            <strong>Inactivo.</strong> {inactiveHelp}
          </p>
        )}
        {error && (
          <p
            className="text-label font-semibold text-danger"
            id={errorId}
            role="alert"
          >
            {error}
          </p>
        )}
        {open &&
          anchor &&
          createPortal(
            <div
              className="fixed z-[80] max-h-80 overflow-y-auto rounded-dialog border border-line bg-surface py-1 shadow-menu"
              onMouseDown={(event) => event.preventDefault()}
              style={{
                top: anchor.top,
                left: anchor.left,
                minWidth: Math.max(anchor.width, 260),
              }}
            >
              {results.isPending && (
                <p
                  className="px-3 py-2 text-label text-ink-muted"
                  id={statusId}
                  role="status"
                >
                  Buscando…
                </p>
              )}
              {results.isError && (
                <div className="px-3 py-2 text-label text-danger" role="alert">
                  No se pudo buscar.{' '}
                  <button
                    className="underline"
                    onClick={() => void results.refetch?.()}
                    type="button"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {results.data && options.length === 0 && (
                <p
                  className="px-3 py-2 text-label text-ink-muted"
                  role="status"
                >
                  Sin coincidencias.
                </p>
              )}
              <ul
                aria-label={`Resultados de ${label}`}
                id={listId}
                role="listbox"
              >
                {options.map((option, index) => (
                  <li
                    aria-disabled={option.inactive ? true : undefined}
                    aria-selected={index === active}
                    className={`flex cursor-pointer flex-col gap-0.5 px-3 py-2 text-body outline-none ${index === active ? 'bg-primary-soft text-ink' : 'text-ink'} ${option.inactive ? 'cursor-not-allowed opacity-55' : 'hover:bg-surface-subtle'}`}
                    data-active={index === active}
                    id={`${listId}-option-${index}`}
                    key={option.id}
                    onClick={() => choose(option)}
                    onMouseEnter={() => setActive(index)}
                    role="option"
                  >
                    <span className="truncate font-semibold">
                      {option.label}
                    </span>
                    <span className="truncate text-label text-ink-muted">
                      {option.inactive
                        ? 'Inactivo: no seleccionable'
                        : option.detail}
                    </span>
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-label text-ink-muted">
                  <button
                    className="font-semibold text-accent disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    tabIndex={-1}
                    type="button"
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    className="font-semibold text-accent disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    tabIndex={-1}
                    type="button"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>
    )
  },
)
