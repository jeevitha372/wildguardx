/**
 * AlertRow — shared by the dashboard feed and the alerts triage queue.
 *
 * Actions are ALWAYS rendered, not hover-only: hover-only controls are
 * unreachable by touch and by keyboard (alerts.md §3.4, dashboard.md §3.4).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { Detection } from '@/data/types'
import { SeverityChip } from '@/components/ui/Chip'
import { ConfidenceBar } from './ConfidenceBar'
import { SpeciesThumb, TierBadge } from './SpeciesThumb'
import { Button } from '@/components/ui/Button'
import { absoluteDateTime, classLabel, isoString, relativeAge } from '@/lib/format'

/**
 * Severity rail. Uses the `-vivid` token because a 3px bar is a graphical
 * object, not text — it needs saturation, not readability.
 */
const RAIL: Record<string, string> = {
  critical: 'bg-status-critical-vivid',
  warning: 'bg-status-warning-vivid',
  watch: 'bg-status-watch-vivid',
  info: 'bg-status-info-vivid',
}

/** A faint severity wash across the row, strongest at the rail edge. */
const ROW_WASH: Record<string, string> = {
  critical:
    '[background-image:linear-gradient(to_right,color-mix(in_srgb,var(--status-critical-vivid)_10%,transparent),transparent_38%)]',
  warning:
    '[background-image:linear-gradient(to_right,color-mix(in_srgb,var(--status-warning-vivid)_8%,transparent),transparent_34%)]',
  watch: '',
  info: '',
}

/** Live-updating age. Text is aria-hidden; a static label carries the value to
 *  assistive tech so screen readers aren't re-announcing every second. */
function AgeTimer({ ts }: { ts: number }) {
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const ageMs = Date.now() - ts
  const mins = ageMs / 60000
  const tone =
    mins > 20 ? 'text-status-critical' : mins > 10 ? 'text-status-warning' : 'text-fg-muted'

  return (
    <time dateTime={isoString(ts)} title={absoluteDateTime(ts)} className={cn('font-mono text-xs tabular-nums', tone)}>
      <span aria-hidden="true">{relativeAge(ts)} ago</span>
      <span className="sr-only">{absoluteDateTime(ts)}</span>
    </time>
  )
}

interface AlertRowProps {
  detection: Detection
  density?: 'comfortable' | 'compact'
  onAcknowledge?: (d: Detection) => void
  onDispatch?: (d: Detection) => void
  selected?: boolean
  onSelect?: (d: Detection) => void
  showActions?: boolean
  isNew?: boolean
}

export function AlertRow({
  detection: d,
  density = 'comfortable',
  onAcknowledge,
  onDispatch,
  selected,
  onSelect,
  showActions = true,
  isNew,
}: AlertRowProps) {
  const unacked = d.status === 'active'
  const compact = density === 'compact'

  return (
    <article
      className={cn(
        'group relative flex items-start gap-md border-b border-border bg-surface-2 pl-md pr-md transition-colors duration-base ease-out',
        compact ? 'py-2' : 'py-3',
        'hover:bg-surface-3',
        ROW_WASH[d.severity],
        selected && 'bg-[color:var(--status-watch-fill)]',
        isNew && 'animate-fade-in',
      )}
      onClick={onSelect ? () => onSelect(d) : undefined}
      aria-label={`${classLabel(d.cls)} at ${d.nodeId}, ${d.severity}`}
    >
      {/* Severity rail — the row background stays surface-2 */}
      <span
        className={cn('absolute inset-y-0 left-0', compact ? 'w-[3px]' : 'w-1', RAIL[d.severity])}
        aria-hidden="true"
      />

      <SpeciesThumb detection={d} size={compact ? 32 : 44} showConfidence={!compact} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Weight, not just colour, marks read state (alerts.md §3.4) */}
          <Link
            to={`/app/incidents/${d.incidentId}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'truncate text-sm hover:underline',
              unacked ? 'font-semibold text-fg' : 'font-normal text-fg-secondary',
            )}
          >
            {classLabel(d.cls)}
          </Link>
          <SeverityChip severity={d.severity} />
          {d.sos && (
            <span className="rounded border border-status-critical/50 bg-[color:var(--status-critical-fill)] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-status-critical">
              SOS
            </span>
          )}
          {d.simulated && (
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
              SIM
            </span>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          <span className="font-mono">{d.sector}</span>
          <span aria-hidden="true">·</span>
          <Link
            to={`/app/devices/${d.nodeId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono hover:text-fg-secondary hover:underline"
          >
            {d.nodeId}
          </Link>
          <span aria-hidden="true">·</span>
          <ConfidenceBar value={d.confidence} />
          <TierBadge tier={d.tier} compact />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-md">
          <AgeTimer ts={d.ts} />
          {showActions && (
            <div className="flex items-center gap-1.5">
              {unacked && onAcknowledge && (
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAcknowledge(d)
                  }}
                  aria-label={`Acknowledge ${classLabel(d.cls)} alert at ${d.nodeId}`}
                >
                  Acknowledge
                </Button>
              )}
              {onDispatch && d.status !== 'resolved' && d.status !== 'false_positive' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDispatch(d)
                  }}
                  aria-label={`Dispatch a ranger to ${classLabel(d.cls)} alert at ${d.nodeId}`}
                >
                  Dispatch
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
