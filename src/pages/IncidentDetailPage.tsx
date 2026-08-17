/**
 * Incident detail — spec: design-system/wildguardx/pages/incident-detail.md
 *
 * This page doubles as the legal record of a response, so:
 *  - The timeline is APPEND-ONLY. A correction is a new entry, never an edit.
 *  - Resolution requires an explicit outcome; there is no "just close it".
 *  - Model classification and human reclassification are visually distinct.
 *  - Missing evidence is explained, never rendered as a blank slot.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AudioLines,
  Camera,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Pause,
  Play,
  Thermometer,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { Detection, TeamMember } from '@/data/types'
import { AsyncBoundary, EmptyState, Skeleton, SkeletonRows } from '@/components/ui/states'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Chip, IncidentStatusChip, SeverityChip } from '@/components/ui/Chip'
import { ConfidenceBar } from '@/components/domain/ConfidenceBar'
import { Modal } from '@/components/ui/Modal'
import { SensorMap } from '@/components/map/SensorMap'
import { AlertRow } from '@/components/domain/AlertRow'
import { CLASS_ICONS, iconProps } from '@/components/domain/icons'
import { SpeciesThumb, TierBadge } from '@/components/domain/SpeciesThumb'
import {
  absoluteDateTime,
  absoluteTime,
  classLabel,
  coords,
  duration,
  outcomeLabel,
  relativeAge,
} from '@/lib/format'
import { useTicker } from '@/lib/hooks'

const OUTCOMES = [
  { id: 'threat_confirmed_action_taken', label: 'Threat confirmed — action taken' },
  { id: 'threat_confirmed_no_action', label: 'Threat confirmed — no action possible' },
  { id: 'no_threat_found', label: 'No threat found' },
  { id: 'false_positive_model', label: 'False positive — model error' },
  { id: 'false_positive_environmental', label: 'False positive — environmental' },
]

interface TimelineEntry {
  ts: number
  actor: string
  action: string
  note?: string
  kind: 'system' | 'model' | 'human'
}

export function IncidentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { provider } = useData()
  const [condensed, setCondensed] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [note, setNote] = useState('')
  const [extraEntries, setExtraEntries] = useState<TimelineEntry[]>([])
  const [copied, setCopied] = useState(false)

  useTicker(1000)

  const query = useAsyncData<Detection | null>(() => provider.getIncident(id), [provider, id], {
    isEmpty: (d) => d === null,
    emptyValue: null,
    partialSources: ['evidence CDN'],
  })

  const relatedQuery = useAsyncData<Detection[]>(() => provider.getRelatedAlerts(id), [provider, id], {
    isEmpty: (r) => r.length === 0,
    emptyValue: [],
  })

  const teamQuery = useAsyncData<TeamMember[]>(() => provider.getTeam(), [provider], {
    isEmpty: (t) => t.length === 0,
    emptyValue: [],
  })

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const d = query.data

  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!d) return []
    const base: TimelineEntry[] = [
      { ts: d.ts, actor: d.nodeId, action: 'Detected', kind: 'system' },
      {
        ts: d.ts + 2000,
        actor: `Model ${d.modelVersion}`,
        action: `Auto-classified as ${classLabel(d.cls)}`,
        note: `${d.confidence}% confidence`,
        kind: 'model',
      },
      { ts: d.ts + 3500, actor: 'System', action: 'Alert delivered', note: 'push + SMS', kind: 'system' },
    ]
    if (d.ackAfterSeconds != null) {
      base.push({
        ts: d.ts + d.ackAfterSeconds * 1000,
        actor: d.acknowledgedBy ?? 'Operator',
        action: 'Acknowledged',
        kind: 'human',
      })
    }
    if (d.status === 'dispatched' || d.responseSeconds != null) {
      base.push({
        ts: d.ts + (d.ackAfterSeconds ?? 60) * 1000 + 30_000,
        actor: d.assignedTo ?? 'Ranger',
        action: 'Dispatched',
        kind: 'human',
      })
    }
    if (d.responseSeconds != null) {
      base.push({
        ts: d.ts + d.responseSeconds * 1000,
        actor: d.assignedTo ?? 'Ranger',
        action: 'On scene',
        kind: 'human',
      })
    }
    if (d.outcome) {
      base.push({
        ts: d.ts + (d.responseSeconds ?? 300) * 1000 + 180_000,
        actor: d.acknowledgedBy ?? 'Operator',
        action: d.status === 'false_positive' ? 'Closed as false positive' : 'Resolved',
        note: outcomeLabel(d.outcome),
        kind: 'human',
      })
    }
    return [...base, ...extraEntries].sort((a, b) => b.ts - a.ts)
  }, [d, extraEntries])

  const addNote = () => {
    if (!note.trim()) return
    setExtraEntries((e) => [
      ...e,
      { ts: Date.now(), actor: 'S. Krishnasamy', action: 'Note added', note: note.trim(), kind: 'human' },
    ])
    setNote('')
  }

  const resolve = async (outcome: string) => {
    if (!d) return
    await provider.resolveIncident(d.incidentId, outcome)
    setExtraEntries((e) => [
      ...e,
      { ts: Date.now(), actor: 'S. Krishnasamy', action: 'Resolved', note: outcomeLabel(outcome), kind: 'human' },
    ])
    setResolveOpen(false)
    query.retry()
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <Link
        to="/app/alerts"
        className="mb-md inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-base hover:text-fg"
      >
        <ArrowLeft size={14} {...iconProps} />
        Back to alerts
      </Link>

      <AsyncBoundary
        query={query}
        skeleton={
          <div className="space-y-md">
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid gap-md lg:grid-cols-12">
              <Skeleton className="h-80 rounded-xl lg:col-span-7" />
              <Skeleton className="h-80 rounded-xl lg:col-span-5" />
            </div>
          </div>
        }
        errorTitle={`Couldn't load ${id}`}
        errorSecondaryAction={
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/alerts')}>
            Back to alerts
          </Button>
        }
        empty={
          <EmptyState
            title="Incident not found"
            body={`No incident with ID ${id}. It may have been merged into another incident.`}
            action={
              <Link to="/app/alerts">
                <Button variant="primary" size="sm">
                  Back to alerts
                </Button>
              </Link>
            }
          />
        }
      >
        {(incident) => {
          if (!incident) return null
          const Icon = CLASS_ICONS[incident.cls]
          const open = incident.status !== 'resolved' && incident.status !== 'false_positive'

          return (
            <>
              {/* --- Sticky header ------------------------------------------ */}
              <div
                className={cn(
                  'sticky top-16 z-20 mb-md rounded-xl border border-border bg-surface-2/95 backdrop-blur-md transition-all duration-base ease-out',
                  condensed ? 'px-md py-2.5' : 'p-md',
                )}
              >
                <div className="flex flex-wrap items-center gap-md">
                  {condensed ? (
                    <Icon
                      size={18}
                      className={cn(
                        incident.severity === 'critical'
                          ? 'text-status-critical'
                          : 'text-status-warning',
                      )}
                      {...iconProps}
                    />
                  ) : (
                    <SpeciesThumb detection={incident} size={44} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className={cn('text-fg', condensed ? 'text-h3' : 'text-h2')}>
                        {classLabel(incident.cls)}
                      </h1>
                      <span className="text-sm text-fg-muted">· {incident.sector}</span>
                      <SeverityChip severity={incident.severity} />
                      <IncidentStatusChip status={incident.status} />
                      <TierBadge tier={incident.tier} />
                      {incident.sos && <Chip tone="critical">SOS raised</Chip>}
                    </div>
                    {!condensed && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-fg-muted">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(incident.incidentId)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1500)
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-fg-secondary"
                        >
                          {incident.incidentId}
                          <Copy size={11} {...iconProps} />
                        </button>
                        <span aria-hidden="true">·</span>
                        <time dateTime={new Date(incident.ts).toISOString()}>
                          {absoluteDateTime(incident.ts)}
                        </time>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{relativeAge(incident.ts)} elapsed</span>
                      </div>
                    )}
                  </div>

                  {/* The primary button is always the single next step. */}
                  <div className="flex shrink-0 flex-wrap items-center gap-sm">
                    {incident.status === 'active' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await provider.acknowledgeAlert(incident.incidentId, 'U-02')
                          query.retry()
                        }}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {incident.status === 'acknowledged' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await provider.dispatchAlert(incident.incidentId, 'U-01')
                          query.retry()
                        }}
                      >
                        Dispatch
                      </Button>
                    )}
                    {open && incident.status !== 'active' && (
                      <Button variant="primary" size="sm" onClick={() => setResolveOpen(true)}>
                        Mark resolved
                      </Button>
                    )}
                    {!open && (
                      <Chip tone="ok">Closed · {outcomeLabel(incident.outcome)}</Chip>
                    )}
                    <Link to={`/app/map`}>
                      <Button variant="ghost" size="sm" icon={<ExternalLink size={13} {...iconProps} />}>
                        Map
                      </Button>
                    </Link>
                  </div>
                </div>
                {copied && (
                  <span role="status" className="mt-1 block text-xs text-status-ok">
                    Incident ID copied
                  </span>
                )}
              </div>

              <div className="grid gap-md lg:grid-cols-12">
                {/* --- Evidence + classification + location ---------------- */}
                <div className="space-y-md lg:col-span-7">
                  <Card flat padding="lg">
                    <CardHeader
                      title="Evidence"
                      subtitle="Chain of custody is part of the record, not an afterthought"
                      wash={incident.severity === 'critical' ? 'critical' : 'warning'}
                    />
                    <EvidenceBlock detection={incident} />
                  </Card>

                  <Card flat padding="lg">
                    <CardHeader
                      title="Classification"
                      subtitle={`Model ${incident.modelVersion}`}
                      wash
                    />
                    <ClassificationBlock detection={incident} />
                  </Card>

                  <Card flat padding="none" className="overflow-hidden">
                    <div className="border-b border-border px-md py-2.5">
                      <h2 className="text-h3 text-fg">Location</h2>
                    </div>
                    <SensorMap
                      nodes={[]}
                      detections={[incident]}
                      height={200}
                      zoom={13}
                      showNodes={false}
                    />
                    <dl className="grid grid-cols-2 gap-x-md gap-y-1.5 p-md font-mono text-xs">
                      <Row k="Coordinates" v={coords(incident.lat, incident.lng)} />
                      <Row k="Sector" v={incident.sector} />
                      <Row k="Zone" v={incident.zone} />
                      <Row k="Node" v={incident.nodeId} />
                    </dl>
                  </Card>

                  <Card flat padding="lg">
                    <CardHeader
                      title="Related alerts"
                      subtitle="Within 500 m and ±30 min — how one event is reconstructed from several nodes"
                    />
                    <AsyncBoundary
                      query={relatedQuery}
                      skeleton={<SkeletonRows rows={2} height={72} />}
                      empty={
                        <p className="py-md text-sm text-fg-muted">
                          No other detections within 500 m and 30 minutes. This appears to be an
                          isolated event.
                        </p>
                      }
                    >
                      {(related) => (
                        <div className="-mx-lg">
                          {related.map((r) => (
                            <AlertRow key={r.id} detection={r} density="compact" showActions={false} />
                          ))}
                        </div>
                      )}
                    </AsyncBoundary>
                  </Card>
                </div>

                {/* --- Response + timeline --------------------------------- */}
                <div className="space-y-md lg:col-span-5">
                  <Card flat padding="lg">
                    <CardHeader title="Response" />
                    <AsyncBoundary
                      query={teamQuery}
                      skeleton={<SkeletonRows rows={1} height={72} />}
                      empty={<p className="text-sm text-fg-muted">No team members configured.</p>}
                    >
                      {(team) => <ResponseBlock detection={incident} team={team} />}
                    </AsyncBoundary>
                  </Card>

                  <Card flat padding="lg">
                    <CardHeader
                      title="Timeline"
                      subtitle="Append-only — corrections are new entries, never edits"
                      wash
                    />
                    <Timeline entries={timeline} />

                    <div className="mt-md border-t border-border pt-md">
                      <label htmlFor="note" className="mb-1.5 block text-xs text-fg-muted">
                        Add a note
                      </label>
                      <textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="What did you observe?"
                        className="input resize-y text-sm"
                      />
                      <div className="mt-sm flex justify-end">
                        <Button variant="primary" size="sm" disabled={!note.trim()} onClick={addNote}>
                          Post note
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* --- Resolution: outcome is mandatory --------------------- */}
              <ResolveModal
                open={resolveOpen}
                onClose={() => setResolveOpen(false)}
                onResolve={resolve}
              />
            </>
          )
        }}
      </AsyncBoundary>
    </div>
  )
}

/* ========================================================================== */

function EvidenceBlock({ detection: d }: { detection: Detection }) {
  const [playing, setPlaying] = useState(false)

  if (!d.evidence.audio && !d.evidence.image && !d.evidence.thermal) {
    return (
      <p className="rounded-lg border border-border bg-surface-1 px-md py-3 text-sm text-fg-muted">
        No evidence captured — this node reports classification results only, with no media capture
        configured.
      </p>
    )
  }

  return (
    <div className="space-y-md">
      {d.evidence.audio ? (
        <div>
          <div className="mb-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-fg-secondary">
              <AudioLines size={15} {...iconProps} />
              Acoustic capture · 10s context
            </span>
            <Button
              size="sm"
              variant="subtle"
              icon={playing ? <Pause size={13} {...iconProps} /> : <Play size={13} {...iconProps} />}
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause evidence audio' : 'Play evidence audio'}
            >
              {playing ? 'Pause' : 'Play'}
            </Button>
          </div>
          <Waveform seed={d.id} playing={playing} />
        </div>
      ) : (
        <MissingSlot
          icon={<AudioLines size={15} {...iconProps} />}
          text="No audio captured — this node is not acoustic."
        />
      )}

      <div className="grid grid-cols-2 gap-md">
        {d.evidence.image ? (
          <div className="rounded-lg border border-border bg-surface-1 p-md text-center">
            <Camera size={20} className="mx-auto text-fg-muted" {...iconProps} />
            <p className="mt-1.5 text-xs text-fg-secondary">1 frame captured</p>
            <p className="font-mono text-[10px] text-fg-muted">1600×1200 · ESP32-CAM</p>
          </div>
        ) : (
          <MissingSlot icon={<ImageIcon size={15} {...iconProps} />} text="No image — node has no camera." />
        )}
        {d.evidence.thermal ? (
          <div className="rounded-lg border border-border bg-surface-1 p-md text-center">
            <Thermometer size={20} className="mx-auto text-fg-muted" {...iconProps} />
            <p className="mt-1.5 text-xs text-fg-secondary">Thermal frame captured</p>
            <p className="font-mono text-[10px] text-fg-muted">32×24 · MLX90640</p>
          </div>
        ) : (
          <MissingSlot
            icon={<Thermometer size={15} {...iconProps} />}
            text="No thermal — node has no thermal sensor."
          />
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-1 px-md py-2.5 font-mono text-[11px] text-fg-muted">
        Captured {absoluteDateTime(d.ts)} · node {d.nodeId} · sha256{' '}
        {hashPrefix(d.id)}…
      </div>
    </div>
  )
}

function MissingSlot({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-1 px-md py-3 text-xs text-fg-muted">
      {icon}
      {text}
    </div>
  )
}

/** Deterministic pseudo-waveform. The detection window is highlighted within
 *  its surrounding context — hearing what came before matters. */
function Waveform({ seed, playing }: { seed: string; playing: boolean }) {
  const bars = useMemo(() => {
    let h = [...seed].reduce((s, c) => s + c.charCodeAt(0), 0)
    return Array.from({ length: 80 }).map((_, i) => {
      h = (h * 1103515245 + 12345) & 0x7fffffff
      const base = (h % 100) / 100
      // The event sits at 45-60% of the clip
      const inWindow = i >= 36 && i <= 48
      return { v: inWindow ? 0.45 + base * 0.55 : base * 0.4, inWindow }
    })
  }, [seed])

  const [pos, setPos] = useState(0)
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setPos((p) => (p + 1) % 80), 60)
    return () => clearInterval(t)
  }, [playing])

  return (
    <div
      className="flex h-20 items-center gap-[2px] rounded-lg border border-border bg-surface-1 px-2"
      role="img"
      aria-label="Audio waveform. The detected event occupies the middle of a ten-second clip; amplitude rises sharply within the detection window."
    >
      {bars.map((b, i) => (
        <span
          key={i}
          className={cn(
            'flex-1 rounded-sm transition-colors duration-fast',
            b.inWindow ? 'bg-status-critical/70' : 'bg-surface-4',
            playing && i === pos && 'bg-primary',
          )}
          style={{ height: `${Math.max(6, b.v * 100)}%` }}
        />
      ))}
    </div>
  )
}

function ClassificationBlock({ detection: d }: { detection: Detection }) {
  const ranked = useMemo(() => {
    const others = ['vehicle', 'wild_boar', 'human'].filter((c) => c !== d.cls).slice(0, 2)
    const remainder = 100 - d.confidence
    return [
      { cls: d.cls, pct: d.confidence },
      { cls: others[0], pct: Math.round(remainder * 0.62) },
      { cls: others[1], pct: remainder - Math.round(remainder * 0.62) },
    ]
  }, [d])

  const [showWhy, setShowWhy] = useState(false)

  return (
    <div>
      <ul className="space-y-2">
        {ranked.map((r, i) => (
          <li key={r.cls} className="flex items-center gap-md">
            <span className={cn('w-36 text-sm', i === 0 ? 'font-semibold text-fg' : 'text-fg-muted')}>
              {classLabel(r.cls as Detection['cls'])}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-1">
              <span
                className={cn('block h-full rounded-full', i === 0 ? 'bg-primary' : 'bg-surface-4')}
                style={{ width: `${r.pct}%` }}
              />
            </span>
            <span className="w-10 text-right font-mono text-xs tabular-nums text-fg-secondary">
              {r.pct}%
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-md flex flex-wrap items-center gap-sm">
        <ConfidenceBar value={d.confidence} showValue={false} />
        <button
          type="button"
          onClick={() => setShowWhy((s) => !s)}
          aria-expanded={showWhy}
          className="cursor-pointer text-xs text-accent-text hover:underline"
        >
          Why this classification?
        </button>
        {/* A human override is recorded as a decision distinct from the model's */}
        <Button size="sm" variant="ghost" className="ml-auto">
          Reclassify
        </Button>
      </div>

      {showWhy && (
        <div className="mt-sm rounded-lg border border-border bg-surface-1 p-md text-xs text-fg-secondary">
          <p className="mb-1.5 font-semibold text-fg">Top contributing features</p>
          <ul className="space-y-1 font-mono">
            <li>· spectral peak 180–320 Hz sustained &gt; 1.2 s</li>
            <li>· onset sharpness above ambient baseline by 18 dB</li>
            <li>· inter-pulse interval consistent with class prior</li>
            <li>· node history: {d.nodeId} has 12 confirmed events of this class</li>
          </ul>
          <p className="mt-2 text-fg-muted">
            Reported by model {d.modelVersion}. Feature attributions are indicative, not a formal
            explanation of the network.
          </p>
        </div>
      )}
    </div>
  )
}

function ResponseBlock({ detection: d, team }: { detection: Detection; team: TeamMember[] }) {
  const assigned = team.find((t) => t.id === d.assignedTo)
  const candidates = team.filter((t) => t.role === 'Ranger').slice(0, 3)

  if (!assigned) {
    return (
      <div>
        <p className="text-sm text-fg-muted">No ranger assigned.</p>
        <h3 className="mt-md mb-sm text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Nearest available
        </h3>
        <ul className="space-y-1.5">
          {candidates.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-1 p-2.5">
              <Avatar initials={c.initials} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">{c.name}</div>
                <div className="font-mono text-[11px] text-fg-muted">
                  {c.sectors.join(', ')} · ETA {4 + i * 3} min
                </div>
              </div>
              <Button size="sm" variant="subtle">
                Dispatch
              </Button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Avatar initials={assigned.initials} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{assigned.name}</div>
          <div className="font-mono text-[11px] text-fg-muted">
            {assigned.role} · {assigned.sectors.join(', ') || '—'} · last ping{' '}
            {relativeAge(assigned.lastPing)} ago
          </div>
        </div>
        <Chip tone={assigned.status === 'responding' ? 'warning' : 'ok'}>{assigned.status}</Chip>
      </div>

      <dl className="mt-md grid grid-cols-2 gap-md">
        <div className="rounded-lg border border-border bg-surface-1 p-2.5">
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">ETA</dt>
          <dd className="font-mono text-lg tabular-nums text-fg">6 min</dd>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 p-2.5">
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">Distance</dt>
          <dd className="font-mono text-lg tabular-nums text-fg">1.8 km</dd>
        </div>
      </dl>

      <div className="mt-md flex gap-sm">
        <Button size="sm" variant="subtle" className="flex-1">
          Reassign
        </Button>
        <Button size="sm" variant="subtle" className="flex-1">
          Message
        </Button>
      </div>

      {d.responseSeconds != null && (
        <p className="mt-md text-xs text-fg-muted">
          Response time recorded: <span className="font-mono text-fg">{duration(d.responseSeconds)}</span>
        </p>
      )}
    </div>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 font-mono text-xs font-semibold text-fg-secondary">
      {initials}
    </span>
  )
}

const KIND_STYLE: Record<TimelineEntry['kind'], { dot: string; label: string }> = {
  system: { dot: 'bg-status-info', label: 'System' },
  model: { dot: 'bg-cat-5', label: 'Model' },
  human: { dot: 'bg-status-ok', label: 'Person' },
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-4 pl-5" aria-live="polite">
      <span className="absolute left-[5px] top-1.5 h-[calc(100%-12px)] w-0.5 bg-border" aria-hidden="true" />
      {entries.map((e, i) => (
        <li key={`${e.ts}-${i}`} className="relative">
          <span
            className={cn('absolute -left-5 top-1.5 h-3 w-3 rounded-full ring-2 ring-surface-2', KIND_STYLE[e.kind].dot)}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-baseline gap-2">
            <time
              dateTime={new Date(e.ts).toISOString()}
              className="font-mono text-xs tabular-nums text-fg-muted"
            >
              {absoluteTime(e.ts)}
            </time>
            <span className="text-sm font-medium text-fg">{e.action}</span>
            {/* Model actions are visually distinct from human decisions */}
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px]',
                e.kind === 'model'
                  ? 'bg-cat-5/15 text-cat-5'
                  : e.kind === 'system'
                    ? 'bg-surface-3 text-fg-muted'
                    : 'bg-[color:var(--status-ok-fill)] text-status-ok',
              )}
            >
              {e.actor}
            </span>
          </div>
          {e.note && <p className="mt-0.5 text-xs text-fg-secondary">{e.note}</p>}
        </li>
      ))}
    </ol>
  )
}

function ResolveModal({
  open,
  onClose,
  onResolve,
}: {
  open: boolean
  onClose: () => void
  onResolve: (outcome: string) => void
}) {
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark incident resolved"
      description="An outcome is required. False-positive outcomes feed the model retraining queue."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!outcome} onClick={() => onResolve(outcome)}>
            Resolve incident
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-sm text-sm font-medium text-fg-secondary">Outcome</legend>
        <div className="space-y-1.5">
          {OUTCOMES.map((o) => (
            <label
              key={o.id}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-base',
                outcome === o.id
                  ? 'border-primary bg-[color:var(--status-watch-fill)] text-fg'
                  : 'border-border bg-surface-2 text-fg-secondary hover:bg-surface-3',
              )}
            >
              <input
                type="radio"
                name="outcome"
                value={o.id}
                checked={outcome === o.id}
                onChange={() => setOutcome(o.id)}
                className="h-4 w-4 accent-[color:var(--color-primary)]"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="resolve-note" className="mt-md block text-sm font-medium text-fg-secondary">
        Notes (optional)
      </label>
      <textarea
        id="resolve-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="input mt-1.5 resize-y text-sm"
      />
    </Modal>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-fg-muted">{k}</dt>
      <dd className="text-fg-secondary">{v}</dd>
    </div>
  )
}

function hashPrefix(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return Math.abs(h).toString(16).padStart(8, '0').slice(0, 12)
}
