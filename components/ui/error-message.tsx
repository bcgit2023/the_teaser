'use client'

import React from 'react'
import { Button } from "@/components/ui/button"
import { AlertTriangle } from 'lucide-react'

interface ErrorMessageProps {
  title?: string
  message: string
  onRetry?: () => void
  variant?: 'default' | 'destructive' | 'warning'
}

/**
 * A reusable error message component that provides consistent styling and behavior
 * for error messages throughout the application.
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  title = 'Error',
  message, 
  onRetry,
  variant = 'default'
}) => {
  // Determine styling based on variant
  const getBgColor = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-amber-50 border-amber-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const getTextColor = () => {
    switch (variant) {
      case 'destructive':
        return 'text-red-700'
      case 'warning':
        return 'text-amber-700'
      default:
        return 'text-blue-700'
    }
  }

  const getIconColor = () => {
    switch (variant) {
      case 'destructive':
        return 'text-red-500'
      case 'warning':
        return 'text-amber-500'
      default:
        return 'text-blue-500'
    }
  }

  return (
    <div 
      className={`rounded-lg border ${getBgColor()} p-4 shadow-sm`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start">
        <div className={`mr-3 ${getIconColor()}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className={`text-sm font-medium ${getTextColor()}`}>{title}</h3>
          <div className={`mt-1 text-sm ${getTextColor()} opacity-90`}>
            {message}
          </div>
          {onRetry && (
            <div className="mt-3">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onRetry}
                className={`${getTextColor()} border-current hover:bg-opacity-10 hover:bg-current`}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ErrorMessage
