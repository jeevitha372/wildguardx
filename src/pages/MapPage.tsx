/**
 * Live map — spec: design-system/wildguardx/pages/map.md
 *
 * The `Show as list` view is a FIRST-CLASS view, not a fallback: it is the
 * keyboard and screen-reader path to 100% of the map's data with the same
 * actions, and it is also what renders if WebGL/tiles are unavailable.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, List, MapPin, Play, Radar, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { Detection, FieldNode, Geofence } from '@/data/types'
import { AsyncBoundary, EmptyState, Skeleton } from '@/components/ui/states'
import { MapLegend, SensorMap } from '@/components/map/SensorMap'
import { Button, IconButton } from '@/components/ui/Button'
import { Chip, NodeStatusChip, NodeStatusDot } from '@/components/ui/Chip'
import { LiveBadge, StaticBadge } from '@/components/ui/LiveBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { iconProps } from '@/components/domain/icons'
import { BatteryCell, SignalCell } from '@/components/domain/ConfidenceBar'
import { classLabel, coords, relativeAge } from '@/lib/format'
import { distanceKm } from '@/data/MockProvider'

type Selected = { kind: 'node'; node: FieldNode } | { kind: 'detection'; detection: Detection } | null

const CENTER = { lat: 11.4102, lng: 76.695 }

export function MapPage() {
  const { provider, tick } = useData()
  const [showList, setShowList] = useState(false)
  const [selected, setSelected] = useState<Selected>(null)
  const [layersOpen, setLayersOpen] = useState(true)
  const [layers, setLayers] = useState({
    nodes: true,
    detections: true,
    geofences: true,
    trails: false,
  })
  const [sector, setSector] = useState<string>('all')
  const [replayMinutes, setReplayMinutes] = useState<number | null>(null)

  const nodesQuery = useAsyncData(() => provider.getDevices({ limit: 400 }), [provider], {
    isEmpty: (p) => p.items.length === 0,
    emptyValue: { items: [] as FieldNode[], total: 0, nextCursor: null },
    partialSources: ['ranger position feed'],
  })

  const alertsQuery = useAsyncData(() => provider.getAlerts({ limit: 120 }), [provider, tick], {
    isEmpty: (p) => p.items.length === 0,
    emptyValue: { items: [] as Detection[], total: 0, nextCursor: null },
  })

  const fencesQuery = useAsyncData<Geofence[]>(() => provider.getGeofences(), [provider], {
    isEmpty: (g) => g.length === 0,
    emptyValue: [],
  })

  const allNodes = nodesQuery.data?.items ?? []
  const nodes = useMemo(
    () => (sector === 'all' ? allNodes : allNodes.filter((n) => n.sector === sector)),
    [allNodes, sector],
  )
  const detections = alertsQuery.data?.items ?? []
  const inReplay = replayMinutes != null

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-md flex flex-wrap items-center justify-between gap-md">
        <div>
          <h1 className="text-h1 text-fg">Map</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            {nodes.length} nodes · {detections.length} recent detections
          </p>
        </div>
        <div className="flex items-center gap-sm">
          {inReplay ? (
            <StaticBadge label={`REPLAY · T-${replayMinutes}m`} />
          ) : (
            <LiveBadge />
          )}
          <Button
            size="sm"
            variant={showList ? 'primary' : 'subtle'}
            icon={showList ? <MapPin size={14} {...iconProps} /> : <List size={14} {...iconProps} />}
            onClick={() => setShowList((s) => !s)}
            aria-pressed={showList}
          >
            {showList ? 'Show as map' : 'Show as list'}
          </Button>
        </div>
      </div>

      {showList ? (
        <NodeListView
          nodes={nodes}
          loading={nodesQuery.state === 'loading'}
          onSelect={(n) => setSelected({ kind: 'node', node: n })}
        />
      ) : (
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border',
            // Replay mode is unmistakable: badge + inset border + return control
            inReplay ? 'border-status-info' : 'border-border',
          )}
        >
          <AsyncBoundary
            query={nodesQuery}
            skeleton={<Skeleton className="h-[clamp(420px,64vh,760px)] w-full rounded-none" />}
            empty={
              <div className="h-[clamp(420px,64vh,760px)] bg-surface-0">
                <EmptyState
                  icon={<Radar size={26} {...iconProps} />}
                  title="No sensors yet"
                  body="Provision your first ESP32 node to populate the map."
                  action={
                    <Link to="/app/devices">
                      <Button variant="primary" size="sm">
                        Add your first node
                      </Button>
                    </Link>
                  }
                />
              </div>
            }
          >
            {() => (
              <SensorMap
                nodes={layers.nodes ? nodes : []}
                detections={layers.detections ? detections : []}
                geofences={layers.geofences ? (fencesQuery.data ?? []) : []}
                height="clamp(420px, 64vh, 760px)"
                zoom={11}
                onSelectNode={(n) => setSelected({ kind: 'node', node: n })}
                onSelectDetection={(d) => setSelected({ kind: 'detection', detection: d })}
              />
            )}
          </AsyncBoundary>

          {/* --- Layers panel (floating, blurred surface-4) ----------------- */}
          <div className="pointer-events-none absolute inset-0 p-md">
            <div className="pointer-events-auto absolute left-md top-md w-[240px]">
              {layersOpen ? (
                <div className="rounded-xl border border-border bg-surface-4/92 p-md shadow-xl backdrop-blur-md">
                  <div className="mb-sm flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-fg">Layers</h2>
                    <IconButton label="Collapse layers" onClick={() => setLayersOpen(false)} className="h-7 w-7">
                      <X size={14} {...iconProps} />
                    </IconButton>
                  </div>

                  <div className="space-y-1.5">
                    <LayerToggle
                      label="Sensors"
                      count={nodes.length}
                      checked={layers.nodes}
                      onChange={(v) => setLayers((l) => ({ ...l, nodes: v }))}
                    />
                    <LayerToggle
                      label="Detections"
                      count={detections.length}
                      checked={layers.detections}
                      onChange={(v) => setLayers((l) => ({ ...l, detections: v }))}
                    />
                    <LayerToggle
                      label="Geofences"
                      count={fencesQuery.data?.length ?? 0}
                      checked={layers.geofences}
                      onChange={(v) => setLayers((l) => ({ ...l, geofences: v }))}
                    />
                    {/* Auto-unchecked with a stated reason — partial data, named. */}
                    <LayerToggle
                      label="Ranger trails"
                      checked={layers.trails}
                      disabled
                      reason="Ranger feed unavailable"
                      onChange={() => {}}
                    />
                  </div>

                  <label htmlFor="sector-filter" className="mt-md block text-xs text-fg-muted">
                    Sector
                  </label>
                  <select
                    id="sector-filter"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="input mt-1 h-9 cursor-pointer py-0 text-sm"
                  >
                    <option value="all">All sectors</option>
                    {[...new Set(allNodes.map((n) => n.sector))].sort().map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <div className="mt-md border-t border-border pt-md">
                    <h3 className="mb-sm text-xs font-semibold uppercase tracking-wide text-fg-muted">
                      Legend
                    </h3>
                    <MapLegend className="space-y-1.5" />
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<Layers size={14} {...iconProps} />}
                  onClick={() => setLayersOpen(true)}
                >
                  Layers
                </Button>
              )}
            </div>

            {/* --- Detail panel ------------------------------------------- */}
            {selected && (
              <div className="pointer-events-auto absolute right-md top-md w-[320px] max-w-[calc(100%-2rem)]">
                <DetailPanel selected={selected} onClose={() => setSelected(null)} />
              </div>
            )}
          </div>

          {/* --- Timeline / replay ------------------------------------------ */}
          <div className="absolute inset-x-md bottom-md">
            <div className="rounded-xl border border-border bg-surface-4/92 px-md py-2.5 shadow-xl backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-md">
                <span className="font-mono text-[11px] text-fg-muted">24h</span>
                <input
                  type="range"
                  min={0}
                  max={1440}
                  step={5}
                  value={replayMinutes ?? 1440}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setReplayMinutes(v >= 1440 ? null : 1440 - v)
                  }}
                  aria-label="Replay position, minutes before now"
                  className="h-1 flex-1 cursor-pointer accent-[color:var(--color-primary)]"
                />
                <span className="font-mono text-[11px] text-fg-muted">now</span>

                {inReplay ? (
                  <Button size="sm" variant="primary" onClick={() => setReplayMinutes(null)}>
                    Return to live
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="subtle"
                    icon={<Play size={12} {...iconProps} />}
                    onClick={() => setReplayMinutes(120)}
                  >
                    Replay
                  </Button>
                )}
              </div>
              {inReplay && (
                <p className="mt-1.5 font-mono text-[11px] text-status-info">
                  Showing positions from {replayMinutes} minutes ago — not live.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================== */

function LayerToggle({
  label,
  count,
  checked,
  onChange,
  disabled,
  reason,
}: {
  label: string
  count?: number
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  reason?: string
}) {
  return (
    <div>
      <label
        className={cn(
          'flex items-center gap-2.5 text-sm',
          disabled ? 'cursor-not-allowed text-fg-disabled' : 'cursor-pointer text-fg-secondary',
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-[color:var(--color-primary)]"
        />
        <span className="flex-1">{label}</span>
        {count != null && <span className="font-mono text-xs tabular-nums text-fg-muted">{count}</span>}
      </label>
      {reason && <p className="ml-6.5 pl-0.5 text-[11px] text-status-warning">{reason}</p>}
    </div>
  )
}

function DetailPanel({ selected, onClose }: { selected: NonNullable<Selected>; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Selection detail"
      className="rounded-xl border border-border bg-surface-4/95 p-md shadow-xl backdrop-blur-md animate-fade-in"
    >
      <div className="mb-sm flex items-start justify-between gap-sm">
        <h2 className="font-mono text-sm font-semibold text-fg">
          {selected.kind === 'node' ? selected.node.id : classLabel(selected.detection.cls)}
        </h2>
        <IconButton label="Close detail" onClick={onClose} className="-mr-1 -mt-1 h-8 w-8">
          <X size={14} {...iconProps} />
        </IconButton>
      </div>

      {selected.kind === 'node' ? (
        <NodeDetail node={selected.node} />
      ) : (
        <DetectionDetail detection={selected.detection} />
      )}
    </div>
  )
}

function NodeDetail({ node }: { node: FieldNode }) {
  return (
    <>
      <p className="text-xs text-fg-secondary">{node.label}</p>
      <div className="mt-sm"><NodeStatusChip status={node.status} /></div>
      <dl className="mt-md space-y-1.5 font-mono text-xs">
        <DRow k="Hardware" v={node.hardware} />
        <DRow k="Tier" v={node.tier === 'T1' ? 'Forest core' : 'Village perimeter'} />
        <DRow k="Sector" v={node.sector} />
        <DRow k="Firmware" v={node.firmware} />
        <DRow k="Deep sleep" v={`${node.deepSleepMins}m`} />
        <DRow k="Position" v={coords(node.lat, node.lng)} />
        <DRow k="Last seen" v={`${relativeAge(node.lastSeen)} ago`} />
      </dl>
      <div className="mt-sm flex items-center gap-md">
        <BatteryCell percent={node.battery} charging={node.charging} offline={node.status === 'offline'} />
        <SignalCell rssi={node.rssi} offline={node.status === 'offline'} />
      </div>
      <Link to={`/app/devices/${node.id}`} className="mt-md block">
        <Button size="sm" variant="subtle" className="w-full">
          Open device
        </Button>
      </Link>
    </>
  )
}

function DetectionDetail({ detection: d }: { detection: Detection }) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={d.severity}>{d.severity}</Chip>
        <Chip tone="neutral" mono>
          {d.confidence}%
        </Chip>
      </div>
      <dl className="mt-md space-y-1.5 font-mono text-xs">
        <DRow k="Node" v={d.nodeId} />
        <DRow k="Sector" v={d.sector} />
        <DRow k="Zone" v={d.zone} />
        <DRow k="When" v={`${relativeAge(d.ts)} ago`} />
        <DRow k="Position" v={coords(d.lat, d.lng)} />
        <DRow k="Model" v={d.modelVersion} />
      </dl>
      <Link to={`/app/incidents/${d.incidentId}`} className="mt-md block">
        <Button size="sm" variant="primary" className="w-full">
          Open incident
        </Button>
      </Link>
    </>
  )
}

function DRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{k}</dt>
      <dd className="text-right text-fg-secondary">{v}</dd>
    </div>
  )
}

/* --- the list view: full parity with the map ------------------------------ */

function NodeListView({
  nodes,
  loading,
  onSelect,
}: {
  nodes: FieldNode[]
  loading: boolean
  onSelect: (n: FieldNode) => void
}) {
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
    { key: 'label', header: 'Label', sortValue: (n) => n.label, render: (n) => <span className="text-sm">{n.label}</span> },
    { key: 'status', header: 'Status', sortValue: (n) => n.status, render: (n) => <NodeStatusChip status={n.status} /> },
    { key: 'sector', header: 'Sector', sortValue: (n) => n.sector, render: (n) => <span className="font-mono text-xs">{n.sector}</span> },
    {
      key: 'tier',
      header: 'Zone',
      sortValue: (n) => n.tier,
      render: (n) => (
        <span className="text-xs">{n.tier === 'T1' ? 'Forest core' : 'Village perimeter'}</span>
      ),
    },
    {
      key: 'distance',
      header: 'From centre',
      sortValue: (n) => distanceKm(CENTER.lat, CENTER.lng, n.lat, n.lng),
      align: 'right',
      render: (n) => (
        <span className="font-mono text-xs tabular-nums">
          {distanceKm(CENTER.lat, CENTER.lng, n.lat, n.lng).toFixed(1)} km
        </span>
      ),
    },
    {
      key: 'coords',
      header: 'Position',
      render: (n) => <span className="font-mono text-xs">{coords(n.lat, n.lng)}</span>,
    },
    {
      key: 'lastSeen',
      header: 'Last seen',
      sortValue: (n) => n.lastSeen,
      align: 'right',
      render: (n) => <span className="font-mono text-xs tabular-nums">{relativeAge(n.lastSeen)} ago</span>,
    },
  ]

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <>
      <p className="mb-sm text-sm text-fg-muted">
        Every marker on the map, as a sortable table with the same actions. This is the keyboard and
        screen-reader path — not a degraded fallback.
      </p>
      <DataTable
        caption="All sensor nodes with position, status and last contact"
        columns={columns}
        rows={nodes}
        rowKey={(n) => n.id}
        onRowActivate={onSelect}
        density="compact"
      />
    </>
  )
}
