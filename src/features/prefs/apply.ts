import { loadCustomRoutines } from '@/features/routines/custom'
import { loadDurations } from '@/features/session/durations'
import { loadCues } from '@/features/session/cues'
import { useContentStore } from '@/stores/content'

/**
 * Put the freshly-synced preferences back into the modules that own them, and
 * redraw whatever was showing the old ones.
 *
 * Split out from the sync itself so that module has no idea what a store is:
 * it moves strings, this decides what they mean.
 */
export async function reloadSyncedPrefs(): Promise<void> {
  await Promise.all([loadCustomRoutines(), loadDurations(), loadCues()])
  await useContentStore.getState().refreshMine()
}
