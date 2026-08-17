import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { IncidentStatus, NodeStatus, Severity } from '@/data/types'
import { NODE_STATUS_ICONS, SEVERITY_ICONS, iconProps } from '@/components/domain/icons'
import { incidentStatusLabel, severityLabel } from '@/lib/format'

type Tone = 'critical' | 'warning' | 'watch' | 'info' | 'ok' | 'offline' | 'neutral'

const TONES: Record<Tone, string> = {
  critical: 'text-status-critical bg-[color:var(--status-critical-fill)] border-status-critical/40',
  warning: 'text-status-warning bg-[color:var(--status-warning-fill)] border-status-warning/40',
  watch: 'text-status-watch bg-[color:var(--status-watch-fill)] border-status-watch/40',
  info: 'text-status-info bg-[color:var(--status-info-fill)] border-status-info/40',
  ok: 'text-status-ok bg-[color:var(--status-ok-fill)] border-status-ok/40',
  offline: 'text-status-offline bg-[color:var(--status-offline-fill)] border-status-offline/40',
  neutral: 'text-fg-secondary bg-surface-3 border-border',
}

interface ChipProps {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  className?: string
  mono?: boolean
}

export function Chip({ tone = 'neutral', icon, children, className, mono }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        mono && 'font-mono',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Severity: color + icon + text label, never color alone (README §5). */
export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  const Icon = SEVERITY_ICONS[severity]
  return (
    <Chip tone={severity} className={cn('uppercase tracking-wide', className)} icon={<Icon size={12} {...iconProps} />}>
      {severityLabel(severity)}
    </Chip>
  )
}

const INCIDENT_TONE: Record<IncidentStatus, Tone> = {
  active: 'critical',
  acknowledged: 'info',
  dispatched: 'warning',
  resolved: 'ok',
  false_positive: 'offline',
}

export function IncidentStatusChip({ status }: { status: IncidentStatus }) {
  return (
    <Chip tone={INCIDENT_TONE[status]} icon={<StatusDot status={status} />}>
      {incidentStatusLabel(status)}
    </Chip>
  )
}

/** Dot shapes differ per state so the encoding survives grayscale. */
function StatusDot({ status }: { status: IncidentStatus }) {
  if (status === 'resolved') return <span className="h-2 w-2 rounded-full bg-current" />
  if (status === 'active')
    return <span className="h-2 w-2 rounded-full border-2 border-current" />
  return <span className="h-2 w-2 rotate-45 bg-current" />
}

const NODE_TONE: Record<NodeStatus, Tone> = {
  online: 'ok',
  degraded: 'warning',
  offline: 'offline',
}

const NODE_LABEL: Record<NodeStatus, string> = {
  online: 'Online',
  degraded: 'Degraded',
  offline: 'Offline',
}

export function NodeStatusChip({ status }: { status: NodeStatus }) {
  const Icon = NODE_STATUS_ICONS[status]
  return (
    <Chip tone={NODE_TONE[status]} icon={<Icon size={12} {...iconProps} />}>
      {NODE_LABEL[status]}
    </Chip>
  )
}

/**
 * Node status as a compact dot for dense tables. Shape encodes the state:
 * filled = online, filled + ring = degraded, hollow dashed = offline.
 */
export function NodeStatusDot({ status }: { status: NodeStatus }) {
  const base = 'inline-block h-2.5 w-2.5 rounded-full shrink-0'
  if (status === 'online') return <span className={cn(base, 'bg-status-ok')} />
  if (status === 'degraded')
    return <span className={cn(base, 'bg-status-warning ring-2 ring-status-warning/30')} />
  return <span className={cn(base, 'border-2 border-dashed border-status-offline')} />
}
