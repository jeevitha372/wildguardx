/**
 * Simulator configuration — named, not hardcoded.
 *
 * Resolution order (highest wins):
 *   1. URL query param   ?demo-interval=3000&demo-severity-mix=critical:1,watch:1
 *   2. Constructor prop  new MockProvider({ intervalMs: 3000 })
 *   3. Vite env var      VITE_DEMO_INTERVAL=3000   (.env / .env.local)
 *   4. Built-in default  (below)
 *
 * The URL layer exists so a demo can be re-tuned live during a walkthrough —
 * "show me a critical every 2 seconds" — without a rebuild.
 */

import type { Severity } from './types'

export interface SimulatorConfig {
  /** Milliseconds between simulated detections. */
  intervalMs: number
  /** Normalised severity weights for generated detections. */
  severityMix: Record<Severity, number>
  /** How many nodes are forced offline. */
  offlineNodes: number
  /** How many nodes are forced degraded. */
  degradedNodes: number
  /** Deterministic seed. */
  seed: number
  /** Probability (0..1) a generated critical also raises the SOS takeover. */
  sosChance: number
  /** Artificial latency on every provider call, so skeletons are observable. */
  latencyMs: number
}

export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  intervalMs: 12_000,
  severityMix: { critical: 0.12, warning: 0.28, watch: 0.4, info: 0.2 },
  offlineNodes: 3,
  degradedNodes: 4,
  seed: 20260817,
  sosChance: 0.35,
  latencyMs: 420,
}

const SEVERITIES: Severity[] = ['critical', 'warning', 'watch', 'info']

/** Parse `critical:0.2,warning:0.3,watch:0.4,info:0.1` into normalised weights. */
export function parseSeverityMix(raw: string | undefined): Record<Severity, number> | null {
  if (!raw) return null
  const out: Record<string, number> = {}
  for (const part of raw.split(',')) {
    const [name, weight] = part.split(':').map((s) => s.trim())
    const n = Number(weight)
    if (!name || !Number.isFinite(n) || n < 0) continue
    if (!SEVERITIES.includes(name as Severity)) continue
    out[name] = n
  }
  const total = Object.values(out).reduce((s, n) => s + n, 0)
  if (total <= 0) return null
  const normalised: Record<string, number> = {}
  for (const sev of SEVERITIES) normalised[sev] = (out[sev] ?? 0) / total
  return normalised as Record<Severity, number>
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function queryParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

/**
 * Merge all four configuration layers.
 * `props` is what a caller passed to `new MockProvider({...})`.
 */
export function resolveSimulatorConfig(props: Partial<SimulatorConfig> = {}): SimulatorConfig {
  const env = import.meta.env
  const q = queryParams()

  const envMix = parseSeverityMix(env.VITE_DEMO_SEVERITY_MIX as string | undefined)
  const queryMix = parseSeverityMix(q.get('demo-severity-mix') ?? undefined)

  return {
    intervalMs: num(
      q.get('demo-interval') ?? props.intervalMs ?? env.VITE_DEMO_INTERVAL,
      DEFAULT_SIMULATOR_CONFIG.intervalMs,
      500,
      600_000,
    ),
    severityMix:
      queryMix ?? props.severityMix ?? envMix ?? DEFAULT_SIMULATOR_CONFIG.severityMix,
    offlineNodes: num(
      q.get('demo-offline-nodes') ?? props.offlineNodes ?? env.VITE_DEMO_OFFLINE_NODES,
      DEFAULT_SIMULATOR_CONFIG.offlineNodes,
      0,
      291,
    ),
    degradedNodes: num(
      q.get('demo-degraded-nodes') ?? props.degradedNodes ?? env.VITE_DEMO_DEGRADED_NODES,
      DEFAULT_SIMULATOR_CONFIG.degradedNodes,
      0,
      291,
    ),
    seed: num(
      q.get('demo-seed') ?? props.seed ?? env.VITE_DEMO_SEED,
      DEFAULT_SIMULATOR_CONFIG.seed,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    sosChance: num(
      q.get('demo-sos-chance') ?? props.sosChance ?? env.VITE_DEMO_SOS_CHANCE,
      DEFAULT_SIMULATOR_CONFIG.sosChance,
      0,
      1,
    ),
    latencyMs: num(
      q.get('demo-latency') ?? props.latencyMs ?? env.VITE_DEMO_LATENCY,
      DEFAULT_SIMULATOR_CONFIG.latencyMs,
      0,
      10_000,
    ),
  }
}

/** Human-readable summary, shown in the DEMO DATA badge popover. */
export function describeConfig(c: SimulatorConfig): string[] {
  const mix = SEVERITIES.map((s) => `${s} ${Math.round(c.severityMix[s] * 100)}%`).join(' · ')
  return [
    `Interval: one detection every ${(c.intervalMs / 1000).toFixed(1)}s`,
    `Severity mix: ${mix}`,
    `Forced offline nodes: ${c.offlineNodes}`,
    `Forced degraded nodes: ${c.degradedNodes}`,
    `SOS chance on critical: ${Math.round(c.sosChance * 100)}%`,
    `Simulated latency: ${c.latencyMs}ms`,
    `Seed: ${c.seed}`,
  ]
}
