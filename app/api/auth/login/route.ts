/**
 * Enhanced Login API Route
 * 
 * Provides secure authentication with rate limiting, session management,
 * and comprehensive security features. Updated to support both SQLite and Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityService } from '@/lib/services/security-service';
import { JWTManager, SessionManager } from '@/lib/middleware/auth-middleware';
import { AuthCredentials, LoginResponse } from '@/types/auth';
import { DatabaseManager } from '@/lib/database/database-manager';

// ============================================================================
// Login Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get client information
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // Parse request body
    const body: AuthCredentials = await request.json();
    const { username, password, role, remember_me = false, email } = body;

    // Validate input
    if ((!username && !email) || !password || !role) {
      return createErrorResponse('Missing required fields', 400);
    }

    // Sanitize input
    const sanitizedUsername = username ? securityService.sanitizeInput(username) : '';
    const sanitizedEmail = email ? securityService.sanitizeInput(email) : '';

    // Rate limiting check
    const rateLimitResult = securityService.checkLoginAttempt(clientIP);
    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        'Too many login attempts. Please try again later.',
        429,
        {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          'Retry-After': Math.ceil((rateLimitResult.blockUntil! - Date.now()) / 1000).toString()
        }
      );
    }

    const dbManager = DatabaseManager.getInstance();
    await dbManager.initializeIfNeeded();
    
    try {
      let authResult: any;
      let user: any;

      // Use Supabase authentication only
      const adapter = dbManager.getAdapter();
      authResult = await (adapter as any).authenticateWithCustomAuth(
        sanitizedEmail || sanitizedUsername,
        password
      );

      if (!authResult.user) {
        return createErrorResponse(
          authResult.error?.message || 'Invalid credentials',
          401
        );
      }

      user = authResult.user.profile;

      // Generate JWT tokens
      const sessionData = {
        userId: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      };

      const tokens = JWTManager.generateTokens(sessionData);

      // Create session
      const sessionToken = await SessionManager.createSession(
        user.id,
        tokens.accessToken,
        tokens.refreshToken,
        clientIP,
        userAgent
      );

      // Generate CSRF token
      const csrfToken = securityService.generateCSRFToken(sessionToken);

      // Prepare response
      const loginResponse: LoginResponse = {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
          account_status: user.account_status,
          email_verified: user.email_verified,
          last_login: user.last_login,
          created_at: user.created_at,
          updated_at: user.updated_at,
          login_attempts: user.login_attempts || 0,
          preferences: user.preferences || {}
        },
        token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: 3600 // 1 hour
      };

      // Create response with secure cookies
      const response = NextResponse.json(loginResponse, { status: 200 });

      // Set secure cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        path: '/',
        maxAge: remember_me ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60 // 30 days or 7 days
      };

      response.cookies.set('auth-token', tokens.accessToken, cookieOptions);
      response.cookies.set('refresh-token', tokens.refreshToken, {
        ...cookieOptions,
        maxAge: remember_me ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60
      });
      response.cookies.set('session-token', sessionToken, cookieOptions);

      // For Supabase, also set the Supabase session cookie if available
      if (authResult.session) {
        response.cookies.set('sb-access-token', authResult.session.access_token, cookieOptions);
        response.cookies.set('sb-refresh-token', authResult.session.refresh_token, cookieOptions);
      }

      // Set CSRF token in cookie (not httpOnly for client access)
      response.cookies.set('csrf-token', csrfToken, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 // 1 hour
      });

      // Add security headers
      addSecurityHeaders(response);

      // Reset rate limit on successful authentication
      securityService.resetRateLimit(clientIP, 'login');

      return response;

    } catch (authError) {
      console.error('Authentication error:', authError);
      
      return createErrorResponse(
        'Authentication failed',
        500
      );
    }

  } catch (error) {
    console.error('Login API error:', error);
    
    return createErrorResponse(
      'Internal server error',
      500
    );
  }
}

// ============================================================================
// Logout Handler
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get('session-token')?.value;
    
    if (sessionToken) {
      // Invalidate session
      await SessionManager.invalidateSession(sessionToken);
      
      // Remove CSRF token
      securityService.removeCSRFToken(sessionToken);
    }

    // Sign out from Supabase
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.initializeIfNeeded();
      const dbAdapter = dbManager.getAdapter();
      await (dbAdapter as any).signOutFromSupabase();
    } catch (error) {
      console.error('Supabase sign out error:', error);
    }

    // Create response
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    // Clear cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 0
    };

    response.cookies.set('auth-token', '', cookieOptions);
    response.cookies.set('refresh-token', '', cookieOptions);
    response.cookies.set('session-token', '', cookieOptions);
    response.cookies.set('csrf-token', '', {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0
    });

    // Clear Supabase cookies
    response.cookies.set('sb-access-token', '', cookieOptions);
    response.cookies.set('sb-refresh-token', '', cookieOptions);

    // Add security headers
    addSecurityHeaders(response);

    return response;

  } catch (error) {
    console.error('Logout API error:', error);
    
    return createErrorResponse(
      'Internal server error',
      500
    );
  }
}

// ============================================================================
// Token Refresh Handler
// ============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Get refresh token from cookie
    const refreshToken = request.cookies.get('refresh-token')?.value;
    
    if (!refreshToken) {
      return createErrorResponse('Refresh token not found', 401);
    }

    let refreshResult: any;

    // Try to refresh the Supabase session
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.initializeIfNeeded();
      const dbAdapter = dbManager.getAdapter();
      const supabaseRefresh = await (dbAdapter as any).refreshSupabaseSession();
      
      if (supabaseRefresh.error || !supabaseRefresh.session) {
        return createErrorResponse('Invalid refresh token', 401);
      }

      // Also refresh our internal session
      refreshResult = await SessionManager.refreshSession(refreshToken);
      
      if (!refreshResult) {
        return createErrorResponse('Invalid refresh token', 401);
      }
    } catch (error) {
      console.error('Supabase refresh error:', error);
      return createErrorResponse('Token refresh failed', 401);
    }

    // Generate new CSRF token
    const csrfToken = securityService.generateCSRFToken(refreshResult.sessionToken);

    // Prepare response
    const response = NextResponse.json({
      success: true,
      tokens: {
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken,
        expiresIn: 15 * 60, // 15 minutes
        tokenType: 'Bearer'
      },
      session: {
        sessionId: refreshResult.sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      csrfToken
    }, { status: 200 });

    // Update cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    };

    response.cookies.set('auth-token', refreshResult.accessToken, cookieOptions);
    response.cookies.set('refresh-token', refreshResult.refreshToken, cookieOptions);
    response.cookies.set('session-token', refreshResult.sessionToken, cookieOptions);

    // Set new CSRF token
    response.cookies.set('csrf-token', csrfToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 // 1 hour
    });

    // Add security headers
    addSecurityHeaders(response);

    return response;

  } catch (error) {
    console.error('Token refresh API error:', error);
    
    return createErrorResponse(
      'Internal server error',
      500
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

function createErrorResponse(
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    { 
      success: false,
      error: message,
      status,
      timestamp: new Date().toISOString()
    },
    { status }
  );

  // Add security headers
  addSecurityHeaders(response);

  // Add custom headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

function addSecurityHeaders(response: NextResponse): void {
  const securityHeaders = securityService.getSecurityHeaders();
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add additional API-specific headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
}