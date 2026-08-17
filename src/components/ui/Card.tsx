import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Opt in to pointer + lift. Static cards must NOT set this — the Master
   *  file's blanket `cursor:pointer` on `.card` lies about affordance. */
  interactive?: boolean
  /** Dashboard density: borders separate, shadows are dropped (dashboard.md §1). */
  flat?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PADDING = {
  none: '',
  sm: 'p-sm',
  md: 'p-md',
  lg: 'p-lg',
}

export function Card({
  interactive = false,
  flat = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-2',
        !flat && 'shadow-md',
        PADDING[padding],
        interactive &&
          'cursor-pointer transition-colors duration-base ease-out hover:bg-surface-3 hover:border-ring/30',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  /** Plain-language line stating what this card answers (analytics.md §4). */
  subtitle?: ReactNode
  actions?: ReactNode
  id?: string
  /**
   * Adds a very low-alpha brand wash behind the header, mixed over the card
   * surface with color-mix so it works in both themes without introducing a
   * second surface colour. Purely structural — never carries meaning.
   */
  wash?: boolean | 'critical' | 'warning' | 'watch' | 'info'
  icon?: ReactNode
}

const WASH_CLASS: Record<string, string> = {
  critical: 'sev-wash-critical',
  warning: 'sev-wash-warning',
  watch: 'sev-wash-watch',
  info: 'sev-wash-info',
}

export function CardHeader({ title, subtitle, actions, id, wash, icon }: CardHeaderProps) {
  const washClass =
    wash === true ? 'card-header-wash' : typeof wash === 'string' ? WASH_CLASS[wash] : undefined

  return (
    <div
      className={cn(
        'mb-md flex items-start justify-between gap-md',
        // The wash bleeds to the card edge, so it needs the padding back.
        washClass && '-mx-lg -mt-lg rounded-t-xl border-b border-border px-lg py-md',
        washClass,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 shrink-0 text-primary">{icon}</span>}
        <div className="min-w-0">
          <h2 id={id} className="text-h3 text-fg">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-sm">{actions}</div>}
    </div>
  )
}

export function CardSection({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('border-t border-border pt-md mt-md', className)}>{children}</div>
}
