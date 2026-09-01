/**
 * Deep-link queue (§8.4). The notification-action listener must be registered
 * before the first render so a cold start from a notification is not lost. When
 * the router is not yet mounted, the target route is queued here and drained
 * once navigation is available.
 */

type Navigate = (route: string) => void

let navigator: Navigate | null = null
let pending: string | null = null

export function setNavigator(fn: Navigate | null): void {
  navigator = fn
  if (fn && pending) {
    const route = pending
    pending = null
    fn(route)
  }
}

/** Navigate now, or queue the route until the router is ready. */
export function navigateTo(route: string): void {
  if (navigator) navigator(route)
  else pending = route
}
