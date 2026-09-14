import { useEffect, type ReactNode } from 'react'

import { Drawer } from '../Drawer'
import { NavigationItem, type NavigationItemProps } from './NavigationItem'

export interface SidebarProps {
  items: NavigationItemProps[]
  activeId?: string | undefined
  onSelect?: ((id: string) => void) | undefined
  collapsed?: boolean | undefined
  header?: ReactNode | undefined
  footer?: ReactNode | undefined
  'aria-label'?: string | undefined
  className?: string | undefined
  mobileOpen?: boolean | undefined
  onMobileClose?: (() => void) | undefined
}

export function Sidebar({
  items,
  activeId,
  onSelect,
  collapsed = false,
  header,
  footer,
  'aria-label': ariaLabel = 'Navegación principal',
  className = '',
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen || !onMobileClose) return
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        onMobileClose()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileOpen, onMobileClose])

  const handleItemClick = (item: NavigationItemProps) => {
    if (!item.disabled) {
      item.onClick?.()
      onSelect?.(item.id)
      if (mobileOpen) {
        onMobileClose?.()
      }
    }
  }

  const navContent = (
    <ul className="space-y-1.5" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <NavigationItem
            {...item}
            active={item.id === activeId}
            collapsed={collapsed && !mobileOpen}
            onClick={() => handleItemClick(item)}
          />
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <aside
        className={`flex flex-col bg-surface h-full transition-[width] duration-200 shrink-0 ${
          collapsed ? 'w-20' : 'w-[218px]'
        } ${className}`.trim()}
      >
        {header && (
          <div className="p-4 border-b border-line flex items-center justify-center min-h-[56px]">
            {header}
          </div>
        )}

        <nav aria-label={ariaLabel} className="flex-1 p-3 overflow-y-auto">
          {navContent}
        </nav>

        {footer && (
          <div className="p-3 border-t border-line min-h-[56px] flex items-center justify-center">
            {footer}
          </div>
        )}
      </aside>

      {mobileOpen && onMobileClose && (
        <Drawer
          description="Navegación general de la aplicación"
          onClose={onMobileClose}
          open={mobileOpen}
          title="Navegación móvil"
          width="369"
        >
          <nav aria-label={`${ariaLabel} móvil`} className="py-2">
            {navContent}
          </nav>
        </Drawer>
      )}
    </>
  )
}
