import { Outlet } from 'react-router-dom'
import { TabBar } from '@/components/TabBar'
import { BreakOverlay } from '@/components/BreakOverlay'
import { DayEndSheet } from '@/components/DayEndSheet'

/**
 * Shell for the five tabbed screens: scrollable content + bottom tab bar.
 *
 * The break prompt lives here rather than on a route, so an owed exercise comes
 * up over whichever tab is open. The player and the login screen sit outside
 * this shell, which is exactly right: a reminder never covers an exercise
 * already under way, nor a screen you are not signed in behind.
 *
 * The end-of-day question sits beside it for the same reason: it is asked of
 * whoever opens the app, on whichever tab, and it is asked again until it has
 * an answer.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Outlet />
      </main>
      <TabBar />
      <BreakOverlay />
      <DayEndSheet />
    </div>
  )
}
