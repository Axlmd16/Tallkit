import { forwardRef, useState } from 'react'

import { IconButton } from '@/shared/ui/actions'
import { Input, type InputProps } from '@/shared/ui/controls'
import { Icon } from '@/shared/ui/icons'

export type PasswordInputProps = InputProps

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className = '', disabled, ...props }, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative w-full">
        <Input
          className={`pr-12 ${className}`}
          disabled={disabled}
          ref={ref}
          type={visible ? 'text' : 'password'}
          {...props}
        />
        <IconButton
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 text-ink-muted hover:text-ink"
          disabled={disabled}
          icon={<Icon name={visible ? 'eye-slash' : 'eye'} size={20} />}
          label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setVisible((prev) => !prev)}
          shape="circle"
          targetSize="40"
          type="button"
        />
      </div>
    )
  },
)
