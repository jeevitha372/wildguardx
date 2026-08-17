/**
 * Domain types for WildGuardX.
 *
 * These describe the SHAPE OF REAL DATA, independent of where it comes from.
 * MockProvider satisfies them today; a Firebase/MQTT provider must satisfy the
 * same types tomorrow without any page component changing.
 */

export type Tier = 'T1' | 'T2'

export type NodeType = 'acoustic' | 'camera' | 'thermal' | 'gateway'

export type NodeStatus = 'online' | 'degraded' | 'offline'

export type Severity = 'critical' | 'warning' | 'watch' | 'info'

export type DetectionClass =
  | 'elephant'
  | 'tiger'
  | 'leopard'
  | 'wild_boar'
  | 'human'
  | 'vehicle'
  | 'gunshot'
  | 'chainsaw'

export type IncidentStatus =
  | 'active'
  | 'acknowledged'
  | 'dispatched'
  | 'resolved'
  | 'false_positive'

export type MemberStatus =
  | 'online'
  | 'available'
  | 'responding'
  | 'off_duty'
  | 'off_grid'

export type MemberRole =
  | 'Admin'
  | 'Manager'
  | 'Operator'
  | 'Ranger'
  | 'Technician'
  | 'Viewer'

/** ESP32 field node. */
export interface FieldNode {
  id: string
  label: string
  tier: Tier
  zone: string
  type: NodeType
  hardware: string
  sector: string
  lat: number
  lng: number
  status: NodeStatus
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
  /** Resolved to an absolute epoch by the provider. */
  lastSeen: number
  installedAt: number
  falsePositiveRate: number
  detections30d: number
}

export interface Detection {
  id: string
  incidentId: string
  nodeId: string
  cls: DetectionClass
  severity: Severity
  confidence: number
  /** Epoch ms. */
  ts: number
  hourOfDay: number
  sector: string
  tier: Tier
  zone: string
  lat: number
  lng: number
  status: IncidentStatus
  assignedTo: string | null
  acknowledgedBy: string | null
  ackAfterSeconds: number | null
  responseSeconds: number | null
  outcome: string | null
  sos: boolean
  evidence: { audio: boolean; image: boolean; thermal: boolean }
  modelVersion: string
  /** True when produced by the demo simulator rather than the seeded fixture. */
  simulated?: boolean
}

export interface TeamMember {
  id: string
  name: string
  initials: string
  role: MemberRole
  sectors: string[]
  status: MemberStatus
  phoneMasked: string
  radioChannel: string
  joinedAt: number
  onShift: boolean
  shift: string
  lastPing: number
}

export interface Sector {
  id: string
  name: string
  tier: Tier
}

export interface Geofence {
  id: string
  name: string
  type: 'core' | 'buffer' | 'corridor' | 'exclusion'
  tier: Tier
  color: 'ok' | 'warning' | 'info' | 'critical'
  polygon: [number, number][]
}

export interface TelemetryPoint {
  ts: number
  battery: number
  solarW: number
  rssi: number
  tempC: number
  detections: number
}

export interface RuleCondition {
  field: string
  op: string
  value: string | number
}

export interface RuleAction {
  action: string
  recipients?: string
  channels?: string[]
  severity?: string
  device?: string
  durationSeconds?: number
}

export interface EscalationStep {
  afterMinutes: number
  tier: string
  channels: string[]
}

export interface EscalationRule {
  id: string
  name: string
  enabled: boolean
  order: number
  when: RuleCondition[]
  join: 'AND' | 'OR'
  then: RuleAction[]
  escalate: EscalationStep[]
  firedCount30d: number
  lastFiredMinutesAgo: number | null
  deliveryRate: number
}

export interface DeliveryChannel {
  id: string
  name: string
  provider: string
  status: 'connected' | 'degraded' | 'disconnected'
  deliveryRate: number
  medianLatencyMs: number
  costPerMessage: number
  lastError?: string
}

export interface DeliveryLogEntry {
  id: string
  ts: number
  ruleId: string
  ruleName: string
  detectionId: string
  recipient: string
  channel: string
  status: 'delivered' | 'failed' | 'pending' | 'suppressed'
  /** Required on `suppressed` — a suppression that cannot be explained is
   *  indistinguishable from a bug (notifications.md §3.5). */
  reason?: string
  latencyMs: number | null
  isTest: boolean
}

export interface FleetSummary {
  total: number
  online: number
  degraded: number
  offline: number
  lowBattery: number
  tier1: number
  tier2: number
}

export interface FleetHistoryPoint {
  ts: number
  online: number
  degraded: number
  offline: number
}

export interface DashboardKpis {
  activeAlerts: number
  criticalAlerts: number
  warningAlerts: number
  sensorsOnline: number
  sensorsTotal: number
  medianResponseSeconds: number
  responseDeltaSeconds: number
  perimeterSecure: boolean
  breaches24h: number
}

/** Connection health for the LiveBadge (README §6). */
export type LiveStatus = 'live' | 'delayed' | 'reconnecting' | 'stale'

export interface AnalyticsQuery {
  fromDays: number
  sector?: string | null
  cls?: DetectionClass | null
}

export interface AnalyticsResult {
  totalDetections: number
  confirmedThreats: number
  falsePositiveRate: number
  medianResponseSeconds: number
  deltas: {
    totalDetections: number
    confirmedThreats: number
    falsePositiveRate: number
    medianResponseSeconds: number
  }
  overTime: { date: string; [cls: string]: number | string }[]
  byHour: { day: number; hour: number; count: number }[]
  funnel: { stage: string; count: number; medianSeconds: number }[]
  bySector: {
    sector: string
    name: string
    detections: number
    confirmed: number
    falsePositiveRate: number
    medianResponseSeconds: number
    nodes: number
    uptime: number
  }[]
  modelPerf: { cls: string; precision: number; recall: number; f1: number; samples: number }[]
  /** Detections with no node inside 2 km — analytics.md §3.4 coverage gaps. */
  coverageGaps: { lat: number; lng: number; count: number }[]
}
