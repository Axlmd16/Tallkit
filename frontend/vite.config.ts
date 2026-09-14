import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: process.env.BUILD_OUT_DIR ?? 'dist' },
  resolve: { tsconfigPaths: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: process.env.COVERAGE_DIR ?? 'coverage',
      reporter: ['text', 'html'],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
      exclude: ['src/main.tsx', 'src/test-setup.ts', 'src/dev/**'],
    },
  },
})
