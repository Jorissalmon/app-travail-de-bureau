import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setNavigator } from '@/features/reminders/deeplink'

/**
 * Connects react-router's navigate to the deep-link queue, so a notification
 * tap that arrived before the router mounted is drained now (§8.4).
 */
export function RouterBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    setNavigator((route) => navigate(route))
    return () => setNavigator(null)
  }, [navigate])
  return null
}
