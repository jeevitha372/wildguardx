/**
 * Theme state.
 *
 * Resolution order: localStorage -> prefers-color-scheme -> VITE_DEFAULT_THEME
 * -> dark. The same order is duplicated in the inline bootstrap script in
 * index.html, which stamps `data-theme` on <html> BEFORE first paint so there
 * is no flash of the wrong theme. This module then adopts whatever that script
 * already decided rather than recomputing and risking a mismatch.
 */

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'wildguardx.theme'

function envDefault(): Theme {
  const v = import.meta.env.VITE_DEFAULT_THEME
  return v === 'light' ? 'light' : 'dark'
}

/** The same decision the inline bootstrap makes. Kept in sync deliberately. */
export function resolveInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    // The bootstrap script has already run — trust it.
    const stamped = document.documentElement.getAttribute('data-theme')
    if (stamped === 'light' || stamped === 'dark') return stamped
  }
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* storage can throw in private mode or a sandboxed frame */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  }
  return envDefault()
}

function apply(theme: Theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  // Keep the browser UI (address bar, form controls) in step.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#F1F3F7' : '#0B1120')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme)

  useEffect(() => {
    apply(theme)
  }, [theme])

  // Follow the OS only while the user has expressed no preference of their own.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (e: MediaQueryListEvent) => {
      let hasExplicit = false
      try {
        hasExplicit = localStorage.getItem(THEME_STORAGE_KEY) != null
      } catch {
        /* ignore */
      }
      if (!hasExplicit) setThemeState(e.matches ? 'light' : 'dark')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* non-fatal: the theme still applies for this session */
    }
    setThemeState(next)
  }, [])

  const toggle = useCallback(() => {
    setThemeState((cur) => {
      const next: Theme = cur === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}

/**
 * Read a resolved CSS custom property as a concrete colour string.
 *
 * Canvas-based renderers (Leaflet vectors) cannot consume `var(--x)`, so they
 * have to sample the computed value and re-sample when the theme changes.
 */
export function cssVar(name: string, fallback = '#000000'): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
