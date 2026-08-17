/**
 * The six/seven data states, as a first-class mechanism rather than ad-hoc
 * `if (loading)` checks.
 *
 * pages/README.md §13 requires loading / empty / error / partial / stale /
 * success for every async region. The brief additionally named `offline`, so
 * this implements seven:
 *
 *   loading  — skeleton at final dimensions, never a bare spinner
 *   ideal    — the success path
 *   empty    — SVG + one-line cause + one action
 *   error    — cause + retry
 *   partial  — data rendered, but a named source failed
 *   stale    — data rendered dimmed, with a last-updated time
 *   offline  — cached data, actions queue
 *
 * A `StateOverride` context lets any page be forced into any state from the
 * app shell. Without that, "all six states are implemented" is an unverifiable
 * claim — this makes each one reachable in two clicks.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type DataStateKind =
  | 'loading'
  | 'ideal'
  | 'empty'
  | 'error'
  | 'partial'
  | 'stale'
  | 'offline'

export type StateOverride = 'auto' | DataStateKind

export const ALL_STATES: DataStateKind[] = [
  'loading',
  'ideal',
  'empty',
  'error',
  'partial',
  'stale',
  'offline',
]

interface OverrideCtxValue {
  override: StateOverride
  setOverride: (o: StateOverride) => void
}

const OverrideCtx = createContext<OverrideCtxValue>({
  override: 'auto',
  setOverride: () => {},
})

export function StateOverrideProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<StateOverride>('auto')
  const value = useMemo(() => ({ override, setOverride }), [override])
  return <OverrideCtx.Provider value={value}>{children}</OverrideCtx.Provider>
}

export function useStateOverride(): OverrideCtxValue {
  return useContext(OverrideCtx)
}

export interface AsyncQuery<T> {
  state: DataStateKind
  data: T | null
  error: Error | null
  /** Names the failed source on `partial`. */
  partialInfo: { failed: string[]; message: string } | null
  /** Last successful load, for the `stale` timestamp. */
  updatedAt: number | null
  retry: () => void
  /** True when the state was forced by the shell switcher, not observed. */
  forced: boolean
}

interface UseAsyncOptions<T> {
  /** Decides whether a successful result counts as empty. */
  isEmpty?: (data: T) => boolean
  /** Value handed to the page when the `empty` state is forced. */
  emptyValue?: T
  /** Names the sources that "fail" when `partial` is forced. */
  partialSources?: string[]
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options: UseAsyncOptions<T> = {},
): AsyncQuery<T> {
  const { override } = useStateOverride()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [nonce, setNonce] = useState(0)
  const alive = useRef(true)

  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    alive.current = true
    setLoading(true)
    setError(null)
    loaderRef
      .current()
      .then((result) => {
        if (!alive.current) return
        setData(result)
        setUpdatedAt(Date.now())
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!alive.current) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])

  // --- forced states from the shell switcher
  if (override !== 'auto') {
    const forcedError =
      override === 'error'
        ? new Error('Simulated failure: upstream returned 503 (forced by state switcher)')
        : null
    return {
      state: override,
      data: override === 'empty' ? (options.emptyValue ?? null) : data,
      error: forcedError,
      partialInfo:
        override === 'partial'
          ? {
              failed: options.partialSources ?? ['telemetry feed'],
              message: `${(options.partialSources ?? ['telemetry feed']).join(', ')} unavailable — some values may be missing.`,
            }
          : null,
      updatedAt,
      retry,
      forced: true,
    }
  }

  // --- observed states
  let state: DataStateKind = 'ideal'
  if (loading && data === null) state = 'loading'
  else if (error) state = 'error'
  else if (data !== null && options.isEmpty?.(data)) state = 'empty'

  return { state, data, error, partialInfo: null, updatedAt, retry, forced: false }
}

/** Convenience: is this a state where the page should render its real content? */
export function rendersData(state: DataStateKind): boolean {
  return state === 'ideal' || state === 'partial' || state === 'stale' || state === 'offline'
}
