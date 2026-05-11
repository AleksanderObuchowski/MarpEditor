import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-8">
          <AlertTriangle className="w-12 h-12 text-[var(--accent)] mb-4" />
          <h1 className="text-xl font-medium mb-2" style={{ fontFamily: '"Newsreader", serif' }}>
            Something went wrong
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md text-center">
            The editor encountered an error. Try reloading the page.
          </p>
          <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-panel)] p-4 rounded-lg max-w-lg overflow-auto font-mono">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)] transition-colors"
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
