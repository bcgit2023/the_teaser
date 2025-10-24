/**
 * Retry utility with exponential backoff for handling network failures
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryCondition?: (error: any) => boolean
}

export class RetryError extends Error {
  public readonly attempts: number
  public readonly lastError: Error

  constructor(message: string, attempts: number, lastError: Error) {
    super(message)
    this.name = 'RetryError'
    this.attempts = attempts
    this.lastError = lastError
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryCondition = isRetryableError
  } = options

  let lastError: Error = new Error('Unknown error')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      if (attempt > 0) {
        console.log(`[RETRY] Operation succeeded on attempt ${attempt + 1}`)
      }
      return result
    } catch (error) {
      lastError = error as Error
      
      console.log(`[RETRY] Attempt ${attempt + 1} failed:`, error)
      
      // If this is the last attempt or error is not retryable, don't retry
      if (attempt === maxRetries || !retryCondition(error)) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay)
      console.log(`[RETRY] Waiting ${delay}ms before retry...`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new RetryError(
    `Failed after ${maxRetries + 1} attempts: ${lastError.message}`,
    maxRetries + 1,
    lastError
  )
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors that should be retried
  const retryableCodes = [
    'ENOTFOUND',     // DNS resolution failed
    'ECONNREFUSED',  // Connection refused
    'ETIMEDOUT',     // Connection timeout
    'ECONNRESET',    // Connection reset
    'EPIPE',         // Broken pipe
    'EHOSTUNREACH',  // Host unreachable
    'ENETUNREACH',   // Network unreachable
  ]
  
  // HTTP status codes that should be retried
  const retryableStatusCodes = [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    520, // Unknown Error (Cloudflare)
    521, // Web Server Is Down (Cloudflare)
    522, // Connection Timed Out (Cloudflare)
    523, // Origin Is Unreachable (Cloudflare)
    524, // A Timeout Occurred (Cloudflare)
  ]
  
  // Check error code
  if (error.code && retryableCodes.includes(error.code)) {
    return true
  }
  
  // Check HTTP status
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true
  }
  
  // Check error message for common network issues
  const errorMessage = error.message?.toLowerCase() || ''
  const retryableMessages = [
    'connection error',
    'network error',
    'timeout',
    'socket hang up',
    'connect timeout',
    'request timeout',
    'fetch failed',
    'failed to fetch'
  ]
  
  return retryableMessages.some(msg => errorMessage.includes(msg))
}

/**
 * Retry specifically for OpenAI API calls
 */
export async function retryOpenAICall<T>(
  fn: () => Promise<T>,
  operationName: string = 'OpenAI API call'
): Promise<T> {
  console.log(`[OPENAI-RETRY] Starting ${operationName}`)
  
  return retryWithBackoff(fn, {
    maxRetries: 3,
    baseDelay: 2000,  // Start with 2 seconds
    maxDelay: 15000,  // Max 15 seconds
    backoffFactor: 2,
    retryCondition: (error) => {
      const isRetryable = isRetryableError(error)
      console.log(`[OPENAI-RETRY] Error ${error.message} is ${isRetryable ? 'retryable' : 'not retryable'}`)
      return isRetryable
    }
  })
}