/**
 * Forces any page into any of the seven data states.
 *
 * Without this, "all six states are implemented" is a claim nobody can check —
 * empty and partial states in particular are almost impossible to reach with
 * healthy fixtures. This makes each one reachable in two clicks, on every page.
 */

import { useEffect, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ALL_STATES, useStateOverride, type StateOverride } from '@/lib/dataState'
import { iconProps } from '@/components/domain/icons'

const DESCRIPTIONS: Record<StateOverride, string> = {
  auto: 'Whatever the data layer actually reports',
  loading: 'Skeletons at final dimensions — never a bare spinner',
  ideal: 'The success path',
  empty: 'SVG + one-line cause + one action',
  error: 'Cause stated verbatim + retry',
  partial: 'Renders data, names the failed source',
  stale: 'Renders data dimmed to 60% + last-updated time',
  offline: 'Cached data; actions queue for reconnect',
}

export function StateSwitcher({ className }: { className?: string }) {
  const { override, setOverride } = useStateOverride()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const options: StateOverride[] = ['auto', ...ALL_STATES]

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2',
          'font-mono text-[11px] font-semibold tracking-wide transition-colors duration-base ease-out',
          override === 'auto'
            ? 'border-border bg-surface-3 text-fg-muted hover:text-fg'
            : 'border-status-info/50 bg-[color:var(--status-info-fill)] text-status-info',
        )}
        title="Force a data state on this page"
      >
        <Layers size={12} {...iconProps} />
        STATE: {override.toUpperCase()}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Force data state"
          className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-border bg-surface-4 p-1.5 shadow-xl animate-fade-in"
        >
          <p className="px-2.5 py-2 text-xs text-fg-muted">
            Forces every async region on the current page into a given state.
          </p>
          {options.map((opt) => (
            <button
              key={opt}
              role="menuitemradio"
              aria-checked={override === opt}
              onClick={() => {
                setOverride(opt)
                setOpen(false)
              }}
              className={cn(
                'flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left',
                'transition-colors duration-base ease-out hover:bg-surface-3',
                override === opt && 'bg-[color:var(--status-watch-fill)]',
              )}
            >
              <span
                className={cn(
                  'font-mono text-xs font-semibold uppercase',
                  override === opt ? 'text-primary' : 'text-fg',
                )}
              >
                {opt}
              </span>
              <span className="text-[11px] leading-snug text-fg-muted">{DESCRIPTIONS[opt]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
