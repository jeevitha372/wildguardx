import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Injects the default theme into the inline bootstrap in index.html.
 *
 * Vite's own `%VITE_X%` HTML substitution warns loudly when the variable is
 * unset — and it legitimately is unset until someone copies .env.example to
 * .env. This plugin substitutes with an explicit fallback instead, so a fresh
 * clone builds clean.
 */
function themeDefaultPlugin(defaultTheme: string): Plugin {
  const theme = defaultTheme === 'light' ? 'light' : 'dark'
  return {
    name: 'wildguardx-theme-default',
    transformIndexHtml(html) {
      return html.replaceAll('__DEFAULT_THEME__', theme)
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' prefix = load every var, not just VITE_*, so the plugin can read it
  // even though it is consumed at build time rather than in client code.
  const env = loadEnv(mode, process.cwd(), '')

  return {
  base: '/wildguardx/',
  plugins: [react(), themeDefaultPlugin(env.VITE_DEFAULT_THEME ?? 'dark')],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
    server: {
      port: 5173,
      open: false,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // The app chunk carries the demo fixtures (~220 kB of seeded JSON), which
      // is why it is larger than a typical SPA entry. That weight disappears with
      // the mock layer; it is not app code.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Charting and mapping are heavy and only needed on a subset of pages.
          // Splitting them keeps the initial parse for the dashboard smaller and
          // lets the browser cache them independently of app code.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
            fixtures: [
              './src/data/fixtures/nodes.json',
              './src/data/fixtures/detections.json',
              './src/data/fixtures/team.json',
              './src/data/fixtures/sectors.json',
              './src/data/fixtures/geofences.json',
              './src/data/fixtures/rules.json',
              './src/data/fixtures/channels.json',
            ],
          },
        },
      },
    },
  }
})
