/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute origin of the Vercel deployment. Required for the Android build:
      the webview is served from https://localhost, so relative /api calls would
      not resolve. Empty in web dev, where /api is same-origin. */
  readonly VITE_API_BASE_URL?: string
  /** Bundle version baked in at build time, shown in Settings (§9.3). */
  readonly VITE_BUNDLE_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
