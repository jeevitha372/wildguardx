/**
 * Operations dashboard — spec: design-system/wildguardx/pages/dashboard.md
 *
 * Layout targets 1440x900 with NO page scrollbar: the map and the alert feed
 * have fixed heights and scroll internally.
 *
 * Notable spec rules honoured here:
 *  - The threat banner is the ONLY aria-live="assertive" region.
 *  - The feed does not auto-scroll when the operator has scrolled away; new
 *    arrivals surface as a "N new alerts" pill instead.
 *  - Row actions are always rendered (touch + keyboard), never hover-only.
 *  - KPI tiles are static: no pointer cursor, no navigation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ExternalLink, ShieldCheck, Siren } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { Detection, FieldNode, TeamMember } from '@/data/types'
import type { DashboardKpis, FleetSummary } from '@/data/types'
import { AsyncBoundary, EmptyState, SkeletonChart, SkeletonRows, SkeletonTiles } from '@/components/ui/states'
import { MetricTile } from '@/components/domain/MetricTile'
import { AlertRow } from '@/components/domain/AlertRow'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { LiveBadge } from '@/components/ui/LiveBadge'
import { SensorMap } from '@/components/map/SensorMap'
import { ChartCard, Donut, SparkBars, Sparkline, StackedBars } from '@/components/charts'
import { iconProps } from '@/components/domain/icons'
import { classLabel, duration, memberStatusLabel, relativeAge } from '@/lib/format'

export function DashboardPage() {
  const { provider, liveFeed, tick } = useData()
  const [ackBusy, setAckBusy] = useState<string | null>(null)

  const kpiQuery = useAsyncData<DashboardKpis>(
    () => provider.getDashboardKpis(),
    [provider, tick],
    { partialSources: ['fleet telemetry feed'] },
  )

  const alertsQuery = useAsyncData(
    () => provider.getAlerts({ limit: 40 }),
    [provider, tick],
    {
      isEmpty: (p) => p.items.length === 0,
      emptyValue: { items: [] as Detection[], total: 0, nextCursor: null },
      partialSources: ['Sector 4 uplink'],
    },
  )

  const fleetQuery = useAsyncData<FleetSummary>(() => provider.getFleetSummary(), [provider], {
    partialSources: ['fleet health feed'],
  })

  const nodesQuery = useAsyncData(() => provider.getDevices({ limit: 400 }), [provider], {
    isEmpty: (p) => p.items.length === 0,
    emptyValue: { items: [] as FieldNode[], total: 0, nextCursor: null },
  })

  const shiftQuery = useAsyncData<TeamMember[]>(() => provider.getOnShift(), [provider], {
    isEmpty: (m) => m.length === 0,
    emptyValue: [],
    partialSources: ['presence feed'],
  })

  const fleetHistoryQuery = useAsyncData(() => provider.getFleetHistory(24), [provider], {
    isEmpty: (h) => h.length === 0,
    emptyValue: [],
  })

  /* --- sparkline series -------------------------------------------------- *
   * Every series below is DERIVED from data the provider already returned.
   * Nothing here is invented in the component.                              */
  const alertSeries = useMemo(() => {
    const items = alertsQuery.data?.items ?? []
    const now = Date.now()
    const rows = Array.from({ length: 12 }, () => ({ value: 0 }))
    for (const d of items) {
      const idx = 11 - Math.floor((now - d.ts) / 3600_000)
      if (idx >= 0 && idx < 12) rows[idx].value += 1
    }
    return rows
  }, [alertsQuery.data])

  const criticalSeries = useMemo(() => {
    const items = alertsQuery.data?.items ?? []
    const now = Date.now()
    const rows = Array.from({ length: 12 }, () => ({ value: 0 }))
    for (const d of items) {
      if (d.severity !== 'critical') continue
      const idx = 11 - Math.floor((now - d.ts) / 3600_000)
      if (idx >= 0 && idx < 12) rows[idx].value += 1
    }
    return rows
  }, [alertsQuery.data])

  const onlineSeries = useMemo(
    () => (fleetHistoryQuery.data ?? []).map((p) => ({ value: p.online })),
    [fleetHistoryQuery.data],
  )

  const responseSeries = useMemo(() => {
    const items = (alertsQuery.data?.items ?? []).filter((d) => d.responseSeconds != null)
    const now = Date.now()
    const buckets: number[][] = Array.from({ length: 7 }, () => [])
    for (const d of items) {
      const idx = 6 - Math.floor((now - d.ts) / 86_400_000)
      if (idx >= 0 && idx < 7) buckets[idx].push(d.responseSeconds!)
    }
    return buckets.map((b) => {
      if (!b.length) return { value: 0 }
      const sorted = [...b].sort((x, y) => x - y)
      return { value: sorted[Math.floor(sorted.length / 2)] }
    })
  }, [alertsQuery.data])

  const acknowledge = useCallback(
    async (d: Detection) => {
      setAckBusy(d.incidentId)
      try {
        await provider.acknowledgeAlert(d.incidentId, 'U-02')
        alertsQuery.retry()
        kpiQuery.retry()
      } finally {
        setAckBusy(null)
      }
    },
    [provider, alertsQuery, kpiQuery],
  )

  const alerts = alertsQuery.data?.items ?? []
  const criticalUnacked = alerts.filter((a) => a.severity === 'critical' && a.status === 'active')

  return (
    <div className="mx-auto max-w-[1600px]">
      <h1 className="sr-only">Operations dashboard</h1>

      {/* --- Threat banner: only when a critical is unacknowledged --------- */}
      {criticalUnacked.length > 0 && (
        <ThreatBanner
          alerts={criticalUnacked}
          busy={ackBusy}
          onAcknowledge={acknowledge}
        />
      )}

      {/* --- KPI tiles (static) -------------------------------------------- */}
      <AsyncBoundary
        query={kpiQuery}
        className="mb-md"
        skeleton={<SkeletonTiles count={4} />}
        empty={<EmptyState title="No metrics yet" body="The first telemetry frame has not arrived." />}
      >
        {(k) => (
          <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
            <MetricTile
              label="Active alerts"
              value={k.activeAlerts}
              tone={k.criticalAlerts > 0 ? 'critical' : 'default'}
              sub={`${k.criticalAlerts} critical · ${k.warningAlerts} warning`}
              sparkline={
                <Sparkline
                  data={alertSeries}
                  color={k.criticalAlerts > 0 ? 'var(--status-critical-vivid)' : 'var(--color-primary-vivid)'}
                />
              }
              sparklineLabel="Detections per hour, last 12h"
            />
            <MetricTile
              label="Sensors online"
              value={`${k.sensorsOnline}/${k.sensorsTotal}`}
              tone={k.sensorsOnline / k.sensorsTotal < 0.95 ? 'warning' : 'ok'}
              sub={`${((k.sensorsOnline / k.sensorsTotal) * 100).toFixed(1)}% of fleet`}
              sparkline={<Sparkline data={onlineSeries} color="var(--status-ok-vivid)" />}
              sparklineLabel="Nodes reporting per hour, last 24h"
            />
            <MetricTile
              label="Median response"
              value={duration(k.medianResponseSeconds)}
              sub="detection → on scene"
              delta={{
                value: k.responseDeltaSeconds,
                display: `${Math.abs(k.responseDeltaSeconds)}s`,
                lowerIsBetter: true,
                period: 'vs 7d',
              }}
              sparkline={<Sparkline data={responseSeries} color="var(--color-accent-vivid)" />}
              sparklineLabel="Median response per day, last 7d"
            />
            <MetricTile
              label="Perimeter"
              value={k.perimeterSecure ? 'Secure' : 'Breach'}
              tone={k.perimeterSecure ? 'ok' : 'critical'}
              sub={`${k.breaches24h} critical events 24h`}
              sparkline={
                <SparkBars data={criticalSeries} color="var(--status-critical-vivid)" height={32} />
              }
              sparklineLabel="Critical events per hour, last 12h"
            />
          </div>
        )}
      </AsyncBoundary>

      {/* --- Map + feed ---------------------------------------------------- */}
      <div className="mt-md grid gap-md lg:grid-cols-12">
        <Card flat padding="none" className="overflow-hidden lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border px-md py-2.5">
            <h2 className="text-h3 text-fg">Live map</h2>
            <div className="flex items-center gap-sm">
              <LiveBadge />
              <Link
                to="/app/map"
                className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors duration-base hover:text-fg"
              >
                Open full map
                <ExternalLink size={12} {...iconProps} />
              </Link>
            </div>
          </div>
          <AsyncBoundary
            query={nodesQuery}
            skeleton={<div className="skeleton m-md" style={{ height: 'clamp(360px, 42vh, 520px)' }} />}
            empty={
              <EmptyState
                title="No sensors provisioned"
                body="Add your first ESP32 node to see it on the map."
                action={
                  <Link to="/app/devices">
                    <Button variant="primary" size="sm">
                      Provision a node
                    </Button>
                  </Link>
                }
              />
            }
          >
            {(page) => (
              <SensorMap
                nodes={page.items}
                detections={alerts}
                height="clamp(360px, 42vh, 520px)"
                zoom={11}
              />
            )}
          </AsyncBoundary>
        </Card>

        <Card flat padding="none" className="flex flex-col overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between border-b border-border px-md py-2.5">
            <h2 className="text-h3 text-fg">Alert feed</h2>
            <Link
              to="/app/alerts"
              className="text-xs text-fg-muted transition-colors duration-base hover:text-fg"
            >
              Triage queue
            </Link>
          </div>
          <AsyncBoundary
            query={alertsQuery}
            className="flex-1 overflow-hidden"
            skeleton={<SkeletonRows rows={5} height={92} />}
            empty={
              <EmptyState
                tone="positive"
                icon={<ShieldCheck size={26} {...iconProps} />}
                title="Queue clear"
                body="No active alerts. Last detection 3h 12m ago in Sector 2."
                action={
                  <Link to="/app/alerts?tab=resolved">
                    <Button variant="ghost" size="sm">
                      View resolved
                    </Button>
                  </Link>
                }
              />
            }
          >
            {(page) => (
              <AlertFeed
                alerts={page.items}
                liveCount={liveFeed.length}
                onAcknowledge={acknowledge}
                busy={ackBusy}
              />
            )}
          </AsyncBoundary>
        </Card>
      </div>

      {/* --- Bottom row ---------------------------------------------------- */}
      <div className="mt-md grid gap-md lg:grid-cols-12">
        <AsyncBoundary
          query={fleetQuery}
          className="lg:col-span-4"
          skeleton={<SkeletonChart height={240} label="Loading fleet health" />}
          empty={<EmptyState title="No fleet data" body="No nodes are reporting." />}
        >
          {(f) => <FleetHealth summary={f} nodes={nodesQuery.data?.items ?? []} />}
        </AsyncBoundary>

        <div className="lg:col-span-4">
          <AsyncBoundary
            query={alertsQuery}
            skeleton={<SkeletonChart height={240} label="Loading detections" />}
            empty={<EmptyState title="No detections in 24h" body="The reserve has been quiet." />}
          >
            {(page) => <Detections24h alerts={page.items} />}
          </AsyncBoundary>
        </div>

        <AsyncBoundary
          query={shiftQuery}
          className="lg:col-span-4"
          skeleton={<SkeletonRows rows={3} height={56} />}
          empty={
            <EmptyState
              title="Nobody on shift"
              body="No rangers are scheduled for the current window."
              action={
                <Link to="/app/team?tab=shifts">
                  <Button variant="primary" size="sm">
                    Open shift board
                  </Button>
                </Link>
              }
            />
          }
        >
          {(members) => <OnShiftPanel members={members} />}
        </AsyncBoundary>
      </div>
    </div>
  )
}

/* ========================================================================== */

function ThreatBanner({
  alerts,
  busy,
  onAcknowledge,
}: {
  alerts: Detection[]
  busy: string | null
  onAcknowledge: (d: Detection) => void
}) {
  const newest = alerts[0]
  const [, force] = useState(0)
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'on-critical mb-md flex flex-wrap items-center gap-md rounded-xl border border-status-critical/50 px-md py-3',
        'bg-[color:var(--status-critical-fill)] animate-fade-in',
        // The one permitted looping animation; suppressed by reduced motion.
        'motion-safe:animate-critical-pulse',
      )}
    >
      <Siren size={22} className="shrink-0 text-status-critical" strokeWidth={1.5} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-status-critical">
          {alerts.length} critical alert{alerts.length > 1 ? 's' : ''} unacknowledged
        </div>
        <div className="mt-0.5 truncate text-sm text-fg-secondary">
          {classLabel(newest.cls)} · {newest.sector} · {newest.nodeId} ·{' '}
          <span className="font-mono tabular-nums">{relativeAge(newest.ts)}</span> elapsed
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-sm">
        <Button
          variant="primary"
          size="sm"
          disabled={busy === newest.incidentId}
          onClick={() => onAcknowledge(newest)}
        >
          {busy === newest.incidentId ? 'Acknowledging…' : 'Acknowledge'}
        </Button>
        <Link to={`/app/incidents/${newest.incidentId}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      </div>
    </div>
  )
}

/* --- alert feed with the "N new" pill ------------------------------------- */

function AlertFeed({
  alerts,
  liveCount,
  onAcknowledge,
  busy,
}: {
  alerts: Detection[]
  liveCount: number
  onAcknowledge: (d: Detection) => void
  busy: string | null
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [atTop, setAtTop] = useState(true)
  const [seenCount, setSeenCount] = useState(liveCount)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => setAtTop(el.scrollTop < 24)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // At the top we absorb new arrivals silently; scrolled away, they queue.
  useEffect(() => {
    if (atTop) setSeenCount(liveCount)
  }, [atTop, liveCount])

  const pending = Math.max(0, liveCount - seenCount)

  return (
    <div className="relative flex h-full flex-col">
      {pending > 0 && (
        <button
          type="button"
          onClick={() => {
            scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
            setSeenCount(liveCount)
          }}
          className="absolute inset-x-0 top-2 z-10 mx-auto flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-status-info/50 bg-surface-4 px-3 py-1.5 text-xs font-medium text-status-info shadow-lg"
        >
          <ArrowUp size={12} {...iconProps} />
          {pending} new alert{pending > 1 ? 's' : ''}
        </button>
      )}
      <div
        ref={scroller}
        role="feed"
        aria-label="Live alert feed"
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: 'clamp(360px, 42vh, 520px)' }}
      >
        {alerts.slice(0, 40).map((d, i) => (
          <div key={d.id} aria-posinset={i + 1} aria-setsize={alerts.length}>
            <AlertRow
              detection={d}
              onAcknowledge={busy === d.incidentId ? undefined : onAcknowledge}
              isNew={d.simulated && Date.now() - d.ts < 5000}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* --- fleet health --------------------------------------------------------- */

function FleetHealth({ summary, nodes }: { summary: FleetSummary; nodes: FieldNode[] }) {
  const data = [
    { name: 'Online', value: summary.online, color: 'var(--status-ok)' },
    { name: 'Degraded', value: summary.degraded, color: 'var(--status-warning)' },
    { name: 'Offline', value: summary.offline, color: 'var(--status-offline)' },
  ]

  const lowest = useMemo(
    () =>
      [...nodes]
        .filter((n) => n.status !== 'offline')
        .sort((a, b) => a.battery - b.battery)
        .slice(0, 3),
    [nodes],
  )

  return (
    <ChartCard
      title="Fleet health"
      subtitle="How many field nodes are reporting right now"
      rows={summary.total}
      table={{
        headers: ['State', 'Nodes'],
        rows: data.map((d) => [d.name, d.value]),
      }}
    >
      <Donut data={data} height={168} />
      <ul className="mt-md space-y-1.5">
        {data.map((d) => (
          <li key={d.name}>
            <Link
              to={`/app/devices?status=${d.name.toLowerCase()}`}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors duration-base hover:bg-surface-3"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <span className="text-fg-secondary">{d.name}</span>
              <span className="ml-auto font-mono tabular-nums text-fg">{d.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-md border-t border-border pt-md">
        <h4 className="mb-sm text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Lowest battery
        </h4>
        <ul className="space-y-1.5">
          {lowest.map((n) => (
            <li key={n.id} className="flex items-center gap-2 text-sm">
              <Link to={`/app/devices/${n.id}`} className="font-mono text-xs text-fg-secondary hover:underline">
                {n.id}
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-4">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      n.battery < 15 ? 'bg-status-critical' : n.battery < 30 ? 'bg-status-warning' : 'bg-status-ok',
                    )}
                    style={{ width: `${Math.max(2, n.battery)}%` }}
                  />
                </span>
                <span className="w-9 text-right font-mono text-xs tabular-nums text-fg">{n.battery}%</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  )
}

/* --- detections in the last 24h ------------------------------------------- */

function Detections24h({ alerts }: { alerts: Detection[] }) {
  const data = useMemo(() => {
    const now = new Date()
    const buckets = Array.from({ length: 24 }).map((_, i) => {
      const h = new Date(now.getTime() - (23 - i) * 3600_000)
      return {
        hour: `${String(h.getHours()).padStart(2, '0')}`,
        elephant: 0,
        tiger: 0,
        leopard: 0,
        wild_boar: 0,
        other: 0,
      } as Record<string, string | number>
    })
    const cutoff = now.getTime() - 24 * 3600_000
    for (const d of alerts) {
      if (d.ts < cutoff) continue
      const idx = 23 - Math.floor((now.getTime() - d.ts) / 3600_000)
      if (idx < 0 || idx > 23) continue
      const key = ['elephant', 'tiger', 'leopard', 'wild_boar'].includes(d.cls) ? d.cls : 'other'
      buckets[idx][key] = (buckets[idx][key] as number) + 1
    }
    return buckets
  }, [alerts])

  const keys = [
    { key: 'elephant', label: 'Elephant' },
    { key: 'tiger', label: 'Tiger' },
    { key: 'leopard', label: 'Leopard' },
    { key: 'wild_boar', label: 'Wild boar' },
    { key: 'other', label: 'Other' },
  ]

  return (
    <ChartCard
      title="Detections, last 24h"
      subtitle="Hourly buckets, coloured by class"
      rows={alerts.filter((a) => a.ts > Date.now() - 24 * 3600_000).length}
      table={{
        headers: ['Hour', ...keys.map((k) => k.label)],
        rows: data.map((row) => [row.hour as string, ...keys.map((k) => row[k.key] as number)]),
      }}
    >
      <StackedBars data={data} keys={keys} xKey="hour" height={200} />
    </ChartCard>
  )
}

/* --- on-shift rangers ------------------------------------------------------ */

const MEMBER_TONE: Record<string, 'ok' | 'info' | 'warning' | 'offline' | 'critical'> = {
  online: 'info',
  available: 'ok',
  responding: 'warning',
  off_duty: 'offline',
  off_grid: 'critical',
}

function OnShiftPanel({ members }: { members: TeamMember[] }) {
  return (
    <Card flat>
      <CardHeader
        title="On shift"
        wash
        subtitle={`${members.length} on the current window`}
        actions={
          <Link to="/app/team" className="text-xs text-fg-muted hover:text-fg">
            Team
          </Link>
        }
      />
      <ul className="space-y-1">
        {members.map((m) => {
          const pingMinutes = (Date.now() - m.lastPing) / 60000
          const offGrid = pingMinutes > 15
          return (
            <li
              key={m.id}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors duration-base hover:bg-surface-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 font-mono text-[11px] font-semibold text-fg-secondary">
                {m.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">{m.name}</div>
                <div className="font-mono text-[11px] text-fg-muted">
                  {m.sectors.join(', ') || '—'} · {m.role}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Chip tone={MEMBER_TONE[m.status] ?? 'neutral'}>{memberStatusLabel(m.status)}</Chip>
                <span
                  className={cn(
                    'font-mono text-[10px] tabular-nums',
                    offGrid ? 'text-status-warning' : 'text-fg-muted',
                  )}
                  title={offGrid ? 'No ping for over 15 minutes — welfare check threshold' : undefined}
                >
                  {relativeAge(m.lastPing)} ago
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
