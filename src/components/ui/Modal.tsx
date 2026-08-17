/**
 * Modal — dark surface, per pages/README.md §2.
 * The Master file's `background: white` is not used anywhere in this app.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'
import { iconProps } from '@/components/domain/icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** When false, clicking the overlay will not close (reveal-once key modal). */
  dismissOnOverlay?: boolean
}

const SIZES = {
  sm: 'max-w-[420px]',
  md: 'max-w-[500px]',
  lg: 'max-w-[720px]',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissOnOverlay = true,
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key !== 'Tab') return
      // Focus trap
      const focusables = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog
    window.setTimeout(() => {
      panel.current?.querySelector<HTMLElement>('button, input, [tabindex]')?.focus()
    }, 0)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-md"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => {
        if (dismissOnOverlay && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'w-full rounded-2xl border border-border bg-surface-4 p-xl shadow-xl',
          'max-h-[85vh] overflow-y-auto animate-fade-in',
          SIZES[size],
        )}
      >
        <div className="mb-md flex items-start justify-between gap-md">
          <div>
            <h2 id="modal-title" className="text-h2 text-fg">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-fg-secondary">{description}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose} className="-mr-2 -mt-2 shrink-0">
            <X size={18} {...iconProps} />
          </IconButton>
        </div>
        {children}
        {footer && <div className="mt-lg flex justify-end gap-sm">{footer}</div>}
      </div>
    </div>
  )
}

/** Bottom sheet — the `sm` breakpoint substitute for a modal (README §10). */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end"
      style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface-4 p-lg"
        style={{ paddingBottom: 'calc(var(--space-lg) + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-md h-1 w-10 rounded-full bg-surface-2" />
        <div className="mb-md flex items-center justify-between">
          <h2 className="text-h3 text-fg">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} {...iconProps} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}
