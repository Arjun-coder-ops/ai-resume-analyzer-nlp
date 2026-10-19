// components/ErrorBoundary.jsx - React Error Boundary to prevent black screen crashes
import React from 'react'
import { TriangleAlert, RotateCcw, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'

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
        <Card className="p-8 text-center animate-scale-in border-destructive/20 bg-destructive/5 space-y-4">
          <div className="w-12 h-12 rounded-[0.375rem] bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto text-destructive shadow-well">
            <TriangleAlert size={22} aria-hidden="true" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <CardTitle className="text-base text-foreground">
              Unable to display results view
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              A rendering error occurred while displaying this analysis. Your results remain safely saved in your history.
            </CardDescription>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Try again</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>Refresh page</span>
            </Button>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}
