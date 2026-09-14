import type { ReactNode } from 'react'

import { ButtonGroup } from '../controls'

export interface RowActionsProps {
  children: ReactNode
  label?: string
  className?: string
}

export function RowActions({
  children,
  label = 'Acciones del registro',
  className = '',
}: RowActionsProps) {
  return (
    <ButtonGroup className={className} label={label}>
      {children}
    </ButtonGroup>
  )
}
