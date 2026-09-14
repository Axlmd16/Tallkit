import { forwardRef, useRef, useState, type ChangeEvent } from 'react'

import { IconButton } from '@/shared/ui/actions'
import { Input, type InputProps } from '@/shared/ui/controls'
import { Icon } from '@/shared/ui/icons'

export interface SearchInputProps extends InputProps {
  onClear?: () => void
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      className = '',
      defaultValue,
      disabled,
      onChange,
      onClear,
      value: controlledValue,
      ...props
    },
    forwardedRef,
  ) {
    const internalRef = useRef<HTMLInputElement>(null)
    const isControlled = controlledValue !== undefined
    const [uncontrolledValue, setUncontrolledValue] = useState(
      defaultValue !== undefined ? String(defaultValue) : '',
    )

    const currentValue = isControlled
      ? String(controlledValue)
      : uncontrolledValue
    const hasValue = currentValue.length > 0

    const setRefs = (node: HTMLInputElement | null) => {
      internalRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setUncontrolledValue(e.target.value)
      }
      onChange?.(e)
    }

    const handleClear = () => {
      if (!isControlled) {
        setUncontrolledValue('')
      }
      if (internalRef.current) {
        internalRef.current.value = ''
        const changeEvent = new Event('input', { bubbles: true })
        internalRef.current.dispatchEvent(changeEvent)
      }
      if (onChange && internalRef.current) {
        const syntheticEvent = {
          currentTarget: internalRef.current,
          target: internalRef.current,
        } as ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }
      internalRef.current?.focus()
      onClear?.()
    }

    return (
      <div className="relative w-full">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
        >
          <Icon name="search" size={18} />
        </span>
        <Input
          className={`pl-10 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none ${hasValue ? 'pr-11' : ''} ${className}`}
          disabled={disabled}
          inputMode="search"
          onChange={handleChange}
          ref={setRefs}
          role="searchbox"
          type={props.type ?? 'text'}
          value={currentValue}
          {...props}
        />
        {hasValue && !disabled && (
          <IconButton
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 text-ink-muted hover:text-ink"
            icon={<Icon name="x" size={16} />}
            label="Limpiar búsqueda"
            onClick={handleClear}
            shape="circle"
            targetSize="40"
            type="button"
          />
        )}
      </div>
    )
  },
)
