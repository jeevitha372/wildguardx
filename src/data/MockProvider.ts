/* ===========================================================================
 * MockProvider — PLACEHOLDER DATA LAYER. THIS IS NOT REAL TELEMETRY.
 * ===========================================================================
 *
 * Everything this class returns is generated from seeded fixtures in
 * ./fixtures/ plus a timer that fabricates new detections. No field hardware
 * is involved, no network call leaves the browser, and no number here has been
 * measured anywhere.
 *
 * It exists so the UI can be built, reviewed, and demonstrated before the
 * ingest pipeline lands. It is a stand-in for:
 *
 *   ESP32-CAM / ESP32-S3 field nodes
 *        -> LoRaWAN uplink to a gateway node
 *        -> MQTT topic  wildguardx/<site>/<nodeId>/detections
 *        -> ingest worker (classification + geofence evaluation)
 *        -> Firebase Realtime Database / Firestore
 *        -> this app, via a FirebaseProvider implementing DataProvider
 *
 * The real implementation must satisfy the same `DataProvider` interface in
 * ./DataProvider.ts. When it does, swap the single `new MockProvider()` call in
 * ./DataContext.tsx for `new FirebaseProvider(...)` and delete this file. No
 * page or component should need to change — none of them import this module.
 *
 * Until then the app shows a "DEMO DATA" badge in the shell so nobody mistakes
 * a fabricated intrusion for a real one.
 * =========================================================================== */

import type {
  AlertQuery,
  DataProvider,
  DeviceQuery,
  Page,
  ProviderStatus,
  Unsubscribe,
} from './DataProvider'
import type {
  AnalyticsQuery,
  AnalyticsResult,
  DashboardKpis,
  DeliveryChannel,
  DeliveryLogEntry,
  Detection,
  DetectionClass,
  EscalationRule,
  FieldNode,
  FleetHistoryPoint,
  FleetSummary,
  Geofence,
  NodeStatus,
  Sector,
  Severity,
  TeamMember,
  TelemetryPoint,
} from './types'
import {
  DEFAULT_SIMULATOR_CONFIG,
  resolveSimulatorConfig,
  type SimulatorConfig,
} from './simulatorConfig'

import rawNodes from './fixtures/nodes.json'
import rawDetections from './fixtures/detections.json'
import rawTeam from './fixtures/team.json'
import rawSectors from './fixtures/sectors.json'
import rawGeofences from './fixtures/geofences.json'
import rawRules from './fixtures/rules.json'
import rawChannels from './fixtures/channels.json'

/* --- deterministic PRNG (same algorithm as the fixture generator) ---------- */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MIN = 60_000
const DAY = 24 * 60 * MIN

interface RawNode {
  id: string
  label: string
  tier: string
  zone: string
  type: string
  hardware: string
  sector: string
  lat: number
  lng: number
  status: string
  battery: number
  solarInputW: number
  charging: boolean
  rssi: number
  snr: number
  firmware: string
  deepSleepMins: number
  wakeIntervalMins: number
  enclosureTempC: number | null
  uptime30d: number
  lastSeenMinutesAgo: number
  installedDaysAgo: number
  falsePositiveRate: number
  detections30d: number
}

interface RawDetection {
  id: string
  incidentId: string
  nodeId: string
  cls: string
  severity: string
  confidence: number
  minutesAgo: number
  hourOfDay: number
  sector: string
  tier: string
  zone: string
  lat: number
  lng: number
  status: string
  assignedTo: string | null
  acknowledgedBy: string | null
  ackAfterSeconds: number | null
  responseSeconds: number | null
  outcome: string | null
  sos: boolean
  evidence: { audio: boolean; image: boolean; thermal: boolean }
  modelVersion: string
}

interface RawMember {
  id: string
  name: string
  initials: string
  role: string
  sectors: string[]
  status: string
  phoneMasked: string
  radioChannel: string
  joinedDaysAgo: number
  onShift: boolean
  shift: string
  lastPingMinutesAgo: number
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

const SEVERITIES: Severity[] = ['critical', 'warning', 'watch', 'info']

/** Which classes can plausibly produce each severity, for the simulator. */
const CLASSES_BY_SEVERITY: Record<Severity, DetectionClass[]> = {
  critical: ['gunshot', 'chainsaw', 'elephant', 'tiger', 'human'],
  warning: ['elephant', 'tiger', 'leopard', 'human', 'vehicle'],
  watch: ['wild_boar', 'vehicle', 'leopard'],
  info: ['wild_boar', 'vehicle'],
}

export class MockProvider implements DataProvider {
  readonly name = 'MockProvider (demo fixtures)'
  readonly isDemo = true

  readonly config: SimulatorConfig

  private nodes: FieldNode[] = []
  private detections: Detection[] = []
  private team: TeamMember[] = []
  private sectors: Sector[] = []
  private geofences: Geofence[] = []
  private rules: EscalationRule[] = []
  private channels: DeliveryChannel[] = []
  private deliveryLog: DeliveryLogEntry[] = []

  private detectionHandlers = new Set<(d: Detection) => void>()
  private statusHandlers = new Set<(s: ProviderStatus) => void>()
  private sosHandlers = new Set<(d: Detection) => void>()

  private timer: ReturnType<typeof setInterval> | null = null
  private statusTimer: ReturnType<typeof setInterval> | null = null
  private rnd: () => number
  private seq = 0
  private lastFrameAt = Date.now()
  private running = false
  private onlineFlag = true

  constructor(props: Partial<SimulatorConfig> = {}) {
    this.config = resolveSimulatorConfig(props)
    this.rnd = mulberry32(this.config.seed)
    this.hydrate()
  }

  /* ======================================================================
   * Hydration — fixtures store relative offsets; resolve them to real dates
   * so the demo never looks stale (see scripts/gen-fixtures.mjs header).
   * ==================================================================== */
  private hydrate() {
    const now = Date.now()

    this.nodes = (rawNodes as unknown as RawNode[]).map((n) => ({
      ...n,
      tier: n.tier as FieldNode['tier'],
      type: n.type as FieldNode['type'],
      status: n.status as NodeStatus,
      lastSeen: now - n.lastSeenMinutesAgo * MIN,
      installedAt: now - n.installedDaysAgo * DAY,
    })) as FieldNode[]

    this.applyHealthOverrides()

    const nodeById = new Map(this.nodes.map((n) => [n.id, n]))

    this.detections = (rawDetections as unknown as RawDetection[]).map((d) => ({
      ...d,
      cls: d.cls as DetectionClass,
      severity: d.severity as Severity,
      tier: d.tier as Detection['tier'],
      status: d.status as Detection['status'],
      ts: now - d.minutesAgo * MIN,
    })) as Detection[]

    this.team = (rawTeam as unknown as RawMember[]).map((m) => ({
      ...m,
      role: m.role as TeamMember['role'],
      status: m.status as TeamMember['status'],
      joinedAt: now - m.joinedDaysAgo * DAY,
      lastPing: now - m.lastPingMinutesAgo * MIN,
    })) as TeamMember[]

    this.sectors = rawSectors as unknown as Sector[]
    this.geofences = rawGeofences as unknown as Geofence[]
    this.rules = rawRules as unknown as EscalationRule[]
    this.channels = rawChannels as unknown as DeliveryChannel[]
    this.deliveryLog = this.seedDeliveryLog(nodeById)
  }

  /**
   * Force exactly `offlineNodes` / `degradedNodes` into those states, so the
   * demo-tuning knobs actually change what an operator sees rather than being
   * decorative config.
   */
  private applyHealthOverrides() {
    const { offlineNodes, degradedNodes } = this.config
    const pick = mulberry32(this.config.seed ^ 0x5f5f)
    const order = [...this.nodes].sort(() => pick() - 0.5)

    for (const n of order) {
      n.status = 'online'
      if (n.battery === 0) n.battery = 40 + Math.floor(pick() * 55)
      if (n.rssi === -999) n.rssi = -62 - Math.floor(pick() * 50)
    }
    for (let i = 0; i < Math.min(offlineNodes, order.length); i++) {
      const n = order[i]
      n.status = 'offline'
      n.battery = 0
      n.rssi = -999
      n.solarInputW = 0
      n.charging = false
      n.enclosureTempC = null
      n.lastSeen = Date.now() - (190 + Math.floor(pick() * 2700)) * MIN
    }
    for (let i = offlineNodes; i < Math.min(offlineNodes + degradedNodes, order.length); i++) {
      const n = order[i]
      n.status = 'degraded'
      n.battery = 8 + Math.floor(pick() * 26)
      n.rssi = -104 - Math.floor(pick() * 14)
      n.lastSeen = Date.now() - (6 + Math.floor(pick() * 50)) * MIN
    }
  }

  private seedDeliveryLog(nodeById: Map<string, FieldNode>): DeliveryLogEntry[] {
    const out: DeliveryLogEntry[] = []
    const recent = [...(rawDetections as unknown as RawDetection[])]
      .sort((a, b) => a.minutesAgo - b.minutesAgo)
      .slice(0, 60)
    const now = Date.now()
    let i = 0
    for (const d of recent) {
      const rule = this.rules.find((r) =>
        r.when.some((c) => c.field === 'class' && c.value === d.cls),
      )
      if (!rule) continue
      for (const ch of ['push', 'sms']) {
        i += 1
        const roll = this.rnd()
        const status: DeliveryLogEntry['status'] =
          roll > 0.94 ? 'failed' : roll > 0.88 ? 'suppressed' : 'delivered'
        out.push({
          id: `DLV-${8000 + i}`,
          ts: now - d.minutesAgo * MIN + 1500,
          ruleId: rule.id,
          ruleName: rule.name,
          detectionId: d.id,
          recipient:
            this.team[Math.floor(this.rnd() * this.team.length)]?.name ?? 'Sector on-call',
          channel: ch,
          status,
          reason:
            status === 'suppressed'
              ? ['quiet hours', 'duplicate within 5m', 'recipient off duty'][
                  Math.floor(this.rnd() * 3)
                ]
              : status === 'failed'
                ? 'GATEWAY_TIMEOUT: no ack from provider'
                : undefined,
          latencyMs: status === 'delivered' ? 600 + Math.floor(this.rnd() * 4200) : null,
          isTest: false,
        })
      }
      if (!nodeById.has(d.nodeId)) continue
    }
    return out.sort((a, b) => b.ts - a.ts)
  }

  /* ======================================================================
   * Lifecycle + live simulation
   * ==================================================================== */
  start() {
    if (this.running) return
    this.running = true
    this.lastFrameAt = Date.now()

    this.timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        // Keep the "socket" alive but do not render into a hidden tab; the
        // real provider must not drop criticals just because the tab is hidden.
        this.lastFrameAt = Date.now()
        return
      }
      const d = this.generateDetection()
      this.detections.unshift(d)
      this.lastFrameAt = Date.now()
      this.detectionHandlers.forEach((h) => h(d))
      if (d.sos) this.sosHandlers.forEach((h) => h(d))
      this.emitStatus()
    }, this.config.intervalMs)

    this.statusTimer = setInterval(() => this.emitStatus(), 5_000)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
      this.onlineFlag = window.navigator.onLine
    }
    this.emitStatus()
  }

  stop() {
    this.running = false
    if (this.timer) clearInterval(this.timer)
    if (this.statusTimer) clearInterval(this.statusTimer)
    this.timer = null
    this.statusTimer = null
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  private handleOnline = () => {
    this.onlineFlag = true
    this.lastFrameAt = Date.now()
    this.emitStatus()
  }

  private handleOffline = () => {
    this.onlineFlag = false
    this.emitStatus()
  }

  private weightedSeverity(): Severity {
    const mix = this.config.severityMix
    let r = this.rnd()
    for (const s of SEVERITIES) {
      r -= mix[s] ?? 0
      if (r <= 0) return s
    }
    return 'watch'
  }

  private generateDetection(): Detection {
    this.seq += 1
    const severity = this.weightedSeverity()
    const candidates = CLASSES_BY_SEVERITY[severity]
    const cls = candidates[Math.floor(this.rnd() * candidates.length)]

    // Criticals are biased toward the Tier-2 village perimeter, where
    // human-wildlife conflict actually occurs.
    const wantTier = severity === 'critical' && this.rnd() < 0.7 ? 'T2' : this.rnd() < 0.5 ? 'T1' : 'T2'
    const pool = this.nodes.filter((n) => n.status !== 'offline' && n.tier === wantTier)
    const node = pool[Math.floor(this.rnd() * pool.length)] ?? this.nodes[0]

    const now = Date.now()
    const confidence =
      severity === 'critical'
        ? 78 + Math.floor(this.rnd() * 22)
        : severity === 'warning'
          ? 66 + Math.floor(this.rnd() * 30)
          : 52 + Math.floor(this.rnd() * 36)

    const sos = severity === 'critical' && this.rnd() < this.config.sosChance

    return {
      id: `DET-SIM-${this.seq}`,
      incidentId: `INC-SIM-${this.seq}`,
      nodeId: node.id,
      cls,
      severity,
      confidence,
      ts: now,
      hourOfDay: new Date(now).getHours(),
      sector: node.sector,
      tier: node.tier,
      zone: node.zone,
      lat: +(node.lat + (this.rnd() - 0.5) * 0.006).toFixed(5),
      lng: +(node.lng + (this.rnd() - 0.5) * 0.006).toFixed(5),
      status: 'active',
      assignedTo: null,
      acknowledgedBy: null,
      ackAfterSeconds: null,
      responseSeconds: null,
      outcome: null,
      sos,
      evidence: {
        audio: node.type === 'acoustic',
        image: node.type === 'camera',
        thermal: node.type === 'thermal',
      },
      modelVersion: 'v2.4',
      simulated: true,
    }
  }

  private emitStatus() {
    const s = this.getStatus()
    this.statusHandlers.forEach((h) => h(s))
  }

  getStatus(): ProviderStatus {
    const age = Date.now() - this.lastFrameAt
    const cadence = this.config.intervalMs
    let live: ProviderStatus['live'] = 'live'
    if (!this.onlineFlag) live = 'reconnecting'
    else if (age > cadence * 5) live = 'stale'
    else if (age > cadence * 3) live = 'delayed'

    return {
      live,
      lastFrameAt: this.lastFrameAt,
      online: this.onlineFlag,
      sourceLabel: 'Seeded fixtures + timer simulator',
      isDemo: true,
    }
  }

  /* ======================================================================
   * Subscriptions
   * ==================================================================== */
  subscribeDetections(handler: (d: Detection) => void): Unsubscribe {
    this.detectionHandlers.add(handler)
    return () => this.detectionHandlers.delete(handler)
  }

  subscribeStatus(handler: (s: ProviderStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler)
    handler(this.getStatus())
    return () => this.statusHandlers.delete(handler)
  }

  subscribeSos(handler: (d: Detection) => void): Unsubscribe {
    this.sosHandlers.add(handler)
    return () => this.sosHandlers.delete(handler)
  }

  /** Manual SOS trigger, used by the demo control in the app shell. */
  triggerSos(): Detection {
    const d = this.generateDetection()
    d.severity = 'critical'
    d.cls = 'gunshot'
    d.sos = true
    d.confidence = 94
    this.detections.unshift(d)
    this.detectionHandlers.forEach((h) => h(d))
    this.sosHandlers.forEach((h) => h(d))
    return d
  }

  /* ======================================================================
   * Query surface
   * ==================================================================== */
  private delay<T>(value: T): Promise<T> {
    const ms = this.config.latencyMs
    if (ms <= 0) return Promise.resolve(value)
    return new Promise((resolve) => setTimeout(() => resolve(value), ms))
  }

  async getDevices(query: DeviceQuery = {}): Promise<Page<FieldNode>> {
    let list = [...this.nodes]
    if (query.status?.length) list = list.filter((n) => query.status!.includes(n.status))
    if (query.type?.length) list = list.filter((n) => query.type!.includes(n.type))
    if (query.sector?.length) list = list.filter((n) => query.sector!.includes(n.sector))
    if (query.tier?.length) list = list.filter((n) => query.tier!.includes(n.tier))
    if (query.search) {
      const q = query.search.toLowerCase()
      list = list.filter(
        (n) =>
          n.id.toLowerCase().includes(q) ||
          n.label.toLowerCase().includes(q) ||
          n.sector.toLowerCase().includes(q),
      )
    }

    const sortBy = query.sortBy ?? 'id'
    const dir = query.sortDir === 'desc' ? -1 : 1
    list.sort((a, b) => {
      const av = a[sortBy as keyof FieldNode]
      const bv = b[sortBy as keyof FieldNode]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })

    const cursor = query.cursor ?? 0
    const limit = query.limit ?? 50
    const slice = list.slice(cursor, cursor + limit)
    return this.delay({
      items: slice,
      total: list.length,
      nextCursor: cursor + limit < list.length ? cursor + limit : null,
    })
  }

  async getDevice(id: string): Promise<FieldNode | null> {
    return this.delay(this.nodes.find((n) => n.id === id) ?? null)
  }

  /**
   * Telemetry is synthesised per node rather than stored: 291 nodes x 90 days
   * of samples would be a multi-megabyte fixture for no added realism. Values
   * are deterministic per node id, so a given device always shows the same
   * history. Battery follows a solar duty cycle with a slow decline.
   */
  async getDeviceTelemetry(id: string, rangeHours: number): Promise<TelemetryPoint[]> {
    const node = this.nodes.find((n) => n.id === id)
    if (!node) return this.delay([])

    const seed = [...id].reduce((s, c) => s + c.charCodeAt(0), 0)
    const r = mulberry32(seed ^ this.config.seed)
    const points: TelemetryPoint[] = []
    const now = Date.now()
    const steps = Math.min(240, Math.max(24, rangeHours))
    const stepMs = (rangeHours * 60 * MIN) / steps

    let battery = Math.min(100, node.battery + rangeHours * 0.02)

    for (let i = steps; i >= 0; i--) {
      const ts = now - i * stepMs
      const hour = new Date(ts).getHours()
      const daylight = hour > 7 && hour < 17
      const solarW = daylight ? +(1.2 + r() * 4.2).toFixed(2) : 0

      battery += daylight ? 0.22 : -0.35
      battery = Math.max(0, Math.min(100, battery + (r() - 0.5) * 0.4))

      // A node that is currently offline goes flat, and the gap is real: the
      // chart must break the line rather than interpolate across silence.
      const offline = node.status === 'offline' && i < steps * 0.3

      points.push({
        ts,
        battery: offline ? 0 : +battery.toFixed(1),
        solarW: offline ? 0 : solarW,
        rssi: offline ? 0 : Math.round(node.rssi + (r() - 0.5) * 12),
        tempC: offline ? 0 : +(22 + (daylight ? 12 : 0) + r() * 6).toFixed(1),
        detections: r() > 0.86 ? Math.floor(r() * 3) + 1 : 0,
      })
    }
    return this.delay(points)
  }

  async pingDevice(id: string): Promise<{ ok: boolean; latencyMs: number | null }> {
    const node = this.nodes.find((n) => n.id === id)
    const ok = !!node && node.status !== 'offline'
    return new Promise((resolve) =>
      setTimeout(
        () => resolve({ ok, latencyMs: ok ? 120 + Math.floor(this.rnd() * 380) : null }),
        ok ? 700 : 2200,
      ),
    )
  }

  async getFleetSummary(): Promise<FleetSummary> {
    const online = this.nodes.filter((n) => n.status === 'online').length
    const degraded = this.nodes.filter((n) => n.status === 'degraded').length
    const offline = this.nodes.filter((n) => n.status === 'offline').length
    return this.delay({
      total: this.nodes.length,
      online,
      degraded,
      offline,
      lowBattery: this.nodes.filter((n) => n.status !== 'offline' && n.battery < 30).length,
      tier1: this.nodes.filter((n) => n.tier === 'T1').length,
      tier2: this.nodes.filter((n) => n.tier === 'T2').length,
    })
  }

  /**
   * Fleet history is synthesised, like per-device telemetry: the fixtures hold
   * a single current status per node, not a time series. Deterministic per
   * seed, and it converges on the CURRENT counts at the right-hand edge so the
   * sparkline agrees with the tile it sits under.
   */
  async getFleetHistory(hours: number): Promise<FleetHistoryPoint[]> {
    const r = mulberry32(this.config.seed ^ 0x9e37)
    const now = Date.now()
    const online = this.nodes.filter((n) => n.status === 'online').length
    const degraded = this.nodes.filter((n) => n.status === 'degraded').length
    const offline = this.nodes.filter((n) => n.status === 'offline').length

    const points: FleetHistoryPoint[] = []
    for (let i = hours; i >= 0; i--) {
      // Drift grows with distance from now, so the last point is exact.
      const drift = Math.round((r() - 0.4) * (i / 3))
      points.push({
        ts: now - i * 3600_000,
        online: Math.max(0, online - Math.max(0, drift)),
        degraded: Math.max(0, degraded + Math.max(0, Math.round(drift * 0.6))),
        offline: Math.max(0, offline + Math.max(0, Math.round(drift * 0.4))),
      })
    }
    return this.delay(points)
  }

  async getAlerts(query: AlertQuery = {}): Promise<Page<Detection>> {
    let list = [...this.detections]
    if (query.severity?.length) list = list.filter((d) => query.severity!.includes(d.severity))
    if (query.cls?.length) list = list.filter((d) => query.cls!.includes(d.cls))
    if (query.sector?.length) list = list.filter((d) => query.sector!.includes(d.sector))
    if (query.status?.length) list = list.filter((d) => query.status!.includes(d.status))
    if (query.minConfidence != null)
      list = list.filter((d) => d.confidence >= query.minConfidence!)
    if (query.search) {
      const q = query.search.toLowerCase()
      list = list.filter(
        (d) =>
          d.id.toLowerCase().includes(q) ||
          d.incidentId.toLowerCase().includes(q) ||
          d.nodeId.toLowerCase().includes(q) ||
          d.sector.toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => b.ts - a.ts)

    const cursor = query.cursor ?? 0
    const limit = query.limit ?? 50
    return this.delay({
      items: list.slice(cursor, cursor + limit),
      total: list.length,
      nextCursor: cursor + limit < list.length ? cursor + limit : null,
    })
  }

  async getIncident(id: string): Promise<Detection | null> {
    return this.delay(
      this.detections.find((d) => d.incidentId === id || d.id === id) ?? null,
    )
  }

  async getRelatedAlerts(id: string): Promise<Detection[]> {
    const base = this.detections.find((d) => d.incidentId === id || d.id === id)
    if (!base) return this.delay([])
    const within = this.detections.filter(
      (d) =>
        d.id !== base.id &&
        Math.abs(d.ts - base.ts) < 30 * MIN &&
        distanceKm(d.lat, d.lng, base.lat, base.lng) < 0.5,
    )
    return this.delay(within.slice(0, 5))
  }

  private mutate(id: string, patch: Partial<Detection>): Detection {
    const idx = this.detections.findIndex((d) => d.incidentId === id || d.id === id)
    if (idx === -1) throw new Error(`Incident ${id} not found`)
    const next = { ...this.detections[idx], ...patch }
    this.detections[idx] = next
    return next
  }

  async acknowledgeAlert(id: string, actorId: string): Promise<Detection> {
    return this.delay(
      this.mutate(id, {
        status: 'acknowledged',
        acknowledgedBy: actorId,
        ackAfterSeconds: 30,
      }),
    )
  }

  async dispatchAlert(id: string, rangerId: string): Promise<Detection> {
    return this.delay(this.mutate(id, { status: 'dispatched', assignedTo: rangerId }))
  }

  async resolveIncident(id: string, outcome: string): Promise<Detection> {
    const status = outcome.startsWith('false_positive') ? 'false_positive' : 'resolved'
    return this.delay(this.mutate(id, { status, outcome, responseSeconds: 240 }))
  }

  async getDashboardKpis(): Promise<DashboardKpis> {
    const open = this.detections.filter(
      (d) => d.status === 'active' || d.status === 'acknowledged',
    )
    const resolved = this.detections.filter((d) => d.responseSeconds != null)
    const times = resolved.map((d) => d.responseSeconds!).sort((a, b) => a - b)
    const median = times.length ? times[Math.floor(times.length / 2)] : 0
    const breaches = this.detections.filter(
      (d) => d.ts > Date.now() - DAY && d.severity === 'critical',
    ).length

    return this.delay({
      activeAlerts: open.length,
      criticalAlerts: open.filter((d) => d.severity === 'critical').length,
      warningAlerts: open.filter((d) => d.severity === 'warning').length,
      sensorsOnline: this.nodes.filter((n) => n.status === 'online').length,
      sensorsTotal: this.nodes.length,
      medianResponseSeconds: median,
      responseDeltaSeconds: -38,
      perimeterSecure: breaches === 0,
      breaches24h: breaches,
    })
  }

  async getSectors(): Promise<Sector[]> {
    return this.delay(this.sectors)
  }

  async getGeofences(): Promise<Geofence[]> {
    return this.delay(this.geofences)
  }

  async getTeam(): Promise<TeamMember[]> {
    return this.delay(this.team)
  }

  async getOnShift(): Promise<TeamMember[]> {
    return this.delay(this.team.filter((m) => m.onShift))
  }

  async getRules(): Promise<EscalationRule[]> {
    return this.delay([...this.rules].sort((a, b) => a.order - b.order))
  }

  async toggleRule(id: string, enabled: boolean): Promise<EscalationRule> {
    const rule = this.rules.find((r) => r.id === id)
    if (!rule) throw new Error(`Rule ${id} not found`)
    rule.enabled = enabled
    return this.delay(rule)
  }

  async getChannels(): Promise<DeliveryChannel[]> {
    return this.delay(this.channels)
  }

  async getDeliveryLog(limit = 80): Promise<Page<DeliveryLogEntry>> {
    return this.delay({
      items: this.deliveryLog.slice(0, limit),
      total: this.deliveryLog.length,
      nextCursor: null,
    })
  }

  async sendTestAlert(ruleId: string): Promise<DeliveryLogEntry[]> {
    const rule = this.rules.find((r) => r.id === ruleId)
    const now = Date.now()
    const channels = rule?.then.flatMap((a) => a.channels ?? []) ?? ['push']
    const entries: DeliveryLogEntry[] = channels.map((ch, i) => ({
      id: `DLV-TEST-${now}-${i}`,
      ts: now,
      ruleId,
      ruleName: rule?.name ?? 'Unknown rule',
      detectionId: 'DET-TEST',
      recipient: this.team[i % this.team.length]?.name ?? 'Sector on-call',
      channel: ch,
      status: ch === 'radio' ? 'failed' : 'delivered',
      reason: ch === 'radio' ? 'GATEWAY_TIMEOUT: no ack from repeater DMR-5' : undefined,
      latencyMs: ch === 'radio' ? null : 600 + Math.floor(this.rnd() * 3000),
      isTest: true,
    }))
    this.deliveryLog = [...entries, ...this.deliveryLog]
    return this.delay(entries)
  }

  /* ======================================================================
   * Analytics — aggregated client-side over the fixture set.
   * ==================================================================== */
  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const now = Date.now()
    const from = now - query.fromDays * DAY
    const prevFrom = from - query.fromDays * DAY

    const inRange = (d: Detection) =>
      d.ts >= from &&
      (!query.sector || d.sector === query.sector) &&
      (!query.cls || d.cls === query.cls)
    const inPrev = (d: Detection) =>
      d.ts >= prevFrom && d.ts < from && (!query.sector || d.sector === query.sector)

    const current = this.detections.filter(inRange)
    const previous = this.detections.filter(inPrev)

    const confirmed = current.filter(
      (d) => d.outcome?.startsWith('threat_confirmed') ?? false,
    ).length
    const fp = current.filter((d) => d.status === 'false_positive').length
    const fpRate = current.length ? (fp / current.length) * 100 : 0

    const times = current
      .filter((d) => d.responseSeconds != null)
      .map((d) => d.responseSeconds!)
      .sort((a, b) => a - b)
    const median = times.length ? times[Math.floor(times.length / 2)] : 0

    const prevTimes = previous
      .filter((d) => d.responseSeconds != null)
      .map((d) => d.responseSeconds!)
      .sort((a, b) => a - b)
    const prevMedian = prevTimes.length ? prevTimes[Math.floor(prevTimes.length / 2)] : median
    const prevFp = previous.length
      ? (previous.filter((d) => d.status === 'false_positive').length / previous.length) * 100
      : fpRate

    // --- over time, bucketed by day
    const buckets = new Map<string, Record<string, number>>()
    const bucketCount = Math.min(query.fromDays, 90)
    for (let i = bucketCount - 1; i >= 0; i--) {
      const day = new Date(now - i * DAY)
      buckets.set(dateKey(day), {})
    }
    for (const d of current) {
      const key = dateKey(new Date(d.ts))
      const bucket = buckets.get(key)
      if (bucket) bucket[d.cls] = (bucket[d.cls] ?? 0) + 1
    }
    const overTime = [...buckets.entries()].map(([date, counts]) => ({
      date,
      elephant: counts.elephant ?? 0,
      tiger: counts.tiger ?? 0,
      leopard: counts.leopard ?? 0,
      wild_boar: counts.wild_boar ?? 0,
      human: counts.human ?? 0,
      other: (counts.vehicle ?? 0) + (counts.gunshot ?? 0) + (counts.chainsaw ?? 0),
    }))

    // --- day x hour heatmap
    const grid = new Map<string, number>()
    for (const d of current) {
      const dt = new Date(d.ts)
      const key = `${dt.getDay()}-${dt.getHours()}`
      grid.set(key, (grid.get(key) ?? 0) + 1)
    }
    const byHour: AnalyticsResult['byHour'] = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        byHour.push({ day, hour, count: grid.get(`${day}-${hour}`) ?? 0 })
      }
    }

    // --- response funnel
    const alerted = current.length
    const acked = current.filter((d) => d.status !== 'active').length
    const dispatched = current.filter(
      (d) => d.status === 'dispatched' || d.status === 'resolved' || d.status === 'false_positive',
    ).length
    const onScene = current.filter((d) => d.responseSeconds != null).length
    const resolvedCount = current.filter(
      (d) => d.status === 'resolved' || d.status === 'false_positive',
    ).length

    const funnel = [
      { stage: 'Detected', count: current.length, medianSeconds: 0 },
      { stage: 'Alerted', count: alerted, medianSeconds: 3 },
      { stage: 'Acknowledged', count: acked, medianSeconds: 42 },
      { stage: 'Dispatched', count: dispatched, medianSeconds: 96 },
      { stage: 'On scene', count: onScene, medianSeconds: median },
      { stage: 'Resolved', count: resolvedCount, medianSeconds: median + 180 },
    ]

    // --- per sector
    const bySector = this.sectors.map((s) => {
      const items = current.filter((d) => d.sector === s.id)
      const sTimes = items
        .filter((d) => d.responseSeconds != null)
        .map((d) => d.responseSeconds!)
        .sort((a, b) => a - b)
      const nodes = this.nodes.filter((n) => n.sector === s.id)
      return {
        sector: s.id,
        name: s.name,
        detections: items.length,
        confirmed: items.filter((d) => d.outcome?.startsWith('threat_confirmed') ?? false).length,
        falsePositiveRate: items.length
          ? +((items.filter((d) => d.status === 'false_positive').length / items.length) * 100).toFixed(1)
          : 0,
        medianResponseSeconds: sTimes.length ? sTimes[Math.floor(sTimes.length / 2)] : 0,
        nodes: nodes.length,
        uptime: nodes.length
          ? +(nodes.reduce((sum, n) => sum + n.uptime30d, 0) / nodes.length).toFixed(2)
          : 0,
      }
    })

    // --- model performance. Below 30 labelled samples we report `n=`, not a
    //     precise-looking percentage (analytics.md §3.7).
    const classes: DetectionClass[] = ['elephant', 'tiger', 'leopard', 'wild_boar', 'human', 'gunshot']
    const modelPerf = classes.map((cls) => {
      const items = current.filter((d) => d.cls === cls && d.outcome)
      const tp = items.filter((d) => d.outcome!.startsWith('threat_confirmed')).length
      const fpc = items.filter((d) => d.outcome!.startsWith('false_positive')).length
      const precision = tp + fpc ? tp / (tp + fpc) : 0
      const recall = items.length ? tp / items.length : 0
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
      return {
        cls,
        precision: +(precision * 100).toFixed(1),
        recall: +(recall * 100).toFixed(1),
        f1: +(f1 * 100).toFixed(1),
        samples: items.length,
      }
    })

    // --- coverage gaps: detections with no node inside 2 km
    const coverageGaps = current
      .filter((d) => {
        const nearest = this.nodes.reduce(
          (min, n) => Math.min(min, distanceKm(d.lat, d.lng, n.lat, n.lng)),
          Infinity,
        )
        return nearest > 2
      })
      .map((d) => ({ lat: d.lat, lng: d.lng, count: 1 }))

    return this.delay({
      totalDetections: current.length,
      confirmedThreats: confirmed,
      falsePositiveRate: +fpRate.toFixed(1),
      medianResponseSeconds: median,
      deltas: {
        totalDetections: current.length - previous.length,
        confirmedThreats:
          confirmed - previous.filter((d) => d.outcome?.startsWith('threat_confirmed')).length,
        falsePositiveRate: +(fpRate - prevFp).toFixed(1),
        medianResponseSeconds: median - prevMedian,
      },
      overTime,
      byHour,
      funnel,
      bySector,
      modelPerf,
      coverageGaps,
    })
  }
}

/* --- helpers --------------------------------------------------------------- */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export { DEFAULT_SIMULATOR_CONFIG }
