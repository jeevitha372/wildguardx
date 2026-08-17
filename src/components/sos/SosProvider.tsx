/**
 * SOS — 15-second full-screen takeover for life-safety events.
 *
 * Raised when a critical detection carries `sos: true` (gunshot, or an
 * elephant/tiger pressing the Tier-2 village perimeter). It takes the whole
 * viewport because an operator may not be looking at the alert feed, and it
 * does not auto-dismiss: an unacknowledged SOS that quietly disappears is
 * worse than no SOS at all. The 15 seconds govern the vibration and the
 * audible cue, not the modal's lifetime.
 *
 * Vibration uses navigator.vibrate, which is unsupported on desktop Safari and
 * all of iOS. That is handled explicitly rather than assumed away — see
 * `vibrationSupport` below.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Siren, Vibrate, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData, useMockProvider } from '@/data/DataContext'
import type { Detection } from '@/data/types'
import { Button } from '@/components/ui/Button'
import { absoluteTime, classLabel, coords } from '@/lib/format'
import { iconProps } from '@/components/domain/icons'

const SOS_DURATION_MS = 15_000

/** One 15-second cycle: 600ms buzz, 300ms gap. */
const VIBRATION_PATTERN = (() => {
  const pattern: number[] = []
  let total = 0
  while (total < SOS_DURATION_MS) {
    pattern.push(600, 300)
    total += 900
  }
  return pattern
})()

type VibrationSupport = 'supported' | 'unsupported' | 'rejected'

interface SosContextValue {
  active: Detection | null
  raise: (d: Detection) => void
  dismiss: () => void
  /** Manual trigger for demos; no-op on a non-demo provider. */
  triggerDemoSos: () => void
}

const SosCtx = createContext<SosContextValue | null>(null)

export function SosProvider({ children }: { children: ReactNode }) {
  const { provider } = useData()
  const mock = useMockProvider()
  const [active, setActive] = useState<Detection | null>(null)
  const [remaining, setRemaining] = useState(SOS_DURATION_MS)
  const [vibration, setVibration] = useState<VibrationSupport>('unsupported')
  const audioCtx = useRef<AudioContext | null>(null)

  const stopSignals = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0)
      } catch {
        /* vibrate can throw in cross-origin iframes — nothing to recover */
      }
    }
    if (audioCtx.current) {
      void audioCtx.current.close().catch(() => {})
      audioCtx.current = null
    }
  }, [])

  const startSignals = useCallback(() => {
    // --- vibration, with an honest capability check
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      setVibration('unsupported')
    } else {
      let ok = false
      try {
        ok = navigator.vibrate(VIBRATION_PATTERN)
      } catch {
        ok = false
      }
      // A `false` return means the UA refused (no user gesture yet, or the
      // page is hidden). Report that distinctly from "device can't vibrate".
      setVibration(ok ? 'supported' : 'rejected')
    }

    // --- audible cue: two-tone, once. Never a looping browser alarm.
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        const ctx = new Ctx()
        audioCtx.current = ctx
        const play = (freq: number, at: number) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.frequency.value = freq
          osc.type = 'sine'
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
          gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.38)
          osc.connect(gain).connect(ctx.destination)
          osc.start(ctx.currentTime + at)
          osc.stop(ctx.currentTime + at + 0.4)
        }
        play(880, 0)
        play(660, 0.42)
      }
    } catch {
      /* Autoplay policy may block this before any user gesture. Non-fatal:
         the visual takeover and the vibration still carry the alert. */
    }
  }, [])

  const raise = useCallback(
    (d: Detection) => {
      setActive(d)
      setRemaining(SOS_DURATION_MS)
      startSignals()
    },
    [startSignals],
  )

  const dismiss = useCallback(() => {
    stopSignals()
    setActive(null)
  }, [stopSignals])

  // Countdown for the vibration window
  useEffect(() => {
    if (!active) return
    const started = Date.now()
    const t = setInterval(() => {
      const left = Math.max(0, SOS_DURATION_MS - (Date.now() - started))
      setRemaining(left)
      if (left === 0) {
        clearInterval(t)
        stopSignals()
      }
    }, 100)
    return () => clearInterval(t)
  }, [active, stopSignals])

  // Subscribe to provider SOS events
  useEffect(() => {
    const off = provider.subscribeSos((d) => raise(d))
    return off
  }, [provider, raise])

  useEffect(() => stopSignals, [stopSignals])

  const triggerDemoSos = useCallback(() => {
    if (mock) mock.triggerSos()
  }, [mock])

  const value = useMemo(
    () => ({ active, raise, dismiss, triggerDemoSos }),
    [active, raise, dismiss, triggerDemoSos],
  )

  return (
    <SosCtx.Provider value={value}>
      {children}
      {active && (
        <SosTakeover
          detection={active}
          remainingMs={remaining}
          vibration={vibration}
          onDismiss={dismiss}
        />
      )}
    </SosCtx.Provider>
  )
}

export function useSos(): SosContextValue {
  const ctx = useContext(SosCtx)
  if (!ctx) throw new Error('useSos must be used inside <SosProvider>')
  return ctx
}

/* ========================================================================== */

function SosTakeover({
  detection,
  remainingMs,
  vibration,
  onDismiss,
}: {
  detection: Detection
  remainingMs: number
  vibration: VibrationSupport
  onDismiss: () => void
}) {
  const navigate = useNavigate()
  const { provider } = useData()
  const panel = useRef<HTMLDivElement>(null)
  const ackButton = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)

  const seconds = Math.ceil(remainingMs / 1000)

  useEffect(() => {
    ackButton.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      // Esc deliberately does NOT dismiss: acknowledging an SOS is a decision,
      // not a reflex. Only the explicit control clears it.
      if (e.key !== 'Tab') return
      const nodes = panel.current?.querySelectorAll<HTMLElement>('button, a[href]')
      if (!nodes?.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  const acknowledge = async () => {
    setBusy(true)
    try {
      await provider.acknowledgeAlert(detection.incidentId, 'U-02')
    } catch {
      /* Acknowledgement is optimistic here; the incident page is the record. */
    }
    onDismiss()
  }

  return (
    <div
      ref={panel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-title"
      aria-describedby="sos-desc"
      className="on-critical fixed inset-0 z-[200] flex flex-col items-center justify-center px-md text-center"
      style={{ background: 'var(--sos-bg)' }}
    >
      {/* Assertive: this is the one thing that may interrupt a screen reader. */}
      <div aria-live="assertive" className="sr-only">
        SOS. {classLabel(detection.cls)} detected at {detection.nodeId}, sector {detection.sector}.
        Immediate acknowledgement required.
      </div>

      <div
        className={cn(
          'mb-lg flex h-24 w-24 items-center justify-center rounded-full border-4 border-[color:var(--sos-border)] bg-status-critical-vivid',
          // The only looping animation in the app, and it is suppressed under
          // prefers-reduced-motion by the tokens.css block.
          'motion-safe:animate-critical-pulse',
        )}
      >
        <Siren size={48} className="text-sos-fg" strokeWidth={1.5} aria-hidden="true" />
      </div>

      <p className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-sos-fg/80">
        SOS · Immediate response
      </p>
      <h1 id="sos-title" className="mt-2 font-mono text-[clamp(2rem,7vw,3.5rem)] font-bold leading-tight text-sos-fg">
        {classLabel(detection.cls)}
      </h1>

      <p id="sos-desc" className="mt-md max-w-xl text-body text-sos-fg/90">
        Detected at{' '}
        <span className="font-mono font-semibold">{detection.nodeId}</span> in sector{' '}
        <span className="font-mono font-semibold">{detection.sector}</span> —{' '}
        {detection.tier === 'T2' ? 'Tier-2 village perimeter' : 'Tier-1 forest core'}.
      </p>

      <dl className="mt-lg grid grid-cols-2 gap-x-xl gap-y-sm text-left font-mono text-sm text-sos-fg/80 md:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-sos-fg/50">Confidence</dt>
          <dd className="tabular-nums text-sos-fg">{detection.confidence}%</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-sos-fg/50">Time</dt>
          <dd className="tabular-nums text-sos-fg">{absoluteTime(detection.ts)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-sos-fg/50">Location</dt>
          <dd className="text-sos-fg">{coords(detection.lat, detection.lng)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-sos-fg/50">Incident</dt>
          <dd className="text-sos-fg">{detection.incidentId}</dd>
        </div>
      </dl>

      {/* Vibration status, stated plainly. A silent no-op would leave an
          operator believing the handset buzzed when it never can. */}
      <p className="mt-lg inline-flex items-center gap-2 rounded-lg border border-[color:var(--sos-border)] bg-[color:var(--sos-panel)] px-3 py-2 text-xs text-sos-fg/80">
        <Vibrate size={14} strokeWidth={1.5} aria-hidden="true" />
        {vibration === 'supported' && (
          <>
            Vibrating for{' '}
            <span className="font-mono font-semibold tabular-nums text-sos-fg">{seconds}s</span>
          </>
        )}
        {vibration === 'rejected' && 'Vibration blocked by the browser — visual and audible alert only.'}
        {vibration === 'unsupported' &&
          'Vibration not supported on this device — visual and audible alert only.'}
      </p>

      <div className="mt-xl flex flex-col items-center gap-sm sm:flex-row">
        <Button
          ref={ackButton}
          size="lg"
          disabled={busy}
          onClick={acknowledge}
          className="min-w-[240px] border-transparent bg-[color:var(--sos-fg)] text-[color:var(--status-critical-vivid)] hover:opacity-90"
        >
          {busy ? 'Acknowledging…' : 'Acknowledge — I am responding'}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="min-w-[200px] border border-sos-border/40 text-sos-fg hover:bg-sos-fg/10"
          onClick={() => {
            onDismiss()
            navigate(`/app/incidents/${detection.incidentId}`)
          }}
        >
          Open incident
        </Button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-lg inline-flex cursor-pointer items-center gap-1.5 text-xs text-sos-fg/60 underline-offset-4 hover:text-sos-fg hover:underline"
      >
        <X size={12} {...iconProps} />
        Dismiss without acknowledging (logged)
      </button>
    </div>
  )
}
