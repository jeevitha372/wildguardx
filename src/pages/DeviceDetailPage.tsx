/**
 * Device detail — spec: design-system/wildguardx/pages/device-detail.md
 *
 * Notable spec rules honoured here:
 *  - Telemetry charts share ONE x-axis via Recharts `syncId`, with a linked
 *    crosshair: diagnosis is correlation across series.
 *  - Data gaps BREAK the line (connectNulls={false}); nothing is interpolated
 *    across silence, because a silent node must look silent.
 *  - Config is eventually-consistent and says so: pending changes are labelled
 *    "applies at next check-in", never presented as applied.
 *  - An offline device disables node-dependent actions with a stated reason.
 */

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Save, Wrench } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { Detection, FieldNode, TelemetryPoint } from '@/data/types'
import { AsyncBoundary, EmptyState, Skeleton, SkeletonChart, SkeletonRows, SkeletonTiles } from '@/components/ui/states'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Chip, NodeStatusChip } from '@/components/ui/Chip'
import { MetricTile } from '@/components/domain/MetricTile'
import { TabBar, TabPanel, useTabs } from '@/components/ui/Tabs'
import { ChartCard, TelemetryChart } from '@/components/charts'
import { SensorMap } from '@/components/map/SensorMap'
import { AlertRow } from '@/components/domain/AlertRow'
import { NODE_TYPE_ICONS, iconProps } from '@/components/domain/icons'
import { absoluteDateTime, coords, percent, relativeAge } from '@/lib/format'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'detections', label: 'Detections' },
  { id: 'config', label: 'Config' },
  { id: 'history', label: 'History' },
]

const RANGES = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
]

export function DeviceDetailPage() {
  const { id = '' } = useParams()
  const { provider } = useData()
  const { active, setActive } = useTabs({ tabs: TABS, defaultTab: 'overview' })
  const [rangeHours, setRangeHours] = useState(24)
  const [pingState, setPingState] = useState<string | null>(null)

  const deviceQuery = useAsyncData<FieldNode | null>(() => provider.getDevice(id), [provider, id], {
    isEmpty: (d) => d === null,
    emptyValue: null,
    partialSources: ['telemetry feed'],
  })

  const telemetryQuery = useAsyncData<TelemetryPoint[]>(
    () => provider.getDeviceTelemetry(id, rangeHours),
    [provider, id, rangeHours],
    { isEmpty: (t) => t.length === 0, emptyValue: [], partialSources: ['telemetry feed'] },
  )

  const detectionsQuery = useAsyncData(
    () => provider.getAlerts({ limit: 200 }),
    [provider],
    {
      isEmpty: (p) => p.items.filter((d) => d.nodeId === id).length === 0,
      emptyValue: { items: [] as Detection[], total: 0, nextCursor: null },
    },
  )

  const device = deviceQuery.data
  const offline = device?.status === 'offline'

  const ping = async () => {
    setPingState('pinging')
    const res = await provider.pingDevice(id)
    setPingState(res.ok ? `Responded in ${res.latencyMs}ms` : 'No response after 10s')
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <Link
        to="/app/devices"
        className="mb-md inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-base hover:text-fg"
      >
        <ArrowLeft size={14} {...iconProps} />
        Back to devices
      </Link>

      <AsyncBoundary
        query={deviceQuery}
        skeleton={
          <div className="space-y-md">
            <Skeleton className="h-24 w-full rounded-xl" />
            <SkeletonTiles count={4} />
            <SkeletonChart height={280} />
          </div>
        }
        errorTitle={`Couldn't load ${id}`}
        empty={
          <EmptyState
            title="Device not found"
            body={`No device with ID ${id}. It may have been retired.`}
            action={
              <Link to="/app/devices">
                <Button variant="primary" size="sm">
                  Back to devices
                </Button>
              </Link>
            }
          />
        }
      >
        {(node) => {
          if (!node) return null
          const Icon = NODE_TYPE_ICONS[node.type]
          const nodeDetections = (detectionsQuery.data?.items ?? []).filter((d) => d.nodeId === node.id)

          return (
            <>
              {/* --- Header ------------------------------------------------ */}
              <div className="rounded-xl border border-border bg-surface-2 p-md">
                <div className="flex flex-wrap items-start gap-md">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-3 text-primary">
                    <Icon size={20} {...iconProps} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="font-mono text-h2 text-fg">{node.id}</h1>
                      <span className="text-sm text-fg-secondary">{node.label}</span>
                      <NodeStatusChip status={node.status} />
                      <Chip tone={node.tier === 'T1' ? 'ok' : 'warning'}>
                        {node.tier === 'T1' ? 'Forest core' : 'Village perimeter'}
                      </Chip>
                    </div>
                    <p className="mt-1 font-mono text-xs text-fg-muted">
                      {node.hardware} · {node.sector} · FW {node.firmware} · installed{' '}
                      {relativeAge(node.installedAt)} ago
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-sm">
                    <Button
                      size="sm"
                      variant="subtle"
                      icon={<RefreshCw size={13} {...iconProps} />}
                      onClick={ping}
                      disabled={offline}
                      disabledReason={`Device offline — last seen ${relativeAge(node.lastSeen)} ago`}
                    >
                      Ping
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      disabled={offline}
                      disabledReason={`Device offline — last seen ${relativeAge(node.lastSeen)} ago`}
                    >
                      Restart
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      icon={<Wrench size={13} {...iconProps} />}
                      disabled={offline}
                      disabledReason={`Device offline — last seen ${relativeAge(node.lastSeen)} ago`}
                    >
                      Update firmware
                    </Button>
                  </div>
                </div>

                {pingState && (
                  <p
                    role="status"
                    className={cn(
                      'mt-sm font-mono text-xs',
                      pingState.startsWith('No response') ? 'text-status-critical' : 'text-status-ok',
                    )}
                  >
                    {pingState === 'pinging' ? 'Pinging…' : pingState}
                  </p>
                )}

                {offline && (
                  <div className="mt-md flex items-start gap-2 rounded-lg border border-status-warning/40 bg-[color:var(--status-warning-fill)] px-md py-2.5 text-sm">
                    <span className="text-fg-secondary">
                      <strong className="text-status-warning">Device offline.</strong> Last heartbeat{' '}
                      {relativeAge(node.lastSeen)} ago ({absoluteDateTime(node.lastSeen)}). Live values
                      are shown as <span className="font-mono">——</span> rather than last-known.
                      Config edits are still allowed and will queue for next contact.
                    </span>
                  </div>
                )}

                <div className="mt-md">
                  <TabBar tabs={TABS} active={active} onChange={setActive} />
                </div>
              </div>

              {/* --- Overview --------------------------------------------- */}
              <TabPanel id="overview" active={active}>
                <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
                  <MetricTile
                    label="Battery"
                    value={offline ? '——' : `${node.battery}%`}
                    tone={offline ? 'default' : node.battery < 15 ? 'critical' : node.battery < 30 ? 'warning' : 'ok'}
                    sub={
                      offline
                        ? 'no heartbeat'
                        : node.charging
                          ? `charging ${node.solarInputW.toFixed(1)} W`
                          : `~${Math.round(node.battery / 1.1)} days remaining`
                    }
                  />
                  <MetricTile
                    label="Signal"
                    value={offline ? '——' : `${node.rssi}`}
                    sub={offline ? 'no heartbeat' : `dBm · SNR ${node.snr}`}
                    tone={offline ? 'default' : node.rssi < -105 ? 'warning' : 'ok'}
                  />
                  <MetricTile
                    label="Enclosure"
                    value={offline || node.enclosureTempC == null ? '——' : `${node.enclosureTempC}°C`}
                    sub="threshold 55°C"
                  />
                  <MetricTile label="Uptime 30d" value={percent(node.uptime30d, 2)} tone="ok" sub="rolling" />
                </div>

                <div className="mt-md grid gap-md lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <TelemetrySection
                      query={telemetryQuery}
                      rangeHours={rangeHours}
                      onRange={setRangeHours}
                    />
                  </div>

                  <div className="space-y-md lg:col-span-4">
                    <Card flat padding="none" className="overflow-hidden">
                      <div className="border-b border-border px-md py-2.5">
                        <h2 className="text-h3 text-fg">Location</h2>
                      </div>
                      <SensorMap nodes={[node]} height={180} zoom={13} showDetections={false} />
                      <dl className="space-y-1.5 p-md font-mono text-xs">
                        <Row k="Position" v={coords(node.lat, node.lng)} />
                        <Row k="Sector" v={node.sector} />
                        <Row k="Zone" v={node.zone} />
                      </dl>
                    </Card>

                    <HealthFlags node={node} />
                  </div>
                </div>
              </TabPanel>

              {/* --- Telemetry -------------------------------------------- */}
              <TabPanel id="telemetry" active={active}>
                <TelemetrySection query={telemetryQuery} rangeHours={rangeHours} onRange={setRangeHours} />
              </TabPanel>

              {/* --- Detections -------------------------------------------- */}
              <TabPanel id="detections" active={active}>
                <Card flat padding="lg">
                  <CardHeader
                    title="Recent detections"
                    subtitle="What this node has reported, with the outcome recorded by an operator"
                    actions={
                      <Chip tone={node.falsePositiveRate > 0.2 ? 'warning' : 'neutral'}>
                        False-positive rate {(node.falsePositiveRate * 100).toFixed(0)}%
                      </Chip>
                    }
                  />
                  <AsyncBoundary
                    query={detectionsQuery}
                    skeleton={<SkeletonRows rows={5} height={92} />}
                    empty={
                      <EmptyState
                        title="No detections from this node"
                        body="It has been online but has not classified anything above threshold."
                      />
                    }
                  >
                    {() => (
                      <div className="-mx-lg">
                        {nodeDetections.slice(0, 20).map((d) => (
                          <AlertRow key={d.id} detection={d} density="compact" showActions={false} />
                        ))}
                      </div>
                    )}
                  </AsyncBoundary>
                </Card>
              </TabPanel>

              {/* --- Config -------------------------------------------------- */}
              <TabPanel id="config" active={active}>
                <ConfigTab node={node} />
              </TabPanel>

              {/* --- History ------------------------------------------------- */}
              <TabPanel id="history" active={active}>
                <HistoryTab node={node} />
              </TabPanel>
            </>
          )
        }}
      </AsyncBoundary>
    </div>
  )
}

/* ========================================================================== */

function TelemetrySection({
  query,
  rangeHours,
  onRange,
}: {
  query: ReturnType<typeof useAsyncData<TelemetryPoint[]>>
  rangeHours: number
  onRange: (h: number) => void
}) {
  const downsampled = (query.data?.length ?? 0) > 2000

  return (
    <ChartCard
      title="Telemetry"
      subtitle="Battery, solar input, signal and temperature on one shared time axis"
      rows={query.data?.length}
      note={downsampled ? 'Downsampled (LTTB) — not every sample is shown' : undefined}
      actions={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => onRange(r.hours)}
              aria-pressed={rangeHours === r.hours}
              className={cn(
                'cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors duration-base',
                rangeHours === r.hours
                  ? 'border-primary bg-[color:var(--status-watch-fill)] text-primary'
                  : 'border-border text-fg-muted hover:text-fg',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
      table={{
        headers: ['Time', 'Battery %', 'Solar W', 'RSSI dBm', 'Temp °C'],
        rows: (query.data ?? [])
          .slice(-40)
          .map((p) => [
            new Date(p.ts).toLocaleString('en-IN', { hour12: false }),
            p.battery,
            p.solarW,
            p.rssi,
            p.tempC,
          ]),
      }}
    >
      <AsyncBoundary
        query={query}
        skeleton={<SkeletonChart height={360} label="Loading telemetry" />}
        empty={
          <EmptyState
            title="No telemetry yet"
            body="This node has not checked in. First contact is expected within 15 minutes of power-on."
          />
        }
      >
        {(points) => (
          <div className="space-y-3">
            {/* syncId="telemetry" links the crosshair across every chart */}
            <TelemetryChart
              data={points as never}
              dataKey="battery"
              label="Battery"
              unit="%"
              color="var(--status-ok)"
              thresholdValue={15}
              thresholdLabel="Critical threshold"
            />
            <TelemetryChart
              data={points as never}
              dataKey="solarW"
              label="Solar input"
              unit="W"
              color="var(--color-secondary)"
            />
            <TelemetryChart
              data={points as never}
              dataKey="rssi"
              label="Signal"
              unit="dBm (negative scale)"
              color="var(--color-accent)"
            />
            <TelemetryChart
              data={points as never}
              dataKey="tempC"
              label="Enclosure temperature"
              unit="°C"
              color="var(--status-warning)"
            />
          </div>
        )}
      </AsyncBoundary>
    </ChartCard>
  )
}

function HealthFlags({ node }: { node: FieldNode }) {
  const flags = useMemo(() => {
    const out: { severity: 'critical' | 'warning' | 'info'; text: string; action: string }[] = []
    if (node.status === 'offline')
      out.push({ severity: 'critical', text: 'No heartbeat for over 3 hours', action: 'Schedule a site visit' })
    if (node.battery < 30 && node.status !== 'offline')
      out.push({
        severity: 'warning',
        text: 'Battery below 30% — inspect the solar panel for debris',
        action: 'Create work order',
      })
    if (node.rssi < -105 && node.status !== 'offline')
      out.push({ severity: 'warning', text: 'Weak uplink — check gateway line of sight', action: 'Create work order' })
    if (node.firmware !== '2.4.1')
      out.push({ severity: 'info', text: `Firmware ${node.firmware} is behind 2.4.1`, action: 'Schedule update' })
    if (node.falsePositiveRate > 0.2)
      out.push({
        severity: 'warning',
        text: `False-positive rate ${(node.falsePositiveRate * 100).toFixed(0)}% — recalibrate thresholds`,
        action: 'Open config',
      })
    return out
  }, [node])

  return (
    <Card flat padding="lg">
      <CardHeader title="Health flags" subtitle="Rule-derived, with a suggested action" />
      {flags.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-status-ok">
          <span className="h-2 w-2 rounded-full bg-status-ok" />
          No health flags
        </p>
      ) : (
        <ul className="space-y-sm">
          {flags.map((f, i) => (
            <li
              key={i}
              className={cn(
                'rounded-lg border p-2.5',
                f.severity === 'critical'
                  ? 'border-status-critical/40 bg-[color:var(--status-critical-fill)]'
                  : f.severity === 'warning'
                    ? 'border-status-warning/40 bg-[color:var(--status-warning-fill)]'
                    : 'border-border bg-surface-1',
              )}
            >
              <p className="text-xs text-fg-secondary">{f.text}</p>
              <div className="mt-1.5 flex items-center gap-sm">
                <Button size="sm" variant="ghost">
                  {f.action}
                </Button>
                <button type="button" className="cursor-pointer text-[11px] text-fg-muted hover:text-fg">
                  Snooze 7d
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ConfigTab({ node }: { node: FieldNode }) {
  const [dirty, setDirty] = useState(false)
  const [pending] = useState<string[]>(['detectionThreshold'])

  return (
    <div className="relative">
      <Card flat padding="lg">
        <CardHeader
          title="Configuration"
          subtitle="Changes are queued and applied at the node's next check-in — not instantly"
        />

        <div className="space-y-lg">
          <Field
            label="Sample rate"
            help="Higher rates catch shorter events but drain the battery faster."
            pending={pending.includes('sampleRate')}
          >
            <select className="input cursor-pointer" onChange={() => setDirty(true)} defaultValue="16000">
              <option value="8000">8 kHz</option>
              <option value="16000">16 kHz</option>
              <option value="22050">22.05 kHz</option>
            </select>
          </Field>

          <Field
            label="Detection threshold"
            help="Lower = more detections, more false positives."
            pending={pending.includes('detectionThreshold')}
          >
            <input
              type="number"
              defaultValue={75}
              min={0}
              max={100}
              onChange={() => setDirty(true)}
              className="input"
            />
          </Field>

          <Field label="Transmit interval" help="How often the node uplinks a heartbeat.">
            <select className="input cursor-pointer" onChange={() => setDirty(true)} defaultValue={node.wakeIntervalMins}>
              {[5, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Field>

          <Field label="Deep sleep window" help="Longer sleep saves power but delays detection.">
            <select className="input cursor-pointer" onChange={() => setDirty(true)} defaultValue={node.deepSleepMins}>
              {[3, 5, 10, 15].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Field>

          <Field label="Firmware channel" help="Stable is recommended for field nodes.">
            <select className="input cursor-pointer" onChange={() => setDirty(true)} defaultValue="stable">
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </Field>
        </div>
      </Card>

      {dirty && (
        <div className="sticky bottom-md mt-md flex items-center gap-md rounded-xl border border-border bg-surface-4 px-md py-3 shadow-xl">
          <span className="text-sm text-fg-secondary">Unsaved changes</span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setDirty(false)}>
            Discard
          </Button>
          <Button size="sm" variant="primary" icon={<Save size={13} {...iconProps} />} onClick={() => setDirty(false)}>
            Save — applies at next check-in
          </Button>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  help,
  pending,
  children,
}: {
  label: string
  help: string
  pending?: boolean
  children: React.ReactNode
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="grid gap-2 lg:grid-cols-[1fr_260px] lg:items-start">
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-fg">
          {label}
        </label>
        <p id={`${id}-help`} className="mt-0.5 text-xs text-fg-muted">
          {help}
          {/* Pending state is in the accessible description, not visual-only */}
          {pending && (
            <span className="ml-1 text-status-warning">
              Pending — applies at next check-in (~4m).
            </span>
          )}
        </p>
      </div>
      <div>{children}</div>
    </div>
  )
}

function HistoryTab({ node }: { node: FieldNode }) {
  const entries = [
    { ts: Date.now() - 3600_000 * 5, actor: 'D. Raman', action: 'Firmware updated', detail: '2.4.0 → 2.4.1' },
    { ts: Date.now() - 3600_000 * 74, actor: 'System', action: 'Restarted', detail: 'watchdog timeout' },
    { ts: Date.now() - 3600_000 * 190, actor: 'M. Lakshmi', action: 'Threshold changed', detail: '80% → 75%' },
    { ts: Date.now() - 3600_000 * 410, actor: 'D. Raman', action: 'Maintenance visit', detail: 'panel cleaned, battery replaced' },
    { ts: node.installedAt, actor: 'A. Perumal', action: 'Provisioned', detail: `${node.sector} · ${node.zone}` },
  ]
  return (
    <Card flat padding="lg">
      <CardHeader title="History" subtitle="Append-only. Every entry is attributed to a person or to the system." />
      <ol className="space-y-3">
        {entries.map((e, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-2 border-b border-border pb-3 last:border-0">
            <time
              dateTime={new Date(e.ts).toISOString()}
              className="font-mono text-xs tabular-nums text-fg-muted"
            >
              {absoluteDateTime(e.ts)}
            </time>
            <span className="text-sm font-medium text-fg">{e.action}</span>
            <span className="text-xs text-fg-secondary">{e.detail}</span>
            <span className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
              {e.actor}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{k}</dt>
      <dd className="text-right text-fg-secondary">{v}</dd>
    </div>
  )
}
