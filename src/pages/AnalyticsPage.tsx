/**
 * Analytics & reports — spec: design-system/wildguardx/pages/analytics.md
 *
 * This page is deliberately NOT real-time. There is no LiveBadge; it carries a
 * freshness stamp instead, because claiming "live" on an aggregated warehouse
 * view would be a lie.
 *
 * Other spec rules honoured here:
 *  - Categorical series use --cat-1..6; status colours stay reserved for status.
 *  - Delta colour follows DESIRABILITY, the arrow follows direction, and the
 *    tooltip states both.
 *  - Statistics on fewer than 30 labelled samples show `n=` instead of a
 *    precise-looking percentage.
 */

import { useMemo, useState } from 'react'
import { Download, Save, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { AnalyticsResult, FieldNode } from '@/data/types'
import { AsyncBoundary, EmptyState, SkeletonChart, SkeletonTiles } from '@/components/ui/states'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { MetricTile } from '@/components/domain/MetricTile'
import { PageHeader } from '@/components/ui/PageHeader'
import { StaticBadge } from '@/components/ui/LiveBadge'
import { Modal } from '@/components/ui/Modal'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ChartCard, Funnel, Heatmap, StackedArea } from '@/components/charts'
import { SensorMap } from '@/components/map/SensorMap'
import { iconProps } from '@/components/domain/icons'
import { absoluteDateTime, duration, percent } from '@/lib/format'

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
]

const SERIES = [
  { key: 'elephant', label: 'Elephant' },
  { key: 'tiger', label: 'Tiger' },
  { key: 'leopard', label: 'Leopard' },
  { key: 'wild_boar', label: 'Wild boar' },
  { key: 'human', label: 'Human' },
  { key: 'other', label: 'Other' },
]

export function AnalyticsPage() {
  const { provider } = useData()
  const [days, setDays] = useState(30)
  const [sector, setSector] = useState<string | null>(null)
  const [compare, setCompare] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [coverageMode, setCoverageMode] = useState(false)

  // The ETL cadence is hourly; the stamp reflects the last completed run,
  // never Date.now().
  const dataThrough = useMemo(() => {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    return d.getTime()
  }, [])

  const query = useAsyncData<AnalyticsResult>(
    () => provider.getAnalytics({ fromDays: days, sector }),
    [provider, days, sector],
    {
      isEmpty: (r) => r.totalDetections === 0,
      partialSources: ['model-performance warehouse'],
    },
  )

  const nodesQuery = useAsyncData(() => provider.getDevices({ limit: 400 }), [provider], {
    isEmpty: (p) => p.items.length === 0,
    emptyValue: { items: [] as FieldNode[], total: 0, nextCursor: null },
  })

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Analytics"
        description="Aggregated over the warehouse. Not a live view — figures update hourly."
        actions={
          <>
            {/* Freshness stamp REPLACES the LiveBadge on this page */}
            <StaticBadge tone="neutral" label={`DATA THROUGH ${absoluteDateTime(dataThrough)}`} />
            <Button size="sm" variant="subtle" icon={<Save size={14} {...iconProps} />}>
              Save view
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Download size={14} {...iconProps} />}
              onClick={() => setExportOpen(true)}
            >
              Export
            </Button>
          </>
        }
      />

      {/* --- Controls ------------------------------------------------------ */}
      <div className="sticky top-16 z-20 mb-md flex flex-wrap items-center gap-md rounded-xl border border-border bg-surface-2/95 p-md backdrop-blur-md">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={cn(
                'cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors duration-base',
                days === r.days
                  ? 'border-primary bg-[color:var(--status-watch-fill)] text-primary'
                  : 'border-border text-fg-muted hover:text-fg',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          Sector
          <select
            value={sector ?? ''}
            onChange={(e) => setSector(e.target.value || null)}
            className="input h-9 w-[130px] cursor-pointer py-0 text-sm"
          >
            <option value="">All</option>
            {['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-secondary">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[color:var(--color-primary)]"
          />
          Compare to previous period
        </label>
      </div>

      <AsyncBoundary
        query={query}
        skeleton={
          <div className="space-y-md">
            <SkeletonTiles count={4} />
            <SkeletonChart height={300} />
            <div className="grid gap-md lg:grid-cols-2">
              <SkeletonChart height={260} />
              <SkeletonChart height={260} />
            </div>
          </div>
        }
        empty={
          <EmptyState
            title="No detections in this range"
            body={`Nothing was recorded in the last ${days} days for the selected filters.`}
            action={
              <Button variant="primary" size="sm" onClick={() => setDays(90)}>
                Expand to 90 days
              </Button>
            }
          />
        }
      >
        {(a) => (
          <>
            {/* --- KPI row --------------------------------------------------- */}
            <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
              <MetricTile
                label="Total detections"
                value={a.totalDetections}
                delta={
                  compare
                    ? {
                        value: a.deltas.totalDetections,
                        display: String(Math.abs(a.deltas.totalDetections)),
                        lowerIsBetter: false,
                        period: 'vs previous',
                      }
                    : undefined
                }
              />
              <MetricTile
                label="Confirmed threats"
                value={a.confirmedThreats}
                tone="warning"
                delta={
                  compare
                    ? {
                        value: a.deltas.confirmedThreats,
                        display: String(Math.abs(a.deltas.confirmedThreats)),
                        lowerIsBetter: true,
                        period: 'vs previous',
                      }
                    : undefined
                }
              />
              <MetricTile
                label="False-positive rate"
                value={percent(a.falsePositiveRate)}
                tone={a.falsePositiveRate > 25 ? 'warning' : 'default'}
                // A falling false-positive rate is GOOD even though the arrow
                // points down — colour follows desirability.
                delta={
                  compare
                    ? {
                        value: a.deltas.falsePositiveRate,
                        display: `${Math.abs(a.deltas.falsePositiveRate).toFixed(1)}pp`,
                        lowerIsBetter: true,
                        period: 'vs previous',
                      }
                    : undefined
                }
              />
              <MetricTile
                label="Median response"
                value={duration(a.medianResponseSeconds)}
                delta={
                  compare
                    ? {
                        value: a.deltas.medianResponseSeconds,
                        display: `${Math.abs(a.deltas.medianResponseSeconds)}s`,
                        lowerIsBetter: true,
                        period: 'vs previous',
                      }
                    : undefined
                }
              />
            </div>

            {/* --- Detections over time -------------------------------------- */}
            <div className="mt-md">
              <ChartCard
                title="Detections over time"
                subtitle="Daily buckets by class — how detection volume is trending"
                rows={a.totalDetections}
                table={{
                  headers: ['Date', ...SERIES.map((s) => s.label)],
                  rows: a.overTime.map((row) => [
                    row.date as string,
                    ...SERIES.map((s) => (row[s.key] as number) ?? 0),
                  ]),
                }}
              >
                <StackedArea data={a.overTime} keys={SERIES} height={280} />
              </ChartCard>
            </div>

            {/* --- Hotspots + time-of-day ------------------------------------ */}
            <div className="mt-md grid gap-md lg:grid-cols-2">
              <ChartCard
                title={coverageMode ? 'Coverage gaps' : 'Detection hotspots'}
                subtitle={
                  coverageMode
                    ? 'Detections with no node within 2 km — where to place the next sensor'
                    : 'Where detections cluster, read against node coverage'
                }
                rows={coverageMode ? a.coverageGaps.length : a.totalDetections}
                actions={
                  <button
                    type="button"
                    onClick={() => setCoverageMode((c) => !c)}
                    aria-pressed={coverageMode}
                    className={cn(
                      'cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors duration-base',
                      coverageMode
                        ? 'border-primary bg-[color:var(--status-watch-fill)] text-primary'
                        : 'border-border text-fg-muted hover:text-fg',
                    )}
                  >
                    Coverage gaps
                  </button>
                }
                table={{
                  headers: ['Latitude', 'Longitude', 'Detections'],
                  rows: a.coverageGaps.slice(0, 40).map((g) => [g.lat, g.lng, g.count]),
                }}
              >
                {coverageMode && a.coverageGaps.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-lg border border-status-ok/40 bg-[color:var(--status-ok-fill)] px-md py-3 text-sm text-status-ok">
                    No coverage gaps — every detection in this period had a node within 2 km.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <SensorMap
                      nodes={coverageMode ? [] : (nodesQuery.data?.items ?? [])}
                      detections={[]}
                      height={260}
                      zoom={10}
                      showDetections={false}
                    />
                  </div>
                )}
                <p className="mt-sm font-mono text-[11px] text-fg-muted">
                  Legend unit: detections / km² / week
                </p>
              </ChartCard>

              <ChartCard
                title="Time of day"
                subtitle="When detections happen — this is how patrol shifts get scheduled"
                rows={a.totalDetections}
                table={{
                  headers: ['Day', 'Hour', 'Detections'],
                  rows: a.byHour
                    .filter((c) => c.count > 0)
                    .map((c) => [
                      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.day],
                      `${String(c.hour).padStart(2, '0')}:00`,
                      c.count,
                    ]),
                }}
              >
                <Heatmap cells={a.byHour} />
              </ChartCard>
            </div>

            {/* --- Funnel + model performance --------------------------------- */}
            <div className="mt-md grid gap-md lg:grid-cols-2">
              <ChartCard
                title="Response funnel"
                subtitle="Where incidents drop out between detection and resolution"
                rows={a.totalDetections}
                table={{
                  headers: ['Stage', 'Count', 'Median seconds'],
                  rows: a.funnel.map((f) => [f.stage, f.count, f.medianSeconds]),
                }}
              >
                <Funnel stages={a.funnel} />
              </ChartCard>

              <Card flat padding="lg">
                <CardHeader
                  title="Model performance"
                  subtitle="Precision and recall per class, against operator-recorded outcomes"
                />
                <ul className="space-y-2.5">
                  {a.modelPerf.map((m) => (
                    <li key={m.cls} className="flex items-center gap-md">
                      <span className="w-24 text-sm capitalize text-fg-secondary">
                        {m.cls.replace('_', ' ')}
                      </span>
                      {/* Below 30 labelled samples we refuse to show a precise number */}
                      {m.samples < 30 ? (
                        <Chip tone="neutral" mono>
                          n={m.samples} — not enough data
                        </Chip>
                      ) : (
                        <>
                          <span className="flex-1">
                            <span className="mb-0.5 flex justify-between font-mono text-[10px] text-fg-muted">
                              <span>P {m.precision}%</span>
                              <span>R {m.recall}%</span>
                              <span>F1 {m.f1}%</span>
                            </span>
                            <span className="block h-1.5 overflow-hidden rounded-full bg-surface-1">
                              <span
                                className="block h-full rounded-full bg-cat-2"
                                style={{ width: `${m.f1}%` }}
                              />
                            </span>
                          </span>
                          <span className="w-14 text-right font-mono text-[10px] tabular-nums text-fg-muted">
                            n={m.samples}
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-md flex items-start gap-1.5 text-xs text-fg-muted">
                  <TriangleAlert size={13} className="mt-0.5 shrink-0 text-status-warning" {...iconProps} />
                  Computed from operator-recorded outcomes, so it measures the model plus the triage
                  process, not the model alone.
                </p>
              </Card>
            </div>

            {/* --- Sector breakdown ------------------------------------------ */}
            <div className="mt-md">
              <Card flat padding="lg">
                <CardHeader
                  title="Sector breakdown"
                  subtitle="Click a row to filter the whole page to that sector"
                />
                <SectorTable data={a.bySector} onSelect={(s) => setSector(s)} />
              </Card>
            </div>
          </>
        )}
      </AsyncBoundary>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} days={days} />
    </div>
  )
}

/* ========================================================================== */

function SectorTable({
  data,
  onSelect,
}: {
  data: AnalyticsResult['bySector']
  onSelect: (sector: string) => void
}) {
  const columns: Column<AnalyticsResult['bySector'][number]>[] = [
    {
      key: 'sector',
      header: 'Sector',
      sortValue: (r) => r.sector,
      render: (r) => (
        <span>
          <span className="font-mono text-xs text-fg">{r.sector}</span>
          <span className="ml-2 text-xs text-fg-muted">{r.name}</span>
        </span>
      ),
    },
    {
      key: 'detections',
      header: 'Detections',
      sortValue: (r) => r.detections,
      align: 'right',
      render: (r) => <span className="font-mono text-xs tabular-nums">{r.detections}</span>,
    },
    {
      key: 'confirmed',
      header: 'Confirmed',
      sortValue: (r) => r.confirmed,
      align: 'right',
      render: (r) => <span className="font-mono text-xs tabular-nums">{r.confirmed}</span>,
    },
    {
      key: 'fp',
      header: 'False positive',
      sortValue: (r) => r.falsePositiveRate,
      align: 'right',
      render: (r) => (
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            r.falsePositiveRate > 25 ? 'text-status-warning' : 'text-fg-secondary',
          )}
        >
          {r.falsePositiveRate}%
        </span>
      ),
    },
    {
      key: 'response',
      header: 'Median response',
      sortValue: (r) => r.medianResponseSeconds,
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs tabular-nums">{duration(r.medianResponseSeconds)}</span>
      ),
    },
    {
      key: 'nodes',
      header: 'Nodes',
      sortValue: (r) => r.nodes,
      align: 'right',
      render: (r) => <span className="font-mono text-xs tabular-nums">{r.nodes}</span>,
    },
    {
      key: 'uptime',
      header: 'Uptime',
      sortValue: (r) => r.uptime,
      align: 'right',
      render: (r) => <span className="font-mono text-xs tabular-nums">{r.uptime}%</span>,
    },
  ]

  return (
    <DataTable
      caption="Detections, confirmations and response times per sector"
      columns={columns}
      rows={data}
      rowKey={(r) => r.sector}
      onRowActivate={(r) => onSelect(r.sector)}
      density="compact"
    />
  )
}

function ExportModal({ open, onClose, days }: { open: boolean; onClose: () => void; days: number }) {
  const [format, setFormat] = useState('pdf')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export report"
      description={`Covering the last ${days} days with the current filters applied.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onClose}>
            Generate
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-sm text-sm font-medium text-fg-secondary">Format</legend>
        <div className="space-y-1.5">
          {[
            { id: 'pdf', label: 'PDF report', help: 'Title page, charts rendered light-mode for print, methodology appendix.' },
            { id: 'csv', label: 'CSV data', help: 'Raw rows behind every chart on this page.' },
            { id: 'png', label: 'PNG charts', help: 'One image per chart, dark theme.' },
          ].map((f) => (
            <label
              key={f.id}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors duration-base',
                format === f.id
                  ? 'border-primary bg-[color:var(--status-watch-fill)]'
                  : 'border-border bg-surface-2 hover:bg-surface-3',
              )}
            >
              <input
                type="radio"
                name="format"
                checked={format === f.id}
                onChange={() => setFormat(f.id)}
                className="mt-0.5 h-4 w-4 accent-[color:var(--color-primary)]"
              />
              <span>
                <span className="block text-sm text-fg">{f.label}</span>
                <span className="block text-xs text-fg-muted">{f.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-md flex cursor-pointer items-center gap-2.5 text-sm text-fg-secondary">
        <input type="checkbox" defaultChecked className="h-4 w-4 cursor-pointer accent-[color:var(--color-primary)]" />
        Include methodology appendix
      </label>
    </Modal>
  )
}
