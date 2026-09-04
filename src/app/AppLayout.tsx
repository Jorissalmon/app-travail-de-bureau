import { useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
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
  const main = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // Every page opens at its top. The scroll lives on this one element and
  // React Router does not touch it, so opening an exercise from the bottom of
  // the library used to land you halfway down its explanation. Before paint,
  // so the old position is never seen.
  useLayoutEffect(() => {
    main.current?.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main
        ref={main}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', overscrollBehaviorY: 'contain' }}
      >
        <Outlet />
      </main>
      <TabBar />
      <BreakOverlay />
      <DayEndSheet />
    </div>
  )
}
