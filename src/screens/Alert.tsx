import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessionStore } from '@/stores/session'
import { isReminderKind } from '@/features/reminders/kinds'

/**
 * Where a tap on a reminder lands (§8.4). It no longer draws anything: the
 * break is a prompt over the app, not a page you can navigate away from and
 * forget. All this route does is record which exercise is owed and step aside,
 * so there is one presentation of a break and one only.
 */
export function Alert() {
  const { kind } = useParams()
  const navigate = useNavigate()
  const noteAwaiting = useSessionStore((s) => s.noteAwaiting)

  useEffect(() => {
    const run = async () => {
      if (isReminderKind(kind)) await noteAwaiting(kind)
      navigate('/', { replace: true })
    }
    void run()
  }, [kind, navigate, noteAwaiting])

  return null
}
