/**
 * WCAG contrast gate for src/styles/tokens.css.
 *
 * Parses both theme blocks, resolves var() chains, composites rgba() over the
 * surface being tested, and checks every token pair that actually renders.
 *
 * Run: npm run check:contrast   (also runs as part of npm run build)
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ENFORCED, AND WHY
 * ---------------------------------------------------------------------------
 * TEXT            4.5:1  WCAG 1.4.3. The --text-* ramp against every surface.
 * SEMANTIC TEXT   4.5:1  Status and brand colours are rendered as chip labels,
 *                        metric values and links, so they are text.
 * NON-TEXT        3.0:1  WCAG 1.4.11. Focus ring, `-vivid` fills, and the
 *                        strong border used for input boundaries.
 * ON-FILL         4.5:1  Foreground token against its own solid fill
 *                        (white on the accent button, ink on amber, etc).
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ADVISORY, AND WHY
 * ---------------------------------------------------------------------------
 * --text-disabled  WCAG 1.4.3 explicitly exempts text that is part of an
 *                  inactive user interface component. It is reported with its
 *                  real ratio so the shortfall stays visible, but it does not
 *                  fail the build. It must never be used for readable text.
 *
 * --color-border   Decorative. MASTER.md fixes it at 8% white / 12% ink, and
 *                  the design delineates with surface elevation and shadow —
 *                  the border only reinforces. Component boundaries that DO
 *                  carry identity (inputs, controls) use --color-border-strong,
 *                  which IS enforced at 3:1.
 *
 * `-vivid` tokens are checked against --surface-0..3 only: rails, markers and
 * chart areas render on the shell, page, card and hover surfaces. They are not
 * drawn on --surface-4, which is modal chrome.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKENS = path.resolve(__dirname, '../src/styles/tokens.css')

/* --- parsing -------------------------------------------------------------- */

const raw = readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function blockAfter(marker) {
  const at = raw.indexOf(marker)
  if (at === -1) throw new Error(`Could not find theme block: ${marker}`)
  const open = raw.indexOf('{', at)
  const close = raw.indexOf('}', open)
  return raw.slice(open + 1, close)
}

function parseTokens(block) {
  const out = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*(.+?);\s*$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const THEMES = {
  dark: parseTokens(blockAfter("[data-theme='dark'],")),
  light: parseTokens(blockAfter("[data-theme='light'] {")),
}

/** Resolve var(--x) chains. Dark is the fallback layer for light. */
function resolve(theme, name, depth = 0) {
  if (depth > 10) return null
  const value = THEMES[theme][name] ?? THEMES.dark[name]
  if (!value) return null
  const m = value.match(/^var\(\s*(--[\w-]+)\s*\)$/)
  if (m) return resolve(theme, m[1], depth + 1)
  return value
}

/* --- colour --------------------------------------------------------------- */

function parseColor(value) {
  if (!value) return null
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    }
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i)
  if (rgba) {
    return {
      r: +rgba[1],
      g: +rgba[2],
      b: +rgba[3],
      a: rgba[4] === undefined ? 1 : +rgba[4],
    }
  }
  return null // color-mix(), none, gradients — not a flat colour
}

/** Composite a possibly-translucent colour over an opaque backdrop. */
function composite(fg, bg) {
  if (fg.a >= 1) return fg
  return {
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
    a: 1,
  }
}

function luminance({ r, g, b }) {
  const ch = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

function contrast(fg, bg) {
  const a = luminance(composite(fg, bg))
  const b = luminance(bg)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/* --- what to check -------------------------------------------------------- */

const ALL_SURFACES = ['--surface-0', '--surface-1', '--surface-2', '--surface-3', '--surface-4']
const FILL_SURFACES = ['--surface-0', '--surface-1', '--surface-2', '--surface-3']
const CONTROL_SURFACES = ['--surface-1', '--surface-2']

const TEXT_TOKENS = ['--text-primary', '--text-secondary', '--text-muted']

const SEMANTIC_TEXT = [
  '--color-primary',
  '--color-secondary',
  '--color-accent-text',
  '--color-destructive',
  '--status-critical',
  '--status-warning',
  '--status-watch',
  '--status-info',
  '--status-ok',
  '--status-offline',
]

const VIVID_TOKENS = [
  '--color-primary-vivid',
  '--color-secondary-vivid',
  '--color-accent-vivid',
  '--color-destructive-vivid',
  '--status-critical-vivid',
  '--status-warning-vivid',
  '--status-watch-vivid',
  '--status-info-vivid',
  '--status-ok-vivid',
  '--status-offline-vivid',
  '--cat-1',
  '--cat-2',
  '--cat-3',
  '--cat-4',
  '--cat-5',
  '--cat-6',
]

/** Foreground token -> the solid fill it is painted on. */
const ON_FILL_PAIRS = [
  ['--color-on-accent', '--color-accent'],
  ['--color-on-primary', '--color-primary-vivid'],
  ['--sos-fg', '--sos-bg'],
]

const ADVISORY = [
  ['--text-disabled', ALL_SURFACES, 4.5, 'WCAG 1.4.3 exempts inactive UI components'],
  ['--color-border', ALL_SURFACES, 3.0, 'decorative; identity borders use --color-border-strong'],
]

/* --- run ------------------------------------------------------------------ */

const failures = []
const skipped = []
let checks = 0

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function ratioCell(ratio, min, pass) {
  const s = ratio.toFixed(2).padStart(6)
  return `${pass ? GREEN : RED}${s}${RESET} ${DIM}/${min.toFixed(1)}${RESET}`
}

function checkGroup(theme, label, tokens, surfaces, min, { advisory = false, note = '' } = {}) {
  const rows = []
  for (const token of tokens) {
    const fgRaw = resolve(theme, token)
    const fg = parseColor(fgRaw)
    if (!fg) {
      skipped.push(`${theme}  ${token} = ${fgRaw ?? '(undefined)'}`)
      continue
    }
    const cells = []
    for (const surface of surfaces) {
      const bg = parseColor(resolve(theme, surface))
      if (!bg) continue
      const ratio = contrast(fg, bg)
      const pass = ratio >= min
      checks += 1
      if (!pass && !advisory) {
        failures.push(
          `${theme}  ${token} on ${surface}  ${ratio.toFixed(2)}:1  (needs ${min}:1)`,
        )
      }
      cells.push(ratioCell(ratio, min, pass || advisory))
    }
    rows.push(`  ${token.padEnd(26)} ${cells.join('  ')}`)
  }

  if (!rows.length) return
  const header = surfaces.map((s) => s.replace('--surface-', 's').padStart(11)).join('  ')
  console.log(`\n${BOLD}${label}${RESET}${advisory ? `  ${YELLOW}[advisory]${RESET}` : ''}`)
  if (note) console.log(`  ${DIM}${note}${RESET}`)
  console.log(`  ${''.padEnd(26)} ${header}`)
  rows.forEach((r) => console.log(r))
}

for (const theme of ['dark', 'light']) {
  console.log(`\n${BOLD}${'='.repeat(78)}`)
  console.log(`THEME: ${theme.toUpperCase()}`)
  console.log(`${'='.repeat(78)}${RESET}`)

  checkGroup(theme, 'Text ramp vs surfaces (>= 4.5:1)', TEXT_TOKENS, ALL_SURFACES, 4.5)
  checkGroup(theme, 'Status + brand as text (>= 4.5:1)', SEMANTIC_TEXT, ALL_SURFACES, 4.5)
  checkGroup(theme, 'Focus ring (>= 3:1)', ['--color-ring'], ALL_SURFACES, 3.0)
  checkGroup(
    theme,
    'Vivid fills + chart categories (>= 3:1)',
    VIVID_TOKENS,
    FILL_SURFACES,
    3.0,
    { note: 'graphical objects; not rendered on modal chrome (s4)' },
  )
  checkGroup(
    theme,
    'Control boundary (>= 3:1)',
    ['--color-border-strong'],
    CONTROL_SURFACES,
    3.0,
    { note: 'input + control edges carry component identity (WCAG 1.4.11)' },
  )

  // Foreground-on-its-own-fill
  const fillRows = []
  for (const [fgToken, bgToken] of ON_FILL_PAIRS) {
    const fg = parseColor(resolve(theme, fgToken))
    const bg = parseColor(resolve(theme, bgToken))
    if (!fg || !bg) {
      skipped.push(`${theme}  ${fgToken} on ${bgToken}`)
      continue
    }
    // A translucent fill (SOS) sits on an unknown page; assume the darkest.
    const base = parseColor(resolve(theme, '--surface-0'))
    const solidBg = composite(bg, base ?? { r: 0, g: 0, b: 0, a: 1 })
    const ratio = contrast(fg, solidBg)
    const pass = ratio >= 4.5
    checks += 1
    if (!pass) {
      failures.push(`${theme}  ${fgToken} on ${bgToken}  ${ratio.toFixed(2)}:1  (needs 4.5:1)`)
    }
    fillRows.push(`  ${`${fgToken} on ${bgToken}`.padEnd(46)} ${ratioCell(ratio, 4.5, pass)}`)
  }
  if (fillRows.length) {
    console.log(`\n${BOLD}Foreground on solid fill (>= 4.5:1)${RESET}`)
    fillRows.forEach((r) => console.log(r))
  }

  for (const [token, surfaces, min, note] of ADVISORY) {
    checkGroup(theme, `${token} (target ${min}:1)`, [token], surfaces, min, {
      advisory: true,
      note,
    })
  }
}

/* --- summary -------------------------------------------------------------- */

console.log(`\n${BOLD}${'='.repeat(78)}${RESET}`)

if (skipped.length) {
  console.log(`\n${YELLOW}Not checkable (color-mix / non-colour values):${RESET}`)
  skipped.forEach((s) => console.log(`  ${DIM}${s}${RESET}`))
}

if (failures.length) {
  console.log(`\n${RED}${BOLD}FAIL — ${failures.length} of ${checks} pairs below threshold:${RESET}`)
  failures.forEach((f) => console.log(`  ${RED}x${RESET} ${f}`))
  console.log()
  process.exit(1)
}

console.log(`\n${GREEN}${BOLD}PASS${RESET} — ${checks} token pairs checked across both themes.`)
console.log(`${DIM}Advisory pairs (--text-disabled, --color-border) are reported above and`)
console.log(`documented at the top of this script; they do not gate the build.${RESET}\n`)
