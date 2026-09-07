import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
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
import { Onboarding } from '@/screens/Onboarding'

/**
 * Every screen needs either an account or the deliberate choice to do without
 * one (§C3). While that is still resolving we show a splash rather than
 * flashing the login screen.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

/**
 * The welcome runs once per device, before the tabs (§ audit). It sits inside
 * RequireAuth rather than in front of it — the login screen is still the first
 * thing a new phone sees — but nothing tabbed is reachable until the app has
 * said what it does, why thirty minutes, and what Android has to allow.
 *
 * The player and the alert route are deliberately outside it: they are only
 * ever reached from a reminder, which cannot exist before a first session.
 */
function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const status = useOnboardingStore((s) => s.status)
  if (status === 'loading') return <Splash />
  if (status === 'todo') return <Navigate to="/bienvenue" replace />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <>
      <RouterBridge />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/bienvenue"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />

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
              <RequireOnboarding>
                <AppLayout />
              </RequireOnboarding>
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
