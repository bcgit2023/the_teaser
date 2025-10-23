/**
 * Protected Route Middleware
 * 
 * Provides route protection with session validation and role-based access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/middleware/auth-middleware';

export interface ProtectedRouteConfig {
  requireAuth?: boolean;
  allowedRoles?: ('student' | 'teacher' | 'parent')[];
  redirectTo?: string;
}

export async function protectedRoute(
  request: NextRequest,
  config: ProtectedRouteConfig = {}
): Promise<NextResponse | null> {
  const {
    requireAuth = true,
    allowedRoles = [],
    redirectTo = '/login'
  } = config;

  // Skip protection if not required
  if (!requireAuth) {
    return null;
  }

  try {
    // Extract session token from cookie
    const sessionToken = request.cookies.get('session-token')?.value;

    if (!sessionToken) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    // Validate session
    const sessionData = await SessionManager.validateSession(sessionToken);
    
    if (!sessionData) {
      // Clear invalid session cookie
      const response = NextResponse.redirect(new URL(redirectTo, request.url));
      response.cookies.set('session-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/'
      });
      return response;
    }

    // Check role-based access
    if (allowedRoles.length > 0 && !allowedRoles.includes(sessionData.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Add user data to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', sessionData.userId.toString());
    response.headers.set('x-user-role', sessionData.role);
    response.headers.set('x-user-email', sessionData.email || '');
    response.headers.set('x-session-id', sessionData.sessionId || '');

    return response;

  } catch (error) {
    console.error('Protected route middleware error:', error);
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }
}

// ============================================================================
// Route-specific Protection Helpers
// ============================================================================

export const studentOnlyRoute = (request: NextRequest) =>
  protectedRoute(request, {
    requireAuth: true,
    allowedRoles: ['student'],
    redirectTo: '/login'
  });

export const teacherOnlyRoute = (request: NextRequest) =>
  protectedRoute(request, {
    requireAuth: true,
    allowedRoles: ['teacher'],
    redirectTo: '/login'
  });

export const parentOnlyRoute = (request: NextRequest) =>
  protectedRoute(request, {
    requireAuth: true,
    allowedRoles: ['parent'],
    redirectTo: '/login'
  });

export const authenticatedRoute = (request: NextRequest) =>
  protectedRoute(request, {
    requireAuth: true,
    allowedRoles: ['student', 'teacher', 'parent'],
    redirectTo: '/login'
  });

export const adminRoute = (request: NextRequest) =>
  protectedRoute(request, {
    requireAuth: true,
    allowedRoles: ['teacher'], // Assuming teachers have admin privileges
    redirectTo: '/login'
  });