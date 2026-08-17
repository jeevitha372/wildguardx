/**
 * Density components (Task B) — spec-compatible additions.
 *
 * SpeciesThumb is an ICON tile, not a photograph. There is no camera imagery in
 * this build, and rendering a stock animal photo next to a real detection would
 * imply the node captured it. The tile is a severity-tinted gradient carrying
 * the class glyph, with the confidence meter attached — so a row reads as
 * "what, how sure, how urgent" at a glance without inventing evidence.
 *
 * No new looping animation: critical-pulse remains the only one.
 */

import { cn } from '@/lib/cn'
import type { Detection, Severity, Tier } from '@/data/types'
import { CLASS_ICONS, iconProps } from './icons'
import { classLabel } from '@/lib/format'

const SEV_TILE: Record<Severity, string> = {
  critical:
    'border-status-critical/40 text-status-critical [background-image:linear-gradient(140deg,color-mix(in_srgb,var(--status-critical-vivid)_22%,transparent),transparent_70%)]',
  warning:
    'border-status-warning/40 text-status-warning [background-image:linear-gradient(140deg,color-mix(in_srgb,var(--status-warning-vivid)_22%,transparent),transparent_70%)]',
  watch:
    'border-status-watch/40 text-status-watch [background-image:linear-gradient(140deg,color-mix(in_srgb,var(--status-watch-vivid)_20%,transparent),transparent_70%)]',
  info:
    'border-status-info/40 text-status-info [background-image:linear-gradient(140deg,color-mix(in_srgb,var(--status-info-vivid)_20%,transparent),transparent_70%)]',
}

const CONF_BAR: Record<Severity, string> = {
  critical: 'bg-status-critical-vivid',
  warning: 'bg-status-warning-vivid',
  watch: 'bg-status-watch-vivid',
  info: 'bg-status-info-vivid',
}

export function SpeciesThumb({
  detection: d,
  size = 44,
  showConfidence = true,
  className,
}: {
  detection: Detection
  size?: number
  showConfidence?: boolean
  className?: string
}) {
  const Icon = CLASS_ICONS[d.cls]
  const iconSize = Math.round(size * 0.42)

  return (
    <span
      className={cn('inline-flex shrink-0 flex-col gap-1', className)}
      // The whole tile is decorative duplication of text already in the row.
      aria-hidden="true"
      title={`${classLabel(d.cls)} · ${d.confidence}% confidence`}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-lg border bg-surface-3',
          SEV_TILE[d.severity],
        )}
        style={{ width: size, height: size }}
      >
        <Icon size={iconSize} {...iconProps} />
      </span>

      {showConfidence && (
        <span
          className="block overflow-hidden rounded-full bg-surface-4"
          style={{ width: size, height: 3 }}
        >
          <span
            className={cn('block h-full rounded-full', CONF_BAR[d.severity])}
            style={{ width: `${Math.max(6, d.confidence)}%` }}
          />
        </span>
      )}
    </span>
  )
}

/**
 * Tier badge. Tier-1 is the forest core; Tier-2 is the village perimeter where
 * human-wildlife conflict actually happens, so the distinction is operationally
 * load-bearing rather than cosmetic — it belongs on every row that has it.
 */
export function TierBadge({
  tier,
  compact = false,
  className,
}: {
  tier: Tier
  compact?: boolean
  className?: string
}) {
  const isCore = tier === 'T1'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold',
        isCore
          ? 'border-status-ok/40 bg-[color:var(--status-ok-fill)] text-status-ok'
          : 'border-status-warning/40 bg-[color:var(--status-warning-fill)] text-status-warning',
        className,
      )}
      title={isCore ? 'Tier-1 — forest core' : 'Tier-2 — village perimeter'}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0',
          // Shape differs too, so the badge survives a grayscale check.
          isCore ? 'rounded-full bg-current' : 'rotate-45 bg-current',
        )}
      />
      {tier}
      {!compact && <span className="font-sans">{isCore ? 'forest' : 'perimeter'}</span>}
    </span>
  )
}
