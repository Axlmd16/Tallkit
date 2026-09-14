import type { ReactNode } from 'react'

export type MasterDetailWidth = 'sm' | 'md' | 'lg'

export interface MasterDetailLayoutProps {
  master: ReactNode
  detail: ReactNode
  detailWidth?: MasterDetailWidth
  className?: string
  masterClassName?: string
  detailClassName?: string
}

const masterColClasses: Record<MasterDetailWidth, string> = {
  lg: 'lg:col-span-6',
  md: 'lg:col-span-7',
  sm: 'lg:col-span-8',
}

const detailColClasses: Record<MasterDetailWidth, string> = {
  lg: 'lg:col-span-6',
  md: 'lg:col-span-5',
  sm: 'lg:col-span-4',
}

export function MasterDetailLayout({
  master,
  detail,
  detailWidth = 'md',
  className = '',
  masterClassName = '',
  detailClassName = '',
}: MasterDetailLayoutProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-6 w-full lg:grid-cols-12 ${className}`.trim()}
    >
      <section
        className={`w-full min-w-0 ${masterColClasses[detailWidth]} ${masterClassName}`.trim()}
      >
        {master}
      </section>

      <section
        className={`w-full min-w-0 ${detailColClasses[detailWidth]} ${detailClassName}`.trim()}
      >
        {detail}
      </section>
    </div>
  )
}
