/**
 * The single place where a concrete DataProvider is chosen.
 *
 * To move off demo data: replace `new MockProvider()` below with the real
 * implementation. Nothing else in the app imports MockProvider.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DataProvider, ProviderStatus } from './DataProvider'
import { MockProvider } from './MockProvider'
import type { Detection } from './types'

interface DataContextValue {
  provider: DataProvider
  status: ProviderStatus
  /** Detections received since mount, newest first (capped). */
  liveFeed: Detection[]
  /** Increments on every new detection — a cheap dependency for refetching. */
  tick: number
}

const DataCtx = createContext<DataContextValue | null>(null)

const LIVE_FEED_CAP = 200

export function DataLayerProvider({ children }: { children: ReactNode }) {
  // <- swap this line for `new FirebaseProvider(config)` when ingest lands.
  const provider = useMemo(() => new MockProvider(), [])

  const [status, setStatus] = useState<ProviderStatus>(() => provider.getStatus())
  const [liveFeed, setLiveFeed] = useState<Detection[]>([])
  const [tick, setTick] = useState(0)

  // Batch bursts into animation frames so a high-volume incident cannot lock
  // the tab (dashboard.md §5, backpressure).
  const pending = useRef<Detection[]>([])
  const raf = useRef<number | null>(null)

  useEffect(() => {
    provider.start()

    const offDetections = provider.subscribeDetections((d) => {
      pending.current.push(d)
      if (raf.current != null) return
      raf.current = window.setTimeout(() => {
        const batch = pending.current
        pending.current = []
        raf.current = null
        if (!batch.length) return
        setLiveFeed((prev) => [...batch.reverse(), ...prev].slice(0, LIVE_FEED_CAP))
        setTick((t) => t + batch.length)
      }, 250)
    })

    const offStatus = provider.subscribeStatus(setStatus)

    return () => {
      offDetections()
      offStatus()
      provider.stop()
      if (raf.current != null) window.clearTimeout(raf.current)
    }
  }, [provider])

  const value = useMemo<DataContextValue>(
    () => ({ provider, status, liveFeed, tick }),
    [provider, status, liveFeed, tick],
  )

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData must be used inside <DataLayerProvider>')
  return ctx
}

export function useProvider(): DataProvider {
  return useData().provider
}

/** The MockProvider instance, when running on demo data. Null otherwise. */
export function useMockProvider(): MockProvider | null {
  const provider = useProvider()
  return provider instanceof MockProvider ? provider : null
}
