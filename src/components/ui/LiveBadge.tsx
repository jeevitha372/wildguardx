/**
 * Freshness indicator (README §6).
 *
 * Driven by time since the last frame, NOT by socket state alone — a socket
 * that is open but silent is not "live".
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import type { LiveStatus } from '@/data/types'

const COPY: Record<LiveStatus, { label: string; tone: string; dot: string }> = {
  live: { label: 'LIVE', tone: 'text-status-ok border-status-ok/40 bg-[color:var(--status-ok-fill)]', dot: 'bg-status-ok' },
  delayed: { label: 'DELAYED', tone: 'text-status-warning border-status-warning/40 bg-[color:var(--status-warning-fill)]', dot: 'bg-status-warning' },
  reconnecting: { label: 'RECONNECTING', tone: 'text-status-warning border-status-warning/40 bg-[color:var(--status-warning-fill)]', dot: 'bg-status-warning' },
  stale: { label: 'STALE', tone: 'text-status-offline border-status-offline/40 bg-[color:var(--status-offline-fill)]', dot: 'bg-status-offline' },
}

export function LiveBadge({ className, label }: { className?: string; label?: string }) {
  const { status } = useData()
  const [, force] = useState(0)

  // Re-render on a slow cadence so the "delayed Ns" reading stays truthful.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const copy = COPY[status.live]
  const ageSeconds = Math.floor((Date.now() - status.lastFrameAt) / 1000)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold tracking-wide',
        copy.tone,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`Data feed ${copy.label.toLowerCase()}, last update ${ageSeconds} seconds ago`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', copy.dot)} />
      {label ?? copy.label}
      {status.live !== 'live' && <span className="tabular-nums">{ageSeconds}s</span>}
    </span>
  )
}

/**
 * Static variant for surfaces that must NOT claim live data — the landing
 * page replay ("SANDBOX REPLAY") and analytics ("data through …").
 */
export function StaticBadge({
  label,
  tone = 'info',
  className,
}: {
  label: string
  tone?: 'info' | 'neutral'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold tracking-wide',
        tone === 'info'
          ? 'border-status-info/40 bg-[color:var(--status-info-fill)] text-status-info'
          : 'border-border bg-surface-3 text-fg-muted',
        className,
      )}
    >
      {label}
    </span>
  )
}
