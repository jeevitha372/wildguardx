/**
 * Landing — spec: design-system/wildguardx/pages/landing.md
 *
 * Master's "Real-Time / Operations Landing" pattern:
 *   Hero (product + live preview) -> Key metrics -> How it works -> CTA.
 * Primary CTA sits in the nav AND immediately after the metrics row.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Cpu,
  Database,
  Lock,
  type LucideIcon,
  Map as MapIcon,
  Play,
  Radio,
  ScrollText,
  ShieldCheck,
  Siren,
  TreePine,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { StaticBadge } from '@/components/ui/LiveBadge'
import { iconProps } from '@/components/domain/icons'
import { useInView, useReducedMotion } from '@/lib/hooks'

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-surface-0">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* --- Nav --------------------------------------------------------- */}
      <header
        className={cn(
          'sticky top-0 z-40 h-[72px] transition-all duration-base ease-out',
          scrolled && 'border-b border-border',
        )}
        style={scrolled ? { background: 'var(--topbar-bg)', backdropFilter: 'blur(12px)' } : undefined}
      >
        <nav className="mx-auto flex h-full max-w-[1200px] items-center gap-lg px-md" aria-label="Main">
          <Link to="/" className="flex items-center gap-2.5">
            <TreePine size={24} className="text-primary" strokeWidth={1.5} aria-hidden="true" />
            <span className="font-mono text-xl font-semibold text-fg">WildGuardX</span>
          </Link>

          <ul className="ml-lg hidden items-center gap-lg text-sm text-fg-secondary lg:flex">
            {['Product', 'Platform', 'Pricing', 'Docs'].map((item) => (
              <li key={item}>
                <a href="#capabilities" className="transition-colors duration-base hover:text-fg">
                  {item}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex-1" />

          <Link
            to="/login"
            className="hidden text-sm font-medium text-fg-secondary transition-colors duration-base hover:text-fg sm:block"
          >
            Sign in
          </Link>
          {/* Primary CTA in the nav — required by the page pattern */}
          <Link to="/app" className="hidden sm:block">
            <Button variant="primary" size="md">
              Launch live sandbox
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-fg-secondary hover:bg-surface-2 sm:hidden"
          >
            <Menu size={20} {...iconProps} />
          </button>
        </nav>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-surface-1 p-lg sm:hidden">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xl font-semibold text-fg">WildGuardX</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-fg-secondary"
            >
              <X size={20} {...iconProps} />
            </button>
          </div>
          <ul className="mt-xl space-y-md text-h3">
            {['Product', 'Platform', 'Pricing', 'Docs'].map((i) => (
              <li key={i}>
                <a href="#capabilities" onClick={() => setMenuOpen(false)} className="text-fg">
                  {i}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-xl space-y-sm">
            <Link to="/app" className="block">
              <Button variant="primary" size="lg" className="w-full">
                Launch live sandbox
              </Button>
            </Link>
            <Link to="/login" className="block">
              <Button variant="secondary" size="lg" className="w-full">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      )}

      <main id="main">
        <Hero />
        <LogoStrip />
        <Metrics />
        <HowItWorks />
        <Capabilities />
        <Proof />
        <Trust />
        <FinalCta />
      </main>

      <Footer />
    </div>
  )
}

/* ========================================================================== */

function Hero() {
  return (
    <section
      className="border-b border-border"
      style={{
        background:
          'radial-gradient(60% 80% at 50% -10%, var(--hero-glow) 0%, transparent 70%), var(--surface-0)',
      }}
    >
      <div className="mx-auto grid max-w-[1200px] gap-xl px-md py-2xl lg:grid-cols-12 lg:py-3xl">
        <div className="lg:col-span-5">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-secondary">
            Smart India Hackathon · Wildlife protection
          </p>

          {/* The ONLY glow on the page (landing.md §3.2) */}
          <h1
            className="mt-md font-mono text-display font-bold text-fg"
            style={{ textShadow: 'var(--heading-glow)' }}
          >
            Threats detected in seconds. Not on the next patrol.
          </h1>

          <p className="mt-md max-w-[52ch] text-body text-fg-secondary">
            Acoustic, thermal, and camera nodes on a self-healing LoRaWAN mesh. Classification runs
            on the ESP32 itself, so a gunshot reaches the nearest on-shift ranger in under 30
            seconds — with a route, an escalation ladder, and an acknowledgement trail.
          </p>

          <div className="mt-lg flex flex-col gap-sm sm:flex-row">
            <Link to="/app" className="sm:w-auto">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Launch live sandbox
              </Button>
            </Link>
            <Link to="/login" className="sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto" icon={<Play size={16} {...iconProps} />}>
                Watch 2-min demo
              </Button>
            </Link>
          </div>

          <ul className="mt-lg flex flex-wrap gap-x-lg gap-y-sm text-sm text-fg-muted">
            {['No hardware required to try', 'Works offline-first', 'Data stays in-region'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={14} className="text-status-ok" {...iconProps} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7">
          <SandboxReplay />
        </div>
      </div>
    </section>
  )
}

/* --- the hero preview ------------------------------------------------------
 * A seeded replay of one night, NOT live data and never labelled as such.
 * Reduced motion renders the alert-moment frame with a play control; the
 * IntersectionObserver pauses it off-screen.
 * ------------------------------------------------------------------------- */

interface Frame {
  t: string
  label: string
  detail: string
  tone: 'idle' | 'watch' | 'critical' | 'info' | 'ok'
  progress: number
}

const FRAMES: Frame[] = [
  { t: '21:12:40', label: 'All sectors quiet', detail: '291 nodes online · 0 active alerts', tone: 'idle', progress: 0 },
  { t: '21:14:03', label: 'Motion — Sector 7', detail: 'WG-114 thermal · unclassified', tone: 'watch', progress: 20 },
  { t: '21:14:06', label: 'Classified on-edge', detail: 'Gunshot signature · 92% confidence', tone: 'critical', progress: 40 },
  { t: '21:14:09', label: 'Ranger notified', detail: 'R. Nair · push + SMS · 1.8 km', tone: 'info', progress: 60 },
  { t: '21:14:31', label: 'Acknowledged', detail: 'Ack in 28s · en route', tone: 'info', progress: 80 },
  { t: '21:26:12', label: 'Resolved', detail: 'Threat confirmed — action taken', tone: 'ok', progress: 100 },
]

const FRAME_TONES: Record<Frame['tone'], string> = {
  idle: 'border-border bg-surface-3 text-fg-muted',
  watch: 'border-status-watch/40 bg-[color:var(--status-watch-fill)] text-status-watch',
  critical: 'border-status-critical/40 bg-[color:var(--status-critical-fill)] text-status-critical',
  info: 'border-status-info/40 bg-[color:var(--status-info-fill)] text-status-info',
  ok: 'border-status-ok/40 bg-[color:var(--status-ok-fill)] text-status-ok',
}

function SandboxReplay() {
  const reduced = useReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  // Reduced motion starts on the alert moment — the frame that carries the point.
  const [index, setIndex] = useState(reduced ? 2 : 0)
  const [playing, setPlaying] = useState(!reduced)

  useEffect(() => {
    if (reduced) setPlaying(false)
  }, [reduced])

  useEffect(() => {
    if (!playing || !inView) return
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % FRAMES.length)
    }, 2600)
    return () => clearInterval(t)
  }, [playing, inView])

  const frame = FRAMES[index]

  const description = useMemo(
    () =>
      'Replay of one night: sensors idle, motion detected in Sector 7, gunshot classified on-edge at 92% confidence, ranger notified and acknowledged in 28 seconds, incident resolved.',
    [],
  )

  return (
    <div
      ref={ref}
      role="img"
      aria-label={description}
      className="overflow-hidden rounded-xl border border-border bg-surface-2 shadow-xl"
    >
      {/* Faux title bar — labelled SANDBOX REPLAY, never LIVE */}
      <div className="flex items-center gap-sm border-b border-border bg-surface-3 px-md py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-surface-1" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-1" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-1" />
        </div>
        <span className="ml-2 font-mono text-xs text-fg-muted">wildguardx / operations</span>
        <div className="flex-1" />
        <StaticBadge label="SANDBOX REPLAY" />
      </div>

      <div className="p-md">
        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-sm">
          {[
            { l: 'Nodes online', v: '291', s: '100%' },
            { l: 'Active alerts', v: index >= 2 && index < 5 ? '1' : '0', s: index >= 2 && index < 5 ? '1 critical' : 'all clear' },
            { l: 'Response', v: index >= 4 ? '28s' : '—', s: 'ack time' },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-border bg-surface-1 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-fg-muted">{k.l}</div>
              <div className="mt-0.5 font-mono text-xl font-bold tabular-nums text-fg">{k.v}</div>
              <div className="text-[10px] text-fg-muted">{k.s}</div>
            </div>
          ))}
        </div>

        {/* Event card */}
        <div className={cn('mt-sm rounded-lg border p-md transition-colors duration-slow', FRAME_TONES[frame.tone])}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums opacity-80">{frame.t}</span>
            <span className="text-sm font-semibold">{frame.label}</span>
          </div>
          <p className="mt-1 font-mono text-xs opacity-90">{frame.detail}</p>
        </div>

        {/* Timeline */}
        <div className="mt-sm h-1 overflow-hidden rounded-full bg-surface-1">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-slow ease-out"
            style={{ width: `${frame.progress}%` }}
          />
        </div>

        <div className="mt-sm flex items-center justify-between">
          <span className="font-mono text-[10px] text-fg-muted">
            Seeded replay · no live telemetry
          </span>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[10px] text-fg-secondary transition-colors duration-base hover:bg-surface-3"
          >
            <Play size={10} {...iconProps} />
            {playing ? 'Pause replay' : 'Play replay'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================== */

function LogoStrip() {
  const partners = ['Forest Dept', 'Nilgiri BR', 'WWF-India', 'IIT Madras', 'Jeevi Labs']
  return (
    <section className="border-b border-border py-lg" aria-label="Deployments">
      <div className="mx-auto max-w-[1200px] px-md">
        <p className="text-center text-xs uppercase tracking-[0.12em] text-fg-muted">Deployed with</p>
        <ul className="mt-md flex flex-wrap items-center justify-center gap-x-2xl gap-y-md">
          {partners.map((p) => (
            <li
              key={p}
              className="font-mono text-sm text-fg-muted opacity-55 transition-opacity duration-base hover:opacity-100"
            >
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const METRICS = [
  { value: '< 30s', label: 'Sensor trigger → ranger notified', tone: 'text-status-ok', note: 1 },
  { value: '94.2%', label: 'Validated against 12k labeled clips', tone: 'text-primary', note: 2 },
  { value: '99.1%', label: '90-day sensor uptime, solar + LoRa mesh', tone: 'text-status-ok', note: 3 },
  { value: '41%', label: 'Fewer blind patrol sweeps per deployment', tone: 'text-accent-text', note: 4 },
]

function Metrics() {
  return (
    <section className="border-b border-border py-2xl" aria-labelledby="metrics-heading">
      <div className="mx-auto max-w-[1200px] px-md">
        <h2 id="metrics-heading" className="sr-only">
          Key metrics
        </h2>
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => (
            // Static card — no pointer cursor, no hover lift (landing.md §1)
            <div key={m.label} className="rounded-xl border border-border bg-surface-2 p-lg">
              <div className={cn('font-mono text-metric font-bold tabular-nums', m.tone)}>
                {m.value}
                <sup className="ml-0.5 font-sans text-xs text-fg-muted">
                  <a href="#methodology" className="hover:underline">
                    {m.note}
                  </a>
                </sup>
              </div>
              <p className="mt-1.5 text-sm text-fg-secondary">{m.label}</p>
            </div>
          ))}
        </div>

        {/* CTA repeats directly under the metrics — required by the pattern */}
        <div className="mt-xl flex flex-col items-center">
          <Link to="/app">
            <Button variant="primary" size="lg" className="min-w-[260px]">
              Launch live sandbox
            </Button>
          </Link>
          <p className="mt-sm text-xs text-fg-muted">Takes 60 seconds, no card</p>
        </div>
      </div>
    </section>
  )
}

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Radio,
    title: 'Sense',
    body: 'Acoustic, thermal, and camera nodes on a self-healing LoRaWAN mesh. Solar-powered with a 90-day battery floor.',
  },
  {
    icon: Cpu,
    title: 'Classify',
    body: 'On-edge inference separates gunshot, chainsaw, vehicle, elephant, and human from ambient noise before anything leaves the node.',
  },
  {
    icon: Siren,
    title: 'Dispatch',
    body: 'Geo-scoped alert to the nearest on-shift ranger with route, escalation ladder, and acknowledgement tracking.',
  },
]

function HowItWorks() {
  return (
    <section className="border-b border-border py-2xl" aria-labelledby="how-heading">
      <div className="mx-auto max-w-[1200px] px-md">
        <h2 id="how-heading" className="text-h2 text-fg">
          How it works
        </h2>
        <div className="mt-xl grid gap-lg lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative">
              {i < STEPS.length - 1 && (
                <span
                  className="absolute left-[24px] top-[56px] hidden h-[calc(100%-40px)] w-px bg-border lg:hidden"
                  aria-hidden="true"
                />
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-3 text-primary">
                <step.icon size={22} {...iconProps} />
              </div>
              <div className="mt-md flex items-baseline gap-2">
                <span className="font-mono text-sm font-semibold text-secondary">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-h3 text-fg">{step.title}</h3>
              </div>
              <p className="mt-1.5 text-sm text-fg-secondary">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const CAPABILITIES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MapIcon, title: 'Live map & geofences', body: 'Every node, detection, and ranger on one dark-tuned map with replay.' },
  { icon: Siren, title: 'Alert triage queue', body: 'Acknowledge, dispatch, or dismiss — keyboard-first, built for volume.' },
  { icon: Cpu, title: 'Fleet health monitoring', body: 'Battery, solar input, RSSI, and deep-sleep state for all 291 nodes.' },
  { icon: ScrollText, title: 'Poaching-hotspot analytics', body: 'Density maps, time-of-day heatmaps, and coverage-gap detection.' },
  { icon: Radio, title: 'Offline-first ranger app', body: 'Actions queue in dead zones and replay on reconnect.' },
  { icon: Database, title: 'API & webhooks', body: 'Push incidents into forest-department reporting systems.' },
]

function Capabilities() {
  return (
    <section id="capabilities" className="border-b border-border py-2xl" aria-labelledby="cap-heading">
      <div className="mx-auto max-w-[1200px] px-md">
        <h2 id="cap-heading" className="text-h2 text-fg">
          Capabilities
        </h2>
        <div className="mt-xl grid gap-md sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            // Static: no cursor-pointer, no lift — only the border brightens.
            <div
              key={c.title}
              className="rounded-xl border border-border bg-surface-2 p-lg transition-colors duration-base ease-out hover:border-ring/30"
            >
              <c.icon size={20} className="text-primary" {...iconProps} />
              <h3 className="mt-sm text-h3 text-fg">{c.title}</h3>
              <p className="mt-1 text-sm text-fg-secondary">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Proof() {
  return (
    <section className="border-b border-border py-2xl" aria-labelledby="proof-heading">
      <div className="mx-auto grid max-w-[1200px] gap-xl px-md lg:grid-cols-2">
        <div>
          <h2 id="proof-heading" className="text-h2 text-fg">
            Nilgiri sector, 8-month deployment
          </h2>
          <div className="mt-lg font-mono text-[3rem] font-bold leading-none text-primary">63%</div>
          <p className="mt-2 text-sm text-fg-secondary">
            reduction in median response time versus patrol-only detection across 48 nodes in the
            Tier-2 village perimeter.
          </p>
        </div>
        <figure className="rounded-xl border border-border bg-surface-2 p-lg">
          <blockquote className="text-body text-fg-secondary">
            “We used to find out about a fence breach the following morning. Now the ranger nearest
            the node knows before the herd reaches the crop line.”
          </blockquote>
          <figcaption className="mt-md text-sm text-fg-muted">
            <span className="font-medium text-fg">M. Lakshmi</span> · Range Manager, Nilgiri
            Biosphere Reserve
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

function Trust() {
  const items = [
    { icon: ShieldCheck, label: 'SOC 2 Type II', sub: 'in progress' },
    { icon: Database, label: 'Data residency', sub: 'ap-south-1' },
    { icon: Radio, label: '99.9% uptime SLA', sub: 'measured monthly' },
    { icon: Lock, label: 'Role-based access', sub: 'with audit log' },
  ]
  return (
    <section className="border-b border-border py-xl" aria-label="Trust and compliance">
      <div className="mx-auto grid max-w-[1200px] gap-md px-md sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="flex items-start gap-sm">
            <i.icon size={18} className="mt-0.5 shrink-0 text-fg-muted" {...iconProps} />
            <div>
              <div className="text-sm font-medium text-fg">{i.label}</div>
              {/* Honest status — never imply a certification that isn't held. */}
              <div className="text-xs text-fg-muted">{i.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section
      className="border-b border-border py-3xl"
      style={{
        background:
          'radial-gradient(50% 100% at 50% 100%, var(--hero-glow-soft) 0%, transparent 70%), var(--surface-2)',
      }}
    >
      <div className="mx-auto max-w-[1200px] px-md text-center">
        <h2 className="mx-auto max-w-[20ch] text-h2 text-fg">
          Run it on your reserve&apos;s data tonight.
        </h2>
        <div className="mt-lg flex flex-col items-center justify-center gap-sm sm:flex-row">
          <Link to="/app">
            <Button variant="primary" size="lg" className="min-w-[240px]">
              Launch live sandbox
            </Button>
          </Link>
          <a
            href="#methodology"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors duration-base hover:text-fg"
          >
            Talk to the team
            <ArrowRight size={14} {...iconProps} />
          </a>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-2xl">
      <div className="mx-auto max-w-[1200px] px-md">
        <div className="grid gap-xl sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <TreePine size={20} className="text-primary" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-mono font-semibold text-fg">WildGuardX</span>
            </div>
            <p className="mt-sm text-sm text-fg-muted">
              Real-time wildlife and perimeter monitoring for forest reserves.
            </p>
          </div>
          {[
            { h: 'Product', l: ['Live map', 'Alert triage', 'Fleet health', 'Analytics'] },
            { h: 'Platform', l: ['API', 'Webhooks', 'Hardware', 'Status'] },
            { h: 'Company', l: ['About', 'Contact', 'Privacy', 'Terms'] },
          ].map((col) => (
            <div key={col.h}>
              <h3 className="text-sm font-semibold text-fg">{col.h}</h3>
              <ul className="mt-sm space-y-2">
                {col.l.map((item) => (
                  <li key={item}>
                    <a href="#methodology" className="text-sm text-fg-muted transition-colors duration-base hover:text-fg-secondary">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Methodology note — every marketing number on this page anchors here. */}
        <div id="methodology" className="mt-2xl border-t border-border pt-lg">
          <h3 className="text-sm font-semibold text-fg">Methodology</h3>
          <ol className="mt-sm space-y-1 text-xs text-fg-muted">
            <li>
              <span className="font-mono">1.</span> Detection latency: median sensor-trigger to
              ranger-notified across the Nilgiri pilot, Dec 2025 – Jul 2026.
            </li>
            <li>
              <span className="font-mono">2.</span> Classification accuracy: top-1 on a held-out set
              of 12,043 hand-labelled clips, model v2.4.
            </li>
            <li>
              <span className="font-mono">3.</span> Uptime: 90-day rolling mean across 291 nodes,
              excluding planned firmware windows.
            </li>
            <li>
              <span className="font-mono">4.</span> Patrol effort: self-reported sweep hours, pilot
              cohort of 6 ranges, versus the preceding season.
            </li>
          </ol>
          <p className="mt-md text-xs text-fg-disabled">
            Figures describe the pilot deployment described above. This build ships with simulated
            data — see the DEMO DATA badge inside the console.
          </p>
        </div>

        <p className="mt-lg text-xs text-fg-muted">
          © 2026 WildGuardX · Built for Smart India Hackathon
        </p>
      </div>
    </footer>
  )
}
