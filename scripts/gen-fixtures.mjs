/**
 * Deterministic fixture generator for the WildGuardX DEMO data layer.
 *
 * Run: npm run gen:fixtures
 *
 * Writes seeded JSON into src/data/fixtures/. Everything is produced from a
 * fixed seed via mulberry32, so regenerating yields byte-identical output and
 * screenshots/tests stay stable.
 *
 * TIMESTAMPS: detections store `minutesAgo`, not an absolute date. MockProvider
 * converts that to a real timestamp against Date.now() at load. Absolute dates
 * baked into a fixture rot — a week after generation every alert would read
 * "7d ago" and the "live operations" story would be visibly dead.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../src/data/fixtures')
mkdirSync(OUT, { recursive: true })

const SEED = 20260817

/* --- deterministic PRNG --------------------------------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(SEED)
const rint = (min, max) => Math.floor(rnd() * (max - min + 1)) + min
const rfloat = (min, max, dp = 2) => +(rnd() * (max - min) + min).toFixed(dp)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
function weighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0)
  let r = rnd() * total
  for (const [value, w] of pairs) {
    r -= w
    if (r <= 0) return value
  }
  return pairs[pairs.length - 1][0]
}
const round = (n, dp) => +n.toFixed(dp)

/* --- geography ------------------------------------------------------------ *
 * Nilgiri Biosphere-adjacent coordinates. Tier-1 is the forest core; Tier-2 is
 * the village perimeter ring where human-wildlife conflict actually happens.  */
const CENTER = { lat: 11.4102, lng: 76.695 }
const KM_PER_DEG_LAT = 110.574
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180)

function offsetKm(lat, lng, dxKm, dyKm) {
  return {
    lat: round(lat + dyKm / KM_PER_DEG_LAT, 5),
    lng: round(lng + dxKm / kmPerDegLng(lat), 5),
  }
}

const SECTORS = [
  { id: 'S1', name: 'North Ridge', tier: 'T1' },
  { id: 'S2', name: 'Bamboo Valley', tier: 'T1' },
  { id: 'S3', name: 'Riverine Belt', tier: 'T1' },
  { id: 'S4', name: 'Eastern Slope', tier: 'T1' },
  { id: 'S5', name: 'Core Plateau', tier: 'T1' },
  { id: 'S6', name: 'Thengumarahada Fringe', tier: 'T2' },
  { id: 'S7', name: 'Masinagudi Perimeter', tier: 'T2' },
  { id: 'S8', name: 'Sigur Corridor', tier: 'T2' },
]

const T1_SECTORS = SECTORS.filter((s) => s.tier === 'T1').map((s) => s.id)
const T2_SECTORS = SECTORS.filter((s) => s.tier === 'T2').map((s) => s.id)

/* --- nodes: 291 ESP32 field units ----------------------------------------- */
const NODE_TOTAL = 291
const T1_COUNT = 186 // forest core
const T2_COUNT = NODE_TOTAL - T1_COUNT // 105 — village perimeter

const HARDWARE = {
  camera: 'ESP32-CAM (OV2640)',
  acoustic: 'ESP32-S3 + INMP441',
  thermal: 'ESP32-S3 + MLX90640',
  gateway: 'ESP32 LoRa Gateway (SX1276)',
}

const T1_PLACES = [
  'North Ridge', 'Bamboo Thicket', 'Salt Lick', 'Watering Hole', 'Elephant Trail',
  'Fire Line', 'Canopy Walk', 'Stream Crossing', 'Rock Outcrop', 'Teak Stand',
  'Grassland Edge', 'Watch Tower', 'Old Logging Track', 'Ridge Saddle', 'Deer Meadow',
]
const T2_PLACES = [
  'Village Gate', 'Crop Boundary', 'Solar Fence', 'Cattle Shed', 'School Road',
  'Well Field', 'Banana Grove', 'Bus Stop', 'Temple Path', 'Check Dam',
  'Ration Store', 'Panchayat Office', 'Water Tank', 'Bore Well', 'Market Yard',
]

const nodes = []
let seq = 0

function makeNode(tier) {
  seq += 1
  const id = `WGX-${String(seq).padStart(3, '0')}`
  const isT1 = tier === 'T1'
  const sector = pick(isT1 ? T1_SECTORS : T2_SECTORS)

  // T1 nodes fill the core disc; T2 nodes sit on a 7-12km perimeter ring.
  let pos
  if (isT1) {
    const angle = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd()) * 6.2
    pos = offsetKm(CENTER.lat, CENTER.lng, Math.cos(angle) * r, Math.sin(angle) * r)
  } else {
    const angle = rnd() * Math.PI * 2
    const r = 7 + rnd() * 5
    pos = offsetKm(CENTER.lat, CENTER.lng, Math.cos(angle) * r, Math.sin(angle) * r)
  }

  const type = isT1
    ? weighted([['camera', 0.42], ['acoustic', 0.34], ['thermal', 0.18], ['gateway', 0.06]])
    : weighted([['camera', 0.5], ['acoustic', 0.26], ['thermal', 0.14], ['gateway', 0.1]])

  // Health: most healthy. Offline/degraded counts are overridden at runtime by
  // VITE_DEMO_OFFLINE_NODES / VITE_DEMO_DEGRADED_NODES; these are the baseline.
  const status = weighted([['online', 0.94], ['degraded', 0.04], ['offline', 0.02]])

  const battery =
    status === 'offline' ? 0 : status === 'degraded' ? rint(8, 34) : rint(38, 100)

  const hour = 11 // fixtures are generated as a mid-morning snapshot
  const charging = status !== 'offline' && hour > 7 && hour < 17 && rnd() > 0.25

  const place = pick(isT1 ? T1_PLACES : T2_PLACES)

  return {
    id,
    label: `${place} ${type}`,
    tier,
    zone: isT1 ? 'Tier-1 Forest Core' : 'Tier-2 Village Perimeter',
    type,
    hardware: HARDWARE[type],
    sector,
    lat: pos.lat,
    lng: pos.lng,
    status,
    battery,
    solarInputW: status === 'offline' ? 0 : charging ? rfloat(0.8, 5.4) : 0,
    charging,
    rssi: status === 'offline' ? -999 : rint(-118, -62),
    snr: status === 'offline' ? 0 : rfloat(-4, 11, 1),
    firmware: weighted([['2.4.1', 0.72], ['2.4.0', 0.18], ['2.3.7', 0.1]]),
    deepSleepMins: isT1 ? pick([5, 10, 15]) : pick([3, 5, 10]),
    wakeIntervalMins: isT1 ? pick([15, 30]) : pick([10, 15]),
    enclosureTempC: status === 'offline' ? null : rfloat(19, 44, 1),
    uptime30d: status === 'offline' ? rfloat(41, 78, 1) : rfloat(93.4, 99.98, 2),
    lastSeenMinutesAgo:
      status === 'offline' ? rint(190, 2900) : status === 'degraded' ? rint(6, 55) : rint(0, 4),
    installedDaysAgo: rint(45, 620),
    falsePositiveRate: rfloat(0.02, 0.31),
    detections30d: rint(0, 58),
  }
}

for (let i = 0; i < T1_COUNT; i++) nodes.push(makeNode('T1'))
for (let i = 0; i < T2_COUNT; i++) nodes.push(makeNode('T2'))

/* --- team: 6 members ------------------------------------------------------ */
const team = [
  {
    id: 'U-01', name: 'Ravi Nair', initials: 'RN', role: 'Ranger',
    sectors: ['S7', 'S8'], status: 'available', phoneMasked: '+91 ••••• ••231',
    radioChannel: 'DMR-4', joinedDaysAgo: 412, onShift: true, shift: 'Night 22-06',
    lastPingMinutesAgo: 0.2,
  },
  {
    id: 'U-02', name: 'Sathya Krishnasamy', initials: 'SK', role: 'Operator',
    sectors: [], status: 'online', phoneMasked: '+91 ••••• ••884',
    radioChannel: 'DMR-1', joinedDaysAgo: 640, onShift: true, shift: 'Night 22-06',
    lastPingMinutesAgo: 0,
  },
  {
    id: 'U-03', name: 'Meena Lakshmi', initials: 'ML', role: 'Manager',
    sectors: ['S1', 'S2', 'S3', 'S4', 'S5'], status: 'online',
    phoneMasked: '+91 ••••• ••107', radioChannel: 'DMR-1', joinedDaysAgo: 700,
    onShift: true, shift: 'Day 06-14', lastPingMinutesAgo: 3,
  },
  {
    id: 'U-04', name: 'Arjun Perumal', initials: 'AP', role: 'Ranger',
    sectors: ['S1', 'S2'], status: 'responding', phoneMasked: '+91 ••••• ••550',
    radioChannel: 'DMR-3', joinedDaysAgo: 220, onShift: true, shift: 'Night 22-06',
    lastPingMinutesAgo: 1,
  },
  {
    id: 'U-05', name: 'Divya Raman', initials: 'DR', role: 'Technician',
    sectors: ['S3', 'S6'], status: 'off_duty', phoneMasked: '+91 ••••• ••319',
    radioChannel: 'DMR-6', joinedDaysAgo: 150, onShift: false, shift: 'Day 06-14',
    lastPingMinutesAgo: 260,
  },
  {
    id: 'U-06', name: 'Karthik Selvam', initials: 'KS', role: 'Ranger',
    sectors: ['S4', 'S5'], status: 'off_grid', phoneMasked: '+91 ••••• ••472',
    radioChannel: 'DMR-5', joinedDaysAgo: 95, onShift: true, shift: 'Night 22-06',
    lastPingMinutesAgo: 34,
  },
]

/* --- detections: ~200 over the last 90 days ------------------------------- */
const CLASS_MIX = [
  ['elephant', 0.33],
  ['wild_boar', 0.23],
  ['leopard', 0.13],
  ['tiger', 0.07],
  ['human', 0.09],
  ['vehicle', 0.07],
  ['chainsaw', 0.05],
  ['gunshot', 0.03],
]

function severityFor(cls, tier, hour) {
  const night = hour >= 19 || hour <= 5
  switch (cls) {
    case 'gunshot':
      return 'critical'
    case 'chainsaw':
      return 'critical'
    case 'human':
      return tier === 'T1' ? 'critical' : 'warning'
    case 'elephant':
      // An elephant at the village perimeter is a life-safety event; the same
      // animal deep in the core is routine.
      return tier === 'T2' ? 'critical' : 'warning'
    case 'tiger':
      return tier === 'T2' ? 'critical' : 'warning'
    case 'leopard':
      return 'warning'
    case 'vehicle':
      return night ? 'warning' : 'watch'
    case 'wild_boar':
      return 'watch'
    default:
      return 'info'
  }
}

const OUTCOMES = [
  'threat_confirmed_action_taken',
  'threat_confirmed_no_action',
  'no_threat_found',
  'false_positive_model',
  'false_positive_environmental',
]

const DETECTION_TOTAL = 204
const detections = []

for (let i = 0; i < DETECTION_TOTAL; i++) {
  const node = pick(nodes.filter((n) => n.status !== 'offline'))
  const cls = weighted(CLASS_MIX)

  // Night-weighted: ~72% of detections fall between 19:00 and 05:00.
  const night = rnd() < 0.72
  const hour = night ? (rint(19, 29) % 24) : rint(6, 18)

  // Spread across 90 days, denser in the recent week so "last 7 days" views
  // have something to show.
  const recent = rnd() < 0.34
  const daysAgo = recent ? rfloat(0, 7, 3) : rfloat(7, 90, 3)
  const minutesAgo = Math.round(daysAgo * 24 * 60 + rint(-180, 180))

  const severity = severityFor(cls, node.tier, hour)
  const confidence =
    severity === 'critical' ? rint(78, 99) : severity === 'warning' ? rint(66, 95) : rint(52, 88)

  // Recent items are more likely to still be open.
  let status
  if (minutesAgo < 25) status = weighted([['active', 0.6], ['acknowledged', 0.3], ['dispatched', 0.1]])
  else if (minutesAgo < 240) status = weighted([['acknowledged', 0.2], ['dispatched', 0.2], ['resolved', 0.55], ['active', 0.05]])
  else status = weighted([['resolved', 0.84], ['false_positive', 0.16]])

  const resolved = status === 'resolved' || status === 'false_positive'
  const responseSeconds = resolved || status === 'dispatched' ? rint(48, 1140) : null

  const jitter = offsetKm(node.lat, node.lng, rfloat(-0.35, 0.35, 4), rfloat(-0.35, 0.35, 4))

  detections.push({
    id: `DET-${String(4000 + i)}`,
    incidentId: `INC-${String(2300 + i)}`,
    nodeId: node.id,
    cls,
    severity,
    confidence,
    minutesAgo,
    hourOfDay: hour,
    sector: node.sector,
    tier: node.tier,
    zone: node.zone,
    lat: jitter.lat,
    lng: jitter.lng,
    status,
    assignedTo: status === 'active' ? null : pick(team.filter((t) => t.role === 'Ranger')).id,
    acknowledgedBy: status === 'active' ? null : pick(team).id,
    ackAfterSeconds: status === 'active' ? null : rint(12, 420),
    responseSeconds,
    outcome: resolved ? (status === 'false_positive' ? pick(OUTCOMES.slice(3)) : pick(OUTCOMES.slice(0, 3))) : null,
    // An SOS is raised for a subset of criticals: gunshot, or an elephant/tiger
    // pressing the village perimeter.
    sos:
      severity === 'critical' &&
      (cls === 'gunshot' || (node.tier === 'T2' && (cls === 'elephant' || cls === 'tiger'))) &&
      rnd() < 0.4,
    evidence: {
      audio: node.type === 'acoustic' || rnd() < 0.3,
      image: node.type === 'camera' || rnd() < 0.25,
      thermal: node.type === 'thermal',
    },
    modelVersion: weighted([['v2.4', 0.7], ['v2.3', 0.3]]),
  })
}

detections.sort((a, b) => a.minutesAgo - b.minutesAgo)

/* --- geofences ------------------------------------------------------------ */
function ring(centerLat, centerLng, radiusKm, points, wobble) {
  const out = []
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2
    const r = radiusKm * (1 + (rnd() - 0.5) * wobble)
    const p = offsetKm(centerLat, centerLng, Math.cos(angle) * r, Math.sin(angle) * r)
    out.push([p.lat, p.lng])
  }
  return out
}

const geofences = [
  { id: 'GF-1', name: 'Tier-1 Core Zone', type: 'core', tier: 'T1', color: 'ok', polygon: ring(CENTER.lat, CENTER.lng, 6.4, 22, 0.16) },
  { id: 'GF-2', name: 'Tier-2 Village Perimeter', type: 'buffer', tier: 'T2', color: 'warning', polygon: ring(CENTER.lat, CENTER.lng, 12.2, 26, 0.12) },
  { id: 'GF-3', name: 'Sigur Elephant Corridor', type: 'corridor', tier: 'T2', color: 'info', polygon: ring(CENTER.lat + 0.06, CENTER.lng + 0.09, 3.1, 14, 0.2) },
  { id: 'GF-4', name: 'Masinagudi Exclusion', type: 'exclusion', tier: 'T2', color: 'critical', polygon: ring(CENTER.lat - 0.07, CENTER.lng - 0.08, 2.2, 12, 0.18) },
]

/* --- escalation rules & channels ------------------------------------------ */
const rules = [
  {
    id: 'R-1', name: 'Gunshot -> on-call ranger + control room', enabled: true, order: 1,
    when: [
      { field: 'class', op: 'is', value: 'gunshot' },
      { field: 'confidence', op: '>=', value: 85 },
    ],
    join: 'AND',
    then: [
      { action: 'notify', recipients: 'Sector on-call', channels: ['push', 'sms', 'voice'] },
      { action: 'create_incident', severity: 'critical' },
      { action: 'raise_sos', durationSeconds: 15 },
    ],
    escalate: [
      { afterMinutes: 3, tier: 'Secondary ranger', channels: ['sms', 'voice'] },
      { afterMinutes: 8, tier: 'Range manager', channels: ['voice', 'radio'] },
    ],
    firedCount30d: 6, lastFiredMinutesAgo: 12, deliveryRate: 100,
  },
  {
    id: 'R-2', name: 'Elephant at Tier-2 perimeter', enabled: true, order: 2,
    when: [
      { field: 'class', op: 'is', value: 'elephant' },
      { field: 'tier', op: 'is', value: 'T2' },
    ],
    join: 'AND',
    then: [
      { action: 'notify', recipients: 'Sector rangers + village warden', channels: ['push', 'sms'] },
      { action: 'trigger_deterrent', device: 'perimeter siren' },
    ],
    escalate: [{ afterMinutes: 5, tier: 'Range manager', channels: ['voice'] }],
    firedCount30d: 41, lastFiredMinutesAgo: 47, deliveryRate: 98.4,
  },
  {
    id: 'R-3', name: 'Chainsaw signature (night)', enabled: true, order: 3,
    when: [
      { field: 'class', op: 'is', value: 'chainsaw' },
      { field: 'time', op: 'between', value: '19:00-05:00' },
    ],
    join: 'AND',
    then: [{ action: 'notify', recipients: 'Control room', channels: ['push', 'sms'] }],
    escalate: [{ afterMinutes: 4, tier: 'Range manager', channels: ['voice'] }],
    firedCount30d: 9, lastFiredMinutesAgo: 1_400, deliveryRate: 88.9,
  },
  {
    id: 'R-4', name: 'Node offline > 6h', enabled: true, order: 4,
    when: [{ field: 'device_status', op: 'is', value: 'offline' }],
    join: 'AND',
    then: [{ action: 'notify', recipients: 'Field technicians', channels: ['email', 'slack'] }],
    escalate: [],
    firedCount30d: 14, lastFiredMinutesAgo: 320, deliveryRate: 100,
  },
  {
    id: 'R-5', name: 'Tiger sighting digest', enabled: false, order: 5,
    when: [{ field: 'class', op: 'is', value: 'tiger' }],
    join: 'AND',
    then: [{ action: 'log_only' }],
    escalate: [],
    firedCount30d: 0, lastFiredMinutesAgo: null, deliveryRate: 0,
  },
]

const channels = [
  { id: 'push', name: 'Push', provider: 'Firebase Cloud Messaging', status: 'connected', deliveryRate: 99.4, medianLatencyMs: 820, costPerMessage: 0 },
  { id: 'sms', name: 'SMS', provider: 'Gupshup', status: 'connected', deliveryRate: 97.1, medianLatencyMs: 3400, costPerMessage: 0.18 },
  { id: 'voice', name: 'Voice call', provider: 'Exotel', status: 'connected', deliveryRate: 94.8, medianLatencyMs: 7200, costPerMessage: 1.1 },
  { id: 'email', name: 'Email', provider: 'Amazon SES', status: 'connected', deliveryRate: 99.9, medianLatencyMs: 2100, costPerMessage: 0 },
  { id: 'radio', name: 'Radio (DMR gateway)', provider: 'Hytera gateway', status: 'degraded', deliveryRate: 71.2, medianLatencyMs: 1500, costPerMessage: 0, lastError: 'GATEWAY_TIMEOUT: no ack from repeater DMR-5 after 4000ms' },
  { id: 'webhook', name: 'Webhook', provider: 'Forest Dept reporting API', status: 'connected', deliveryRate: 96.5, medianLatencyMs: 640, costPerMessage: 0 },
  { id: 'slack', name: 'Slack', provider: 'Slack', status: 'disconnected', deliveryRate: 0, medianLatencyMs: 0, costPerMessage: 0, lastError: 'invalid_auth: token revoked' },
]

/* --- write ---------------------------------------------------------------- */
const files = {
  'nodes.json': nodes,
  'detections.json': detections,
  'team.json': team,
  'sectors.json': SECTORS,
  'geofences.json': geofences,
  'rules.json': rules,
  'channels.json': channels,
  'meta.json': {
    seed: SEED,
    generatedFor: 'WildGuardX demo data layer (PLACEHOLDER — not real telemetry)',
    center: CENTER,
    nodeCount: nodes.length,
    tier1Count: T1_COUNT,
    tier2Count: T2_COUNT,
    detectionCount: detections.length,
    teamCount: team.length,
    note: 'Timestamps are stored as *minutesAgo* and resolved against Date.now() by MockProvider.',
  },
}

for (const [name, data] of Object.entries(files)) {
  writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n', 'utf8')
  const count = Array.isArray(data) ? `${data.length} records` : 'object'
  console.log(`  wrote ${name.padEnd(18)} ${count}`)
}

const byStatus = nodes.reduce((a, n) => ((a[n.status] = (a[n.status] || 0) + 1), a), {})
const bySeverity = detections.reduce((a, d) => ((a[d.severity] = (a[d.severity] || 0) + 1), a), {})
console.log('\n  nodes by status:', byStatus)
console.log('  detections by severity:', bySeverity)
console.log('  SOS-flagged detections:', detections.filter((d) => d.sos).length)
