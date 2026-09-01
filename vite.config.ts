/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // The OTA bundle is unzipped at the webview root, so relative asset URLs
    // are the only ones that survive both `/` (dev, Vercel) and the bundle.
    assetsInlineLimit: 2048,
  },
  base: './',
  server: { port: 5173, host: true },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Pinned so the daylight-saving cases actually cross a DST boundary; in UTC
    // they would pass without proving anything.
    env: { TZ: 'Europe/Paris' },
  },
})
