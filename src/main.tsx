import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@/styles/index.css'
import { AppRoutes } from '@/app/routes'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative } from '@/lib/platform'
import { catchUpAndRoute, installReminderListeners } from '@/features/reminders/listener'
import { ensureChannelAndActions } from '@/features/reminders/notifications'
import { notifyReady, checkForUpdate } from '@/features/ota/updater'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useContentStore } from '@/stores/content'
import { useSessionStore } from '@/stores/session'
import { flushEvents } from '@/features/reminders/events'

/**
 * Boot order matters (§9.3):
 *  1. notifyAppReady() before anything else, or the OTA plugin rolls back.
 *  2. Register the notification-action listener BEFORE first render, so a cold
 *     start from a notification tap is not lost (§8.4).
 *  3. Render immediately — no blocking network call (§13.2).
 *  4. After paint: hydrate stores, check for an OTA update in the background.
 */
async function boot() {
  await notifyReady()

  // Listener before render (deep links queue until the router mounts).
  installReminderListeners()

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

  const root = document.getElementById('root')
  if (!root) throw new Error('#root missing')
  createRoot(root).render(
    <StrictMode>
      <HashRouter>
        <AppRoutes />
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
