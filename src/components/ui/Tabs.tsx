/**
 * Tabs — real role="tablist" with arrow-key navigation and URL sync
 * (device-detail.md §3.2, team.md §8, notifications.md §8).
 */

import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/cn'

export interface TabDef {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: TabDef[]
  /** Query-param key used to persist the active tab. */
  param?: string
  defaultTab?: string
  className?: string
}

export function useTabs({ tabs, param = 'tab', defaultTab }: TabsProps) {
  const [search, setSearch] = useSearchParams()
  const active = search.get(param) ?? defaultTab ?? tabs[0]?.id
  const setActive = (id: string) => {
    const next = new URLSearchParams(search)
    next.set(param, id)
    setSearch(next, { replace: true })
  }
  return { active, setActive }
}

export function TabBar({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-border',
        // Edge fade on sm where the strip scrolls
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative shrink-0 cursor-pointer whitespace-nowrap px-md py-2.5 text-sm font-medium',
              'transition-colors duration-base ease-out',
              selected ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className="ml-1.5 font-mono text-xs text-fg-muted tabular-nums">{tab.count}</span>
            )}
            {selected && (
              <span className="absolute inset-x-md bottom-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  id,
  active,
  children,
}: {
  id: string
  active: string
  children: React.ReactNode
}) {
  if (id !== active) return null
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="pt-lg">
      {children}
    </div>
  )
}
