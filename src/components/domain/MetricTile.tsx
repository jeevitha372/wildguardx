import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { iconProps } from './icons'

type Tone = 'default' | 'critical' | 'warning' | 'ok' | 'info'

const VALUE_TONE: Record<Tone, string> = {
  default: 'text-fg',
  critical: 'text-status-critical',
  warning: 'text-status-warning',
  ok: 'text-status-ok',
  info: 'text-status-info',
}

interface MetricTileProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  /** Only set on tiles that navigate/filter. Static KPI tiles must not. */
  onClick?: () => void
  pressed?: boolean
  sparkline?: ReactNode
  /** What the sparkline shows. A trend line without a stated series is noise. */
  sparklineLabel?: string
  delta?: {
    value: number
    /** Formatted display, e.g. "38s" or "12%". */
    display: string
    /** Whether a *decrease* is the good direction. Colour follows desirability,
     *  the arrow follows direction — and the title states both, because that
     *  pairing is easy to misread (analytics.md §3.2). */
    lowerIsBetter?: boolean
    period?: string
  }
}

export function MetricTile({
  label,
  value,
  sub,
  tone = 'default',
  onClick,
  pressed,
  sparkline,
  sparklineLabel,
  delta,
}: MetricTileProps) {
  const interactive = !!onClick
  const Wrapper: 'button' | 'div' = interactive ? 'button' : 'div'

  return (
    <Wrapper
      {...(interactive
        ? { type: 'button' as const, onClick, 'aria-pressed': pressed }
        : {})}
      className={cn(
        'rounded-xl border bg-surface-2 p-md text-left transition-colors duration-base ease-out',
        pressed ? 'border-primary bg-[color:var(--status-watch-fill)]' : 'border-border',
        // Pointer ONLY when the tile actually does something.
        interactive && 'cursor-pointer hover:bg-surface-3',
      )}
    >
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-fg-muted">{label}</div>
      <div className={cn('mt-1.5 font-mono text-metric font-bold tabular-nums', VALUE_TONE[tone])}>
        {value}
      </div>
      {(sub || delta) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          {delta && <DeltaChip {...delta} />}
          {sub}
        </div>
      )}
      {sparkline && (
        <div className="mt-2.5 border-t border-border pt-2">
          <div
            className="h-8"
            role="img"
            aria-label={sparklineLabel ?? 'Recent trend'}
            title={sparklineLabel}
          >
            {sparkline}
          </div>
          {sparklineLabel && (
            <div className="mt-1 text-[10px] leading-tight text-fg-muted">{sparklineLabel}</div>
          )}
        </div>
      )}
    </Wrapper>
  )
}

function DeltaChip({
  value,
  display,
  lowerIsBetter = false,
  period = 'vs previous period',
}: NonNullable<MetricTileProps['delta']>) {
  const rising = value > 0
  const flat = value === 0
  const good = flat ? null : lowerIsBetter ? !rising : rising

  const Icon = flat ? Minus : rising ? ArrowUp : ArrowDown
  const tone = flat
    ? 'text-fg-muted'
    : good
      ? 'text-status-ok'
      : 'text-status-critical'

  const direction = flat ? 'unchanged' : rising ? 'up' : 'down'
  const judgement = flat ? '' : good ? ' — an improvement' : ' — worse'

  return (
    <span
      className={cn('inline-flex items-center gap-1 font-mono tabular-nums', tone)}
      title={`${display} ${direction} ${period}${judgement}`}
    >
      <Icon size={12} {...iconProps} />
      {display}
      <span className="font-sans text-fg-muted">{period}</span>
    </span>
  )
}
