/**
 * DataProvider — the seam between the UI and whatever actually supplies data.
 *
 * Every page component depends on THIS interface and never on MockProvider.
 * Swapping the demo layer for a real ingest is a one-line change in
 * src/data/DataContext.tsx, provided the new class satisfies this contract.
 *
 * The intended production implementation is documented at the top of
 * MockProvider.ts (Firebase Realtime DB / MQTT bridge fed by ESP32-CAM nodes).
 */

import type {
  AnalyticsQuery,
  AnalyticsResult,
  DashboardKpis,
  DeliveryChannel,
  DeliveryLogEntry,
  Detection,
  EscalationRule,
  FieldNode,
  FleetHistoryPoint,
  FleetSummary,
  Geofence,
  IncidentStatus,
  LiveStatus,
  Sector,
  TeamMember,
  TelemetryPoint,
} from './types'

export interface AlertQuery {
  severity?: string[]
  cls?: string[]
  sector?: string[]
  status?: string[]
  minConfidence?: number
  search?: string
  limit?: number
  cursor?: number
}

export interface DeviceQuery {
  status?: string[]
  type?: string[]
  sector?: string[]
  tier?: string[]
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  limit?: number
  cursor?: number
}

export interface Page<T> {
  items: T[]
  total: number
  nextCursor: number | null
  /** Set when the request succeeded but a subsystem did not answer — drives the
   *  `partial` data state rather than a silent shortfall (README §13). */
  partial?: { failed: string[]; message: string }
}

export type Unsubscribe = () => void

export interface ProviderStatus {
  live: LiveStatus
  lastFrameAt: number
  online: boolean
  /** Human-readable name of the backing source, shown in the DEMO badge. */
  sourceLabel: string
  isDemo: boolean
}

export interface DataProvider {
  readonly name: string
  readonly isDemo: boolean

  /* --- devices ---------------------------------------------------------- */
  getDevices(query?: DeviceQuery): Promise<Page<FieldNode>>
  getDevice(id: string): Promise<FieldNode | null>
  getDeviceTelemetry(id: string, rangeHours: number): Promise<TelemetryPoint[]>
  pingDevice(id: string): Promise<{ ok: boolean; latencyMs: number | null }>
  getFleetSummary(): Promise<FleetSummary>
  /** Hourly online/degraded/offline counts, for the dashboard sparkline. */
  getFleetHistory(hours: number): Promise<FleetHistoryPoint[]>

  /* --- alerts / incidents ----------------------------------------------- */
  getAlerts(query?: AlertQuery): Promise<Page<Detection>>
  getIncident(id: string): Promise<Detection | null>
  acknowledgeAlert(id: string, actorId: string): Promise<Detection>
  dispatchAlert(id: string, rangerId: string): Promise<Detection>
  resolveIncident(id: string, outcome: string, note?: string): Promise<Detection>
  getRelatedAlerts(id: string): Promise<Detection[]>

  /* --- live streams ------------------------------------------------------ */
  /** New detections as they arrive. Returns an unsubscribe handle. */
  subscribeDetections(handler: (d: Detection) => void): Unsubscribe
  /** Connection/freshness changes for the LiveBadge. */
  subscribeStatus(handler: (s: ProviderStatus) => void): Unsubscribe
  /** 15-second SOS takeover events (see SosProvider). */
  subscribeSos(handler: (d: Detection) => void): Unsubscribe
  getStatus(): ProviderStatus

  /* --- dashboard --------------------------------------------------------- */
  getDashboardKpis(): Promise<DashboardKpis>

  /* --- geography --------------------------------------------------------- */
  getSectors(): Promise<Sector[]>
  getGeofences(): Promise<Geofence[]>

  /* --- team -------------------------------------------------------------- */
  getTeam(): Promise<TeamMember[]>
  getOnShift(): Promise<TeamMember[]>

  /* --- notifications ----------------------------------------------------- */
  getRules(): Promise<EscalationRule[]>
  toggleRule(id: string, enabled: boolean): Promise<EscalationRule>
  getChannels(): Promise<DeliveryChannel[]>
  getDeliveryLog(limit?: number): Promise<Page<DeliveryLogEntry>>
  sendTestAlert(ruleId: string): Promise<DeliveryLogEntry[]>

  /* --- analytics --------------------------------------------------------- */
  getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult>

  /* --- lifecycle --------------------------------------------------------- */
  start(): void
  stop(): void
}
