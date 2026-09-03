import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { AppLayout } from './AppLayout'
import { RouterBridge } from './RouterBridge'
import { Today } from '@/screens/Today'
import { Library } from '@/screens/Library'
import { RoutineDetail } from '@/screens/RoutineDetail'
import { ExerciseDetail } from '@/screens/ExerciseDetail'
import { RoutineBuilder } from '@/screens/RoutineBuilder'
import { Player } from '@/screens/Player'
import { Alert } from '@/screens/Alert'
import { Articles } from '@/screens/Articles'
import { ArticleDetail } from '@/screens/ArticleDetail'
import { Stats } from '@/screens/Stats'
import { Settings } from '@/screens/Settings'
import { Login } from '@/screens/Login'
import { Splash } from '@/screens/Splash'

/**
 * Every screen requires auth except /login itself (§C3). While auth is still
 * resolving we show a splash rather than flashing the login screen.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <>
      <RouterBridge />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/alerte/:kind"
          element={
            <RequireAuth>
              <Alert />
            </RequireAuth>
          }
        />

        <Route
          path="/player/:slug"
          element={
            <RequireAuth>
              <Player />
            </RequireAuth>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Today />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:slug" element={<RoutineDetail />} />
          <Route path="/library/:slug/composer" element={<RoutineBuilder />} />
          <Route path="/library/:slug/:position" element={<ExerciseDetail />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/:slug" element={<ArticleDetail />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
