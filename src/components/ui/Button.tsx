import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  /** Reason a disabled button is disabled — goes into the accessible name,
   *  not a hover-only tooltip (device-detail.md §8). */
  disabledReason?: string
}

const VARIANTS: Record<Variant, string> = {
  // Master spec: primary CTA is the indigo accent, not the amber brand color.
  primary:
    'bg-accent text-on-accent hover:opacity-90 active:opacity-100 border border-transparent',
  secondary:
    'bg-transparent text-primary border-2 border-primary hover:bg-[color:var(--status-watch-fill)]',
  ghost:
    'bg-transparent text-fg-secondary border border-transparent hover:bg-surface-3 hover:text-fg',
  danger:
    'bg-transparent text-status-critical border border-status-critical hover:bg-[color:var(--status-critical-fill)]',
  subtle:
    'bg-surface-3 text-fg-secondary border border-border hover:bg-surface-4 hover:text-fg',
}

const SIZES: Record<Size, string> = {
  // 44px min height on the two larger sizes — touch target floor (README §10)
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-11 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-body gap-2 rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'subtle', size = 'md', icon, children, className, disabled, disabledReason, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-describedby={undefined}
      title={disabled && disabledReason ? disabledReason : rest.title}
      aria-label={
        disabled && disabledReason && typeof children === 'string'
          ? `${children} — ${disabledReason}`
          : rest['aria-label']
      }
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-all duration-base ease-out cursor-pointer',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  variant?: Variant
}

/** A standalone icon control always carries an aria-label (README §11). */
export function IconButton({ label, children, variant = 'ghost', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-lg',
        'transition-colors duration-base ease-out cursor-pointer',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
