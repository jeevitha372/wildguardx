import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({
  title,
  count,
  description,
  actions,
  className,
}: {
  title: string
  count?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-lg flex flex-wrap items-start justify-between gap-md', className)}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-h1 text-fg">{title}</h1>
          {count != null && (
            <span className="font-mono text-h3 tabular-nums text-fg-muted">{count}</span>
          )}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-sm">{actions}</div>}
    </div>
  )
}
