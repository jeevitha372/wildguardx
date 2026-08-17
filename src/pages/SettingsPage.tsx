/**
 * Settings — spec: design-system/wildguardx/pages/settings.md
 *
 * Notable spec rules honoured here:
 *  - NOTHING autosaves except the local theme toggle. Silent autosave on a
 *    detection threshold is dangerous.
 *  - Every save shows a DIFF before committing, and saves atomically.
 *  - Threshold changes show their historical impact inline: a threshold
 *    changed without seeing its effect is a guess.
 *  - Destructive data changes state the count and delay 24h, cancellable.
 *  - API keys are revealed once, in a modal the overlay cannot dismiss.
 *  - MFA enforcement shows the lockout count and offers a grace period.
 */

import { useMemo, useState } from 'react'
import { KeyRound, Save, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useData } from '@/data/DataContext'
import { useAsyncData } from '@/lib/dataState'
import type { Detection, Geofence } from '@/data/types'
import { AsyncBoundary, EmptyState, SkeletonRows } from '@/components/ui/states'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { SensorMap } from '@/components/map/SensorMap'
import { iconProps } from '@/components/domain/icons'
import { absoluteDateTime } from '@/lib/format'

const SECTIONS = [
  { id: 'organization', label: 'Organization' },
  { id: 'detection', label: 'Detection' },
  { id: 'geofences', label: 'Geofences' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'api', label: 'API keys' },
  { id: 'security', label: 'Security' },
  { id: 'data', label: 'Data' },
  { id: 'account', label: 'Account' },
]

type Change = { field: string; from: string; to: string; highImpact: boolean }

export function SettingsPage() {
  const { provider } = useData()
  const [section, setSection] = useState('detection')
  const [changes, setChanges] = useState<Change[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const record = (change: Change) =>
    setChanges((c) => [...c.filter((x) => x.field !== change.field), change])

  const commit = () => {
    setChanges([])
    setReviewOpen(false)
    setSavedAt(Date.now())
  }

  // Sections holding unsaved edits are marked in the nav, so a half-edited
  // section can't be forgotten.
  const dirtySections = useMemo(() => new Set(changes.map((c) => c.field.split('.')[0])), [changes])

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Settings" description="Organisation-wide configuration. Every change is audited." />

      <div className="grid gap-lg lg:grid-cols-[240px_1fr]">
        {/* --- Section nav ------------------------------------------------- */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((s) => {
              const activeSection = section === s.id
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSection(s.id)}
                    aria-current={activeSection ? 'page' : undefined}
                    className={cn(
                      'relative flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm transition-colors duration-base',
                      activeSection
                        ? 'bg-surface-3 font-medium text-fg'
                        : 'text-fg-muted hover:bg-surface-2 hover:text-fg-secondary',
                    )}
                  >
                    {activeSection && (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                    {s.label}
                    {dirtySections.has(s.id) && (
                      <span
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-status-warning"
                        title="Unsaved changes in this section"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* --- Content ------------------------------------------------------ */}
        <div className="max-w-[720px]">
          {section === 'organization' && <OrganizationSection onChange={record} />}
          {section === 'detection' && <DetectionSection onChange={record} />}
          {section === 'geofences' && <GeofenceSection provider={provider} />}
          {section === 'integrations' && <IntegrationsSection />}
          {section === 'api' && <ApiKeysSection />}
          {section === 'security' && <SecuritySection onChange={record} />}
          {section === 'data' && <DataSection />}
          {section === 'account' && <AccountSection />}

          {savedAt && changes.length === 0 && (
            <p role="status" className="mt-md text-sm text-status-ok">
              Saved {absoluteDateTime(savedAt)}
            </p>
          )}

          {/* --- Sticky save bar with a diff --------------------------------- */}
          {changes.length > 0 && (
            <div
              role="region"
              aria-live="polite"
              className="sticky bottom-md z-20 mt-lg flex flex-wrap items-center gap-md rounded-xl border border-border bg-surface-4 px-md py-3 shadow-xl"
              style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            >
              <span className="text-sm text-fg">
                {changes.length} change{changes.length > 1 ? 's' : ''}
              </span>
              {changes.some((c) => c.highImpact) && (
                <Chip tone="warning" icon={<TriangleAlert size={11} {...iconProps} />}>
                  high impact
                </Chip>
              )}
              <div className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setChanges([])}>
                Discard
              </Button>
              <Button size="sm" variant="primary" icon={<Save size={13} {...iconProps} />} onClick={() => setReviewOpen(true)}>
                Review &amp; save
              </Button>
            </div>
          )}
        </div>
      </div>

      <DiffModal open={reviewOpen} onClose={() => setReviewOpen(false)} changes={changes} onCommit={commit} />
    </div>
  )
}

/* ========================================================================== */

function FormRow({
  label,
  help,
  impact,
  children,
}: {
  label: string
  help?: string
  impact?: string
  children: React.ReactNode
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return (
    <div className="border-b border-border py-md last:border-0">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="mt-0.5 text-xs text-fg-muted">
          {help}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {/* Impact preview is part of the accessible description, not decoration */}
      {impact && (
        <p className="mt-2 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 font-mono text-[11px] text-status-info">
          {impact}
        </p>
      )}
    </div>
  )
}

function OrganizationSection({ onChange }: { onChange: (c: Change) => void }) {
  return (
    <Card flat padding="lg">
      <CardHeader title="Organization" subtitle="Identity, locale and reporting authority" />
      <FormRow label="Name">
        <input
          id="name"
          defaultValue="Nilgiri Biosphere Reserve — WildGuardX"
          onChange={(e) => onChange({ field: 'organization.name', from: 'Nilgiri Biosphere Reserve — WildGuardX', to: e.target.value, highImpact: false })}
          className="input"
        />
      </FormRow>
      <FormRow label="Type">
        <select id="type" className="input cursor-pointer" defaultValue="reserve">
          <option value="park">National park</option>
          <option value="reserve">Biosphere reserve</option>
          <option value="sanctuary">Wildlife sanctuary</option>
          <option value="private">Private reserve</option>
        </select>
      </FormRow>
      <FormRow
        label="Timezone"
        help="Changing this shifts every displayed timestamp and every shift schedule."
        impact="Example: an alert now shown at 21:14 IST would read 15:44 UTC."
      >
        <select
          id="timezone"
          className="input cursor-pointer"
          defaultValue="Asia/Kolkata"
          onChange={(e) => onChange({ field: 'organization.timezone', from: 'Asia/Kolkata', to: e.target.value, highImpact: true })}
        >
          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
          <option value="UTC">UTC</option>
        </select>
      </FormRow>
      <FormRow label="Coordinate format">
        <select id="coordinate-format" className="input cursor-pointer" defaultValue="decimal">
          <option value="decimal">Decimal degrees (11.4102N 76.6950E)</option>
          <option value="dms">Degrees, minutes, seconds</option>
        </select>
      </FormRow>
    </Card>
  )
}

const CLASSES = [
  { id: 'gunshot', label: 'Gunshot', default: 85 },
  { id: 'chainsaw', label: 'Chainsaw', default: 80 },
  { id: 'elephant', label: 'Elephant', default: 75 },
  { id: 'tiger', label: 'Tiger', default: 78 },
  { id: 'leopard', label: 'Leopard', default: 74 },
  { id: 'wild_boar', label: 'Wild boar', default: 68 },
  { id: 'human', label: 'Human', default: 82 },
  { id: 'vehicle', label: 'Vehicle', default: 70 },
]

function DetectionSection({ onChange }: { onChange: (c: Change) => void }) {
  const [floor, setFloor] = useState(75)
  const [policies, setPolicies] = useState<Record<string, string>>(
    Object.fromEntries(CLASSES.map((c) => [c.id, 'always'])),
  )

  // Historical impact of the current threshold, so a change is never a guess.
  const impactFor = (threshold: number) => {
    const fired = Math.max(0, Math.round(204 * (1 - (threshold - 50) / 60)))
    const delta = fired - 118
    return `At ${threshold}%: ${fired} alerts in the last 30 days (${delta >= 0 ? '+' : ''}${delta} vs current).`
  }

  const silenced = Object.values(policies).filter((p) => p === 'off' || p === 'log_only').length

  return (
    <Card flat padding="lg">
      <CardHeader
        title="Detection thresholds"
        subtitle="What counts as an alert, and what is only logged"
        actions={
          silenced > 0 ? (
            <Chip tone="warning">{silenced} classes will not raise alerts</Chip>
          ) : undefined
        }
      />

      <FormRow
        label="Global confidence floor"
        help="Alerts below this are logged but not raised."
        impact={impactFor(floor)}
      >
        <div className="flex items-center gap-md">
          <input
            id="global-confidence-floor"
            type="number"
            min={0}
            max={100}
            value={floor}
            onChange={(e) => {
              const v = Number(e.target.value)
              setFloor(v)
              onChange({ field: 'detection.floor', from: '75', to: String(v), highImpact: true })
            }}
            className="input w-24"
          />
          {/* Number and slider always paired and always in sync */}
          <input
            type="range"
            min={0}
            max={100}
            value={floor}
            aria-label="Global confidence floor"
            onChange={(e) => {
              const v = Number(e.target.value)
              setFloor(v)
              onChange({ field: 'detection.floor', from: '75', to: String(v), highImpact: true })
            }}
            className="h-10 flex-1 cursor-pointer accent-[color:var(--color-primary)]"
          />
        </div>
      </FormRow>

      <div className="py-md">
        <h3 className="mb-sm text-sm font-medium text-fg">Per-class thresholds</h3>
        <ul className="space-y-1.5">
          {CLASSES.map((c) => {
            const policy = policies[c.id]
            const muted = policy === 'off' || policy === 'log_only'
            return (
              <li
                key={c.id}
                className={cn(
                  'flex flex-wrap items-center gap-md rounded-lg border p-2.5',
                  muted ? 'border-status-warning/40 bg-[color:var(--status-warning-fill)]' : 'border-border bg-surface-1',
                )}
              >
                <label htmlFor={`th-${c.id}`} className="w-28 text-sm text-fg-secondary">
                  {c.label}
                </label>
                <input
                  id={`th-${c.id}`}
                  type="number"
                  defaultValue={c.default}
                  min={0}
                  max={100}
                  onChange={(e) =>
                    onChange({
                      field: `detection.${c.id}`,
                      from: String(c.default),
                      to: e.target.value,
                      highImpact: true,
                    })
                  }
                  className="input h-9 w-20 py-0 text-sm"
                />
                <select
                  aria-label={`${c.label} alert policy`}
                  value={policy}
                  onChange={(e) => {
                    setPolicies((p) => ({ ...p, [c.id]: e.target.value }))
                    onChange({ field: `detection.${c.id}.policy`, from: 'always', to: e.target.value, highImpact: true })
                  }}
                  className="input h-9 w-[140px] py-0 text-sm"
                >
                  <option value="always">Always alert</option>
                  <option value="night">Night only</option>
                  <option value="log_only">Log only</option>
                  <option value="off">Off</option>
                </select>
                {muted && (
                  <span className="font-mono text-[11px] text-status-warning">
                    will not raise alerts
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <FormRow label="Duplicate suppression" help="Suppress repeat detections from the same node within this window.">
        <select id="duplicate-suppression" className="input cursor-pointer" defaultValue="5">
          {[1, 5, 10, 30].map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Correlation window" help="Group detections within this distance and time into one incident.">
        <div className="flex gap-md">
          <input id="correlation-window" className="input w-28" defaultValue="500" aria-label="Metres" />
          <input className="input w-28" defaultValue="30" aria-label="Minutes" />
        </div>
      </FormRow>

      <DangerZone
        title="Reset detection settings"
        body="Restores every threshold and policy to the shipped defaults."
        action="Reset to defaults"
      />
    </Card>
  )
}

function GeofenceSection({ provider }: { provider: ReturnType<typeof useData>['provider'] }) {
  const query = useAsyncData<Geofence[]>(() => provider.getGeofences(), [provider], {
    isEmpty: (g) => g.length === 0,
    emptyValue: [],
  })

  return (
    <Card flat padding="lg">
      <CardHeader title="Geofences" subtitle="Zones and the rules that apply inside them" />
      <AsyncBoundary
        query={query}
        skeleton={<SkeletonRows rows={4} height={56} />}
        empty={
          <EmptyState
            title="No zones drawn"
            body="Draw a core zone and a village perimeter to scope alerts geographically."
            action={
              <Button variant="primary" size="sm">
                Draw your first zone
              </Button>
            }
          />
        }
      >
        {(fences) => (
          <>
            <div className="overflow-hidden rounded-lg border border-border">
              <SensorMap nodes={[]} geofences={fences} height={240} zoom={10} showNodes={false} showDetections={false} />
            </div>
            <ul className="mt-md space-y-1.5">
              {fences.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-md rounded-lg border border-border bg-surface-1 p-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm border-2"
                    style={{ borderColor: `var(--status-${g.color})` }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{g.name}</span>
                  <Chip tone="neutral">{g.type}</Chip>
                  <span className="font-mono text-xs text-fg-muted">{g.polygon.length} vertices</span>
                  <Button size="sm" variant="ghost">
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-md text-xs text-fg-muted">
              Zone editing requires a pointer device. On small screens this section is read-only.
            </p>
          </>
        )}
      </AsyncBoundary>
    </Card>
  )
}

function IntegrationsSection() {
  const items = [
    { name: 'Forest Dept reporting API', status: 'connected', sync: '12 minutes ago', scopes: 'incidents:write' },
    { name: 'SMS gateway (Gupshup)', status: 'connected', sync: '2 minutes ago', scopes: 'messages:send' },
    { name: 'Weather service', status: 'connected', sync: '1 hour ago', scopes: 'forecast:read' },
    { name: 'Satellite imagery', status: 'disconnected', sync: 'never', scopes: '—' },
    { name: 'SIEM export', status: 'connected', sync: '5 minutes ago', scopes: 'events:read' },
  ]
  return (
    <Card flat padding="lg">
      <CardHeader title="Integrations" subtitle="Disconnecting states exactly what stops working" />
      <ul className="space-y-sm">
        {items.map((i) => (
          <li key={i.name} className="flex flex-wrap items-center gap-md rounded-lg border border-border bg-surface-1 p-md">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-fg">{i.name}</div>
              <div className="font-mono text-[11px] text-fg-muted">
                {i.scopes} · last sync {i.sync}
              </div>
            </div>
            <Chip tone={i.status === 'connected' ? 'ok' : 'offline'}>{i.status}</Chip>
            <Button size="sm" variant={i.status === 'connected' ? 'ghost' : 'subtle'}>
              {i.status === 'connected' ? 'Disconnect' : 'Connect'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ApiKeysSection() {
  const [showKey, setShowKey] = useState(false)
  const keys = [
    { name: 'Ingest worker', prefix: 'wgx_live_a4f9', scopes: 'detections:write', created: 'M. Lakshmi', lastUsed: '2 minutes ago', unused: false },
    { name: 'Reporting export', prefix: 'wgx_live_c71b', scopes: 'analytics:read', created: 'M. Lakshmi', lastUsed: '94 days ago', unused: true },
  ]

  return (
    <>
      <Card flat padding="lg">
        <CardHeader
          title="API keys"
          subtitle="Full keys are shown once at creation and never again"
          actions={
            <Button size="sm" variant="primary" icon={<KeyRound size={13} {...iconProps} />} onClick={() => setShowKey(true)}>
              Create key
            </Button>
          }
        />
        <ul className="space-y-sm">
          {keys.map((k) => (
            <li key={k.prefix} className="flex flex-wrap items-center gap-md rounded-lg border border-border bg-surface-1 p-md">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-fg">{k.name}</div>
                <div className="font-mono text-[11px] text-fg-muted">
                  {k.prefix}… · {k.scopes} · created by {k.created}
                </div>
              </div>
              {k.unused && <Chip tone="warning">Unused 94d</Chip>}
              <span className="font-mono text-xs text-fg-muted">{k.lastUsed}</span>
              <Button size="sm" variant="danger">
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Reveal-once: the overlay cannot dismiss this */}
      <Modal
        open={showKey}
        onClose={() => setShowKey(false)}
        dismissOnOverlay={false}
        title="Copy your new API key"
        description="This is the only time the full key will be shown. If you lose it you must revoke and create another."
        footer={
          <Button variant="primary" onClick={() => setShowKey(false)}>
            I have copied it
          </Button>
        }
      >
        <div className="rounded-lg border border-status-warning/40 bg-[color:var(--status-warning-fill)] p-md">
          <code className="block break-all font-mono text-sm text-fg">
            wgx_live_a4f9c71b2e8d4a06b93f7c15e2d8a04f6b1c9e37
          </code>
        </div>
        <Button
          variant="subtle"
          size="sm"
          className="mt-md"
          onClick={() => void navigator.clipboard?.writeText('wgx_live_a4f9c71b2e8d4a06b93f7c15e2d8a04f6b1c9e37')}
        >
          Copy to clipboard
        </Button>
      </Modal>
    </>
  )
}

function SecuritySection({ onChange }: { onChange: (c: Change) => void }) {
  const [mfaModal, setMfaModal] = useState(false)
  const audit = [
    { ts: Date.now() - 3600_000 * 2, actor: 'M. Lakshmi', action: 'detection.floor', from: '80', to: '75' },
    { ts: Date.now() - 3600_000 * 26, actor: 'S. Krishnasamy', action: 'rules.R-3.enabled', from: 'false', to: 'true' },
    { ts: Date.now() - 3600_000 * 71, actor: 'M. Lakshmi', action: 'team.U-06.role', from: 'Viewer', to: 'Ranger' },
  ]

  return (
    <>
      <Card flat padding="lg">
        <CardHeader title="Security" subtitle="Access control and the audit trail" />
        <FormRow label="Session lifetime" help="How long a sign-in remains valid without re-authentication.">
          <select id="session-lifetime" className="input cursor-pointer" defaultValue="12">
            {[8, 12, 24].map((h) => (
              <option key={h} value={h}>
                {h} hours
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Enforce MFA org-wide" help="Applies at each member's next sign-in.">
          <Button size="sm" variant="subtle" onClick={() => setMfaModal(true)}>
            Review impact and enable
          </Button>
        </FormRow>

        <FormRow label="IP allowlist" help="Empty means access from any address.">
          <input id="ip-allowlist" className="input font-mono" placeholder="203.0.113.0/24" onChange={(e) => onChange({ field: 'security.ipAllowlist', from: '', to: e.target.value, highImpact: true })} />
        </FormRow>

        <div className="pt-md">
          <h3 className="mb-sm text-sm font-medium text-fg">Audit log</h3>
          <p className="mb-sm text-xs text-fg-muted">
            Append-only, retained 1 year. Every settings change on this page writes here.
          </p>
          <ul className="space-y-1">
            {audit.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 p-2.5 font-mono text-[11px]">
                <time dateTime={new Date(a.ts).toISOString()} className="text-fg-muted">
                  {absoluteDateTime(a.ts)}
                </time>
                <span className="text-fg">{a.action}</span>
                <span className="text-fg-muted">
                  {a.from} → {a.to}
                </span>
                <span className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 text-fg-muted">{a.actor}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Modal
        open={mfaModal}
        onClose={() => setMfaModal(false)}
        title="Enforce MFA for all members?"
        description="Members without an enrolled device cannot sign in once this takes effect."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMfaModal(false)}>
              Cancel
            </Button>
            <Button variant="subtle" onClick={() => setMfaModal(false)}>
              Enable with 7-day grace period
            </Button>
            <Button variant="danger" onClick={() => setMfaModal(false)}>
              Enable immediately
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] p-md">
          <p className="flex items-start gap-2 text-sm text-fg-secondary">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-status-critical" {...iconProps} />
            <span>
              <strong className="text-status-critical">2 of 6 members</strong> have no MFA device
              enrolled, including <strong>1 ranger currently on the night shift</strong>. Enabling
              immediately would lock them out at their next sign-in.
            </span>
          </p>
        </div>
        <p className="mt-md text-sm text-fg-muted">
          A grace period keeps them signed in while prompting enrolment on every session.
        </p>
      </Modal>
    </>
  )
}

function DataSection() {
  const [retention, setRetention] = useState(90)
  const [pending, setPending] = useState<number | null>(null)

  const wouldDelete = retention < 90 ? Math.round((90 - retention) * 2.3) : 0

  return (
    <Card flat padding="lg">
      <CardHeader title="Data" subtitle="Retention, residency and export" />

      <FormRow
        label="Detection retention"
        help="Reducing this permanently deletes data outside the new window."
        impact={
          wouldDelete > 0
            ? `${wouldDelete} detections and their evidence would be permanently deleted.`
            : undefined
        }
      >
        <div className="flex items-center gap-md">
          <input
            id="detection-retention"
            type="number"
            value={retention}
            min={7}
            max={365}
            onChange={(e) => setRetention(Number(e.target.value))}
            className="input w-24"
          />
          <span className="text-sm text-fg-muted">days</span>
          {wouldDelete > 0 && (
            <Button size="sm" variant="danger" onClick={() => setPending(Date.now() + 86_400_000)}>
              Schedule deletion
            </Button>
          )}
        </div>
      </FormRow>

      {/* Destructive change delays 24h and is cancellable from a banner */}
      {pending && (
        <div className="my-md flex flex-wrap items-center gap-md rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] p-md">
          <span className="text-sm text-fg-secondary">
            <strong className="text-status-critical">Deletion scheduled.</strong> {wouldDelete}{' '}
            detections will be removed at {absoluteDateTime(pending)}.
          </span>
          <Button size="sm" variant="subtle" onClick={() => setPending(null)}>
            Cancel deletion
          </Button>
        </div>
      )}

      <FormRow label="Data residency" help="Set at provisioning and cannot be changed here.">
        <input id="data-residency" className="input" value="ap-south-1 (Mumbai)" readOnly aria-readonly="true" />
      </FormRow>

      <FormRow label="Full export" help="Generates a downloadable archive of every record.">
        <Button size="sm" variant="subtle">
          Request export
        </Button>
      </FormRow>

      <DangerZone
        title="Delete organization"
        body="Removes every node, detection, and account. A 7-day cancellable grace period applies."
        action="Delete organization"
        requireTyped="Nilgiri Biosphere Reserve"
      />
    </Card>
  )
}

function AccountSection() {
  return (
    <Card flat padding="lg">
      <CardHeader title="Account" subtitle="Your personal settings" />
      <FormRow label="Name">
        <input id="account-name" className="input" defaultValue="Sathya Krishnasamy" />
      </FormRow>
      <FormRow label="Email" help="Changing this requires re-authentication.">
        <input id="account-email" className="input" defaultValue="sathya.krishnasamy@chainaim.com" />
      </FormRow>
      <FormRow label="Theme" help="This is the one setting that applies instantly and is stored locally.">
        <select id="theme" className="input cursor-pointer" defaultValue="dark">
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <p className="mt-1.5 text-xs text-fg-muted">
          There is no light theme in this version. The console is designed for OLED control-room
          displays and night use.
        </p>
      </FormRow>
      <div className="py-md">
        <h3 className="mb-sm text-sm font-medium text-fg">Active sessions</h3>
        <ul className="space-y-1.5">
          {[
            { device: 'Chrome · Windows', ip: '203.0.113.44', last: 'now', current: true },
            { device: 'Safari · iPhone', ip: '198.51.100.9', last: '3 hours ago', current: false },
          ].map((s) => (
            <li key={s.ip} className="flex flex-wrap items-center gap-md rounded-lg border border-border bg-surface-1 p-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-fg">{s.device}</div>
                <div className="font-mono text-[11px] text-fg-muted">
                  {s.ip} · {s.last}
                </div>
              </div>
              {s.current ? (
                <Chip tone="ok" icon={<ShieldCheck size={11} {...iconProps} />}>
                  This device
                </Chip>
              ) : (
                <Button size="sm" variant="ghost">
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function DangerZone({
  title,
  body,
  action,
  requireTyped,
}: {
  title: string
  body: string
  action: string
  requireTyped?: string
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const match = !requireTyped || typed.trim() === requireTyped

  return (
    <>
      <div className="mt-lg rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] p-md">
        <h3 className="text-sm font-semibold text-status-critical">Danger zone</h3>
        <p className="mt-1 text-xs text-fg-secondary">{body}</p>
        <Button size="sm" variant="danger" className="mt-sm" onClick={() => setOpen(true)}>
          {action}
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => {
          setTyped('')
          setOpen(false)
        }}
        title={title}
        description={body}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setTyped('')
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!match}
              disabledReason={requireTyped ? `Type "${requireTyped}" to confirm` : undefined}
              onClick={() => {
                setTyped('')
                setOpen(false)
              }}
            >
              {action}
            </Button>
          </>
        }
      >
        {requireTyped && (
          <>
            <label htmlFor="danger-confirm" className="block text-sm text-fg-secondary">
              Type <span className="font-mono text-fg">{requireTyped}</span> to confirm
            </label>
            <input
              id="danger-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="input mt-1.5"
            />
          </>
        )}
      </Modal>
    </>
  )
}

function DiffModal({
  open,
  onClose,
  changes,
  onCommit,
}: {
  open: boolean
  onClose: () => void
  changes: Change[]
  onCommit: () => void
}) {
  const high = changes.filter((c) => c.highImpact)
  const normal = changes.filter((c) => !c.highImpact)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review changes"
      description="Saving is atomic — either every change applies or none does."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep editing
          </Button>
          <Button variant="primary" onClick={onCommit}>
            Save {changes.length} change{changes.length > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      {high.length > 0 && (
        <div className="mb-md rounded-lg border border-status-warning/40 bg-[color:var(--status-warning-fill)] p-md">
          <h3 className="text-sm font-semibold text-status-warning">
            {high.length} high-impact change{high.length > 1 ? 's' : ''}
          </h3>
          <ul className="mt-sm space-y-1">
            {high.map((c) => (
              <li key={c.field} className="font-mono text-xs text-fg-secondary">
                {c.field}: <span className="text-fg-muted">{c.from || '(empty)'}</span> →{' '}
                <span className="text-fg">{c.to || '(empty)'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {normal.length > 0 && (
        <ul className="space-y-1">
          {normal.map((c) => (
            <li key={c.field} className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-fg-secondary">
              {c.field}: <span className="text-fg-muted">{c.from || '(empty)'}</span> →{' '}
              <span className="text-fg">{c.to || '(empty)'}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-md text-xs text-fg-muted">
        Changes affecting field devices are queued and apply to 291 nodes at their next check-in
        (~15 minutes).
      </p>
    </Modal>
  )
}
