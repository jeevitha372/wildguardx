/**
 * Notifications & escalation rules — spec: pages/notifications.md
 *
 * MASTER.md names "No automation" as an anti-pattern, so this is where
 * automation is authored and it is a first-class surface.
 *
 * Notable spec rules honoured here:
 *  - The rule preview names the ACTUAL people who would be paged, by channel,
 *    given the current shift. Nobody should publish a 2am page blind.
 *  - Escalation ladders require a terminal step.
 *  - Quiet hours cannot suppress critical severity — the control is present,
 *    disabled, with the reason stated inline.
 *  - Suppressed deliveries always state why.
 *  - Test alerts are labelled [TEST] and excluded from statistics.
 */

import { useMemo, useState } from 'react'
import { GripVertical, Plus, Send, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { DeliveryChannel, DeliveryLogEntry, EscalationRule, TeamMember } from '@/data/types'
import { AsyncBoundary, EmptyState, SkeletonRows } from '@/components/ui/states'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { TabBar, TabPanel, useTabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { iconProps } from '@/components/domain/icons'
import { absoluteDateTime, relativeAge } from '@/lib/format'

const TABS = [
  { id: 'rules', label: 'Rules' },
  { id: 'channels', label: 'Channels' },
  { id: 'preferences', label: 'My preferences' },
  { id: 'log', label: 'Delivery log' },
]

export function NotificationsPage() {
  const { provider } = useData()
  const { active, setActive } = useTabs({ tabs: TABS, defaultTab: 'rules' })
  const [editing, setEditing] = useState<EscalationRule | null>(null)
  const [testResult, setTestResult] = useState<DeliveryLogEntry[] | null>(null)

  const rulesQuery = useAsyncData<EscalationRule[]>(() => provider.getRules(), [provider], {
    isEmpty: (r) => r.length === 0,
    emptyValue: [],
    partialSources: ['rule preview service'],
  })

  const channelsQuery = useAsyncData<DeliveryChannel[]>(() => provider.getChannels(), [provider], {
    isEmpty: (c) => c.length === 0,
    emptyValue: [],
  })

  const logQuery = useAsyncData(() => provider.getDeliveryLog(80), [provider], {
    isEmpty: (p) => p.items.length === 0,
    emptyValue: { items: [] as DeliveryLogEntry[], total: 0, nextCursor: null },
  })

  const teamQuery = useAsyncData<TeamMember[]>(() => provider.getTeam(), [provider], {
    isEmpty: (t) => t.length === 0,
    emptyValue: [],
  })

  const runTest = async (ruleId: string) => {
    const entries = await provider.sendTestAlert(ruleId)
    setTestResult(entries)
    logQuery.retry()
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Notifications"
        description="What wakes someone up at 2am, on which channel, and the proof it will reach them."
        actions={
          <Button size="sm" variant="primary" icon={<Plus size={14} {...iconProps} />}>
            New rule
          </Button>
        }
      />

      <TabBar tabs={TABS} active={active} onChange={setActive} />

      <TabPanel id="rules" active={active}>
        <AsyncBoundary
          query={rulesQuery}
          skeleton={<SkeletonRows rows={4} height={120} />}
          empty={
            <div className="rounded-xl border border-status-warning/40 bg-[color:var(--status-warning-fill)]">
              <EmptyState
                icon={<TriangleAlert size={26} {...iconProps} />}
                title="No escalation rules yet"
                body="Detections will still be recorded, but nobody will be notified. Start from a template."
                action={
                  <>
                    <Button variant="primary" size="sm">
                      Gunshot → on-call
                    </Button>
                    <Button variant="subtle" size="sm">
                      Perimeter breach
                    </Button>
                    <Button variant="subtle" size="sm">
                      Node offline
                    </Button>
                  </>
                }
              />
            </div>
          }
        >
          {(rules) => (
            <ol className="space-y-sm">
              {rules.map((rule, i) => (
                <li key={rule.id}>
                  <RuleCard
                    rule={rule}
                    order={i + 1}
                    onEdit={() => setEditing(rule)}
                    onTest={() => runTest(rule.id)}
                    onToggle={async (enabled) => {
                      await provider.toggleRule(rule.id, enabled)
                      rulesQuery.retry()
                    }}
                  />
                </li>
              ))}
            </ol>
          )}
        </AsyncBoundary>
      </TabPanel>

      <TabPanel id="channels" active={active}>
        <AsyncBoundary
          query={channelsQuery}
          skeleton={<SkeletonRows rows={5} height={96} />}
          empty={<EmptyState title="No channels configured" body="Connect at least one delivery channel." />}
        >
          {(channels) => (
            <div className="grid gap-md md:grid-cols-2">
              {channels.map((c) => (
                <ChannelCard key={c.id} channel={c} />
              ))}
            </div>
          )}
        </AsyncBoundary>
      </TabPanel>

      <TabPanel id="preferences" active={active}>
        <PreferencesTab />
      </TabPanel>

      <TabPanel id="log" active={active}>
        <AsyncBoundary
          query={logQuery}
          skeleton={<SkeletonRows rows={8} height={48} />}
          empty={
            <EmptyState
              title="No deliveries in this range"
              body="Nothing has been sent in the selected window."
              action={
                <Button variant="primary" size="sm" onClick={() => runTest('R-1')}>
                  Send a test
                </Button>
              }
            />
          }
        >
          {(page) => <DeliveryLogTable entries={page.items} />}
        </AsyncBoundary>
      </TabPanel>

      {editing && (
        <RuleEditor
          rule={editing}
          team={teamQuery.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      {testResult && (
        <Modal
          open
          onClose={() => setTestResult(null)}
          title="Test escalation sent"
          description="A synthetic, clearly-labelled alert was delivered. It creates no incident and is excluded from statistics."
          footer={
            <Button variant="primary" onClick={() => setTestResult(null)}>
              Close
            </Button>
          }
        >
          <ul className="space-y-1.5">
            {testResult.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-md rounded-lg border border-border bg-surface-2 p-2.5 text-sm"
              >
                <Chip tone="neutral" mono>
                  {e.channel}
                </Chip>
                <span className="min-w-0 flex-1 truncate text-fg-secondary">{e.recipient}</span>
                <Chip tone={e.status === 'delivered' ? 'ok' : 'critical'}>{e.status}</Chip>
                <span className="font-mono text-xs tabular-nums text-fg-muted">
                  {e.latencyMs != null ? `${e.latencyMs}ms` : '—'}
                </span>
              </li>
            ))}
          </ul>
          {testResult.some((e) => e.status === 'failed') && (
            <p className="mt-md rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] px-md py-2.5 font-mono text-xs text-fg-secondary">
              {testResult.find((e) => e.status === 'failed')?.reason}
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}

/* ========================================================================== */

function RuleCard({
  rule,
  order,
  onEdit,
  onTest,
  onToggle,
}: {
  rule: EscalationRule
  order: number
  onEdit: () => void
  onTest: () => void
  onToggle: (enabled: boolean) => void
}) {
  const whenText = rule.when.map((c) => `${c.field} ${c.op} ${c.value}`).join(` ${rule.join} `)
  const thenText = rule.then
    .map((a) =>
      a.action === 'notify'
        ? `notify ${a.recipients} via ${a.channels?.join(' + ')}`
        : a.action.replace(/_/g, ' '),
    )
    .join(', ')

  const neverFired = rule.lastFiredMinutesAgo == null
  const lowDelivery = rule.deliveryRate > 0 && rule.deliveryRate < 95

  return (
    <Card flat padding="md" className={cn(!rule.enabled && 'opacity-60')}>
      <div className="flex items-start gap-md">
        <button
          type="button"
          aria-label={`Reorder ${rule.name}. Currently position ${order}.`}
          className="mt-0.5 cursor-grab text-fg-muted hover:text-fg"
        >
          <GripVertical size={16} {...iconProps} />
        </button>
        <span className="mt-0.5 font-mono text-xs tabular-nums text-fg-muted">{order}</span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h3 text-fg">{rule.name}</h3>
            {neverFired && <Chip tone="neutral">Never fired — review</Chip>}
            {lowDelivery && <Chip tone="warning">Delivery {rule.deliveryRate}%</Chip>}
          </div>

          <dl className="mt-1.5 space-y-0.5 font-mono text-xs">
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-status-info">WHEN</dt>
              <dd className="text-fg-secondary">{whenText}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-status-ok">THEN</dt>
              <dd className="text-fg-secondary">{thenText}</dd>
            </div>
            {rule.escalate.length > 0 && (
              <div className="flex gap-2">
                <dt className="w-14 shrink-0 text-status-warning">ELSE</dt>
                <dd className="text-fg-secondary">
                  {rule.escalate
                    .map((s) => `after ${s.afterMinutes}m → ${s.tier} (${s.channels.join('+')})`)
                    .join('; ')}
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-1.5 text-xs text-fg-muted">
            {neverFired ? 'Never fired' : `Last fired ${relativeAge(Date.now() - rule.lastFiredMinutesAgo! * 60_000)} ago`}
            {' · '}
            {rule.firedCount30d} times / 30d
            {' · '}
            {rule.deliveryRate}% delivered
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-sm">
          <label className="flex cursor-pointer items-center gap-1.5">
            <span className="sr-only">Enable {rule.name}</span>
            <input
              type="checkbox"
              role="switch"
              checked={rule.enabled}
              aria-checked={rule.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[color:var(--color-primary)]"
            />
          </label>
          <Button size="sm" variant="ghost" onClick={onTest} icon={<Send size={13} {...iconProps} />}>
            Test
          </Button>
          <Button size="sm" variant="subtle" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* --- rule editor with the live preview panel ------------------------------ */

function RuleEditor({
  rule,
  team,
  onClose,
}: {
  rule: EscalationRule
  team: TeamMember[]
  onClose: () => void
}) {
  const [conditions, setConditions] = useState(rule.when)
  const [ladder, setLadder] = useState(rule.escalate)
  const [quietHours, setQuietHours] = useState(false)

  // Who would actually be paged, right now, given the current shift.
  const recipients = useMemo(() => {
    const onShift = team.filter((m) => m.onShift && m.role === 'Ranger')
    const manager = team.find((m) => m.role === 'Manager')
    return [
      ...onShift.map((m) => ({ name: m.name, channels: ['push', 'SMS'], tier: 'Primary' })),
      ...(manager ? [{ name: manager.name, channels: ['voice', 'radio'], tier: 'Manager' }] : []),
    ]
  }, [team])

  // Publish is blocked without a terminal escalation step.
  const hasTerminal = ladder.length > 0
  const errors = [
    !hasTerminal && 'Escalation ladder needs a terminal step — every ladder must end at someone definitely reachable.',
    conditions.length === 0 && 'At least one condition is required.',
    recipients.length === 0 && 'Recipient set is empty — nobody would be notified.',
  ].filter(Boolean) as string[]

  return (
    <Modal
      open
      onClose={onClose}
      title={rule.name}
      description="Draft → preview → publish. A rule change alters who gets woken up."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="subtle">Save draft</Button>
          <Button
            variant="primary"
            disabled={errors.length > 0}
            disabledReason={errors[0]}
            onClick={onClose}
          >
            Publish
          </Button>
        </>
      }
    >
      <div className="space-y-lg">
        {/* WHEN */}
        <fieldset>
          <legend className="mb-sm text-xs font-semibold uppercase tracking-wide text-status-info">
            When
          </legend>
          <div className="space-y-1.5">
            {conditions.map((c, i) => (
              <div
                key={i}
                role="group"
                aria-label={`Condition ${i + 1}`}
                className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-2 p-2"
              >
                <select
                  aria-label={`Condition ${i + 1}, field`}
                  defaultValue={c.field}
                  className="input h-9 w-[130px] py-0 text-xs"
                >
                  {['class', 'confidence', 'severity', 'sector', 'tier', 'time', 'device_status'].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <select
                  aria-label={`Condition ${i + 1}, operator`}
                  defaultValue={c.op}
                  className="input h-9 w-[80px] py-0 text-xs"
                >
                  {['is', 'is not', '>=', '<=', 'between'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <input
                  aria-label={`Condition ${i + 1}, value`}
                  defaultValue={String(c.value)}
                  className="input h-9 flex-1 py-0 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))}
                  aria-label={`Remove condition ${i + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="subtle"
            className="mt-sm"
            onClick={() => setConditions((cs) => [...cs, { field: 'class', op: 'is', value: '' }])}
          >
            Add condition
          </Button>
        </fieldset>

        {/* ESCALATE */}
        <fieldset>
          <legend className="mb-sm text-xs font-semibold uppercase tracking-wide text-status-warning">
            Escalate
          </legend>
          <div className="space-y-1.5">
            {ladder.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-2 p-2 text-xs">
                <span className="text-fg-muted">If not acknowledged within</span>
                <input
                  aria-label={`Escalation step ${i + 1}, minutes`}
                  type="number"
                  defaultValue={s.afterMinutes}
                  className="input h-9 w-16 py-0 text-xs"
                />
                <span className="text-fg-muted">min, notify</span>
                <input
                  aria-label={`Escalation step ${i + 1}, tier`}
                  defaultValue={s.tier}
                  className="input h-9 flex-1 py-0 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLadder((l) => l.filter((_, j) => j !== i))}
                  aria-label={`Remove escalation step ${i + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="subtle"
            className="mt-sm"
            onClick={() => setLadder((l) => [...l, { afterMinutes: 5, tier: 'Range manager', channels: ['voice'] }])}
          >
            Add step
          </Button>
        </fieldset>

        {/* Quiet hours — cannot suppress critical */}
        <fieldset className="rounded-lg border border-border bg-surface-2 p-md">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Quiet hours
          </legend>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={quietHours}
              onChange={(e) => setQuietHours(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[color:var(--color-primary)]"
            />
            Suppress non-critical notifications 22:00–06:00
          </label>
          <label className="mt-sm flex items-start gap-2.5 text-sm text-fg-disabled">
            <input type="checkbox" disabled aria-describedby="critical-reason" className="mt-0.5 h-4 w-4" />
            <span>
              Also suppress critical
              <span id="critical-reason" className="block text-xs">
                Not permitted. Critical severity always delivers — a life-safety alert may not be
                muted by a schedule.
              </span>
            </span>
          </label>
        </fieldset>

        {/* Live preview — names the actual people */}
        <div className="rounded-lg border border-status-info/40 bg-[color:var(--status-info-fill)] p-md">
          <h4 className="text-sm font-semibold text-status-info">Preview</h4>
          <p aria-live="polite" className="mt-1 text-sm text-fg-secondary">
            This rule would have fired <span className="font-mono text-fg">{rule.firedCount30d}</span>{' '}
            times in the last 30 days.
          </p>
          <p className="mt-sm text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Who would be paged right now
          </p>
          <ul className="mt-1.5 space-y-1">
            {recipients.map((r) => (
              <li key={r.name} className="flex items-center gap-2 font-mono text-xs">
                <span className="text-fg">{r.name}</span>
                <span className="text-fg-muted">
                  {r.tier} · {r.channels.join(' + ')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {errors.length > 0 && (
          <div role="alert" className="rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] p-md">
            <p className="text-sm font-semibold text-status-critical">
              {errors.length} issue{errors.length > 1 ? 's' : ''} blocking publish
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-fg-secondary">
              {errors.map((e) => (
                <li key={e}>· {e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* --- channels -------------------------------------------------------------- */

function ChannelCard({ channel: c }: { channel: DeliveryChannel }) {
  return (
    <Card flat padding="lg">
      <CardHeader
        title={c.name}
        subtitle={c.provider}
        actions={
          <Chip
            tone={c.status === 'connected' ? 'ok' : c.status === 'degraded' ? 'warning' : 'critical'}
          >
            {c.status}
          </Chip>
        }
      />
      <dl className="grid grid-cols-3 gap-md">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">Delivery</dt>
          <dd className="font-mono text-lg tabular-nums text-fg">{c.deliveryRate}%</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">Median latency</dt>
          <dd className="font-mono text-lg tabular-nums text-fg">
            {(c.medianLatencyMs / 1000).toFixed(1)}s
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">Cost / msg</dt>
          <dd className="font-mono text-lg tabular-nums text-fg">
            {c.costPerMessage ? `₹${c.costPerMessage}` : '—'}
          </dd>
        </div>
      </dl>

      {c.lastError && (
        <div className="mt-md rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] p-2.5">
          {/* Raw provider error verbatim — an operator debugging an outage needs it */}
          <p className="font-mono text-[11px] text-fg-secondary">{c.lastError}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {c.id === 'radio'
              ? 'The DMR repeater is not acknowledging. Radio delivery is falling back to voice.'
              : 'The integration token was revoked. Reconnect to restore delivery.'}
          </p>
        </div>
      )}

      <div className="mt-md flex gap-sm">
        <Button size="sm" variant="subtle" icon={<Send size={13} {...iconProps} />}>
          Send test
        </Button>
        <Button size="sm" variant="ghost">
          Configure
        </Button>
      </div>
    </Card>
  )
}

/* --- my preferences -------------------------------------------------------- */

function PreferencesTab() {
  const [prefs, setPrefs] = useState<Record<string, string[]>>({
    critical: ['push', 'sms', 'voice'],
    warning: ['push', 'sms'],
    watch: ['push'],
    info: [],
  })

  const toggle = (severity: string, channel: string) =>
    setPrefs((p) => {
      const cur = p[severity] ?? []
      return {
        ...p,
        [severity]: cur.includes(channel) ? cur.filter((c) => c !== channel) : [...cur, channel],
      }
    })

  return (
    <div className="space-y-md">
      <Card flat padding="lg">
        <CardHeader
          title="Channel preferences"
          subtitle="Per severity. The effective outcome is stated on each row — these matrices are easy to misconfigure."
        />
        <div className="space-y-md">
          {(['critical', 'warning', 'watch', 'info'] as const).map((sev) => {
            const locked = sev === 'critical'
            const effective = locked
              ? ['push', 'sms', 'voice']
              : prefs[sev]
            return (
              <div key={sev} className="rounded-lg border border-border bg-surface-1 p-md">
                <div className="mb-sm flex items-center gap-2">
                  <span className="text-sm font-medium capitalize text-fg">{sev}</span>
                  {locked && <Chip tone="critical">Always delivers</Chip>}
                </div>
                <div className="flex flex-wrap gap-md">
                  {['push', 'sms', 'voice', 'email'].map((ch) => (
                    <label
                      key={ch}
                      className={cn(
                        'flex items-center gap-1.5 text-sm',
                        locked ? 'cursor-not-allowed text-fg-disabled' : 'cursor-pointer text-fg-secondary',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={effective.includes(ch)}
                        disabled={locked}
                        onChange={() => toggle(sev, ch)}
                        className="h-4 w-4 accent-[color:var(--color-primary)]"
                      />
                      {ch}
                    </label>
                  ))}
                </div>
                <p className="mt-sm font-mono text-[11px] text-fg-muted">
                  You will receive: {effective.length ? effective.join(' + ') : 'nothing'}
                  {locked && ' — critical alerts cannot be disabled.'}
                </p>
              </div>
            )
          })}
        </div>
      </Card>

      <Card flat padding="lg">
        <CardHeader title="Do not disturb" subtitle="Requires an end time — an open-ended DND gets forgotten" />
        <div className="flex flex-wrap items-end gap-md">
          <label className="text-sm text-fg-secondary">
            <span className="mb-1 block text-xs text-fg-muted">Until</span>
            <input type="time" className="input h-10 w-[140px] py-0" defaultValue="06:00" />
          </label>
          <Button size="sm" variant="subtle">
            Enable DND
          </Button>
          <p className="text-xs text-fg-muted">Critical alerts still deliver during DND.</p>
        </div>
      </Card>
    </div>
  )
}

/* --- delivery log ---------------------------------------------------------- */

function DeliveryLogTable({ entries }: { entries: DeliveryLogEntry[] }) {
  const columns: Column<DeliveryLogEntry>[] = [
    {
      key: 'ts',
      header: 'Time',
      sortValue: (e) => e.ts,
      sticky: true,
      render: (e) => (
        <time dateTime={new Date(e.ts).toISOString()} className="font-mono text-xs tabular-nums">
          {absoluteDateTime(e.ts)}
        </time>
      ),
    },
    {
      key: 'rule',
      header: 'Rule',
      sortValue: (e) => e.ruleName,
      render: (e) => (
        <span className="flex items-center gap-1.5 text-xs">
          {e.isTest && <Chip tone="info">TEST</Chip>}
          <span className="truncate text-fg-secondary">{e.ruleName}</span>
        </span>
      ),
    },
    { key: 'recipient', header: 'Recipient', sortValue: (e) => e.recipient, render: (e) => <span className="text-xs">{e.recipient}</span> },
    { key: 'channel', header: 'Channel', sortValue: (e) => e.channel, render: (e) => <span className="font-mono text-xs">{e.channel}</span> },
    {
      key: 'status',
      header: 'Status',
      sortValue: (e) => e.status,
      render: (e) => (
        <Chip
          tone={
            e.status === 'delivered'
              ? 'ok'
              : e.status === 'failed'
                ? 'critical'
                : e.status === 'pending'
                  ? 'info'
                  : 'offline'
          }
        >
          {e.status}
        </Chip>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      // A suppression that cannot be explained is indistinguishable from a bug.
      render: (e) => (
        <span className="font-mono text-[11px] text-fg-muted">
          {e.reason ?? (e.status === 'delivered' ? '—' : 'unspecified')}
        </span>
      ),
    },
    {
      key: 'latency',
      header: 'Latency',
      sortValue: (e) => e.latencyMs ?? -1,
      align: 'right',
      render: (e) => (
        <span className="font-mono text-xs tabular-nums">{e.latencyMs != null ? `${e.latencyMs}ms` : '—'}</span>
      ),
    },
  ]

  return (
    <>
      <p className="mb-sm text-sm text-fg-muted">
        Retained 90 days. Test deliveries are marked and excluded from rule statistics.
      </p>
      <DataTable
        caption="Notification delivery attempts with channel, status and latency"
        columns={columns}
        rows={entries}
        rowKey={(e) => e.id}
        density="compact"
      />
    </>
  )
}
