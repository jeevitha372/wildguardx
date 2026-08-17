/**
 * Tailwind theme is a thin mapping over src/styles/tokens.css.
 * Every value here resolves to a CSS custom property so the tokens file
 * stays the single source of truth (MASTER.md + pages/README.md overrides).
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY COLOUR IS A FUNCTION, NOT A STRING
 * ---------------------------------------------------------------------------
 * A colour declared as the plain string 'var(--x)' CANNOT take Tailwind's
 * opacity modifier. Tailwind needs to decompose the colour to apply an alpha,
 * cannot decompose a var(), and so silently emits NO RULE AT ALL for
 * `border-status-critical/40`. The class name survives in the markup and the
 * element quietly falls back to `border-color: currentColor`.
 *
 * Declaring each colour as a function lets us intercept the modifier and emit
 * `color-mix()`, which composes an alpha over an unresolved var() correctly.
 * Every `/40`-style utility in this codebase depends on this.
 */

/** Token colour that supports Tailwind's `/alpha` modifier via color-mix. */
const token = (name) => {
  return ({ opacityValue } = {}) => {
    if (opacityValue === undefined) return `var(${name})`
    const alpha = Number(opacityValue)
    // Non-numeric means Tailwind handed us `var(--tw-*-opacity)`, which we
    // cannot multiply — fall back to the flat colour rather than emit garbage.
    if (!Number.isFinite(alpha) || alpha >= 1) return `var(${name})`
    return `color-mix(in srgb, var(${name}) ${alpha * 100}%, transparent)`
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Themes are driven by data-theme on <html>, not by a `.dark` class, so the
  // `dark:` variant follows the same attribute if it is ever needed.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    // Breakpoints per pages/README.md §10
    screens: {
      sm: '375px',
      md: '768px',
      lg: '1024px',
      xl: '1440px',
    },
    extend: {
      colors: {
        // Text-safe brand values. Every `-vivid` sibling is the saturated
        // variant for fills >= 24px, rails, markers and chart areas.
        primary: {
          DEFAULT: token('--color-primary'),
          vivid: token('--color-primary-vivid'),
        },
        'on-primary': token('--color-on-primary'),
        secondary: {
          DEFAULT: token('--color-secondary'),
          vivid: token('--color-secondary-vivid'),
        },
        accent: {
          DEFAULT: token('--color-accent'), // solid fill; pair with on-accent
          text: token('--color-accent-text'), // link / label safe
          vivid: token('--color-accent-vivid'),
        },
        'on-accent': token('--color-on-accent'),
        background: token('--color-background'),
        foreground: token('--color-foreground'),
        muted: token('--color-muted'),
        border: {
          DEFAULT: token('--color-border'),
          strong: token('--color-border-strong'),
        },
        destructive: {
          DEFAULT: token('--color-destructive'),
          vivid: token('--color-destructive-vivid'),
        },
        ring: token('--color-ring'),
        sos: {
          bg: token('--sos-bg'),
          fg: token('--sos-fg'),
          border: token('--sos-border'),
          panel: token('--sos-panel'),
        },

        // Elevation scale — pages/README.md §1
        surface: {
          0: token('--surface-0'),
          1: token('--surface-1'),
          2: token('--surface-2'),
          3: token('--surface-3'),
          4: token('--surface-4'),
        },

        // Status palette — pages/README.md §5.
        // `status-*` is text-safe; `status-*-vivid` is for non-text fills.
        status: {
          critical: token('--status-critical'),
          'critical-vivid': token('--status-critical-vivid'),
          warning: token('--status-warning'),
          'warning-vivid': token('--status-warning-vivid'),
          watch: token('--status-watch'),
          'watch-vivid': token('--status-watch-vivid'),
          info: token('--status-info'),
          'info-vivid': token('--status-info-vivid'),
          ok: token('--status-ok'),
          'ok-vivid': token('--status-ok-vivid'),
          offline: token('--status-offline'),
          'offline-vivid': token('--status-offline-vivid'),
        },

        // Text ramp — pages/README.md §4. Named `fg` so `text-primary`
        // stays free to mean the amber brand color, not a text color.
        fg: {
          DEFAULT: token('--text-primary'),
          secondary: token('--text-secondary'),
          muted: token('--text-muted'),
          disabled: token('--text-disabled'),
        },

        // Categorical chart palette — analytics.md §1
        cat: {
          1: token('--cat-1'),
          2: token('--cat-2'),
          3: token('--cat-3'),
          4: token('--cat-4'),
          5: token('--cat-5'),
          6: token('--cat-6'),
        },
      },
      fontFamily: {
        // Fira Code = headings, metrics, IDs, timestamps (README §9)
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Fira Sans = body, labels, buttons, prose
        sans: ['Fira Sans', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(2rem, 7vw, 3rem)', { lineHeight: '1.1', fontWeight: '700' }],
        h1: ['2rem', { lineHeight: '1.2', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        metric: ['2.25rem', { lineHeight: '1.1', fontWeight: '700' }],
        body: ['1rem', { lineHeight: '1.6' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        xs: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        'mono-sm': ['0.8125rem', { lineHeight: '1.5' }],
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      keyframes: {
        'critical-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 color-mix(in srgb, var(--status-critical-vivid) 45%, transparent)',
          },
          '50%': {
            boxShadow: '0 0 0 6px color-mix(in srgb, var(--status-critical-vivid) 0%, transparent)',
          },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        // The ONLY looping animation permitted (README §7); suppressed by the
        // prefers-reduced-motion block in tokens.css.
        'critical-pulse': 'critical-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 200ms var(--ease-out) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
