import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

// Define user roles
type UserRole = 'admin' | 'student' | 'parent'

// JWT secret for token verification
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key'

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gffbcefjrnizipnflqjw.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZmJjZWZqcm5pemlwbmZscWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNjE1NzQsImV4cCI6MjA0OTkzNzU3NH0.Ey8Ej8Ey8Ej8Ey8Ej8Ey8Ej8Ey8Ej8Ey8Ej8Ey8Ej8Ey8'

// Define route constants
const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  TUTORIAL: '/tutorial',
  ADMIN_DASHBOARD: '/admin-dashboard',
  PARENT_DASHBOARD: '/parent-dashboard',
  QUIZ: '/quiz',
  QUIZ_ASSESSMENT: '/quiz-assessment',
  GRAMMAR_PRACTICE: '/grammar-practice'
}

export async function middleware(request: NextRequest) {
  // Get the pathname
  const pathname = request.nextUrl.pathname

  // Always allow access to static files and api routes
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/video') ||
    pathname.startsWith('/voice')
  ) {
    return NextResponse.next()
  }

  // Always allow access to the home page, login page, quiz page, and quiz assessment (for testing)
  if (pathname === ROUTES.HOME || pathname === ROUTES.LOGIN || pathname === ROUTES.QUIZ || pathname.startsWith(ROUTES.QUIZ_ASSESSMENT)) {
    return NextResponse.next()
  }

  // Get auth token from cookie (updated to match login API)
  const authToken = request.cookies.get('auth-token')?.value
  const supabaseToken = request.cookies.get('sb-gffbcefjrnizipnflqjw-auth-token.0')?.value

  let userRole: UserRole | null = null
  let userId: string | null = null
  let userEmail: string | null = null

  // Try local JWT authentication first
  if (authToken) {
    try {
      const { payload } = await jwtVerify(authToken, new TextEncoder().encode(JWT_SECRET))
      if (payload) {
        userRole = payload.role as UserRole
        userId = payload.userId?.toString() || ''
        userEmail = payload.email?.toString() || ''
      }
    } catch (error) {
      console.error('Local JWT verification failed:', error)
    }
  }

  // If local JWT failed and using Supabase, try Supabase authentication
  if (!userRole && supabaseToken && process.env.DATABASE_TYPE === 'supabase') {
    try {
      console.log('Middleware: Supabase token found:', supabaseToken.substring(0, 100) + '...')
      
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      
      // Try to parse the Supabase token (it might be base64 encoded)
      let tokenData
      try {
        // First try direct JSON parse
        tokenData = JSON.parse(supabaseToken)
      } catch {
        // If that fails, try base64 decode first
        tokenData = JSON.parse(atob(supabaseToken))
      }
      
      console.log('Middleware: Parsed token data keys:', Object.keys(tokenData))
      const accessToken = tokenData.access_token
      console.log('Middleware: Access token found:', !!accessToken)
      
      if (accessToken) {
        // Get the user
        const { data: { user }, error } = await supabase.auth.getUser(accessToken)
        console.log('Middleware: Supabase user verification result:', { user: !!user, error: !!error })
        
        if (user && !error) {
          userId = user.id
          userEmail = user.email || ''
          
          // Get user role from user metadata or database
          // First check user metadata
          const userMetadata = user.user_metadata || user.app_metadata
          if (userMetadata && userMetadata.role) {
            userRole = userMetadata.role as UserRole
          } else {
            // Fallback: query the users table to get the role
            try {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('role')
                .eq('supabase_id', user.id)
                .single()
              
              if (userData && !userError) {
                userRole = userData.role as UserRole
              } else {
                // Default fallback
                userRole = 'student'
              }
            } catch (dbError) {
              console.error('Error fetching user role from database:', dbError)
              userRole = 'student' // Default fallback
            }
          }
          
          console.log('Middleware: Supabase user authenticated:', userEmail, 'Role:', userRole)
        } else {
          console.log('Middleware: Supabase user verification failed:', error)
        }
      }
    } catch (error) {
      console.error('Middleware: Supabase authentication failed:', error)
    }
  }

  // If no valid authentication found, redirect to login
  if (!userRole) {
    return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url))
  }

    // Check if the user has the correct role for the requested page
    if (pathname.startsWith(ROUTES.ADMIN_DASHBOARD) && userRole !== 'admin') {
      return NextResponse.redirect(new URL(ROUTES.TUTORIAL, request.url))
    }

    if (pathname.startsWith(ROUTES.TUTORIAL) && userRole !== 'student') {
      return NextResponse.redirect(new URL(ROUTES.ADMIN_DASHBOARD, request.url))
    }

    // Handle parent dashboard access
    if (pathname.startsWith(ROUTES.PARENT_DASHBOARD) && userRole !== 'parent') {
      // Redirect based on user role
      if (userRole === 'admin') {
        return NextResponse.redirect(new URL(ROUTES.ADMIN_DASHBOARD, request.url))
      } else {
        return NextResponse.redirect(new URL(ROUTES.TUTORIAL, request.url))
      }
    }

    // Allow access to quiz and quiz-assessment routes for students and admins
    const isQuizRoute = pathname.startsWith(ROUTES.QUIZ) || 
                       pathname.startsWith(ROUTES.QUIZ_ASSESSMENT)
    if (isQuizRoute && !['student', 'admin'].includes(userRole)) {
      return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url))
    }

  // Add user data to request headers for downstream use
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', userId || '')
  requestHeaders.set('x-user-role', userRole)
  requestHeaders.set('x-user-email', userEmail || '')
  requestHeaders.set('x-session-id', '') // Session ID not available for Supabase auth

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// Update the matcher to include all routes except static files and api routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (static images)
     * - icons (static icons)
     * - logo (static logos)
     * - video (static videos)
     * - voice (static voice files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|icons|logo|video|voice).*)',
  ],
}