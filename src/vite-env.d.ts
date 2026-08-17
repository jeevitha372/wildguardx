/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_INTERVAL?: string
  readonly VITE_DEMO_SEVERITY_MIX?: string
  readonly VITE_DEMO_OFFLINE_NODES?: string
  readonly VITE_DEMO_DEGRADED_NODES?: string
  readonly VITE_DEMO_SEED?: string
  readonly VITE_DEMO_SOS_CHANCE?: string
  readonly VITE_DEMO_LATENCY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
