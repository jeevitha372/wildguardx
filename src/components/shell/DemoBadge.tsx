/**
 * DEMO DATA badge — always visible in the app shell.
 *
 * Nothing in this app is real telemetry. The badge says so, and its popover
 * names the exact simulator settings in force so a viewer can tell a tuned
 * demo from a default one.
 */

import { useEffect, useRef, useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData, useMockProvider } from '@/data/DataContext'
import { describeConfig } from '@/data/simulatorConfig'
import { iconProps } from '@/components/domain/icons'

export function DemoBadge({ className }: { className?: string }) {
  const { provider, status } = useData()
  const mock = useMockProvider()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!provider.isDemo) return null

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1',
          'border-status-warning/50 bg-[color:var(--status-warning-fill)]',
          'font-mono text-[11px] font-bold tracking-wider text-status-warning',
          'transition-colors duration-base ease-out hover:bg-status-warning/20',
        )}
      >
        <FlaskConical size={12} {...iconProps} />
        DEMO DATA
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Demo data details"
          className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-border bg-surface-4 p-md shadow-xl animate-fade-in"
        >
          <div className="mb-sm flex items-start justify-between gap-md">
            <h2 className="text-h3 text-fg">Simulated data</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="cursor-pointer text-fg-muted hover:text-fg"
            >
              <X size={16} {...iconProps} />
            </button>
          </div>

          <p className="text-sm text-fg-secondary">
            Every value in this console is generated from seeded fixtures and a timer. No field
            hardware is connected and no number here has been measured.
          </p>

          <p className="mt-sm text-xs text-fg-muted">
            Placeholder for the ESP32-CAM → LoRaWAN → MQTT → Firebase ingest pipeline. See{' '}
            <code className="font-mono text-fg-secondary">src/data/MockProvider.ts</code>.
          </p>

          <div className="mt-md rounded-lg border border-border bg-surface-2 p-sm">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Source
            </div>
            <div className="font-mono text-xs text-fg-secondary">{status.sourceLabel}</div>
          </div>

          {mock && (
            <div className="mt-sm rounded-lg border border-border bg-surface-2 p-sm">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                Simulator settings
              </div>
              <ul className="space-y-1">
                {describeConfig(mock.config).map((line) => (
                  <li key={line} className="font-mono text-[11px] text-fg-secondary">
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-sm text-[11px] leading-relaxed text-fg-muted">
                Override with env vars (<code className="font-mono">VITE_DEMO_*</code>) or URL
                params, e.g.{' '}
                <code className="font-mono text-fg-secondary">?demo-interval=3000</code>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
