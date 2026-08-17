/**
 * Team, roles & shifts — spec: design-system/wildguardx/pages/team.md
 *
 * Notable spec rules honoured here:
 *  - Initials avatars only. There is no photo-upload path: ranger identity
 *    photos are a safety exposure in anti-poaching work.
 *  - A presence-feed failure shows `Unknown`, never a stale `Available` —
 *    showing a ranger as available when the feed is down could send someone
 *    toward a threat with nobody actually en route.
 *  - Coverage gaps are the loudest element on the shift board.
 *  - Shift assignment is keyboard-operable, not drag-only.
 */

import { useMemo, useState } from 'react'
import { Download, Send, TriangleAlert, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData, rendersData } from '@/lib/dataState'
import type { TeamMember } from '@/data/types'
import { AsyncBoundary, EmptyState, SkeletonRows } from '@/components/ui/states'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { TabBar, TabPanel, useTabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { iconProps } from '@/components/domain/icons'
import { memberStatusLabel, relativeAge } from '@/lib/format'

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'shifts', label: 'Shift board' },
  { id: 'oncall', label: 'On-call' },
  { id: 'invites', label: 'Invitations' },
]

const SHIFTS = ['Day 06-14', 'Evening 14-22', 'Night 22-06']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SECTORS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']

const STATUS_TONE: Record<string, 'ok' | 'info' | 'warning' | 'offline' | 'critical' | 'neutral'> = {
  online: 'info',
  available: 'ok',
  responding: 'warning',
  off_duty: 'offline',
  off_grid: 'critical',
}

export function TeamPage() {
  const { provider } = useData()
  const { active, setActive } = useTabs({ tabs: TABS, defaultTab: 'roster' })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const query = useAsyncData<TeamMember[]>(() => provider.getTeam(), [provider], {
    isEmpty: (t) => t.length <= 1,
    emptyValue: [],
    partialSources: ['presence feed'],
  })

  // When the presence feed is the failed source, status must read Unknown.
  const presenceDown = query.state === 'partial'

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Team"
        count={query.data?.length}
        actions={
          <>
            <Button size="sm" variant="subtle" icon={<Download size={14} {...iconProps} />}>
              Export
            </Button>
            <Button size="sm" variant="primary" icon={<Users size={14} {...iconProps} />} onClick={() => setInviteOpen(true)}>
              Invite
            </Button>
          </>
        }
      />

      {/* --- On-shift strip: present on ALL tabs -------------------------- */}
      <AsyncBoundary
        query={query}
        className="mb-md"
        skeleton={<SkeletonRows rows={1} height={72} />}
        empty={
          <EmptyState
            title="You're the only member"
            body="Rangers need accounts so alerts can route to a person and acknowledgements can be attributed."
            action={
              <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                Invite your team
              </Button>
            }
          />
        }
      >
        {(team) => <OnShiftStrip members={team.filter((m) => m.onShift)} presenceDown={presenceDown} />}
      </AsyncBoundary>

      <TabBar tabs={TABS} active={active} onChange={setActive} className="mb-0" />

      <TabPanel id="roster" active={active}>
        <AsyncBoundary
          query={query}
          skeleton={<SkeletonRows rows={6} height={64} />}
          empty={
            <EmptyState
              title="No team members"
              body="Invite rangers, operators and technicians to route alerts to real people."
              action={
                <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                  Invite your team
                </Button>
              }
            />
          }
        >
          {(team) => (
            <>
              <div className="mb-md flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setMatrixOpen(true)}>
                  View permission matrix
                </Button>
              </div>
              <RosterTable
                team={team}
                presenceDown={presenceDown}
                revealed={revealed}
                onReveal={(id) => setRevealed((s) => new Set(s).add(id))}
                onRemove={setRemoveTarget}
              />
            </>
          )}
        </AsyncBoundary>
      </TabPanel>

      <TabPanel id="shifts" active={active}>
        <AsyncBoundary
          query={query}
          skeleton={<SkeletonRows rows={3} height={96} />}
          empty={<EmptyState title="Nothing scheduled" body="Start from last week or a template." />}
        >
          {(team) => <ShiftBoard team={team} />}
        </AsyncBoundary>
      </TabPanel>

      <TabPanel id="oncall" active={active}>
        <AsyncBoundary
          query={query}
          skeleton={<SkeletonRows rows={4} height={72} />}
          empty={<EmptyState title="No on-call ladders" body="Define an escalation ladder per sector." />}
        >
          {(team) => <OnCallTab team={team} />}
        </AsyncBoundary>
      </TabPanel>

      <TabPanel id="invites" active={active}>
        <InvitesTab onInvite={() => setInviteOpen(true)} />
      </TabPanel>

      {/* --- Modals -------------------------------------------------------- */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <PermissionMatrixModal open={matrixOpen} onClose={() => setMatrixOpen(false)} />
      <RemoveMemberModal member={removeTarget} onClose={() => setRemoveTarget(null)} />
    </div>
  )
}

/* ========================================================================== */

function OnShiftStrip({ members, presenceDown }: { members: TeamMember[]; presenceDown: boolean }) {
  // Off-grid first: a missing ranger in the field is a safety incident.
  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        const rank = (m: TeamMember) => (m.status === 'off_grid' ? 0 : m.status === 'responding' ? 1 : 2)
        return rank(a) - rank(b)
      }),
    [members],
  )

  return (
    <Card flat padding="md">
      <div className="mb-sm flex items-center gap-2">
        <h2 className="text-h3 text-fg">On shift now</h2>
        <Chip tone="ok">{members.length}</Chip>
      </div>
      <ul className="flex gap-sm overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sorted.map((m) => {
          const pingMinutes = (Date.now() - m.lastPing) / 60000
          const offGrid30 = pingMinutes > 30
          const offGrid15 = pingMinutes > 15
          return (
            <li
              key={m.id}
              className={cn(
                'flex min-w-[220px] shrink-0 items-center gap-2.5 rounded-lg border bg-surface-1 p-2.5',
                offGrid30
                  ? 'border-status-critical/50'
                  : offGrid15
                    ? 'border-status-warning/50'
                    : 'border-border',
              )}
            >
              <Avatar initials={m.initials} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">{m.name}</div>
                <div className="font-mono text-[11px] text-fg-muted">
                  {m.sectors.join(', ') || '—'} ·{' '}
                  {presenceDown ? 'as of unknown' : `${relativeAge(m.lastPing)} ago`}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusChip status={m.status} presenceDown={presenceDown} />
                {offGrid30 && !presenceDown && (
                  <button type="button" className="cursor-pointer text-[10px] text-status-critical hover:underline">
                    Start welfare check
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Never renders a stale "Available" when presence is unavailable. */
function StatusChip({ status, presenceDown }: { status: string; presenceDown: boolean }) {
  if (presenceDown) {
    return (
      <Chip tone="neutral" icon={<TriangleAlert size={11} {...iconProps} />}>
        Unknown
      </Chip>
    )
  }
  return <Chip tone={STATUS_TONE[status] ?? 'neutral'}>{memberStatusLabel(status)}</Chip>
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 font-mono text-xs font-semibold text-fg-secondary"
    >
      {initials}
    </span>
  )
}

function RosterTable({
  team,
  presenceDown,
  revealed,
  onReveal,
  onRemove,
}: {
  team: TeamMember[]
  presenceDown: boolean
  revealed: Set<string>
  onReveal: (id: string) => void
  onRemove: (m: TeamMember) => void
}) {
  const columns: Column<TeamMember>[] = [
    {
      key: 'name',
      header: 'Member',
      sortValue: (m) => m.name,
      sticky: true,
      render: (m) => (
        <span className="flex items-center gap-2.5">
          <Avatar initials={m.initials} />
          <span className="text-sm text-fg">{m.name}</span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', sortValue: (m) => m.role, render: (m) => <Chip tone="neutral">{m.role}</Chip> },
    {
      key: 'sectors',
      header: 'Sectors',
      render: (m) => <span className="font-mono text-xs">{m.sectors.join(', ') || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (m) => m.status,
      render: (m) => <StatusChip status={m.status} presenceDown={presenceDown} />,
    },
    {
      key: 'ping',
      header: 'Last ping',
      sortValue: (m) => m.lastPing,
      render: (m) =>
        presenceDown ? (
          <span className="font-mono text-xs text-fg-disabled">——</span>
        ) : (
          <span className="font-mono text-xs tabular-nums text-fg-secondary">
            {relativeAge(m.lastPing)} ago
          </span>
        ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (m) =>
        revealed.has(m.id) ? (
          <span className="font-mono text-xs">{m.phoneMasked.replace(/•/g, '4')}</span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onReveal(m.id)
            }}
            title="Revealing a contact number writes an audit entry"
            aria-label={`Phone hidden for ${m.name}, activate to reveal. This is recorded in the audit log.`}
            className="cursor-pointer font-mono text-xs text-fg-muted hover:text-fg hover:underline"
          >
            {m.phoneMasked}
          </button>
        ),
    },
    {
      key: 'radio',
      header: 'Radio',
      render: (m) => <span className="font-mono text-xs">{m.radioChannel}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(m)
            }}
            aria-label={`Remove ${m.name}`}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      caption="Team members with role, sector assignment, presence and contact channel"
      columns={columns}
      rows={team}
      rowKey={(m) => m.id}
      density="comfortable"
    />
  )
}

/* --- shift board ---------------------------------------------------------- */

function ShiftBoard({ team }: { team: TeamMember[] }) {
  const [assignments, setAssignments] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    DAYS.forEach((day) => {
      SHIFTS.forEach((shift) => {
        const key = `${day}|${shift}`
        init[key] = team.filter((m) => m.shift === shift && m.onShift).map((m) => m.id)
      })
    })
    return init
  })
  const [lifted, setLifted] = useState<{ member: string; from: string } | null>(null)

  const coverageFor = (key: string) => {
    const ids = assignments[key] ?? []
    const covered = new Set(ids.flatMap((id) => team.find((m) => m.id === id)?.sectors ?? []))
    return SECTORS.filter((s) => !covered.has(s))
  }

  const move = (to: string) => {
    if (!lifted) return
    setAssignments((a) => ({
      ...a,
      [lifted.from]: (a[lifted.from] ?? []).filter((id) => id !== lifted.member),
      [to]: [...(a[to] ?? []), lifted.member],
    }))
    setLifted(null)
  }

  return (
    <div>
      <div className="mb-md flex flex-wrap items-center gap-md">
        <p className="text-sm text-fg-muted">
          Uncovered sectors are flagged per cell. Night gaps are shown as critical.
        </p>
        <div className="flex-1" />
        <Button size="sm" variant="subtle">
          Copy last week
        </Button>
        <Button size="sm" variant="primary">
          Publish schedule
        </Button>
      </div>

      {lifted && (
        <div role="status" aria-live="polite" className="mb-md rounded-lg border border-status-info/40 bg-[color:var(--status-info-fill)] px-md py-2.5 text-sm text-status-info">
          {team.find((m) => m.id === lifted.member)?.name} lifted. Choose a cell to drop, or press
          Escape to cancel.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">Weekly shift assignments by day and shift window</caption>
          <thead>
            <tr className="border-b border-border bg-surface-3">
              <th scope="col" className="w-32 px-md py-2.5 text-left text-xs uppercase tracking-wide text-fg-muted">
                Shift
              </th>
              {DAYS.map((d) => (
                <th key={d} scope="col" className="px-md py-2.5 text-left text-xs uppercase tracking-wide text-fg-muted">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift) => (
              <tr key={shift} className="border-b border-border align-top">
                <th scope="row" className="px-md py-2.5 text-left font-mono text-xs text-fg-secondary">
                  {shift}
                </th>
                {DAYS.map((day) => {
                  const key = `${day}|${shift}`
                  const gaps = coverageFor(key)
                  const isNight = shift.startsWith('Night')
                  const hasGap = gaps.length > 0
                  return (
                    <td
                      key={key}
                      className={cn(
                        'min-w-[140px] border-l border-border p-1.5 align-top',
                        hasGap &&
                          (isNight
                            ? 'bg-[color:var(--status-critical-fill)] outline outline-1 -outline-offset-1 outline-status-critical/50'
                            : 'bg-[color:var(--status-warning-fill)] outline outline-1 -outline-offset-1 outline-status-warning/50'),
                      )}
                    >
                      <div className="space-y-1">
                        {(assignments[key] ?? []).map((id) => {
                          const m = team.find((x) => x.id === id)
                          if (!m) return null
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setLifted({ member: id, from: key })}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setLifted(null)
                              }}
                              aria-pressed={lifted?.member === id}
                              className={cn(
                                'flex w-full cursor-pointer items-center gap-1.5 rounded border px-1.5 py-1 text-left text-xs transition-colors duration-base',
                                lifted?.member === id
                                  ? 'border-status-info bg-[color:var(--status-info-fill)] text-status-info'
                                  : 'border-border bg-surface-2 text-fg-secondary hover:bg-surface-3',
                              )}
                            >
                              <span className="font-mono text-[10px]">{m.initials}</span>
                              <span className="truncate">{m.sectors.join(',') || '—'}</span>
                            </button>
                          )
                        })}

                        {lifted && (
                          <button
                            type="button"
                            onClick={() => move(key)}
                            className="w-full cursor-pointer rounded border border-dashed border-status-info px-1.5 py-1 text-[10px] text-status-info hover:bg-[color:var(--status-info-fill)]"
                          >
                            Drop here
                          </button>
                        )}

                        {hasGap && (
                          <span
                            className={cn(
                              'block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                              isNight ? 'text-status-critical' : 'text-status-warning',
                            )}
                            aria-label={`${day} ${shift}, no coverage for sectors ${gaps.join(', ')}`}
                          >
                            Gap: {gaps.join(' ')}
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* --- on-call -------------------------------------------------------------- */

function OnCallTab({ team }: { team: TeamMember[] }) {
  const [tested, setTested] = useState<string | null>(null)
  const rangers = team.filter((m) => m.role === 'Ranger')
  const manager = team.find((m) => m.role === 'Manager')

  return (
    <div className="space-y-md">
      <div className="rounded-lg border border-status-info/40 bg-[color:var(--status-info-fill)] px-md py-2.5 text-sm text-fg-secondary">
        <strong className="text-status-info">Override active:</strong> S7 primary set to A. Perumal
        until 06:00, by M. Lakshmi.
      </div>

      {['S7 · Masinagudi Perimeter', 'S3 · Riverine Belt'].map((sector, si) => (
        <Card key={sector} flat padding="lg">
          <CardHeader
            title={sector}
            subtitle="Escalation ladder — an untested ladder is an unverified assumption"
            actions={
              <Button
                size="sm"
                variant="subtle"
                icon={<Send size={13} {...iconProps} />}
                onClick={() => setTested(sector)}
              >
                Test escalation
              </Button>
            }
          />
          <ol className="space-y-2">
            {[
              { tier: 'Primary', member: rangers[si % rangers.length], channels: ['push', 'SMS'] },
              { tier: 'Secondary', member: rangers[(si + 1) % rangers.length], channels: ['SMS', 'voice'] },
              { tier: 'Manager', member: manager, channels: ['voice', 'radio'] },
            ].map((step, i) => (
              <li key={step.tier} className="flex items-center gap-md rounded-lg border border-border bg-surface-1 p-2.5">
                <span className="w-6 font-mono text-xs text-fg-muted">{i + 1}</span>
                <Avatar initials={step.member?.initials ?? '??'} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-fg">{step.member?.name ?? 'Unassigned'}</div>
                  <div className="font-mono text-[11px] text-fg-muted">
                    {step.tier} · {step.channels.join(' → ')}
                  </div>
                </div>
                {i > 0 && (
                  <span className="font-mono text-xs text-fg-muted">after {i * 4} min</span>
                )}
              </li>
            ))}
          </ol>

          {tested === sector && (
            <div role="status" className="mt-md rounded-lg border border-status-ok/40 bg-[color:var(--status-ok-fill)] px-md py-2.5 text-sm">
              <span className="font-semibold text-status-ok">Test complete.</span>{' '}
              <span className="text-fg-secondary">
                push delivered 0.8s · SMS delivered 3.2s · voice delivered 7.1s · radio failed
                (GATEWAY_TIMEOUT).
              </span>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function InvitesTab({ onInvite }: { onInvite: () => void }) {
  const invites = [
    { email: 'k.mani@forest.gov.in', role: 'Ranger', sectors: 'S6', by: 'M. Lakshmi', sentDays: 2, expiresDays: 5 },
    { email: 'p.suresh@forest.gov.in', role: 'Technician', sectors: 'S1, S2', by: 'M. Lakshmi', sentDays: 6, expiresDays: 1 },
  ]

  return (
    <Card flat padding="lg">
      <CardHeader
        title="Pending invitations"
        subtitle="Invitations expire after 7 days"
        actions={
          <Button size="sm" variant="primary" onClick={onInvite}>
            Invite member
          </Button>
        }
      />
      <ul className="space-y-sm">
        {invites.map((i) => (
          <li key={i.email} className="flex flex-wrap items-center gap-md rounded-lg border border-border bg-surface-1 p-md">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-fg">{i.email}</div>
              <div className="font-mono text-[11px] text-fg-muted">
                {i.role} · {i.sectors} · invited by {i.by} · sent {i.sentDays}d ago
              </div>
            </div>
            <Chip tone={i.expiresDays <= 1 ? 'warning' : 'neutral'}>
              expires in {i.expiresDays}d
            </Chip>
            <Button size="sm" variant="subtle">
              Resend
            </Button>
            <Button size="sm" variant="ghost">
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* --- modals ---------------------------------------------------------------- */

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [role, setRole] = useState('Ranger')
  const CAN_DO: Record<string, string> = {
    Ranger: 'Acknowledge and respond to alerts in their assigned sectors. Cannot change configuration.',
    Operator: 'Triage and dispatch every alert across all sectors. Cannot manage the team.',
    Technician: 'Configure and maintain devices. Read-only on alerts.',
    Manager: 'Everything an operator can do, plus team, shifts and escalation rules.',
    Admin: 'Full access including billing, API keys and organisation deletion.',
    Viewer: 'Read-only across the console. Cannot acknowledge or dispatch.',
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a team member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onClose}>
            Send invitation
          </Button>
        </>
      }
    >
      <label htmlFor="invite-email" className="block text-sm font-medium text-fg-secondary">
        Email
      </label>
      <input id="invite-email" type="email" className="input mt-1.5" placeholder="name@forest.gov.in" />

      <label htmlFor="invite-role" className="mt-md block text-sm font-medium text-fg-secondary">
        Role
      </label>
      <select
        id="invite-role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        aria-describedby="role-help"
        className="input mt-1.5 cursor-pointer"
      >
        {Object.keys(CAN_DO).map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      {/* State plainly what the role can do BEFORE sending */}
      <p id="role-help" className="mt-1.5 text-xs text-fg-muted">
        {CAN_DO[role]}
      </p>

      <label htmlFor="invite-sectors" className="mt-md block text-sm font-medium text-fg-secondary">
        Sectors
      </label>
      <input id="invite-sectors" className="input mt-1.5 font-mono" placeholder="S7, S8" />
    </Modal>
  )
}

const CAPABILITIES = [
  'View alerts',
  'Acknowledge',
  'Dispatch',
  'Configure devices',
  'Manage team',
  'Export data',
  'Manage billing',
]
const ROLES = ['Admin', 'Manager', 'Operator', 'Ranger', 'Technician', 'Viewer']
const GRANTS: Record<string, number[]> = {
  Admin: [1, 1, 1, 1, 1, 1, 1],
  Manager: [1, 1, 1, 1, 1, 1, 0],
  Operator: [1, 1, 1, 0, 0, 1, 0],
  Ranger: [1, 1, 1, 0, 0, 0, 0],
  Technician: [1, 0, 0, 1, 0, 0, 0],
  Viewer: [1, 0, 0, 0, 0, 0, 0],
}

function PermissionMatrixModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Permission matrix" size="lg">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Capabilities granted to each role</caption>
          <thead>
            <tr className="bg-surface-3">
              <th scope="col" className="px-3 py-2 text-left text-xs uppercase tracking-wide text-fg-muted">
                Capability
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-3 py-2 text-center text-xs text-fg-muted">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((cap, i) => (
              <tr key={cap} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-normal text-fg-secondary">
                  {cap}
                </th>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2 text-center">
                    {/* Icons with text alternatives, never colour-only ticks */}
                    {GRANTS[r][i] ? (
                      <span className="text-status-ok" title="Granted">
                        ✓<span className="sr-only">Granted</span>
                      </span>
                    ) : (
                      <span className="text-fg-disabled" title="Not granted">
                        —<span className="sr-only">Not granted</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-md text-xs text-fg-muted">
        Custom roles are not available in this version. Roles are fixed as shown.
      </p>
    </Modal>
  )
}

function RemoveMemberModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const match = member != null && typed.trim() === member.name

  return (
    <Modal
      open={member != null}
      onClose={() => {
        setTyped('')
        onClose()
      }}
      title={`Remove ${member?.name ?? ''}?`}
      description="Removing a member mid-shift breaks alert routing for their sectors. Their acknowledgement history is retained."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setTyped('')
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!match}
            onClick={() => {
              setTyped('')
              onClose()
            }}
          >
            Remove member
          </Button>
        </>
      }
    >
      <label htmlFor="confirm-name" className="block text-sm text-fg-secondary">
        Type <span className="font-mono text-fg">{member?.name}</span> to confirm
      </label>
      <input
        id="confirm-name"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="input mt-1.5"
        autoComplete="off"
      />
    </Modal>
  )
}
