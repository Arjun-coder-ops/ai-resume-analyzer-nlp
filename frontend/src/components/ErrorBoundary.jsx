// components/ErrorBoundary.jsx - React Error Boundary to prevent black screen crashes
import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card p-8 text-center animate-fade-in border-red-500/20 bg-red-500/5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h3 className="font-display font-700 text-ink-100 text-lg mb-2">
            Unable to Display Results View
          </h3>
          <p className="text-ink-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
            A rendering error occurred while displaying this analysis. Your results are safely stored in your history.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="btn-volt flex items-center gap-2 px-4 py-2 text-sm"
            >
              <RefreshCw size={14} />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
