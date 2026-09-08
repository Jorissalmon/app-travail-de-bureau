import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Wordmark } from './Wordmark'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches a render crash anywhere below it and shows a way out instead of a
 * black screen. Nothing else in the app had this: an exception in any screen
 * used to unmount the whole tree with no message, and the OTA rollback does
 * not apply — it only watches the few seconds after `notifyAppReady()`, long
 * before a crash like this can happen.
 *
 * Reloading is enough to recover in the case that matters most: a bad OTA
 * bundle. The plugin serves the previous good bundle until the next one is
 * confirmed working, so a reload after a crash comes back on the version that
 * did not crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[crash]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        className="gutter flex min-h-0 flex-1 flex-col items-center justify-center text-center"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <Wordmark size={30} />
        <h1 className="t-day mt-6">Un problème est survenu.</h1>
        <p className="t-body mt-2 max-w-[32ch]" style={{ color: 'var(--text-2)' }}>
          Rien n’est perdu : ta journée et tes réglages restent sur l’appareil.
        </p>
        <button
          type="button"
          className="btn btn-accent mt-7"
          style={{ maxWidth: 260 }}
          onClick={() => window.location.reload()}
        >
          Recharger
        </button>
      </div>
    )
  }
}
