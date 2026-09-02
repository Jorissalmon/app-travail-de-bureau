import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 8. Edge-to-edge is on so the app draws under the status/navigation
 * bars (§10.3); the OTA plugin runs in MANUAL mode — we drive download/set
 * ourselves against a self-hosted manifest (§9), no Capgo cloud account.
 */
const config: CapacitorConfig = {
  appId: 'app.releve',
  appName: 'Log Off',
  webDir: 'dist',
  android: {
    // Draw behind the system bars; safe-area insets handle the padding.
    adjustMarginsForEdgeToEdge: 'auto',
  },
  plugins: {
    CapacitorUpdater: {
      // Manual mode: the app decides when to download and apply bundles.
      autoUpdate: false,
      // Give the bundle 10 s to call notifyAppReady before rolling back.
      appReadyTimeout: 10000,
      resetWhenUpdate: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_logoff',
    },
  },
}

export default config
