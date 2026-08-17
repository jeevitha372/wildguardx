import type { DetectionClass, IncidentStatus, Severity } from '@/data/types'

/** Relative age, e.g. "2m 14s ago". Absolute past 24h (alerts.md §3.4). */
export function relativeAge(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ${h % 24}h`
  return absoluteDate(ts)
}

export function absoluteDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function absoluteTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function absoluteDateTime(ts: number): string {
  return `${absoluteDate(ts)} ${absoluteTime(ts)} IST`
}

export function isoString(ts: number): string {
  return new Date(ts).toISOString()
}

/** Elapsed as "12m 04s" — Fira Code + tabular-nums at the call site. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${String(rem).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, '0')}m`
}

export function percent(n: number, dp = 1): string {
  return `${n.toFixed(dp)}%`
}

export function coords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}${ns} ${Math.abs(lng).toFixed(4)}${ew}`
}

const CLASS_LABELS: Record<DetectionClass, string> = {
  elephant: 'Elephant',
  tiger: 'Tiger',
  leopard: 'Leopard',
  wild_boar: 'Wild boar',
  human: 'Human presence',
  vehicle: 'Vehicle',
  gunshot: 'Gunshot signature',
  chainsaw: 'Chainsaw signature',
}

export function classLabel(cls: DetectionClass): string {
  return CLASS_LABELS[cls] ?? cls
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  watch: 'Watch',
  info: 'Info',
}

export function severityLabel(s: Severity): string {
  return SEVERITY_LABELS[s] ?? s
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  active: 'Unacknowledged',
  acknowledged: 'Acknowledged',
  dispatched: 'Dispatched',
  resolved: 'Resolved',
  false_positive: 'False positive',
}

export function incidentStatusLabel(s: IncidentStatus): string {
  return STATUS_LABELS[s] ?? s
}

const OUTCOME_LABELS: Record<string, string> = {
  threat_confirmed_action_taken: 'Threat confirmed — action taken',
  threat_confirmed_no_action: 'Threat confirmed — no action possible',
  no_threat_found: 'No threat found',
  false_positive_model: 'False positive — model error',
  false_positive_environmental: 'False positive — environmental',
}

export function outcomeLabel(o: string | null): string {
  if (!o) return '—'
  return OUTCOME_LABELS[o] ?? o
}

export function memberStatusLabel(s: string): string {
  return (
    {
      online: 'Online',
      available: 'Available',
      responding: 'Responding',
      off_duty: 'Off duty',
      off_grid: 'Off-grid',
    }[s] ?? s
  )
}

/** Compact number for axis ticks and chips. */
export function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
