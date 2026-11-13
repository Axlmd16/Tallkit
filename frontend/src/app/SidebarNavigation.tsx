import { CaretDown } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import {
  findActiveGroupId,
  homeItem,
  isItemActive,
  type NavGroup,
  type NavItem,
} from './navigation'

const rowBase =
  'app-rail-nav-item relative flex min-h-11 w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white'
const rowIdle = 'text-graphite-ink hover:bg-graphite-raised/60 hover:text-white'
/* Opción activa: fondo elevado, texto blanco y barra cobre a la izquierda. */
const rowActive =
  'bg-graphite-raised font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[2.5px] before:rounded-r-full before:bg-primary'

interface SidebarProps {
  groups: readonly NavGroup[]
  pathname: string
  onNavigate?: (() => void) | undefined
}

function ItemLink({
  item,
  pathname,
  onNavigate,
  iconOnly = false,
}: {
  item: NavItem
  pathname: string
  onNavigate?: (() => void) | undefined
  iconOnly?: boolean
}) {
  const active = isItemActive(item, pathname)
  const Icon = item.icon
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      aria-label={iconOnly ? item.label : undefined}
      className={`${rowBase} ${active ? rowActive : rowIdle} ${iconOnly ? 'justify-center px-0' : ''}`}
      onClick={onNavigate}
      title={item.label}
      to={item.to}
    >
      <Icon aria-hidden="true" className="shrink-0" size={18} />
      {!iconOnly && <span className="min-w-0 flex-1">{item.label}</span>}
    </Link>
  )
}

const kidsList = 'ml-[18px] border-l border-graphite-line pl-2'

/** Sidebar expandido (escritorio y drawer móvil): grupos desplegables. */
export function ExpandedNavigation({
  groups,
  pathname,
  onNavigate,
  idPrefix,
}: SidebarProps & { idPrefix: string }) {
  const activeGroupId = findActiveGroupId(groups, pathname)
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(activeGroupId ? [activeGroupId] : []),
  )
  const [seenActive, setSeenActive] = useState(activeGroupId)

  // Al cambiar de ruta, el grupo de la ruta actual se abre sin cerrar los demás.
  if (seenActive !== activeGroupId) {
    setSeenActive(activeGroupId)
    if (activeGroupId && !open.has(activeGroupId)) {
      setOpen(new Set(open).add(activeGroupId))
    }
  }

  function toggle(id: string) {
    const next = new Set(open)
    if (!next.delete(id)) next.add(id)
    setOpen(next)
  }

  return (
    <ul className="flex flex-col gap-1">
      <li>
        <ItemLink item={homeItem} onNavigate={onNavigate} pathname={pathname} />
      </li>
      {groups.map((group, index) => {
        const Icon = group.icon
        const isOpen = open.has(group.id)
        const hasActive = group.id === activeGroupId
        const activeItem = group.items.find((item) =>
          isItemActive(item, pathname),
        )
        const panelId = `${idPrefix}-${group.id}`
        return (
          <li
            className={
              index === 0 ? 'mt-2 border-t border-graphite-line pt-3' : 'mt-1'
            }
            key={group.id}
          >
            <button
              aria-controls={panelId}
              aria-expanded={isOpen}
              className={`${rowBase} font-semibold ${hasActive ? 'text-white' : 'text-graphite-ink'} hover:bg-graphite-raised/60 hover:text-white`}
              onClick={() => toggle(group.id)}
              type="button"
            >
              <Icon
                aria-hidden="true"
                className={`shrink-0 ${hasActive ? 'text-primary' : 'text-graphite-ink'}`}
                size={18}
              />
              <span className="min-w-0 flex-1">{group.label}</span>
              <CaretDown
                aria-hidden="true"
                className={`shrink-0 text-graphite-ink transition-transform ${isOpen ? 'rotate-180' : ''}`}
                size={16}
              />
            </button>
            <ul
              className={`${kidsList} mt-0.5 mb-1.5 flex flex-col gap-0.5`}
              hidden={!isOpen}
              id={panelId}
            >
              {group.items.map((item) => (
                <li key={item.to}>
                  <ItemLink
                    item={item}
                    onNavigate={onNavigate}
                    pathname={pathname}
                  />
                </li>
              ))}
            </ul>
            {!isOpen && activeItem && (
              <div className={`${kidsList} mt-0.5`}>
                <ItemLink
                  item={activeItem}
                  onNavigate={onNavigate}
                  pathname={pathname}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Rail compacto (tableta): un icono por grupo; las opciones salen en un panel lateral. */
export function CompactNavigation({
  groups,
  pathname,
  onNavigate,
}: SidebarProps) {
  const [flyout, setFlyout] = useState<{ id: string; top: number } | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const activeGroupId = findActiveGroupId(groups, pathname)
  const group = groups.find((candidate) => candidate.id === flyout?.id)

  useEffect(() => {
    if (!flyout) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setFlyout(null)
      trigger.current?.focus()
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Element
      if (!target.closest('[data-flyout], [data-flyout-trigger]')) {
        setFlyout(null)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [flyout])

  function toggle(id: string, button: HTMLElement) {
    trigger.current = button
    setFlyout(
      flyout?.id === id
        ? null
        : { id, top: Math.max(8, button.getBoundingClientRect().top - 8) },
    )
  }

  const railButton =
    'relative mx-auto grid size-11 place-items-center rounded-control transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white'

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        <li>
          <ItemLink
            iconOnly
            item={homeItem}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        </li>
        {groups.map((candidate, index) => {
          const Icon = candidate.icon
          const active = candidate.id === activeGroupId
          const expanded = flyout?.id === candidate.id
          return (
            <li
              className={
                index === 0 ? 'mt-2 border-t border-graphite-line pt-3' : ''
              }
              key={candidate.id}
            >
              <button
                aria-expanded={expanded}
                aria-haspopup="true"
                aria-label={candidate.label}
                className={`${railButton} ${active ? `${rowActive}` : rowIdle} ${expanded && !active ? 'bg-graphite-raised text-white' : ''}`}
                data-active={active ? 'true' : undefined}
                data-flyout-trigger=""
                onClick={(event) => toggle(candidate.id, event.currentTarget)}
                title={candidate.label}
                type="button"
              >
                <Icon aria-hidden="true" size={22} />
              </button>
            </li>
          )
        })}
      </ul>
      {group && flyout && (
        <div
          aria-label={group.label}
          className="fixed left-[80px] z-40 w-60 rounded-panel border border-graphite-line bg-graphite p-2 shadow-menu"
          data-flyout=""
          role="group"
          style={{ top: flyout.top }}
        >
          <p className="mx-2.5 mt-1 mb-1.5 text-micro font-semibold tracking-wider text-graphite-ink uppercase">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <ItemLink
                  item={item}
                  onNavigate={() => {
                    setFlyout(null)
                    onNavigate?.()
                  }}
                  pathname={pathname}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
