/**
 * The seven data states, rendered.
 *
 * Every async region on every page routes through <AsyncBoundary>, so no page
 * can quietly ship five of the seven.
 */

import type { CSSProperties, ReactNode } from 'react'
import { CircleAlert, Inbox, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { absoluteTime } from '@/lib/format'
import { rendersData, type AsyncQuery, type DataStateKind } from '@/lib/dataState'
import { iconProps } from '@/components/domain/icons'

/* --- loading -------------------------------------------------------------- */

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** Rows at the exact final height, so nothing shifts when data lands. */
export function SkeletonRows({ rows = 6, height = 72 }: { rows?: number; height?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-md border-b border-border px-md"
          style={{ height }}
        >
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTiles({ count = 4, height = 108 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-cols-2 gap-md lg:grid-cols-4" role="status" aria-busy="true">
      <span className="sr-only">Loading metrics…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface-2 p-md"
          style={{ minHeight: height }}
        >
          <Skeleton className="mb-3 h-2.5 w-20" />
          <Skeleton className="mb-3 h-8 w-24" />
          <Skeleton className="h-2.5 w-28" />
        </div>
      ))}
    </div>
  )
}

/** A chart block reserved at its final aspect so charts never cause CLS. */
export function SkeletonChart({ height = 260, label = 'Loading chart' }: { height?: number; label?: string }) {
  return (
    <div
      className="flex items-end gap-2 rounded-xl border border-border bg-surface-2 p-md"
      style={{ height }}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: 16 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1"
          // Deterministic heights — a random skeleton flickers between renders.
          style={{ height: `${28 + ((i * 37) % 60)}%` }}
        />
      ))}
    </div>
  )
}

/* --- empty ---------------------------------------------------------------- */

interface EmptyStateProps {
  /** SVG icon — never an emoji (README §11). */
  icon?: ReactNode
  title: string
  /** One line naming the cause, not "No data available". */
  body?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'positive'
}

export function EmptyState({ icon, title, body, action, tone = 'neutral' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-md py-2xl text-center">
      <div
        className={cn(
          'mb-md flex h-14 w-14 items-center justify-center rounded-2xl border',
          tone === 'positive'
            ? 'border-status-ok/30 bg-[color:var(--status-ok-fill)] text-status-ok'
            : 'border-border bg-surface-3 text-fg-muted',
        )}
      >
        {icon ?? <Inbox size={26} {...iconProps} />}
      </div>
      <h3 className="text-h3 text-fg">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-fg-muted">{body}</p>}
      {action && <div className="mt-md flex items-center gap-sm">{action}</div>}
    </div>
  )
}

/* --- error ---------------------------------------------------------------- */

export function ErrorState({
  title = "Couldn't load this",
  error,
  onRetry,
  secondaryAction,
}: {
  title?: string
  error?: Error | null
  onRetry?: () => void
  secondaryAction?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-status-critical/40 bg-[color:var(--status-critical-fill)] px-md py-xl text-center"
    >
      <CircleAlert size={26} className="mb-sm text-status-critical" {...iconProps} />
      <h3 className="text-h3 text-fg">{title}</h3>
      {/* The cause, verbatim — an operator debugging an outage needs the raw text. */}
      <p className="mt-1 max-w-lg font-mono text-xs text-fg-secondary">
        {error?.message ?? 'The upstream service did not respond.'}
      </p>
      <div className="mt-md flex items-center gap-sm">
        {onRetry && (
          <Button variant="primary" size="sm" icon={<RefreshCw size={14} {...iconProps} />} onClick={onRetry}>
            Retry
          </Button>
        )}
        {secondaryAction}
      </div>
    </div>
  )
}

/* --- partial / stale / offline banners ------------------------------------ */

export function PartialBanner({ failed, message }: { failed: string[]; message: string }) {
  return (
    <div
      role="status"
      className="mb-md flex items-start gap-sm rounded-lg border border-status-warning/40 bg-[color:var(--status-warning-fill)] px-md py-2.5"
    >
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-status-warning" {...iconProps} />
      <div className="text-sm">
        <span className="font-semibold text-status-warning">Partial data — </span>
        <span className="text-fg-secondary">{message}</span>
        <span className="ml-1 text-fg-muted">
          Failed source{failed.length > 1 ? 's' : ''}: {failed.join(', ')}.
        </span>
      </div>
    </div>
  )
}

export function StaleBanner({ updatedAt }: { updatedAt: number | null }) {
  return (
    <div
      role="status"
      className="mb-md flex items-center gap-sm rounded-lg border border-border bg-surface-3 px-md py-2.5 text-sm"
    >
      <CircleAlert size={16} className="shrink-0 text-fg-muted" {...iconProps} />
      <span className="text-fg-secondary">
        Values are delayed. Last updated{' '}
        <time className="font-mono text-fg">{updatedAt ? absoluteTime(updatedAt) : '—'}</time> — not current.
      </span>
    </div>
  )
}

export function OfflineBanner({ queued = 0 }: { queued?: number }) {
  return (
    <div
      role="status"
      className="mb-md flex items-center gap-sm rounded-lg border border-status-warning/40 bg-[color:var(--status-warning-fill)] px-md py-2.5 text-sm"
    >
      <WifiOff size={16} className="shrink-0 text-status-warning" {...iconProps} />
      <span className="text-fg-secondary">
        <span className="font-semibold text-status-warning">Offline</span> — showing cached data.
        {queued > 0 && ` ${queued} action${queued > 1 ? 's' : ''} queued and will sync on reconnect.`}
      </span>
    </div>
  )
}

/* --- boundary ------------------------------------------------------------- */

interface AsyncBoundaryProps<T> {
  query: AsyncQuery<T>
  /** Rendered for `loading`. Must match the final layout's dimensions. */
  skeleton: ReactNode
  /** Rendered for `empty`. */
  empty: ReactNode
  /** Optional override of the error presentation. */
  errorTitle?: string
  errorSecondaryAction?: ReactNode
  /** Number of actions queued while offline, for the offline banner. */
  queuedActions?: number
  children: (data: T, state: DataStateKind) => ReactNode
  className?: string
}

export function AsyncBoundary<T>({
  query,
  skeleton,
  empty,
  errorTitle,
  errorSecondaryAction,
  queuedActions,
  children,
  className,
}: AsyncBoundaryProps<T>) {
  const { state, data, error, partialInfo, updatedAt, retry } = query

  if (state === 'loading') return <div className={className}>{skeleton}</div>
  if (state === 'error')
    return (
      <div className={className}>
        <ErrorState title={errorTitle} error={error} onRetry={retry} secondaryAction={errorSecondaryAction} />
      </div>
    )
  if (state === 'empty') return <div className={className}>{empty}</div>

  if (!rendersData(state) || data === null) return <div className={className}>{empty}</div>

  return (
    <div className={className}>
      {state === 'partial' && partialInfo && <PartialBanner {...partialInfo} />}
      {state === 'offline' && <OfflineBanner queued={queuedActions} />}
      {state === 'stale' && <StaleBanner updatedAt={updatedAt} />}
      {/* Stale content dims to 60% — never present old numbers as current. */}
      <div className={cn(state === 'stale' && 'is-stale')}>{children(data, state)}</div>
    </div>
  )
}
