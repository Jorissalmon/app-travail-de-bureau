import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@/styles/index.css'
import { AppRoutes } from '@/app/routes'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from '@/lib/platform'
import { catchUpAndRoute, installReminderListeners } from '@/features/reminders/listener'
import { installWebAlarm } from '@/features/reminders/webAlarm'
import { installAutoStart } from '@/features/reminders/autostart'
import { loadAlertMode } from '@/features/reminders/alert'
import { ensureChannelAndActions } from '@/features/reminders/notifications'
import { notifyReady, checkForUpdate } from '@/features/ota/updater'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { useSessionStore } from '@/stores/session'
import { useOnboardingStore } from '@/stores/onboarding'
import { flushEvents } from '@/features/reminders/events'

/**
 * Boot order matters (§9.3):
 *  1. notifyAppReady() before anything else, or the OTA plugin rolls back.
 *  2. Register the notification-action listener BEFORE first render, so a cold
 *     start from a notification tap is not lost (§8.4).
 *  3. Render immediately — no blocking network call (§13.2).
 *  4. After paint: hydrate stores, check for an OTA update in the background.
 */
// A rejection nobody awaited used to vanish with no trace (§ audit) — this is
// the one that caught 401s from session.start() before the store learned to
// treat a server failure as best-effort. Logging it is the whole fix: it turns
// a silent failure into one that shows up in the logs the next time it happens
// anywhere else, native or web.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled]', event.reason)
})

async function boot() {
  await notifyReady()

  // Listener before render (deep links queue until the router mounts).
  installReminderListeners()
  // The browser-tab path: harmless and inert on the phone, where Android's own
  // alarms do the job.
  installWebAlarm()
  // The morning invitation, which watches the setting and the session and arms
  // itself. Inert in a browser, which cannot schedule anything.
  installAutoStart()
  void loadAlertMode()

  if (isNative()) {
    try {
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setOverlaysWebView({ overlay: true })
    } catch {
      /* status bar not available */
    }
    void ensureChannelAndActions()
  }

  // Hydrate local state (all from device storage, non-blocking to render).
  void useSettingsStore.getState().load()
  // A reminder may have fired and gone unanswered while the app was closed; the
  // route it queues is drained as soon as the router mounts (§8.4).
  void useSessionStore.getState().hydrate().then(catchUpAndRoute)
  void useContentStore.getState().load()
  void useAuthStore.getState().bootstrap()
  void useOnboardingStore.getState().load()

  const root = document.getElementById('root')
  if (!root) throw new Error('#root missing')
  createRoot(root).render(
    <StrictMode>
      <HashRouter>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </HashRouter>
    </StrictMode>,
  )

  // After the first paint: opportunistic sync + OTA check (§9.3 / §13.2).
  requestAnimationFrame(() => {
    void flushEvents()
    void checkForUpdate()
  })
}

void boot()
