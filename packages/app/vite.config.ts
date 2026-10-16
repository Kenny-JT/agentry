import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  // Do not remove: pre-bundling this dep breaks its Web Worker URL in dev,
  // silently degrading routing to smoothstep. Excluding fixes `pnpm dev`.
  optimizeDeps: { exclude: ['reactflow-edge-routing'] },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  server: {
    port: 5173,
    strictPort: true,
    host: tauriHost || false,
    hmr: tauriHost ? { protocol: 'ws', host: tauriHost, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
