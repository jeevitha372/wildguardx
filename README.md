# WildGuardX — Operations Console

Real-time wildlife and perimeter monitoring for forest reserves. Built to the
spec in [`../design-system/wildguardx/`](../design-system/wildguardx/).

> **All data in this app is simulated.** Nothing here is real telemetry. The
> console shows a **DEMO DATA** badge at all times, and the data layer is a
> clearly-labelled placeholder — see [Data layer](#data-layer).

```bash
npm install
npm run dev             # http://localhost:5173
npm run build           # check:contrast -> tsc --noEmit -> vite build
npm run preview         # serve dist/
npm run check:contrast  # WCAG gate over tokens.css, both themes
```

**Stack:** Vite 5 · React 18 · TypeScript (strict) · Tailwind 3 · React Router 6
· react-leaflet 4 · Recharts 2 · lucide-react.

---

## Routes

| Route | Page | Spec |
|---|---|---|
| `/` | Landing | `landing.md` |
| `/login` | Sign in (+ MFA, device pairing) | `login.md` |
| `/app` | Operations dashboard | `dashboard.md` |
| `/app/map` | Live map | `map.md` |
| `/app/alerts` | Triage queue | `alerts.md` |
| `/app/incidents/:id` | Incident detail | `incident-detail.md` |
| `/app/devices` | Device fleet | `devices.md` |
| `/app/devices/:id` | Device detail | `device-detail.md` |
| `/app/analytics` | Analytics & reports | `analytics.md` |
| `/app/team` | Team, shifts, on-call | `team.md` |
| `/app/notifications` | Escalation rules | `notifications.md` |
| `/app/settings` | Settings | `settings.md` |

Demo sign-in: any email + a 4-character password, then code `123456`. You can
also go straight to `/app` — routes are not guarded in this build.

---

## Design tokens

`src/styles/tokens.css` is the single source of truth. Every MASTER.md token is
there as a CSS custom property; `tailwind.config.js` is a thin mapping over it,
so `bg-surface-2`, `text-status-ok`, `p-lg` etc. all resolve to the same
variables.

Where MASTER.md and `pages/README.md` disagree, the page-level rules win — the
Master file's own precedence note says so. Each divergence is marked `OVERRIDE`
in `tokens.css` with its reason:

| Master rule | Problem | Applied instead |
|---|---|---|
| `.card { background: #0F172A }` | Identical to `--color-background`; cards invisible | `--surface-1..4` elevation scale |
| `.modal { background: white }` | Blinding on an OLED dark theme | `--surface-4` |
| `.input { border: #E2E8F0 }` | Light-mode value, near-invisible | `--surface-2` fill + `--color-border` |
| `.card { cursor: pointer }` (global) | Lies about affordance on static tiles | Pointer only via `.card--interactive` |
| `.card:hover { translateY(-2px) }` | Jitter in long tables and feeds | Background shift on list rows |

Two colours are **additions**, not overrides: MASTER.md has no success or
neutral colour, which an operations UI cannot function without.
`--status-ok` and `--status-offline`.

Analytics uses a separate categorical palette (`--cat-1..6`) so status red never
labels a neutral category.

---

## Themes

`[data-theme='dark'], :root` is the dark theme and stays the default.
`[data-theme='light']` overrides every token. Surfaces **invert**: in light mode
cards sit *above* the page (white on grey) rather than below it, and because
lightness can no longer encode elevation, light mode carries real shadows.

Resolution order — `localStorage` → `prefers-color-scheme` →
`VITE_DEFAULT_THEME` → `dark`. An inline script in `index.html` stamps
`data-theme` on `<html>` **before first paint**, so there is no flash of the
wrong theme; `src/lib/useTheme.ts` then adopts that decision rather than
recomputing it. Toggle with the sun/moon control in the top bar. The OS setting
is followed only until the user makes an explicit choice.

### Text-safe vs vivid

A single hue cannot be both readable as 12px text *and* saturated enough to
carry a 3px rail or a map marker. So every semantic colour has two values:

| Token | Role | Gate |
|---|---|---|
| `--X` | text-safe — chip labels, metric values, links | ≥ 4.5:1 on every surface |
| `--X-vivid` | saturated — fills ≥24px, rails, markers, chart areas | ≥ 3:1 (WCAG 1.4.11) |
| `--X-fill` | tinted background | 14% dark / 10% light |

Tailwind mirrors this: `text-status-critical` is the readable red,
`bg-status-critical-vivid` is the saturated one. `accent` is the **solid button
fill** (paired with `on-accent`); links use `accent-text`.

Canvas renderers cannot consume `var()`, so Leaflet markers and Recharts series
**sample** the resolved custom properties via `cssVar()` and re-sample on theme
change. The basemap swaps between CARTO `dark_all` and `light_all`.

### The contrast gate

`npm run check:contrast` parses `tokens.css`, resolves `var()` chains,
composites `rgba()` over each surface, and checks **298 pairs across both
themes**. It runs first in `npm run build`, so a colour edit cannot ship
without passing.

Enforced: text ramp @4.5:1 · status/brand as text @4.5:1 · focus ring @3:1 ·
vivid fills and chart categories @3:1 · control boundary @3:1 · foreground on
its own solid fill @4.5:1.

Two pairs are **reported but not enforced**, with the reason printed in the
table:

- `--text-disabled` — WCAG 1.4.3 exempts text in an inactive UI component. It
  measures ~2.3–2.6:1 and must never be used for readable text.
- `--color-border` — decorative. MASTER.md fixes it at 8% white / 12% ink, and
  the design delineates with elevation and shadow. Boundaries that carry
  component identity (inputs, controls) use `--color-border-strong`, which
  **is** enforced at 3:1.

---

## Data layer

```
src/data/
  types.ts            domain types — shape of REAL data, source-agnostic
  DataProvider.ts     the interface every provider must satisfy
  MockProvider.ts     the placeholder implementation  ← delete when ingest lands
  DataContext.tsx     the ONE place a concrete provider is chosen
  simulatorConfig.ts  named configuration for the simulator
  fixtures/*.json     seeded data (regenerate: npm run gen:fixtures)
```

No page or component imports `MockProvider`. They depend on the `DataProvider`
interface only, so swapping in a real backend is a one-line change in
`DataContext.tsx`:

```ts
const provider = useMemo(() => new MockProvider(), [])
//                            ^^^^^^^^^^^^^^^^^^ → new FirebaseProvider(config)
```

`MockProvider.ts` carries a header stating what it stands in for:

```
ESP32-CAM / ESP32-S3 field nodes
  -> LoRaWAN uplink to a gateway node
  -> MQTT topic  wildguardx/<site>/<nodeId>/detections
  -> ingest worker (classification + geofence evaluation)
  -> Firebase Realtime Database / Firestore
  -> this app, via a FirebaseProvider implementing DataProvider
```

### Fixtures

Generated deterministically from seed `20260817` by
`scripts/gen-fixtures.mjs`; regenerating produces byte-identical output.

| File | Contents |
|---|---|
| `nodes.json` | **291 ESP32 nodes** — 186 Tier-1 forest core, 105 Tier-2 village perimeter, across 8 sectors near the Nilgiri Biosphere Reserve. Camera / acoustic / thermal / gateway, with battery, solar input, deep-sleep window, RSSI, SNR, firmware, uptime |
| `detections.json` | **204 detections** over 90 days — elephant, wild boar, leopard, tiger, plus human / vehicle / chainsaw / gunshot. Night-weighted (~72% between 19:00 and 05:00), with outcome, response time and SOS flag |
| `team.json` | **6 members** — 3 rangers, operator, manager, technician |
| `sectors.json`, `geofences.json`, `rules.json`, `channels.json` | Supporting reference data |

Detections store **`minutesAgo`**, not absolute dates; `MockProvider` resolves
them against `Date.now()` at load. Baking absolute dates into a fixture rots —
a week later every alert would read "7d ago" and the live-operations story would
be visibly dead.

Per-device telemetry is **synthesised on demand** rather than stored: 291 nodes
× 90 days of samples would be a multi-megabyte fixture for no added realism.
Values are deterministic per node ID, so a device always shows the same history.

### Simulator configuration

Not hardcoded. Resolution order, highest first:

1. **URL query** — `?demo-interval=3000&demo-severity-mix=critical:1,watch:1`
2. **Constructor props** — `new MockProvider({ intervalMs: 3000 })`
3. **Env vars** — `VITE_DEMO_*` in `.env` (see `.env.example`)
4. **Built-in defaults**

| Setting | Env | URL param | Default |
|---|---|---|---|
| Detection interval | `VITE_DEMO_INTERVAL` | `demo-interval` | `12000` ms |
| Severity mix | `VITE_DEMO_SEVERITY_MIX` | `demo-severity-mix` | `critical:0.12,warning:0.28,watch:0.40,info:0.20` |
| Forced offline nodes | `VITE_DEMO_OFFLINE_NODES` | `demo-offline-nodes` | `3` |
| Forced degraded nodes | `VITE_DEMO_DEGRADED_NODES` | `demo-degraded-nodes` | `4` |
| SOS chance on critical | `VITE_DEMO_SOS_CHANCE` | `demo-sos-chance` | `0.35` |
| Simulated call latency | `VITE_DEMO_LATENCY` | `demo-latency` | `420` ms |
| Seed | `VITE_DEMO_SEED` | `demo-seed` | `20260817` |
| Theme fallback | `VITE_DEFAULT_THEME` | — | `dark` |

The URL layer exists so a walkthrough can be retuned live — "show me a critical
every two seconds" — without a rebuild. The active settings are listed in the
**DEMO DATA** badge popover, so a tuned demo is distinguishable from a default
one.

The offline/degraded counts genuinely re-shape the fleet rather than being
decorative: try `?demo-offline-nodes=40` and watch the dashboard, map and device
table all change together.

---

## Data states

`pages/README.md` §13 requires six states per async region; the brief also named
`offline`, so seven are implemented:

`loading` · `ideal` · `empty` · `error` · `partial` · `stale` · `offline`

Every async region routes through `<AsyncBoundary>` (`src/components/ui/states.tsx`),
driven by `useAsyncData` (`src/lib/dataState.tsx`), so no page can quietly ship
five of seven.

**All seven are reachable in two clicks.** The `STATE:` control in the top bar
forces the current page into any state. Without it, "all six states are
implemented" would be an unverifiable claim — `empty` and `partial` in
particular are nearly impossible to reach with healthy fixtures.

Each state has real behaviour, not a placeholder: `partial` names the failed
source, `stale` dims to 60% and shows a last-updated time, `offline` states how
many actions are queued, `error` prints the cause verbatim.

---

## SOS takeover

`src/components/sos/SosProvider.tsx`. Raised when a critical detection carries
`sos: true` (gunshot, or elephant/tiger pressing the Tier-2 perimeter). Trigger
one on demand with **TEST SOS** in the top bar.

- Full-viewport `role="alertdialog"`, focus-trapped, `aria-live="assertive"`.
- `navigator.vibrate()` with a 15-second 600/300 ms pattern.
- **Does not auto-dismiss.** The 15 seconds govern the vibration and the audible
  cue, not the modal — an unacknowledged SOS that quietly disappears is worse
  than no SOS. `Esc` deliberately does not close it.
- Single-shot two-tone WebAudio cue. Never a looping browser alarm.

Vibration support is reported honestly in three states, because a silent no-op
would leave an operator believing a handset buzzed when it never can:

| State | Message |
|---|---|
| `supported` | "Vibrating for Ns" with a live countdown |
| `rejected` | "Vibration blocked by the browser" — the UA returned `false` (no user gesture yet, or page hidden) |
| `unsupported` | "Vibration not supported on this device" — desktop Safari, all iOS |

Under `prefers-reduced-motion` the pulse animation is suppressed; the red fill,
the icon and the text still carry the alert.

---

## Verification

```
npm run check:contrast  →  PASS, 298 token pairs, both themes, exit 0
npm run build           →  contrast gate + tsc --noEmit + vite build, no warnings
grep hex/rgba in *.tsx  →  none outside cssVar() fallbacks
```

Also checked: the alpha utilities and `-vivid` classes are present in the built
CSS (not silently dropped); the theme bootstrap is inlined into `dist/index.html`
with the default substituted; production preview serves `/`, `/app` and deep
routes; the dev server transforms all 12 page modules plus the shell, map, chart
and state components.

**Not verified:** in-browser rendering. The Chrome extension was not connected
in this environment, so no page was actually painted and no runtime console was
read. A clean type-check and build does not prove the app renders. Run
`npm run dev` and click through before trusting it.

---

## Defects found by the contrast gate

Building the checker surfaced two real bugs that had been shipping silently.

**1. Three dark-theme colours failed 4.5:1 as text.** MASTER.md's own palette
does not support readable status text on the card surface. Measured against
`--surface-2`:

| Token | Was | Needed | Now |
|---|---|---|---|
| `--status-critical` `#DC2626` | 3.45:1 | 4.5:1 | `#F87171` → 6.02:1 |
| `--color-accent` `#6366F1` | 3.73:1 | 4.5:1 | `#A5B4FC` → 8.35:1 (as `accent-text`) |
| `--status-offline` `#64748B` | 3.50:1 | 4.5:1 | `#94A3B8` → 6.49:1 |

An earlier revision of this README stated `#DC2626` measured 4.6:1 and "passes,
but only just". That was wrong — it is 3.45:1 and fails. The MASTER hues are
retained as the `-vivid` variants and still carry every rail, marker and fill.

**2. 63 opacity utilities were emitting no CSS at all.** Tailwind cannot apply
an alpha to a bare `var()` colour: it needs to decompose the colour, cannot, and
silently drops the rule. Every `border-status-critical/40`, `bg-surface-4/95`
and similar class was present in the markup with **no matching rule**, so those
elements fell back to `border-color: currentColor`. Fixed by declaring each
theme colour as a function in `tailwind.config.js` that intercepts the modifier
and emits `color-mix()`. Verified in the built CSS.

---

## Known limitations

- **Routes are unguarded.** `/app/*` renders without a session; `/login` is a
  demo flow only.
- **Map touch panning.** `map.md` §3.1 wants one-finger page scroll with
  two-finger map pan. Leaflet has no built-in mode for that (it needs the
  GestureHandling plugin, not bundled), so on coarse pointers dragging starts
  **off** and there is an explicit `PAN OFF — tap to move map` toggle. The
  trade-off is surfaced in the UI rather than left as a silently dead map.
- **Basemap needs network.** CARTO dark tiles are fetched at runtime. Offline,
  the canvas stays `--surface-0` and markers still render — which is the
  behaviour `map.md` §6 asks for, but it will look bare.
- **Google Fonts at runtime.** Fira Code / Fira Sans load from
  `fonts.googleapis.com` per MASTER.md. Offline, the stack falls back to system
  mono/sans. Self-host to remove the dependency.
- **Depth varies by page.** Dashboard, alerts, devices, map and incident detail
  are the most complete. Deliberately simplified: the geofence polygon editor
  (read-only), the shift board (keyboard lift/drop, no pointer drag), and the
  rule builder (flat AND/OR, no nested grouping).
- **`color-mix()` is required.** Alpha utilities, the topbar wash and the card
  header gradients all use it. Supported in Chrome/Edge 111+, Safari 16.2+,
  Firefox 113+. On anything older the affected colours fall back to nothing
  rather than to an approximation.
- **The SOS takeover does not follow the theme.** It is a fixed dark-red field
  in both modes (`--sos-*` tokens), because a life-safety takeover inverting
  with the colour scheme would make it less recognisable, not more. White on
  `--sos-bg` measures 15.2:1.
- **Contrast is gated at the token level, not the rendered pixel.** The checker
  proves the palette is sound; it cannot prove a given component used the right
  token. Composited cases — text over a `--*-fill` tint, labels over chart
  fills — are handled by convention (labels sit beside fills, never on them).
- **Evidence is representational.** Waveforms are deterministic pseudo-data from
  the detection ID; there are no audio or image assets.
- **`noUnusedLocals` / `noUnusedParameters` are off** in `tsconfig.json` so an
  unused import cannot fail the build. Turn them on if you want that strictness.
