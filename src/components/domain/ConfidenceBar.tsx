import { cn } from '@/lib/cn'

/**
 * A model score shown without its scale invites misreading (alerts.md §3.4),
 * so confidence is always number + 3-segment bar, exposed as role="meter".
 */
export function ConfidenceBar({
  value,
  className,
  showValue = true,
}: {
  value: number
  className?: string
  showValue?: boolean
}) {
  const band = value >= 85 ? 3 : value >= 70 ? 2 : 1
  const bandLabel = band === 3 ? 'high' : band === 2 ? 'medium' : 'low'
  const tone =
    band === 3 ? 'bg-status-ok' : band === 2 ? 'bg-status-warning' : 'bg-status-offline'

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {showValue && (
        <span className="font-mono text-xs tabular-nums text-fg-secondary">{value}%</span>
      )}
      <span
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${value} percent confidence, ${bandLabel}`}
        className="inline-flex gap-0.5"
      >
        {[1, 2, 3].map((seg) => (
          <span
            key={seg}
            className={cn('h-3 w-1.5 rounded-sm', seg <= band ? tone : 'bg-surface-4')}
          />
        ))}
      </span>
    </span>
  )
}

/** Battery: value + bar + charging state, as role="meter" (devices.md §8). */
export function BatteryCell({
  percent,
  charging,
  offline,
}: {
  percent: number
  charging?: boolean
  offline?: boolean
}) {
  // An offline node's last-known battery must never render as if current.
  if (offline) {
    return (
      <span className="font-mono text-xs tabular-nums text-fg-disabled" title="No heartbeat — value unknown">
        ——
      </span>
    )
  }

  const tone =
    percent < 15 ? 'bg-status-critical' : percent < 30 ? 'bg-status-warning' : 'bg-status-ok'
  const label = percent < 15 ? 'critical' : percent < 30 ? 'low' : 'normal'

  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-9 font-mono text-xs tabular-nums text-fg-secondary">{percent}%</span>
      <span
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent} percent, ${label}${charging ? ', charging' : ''}`}
        className="relative h-1.5 w-14 overflow-hidden rounded-full bg-surface-4"
      >
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full', tone)}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </span>
      {charging && (
        <span className="text-[10px] font-semibold text-status-ok" title="Solar charging">
          PV
        </span>
      )}
    </span>
  )
}

/** RSSI as bars + a text equivalent in the accessible name. */
export function SignalCell({ rssi, offline }: { rssi: number; offline?: boolean }) {
  if (offline || rssi === -999) {
    return (
      <span className="font-mono text-xs text-fg-disabled" title="No heartbeat — value unknown">
        ——
      </span>
    )
  }
  const bars = rssi > -75 ? 4 : rssi > -90 ? 3 : rssi > -105 ? 2 : 1
  return (
    <span
      className="inline-flex items-end gap-0.5"
      title={`${rssi} dBm`}
      aria-label={`Signal ${bars} of 4, ${rssi} dBm`}
      role="img"
    >
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={cn('w-1 rounded-sm', b <= bars ? 'bg-status-ok' : 'bg-surface-4')}
          style={{ height: 4 + b * 2 }}
        />
      ))}
    </span>
  )
}
