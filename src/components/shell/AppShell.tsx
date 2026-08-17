/**
 * App shell for all /app/* routes — pages/README.md §12.
 *
 * Sidebar 240px (lg+) / icon rail 64px (md) / bottom tab bar (sm).
 * Sticky 64px top bar. Skip link is the first focusable element.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  BellRing,
  Boxes,
  LayoutDashboard,
  type LucideIcon,
  Map as MapIcon,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Search,
  Settings,
  Siren,
  Sun,
  TreePine,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useSos } from '@/components/sos/SosProvider'
import { LiveBadge } from '@/components/ui/LiveBadge'
import { DemoBadge } from './DemoBadge'
import { StateSwitcher } from './StateSwitcher'
import { iconProps } from '@/components/domain/icons'
import { useTheme } from '@/lib/useTheme'
import { SparkBars } from '@/components/charts'
import type { Detection } from '@/data/types'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  group: 'ops' | 'admin'
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'ops' },
  { to: '/app/map', label: 'Map', icon: MapIcon, group: 'ops' },
  { to: '/app/alerts', label: 'Alerts', icon: Bell, group: 'ops' },
  { to: '/app/devices', label: 'Devices', icon: Boxes, group: 'ops' },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3, group: 'ops' },
  { to: '/app/team', label: 'Team', icon: Users, group: 'admin' },
  { to: '/app/notifications', label: 'Rules', icon: BellRing, group: 'admin' },
  { to: '/app/settings', label: 'Settings', icon: Settings, group: 'admin' },
]

const BREADCRUMBS: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/map': 'Map',
  '/app/alerts': 'Alerts',
  '/app/devices': 'Devices',
  '/app/analytics': 'Analytics',
  '/app/team': 'Team',
  '/app/notifications': 'Notifications',
  '/app/settings': 'Settings',
}

export function AppShell() {
  const location = useLocation()
  const { liveFeed } = useData()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const unacked = useMemo(() => liveFeed.filter((d) => d.status === 'active').length, [liveFeed])

  useEffect(() => setMobileNav(false), [location.pathname])

  const crumb =
    BREADCRUMBS[location.pathname] ??
    (location.pathname.includes('/incidents/')
      ? 'Incident'
      : location.pathname.includes('/devices/')
        ? 'Device'
        : 'WildGuardX')

  return (
    <div className="min-h-[100dvh] bg-surface-1">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* --- Sidebar (lg+) / icon rail (md) --------------------------------- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface-0 md:flex',
          'transition-[width] duration-base ease-out',
          collapsed ? 'w-[64px]' : 'w-[64px] lg:w-[240px]',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
          <TreePine size={22} className="shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
          {!collapsed && (
            <span className="hidden font-mono text-base font-semibold text-fg lg:inline">
              WildGuardX
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="Main">
          <SidebarGroup items={NAV.filter((n) => n.group === 'ops')} collapsed={collapsed} />
          <div className="my-2 border-t border-border" />
          <SidebarGroup items={NAV.filter((n) => n.group === 'admin')} collapsed={collapsed} />
        </nav>

        <div className="hidden border-t border-border p-2 lg:block">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-fg-muted transition-colors duration-base hover:bg-surface-3 hover:text-fg"
          >
            {collapsed ? (
              <PanelLeft size={18} {...iconProps} />
            ) : (
              <>
                <PanelLeftClose size={18} {...iconProps} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* --- Main column ---------------------------------------------------- */}
      <div className={cn('flex min-h-[100dvh] flex-col', collapsed ? 'md:pl-[64px]' : 'md:pl-[64px] lg:pl-[240px]')}>
        <header
          className="sticky top-0 z-30 flex h-16 items-center gap-md border-b border-border px-md"
          style={{ background: 'var(--topbar-bg)', backdropFilter: 'blur(12px)' }}
        >
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            className="-ml-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-fg-secondary hover:bg-surface-3 md:hidden"
          >
            <Menu size={20} {...iconProps} />
          </button>

          <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
            <ol className="flex items-center gap-2 text-sm">
              <li>
                <Link to="/app" className="text-fg-muted hover:text-fg">
                  WildGuardX
                </Link>
              </li>
              <li aria-hidden="true" className="text-fg-disabled">
                /
              </li>
              <li className="truncate font-medium text-fg" aria-current="page">
                {crumb}
              </li>
            </ol>
          </nav>

          {/* 24h detection strip — ambient volume, always in view (Task B) */}
          <DetectionStrip />

          <div className="flex-1" />

          <button
            type="button"
            className="hidden h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 text-sm text-fg-muted transition-colors duration-base hover:bg-surface-3 hover:text-fg-secondary lg:flex"
            aria-label="Open global search"
          >
            <Search size={14} {...iconProps} />
            Search
            <kbd className="ml-2 rounded border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
              ⌘K
            </kbd>
          </button>

          <ThemeToggle />
          <StateSwitcher className="hidden md:block" />
          <DemoBadge />
          <LiveBadge className="hidden sm:inline-flex" />
          <SosDemoButton />

          <Link
            to="/app/alerts"
            className="relative flex h-11 w-11 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-base hover:bg-surface-3 hover:text-fg"
            aria-label={`Alerts${unacked ? `, ${unacked} unacknowledged` : ''}`}
          >
            <Bell size={18} {...iconProps} />
            {unacked > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical-vivid px-1 font-mono text-[10px] font-bold text-[color:var(--color-on-accent)] tabular-nums">
                {unacked > 99 ? '99+' : unacked}
              </span>
            )}
          </Link>

          <button
            type="button"
            aria-label="User menu — Sathya Krishnasamy, Operator"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-3 font-mono text-xs font-semibold text-fg-secondary transition-colors duration-base hover:bg-surface-4"
          >
            SK
          </button>
        </header>

        <main id="main" className="flex-1 p-md pb-24 md:p-lg md:pb-lg">
          <Outlet />
        </main>
      </div>

      {/* --- Bottom tab bar (sm) -------------------------------------------- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface-0 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors duration-base',
                isActive ? 'text-primary' : 'text-fg-muted',
              )
            }
          >
            <item.icon size={18} {...iconProps} />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMobileNav(true)}
          className="flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-[10px] text-fg-muted"
        >
          <Menu size={18} {...iconProps} />
          More
        </button>
      </nav>

      {/* --- Mobile nav sheet ------------------------------------------------ */}
      {mobileNav && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => e.target === e.currentTarget && setMobileNav(false)}
        >
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface-4 p-lg">
            <div className="mx-auto mb-md h-1 w-10 rounded-full bg-surface-2" />
            <div className="mb-md flex items-center justify-between">
              <span className="font-mono text-base font-semibold text-fg">WildGuardX</span>
              <LiveBadge />
            </div>
            <div className="grid grid-cols-2 gap-sm">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-12 items-center gap-2.5 rounded-lg border px-3 text-sm',
                      isActive
                        ? 'border-primary bg-[color:var(--status-watch-fill)] text-fg'
                        : 'border-border bg-surface-2 text-fg-secondary',
                    )
                  }
                >
                  <item.icon size={18} {...iconProps} />
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-md flex items-center justify-between gap-sm">
              <StateSwitcher />
              <DemoBadge />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarGroup({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-base ease-out',
                isActive
                  ? 'bg-surface-3 font-medium text-fg'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg-secondary',
              )
            }
            title={item.label}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                )}
                <item.icon size={18} {...iconProps} className="shrink-0" />
                <span className={cn('truncate', collapsed ? 'hidden' : 'hidden lg:inline')}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

/**
 * Theme toggle. The icon shows the theme you will GET, not the one you are in —
 * a sun on a dark page reads as "switch to light", which is what people expect
 * from an action control.
 */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-fg-secondary transition-colors duration-base hover:bg-surface-3 hover:text-fg"
    >
      {theme === 'dark' ? <Sun size={18} {...iconProps} /> : <Moon size={18} {...iconProps} />}
    </button>
  )
}

/**
 * Ambient 24-hour detection volume. Not interactive and not a KPI — it exists
 * so an operator can see at a glance whether tonight is busier than usual
 * without leaving the page they are on.
 */
function DetectionStrip() {
  const { provider, tick } = useData()
  const [buckets, setBuckets] = useState<{ hour: number; value: number }[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let alive = true
    provider
      .getAlerts({ limit: 300 })
      .then((page) => {
        if (!alive) return
        const now = Date.now()
        const cutoff = now - 24 * 3600_000
        const rows = Array.from({ length: 24 }, (_, i) => ({ hour: i, value: 0 }))
        let count = 0
        for (const d of page.items as Detection[]) {
          if (d.ts < cutoff) continue
          const idx = 23 - Math.floor((now - d.ts) / 3600_000)
          if (idx < 0 || idx > 23) continue
          rows[idx].value += 1
          count += 1
        }
        setBuckets(rows)
        setTotal(count)
      })
      .catch(() => {
        /* the strip is ambient; a failure here must not disturb the shell */
      })
    return () => {
      alive = false
    }
  }, [provider, tick])

  if (!buckets.length) return null

  return (
    <div
      className="ml-md hidden w-[168px] shrink-0 xl:block"
      role="img"
      aria-label={`${total} detections in the last 24 hours`}
      title={`${total} detections in the last 24 hours`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-fg-muted">24h</span>
        <span className="font-mono text-[10px] tabular-nums text-fg-secondary">{total}</span>
      </div>
      <SparkBars data={buckets} height={20} color="var(--color-primary-vivid)" />
    </div>
  )
}

/** Demo-only control so the SOS takeover can be shown on request. */
function SosDemoButton() {
  const { triggerDemoSos } = useSos()
  const { provider } = useData()
  if (!provider.isDemo) return null
  return (
    <button
      type="button"
      onClick={triggerDemoSos}
      className="hidden h-8 cursor-pointer items-center gap-1.5 rounded-md border border-status-critical/50 bg-[color:var(--status-critical-fill)] px-2 font-mono text-[11px] font-bold tracking-wide text-status-critical transition-colors duration-base hover:bg-status-critical/20 lg:inline-flex"
      title="Demo: raise a 15-second SOS takeover"
    >
      <Siren size={12} {...iconProps} />
      TEST SOS
    </button>
  )
}
