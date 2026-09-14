import type { ReactNode } from 'react'

export type FormLayoutColumns = 1 | 2
export type FormActionsAlignment = 'left' | 'right' | 'between'

export interface FormLayoutProps {
  children: ReactNode
  columns?: FormLayoutColumns
  actions?: ReactNode
  aside?: ReactNode
  actionsAlignment?: FormActionsAlignment
  className?: string
  fieldsClassName?: string
}

const alignmentClasses: Record<FormActionsAlignment, string> = {
  between: 'justify-between',
  left: 'justify-start',
  right: 'justify-end',
}

export function FormLayout({
  children,
  columns = 1,
  actions,
  aside,
  actionsAlignment = 'right',
  className = '',
  fieldsClassName = '',
}: FormLayoutProps) {
  const fieldsGrid = (
    <div
      className={`grid gap-4 sm:gap-5 ${
        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
      } ${fieldsClassName}`.trim()}
    >
      {children}
    </div>
  )

  const actionsBar = actions ? (
    <div
      className={`flex flex-wrap items-center gap-3 border-t border-line pt-4 ${alignmentClasses[actionsAlignment]}`}
    >
      {actions}
    </div>
  ) : null

  if (aside) {
    return (
      <div
        className={`grid grid-cols-1 gap-6 w-full lg:grid-cols-3 ${className}`.trim()}
      >
        <div className="flex flex-col gap-6 lg:col-span-2">
          {fieldsGrid}
          {actionsBar}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">{aside}</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`.trim()}>
      {fieldsGrid}
      {actionsBar}
    </div>
  )
}
