/**
 * Sign in — spec: design-system/wildguardx/pages/login.md
 *
 * Notable spec rules honoured here:
 *  - The error slot is RESERVED at 44px so an error never shifts the layout.
 *  - Wrong email and wrong password produce identical copy (non-enumerating).
 *  - Every input is 16px with correct autocomplete/inputmode.
 *  - 100dvh + safe-area padding so submit clears the on-screen keyboard.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Smartphone, TreePine, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { iconProps } from '@/components/domain/icons'
import { useTicker } from '@/lib/hooks'

type Step = 'credentials' | 'mfa' | 'pair'

const GENERIC_ERROR = "That email and password don't match. Check both and try again."

export function LoginPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [success, setSuccess] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useTicker(1000) // keeps the lock countdown honest

  const locked = lockUntil != null && Date.now() < lockUntil
  const lockSeconds = locked ? Math.ceil((lockUntil! - Date.now()) / 1000) : 0

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault()
    if (locked) return
    setError(null)
    setBusy(true)
    await new Promise((r) => setTimeout(r, 700))
    setBusy(false)

    // Demo rule: any email plus a password of 4+ characters proceeds to MFA.
    if (email.includes('@') && password.length >= 4) {
      setAttempts(0)
      setStep('mfa')
      return
    }

    const next = attempts + 1
    setAttempts(next)
    if (next >= 3) {
      setLockUntil(Date.now() + 30_000)
      setError('Too many attempts.')
    } else {
      setError(GENERIC_ERROR)
    }
  }

  const onMfaComplete = async (code: string) => {
    setError(null)
    setBusy(true)
    await new Promise((r) => setTimeout(r, 600))
    setBusy(false)
    if (code === '123456') {
      setSuccess(true)
      setTimeout(() => navigate('/app'), 500)
    } else {
      setError('That code is not valid. Check your authenticator and try again.')
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-md py-xl"
      style={{
        background:
          'radial-gradient(50% 60% at 50% 0%, var(--hero-glow-soft) 0%, transparent 70%), var(--surface-0)',
        paddingBottom: 'calc(var(--space-xl) + env(safe-area-inset-bottom))',
      }}
    >
      <a href="#login-card" className="skip-link">
        Skip to sign-in form
      </a>

      {/* Brand block — no tagline; this is not a marketing surface. */}
      <div className="mb-xl flex flex-col items-center gap-2.5">
        <TreePine size={40} className="text-primary" strokeWidth={1.5} aria-hidden="true" />
        <span className="font-mono text-h2 font-semibold text-fg">WildGuardX</span>
      </div>

      <div
        id="login-card"
        className="w-full max-w-[420px] rounded-xl border border-border bg-surface-2 p-xl shadow-lg"
      >
        {step === 'credentials' && (
          <form onSubmit={submitCredentials} noValidate>
            <h1 className="text-h2 text-fg">Sign in</h1>
            <p className="mt-1 text-sm text-fg-muted">Control room access</p>

            {/* SSO first — institutional deployments are SSO-first. */}
            <Button variant="secondary" size="lg" className="mt-lg w-full" disabled={locked}>
              Continue with Forest Dept SSO
            </Button>

            <div className="my-lg flex items-center gap-md">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-fg-muted">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <label htmlFor="email" className="block text-sm font-medium text-fg-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={locked}
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              className="input mt-1.5"
              placeholder="ranger@forest.gov.in"
            />

            <div className="mt-md flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-fg-secondary">
                Password
              </label>
              <a href="#reset" className="text-sm text-accent-text hover:underline">
                Forgot?
              </a>
            </div>
            <div className="relative mt-1.5">
              <input
                id="password"
                type={reveal ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={locked}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                className="input pr-12"
              />
              {/* A real <button>, aria-pressed — never a div with onClick. */}
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                aria-pressed={reveal}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors duration-base hover:text-fg"
              >
                {reveal ? <EyeOff size={16} {...iconProps} /> : <Eye size={16} {...iconProps} />}
              </button>
            </div>

            <div className="mt-md">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-fg-secondary">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-[color:var(--color-primary)]"
                />
                <span>
                  Keep me signed in
                  <span className="block text-xs text-fg-muted">
                    Not recommended on shared control-room terminals.
                  </span>
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-lg w-full"
              disabled={busy || locked}
            >
              {busy ? 'Signing in…' : locked ? `Locked — ${lockSeconds}s` : 'Sign in'}
            </Button>

            <ErrorSlot
              innerRef={errorRef}
              message={
                locked
                  ? `Too many attempts. Try again in ${String(Math.floor(lockSeconds / 60)).padStart(2, '0')}:${String(lockSeconds % 60).padStart(2, '0')}.`
                  : error
              }
            />

            <div className="mt-md border-t border-border pt-md">
              <button
                type="button"
                onClick={() => setStep('pair')}
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-fg-secondary transition-colors duration-base hover:text-fg"
              >
                <Smartphone size={14} {...iconProps} />
                Field device? Pair with a code
              </button>
            </div>
          </form>
        )}

        {step === 'mfa' && (
          <MfaStep
            busy={busy}
            success={success}
            error={error}
            onComplete={onMfaComplete}
            onBack={() => {
              setStep('credentials')
              setError(null)
            }}
          />
        )}

        {step === 'pair' && (
          <PairStep
            onBack={() => {
              setStep('credentials')
              setError(null)
            }}
          />
        )}
      </div>

      {/* System status — degraded auth is announced BEFORE an attempt. */}
      <div className="mt-lg flex items-center gap-2 text-xs text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-status-ok" aria-hidden="true" />
        All systems operational
        <span aria-hidden="true">·</span>
        <Link to="/" className="hover:text-fg-secondary hover:underline">
          Back to site
        </Link>
      </div>

      <p className="mt-md max-w-[420px] text-center text-xs text-fg-disabled">
        Demo build: any email with a 4+ character password, then code{' '}
        <code className="font-mono text-fg-muted">123456</code>.
      </p>
    </div>
  )
}

/* --- Reserved error slot --------------------------------------------------
 * Always occupies 44px. Empty = transparent. This is why an error never
 * pushes the layout down (login.md §3.4).
 * ------------------------------------------------------------------------ */
function ErrorSlot({
  message,
  innerRef,
}: {
  message: string | null
  innerRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div className="mt-md min-h-[44px]">
      {message && (
        <div
          ref={innerRef}
          role="alert"
          tabIndex={-1}
          id="login-error"
          className="flex items-start gap-2 rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] px-3 py-2.5 text-sm text-fg-secondary"
        >
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-status-critical" {...iconProps} />
          <span>{message}</span>
        </div>
      )}
    </div>
  )
}

/* --- MFA ------------------------------------------------------------------ */

function MfaStep({
  busy,
  success,
  error,
  onComplete,
  onBack,
}: {
  busy: boolean
  success: boolean
  error: string | null
  onComplete: (code: string) => void
  onBack: () => void
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const [cooldown, setCooldown] = useState(30)

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const setDigit = (i: number, value: string) => {
    const next = [...digits]
    next[i] = value.replace(/\D/g, '').slice(-1)
    setDigits(next)
    if (next[i] && i < 5) inputs.current[i + 1]?.focus()
    if (next.every((d) => d)) onComplete(next.join(''))
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    e.preventDefault()
    const next = Array(6)
      .fill('')
      .map((_, i) => text[i] ?? '')
    setDigits(next)
    if (text.length === 6) onComplete(text)
    else inputs.current[text.length]?.focus()
  }

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'Escape') {
      setDigits(Array(6).fill(''))
      inputs.current[0]?.focus()
    }
  }

  return (
    <div>
      <h1 className="text-h2 text-fg">Two-factor code</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Enter the 6-digit code from your authenticator app.
      </p>

      <div
        role="group"
        aria-label="Six digit code"
        onPaste={onPaste}
        className="mt-lg flex justify-between gap-1.5"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            aria-label={`Digit ${i + 1} of 6`}
            aria-invalid={!!error}
            disabled={busy || success}
            className={cn(
              'h-14 w-full rounded-lg border bg-surface-3 text-center font-mono text-2xl text-fg',
              'transition-colors duration-base ease-out focus-visible:outline-none',
              error
                ? 'border-status-critical'
                : d
                  ? 'border-ring'
                  : 'border-border',
            )}
          />
        ))}
      </div>

      <div className="mt-md min-h-[44px]">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-status-critical/40 bg-[color:var(--status-critical-fill)] px-3 py-2.5 text-sm text-fg-secondary"
          >
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-status-critical" {...iconProps} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-status-ok/40 bg-[color:var(--status-ok-fill)] px-3 py-2.5 text-sm text-status-ok"
          >
            Verified — opening the console…
          </div>
        )}
      </div>

      <div className="mt-md flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer text-fg-secondary transition-colors duration-base hover:text-fg"
        >
          Back
        </button>
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={() => setCooldown(30)}
          className={cn(
            'cursor-pointer text-accent-text transition-colors duration-base hover:underline',
            cooldown > 0 && 'cursor-not-allowed text-fg-disabled no-underline hover:no-underline',
          )}
        >
          {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend code'}
        </button>
      </div>

      <button
        type="button"
        className="mt-md cursor-pointer text-sm text-fg-muted transition-colors duration-base hover:text-fg-secondary"
      >
        Use a recovery code
      </button>
    </div>
  )
}

/* --- Device pairing -------------------------------------------------------- */

function PairStep({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('')
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <KeyRound size={20} className="text-primary" {...iconProps} />
        <h1 className="text-h2 text-fg">Pair a field device</h1>
      </div>
      <p className="mt-1 text-sm text-fg-muted">
        Enter the 8-character code issued by your supervisor. Offline-first ranger tablets are
        provisioned this way.
      </p>

      <label htmlFor="pair-code" className="mt-lg block text-sm font-medium text-fg-secondary">
        Pairing code
      </label>
      <input
        id="pair-code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
        className="input mt-1.5 text-center font-mono text-xl tracking-[0.3em]"
        placeholder="XXXX-XXXX"
        autoCapitalize="characters"
        spellCheck={false}
        aria-describedby="pair-help"
      />
      <p id="pair-help" className="mt-1.5 text-xs text-fg-muted">
        Format: 8 characters, letters and digits.
      </p>

      <Button variant="primary" size="lg" className="mt-lg w-full" disabled={code.length < 8}>
        Pair device
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="mt-md cursor-pointer text-sm text-fg-secondary transition-colors duration-base hover:text-fg"
      >
        Back to sign in
      </button>
    </div>
  )
}
