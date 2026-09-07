import { isNative } from '@/lib/platform'
import { useSessionStore } from '@/stores/session'
import { dueBy } from './schedule'
import { KINDS } from './kinds'
import { startAlerting, stopAlerting } from './alert'

/**
 * The reminder path for a browser tab left open on the work computer.
 *
 * On the phone the alarm is Android's job: a scheduled notification fires
 * whether or not the app runs. A browser has no such thing without a service
 * worker and a push service, so the tab watches the clock itself — which is
 * enough, and honest about it: the alert only works while the tab is open.
 *
 * It reads the wall clock rather than counting down, exactly like the player
 * does: a background tab is throttled to whatever interval the browser feels
 * like, and comparing against a deadline self-corrects on the next tick instead
 * of drifting.
 */

/** Fast enough that a reminder is never more than this late, cheap enough to
    leave running all day. Background tabs throttle it further; the wall-clock
    comparison absorbs that. */
const TICK_MS = 5_000

let installed = false

export function installWebAlarm(): void {
  if (installed) return
  installed = true

  // Both platforms: the alarm belongs to an unanswered exercise, so the moment
  // one is answered — started, snoozed, marked done, or the day stopped — it
  // goes quiet. On the phone the sound is started by the notification landing
  // while the app runs (see listener.ts); here is where it is switched off.
  useSessionStore.subscribe((state, prev) => {
    if (prev.awaiting && !state.awaiting) stopAlerting()
  })

  // Only a browser tab has to watch the clock itself. Android schedules its own
  // alarms and wakes the app for them.
  if (isNative()) return

  setInterval(() => void tick(), TICK_MS)

  // Coming back to the tab is a good moment to notice a reminder that came due
  // while it was in the background and being throttled.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void tick()
  })
}

async function tick(): Promise<void> {
  // A tab left open overnight is the plainest way a day never ends. The clock
  // is already being read here, so this is where it gets noticed.
  if (await useSessionStore.getState().closeOverrun()) return

  const { session, occurrences, pause, awaiting } = useSessionStore.getState()
  // Nothing to watch: no day running, held on purpose, or already waiting on an
  // answer (in which case the prompt is already up and possibly still ringing).
  if (!session || pause || awaiting) return

  const due = dueBy(occurrences, new Date())
  if (!due) return

  // The same door the notification tap goes through on the phone: it records
  // the exercise as owed, which is what puts the prompt in front.
  await useSessionStore.getState().noteAwaiting(due.kind)
  notifyInTab(due.kind)
  startAlerting()
}

/**
 * A browser notification, so the alert lands even when the tab is behind the
 * work you were doing. Best-effort: no permission, no notification — the
 * in-page prompt and the sound still happen.
 */
function notifyInTab(kind: keyof typeof KINDS): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const copy = KINDS[kind]
  try {
    const n = new Notification(copy.title, { body: copy.body, tag: 'logoff-break' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* Some browsers refuse to construct one outside a service worker. */
  }
}

/**
 * Asked for from the gesture that starts the day, which is the only moment a
 * browser will consider the request legitimate. Never blocks: a refusal just
 * means the alert stays inside the tab.
 */
export async function askForTabNotifications(): Promise<void> {
  if (isNative() || typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    /* Older browsers use the callback form; not worth a shim. */
  }
}
