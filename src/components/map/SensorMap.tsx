/**
 * SensorMap — spec: design-system/wildguardx/pages/map.md
 *
 * The map is the QUIETEST layer on the page: a desaturated basemap whose
 * luminance never competes with the data, so all saturation belongs to the
 * markers. The basemap follows the active theme (CARTO dark_all / light_all).
 *
 * Markers are vector CircleMarkers rather than image icons, so they keep
 * rendering when the basemap fails (map.md §6) and need no asset pipeline.
 * Leaflet paints to canvas and cannot consume `var(--x)`, so marker colours are
 * SAMPLED from the resolved custom properties and re-sampled whenever the theme
 * changes — otherwise the markers would stay dark-tuned on a light basemap.
 *
 * Every marker is distinguishable by SHAPE as well as colour — online is a
 * filled disc, degraded gains a ring, offline is a dashed hollow ring — so the
 * map survives a grayscale check.
 */

import { useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, Tooltip } from 'react-leaflet'
import type { Detection, FieldNode, Geofence, NodeStatus } from '@/data/types'
import { cn } from '@/lib/cn'
import { cssVar, useTheme } from '@/lib/useTheme'
import { classLabel, coords, relativeAge } from '@/lib/format'

const CENTER: [number, number] = [11.4102, 76.695]

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}

interface MarkerPalette {
  status: Record<
    NodeStatus,
    {
      color: string
      fillColor: string
      fillOpacity: number
      weight: number
      dashArray?: string
    }
  >
  severity: Record<string, string>
  fence: Record<Geofence['color'], string>
}

/**
 * Sample the theme's resolved colours. Keyed on `theme` by the caller so this
 * re-runs on every theme change.
 */
function readPalette(): MarkerPalette {
  const ok = cssVar('--status-ok-vivid', '#10B981')
  const warning = cssVar('--status-warning-vivid', '#F59E0B')
  const offline = cssVar('--status-offline-vivid', '#64748B')
  const critical = cssVar('--status-critical-vivid', '#DC2626')
  const watch = cssVar('--status-watch-vivid', '#D97706')
  const info = cssVar('--status-info-vivid', '#6366F1')
  const ring = cssVar('--map-marker-ring', '#0B1120')

  return {
    status: {
      online: { color: ring, fillColor: ok, fillOpacity: 1, weight: 2 },
      degraded: { color: warning, fillColor: warning, fillOpacity: 0.85, weight: 3 },
      offline: {
        color: offline,
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 2,
        dashArray: '3 3',
      },
    },
    severity: { critical, warning, watch, info },
    fence: { ok, warning, info, critical },
  }
}

interface SensorMapProps {
  nodes: FieldNode[]
  detections?: Detection[]
  geofences?: Geofence[]
  height?: number | string
  zoom?: number
  showGeofences?: boolean
  showNodes?: boolean
  showDetections?: boolean
  onSelectNode?: (n: FieldNode) => void
  onSelectDetection?: (d: Detection) => void
  className?: string
}

export function SensorMap({
  nodes,
  detections = [],
  geofences = [],
  height = 420,
  zoom = 11,
  showGeofences = true,
  showNodes = true,
  showDetections = true,
  onSelectNode,
  onSelectDetection,
  className,
}: SensorMapProps) {
  const { theme } = useTheme()
  const palette = useMemo(() => readPalette(), [theme])

  // Only the most recent detections get a marker; the rest are history and
  // belong on the analytics density map, not the live operational view.
  const recent = useMemo(
    () => detections.filter((d) => Date.now() - d.ts < 6 * 60 * 60 * 1000).slice(0, 60),
    [detections],
  )

  // map.md §3.1 requires that a one-finger drag scroll the PAGE, not the map.
  // Leaflet has no built-in two-finger-pan mode (that needs the
  // GestureHandling plugin, which is not bundled here), so on coarse pointers
  // dragging starts disabled and the operator opts in explicitly. The
  // trade-off is stated in the UI rather than left as a silent dead map.
  const touch = isTouch()
  const [panEnabled, setPanEnabled] = useState(!touch)

  return (
    <div className={cn('relative', className)} style={{ height }}>
      {touch && (
        <button
          type="button"
          onClick={() => setPanEnabled((p) => !p)}
          aria-pressed={panEnabled}
          className="absolute right-2 top-2 z-[400] cursor-pointer rounded-md border border-border-strong bg-surface-4/95 px-2 py-1 font-mono text-[10px] font-semibold text-fg-secondary shadow-lg"
        >
          {panEnabled ? 'PAN ON — tap to scroll page' : 'PAN OFF — tap to move map'}
        </button>
      )}
      <MapContainer
        center={CENTER}
        zoom={zoom}
        minZoom={8}
        maxZoom={18}
        scrollWheelZoom={!touch}
        dragging={panEnabled}
        style={{ height: '100%', width: '100%', background: 'var(--map-canvas)' }}
      >
        {/* key forces a tile-layer remount so the basemap swaps with the theme */}
        <TileLayer
          key={theme}
          url={TILES[theme]}
          attribution="&copy; OpenStreetMap &copy; CARTO"
          subdomains={['a', 'b', 'c', 'd']}
        />

        {showGeofences &&
          geofences.map((g) => (
            <Polygon
              key={`${g.id}-${theme}`}
              positions={g.polygon}
              pathOptions={{
                color: palette.fence[g.color],
                weight: 2,
                fillOpacity: 0.08,
                dashArray: g.type === 'exclusion' ? '6 4' : undefined,
              }}
            >
              <Tooltip sticky>
                <span className="font-mono text-xs">
                  {g.name} · {g.type}
                </span>
              </Tooltip>
            </Polygon>
          ))}

        {showNodes &&
          nodes.map((n) => (
            <CircleMarker
              key={`${n.id}-${theme}`}
              center={[n.lat, n.lng]}
              radius={n.type === 'gateway' ? 8 : 6}
              pathOptions={palette.status[n.status]}
              eventHandlers={onSelectNode ? { click: () => onSelectNode(n) } : undefined}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <div className="font-mono text-sm font-semibold">{n.id}</div>
                  <div className="mt-0.5 text-xs opacity-80">{n.label}</div>
                  <dl className="mt-2 space-y-0.5 font-mono text-[11px]">
                    <Row k="Status" v={n.status} />
                    <Row k="Tier" v={n.tier === 'T1' ? 'Forest core' : 'Village perimeter'} />
                    <Row k="Sector" v={n.sector} />
                    <Row k="Battery" v={n.status === 'offline' ? '——' : `${n.battery}%`} />
                    <Row k="Signal" v={n.status === 'offline' ? '——' : `${n.rssi} dBm`} />
                    <Row k="Last seen" v={`${relativeAge(n.lastSeen)} ago`} />
                  </dl>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {showDetections &&
          recent.map((d) => {
            const color = palette.severity[d.severity] ?? palette.severity.info
            return (
              <CircleMarker
                key={`${d.id}-${theme}`}
                center={[d.lat, d.lng]}
                radius={d.severity === 'critical' ? 11 : 9}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.35,
                  weight: 2,
                }}
                eventHandlers={onSelectDetection ? { click: () => onSelectDetection(d) } : undefined}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <div className="text-sm font-semibold">{classLabel(d.cls)}</div>
                    <dl className="mt-2 space-y-0.5 font-mono text-[11px]">
                      <Row k="Severity" v={d.severity} />
                      <Row k="Confidence" v={`${d.confidence}%`} />
                      <Row k="Node" v={d.nodeId} />
                      <Row k="Sector" v={d.sector} />
                      <Row k="When" v={`${relativeAge(d.ts)} ago`} />
                      <Row k="Position" v={coords(d.lat, d.lng)} />
                    </dl>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
      </MapContainer>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="opacity-60">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function isTouch(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Legend proving the map is not colour-only (map.md §3.5). */
export function MapLegend({ className }: { className?: string }) {
  const items = [
    {
      label: 'Node online',
      // The marker ring token follows the theme, so the swatch matches the map.
      swatch: (
        <span className="h-3 w-3 rounded-full bg-status-ok-vivid ring-2 ring-[color:var(--map-marker-ring)]" />
      ),
    },
    {
      label: 'Node degraded',
      swatch: (
        <span className="h-3 w-3 rounded-full bg-status-warning-vivid ring-2 ring-status-warning-vivid/40" />
      ),
    },
    {
      label: 'Node offline',
      swatch: <span className="h-3 w-3 rounded-full border-2 border-dashed border-status-offline-vivid" />,
    },
    {
      label: 'Critical detection',
      swatch: (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-status-critical-vivid bg-status-critical-vivid/40" />
      ),
    },
    {
      label: 'Warning detection',
      swatch: (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-status-warning-vivid bg-status-warning-vivid/40" />
      ),
    },
    {
      label: 'Geofence',
      swatch: <span className="h-3 w-3 border-2 border-secondary-vivid bg-secondary-vivid/10" />,
    },
  ]
  return (
    <ul className={className}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-xs text-fg-secondary">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">{i.swatch}</span>
          {i.label}
        </li>
      ))}
    </ul>
  )
}
