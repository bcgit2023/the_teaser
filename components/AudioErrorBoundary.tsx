'use client'

import React, { Component, ReactNode } from 'react'
import { Button } from "@/components/ui/button"
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error boundary specifically for audio-related components
 * Catches JavaScript errors in audio components and displays a fallback UI
 */
export class AudioErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('Audio component error caught by boundary:', error, errorInfo)
    
    // You could also log this to an error reporting service
    // logErrorToService(error, errorInfo)
  }

  handleRetry = () => {
    // Reset the error boundary state
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Audio Component Error</h3>
          <p className="text-sm text-red-600 text-center mb-4">
            An error occurred with the audio component. This might be due to browser compatibility issues or audio permissions.
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={this.handleRetry}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.reload()}
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Refresh Page
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 w-full">
              <summary className="text-xs text-red-500 cursor-pointer">Error Details (Dev Mode)</summary>
              <pre className="text-xs text-red-600 mt-2 p-2 bg-red-100 rounded overflow-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default AudioErrorBoundary