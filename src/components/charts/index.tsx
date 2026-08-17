/**
 * Charts — spec: analytics.md §1 and device-detail.md §3.4.
 *
 * House rules enforced here:
 *  - Status colours (--status-*) are reserved for status. Categorical series
 *    use --cat-1..6, so critical-red never labels a neutral category.
 *  - Y axes start at zero for counts. No dual axes. No 3D. No donut >4 slices.
 *  - Grid lines never out-shine the data.
 *  - Every chart ships a visually-hidden <table> of its values, and the
 *    `Show data table` toggle is visible to everyone — it is also the fastest
 *    way to read exact numbers.
 *  - Gaps in telemetry BREAK the line; nothing is interpolated across silence.
 *  - Text labels never sit on a coloured fill (they cannot be guaranteed
 *    4.5:1 across both themes), so value labels sit beside their bars.
 *
 * THEMING: Recharts writes colours as SVG presentation attributes, and
 * `var(--x)` does not resolve in a presentation attribute. Every colour is
 * therefore SAMPLED from the resolved custom property via cssVar() and
 * re-sampled when the theme changes.
 */

import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Table2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { cssVar, useTheme } from '@/lib/useTheme'
import { iconProps } from '@/components/domain/icons'

/** Resolve `var(--token)` to a concrete colour; pass other values through. */
export function resolveColor(value: string, fallback = '#888888'): string {
  const m = value?.match?.(/^var\(\s*(--[\w-]+)\s*\)$/)
  return m ? cssVar(m[1], fallback) : (value ?? fallback)
}

/** Sampled chart palette; re-reads whenever the theme changes. */
export function useChartTheme() {
  const { theme } = useTheme()
  return useMemo(
    () => ({
      theme,
      cat: [
        cssVar('--cat-1', '#D97706'),
        cssVar('--cat-2', '#6366F1'),
        cssVar('--cat-3', '#10B981'),
        cssVar('--cat-4', '#F59E0B'),
        cssVar('--cat-5', '#8B5CF6'),
        cssVar('--cat-6', '#64748B'),
      ],
      seq: [
        cssVar('--seq-0', '#0F172A'),
        cssVar('--seq-1', '#78350F'),
        cssVar('--seq-2', '#D97706'),
        cssVar('--seq-3', '#FCD34D'),
      ],
      grid: cssVar('--chart-grid', '#1B2540'),
      axis: cssVar('--chart-axis', '#94A3B8'),
      cursor: cssVar('--chart-cursor', 'rgba(255,255,255,0.04)'),
      surface1: cssVar('--surface-1', '#0F172A'),
      critical: cssVar('--status-critical-vivid', '#DC2626'),
    }),
    [theme],
  )
}

/* --- tooltip -------------------------------------------------------------- */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border-strong bg-surface-4 px-3 py-2 shadow-xl">
      {label != null && <div className="mb-1 font-mono text-xs text-fg-muted">{String(label)}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color ?? p.fill }} />
          <span className="text-fg-secondary">{p.name}</span>
          <span className="ml-auto font-mono tabular-nums text-fg">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* --- card wrapper with the data-table toggle ------------------------------ */

interface ChartCardProps {
  title: string
  /** One plain-language line stating what this chart answers. */
  subtitle: string
  /** Row count behind the chart — disclosure, not decoration. */
  rows?: number
  note?: string
  actions?: ReactNode
  table: { headers: string[]; rows: (string | number)[][] }
  children: ReactNode
  className?: string
}

export function ChartCard({
  title,
  subtitle,
  rows,
  note,
  actions,
  table,
  children,
  className,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false)
  const id = useId()

  return (
    <section
      className={cn('overflow-hidden rounded-xl border border-border bg-surface-2', className)}
      aria-labelledby={`${id}-title`}
    >
      {/* Gradient header band — a brand tint mixed over the card surface, so
          the card gains structure without a second surface colour. */}
      <div className="card-header-wash flex flex-wrap items-start justify-between gap-md border-b border-border px-lg py-md">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="text-h3 text-fg">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            {subtitle}
            {rows != null && ` · ${rows.toLocaleString()} records`}
          </p>
          {note && <p className="mt-1 font-mono text-[11px] text-status-warning">{note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          {actions}
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            aria-expanded={showTable}
            aria-controls={`${id}-table`}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong px-2 text-xs text-fg-muted transition-colors duration-base hover:bg-surface-3 hover:text-fg"
          >
            <Table2 size={12} {...iconProps} />
            {showTable ? 'Hide data' : 'Show data'}
          </button>
        </div>
      </div>

      <div className="p-lg">
        {children}

        {/* Always in the DOM for assistive tech; visually revealed on demand. */}
        <div id={`${id}-table`} className={showTable ? 'mt-md' : 'sr-only'}>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <caption className="sr-only">{`${title} — underlying data`}</caption>
              <thead className="sticky top-0 bg-surface-3">
                <tr>
                  {table.headers.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-2.5 py-1.5 text-left font-semibold text-fg-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {r.map((c, j) => (
                      <td key={j} className="px-2.5 py-1.5 font-mono tabular-nums text-fg-secondary">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --- sparkline ------------------------------------------------------------ */

export function Sparkline({
  data,
  dataKey = 'value',
  color = 'var(--color-primary-vivid)',
  height = 32,
  filled = true,
}: {
  data: Record<string, number>[]
  dataKey?: string
  color?: string
  height?: number
  filled?: boolean
}) {
  const { theme } = useTheme()
  const stroke = useMemo(() => resolveColor(color), [color, theme])
  const gradientId = useId()

  if (!data.length) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          strokeWidth={1.5}
          fill={filled ? `url(#${gradientId})` : 'none'}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Discrete bar strip — reads better than a line for hourly counts. */
export function SparkBars({
  data,
  dataKey = 'value',
  color = 'var(--color-primary-vivid)',
  height = 28,
}: {
  data: Record<string, number>[]
  dataKey?: string
  color?: string
  height?: number
}) {
  const { theme } = useTheme()
  const fill = useMemo(() => resolveColor(color), [color, theme])
  if (!data.length) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 1, right: 0, bottom: 0, left: 0 }} barCategoryGap={1}>
        <Bar dataKey={dataKey} fill={fill} radius={[1, 1, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* --- stacked area (detections over time) ---------------------------------- */

export function StackedArea({
  data,
  keys,
  height = 280,
}: {
  data: Record<string, string | number>[]
  keys: { key: string; label: string }[]
  height?: number
}) {
  const t = useChartTheme()
  const axis = { stroke: t.axis, fontSize: 11, fontFamily: 'Fira Sans' }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={{ stroke: t.grid }} minTickGap={28} />
        {/* Counts always start at zero */}
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'auto']} />
        <Tooltip content={<ChartTooltip />} />
        {keys.map((k, i) => (
          <Area
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.label}
            stackId="1"
            stroke={t.cat[i % t.cat.length]}
            fill={t.cat[i % t.cat.length]}
            fillOpacity={0.35}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* --- stacked bar (detections by hour) ------------------------------------- */

export function StackedBars({
  data,
  keys,
  xKey = 'hour',
  height = 200,
}: {
  data: Record<string, string | number>[]
  keys: { key: string; label: string }[]
  xKey?: string
  height?: number
}) {
  const t = useChartTheme()
  const axis = { stroke: t.axis, fontSize: 11, fontFamily: 'Fira Sans' }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={{ stroke: t.grid }} interval={2} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'auto']} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: t.cursor }} />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.label}
            stackId="a"
            fill={t.cat[i % t.cat.length]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/* --- donut (fleet health, max 4 slices) ----------------------------------- */

export function Donut({
  data,
  height = 180,
}: {
  data: { name: string; value: number; color: string }[]
  height?: number
}) {
  const { theme } = useTheme()
  const resolved = useMemo(
    () => data.map((d) => ({ ...d, fill: resolveColor(d.color) })),
    [data, theme],
  )
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={resolved}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {resolved.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold tabular-nums text-fg">{total}</span>
        <span className="text-[10px] uppercase tracking-wide text-fg-muted">nodes</span>
      </div>
    </div>
  )
}

/* --- telemetry stack: shared X axis, gaps break the line ------------------ */

export function TelemetryChart({
  data,
  dataKey,
  label,
  color,
  unit,
  height = 120,
  thresholdValue,
  thresholdLabel,
}: {
  data: { ts: number; [k: string]: number }[]
  dataKey: string
  label: string
  color: string
  unit: string
  height?: number
  thresholdValue?: number
  thresholdLabel?: string
}) {
  const t = useChartTheme()
  const stroke = useMemo(() => resolveColor(color), [color, t.theme])
  const axis = { stroke: t.axis, fontSize: 11, fontFamily: 'Fira Sans' }

  const formatted = data.map((d) => ({
    ...d,
    time: new Date(d.ts).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    // A zeroed sample means the node was silent. null breaks the line rather
    // than drawing a straight segment across a gap that never happened.
    [dataKey]: d[dataKey] === 0 && dataKey !== 'detections' ? null : d[dataKey],
  }))

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-fg-secondary">{label}</span>
        <span className="font-mono text-[11px] text-fg-muted">{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} syncId="telemetry">
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="time" tick={axis} tickLine={false} axisLine={{ stroke: t.grid }} minTickGap={40} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ChartTooltip />} />
          {thresholdValue != null && (
            <Line
              type="monotone"
              dataKey={() => thresholdValue}
              stroke={t.critical}
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              name={thresholdLabel ?? 'Threshold'}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* --- heatmap (7 x 24) ----------------------------------------------------- */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Heatmap({ cells }: { cells: { day: number; hour: number; count: number }[] }) {
  const t = useChartTheme()
  const max = Math.max(1, ...cells.map((c) => c.count))
  const p90 = max * 0.9

  const at = (day: number, hour: number) =>
    cells.find((c) => c.day === day && c.hour === hour)?.count ?? 0

  const colorFor = (v: number) => {
    if (v === 0) return t.surface1
    const ratio = v / max
    if (ratio < 0.34) return t.seq[1]
    if (ratio < 0.67) return t.seq[2]
    return t.seq[3]
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="mb-1 grid grid-cols-[40px_repeat(24,1fr)] gap-[2px]">
          <span />
          {Array.from({ length: 24 }).map((_, h) => (
            <span key={h} className="text-center font-mono text-[9px] text-fg-muted">
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
        </div>
        {DAYS.map((label, day) => (
          <div key={label} className="mb-[2px] grid grid-cols-[40px_repeat(24,1fr)] gap-[2px]">
            <span className="flex items-center font-mono text-[10px] text-fg-muted">{label}</span>
            {Array.from({ length: 24 }).map((_, hour) => {
              const v = at(day, hour)
              return (
                <button
                  key={hour}
                  type="button"
                  className={cn(
                    'h-5 cursor-pointer rounded-[2px] transition-transform duration-fast',
                    // Above the 90th percentile also carries a border, so the
                    // peak is not encoded by hue alone.
                    v >= p90 && v > 0 && 'ring-1 ring-inset ring-[color:var(--chart-heat-peak)]',
                  )}
                  style={{ background: colorFor(v) }}
                  title={`${label} ${String(hour).padStart(2, '0')}:00 — ${v} detections`}
                  aria-label={`${label} ${hour}:00, ${v} detections`}
                />
              )
            })}
          </div>
        ))}
        <div className="mt-sm flex items-center gap-2 text-[10px] text-fg-muted">
          <span>Fewer</span>
          {t.seq.map((c, i) => (
            <span key={i} className="h-3 w-6 rounded-[2px] border border-border" style={{ background: c }} />
          ))}
          <span>More</span>
          <span className="ml-2">· detections per hour bucket</span>
        </div>
      </div>
    </div>
  )
}

/* --- funnel --------------------------------------------------------------- */

export function Funnel({
  stages,
}: {
  stages: { stage: string; count: number; medianSeconds: number }[]
}) {
  const max = Math.max(1, ...stages.map((s) => s.count))
  return (
    <ol className="space-y-2">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : s.count
        const conversion = prev ? (s.count / prev) * 100 : 100
        const dropOff = 100 - conversion
        return (
          <li key={s.stage}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-fg-secondary">{s.stage}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono tabular-nums text-fg">{s.count}</span>
                {i > 0 && (
                  <span
                    className={cn(
                      'font-mono tabular-nums',
                      dropOff > 25 ? 'text-status-warning' : 'text-fg-muted',
                    )}
                    title={
                      dropOff > 25
                        ? `${dropOff.toFixed(0)}% drop-off — investigate this stage`
                        : undefined
                    }
                  >
                    {conversion.toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 flex-1 overflow-hidden rounded bg-surface-1">
                <div
                  className="h-full rounded bg-cat-2"
                  style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }}
                />
              </div>
              {/* Label sits BESIDE the fill, never on it — a label on a coloured
                  bar cannot be guaranteed 4.5:1 across both themes. */}
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-fg-muted">
                {s.medianSeconds > 0 ? `${s.medianSeconds}s` : '—'}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
