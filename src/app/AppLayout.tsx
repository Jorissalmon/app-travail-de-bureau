import { Outlet } from 'react-router-dom'
import { TabBar } from '@/components/TabBar'

/** Shell for the five tabbed screens: scrollable content + bottom tab bar. */
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
    </div>
  )
}
