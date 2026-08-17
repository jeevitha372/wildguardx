/**
 * DataTable — a real <table> with <caption>, scope'd headers and aria-sort
 * (devices.md §8). Sortable headers are <button>s inside <th>.
 *
 * Horizontal overflow is contained here, never on <body>.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { iconProps } from '@/components/domain/icons'

export interface Column<T> {
  key: string
  header: string
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number
  render: (row: T) => ReactNode
  className?: string
  /** Sticky on horizontal scroll (first columns). */
  sticky?: boolean
  align?: 'left' | 'right'
}

interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowActivate?: (row: T) => void
  /** Comfortable = 64px, compact = 48px (devices.md §1). */
  density?: 'comfortable' | 'compact'
  selectedKeys?: Set<string>
  onToggleSelect?: (key: string) => void
  emptyLabel?: string
  className?: string
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  onRowActivate,
  density = 'comfortable',
  selectedKeys,
  onToggleSelect,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [rows, sortKey, sortDir, columns])

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const rowHeight = density === 'compact' ? 'h-12' : 'h-16'

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border', className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-surface-3">
            {onToggleSelect && (
              <th scope="col" className="w-10 px-md py-2.5 text-left">
                <span className="sr-only">Select</span>
              </th>
            )}
            {columns.map((col) => {
              const isSorted = sortKey === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn(
                    'px-md py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.sticky && 'sticky left-0 z-10 bg-surface-3',
                    col.className,
                  )}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex cursor-pointer items-center gap-1 transition-colors duration-base hover:text-fg"
                    >
                      {col.header}
                      {isSorted &&
                        (sortDir === 'asc' ? (
                          <ChevronUp size={12} {...iconProps} />
                        ) : (
                          <ChevronDown size={12} {...iconProps} />
                        ))}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row)
            const selected = selectedKeys?.has(key)
            return (
              <tr
                key={key}
                tabIndex={onRowActivate ? 0 : undefined}
                onClick={onRowActivate ? () => onRowActivate(row) : undefined}
                onKeyDown={
                  onRowActivate
                    ? (e) => {
                        if (e.key === 'Enter') onRowActivate(row)
                      }
                    : undefined
                }
                className={cn(
                  rowHeight,
                  'border-b border-border transition-colors duration-base ease-out',
                  // Background shift only — table rows must never move (devices.md §1)
                  onRowActivate && 'cursor-pointer hover:bg-surface-3',
                  selected && 'bg-[color:var(--status-watch-fill)]',
                )}
              >
                {onToggleSelect && (
                  <td className="px-md">
                    <input
                      type="checkbox"
                      checked={selected ?? false}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelect(key)}
                      aria-label={`Select ${key}`}
                      className="h-4 w-4 cursor-pointer accent-[color:var(--color-primary)]"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-md text-fg-secondary',
                      col.align === 'right' && 'text-right',
                      col.sticky && 'sticky left-0 z-10 bg-surface-2',
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
