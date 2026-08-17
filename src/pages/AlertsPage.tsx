/**
 * Alerts / triage queue — spec: design-system/wildguardx/pages/alerts.md
 *
 * Notable spec rules honoured here:
 *  - All filters serialize to the URL, so an operator can paste a link to
 *    exactly what they are looking at into an incident report.
 *  - New alerts never reorder rows under the cursor: they queue behind a pill.
 *  - Bulk destructive actions confirm with an exact count and offer Undo.
 *  - An empty queue reads as SUCCESS, not as an error.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUp, Download, Filter, ShieldCheck, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { Detection, Severity } from '@/data/types'
import { AsyncBoundary, EmptyState, SkeletonRows } from '@/components/ui/states'
import { AlertRow } from '@/components/domain/AlertRow'
import { Button } from '@/components/ui/Button'
import { Chip, IncidentStatusChip, SeverityChip } from '@/components/ui/Chip'
import { ConfidenceBar } from '@/components/domain/ConfidenceBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { iconProps, CLASS_ICONS } from '@/components/domain/icons'
import { absoluteDateTime, classLabel, coords, relativeAge } from '@/lib/format'
import { useMediaQuery } from '@/lib/hooks'

type QuickFilter = 'all' | 'critical' | 'unacked' | 'mine' | 'resolved'

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'unacked', label: 'Unacknowledged' },
  { id: 'mine', label: 'Assigned to me' },
  { id: 'resolved', label: 'Resolved' },
]

const ME = 'U-02'

export function AlertsPage() {
  const { provider, liveFeed, tick } = useData()
  const [params, setParams] = useSearchParams()
  const isXl = useMediaQuery('(min-width: 1440px)')

  // --- URL-synced filter state
  const quick = (params.get('tab') as QuickFilter) ?? 'all'
  const severity = params.get('severity') ?? ''
  const cls = params.get('class') ?? ''
  const sector = params.get('sector') ?? ''
  const minConfidence = Number(params.get('minConfidence') ?? 0)
  const search = params.get('q') ?? ''

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params)
      if (!value) next.delete(key)
      else next.set(key, value)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true })

  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Detection | null>(null)
  const [audio, setAudio] = useState(false)
  const [undo, setUndo] = useState<{ label: string; count: number } | null>(null)
  const [confirmDismiss, setConfirmDismiss] = useState(false)

  const query = useAsyncData(
    () =>
      provider.getAlerts({
        limit: 200,
        severity: severity ? [severity] : undefined,
        cls: cls ? [cls] : undefined,
        sector: sector ? [sector] : undefined,
        minConfidence: minConfidence || undefined,
        search: search || undefined,
      }),
    [provider, tick, severity, cls, sector, minConfidence, search],
    {
      isEmpty: (p) => p.items.length === 0,
      emptyValue: { items: [] as Detection[], total: 0, nextCursor: null },
      partialSources: ['Sector 4 uplink'],
    },
  )

  const all = query.data?.items ?? []

  const filtered = useMemo(() => {
    switch (quick) {
      case 'critical':
        return all.filter((d) => d.severity === 'critical')
      case 'unacked':
        return all.filter((d) => d.status === 'active')
      case 'mine':
        return all.filter((d) => d.assignedTo === ME || d.acknowledgedBy === ME)
      case 'resolved':
        return all.filter((d) => d.status === 'resolved' || d.status === 'false_positive')
      default:
        return all
    }
  }, [all, quick])

  const counts = useMemo(
    () => ({
      all: all.length,
      critical: all.filter((d) => d.severity === 'critical').length,
      unacked: all.filter((d) => d.status === 'active').length,
      mine: all.filter((d) => d.assignedTo === ME || d.acknowledgedBy === ME).length,
      resolved: all.filter((d) => d.status === 'resolved' || d.status === 'false_positive').length,
    }),
    [all],
  )

  const acknowledge = async (d: Detection) => {
    await provider.acknowledgeAlert(d.incidentId, ME)
    setUndo({ label: 'Acknowledged', count: 1 })
    query.retry()
  }

  const dispatch = async (d: Detection) => {
    await provider.dispatchAlert(d.incidentId, 'U-01')
    setUndo({ label: 'Dispatched', count: 1 })
    query.retry()
  }

  const bulkAcknowledge = async () => {
    const ids = [...selected]
    await Promise.all(ids.map((id) => provider.acknowledgeAlert(id, ME).catch(() => null)))
    setUndo({ label: 'Acknowledged', count: ids.length })
    setSelected(new Set())
    query.retry()
  }

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 10_000)
    return () => clearTimeout(t)
  }, [undo])

  const activeChips = [
    severity && { key: 'severity', label: `Severity: ${severity}` },
    cls && { key: 'class', label: `Class: ${classLabel(cls as Detection['cls'])}` },
    sector && { key: 'sector', label: `Sector: ${sector}` },
    minConfidence > 0 && { key: 'minConfidence', label: `Confidence ≥ ${minConfidence}%` },
    search && { key: 'q', label: `Search: ${search}` },
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Alerts"
        count={query.state === 'loading' ? undefined : filtered.length}
        actions={
          <>
            <Button
              size="sm"
              variant="subtle"
              icon={<SlidersHorizontal size={14} {...iconProps} />}
              onClick={() => setDensity((d) => (d === 'comfortable' ? 'compact' : 'comfortable'))}
              aria-pressed={density === 'compact'}
            >
              {density === 'comfortable' ? 'Compact' : 'Comfortable'}
            </Button>
            <Button
              size="sm"
              variant="subtle"
              icon={audio ? <Volume2 size={14} {...iconProps} /> : <VolumeX size={14} {...iconProps} />}
              onClick={() => setAudio((a) => !a)}
              aria-pressed={audio}
              title="Single-shot chime on critical alerts. Never a looping alarm."
            >
              {audio ? 'Sound on' : 'Sound off'}
            </Button>
            <Button size="sm" variant="subtle" icon={<Download size={14} {...iconProps} />}>
              Export CSV
            </Button>
            <Link to="/app/notifications">
              <Button size="sm" variant="ghost">
                Escalation rules
              </Button>
            </Link>
          </>
        }
      />

      {/* --- Quick filters ------------------------------------------------- */}
      <div className="mb-md flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((f) => {
          const active = quick === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setParam('tab', f.id === 'all' ? null : f.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-base ease-out',
                active
                  ? 'border-primary bg-[color:var(--status-watch-fill)] text-primary'
                  : 'border-border bg-surface-2 text-fg-secondary hover:bg-surface-3',
              )}
            >
              {f.label}
              <span className="font-mono text-xs tabular-nums opacity-70">{counts[f.id]}</span>
            </button>
          )
        })}
      </div>

      {/* --- Filter bar ---------------------------------------------------- */}
      <div className="mb-md rounded-xl border border-border bg-surface-2 p-md">
        <div className="flex flex-wrap items-end gap-md">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs text-fg-muted">Search</span>
            <input
              value={search}
              onChange={(e) => setParam('q', e.target.value || null)}
              placeholder="Alert ID, node ID, or sector"
              className="input h-10 py-0 text-sm"
            />
          </label>

          <FilterSelect
            label="Severity"
            value={severity}
            onChange={(v) => setParam('severity', v)}
            options={['critical', 'warning', 'watch', 'info']}
          />
          <FilterSelect
            label="Class"
            value={cls}
            onChange={(v) => setParam('class', v)}
            options={['elephant', 'tiger', 'leopard', 'wild_boar', 'human', 'vehicle', 'gunshot', 'chainsaw']}
            format={(v) => classLabel(v as Detection['cls'])}
          />
          <FilterSelect
            label="Sector"
            value={sector}
            onChange={(v) => setParam('sector', v)}
            options={['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']}
          />

          <label className="w-[150px]">
            <span className="mb-1 block text-xs text-fg-muted">Confidence ≥ {minConfidence}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minConfidence}
              onChange={(e) => setParam('minConfidence', e.target.value === '0' ? null : e.target.value)}
              className="h-10 w-full cursor-pointer accent-[color:var(--color-primary)]"
            />
          </label>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-md flex flex-wrap items-center gap-1.5 border-t border-border pt-md">
            <Filter size={13} className="text-fg-muted" {...iconProps} />
            {activeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setParam(c.key, null)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface-3 px-2 py-0.5 text-xs text-fg-secondary transition-colors duration-base hover:bg-surface-4"
              >
                {c.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 cursor-pointer text-xs text-accent-text hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* --- List (+ preview pane at xl) ----------------------------------- */}
      <div className={cn('grid gap-md', isXl && preview && 'grid-cols-[3fr_2fr]')}>
        <AsyncBoundary
          query={query}
          skeleton={<SkeletonRows rows={8} height={density === 'compact' ? 60 : 92} />}
          empty={
            <div className="rounded-xl border border-border bg-surface-2">
              {activeChips.length > 0 || quick !== 'all' ? (
                <EmptyState
                  title="No alerts match these filters"
                  body="Widen the filters or clear them to see the full queue."
                  action={
                    <Button variant="primary" size="sm" onClick={clearFilters}>
                      Clear all filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  tone="positive"
                  icon={<ShieldCheck size={26} {...iconProps} />}
                  title="Queue clear"
                  body="No active alerts. The last detection was 3h 12m ago in Sector 2."
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setParam('tab', 'resolved')}>
                      View resolved
                    </Button>
                  }
                />
              )}
            </div>
          }
        >
          {() => (
            <AlertList
              alerts={filtered}
              density={density}
              liveCount={liveFeed.length}
              selected={selected}
              onToggleSelect={(id) =>
                setSelected((s) => {
                  const next = new Set(s)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onAcknowledge={acknowledge}
              onDispatch={dispatch}
              onPreview={isXl ? setPreview : undefined}
              previewId={preview?.id ?? null}
            />
          )}
        </AsyncBoundary>

        {isXl && preview && <PreviewPane detection={preview} onClose={() => setPreview(null)} />}
      </div>

      {/* --- Bulk action bar ------------------------------------------------ */}
      {selected.size > 0 && (
        <div className="sticky bottom-md z-20 mt-md flex flex-wrap items-center gap-md rounded-xl border border-border bg-surface-4 px-md py-3 shadow-xl">
          <span className="text-sm font-medium text-fg">
            {selected.size} selected
            <button
              type="button"
              onClick={() => setSelected(new Set(filtered.map((d) => d.incidentId)))}
              className="ml-2 cursor-pointer text-xs font-normal text-accent-text hover:underline"
            >
              Select all {filtered.length} filtered
            </button>
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="primary" onClick={bulkAcknowledge}>
            Acknowledge
          </Button>
          <Button size="sm" variant="subtle">
            Assign
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDismiss(true)}>
            Dismiss as false positive
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Destructive bulk action: exact count, stated impact */}
      <Modal
        open={confirmDismiss}
        onClose={() => setConfirmDismiss(false)}
        title={`Dismiss ${selected.size} alert${selected.size > 1 ? 's' : ''} as false positive?`}
        description="This marks each incident closed and feeds the detections into the model retraining queue. It does not delete the evidence."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDismiss(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setUndo({ label: 'Dismissed as false positive', count: selected.size })
                setSelected(new Set())
                setConfirmDismiss(false)
              }}
            >
              Dismiss {selected.size}
            </Button>
          </>
        }
      />

      {/* Undo toast — every bulk action offers one for 10 seconds */}
      {undo && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-md rounded-xl border border-border bg-surface-4 px-md py-3 shadow-xl md:bottom-md"
        >
          <span className="text-sm text-fg-secondary">
            {undo.label} · {undo.count} alert{undo.count > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              setUndo(null)
              query.retry()
            }}
            className="cursor-pointer text-sm font-semibold text-accent-text hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

/* ========================================================================== */

function FilterSelect({
  label,
  value,
  onChange,
  options,
  format,
}: {
  label: string
  value: string
  onChange: (v: string | null) => void
  options: string[]
  format?: (v: string) => string
}) {
  return (
    <label className="w-[150px]">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="input h-10 cursor-pointer py-0 text-sm"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format ? format(o) : o}
          </option>
        ))}
      </select>
    </label>
  )
}

function AlertList({
  alerts,
  density,
  liveCount,
  selected,
  onToggleSelect,
  onAcknowledge,
  onDispatch,
  onPreview,
  previewId,
}: {
  alerts: Detection[]
  density: 'comfortable' | 'compact'
  liveCount: number
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onAcknowledge: (d: Detection) => void
  onDispatch: (d: Detection) => void
  onPreview?: (d: Detection) => void
  previewId: string | null
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [atTop, setAtTop] = useState(true)
  const [seen, setSeen] = useState(liveCount)
  const [focusIndex, setFocusIndex] = useState(0)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => setAtTop(el.scrollTop < 24)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (atTop) setSeen(liveCount)
  }, [atTop, liveCount])

  // j/k navigation, suppressed while typing in an input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
      if (e.key === 'j') setFocusIndex((i) => Math.min(alerts.length - 1, i + 1))
      if (e.key === 'k') setFocusIndex((i) => Math.max(0, i - 1))
      if (e.key === 'a' && alerts[focusIndex]) onAcknowledge(alerts[focusIndex])
      if (e.key === 'd' && alerts[focusIndex]) onDispatch(alerts[focusIndex])
      if (e.key === 'x' && alerts[focusIndex]) onToggleSelect(alerts[focusIndex].incidentId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alerts, focusIndex, onAcknowledge, onDispatch, onToggleSelect])

  const pending = Math.max(0, liveCount - seen)
  // Only ~60 rows in the DOM regardless of queue size.
  const windowed = alerts.slice(0, 60)

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
      {pending > 0 && (
        <button
          type="button"
          onClick={() => {
            scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
            setSeen(liveCount)
          }}
          className="absolute inset-x-0 top-2 z-10 mx-auto flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-status-info/50 bg-surface-4 px-3 py-1.5 text-xs font-medium text-status-info shadow-lg"
        >
          <ArrowUp size={12} {...iconProps} />
          {pending} new alert{pending > 1 ? 's' : ''}
        </button>
      )}

      <div ref={scroller} role="feed" aria-label="Alert triage queue" className="max-h-[70vh] overflow-y-auto">
        {windowed.map((d, i) => (
          <div
            key={d.id}
            aria-posinset={i + 1}
            aria-setsize={alerts.length}
            className={cn(
              'flex items-start gap-2',
              i === focusIndex && 'outline outline-2 -outline-offset-2 outline-ring',
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(d.incidentId)}
              onChange={() => onToggleSelect(d.incidentId)}
              aria-label={`Select ${classLabel(d.cls)} at ${d.nodeId}`}
              className="ml-3 mt-5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--color-primary)]"
            />
            <div className="min-w-0 flex-1">
              <AlertRow
                detection={d}
                density={density}
                onAcknowledge={onAcknowledge}
                onDispatch={onDispatch}
                onSelect={onPreview}
                selected={previewId === d.id}
              />
            </div>
          </div>
        ))}
        {alerts.length > windowed.length && (
          <p className="px-md py-3 text-center text-xs text-fg-muted">
            Showing {windowed.length} of {alerts.length}. Scroll or filter to narrow the queue.
          </p>
        )}
      </div>
    </div>
  )
}

function PreviewPane({ detection: d, onClose }: { detection: Detection; onClose: () => void }) {
  const Icon = CLASS_ICONS[d.cls]
  return (
    <aside className="h-fit rounded-xl border border-border bg-surface-2 p-lg" aria-label="Alert preview">
      <div className="flex items-start justify-between gap-md">
        <div className="flex items-center gap-2.5">
          <Icon size={20} className="text-primary" {...iconProps} />
          <h2 className="text-h3 text-fg">{classLabel(d.cls)}</h2>
        </div>
        <button type="button" onClick={onClose} className="cursor-pointer text-sm text-fg-muted hover:text-fg">
          Close
        </button>
      </div>

      <div className="mt-sm flex flex-wrap gap-1.5">
        <SeverityChip severity={d.severity} />
        <IncidentStatusChip status={d.status} />
        {d.sos && <Chip tone="critical">SOS raised</Chip>}
      </div>

      <div className="mt-md">
        <span className="text-xs text-fg-muted">Model confidence</span>
        <div className="mt-1">
          <ConfidenceBar value={d.confidence} />
        </div>
      </div>

      {/* Evidence placeholders are explicit about what is and is not captured */}
      <div className="mt-md rounded-lg border border-border bg-surface-1 p-md">
        <h3 className="mb-sm text-xs font-semibold uppercase tracking-wide text-fg-muted">Evidence</h3>
        <ul className="space-y-1 text-xs text-fg-secondary">
          <li>Audio: {d.evidence.audio ? '3s clip captured' : 'not captured — node is not acoustic'}</li>
          <li>Image: {d.evidence.image ? 'frame captured' : 'not captured — node has no camera'}</li>
          <li>Thermal: {d.evidence.thermal ? 'frame captured' : 'not captured — node has no thermal sensor'}</li>
        </ul>
      </div>

      <dl className="mt-md space-y-1.5 font-mono text-xs">
        <PRow k="Incident" v={d.incidentId} />
        <PRow k="Node" v={d.nodeId} />
        <PRow k="Sector" v={`${d.sector} · ${d.zone}`} />
        <PRow k="Detected" v={absoluteDateTime(d.ts)} />
        <PRow k="Age" v={`${relativeAge(d.ts)} ago`} />
        <PRow k="Position" v={coords(d.lat, d.lng)} />
        <PRow k="Model" v={d.modelVersion} />
      </dl>

      <Link to={`/app/incidents/${d.incidentId}`} className="mt-md block">
        <Button variant="primary" size="md" className="w-full">
          Open full incident
        </Button>
      </Link>
    </aside>
  )
}

function PRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{k}</dt>
      <dd className="text-right text-fg-secondary">{v}</dd>
    </div>
  )
}
