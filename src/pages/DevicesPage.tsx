/**
 * Device fleet — spec: design-system/wildguardx/pages/devices.md
 *
 * Notable spec rules honoured here:
 *  - Offline rows show `——`, never a stale last-known battery reading.
 *  - The summary tiles are real filter controls with aria-pressed, unlike the
 *    dashboard's deliberately static KPI tiles.
 *  - Below `md` the table becomes CARDS with full action parity, not a
 *    horizontally-scrolling table nobody can use.
 */

import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Plus, Route, Wrench } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { FieldNode, NodeStatus } from '@/data/types'
import { AsyncBoundary, EmptyState, SkeletonRows, SkeletonTiles } from '@/components/ui/states'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip, NodeStatusChip, NodeStatusDot } from '@/components/ui/Chip'
import { BatteryCell, SignalCell } from '@/components/domain/ConfidenceBar'
import { MetricTile } from '@/components/domain/MetricTile'
import { TierBadge } from '@/components/domain/SpeciesThumb'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { NODE_TYPE_ICONS, iconProps } from '@/components/domain/icons'
import { relativeAge } from '@/lib/format'
import { useMediaQuery } from '@/lib/hooks'

export function DevicesPage() {
  const { provider } = useData()
  const [params, setParams] = useSearchParams()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const status = params.get('status') ?? ''
  const type = params.get('type') ?? ''
  const tier = params.get('tier') ?? ''
  const search = params.get('q') ?? ''
  const lowBattery = params.get('lowBattery') === '1'

  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [runOpen, setRunOpen] = useState(false)
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [pingResult, setPingResult] = useState<Record<string, string>>({})

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const query = useAsyncData(
    () =>
      provider.getDevices({
        limit: 400,
        status: status ? [status] : undefined,
        type: type ? [type] : undefined,
        tier: tier ? [tier] : undefined,
        search: search || undefined,
      }),
    [provider, status, type, tier, search],
    {
      isEmpty: (p) => p.items.length === 0,
      emptyValue: { items: [] as FieldNode[], total: 0, nextCursor: null },
      partialSources: ['telemetry feed'],
    },
  )

  const summaryQuery = useAsyncData(() => provider.getFleetSummary(), [provider], {
    partialSources: ['fleet health feed'],
  })

  const rows = useMemo(() => {
    const items = query.data?.items ?? []
    return lowBattery ? items.filter((n) => n.status !== 'offline' && n.battery < 30) : items
  }, [query.data, lowBattery])

  const ping = async (n: FieldNode) => {
    setPingResult((r) => ({ ...r, [n.id]: 'pinging' }))
    const res = await provider.pingDevice(n.id)
    setPingResult((r) => ({
      ...r,
      [n.id]: res.ok ? `Responded ${res.latencyMs}ms` : 'No response',
    }))
  }

  const columns: Column<FieldNode>[] = [
    {
      key: 'id',
      header: 'ID',
      sortValue: (n) => n.id,
      sticky: true,
      render: (n) => (
        <span className="flex items-center gap-2">
          <NodeStatusDot status={n.status} />
          <Link to={`/app/devices/${n.id}`} className="font-mono text-xs text-fg hover:underline">
            {n.id}
          </Link>
        </span>
      ),
    },
    {
      key: 'label',
      header: 'Label',
      sortValue: (n) => n.label,
      render: (n) => <span className="text-sm text-fg-secondary">{n.label}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (n) => n.type,
      render: (n) => {
        const Icon = NODE_TYPE_ICONS[n.type]
        return (
          <span className="inline-flex items-center gap-1.5 text-xs capitalize">
            <Icon size={14} className="text-fg-muted" {...iconProps} />
            {n.type}
          </span>
        )
      },
    },
    {
      key: 'tier',
      header: 'Zone',
      sortValue: (n) => n.tier,
      render: (n) => <TierBadge tier={n.tier} />,
    },
    { key: 'status', header: 'Status', sortValue: (n) => n.status, render: (n) => <NodeStatusChip status={n.status} /> },
    {
      key: 'battery',
      header: 'Battery',
      sortValue: (n) => (n.status === 'offline' ? -1 : n.battery),
      render: (n) => (
        <BatteryCell percent={n.battery} charging={n.charging} offline={n.status === 'offline'} />
      ),
    },
    {
      key: 'signal',
      header: 'Signal',
      sortValue: (n) => (n.status === 'offline' ? -999 : n.rssi),
      render: (n) => <SignalCell rssi={n.rssi} offline={n.status === 'offline'} />,
    },
    {
      key: 'lastSeen',
      header: 'Last seen',
      sortValue: (n) => n.lastSeen,
      render: (n) => {
        const mins = (Date.now() - n.lastSeen) / 60000
        return (
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              mins > 360 ? 'text-status-critical' : mins > 60 ? 'text-status-warning' : 'text-fg-secondary',
            )}
          >
            {relativeAge(n.lastSeen)} ago
          </span>
        )
      },
    },
    {
      key: 'sector',
      header: 'Sector',
      sortValue: (n) => n.sector,
      render: (n) => <span className="font-mono text-xs">{n.sector}</span>,
    },
    {
      key: 'firmware',
      header: 'FW',
      sortValue: (n) => n.firmware,
      render: (n) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          {n.firmware}
          {n.firmware !== '2.4.1' && (
            <span className="text-status-warning" title="Out of date">
              ↑
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'uptime',
      header: 'Uptime 30d',
      sortValue: (n) => n.uptime30d,
      align: 'right',
      render: (n) => <span className="font-mono text-xs tabular-nums">{n.uptime30d.toFixed(1)}%</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (n) => (
        <div className="flex items-center justify-end gap-1.5">
          {pingResult[n.id] && (
            <span
              className={cn(
                'font-mono text-[10px]',
                pingResult[n.id] === 'No response' ? 'text-status-critical' : 'text-status-ok',
              )}
            >
              {pingResult[n.id] === 'pinging' ? '…' : pingResult[n.id]}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={n.status === 'offline'}
            disabledReason={`Device offline — last seen ${relativeAge(n.lastSeen)} ago`}
            onClick={(e) => {
              e.stopPropagation()
              void ping(n)
            }}
            aria-label={`Ping ${n.id}`}
          >
            Ping
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Devices"
        count={query.state === 'loading' ? undefined : rows.length}
        description="ESP32 field nodes across the Tier-1 forest core and the Tier-2 village perimeter."
        actions={
          <>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
              aria-pressed={density === 'compact'}
            >
              {density === 'compact' ? 'Comfortable' : 'Compact'}
            </Button>
            <Button size="sm" variant="subtle" icon={<Download size={14} {...iconProps} />}>
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={14} {...iconProps} />}
              onClick={() => setProvisionOpen(true)}
            >
              Provision device
            </Button>
          </>
        }
      />

      {/* --- Interactive summary tiles (real filter controls) -------------- */}
      <AsyncBoundary
        query={summaryQuery}
        className="mb-md"
        skeleton={<SkeletonTiles count={4} height={92} />}
        empty={<EmptyState title="No fleet data" body="No nodes are reporting." />}
      >
        {(s) => (
          <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
            <MetricTile
              label="Online"
              value={s.online}
              tone="ok"
              sub={`${s.tier1} core · ${s.tier2} perimeter`}
              pressed={status === 'online'}
              onClick={() => setParam('status', status === 'online' ? null : 'online')}
            />
            <MetricTile
              label="Degraded"
              value={s.degraded}
              tone="warning"
              sub="weak uplink or low power"
              pressed={status === 'degraded'}
              onClick={() => setParam('status', status === 'degraded' ? null : 'degraded')}
            />
            <MetricTile
              label="Offline"
              value={s.offline}
              tone="critical"
              sub="no heartbeat"
              pressed={status === 'offline'}
              onClick={() => setParam('status', status === 'offline' ? null : 'offline')}
            />
            <MetricTile
              label="Low battery"
              value={s.lowBattery}
              tone="warning"
              sub="below 30%"
              pressed={lowBattery}
              onClick={() => setParam('lowBattery', lowBattery ? null : '1')}
            />
          </div>
        )}
      </AsyncBoundary>

      {/* --- Filters -------------------------------------------------------- */}
      <div className="mb-md flex flex-wrap items-end gap-md rounded-xl border border-border bg-surface-2 p-md">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-xs text-fg-muted">Search</span>
          <input
            value={search}
            onChange={(e) => setParam('q', e.target.value || null)}
            placeholder="Node ID, label, or sector"
            className="input h-10 py-0 text-sm"
          />
        </label>
        <Select label="Type" value={type} onChange={(v) => setParam('type', v)} options={['camera', 'acoustic', 'thermal', 'gateway']} />
        <Select label="Status" value={status} onChange={(v) => setParam('status', v)} options={['online', 'degraded', 'offline']} />
        <Select
          label="Zone"
          value={tier}
          onChange={(v) => setParam('tier', v)}
          options={['T1', 'T2']}
          format={(v) => (v === 'T1' ? 'Forest core' : 'Village perimeter')}
        />
        {(status || type || tier || search || lowBattery) && (
          <Button size="sm" variant="ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear all
          </Button>
        )}
      </div>

      {/* --- Table (md+) / cards (sm) --------------------------------------- */}
      <AsyncBoundary
        query={query}
        skeleton={<SkeletonRows rows={10} height={48} />}
        empty={
          <div className="rounded-xl border border-border bg-surface-2">
            {status || type || tier || search || lowBattery ? (
              <EmptyState
                title="No devices match"
                body="No nodes satisfy the current filters."
                action={
                  <Button variant="primary" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No devices provisioned"
                body="Add your first ESP32 node to start monitoring the reserve."
                action={
                  <Button variant="primary" size="sm" onClick={() => setProvisionOpen(true)}>
                    Provision your first node
                  </Button>
                }
              />
            )}
          </div>
        }
      >
        {() =>
          isDesktop ? (
            <DataTable
              caption="All field nodes with status, power, signal and firmware"
              columns={columns}
              rows={rows}
              rowKey={(n) => n.id}
              density={density}
              selectedKeys={selected}
              onToggleSelect={(key) =>
                setSelected((s) => {
                  const next = new Set(s)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              }
            />
          ) : (
            <DeviceCards nodes={rows} onPing={ping} pingResult={pingResult} />
          )
        }
      </AsyncBoundary>

      {/* --- Bulk action bar ------------------------------------------------ */}
      {selected.size > 0 && (
        <div className="sticky bottom-md z-20 mt-md flex flex-wrap items-center gap-md rounded-xl border border-border bg-surface-4 px-md py-3 shadow-xl">
          <span className="text-sm font-medium text-fg">
            {selected.size} selected
            <button
              type="button"
              onClick={() => setSelected(new Set(rows.map((n) => n.id)))}
              className="ml-2 cursor-pointer text-xs font-normal text-accent-text hover:underline"
            >
              Select all {rows.length} matching filters
            </button>
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="subtle">
            Ping
          </Button>
          <Button size="sm" variant="subtle" icon={<Wrench size={13} {...iconProps} />}>
            Update firmware
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Route size={13} {...iconProps} />}
            onClick={() => setRunOpen(true)}
          >
            Add to maintenance run
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <MaintenanceRunModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        nodes={rows.filter((n) => selected.has(n.id))}
      />
      <ProvisionModal open={provisionOpen} onClose={() => setProvisionOpen(false)} />
    </div>
  )
}

/* ========================================================================== */

function Select({
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
    <label className="w-[160px]">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="input h-10 cursor-pointer py-0 text-sm capitalize"
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

/** Mobile card view — identical action set to the table (devices.md §7). */
function DeviceCards({
  nodes,
  onPing,
  pingResult,
}: {
  nodes: FieldNode[]
  onPing: (n: FieldNode) => void
  pingResult: Record<string, string>
}) {
  return (
    <ul className="space-y-sm">
      {nodes.slice(0, 60).map((n) => {
        const Icon = NODE_TYPE_ICONS[n.type]
        return (
          <li key={n.id}>
            <Card flat padding="md">
              <div className="flex items-start gap-2.5">
                <NodeStatusDot status={n.status} />
                <div className="min-w-0 flex-1">
                  <Link to={`/app/devices/${n.id}`} className="font-mono text-sm text-fg hover:underline">
                    {n.id}
                  </Link>
                  <div className="truncate text-xs text-fg-muted">{n.label}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <NodeStatusChip status={n.status} />
                  <TierBadge tier={n.tier} compact />
                </div>
              </div>
              <div className="mt-sm flex flex-wrap items-center gap-md">
                <BatteryCell percent={n.battery} charging={n.charging} offline={n.status === 'offline'} />
                <SignalCell rssi={n.rssi} offline={n.status === 'offline'} />
                <span className="font-mono text-xs text-fg-muted">{n.sector}</span>
                <span className="font-mono text-xs text-fg-muted">{relativeAge(n.lastSeen)} ago</span>
              </div>
              <div className="mt-sm flex items-center gap-sm">
                <Button
                  size="sm"
                  variant="subtle"
                  disabled={n.status === 'offline'}
                  disabledReason="Device offline"
                  onClick={() => onPing(n)}
                >
                  Ping
                </Button>
                <Link to={`/app/devices/${n.id}`} className="flex-1">
                  <Button size="sm" variant="ghost" className="w-full">
                    Open
                  </Button>
                </Link>
                {pingResult[n.id] && (
                  <span className="font-mono text-[10px] text-fg-muted">{pingResult[n.id]}</span>
                )}
              </div>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

/** The page's real payoff: a route-ordered work list for a field technician. */
function MaintenanceRunModal({
  open,
  onClose,
  nodes,
}: {
  open: boolean
  onClose: () => void
  nodes: FieldNode[]
}) {
  // Nearest-neighbour ordering from the patrol post.
  const ordered = useMemo(() => {
    const remaining = [...nodes]
    const out: FieldNode[] = []
    let cur = { lat: 11.4102, lng: 76.695 }
    while (remaining.length) {
      let best = 0
      let bestD = Infinity
      remaining.forEach((n, i) => {
        const d = (n.lat - cur.lat) ** 2 + (n.lng - cur.lng) ** 2
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      const next = remaining.splice(best, 1)[0]
      out.push(next)
      cur = { lat: next.lat, lng: next.lng }
    }
    return out
  }, [nodes])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Maintenance run"
      description={`${ordered.length} nodes, ordered nearest-neighbour from the patrol post. Estimated trip ${Math.round(ordered.length * 24)} min.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="subtle">Export GPX</Button>
          <Button variant="primary">Export PDF work list</Button>
        </>
      }
    >
      <ol className="space-y-1.5">
        {ordered.map((n, i) => (
          <li key={n.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 p-2.5">
            <span className="w-6 font-mono text-xs tabular-nums text-fg-muted">{i + 1}</span>
            <span className="font-mono text-xs text-fg">{n.id}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{n.label}</span>
            <NodeStatusChip status={n.status} />
            <span className="font-mono text-xs tabular-nums text-fg-muted">{n.battery}%</span>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

function ProvisionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [serial, setSerial] = useState('')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Provision device"
      description={`Step ${step} of 3`}
      size="md"
      footer={
        <>
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button variant="primary" disabled={step === 1 && serial.length < 4} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <>
              {/* An escape so a technician isn't blocked in the field by a node
                  that hasn't woken from deep sleep yet (devices.md §3.7). */}
              <Button variant="subtle" onClick={onClose}>
                Skip — pair later
              </Button>
              <Button variant="primary" onClick={onClose}>
                Finish
              </Button>
            </>
          )}
        </>
      }
    >
      {step === 1 && (
        <div>
          <label htmlFor="serial" className="block text-sm font-medium text-fg-secondary">
            Device serial
          </label>
          <input
            id="serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value.toUpperCase())}
            placeholder="ESP32-XXXXXXXX"
            className="input mt-1.5 font-mono"
          />
          <p className="mt-1.5 text-xs text-fg-muted">
            Printed on the enclosure label, or scan the QR code on the node.
          </p>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-md">
          <div>
            <label htmlFor="label" className="block text-sm font-medium text-fg-secondary">
              Label
            </label>
            <input id="label" className="input mt-1.5" placeholder="North ridge acoustic" />
          </div>
          <div className="grid grid-cols-2 gap-md">
            <div>
              <label htmlFor="sector" className="block text-sm font-medium text-fg-secondary">
                Sector
              </label>
              <select id="sector" className="input mt-1.5 cursor-pointer">
                {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="zone" className="block text-sm font-medium text-fg-secondary">
                Zone
              </label>
              <select id="zone" className="input mt-1.5 cursor-pointer">
                <option value="T1">Tier-1 forest core</option>
                <option value="T2">Tier-2 village perimeter</option>
              </select>
            </div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <p className="text-sm text-fg-secondary">
            Enter this pairing code on the device, or wait for its first check-in.
          </p>
          <div className="mt-md rounded-lg border border-border bg-surface-2 p-lg text-center">
            <span className="font-mono text-2xl tracking-[0.3em] text-fg">7K4M-9QX2</span>
          </div>
          <p className="mt-md text-xs text-fg-muted">
            Waiting for first heartbeat… nodes in deep sleep can take up to{' '}
            <span className="font-mono">15 minutes</span> to report.
          </p>
        </div>
      )}
    </Modal>
  )
}
